// Main library file for Shopify Inventory App
// Exposes public modules for testing and Tauri commands

pub mod firebase;
pub mod inventory;
pub mod location;
pub mod products;
pub mod status;
pub mod stock;
pub mod utils;

// Re-export commonly used types for convenience
pub use firebase::{LogData, LogEntry};
pub use location::{LocationConfig, LocationInfo};
pub use utils::{
    AppConfig, FirebaseConfig, InventoryUpdate, Product, ProductVariant, StatusResponse,
};
