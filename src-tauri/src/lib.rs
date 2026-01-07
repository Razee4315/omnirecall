#![allow(dead_code)]
#![allow(unused_imports)]

mod commands;
mod services;
mod config;
mod error;

use std::sync::{atomic::{AtomicBool, Ordering}, Mutex};
use std::fs;
use tauri::{
    Manager, AppHandle,
    tray::{TrayIconBuilder, MouseButton, MouseButtonState, TrayIconEvent},
    menu::{Menu, MenuItem},
    WindowEvent,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use crate::config::{AppConfig, get_config_path};

// Track if we're in dashboard mode (don't hide on focus loss)
static IS_DASHBOARD_MODE: AtomicBool = AtomicBool::new(false);

// Track the current hotkey string for re-registration
static CURRENT_HOTKEY: Mutex<String> = Mutex::new(String::new());

fn position_window_at_cursor(window: &tauri::WebviewWindow) {
    // Get cursor position
    if let Ok(cursor_pos) = window.cursor_position() {
        let window_size = window.outer_size().unwrap_or(tauri::PhysicalSize::new(420, 500));
        
        // Get the monitor where cursor is
        if let Ok(Some(monitor)) = window.current_monitor() {
            let screen_size = monitor.size();
            let screen_pos = monitor.position();
            
            // Calculate position - place window so it doesn't go off screen
            let mut x = cursor_pos.x as i32 - (window_size.width as i32 / 2);
            let mut y = cursor_pos.y as i32 + 10; // Slightly below cursor
            
            // Ensure window stays within screen bounds
            let screen_right = screen_pos.x + screen_size.width as i32;
            let screen_bottom = screen_pos.y + screen_size.height as i32;
            
            // Clamp X
            if x < screen_pos.x {
                x = screen_pos.x + 10;
            } else if x + window_size.width as i32 > screen_right {
                x = screen_right - window_size.width as i32 - 10;
            }
            
            // Clamp Y - if would go below screen, show above cursor
            if y + window_size.height as i32 > screen_bottom {
                y = cursor_pos.y as i32 - window_size.height as i32 - 10;
            }
            if y < screen_pos.y {
                y = screen_pos.y + 10;
            }
            
            let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
        } else {
            // Fallback: just use cursor position
            let x = cursor_pos.x as i32 - (window_size.width as i32 / 2);
            let y = cursor_pos.y as i32 + 10;
            let _ = window.set_position(tauri::PhysicalPosition::new(x, y));
        }
    }
}

fn toggle_window(window: &tauri::WebviewWindow) {
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
    } else {
        position_window_at_cursor(window);
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Load the hotkey from config, with OS-specific defaults
fn load_hotkey_from_config() -> String {
    let config_path = get_config_path();
    if config_path.exists() {
        if let Ok(content) = fs::read_to_string(&config_path) {
            if let Ok(config) = serde_json::from_str::<AppConfig>(&content) {
                return config.hotkey;
            }
        }
    }
    // Default based on OS
    #[cfg(target_os = "linux")]
    return "Ctrl+Alt+Space".to_string();
    #[cfg(not(target_os = "linux"))]
    return "Alt+Space".to_string();
}

/// Register the global shortcut with the given hotkey string
fn register_global_shortcut(app: &AppHandle, hotkey: &str) -> Result<(), String> {
    let shortcut: Shortcut = hotkey.parse()
        .map_err(|e| format!("Invalid shortcut format: {}", e))?;
    
    let window = app.get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;
    
    let window_clone = window.clone();
    app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, event| {
        if event.state == ShortcutState::Pressed {
            toggle_window(&window_clone);
        }
    }).map_err(|e| format!("Failed to register shortcut: {}", e))?;
    
    // Update the stored hotkey
    if let Ok(mut current) = CURRENT_HOTKEY.lock() {
        *current = hotkey.to_string();
    }
    
    Ok(())
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
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info"))
        )
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            
            // Position at cursor and show window
            position_window_at_cursor(&window);
            window.show().unwrap();
            
            // Setup tray menu
            let quit = MenuItem::with_id(app, "quit", "Quit OmniRecall", true, None::<&str>)?;
            let show = MenuItem::with_id(app, "show", "Show/Hide", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;
            
            // Load hotkey from config
            let hotkey = load_hotkey_from_config();
            
            // Setup tray icon with dynamic tooltip
            let tray_tooltip = format!("OmniRecall - Press {}", hotkey);
            
            let window_clone = window.clone();
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip(&tray_tooltip)
                .on_menu_event(move |app, event| {
                    match event.id.as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "show" => {
                            toggle_window(&window_clone);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            toggle_window(&window);
                        }
                    }
                })
                .build(app)?;
            
            // Register global shortcut from config
            let app_handle = app.handle().clone();
            if let Err(e) = register_global_shortcut(&app_handle, &hotkey) {
                tracing::error!("Failed to register hotkey '{}': {}", hotkey, e);
                // Fallback to default
                let default = if cfg!(target_os = "linux") { "Ctrl+Alt+Space" } else { "Alt+Space" };
                let _ = register_global_shortcut(&app_handle, default);
            }
            
            // Handle window events - only hide on focus loss in Spotlight mode
            let window_for_events = window.clone();
            window.on_window_event(move |event| {
                if let WindowEvent::Focused(false) = event {
                    // Only hide when losing focus if NOT in dashboard mode
                    if !IS_DASHBOARD_MODE.load(Ordering::SeqCst) {
                        let _ = window_for_events.hide();
                    }
                }
            });
            
            #[cfg(debug_assertions)]
            window.open_devtools();

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::chat::send_message,
            commands::chat::send_message_stream,
            commands::chat::stop_generation,
            commands::providers::test_api_key,
            commands::providers::get_providers,
            commands::providers::save_api_key,
            commands::documents::add_documents,
            commands::documents::remove_document,
            commands::documents::list_documents,
            commands::documents::read_document_content,
            commands::spaces::create_space,
            commands::spaces::list_spaces,
            commands::spaces::delete_space,
            commands::settings::get_settings,
            commands::settings::save_settings,
            show_window,
            hide_window,
            toggle_dashboard,
            update_hotkey,
            get_current_hotkey,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
async fn show_window(window: tauri::WebviewWindow) {
    position_window_at_cursor(&window);
    let _ = window.show();
    let _ = window.set_focus();
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
        let _ = window.set_size(tauri::LogicalSize::new(1000, 700));
        let _ = window.set_min_size(Some(tauri::LogicalSize::new(800, 600)));
        let _ = window.set_max_size(None::<tauri::LogicalSize<u32>>);
        let _ = window.center();
        let _ = window.set_always_on_top(false);
        let _ = window.set_skip_taskbar(false);
    } else {
        let _ = window.set_size(tauri::LogicalSize::new(420, 500));
        let _ = window.set_min_size(Some(tauri::LogicalSize::new(380, 200)));
        let _ = window.set_max_size(Some(tauri::LogicalSize::new(500, 700)));
        position_window_at_cursor(&window);
        let _ = window.set_always_on_top(true);
        let _ = window.set_skip_taskbar(true);
    }
}

#[tauri::command]
async fn update_hotkey(app: AppHandle, new_hotkey: String) -> Result<String, String> {
    // Validate the new hotkey format first
    let new_shortcut: Shortcut = new_hotkey.parse()
        .map_err(|e| format!("Invalid shortcut format: {}", e))?;
    
    // Get the current hotkey and unregister it
    let old_hotkey = {
        let current = CURRENT_HOTKEY.lock()
            .map_err(|_| "Failed to lock hotkey state".to_string())?;
        current.clone()
    };
    
    if !old_hotkey.is_empty() {
        if let Ok(old_shortcut) = old_hotkey.parse::<Shortcut>() {
            let _ = app.global_shortcut().unregister(old_shortcut);
        }
    }
    
    // Register the new shortcut
    let window = app.get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())?;
    
    let window_clone = window.clone();
    app.global_shortcut().on_shortcut(new_shortcut, move |_app, _shortcut, event| {
        if event.state == ShortcutState::Pressed {
            toggle_window(&window_clone);
        }
    }).map_err(|e| format!("Failed to register shortcut: {}", e))?;
    
    // Update the stored hotkey
    {
        let mut current = CURRENT_HOTKEY.lock()
            .map_err(|_| "Failed to lock hotkey state".to_string())?;
        *current = new_hotkey.clone();
    }
    
    // Save to config file
    let config_path = get_config_path();
    let mut config = if config_path.exists() {
        fs::read_to_string(&config_path)
            .ok()
            .and_then(|c| serde_json::from_str::<AppConfig>(&c).ok())
            .unwrap_or_default()
    } else {
        AppConfig::default()
    };
    
    config.hotkey = new_hotkey.clone();
    
    if let Some(parent) = config_path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    
    let content = serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;
    fs::write(&config_path, content)
        .map_err(|e| format!("Failed to save config: {}", e))?;
    
    Ok(new_hotkey)
}

#[tauri::command]
async fn get_current_hotkey() -> String {
    CURRENT_HOTKEY.lock()
        .map(|h| h.clone())
        .unwrap_or_else(|_| load_hotkey_from_config())
}

