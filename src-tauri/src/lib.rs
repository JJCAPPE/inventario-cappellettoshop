// Main library file for Shopify Inventory App
// Exposes public modules for testing and Tauri commands

pub mod utils;
pub mod products;
pub mod inventory;
pub mod status;
pub mod firebase;
pub mod location;

// Re-export commonly used types for convenience
pub use utils::{AppConfig, Product, ProductVariant, InventoryUpdate, StatusResponse, FirebaseConfig, GitHubConfig}; 
pub use firebase::{LogData, LogEntry};
pub use location::{LocationInfo, LocationConfig}; 