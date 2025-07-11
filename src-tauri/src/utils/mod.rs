use serde::{Deserialize, Serialize};

// ============================================================================
// DATA STRUCTURES
// ============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProductVariant {
    pub variant_id: String,
    pub inventory_item_id: String,
    pub title: String,
    pub inventory_quantity: i32,
    pub price: String,
    pub sku: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Product {
    pub id: String,
    pub title: String,
    pub handle: String,
    pub price: String,
    pub description: String,
    pub images: Vec<String>,
    pub variants: Vec<ProductVariant>,
    pub total_inventory: i32,
    pub locations: std::collections::HashMap<String, i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InventoryUpdate {
    pub variant_id: String,
    pub location_id: String,
    pub adjustment: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StatusResponse {
    pub status: String,
    pub message: String,
}

// ============================================================================
// CONFIGURATION
// ============================================================================

#[derive(Debug, Clone)]
pub struct AppConfig {
    // Shopify Configuration
    pub shop_domain: String,
    pub access_token: String,
    pub api_key: String,
    pub api_secret: String,
    pub api_version: String,
    pub primary_location: String,
    pub secondary_location: String,

    // Firebase Configuration
    pub firebase_api_key: String,
    pub firebase_auth_domain: String,
    pub firebase_project_id: String,
    pub firebase_storage_bucket: String,
    pub firebase_messaging_sender_id: String,
    pub firebase_app_id: String,
    pub firebase_measurement_id: String,

    // App Configuration
    pub version: String,
}

impl AppConfig {
    pub fn from_env() -> Result<Self, String> {
        // Try to load .env file for development
        dotenvy::dotenv().ok();

        // Check if we're in development mode
        let is_dev = std::env::var("DEV_ENV")
            .unwrap_or_else(|_| "3.2.0".to_string())
            .parse::<bool>()
            .unwrap_or(false);

        if is_dev {
            // Development mode: Use runtime environment variables from .env file
            Self::from_runtime_env()
        } else {
            // Production mode: Use compile-time environment variables
            Self::from_compile_time_env()
        }
    }

    /// Load configuration from runtime environment variables (development)
    fn from_runtime_env() -> Result<Self, String> {
        // Shopify Configuration
        let shop_domain = std::env::var("SHOPIFY_SHOP_DOMAIN")
            .map_err(|_| "SHOPIFY_SHOP_DOMAIN must be set in .env file")?;
        let access_token = std::env::var("SHOPIFY_ACCESS_TOKEN")
            .map_err(|_| "SHOPIFY_ACCESS_TOKEN must be set in .env file")?;
        let api_key = std::env::var("SHOPIFY_API_KEY")
            .map_err(|_| "SHOPIFY_API_KEY must be set in .env file")?;
        let api_secret = std::env::var("SHOPIFY_API_SECRET_KEY")
            .map_err(|_| "SHOPIFY_API_SECRET_KEY must be set in .env file")?;
        let api_version =
            std::env::var("SHOPIFY_API_VERSION").unwrap_or_else(|_| "3.2.0".to_string());
        let primary_location = std::env::var("LOCATION_TREVISO")
            .map_err(|_| "LOCATION_TREVISO must be set in .env file")?;
        let secondary_location = std::env::var("LOCATION_MOGLIANO")
            .map_err(|_| "LOCATION_MOGLIANO must be set in .env file")?;

        // Firebase Configuration
        let firebase_api_key = std::env::var("FIREBASE_API_KEY")
            .map_err(|_| "FIREBASE_API_KEY must be set in .env file")?;
        let firebase_auth_domain = std::env::var("FIREBASE_AUTH_DOMAIN")
            .map_err(|_| "FIREBASE_AUTH_DOMAIN must be set in .env file")?;
        let firebase_project_id = std::env::var("FIREBASE_PROJECT_ID")
            .map_err(|_| "FIREBASE_PROJECT_ID must be set in .env file")?;
        let firebase_storage_bucket = std::env::var("FIREBASE_STORAGE_BUCKET")
            .map_err(|_| "FIREBASE_STORAGE_BUCKET must be set in .env file")?;
        let firebase_messaging_sender_id = std::env::var("FIREBASE_MESSAGING_SENDER_ID")
            .map_err(|_| "FIREBASE_MESSAGING_SENDER_ID must be set in .env file")?;
        let firebase_app_id = std::env::var("FIREBASE_APP_ID")
            .map_err(|_| "FIREBASE_APP_ID must be set in .env file")?;
        let firebase_measurement_id = std::env::var("FIREBASE_MEASUREMENT_ID")
            .map_err(|_| "FIREBASE_MEASUREMENT_ID must be set in .env file")?;

        // App Configuration
        let version = std::env::var("VERSION").unwrap_or_else(|_| "3.2.0".to_string());

        Ok(AppConfig {
            shop_domain,
            access_token,
            api_key,
            api_secret,
            api_version,
            primary_location,
            secondary_location,
            firebase_api_key,
            firebase_auth_domain,
            firebase_project_id,
            firebase_storage_bucket,
            firebase_messaging_sender_id,
            firebase_app_id,
            firebase_measurement_id,
            version,
        })
    }

    /// Load configuration from compile-time environment variables (production)
    fn from_compile_time_env() -> Result<Self, String> {
        // In production mode, these variables should be embedded at compile time
        // We use option_env! to make them optional during development compilation

        // Shopify Configuration
        let shop_domain = option_env!("SHOPIFY_SHOP_DOMAIN")
            .ok_or("SHOPIFY_SHOP_DOMAIN must be set at compile time for production builds")?
            .to_string();
        let access_token = option_env!("SHOPIFY_ACCESS_TOKEN")
            .ok_or("SHOPIFY_ACCESS_TOKEN must be set at compile time for production builds")?
            .to_string();
        let api_key = option_env!("SHOPIFY_API_KEY")
            .ok_or("SHOPIFY_API_KEY must be set at compile time for production builds")?
            .to_string();
        let api_secret = option_env!("SHOPIFY_API_SECRET_KEY")
            .ok_or("SHOPIFY_API_SECRET_KEY must be set at compile time for production builds")?
            .to_string();
        let api_version = option_env!("SHOPIFY_API_VERSION")
            .unwrap_or("2025-01")
            .to_string();
        let primary_location = option_env!("LOCATION_TREVISO")
            .ok_or("LOCATION_TREVISO must be set at compile time for production builds")?
            .to_string();
        let secondary_location = option_env!("LOCATION_MOGLIANO")
            .ok_or("LOCATION_MOGLIANO must be set at compile time for production builds")?
            .to_string();

        // Firebase Configuration
        let firebase_api_key = option_env!("FIREBASE_API_KEY")
            .ok_or("FIREBASE_API_KEY must be set at compile time for production builds")?
            .to_string();
        let firebase_auth_domain = option_env!("FIREBASE_AUTH_DOMAIN")
            .ok_or("FIREBASE_AUTH_DOMAIN must be set at compile time for production builds")?
            .to_string();
        let firebase_project_id = option_env!("FIREBASE_PROJECT_ID")
            .ok_or("FIREBASE_PROJECT_ID must be set at compile time for production builds")?
            .to_string();
        let firebase_storage_bucket = option_env!("FIREBASE_STORAGE_BUCKET")
            .ok_or("FIREBASE_STORAGE_BUCKET must be set at compile time for production builds")?
            .to_string();
        let firebase_messaging_sender_id = option_env!("FIREBASE_MESSAGING_SENDER_ID")
            .ok_or(
                "FIREBASE_MESSAGING_SENDER_ID must be set at compile time for production builds",
            )?
            .to_string();
        let firebase_app_id = option_env!("FIREBASE_APP_ID")
            .ok_or("FIREBASE_APP_ID must be set at compile time for production builds")?
            .to_string();
        let firebase_measurement_id = option_env!("FIREBASE_MEASUREMENT_ID")
            .ok_or("FIREBASE_MEASUREMENT_ID must be set at compile time for production builds")?
            .to_string();

        // App Configuration
        let version = option_env!("VERSION").unwrap_or("3.2.0").to_string();

        Ok(AppConfig {
            shop_domain,
            access_token,
            api_key,
            api_secret,
            api_version,
            primary_location,
            secondary_location,
            firebase_api_key,
            firebase_auth_domain,
            firebase_project_id,
            firebase_storage_bucket,
            firebase_messaging_sender_id,
            firebase_app_id,
            firebase_measurement_id,
            version,
        })
    }

    pub fn get_api_url(&self, endpoint: &str) -> String {
        format!(
            "https://{}/admin/api/{}/{}",
            self.shop_domain, self.api_version, endpoint
        )
    }

    pub fn get_headers(&self) -> reqwest::header::HeaderMap {
        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert("X-Shopify-Access-Token", self.access_token.parse().unwrap());
        headers.insert("Content-Type", "application/json".parse().unwrap());
        headers
    }

    pub fn get_firebase_config(&self) -> FirebaseConfig {
        FirebaseConfig {
            api_key: self.firebase_api_key.clone(),
            auth_domain: self.firebase_auth_domain.clone(),
            project_id: self.firebase_project_id.clone(),
            storage_bucket: self.firebase_storage_bucket.clone(),
            messaging_sender_id: self.firebase_messaging_sender_id.clone(),
            app_id: self.firebase_app_id.clone(),
            measurement_id: self.firebase_measurement_id.clone(),
        }
    }
}

// ============================================================================
// FIREBASE CONFIGURATION
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FirebaseConfig {
    pub api_key: String,
    pub auth_domain: String,
    pub project_id: String,
    pub storage_bucket: String,
    pub messaging_sender_id: String,
    pub app_id: String,
    pub measurement_id: String,
}
