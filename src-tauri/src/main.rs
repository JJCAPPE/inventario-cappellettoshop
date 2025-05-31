// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

// Import the command functions from our modules
use inventario_cappellettoshop_lib::products;
use inventario_cappellettoshop_lib::inventory;
use inventario_cappellettoshop_lib::status;
use inventario_cappellettoshop_lib::utils::AppConfig;

fn main() {
    tauri::Builder::default()
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
            products::search_products_by_sku,
            products::search_products_enhanced,
            products::find_product_by_exact_sku,
            
            // Inventory commands  
            inventory::get_inventory_levels,
            inventory::adjust_inventory,
            inventory::set_inventory_level,
            inventory::get_low_stock_products,
            
            // Status commands
            status::test_shopify_connection,
            status::greet
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
