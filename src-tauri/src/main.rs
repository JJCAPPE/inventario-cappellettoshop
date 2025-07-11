// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::menu::{Menu, MenuBuilder, MenuItemBuilder, SubmenuBuilder};
use tauri::{Emitter, Manager};

// Import the command functions from our modules
use inventario_cappellettoshop_lib::firebase;
use inventario_cappellettoshop_lib::inventory;
use inventario_cappellettoshop_lib::location;
use inventario_cappellettoshop_lib::products;
use inventario_cappellettoshop_lib::status;
use inventario_cappellettoshop_lib::stock;
use inventario_cappellettoshop_lib::utils::AppConfig;

fn create_menu(app: &tauri::AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    // Create custom menu items
    let settings = MenuItemBuilder::with_id("settings", "Impostazioni")
        .accelerator("CmdOrCtrl+,")
        .build(app)?;

    let about = MenuItemBuilder::with_id("about", "About Inventario CappellettoShop")
        .accelerator("CmdOrCtrl+.")
        .build(app)?;

    let quit = MenuItemBuilder::with_id("quit", "Quit")
        .accelerator("CmdOrCtrl+Q")
        .build(app)?;

    // Create submenus
    let app_menu = SubmenuBuilder::new(app, "Inventario CappellettoShop")
        .item(&about)
        .separator()
        .item(&settings)
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .item(&quit)
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let view_menu = SubmenuBuilder::new(app, "View")
        .fullscreen()
        .minimize()
        .close_window()
        .build()?;

    let window_menu = SubmenuBuilder::new(app, "Window")
        .minimize()
        .close_window()
        .build()?;

    // Build the complete menu
    MenuBuilder::new(app)
        .item(&app_menu)
        .item(&edit_menu)
        .item(&view_menu)
        .item(&window_menu)
        .build()
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Initialize app configuration from environment
            let config = AppConfig::from_env()
                .expect("Failed to load configuration. Please check your .env file.");

            // Store config in app state for commands to use
            app.manage(config);

            // Create and set the menu
            let menu = create_menu(app.handle())?;
            app.set_menu(menu)?;

            // Set up menu event handlers
            app.on_menu_event(move |app, event| {
                match event.id().as_ref() {
                    "settings" => {
                        // Emit an event to the frontend to show settings modal
                        if let Some(window) = app.get_webview_window("main") {
                            window.emit("show-settings", {}).unwrap();
                        }
                    }
                    "about" => {
                        // Emit an event to the frontend to show about dialog
                        if let Some(window) = app.get_webview_window("main") {
                            window.emit("show-about", {}).unwrap();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Product commands
            products::get_products,
            products::get_product_by_id,
            products::search_products,
            products::search_products_by_sku_graphql,
            products::enhanced_search_products,
            products::search_products_by_name_graphql,
            products::find_product_by_exact_sku_graphql,
            // Inventory commands
            inventory::get_inventory_levels,
            inventory::get_inventory_levels_for_locations,
            inventory::get_location_config,
            inventory::adjust_inventory,
            inventory::adjust_inventory_graphql,
            inventory::set_inventory_level,
            inventory::get_low_stock_products,
            // Enhanced inventory commands with Firebase logging
            inventory::decrease_inventory_with_logging,
            inventory::undo_decrease_inventory_with_logging,
            inventory::transfer_inventory_between_locations,
            // Modification history commands
            inventory::get_product_modification_history,
            // Firebase commands
            firebase::create_log,
            firebase::get_logs,
            firebase::get_logs_date_range,
            firebase::get_logs_by_product_id,
            firebase::create_check_request,
            firebase::get_check_requests,
            firebase::update_check_request,
            firebase::get_firebase_config,
            // Location commands
            location::get_app_location,
            location::set_app_location,
            location::get_available_locations,
            location::get_location_by_name,
            location::get_current_location_config,
            // Status commands
            status::test_shopify_connection,
            status::greet,
            // Stock management commands
            stock::get_products_with_no_stock,
            stock::update_products_no_stock_to_draft
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
