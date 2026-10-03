mod commands;
mod config;
mod error;
mod services;

use std::fs;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use serde::Serialize;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, WindowEvent,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::config::{get_config_path, AppConfig};

const MAIN_WINDOW: &str = "main";
const TRAY_ID: &str = "main";
/// Passed by the autostart entry so a login launch stays in the tray.
const HIDDEN_ARG: &str = "--hidden";

// Track if we're in dashboard mode (don't hide on focus loss)
static IS_DASHBOARD_MODE: AtomicBool = AtomicBool::new(false);
// Set while the frontend needs the Spotlight window to survive losing focus
// (native file dialog open, Settings open, window pinned by the user).
static BLUR_HIDE_SUSPENDED: AtomicBool = AtomicBool::new(false);

// The hotkey the user wants, whether it is currently registered with the OS,
// and the last registration problem to show in the UI.
static CURRENT_HOTKEY: Mutex<String> = Mutex::new(String::new());
static HOTKEY_REGISTERED: AtomicBool = AtomicBool::new(false);
static HOTKEY_PAUSED: AtomicBool = AtomicBool::new(false);
static HOTKEY_ERROR: Mutex<Option<String>> = Mutex::new(None);

#[derive(Debug, Serialize)]
pub struct HotkeyStatus {
    hotkey: String,
    registered: bool,
    error: Option<String>,
}

/// Where to put a window of `window` size so it sits just below the cursor
/// without leaving the given screen. All values are physical pixels.
fn place_near_cursor(
    cursor: (i32, i32),
    window: (i32, i32),
    screen_pos: (i32, i32),
    screen_size: (i32, i32),
) -> (i32, i32) {
    const MARGIN: i32 = 10;
    let screen_right = screen_pos.0 + screen_size.0;
    let screen_bottom = screen_pos.1 + screen_size.1;

    let mut x = cursor.0 - window.0 / 2;
    let mut y = cursor.1 + MARGIN;

    if x + window.0 > screen_right {
        x = screen_right - window.0 - MARGIN;
    }
    if x < screen_pos.0 {
        x = screen_pos.0 + MARGIN;
    }

    // If the window would go below the screen, show it above the cursor.
    if y + window.1 > screen_bottom {
        y = cursor.1 - window.1 - MARGIN;
    }
    if y < screen_pos.1 {
        y = screen_pos.1 + MARGIN;
    }

    (x, y)
}

fn position_window_at_cursor(window: &tauri::WebviewWindow) {
    let Ok(cursor) = window.cursor_position() else { return };
    let cursor = (cursor.x as i32, cursor.y as i32);
    let size = window.outer_size().unwrap_or(tauri::PhysicalSize::new(420, 500));
    let size = (size.width as i32, size.height as i32);

    // Use the monitor the cursor is on, which is not necessarily the one the
    // (hidden) window was last shown on.
    let monitor = window
        .available_monitors()
        .unwrap_or_default()
        .into_iter()
        .find(|monitor| {
            let pos = monitor.position();
            let size = monitor.size();
            cursor.0 >= pos.x
                && cursor.0 < pos.x + size.width as i32
                && cursor.1 >= pos.y
                && cursor.1 < pos.y + size.height as i32
        })
        .or_else(|| window.current_monitor().ok().flatten());

    let (x, y) = match monitor {
        Some(monitor) => {
            let pos = monitor.position();
            let screen = monitor.size();
            place_near_cursor(cursor, size, (pos.x, pos.y), (screen.width as i32, screen.height as i32))
        }
        None => (cursor.0 - size.0 / 2, cursor.1 + 10),
    };
    let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
}

fn show_window(window: &tauri::WebviewWindow) {
    // The Dashboard is a regular window; only Spotlight follows the cursor.
    if !IS_DASHBOARD_MODE.load(Ordering::SeqCst) {
        position_window_at_cursor(window);
    }
    let _ = window.show();
    let _ = window.set_focus();
}

fn toggle_window(window: &tauri::WebviewWindow) {
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
    } else {
        show_window(window);
    }
}

fn default_hotkey() -> &'static str {
    if cfg!(target_os = "linux") {
        "Ctrl+Alt+Space"
    } else {
        "Alt+Space"
    }
}

/// Load the hotkey from config, with OS-specific defaults
fn load_hotkey_from_config() -> String {
    fs::read_to_string(get_config_path())
        .ok()
        .and_then(|content| serde_json::from_str::<AppConfig>(&content).ok())
        .map(|config| config.hotkey)
        .filter(|hotkey| !hotkey.trim().is_empty())
        .unwrap_or_else(|| default_hotkey().to_string())
}

fn save_hotkey_to_config(hotkey: &str) -> Result<(), String> {
    let config_path = get_config_path();
    if let Some(parent) = config_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let config = AppConfig { hotkey: hotkey.to_string() };
    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    fs::write(&config_path, content).map_err(|e| format!("Failed to save config: {}", e))
}

/// Register `hotkey` with the OS as the window toggle.
fn bind_hotkey(app: &AppHandle, hotkey: &str) -> Result<(), String> {
    let shortcut: Shortcut = hotkey
        .parse()
        .map_err(|e| format!("Invalid shortcut format: {}", e))?;

    app.global_shortcut()
        .on_shortcut(shortcut, |app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
                    toggle_window(&window);
                }
            }
        })
        .map_err(|e| format!("Failed to register shortcut: {}", e))
}

fn unbind_hotkey(app: &AppHandle, hotkey: &str) {
    if let Ok(shortcut) = hotkey.parse::<Shortcut>() {
        let _ = app.global_shortcut().unregister(shortcut);
    }
}

fn current_hotkey() -> String {
    CURRENT_HOTKEY.lock().map(|hotkey| hotkey.clone()).unwrap_or_default()
}

fn set_hotkey_state(app: &AppHandle, hotkey: &str, registered: bool, error: Option<String>) {
    if let Ok(mut current) = CURRENT_HOTKEY.lock() {
        *current = hotkey.to_string();
    }
    HOTKEY_REGISTERED.store(registered, Ordering::SeqCst);
    if let Ok(mut slot) = HOTKEY_ERROR.lock() {
        *slot = error;
    }
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let tooltip = if registered {
            format!("OmniRecall - Press {}", hotkey)
        } else {
            "OmniRecall - click to open".to_string()
        };
        let _ = tray.set_tooltip(Some(tooltip));
    }
}

fn hotkey_status() -> HotkeyStatus {
    HotkeyStatus {
        hotkey: current_hotkey(),
        registered: HOTKEY_REGISTERED.load(Ordering::SeqCst),
        error: HOTKEY_ERROR.lock().ok().and_then(|slot| slot.clone()),
    }
}

/// Register the configured hotkey at startup, falling back to the platform
/// default. The outcome is kept so the UI can tell the user when no shortcut
/// could be registered (another app owns it) instead of failing silently.
fn register_startup_hotkey(app: &AppHandle) {
    let configured = load_hotkey_from_config();
    let fallback = default_hotkey();

    match bind_hotkey(app, &configured) {
        Ok(()) => set_hotkey_state(app, &configured, true, None),
        Err(err) => {
            tracing::error!("Failed to register hotkey '{}': {}", configured, err);
            if configured != fallback && bind_hotkey(app, fallback).is_ok() {
                let message = format!(
                    "{configured} could not be registered, so {fallback} is being used instead."
                );
                set_hotkey_state(app, fallback, true, Some(message));
            } else {
                let message = format!(
                    "{configured} could not be registered — another app may be using it. \
                     Pick a different shortcut, or open OmniRecall from the tray icon."
                );
                set_hotkey_state(app, &configured, false, Some(message));
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Note: "Unicode mismatch" warnings from pdf-extract are harmless
    // They occur when PDFs use ligatures (ﬁ → fi) and can't be suppressed
    // as they're printed directly to stdout by the pdf-extract library
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer())
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    tauri::Builder::default()
        // Must be the first plugin: a second launch focuses the running
        // instance instead of starting a duplicate tray app.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
                show_window(&window);
            }
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![HIDDEN_ARG]),
        ))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let window = app
                .get_webview_window(MAIN_WINDOW)
                .ok_or("main window is missing from tauri.conf.json")?;

            // Setup tray menu
            let quit = MenuItem::with_id(app, "quit", "Quit OmniRecall", true, None::<&str>)?;
            let show = MenuItem::with_id(app, "show", "Show/Hide", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;

            let mut tray = TrayIconBuilder::with_id(TRAY_ID)
                .menu(&menu)
                .tooltip("OmniRecall")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => app.exit(0),
                    "show" => {
                        if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
                            toggle_window(&window);
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(window) = tray.app_handle().get_webview_window(MAIN_WINDOW) {
                            toggle_window(&window);
                        }
                    }
                });
            // The default_window_icon is embedded from the bundle icons at
            // compile time.
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            tray.build(app)?;

            register_startup_hotkey(app.handle());

            // A login launch (autostart) stays in the tray; a manual launch
            // opens at the cursor.
            let start_hidden = std::env::args().any(|arg| arg == HIDDEN_ARG);
            if !start_hidden {
                position_window_at_cursor(&window);
                let _ = window.show();
            }

            // Handle window events - only hide on focus loss in Spotlight mode
            let window_for_events = window.clone();
            window.on_window_event(move |event| {
                if let WindowEvent::Focused(false) = event {
                    let keep_open = IS_DASHBOARD_MODE.load(Ordering::SeqCst)
                        || BLUR_HIDE_SUSPENDED.load(Ordering::SeqCst);
                    if !keep_open {
                        let _ = window_for_events.hide();
                    }
                }
            });

            #[cfg(debug_assertions)]
            window.open_devtools();

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::chat::send_message_stream,
            commands::chat::stop_generation,
            commands::providers::test_api_key,
            commands::secrets::set_api_key_secret,
            commands::secrets::get_api_key_secrets,
            commands::documents::get_supported_extensions,
            commands::documents::get_documents_status,
            commands::documents::index_document,
            commands::documents::remove_document_index,
            commands::documents::semantic_search,
            commands::documents::clear_index,
            commands::documents::get_index_stats,
            hide_window,
            toggle_dashboard,
            update_hotkey,
            get_hotkey_status,
            set_hotkey_paused,
            set_blur_hide_suspended,
            reset_backend_data,
            save_text_file,
            minimize_window,
            toggle_maximize,
            toggle_fullscreen,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
async fn hide_window(window: tauri::WebviewWindow) {
    let _ = window.hide();
}

#[tauri::command]
async fn toggle_dashboard(window: tauri::WebviewWindow, is_dashboard: bool) {
    // Update the mode flag
    IS_DASHBOARD_MODE.store(is_dashboard, Ordering::SeqCst);

    if is_dashboard {
        let _ = window.set_max_size(None::<tauri::LogicalSize<u32>>);
        let _ = window.set_size(tauri::LogicalSize::new(1000, 700));
        let _ = window.set_min_size(Some(tauri::LogicalSize::new(800, 600)));
        let _ = window.center();
        let _ = window.set_always_on_top(false);
        let _ = window.set_skip_taskbar(false);
    } else {
        // A maximized or fullscreen window ignores set_size, which would
        // leave the compact Spotlight layout stretched across the screen.
        let _ = window.set_fullscreen(false);
        let _ = window.unmaximize();
        let _ = window.set_min_size(Some(tauri::LogicalSize::new(380, 200)));
        let _ = window.set_size(tauri::LogicalSize::new(420, 500));
        let _ = window.set_max_size(Some(tauri::LogicalSize::new(500, 700)));
        position_window_at_cursor(&window);
        let _ = window.set_always_on_top(true);
        let _ = window.set_skip_taskbar(true);
    }
}

/// Change the global shortcut. The new shortcut is registered before the old
/// one is released, so a failure (shortcut owned by another app) leaves the
/// working shortcut in place.
#[tauri::command]
async fn update_hotkey(app: AppHandle, new_hotkey: String) -> Result<String, String> {
    let old_hotkey = current_hotkey();
    let was_registered = HOTKEY_REGISTERED.load(Ordering::SeqCst);
    // While the recorder UI has shortcuts paused the old one is already
    // unregistered at the OS level.
    let paused = HOTKEY_PAUSED.swap(false, Ordering::SeqCst);

    if was_registered && !paused && old_hotkey == new_hotkey {
        return Ok(new_hotkey);
    }

    if let Err(err) = bind_hotkey(&app, &new_hotkey) {
        if was_registered && paused {
            // Restore the previous shortcut that the recorder had paused.
            let _ = bind_hotkey(&app, &old_hotkey);
        }
        return Err(err);
    }

    if was_registered && !paused && old_hotkey != new_hotkey {
        unbind_hotkey(&app, &old_hotkey);
    }

    set_hotkey_state(&app, &new_hotkey, true, None);
    save_hotkey_to_config(&new_hotkey)?;
    Ok(new_hotkey)
}

#[tauri::command]
async fn get_hotkey_status() -> HotkeyStatus {
    hotkey_status()
}

/// Temporarily release the global shortcut while the user records a new one,
/// so pressing the current combination doesn't toggle the window.
#[tauri::command]
async fn set_hotkey_paused(app: AppHandle, paused: bool) {
    if !HOTKEY_REGISTERED.load(Ordering::SeqCst) {
        return;
    }
    let was_paused = HOTKEY_PAUSED.swap(paused, Ordering::SeqCst);
    if was_paused == paused {
        return;
    }
    let hotkey = current_hotkey();
    if paused {
        unbind_hotkey(&app, &hotkey);
    } else if let Err(err) = bind_hotkey(&app, &hotkey) {
        set_hotkey_state(&app, &hotkey, false, Some(err));
    }
}

#[tauri::command]
async fn set_blur_hide_suspended(suspended: bool) {
    BLUR_HIDE_SUSPENDED.store(suspended, Ordering::SeqCst);
}

/// Delete everything the backend stores outside the frontend's store file:
/// the vector index, cached document text and the hotkey config. The global
/// shortcut returns to the platform default.
#[tauri::command]
async fn reset_backend_data(app: AppHandle) -> Result<HotkeyStatus, String> {
    commands::documents::delete_index_files().map_err(|e| e.to_string())?;
    commands::documents::clear_text_cache();

    let config_path = get_config_path();
    if config_path.exists() {
        fs::remove_file(&config_path).map_err(|e| format!("Failed to remove config: {}", e))?;
    }

    let fallback = default_hotkey();
    let old_hotkey = current_hotkey();
    let was_registered = HOTKEY_REGISTERED.load(Ordering::SeqCst);
    if !was_registered || old_hotkey != fallback {
        match bind_hotkey(&app, fallback) {
            Ok(()) => {
                if was_registered {
                    unbind_hotkey(&app, &old_hotkey);
                }
                set_hotkey_state(&app, fallback, true, None);
            }
            Err(err) => {
                tracing::error!("Failed to restore default hotkey: {}", err);
            }
        }
    }

    Ok(hotkey_status())
}

/// Write an export to the location the user picked in the save dialog.
#[tauri::command]
async fn save_text_file(path: String, contents: String) -> Result<(), String> {
    fs::write(&path, contents).map_err(|e| format!("Failed to save file: {}", e))
}

#[tauri::command]
async fn minimize_window(window: tauri::WebviewWindow) {
    let _ = window.minimize();
}

#[tauri::command]
async fn toggle_maximize(window: tauri::WebviewWindow) -> bool {
    let is_maximized = window.is_maximized().unwrap_or(false);
    if is_maximized {
        let _ = window.unmaximize();
    } else {
        let _ = window.maximize();
    }
    !is_maximized
}

#[tauri::command]
async fn toggle_fullscreen(window: tauri::WebviewWindow) -> bool {
    let is_fullscreen = window.is_fullscreen().unwrap_or(false);
    let _ = window.set_fullscreen(!is_fullscreen);
    !is_fullscreen
}

#[cfg(test)]
mod tests {
    use super::*;

    const SCREEN_POS: (i32, i32) = (0, 0);
    const SCREEN: (i32, i32) = (1920, 1080);
    const WINDOW: (i32, i32) = (420, 500);

    #[test]
    fn window_is_centred_below_the_cursor() {
        assert_eq!(place_near_cursor((960, 100), WINDOW, SCREEN_POS, SCREEN), (750, 110));
    }

    #[test]
    fn window_stays_on_screen_at_the_edges() {
        // Bottom-right corner: shifted left and flipped above the cursor.
        assert_eq!(place_near_cursor((1900, 1000), WINDOW, SCREEN_POS, SCREEN), (1490, 490));
        // Top-left corner.
        assert_eq!(place_near_cursor((5, 5), WINDOW, SCREEN_POS, SCREEN), (10, 15));
    }

    #[test]
    fn window_uses_the_offset_of_a_secondary_monitor() {
        let (x, y) = place_near_cursor((2000, 50), WINDOW, (1920, 0), SCREEN);
        assert_eq!((x, y), (1930, 60));
    }
}
