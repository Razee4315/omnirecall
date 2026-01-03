#![allow(dead_code)]
#![allow(unused_imports)]

mod commands;
mod services;
mod config;
mod error;

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{
    Manager, 
    tray::{TrayIconBuilder, MouseButton, MouseButtonState, TrayIconEvent},
    menu::{Menu, MenuItem},
    WindowEvent,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

// Track if we're in dashboard mode (don't hide on focus loss)
static IS_DASHBOARD_MODE: AtomicBool = AtomicBool::new(false);

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
            
            // Setup tray icon
            let window_clone = window.clone();
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("OmniRecall - Press Alt+Space")
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
            
            // Register global shortcut (Alt+Space)
            let window_for_shortcut = window.clone();
            let shortcut: Shortcut = "Alt+Space".parse().unwrap();
            app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    toggle_window(&window_for_shortcut);
                }
            })?;
            
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
