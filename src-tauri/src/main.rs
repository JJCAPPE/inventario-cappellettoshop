// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

// Import the command functions from our modules
use inventario_cappellettoshop_lib::firebase;
use inventario_cappellettoshop_lib::inventory;
use inventario_cappellettoshop_lib::location;
use inventario_cappellettoshop_lib::products;
use inventario_cappellettoshop_lib::status;
use inventario_cappellettoshop_lib::utils::AppConfig;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Initialize app configuration from environment
            let config = AppConfig::from_env()
                .expect("Failed to load configuration. Please check your .env file.");

            // Store config in app state for commands to use
            app.manage(config);

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
            // Modification history commands
            inventory::get_product_modification_history,
            // Firebase commands
            firebase::create_log,
            firebase::get_logs,
            firebase::get_logs_date_range,
            firebase::get_logs_by_product_id,
            firebase::get_firebase_config,
            // Location commands
            location::get_app_location,
            location::set_app_location,
            location::get_available_locations,
            location::get_location_by_name,
            location::get_current_location_config,
            // Status commands
            status::test_shopify_connection,
            status::greet
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
