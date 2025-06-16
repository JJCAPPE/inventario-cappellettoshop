use crate::utils::{AppConfig, StatusResponse};
use tauri::State;

#[tauri::command]
pub async fn test_shopify_connection(
    config: State<'_, AppConfig>,
) -> Result<StatusResponse, String> {
    let client = reqwest::Client::new();
    let url = config.get_api_url("shop.json");

    let response = client
        .get(&url)
        .headers(config.get_headers())
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if response.status().is_success() {
        Ok(StatusResponse {
            status: "success".to_string(),
            message: "Successfully connected to Shopify".to_string(),
        })
    } else {
        Err(format!(
            "Failed to connect to Shopify: {}",
            response.status()
        ))
    }
}

#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}
