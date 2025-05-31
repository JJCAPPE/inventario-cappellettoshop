use crate::utils::{AppConfig, InventoryUpdate, StatusResponse};
use serde_json::{json, Value};
use tauri::State;
use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct LocationConfig {
    pub primary_location: LocationInfo,
    pub secondary_location: LocationInfo,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LocationInfo {
    pub name: String,
    pub id: String,
}

#[tauri::command]
pub async fn get_location_config(config: State<'_, AppConfig>) -> Result<LocationConfig, String> {
    Ok(LocationConfig {
        primary_location: LocationInfo {
            name: "Treviso".to_string(),
            id: config.primary_location.clone(),
        },
        secondary_location: LocationInfo {
            name: "Mogliano".to_string(),
            id: config.secondary_location.clone(),
        },
    })
}

#[tauri::command]
pub async fn get_inventory_levels_for_locations(
    config: State<'_, AppConfig>, 
    inventory_item_ids: Vec<String>,
    primary_location_name: String
) -> Result<HashMap<String, HashMap<String, i32>>, String> {
    let client = reqwest::Client::new();
    let ids = inventory_item_ids.join(",");
    let url = config.get_api_url(&format!("inventory_levels.json?inventory_item_ids={}&limit=250", ids));
    
    println!("🏪 Getting inventory for primary location: {}", primary_location_name);
    
    let response = client
        .get(&url)
        .headers(config.get_headers())
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let data: Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    let inventory_levels = data["inventory_levels"]
        .as_array()
        .ok_or("No inventory levels found")?;

    // Determine which location IDs to use based on primary location preference
    let (primary_location_id, secondary_location_id) = if primary_location_name == "Treviso" {
        (config.primary_location.clone(), config.secondary_location.clone())
    } else {
        (config.secondary_location.clone(), config.primary_location.clone())
    };
    
    println!("📍 Using Primary Location ID: {} ({})", primary_location_id, primary_location_name);
    println!("📍 Using Secondary Location ID: {} ({})", secondary_location_id, 
        if primary_location_name == "Treviso" { "Mogliano" } else { "Treviso" });

    let mut result = HashMap::new();
    
    for level in inventory_levels {
        let inventory_item_id = level["inventory_item_id"]
            .as_u64()
            .ok_or("Missing inventory_item_id")?
            .to_string();
        
        let location_id = level["location_id"]
            .as_u64()
            .ok_or("Missing location_id")?
            .to_string();
        
        let available = level["available"]
            .as_i64()
            .unwrap_or(0) as i32;

        // Only include inventory for our two locations
        if location_id == primary_location_id || location_id == secondary_location_id {
            let location_label = if location_id == primary_location_id {
                "primary"
            } else {
                "secondary" 
            };
            
            println!("📦 Item {} at location {} ({}): {} available", 
                inventory_item_id, location_id, location_label, available);

            result
                .entry(inventory_item_id)
                .or_insert_with(HashMap::new)
                .insert(location_label.to_string(), available);
        }
    }

    println!("📊 Final inventory result: {:?}", result);
    Ok(result)
}

#[tauri::command]
pub async fn get_inventory_levels(config: State<'_, AppConfig>, inventory_item_ids: Vec<String>) -> Result<HashMap<String, HashMap<String, i32>>, String> {
    let client = reqwest::Client::new();
    let ids = inventory_item_ids.join(",");
    let url = config.get_api_url(&format!("inventory_levels.json?inventory_item_ids={}&limit=250", ids));
    
    let response = client
        .get(&url)
        .headers(config.get_headers())
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let data: Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    let inventory_levels = data["inventory_levels"]
        .as_array()
        .ok_or("No inventory levels found")?;

    let mut result = HashMap::new();
    for level in inventory_levels {
        let inventory_item_id = level["inventory_item_id"]
            .as_u64()
            .ok_or("Missing inventory_item_id")?
            .to_string();
        
        let location_id = level["location_id"]
            .as_u64()
            .ok_or("Missing location_id")?
            .to_string();
        
        let available = level["available"]
            .as_i64()
            .unwrap_or(0) as i32;

        result
            .entry(inventory_item_id)
            .or_insert_with(HashMap::new)
            .insert(location_id, available);
    }

    Ok(result)
}

#[tauri::command]
pub async fn adjust_inventory(config: State<'_, AppConfig>, updates: Vec<InventoryUpdate>) -> Result<StatusResponse, String> {
    let client = reqwest::Client::new();
    
    for update in updates {
        let url = config.get_api_url("inventory_levels/adjust.json");
        
        let payload = json!({
            "location_id": update.location_id,
            "inventory_item_id": update.variant_id,
            "available_adjustment": update.adjustment
        });

        let response = client
            .post(&url)
            .headers(config.get_headers())
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(format!("Failed to adjust inventory: {}", error_text));
        }
    }

    Ok(StatusResponse {
        status: "success".to_string(),
        message: "Inventory adjustments completed".to_string(),
    })
}

#[tauri::command]
pub async fn set_inventory_level(config: State<'_, AppConfig>, inventory_item_id: String, location_id: String, quantity: i32) -> Result<StatusResponse, String> {
    let client = reqwest::Client::new();
    let url = config.get_api_url("inventory_levels/set.json");
    
    let payload = json!({
        "location_id": location_id,
        "inventory_item_id": inventory_item_id,
        "available": quantity
    });

    let response = client
        .post(&url)
        .headers(config.get_headers())
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("Failed to set inventory level: {}", error_text));
    }

    Ok(StatusResponse {
        status: "success".to_string(),
        message: "Inventory level updated".to_string(),
    })
}

#[tauri::command]
pub async fn get_low_stock_products(config: State<'_, AppConfig>, threshold: i32) -> Result<Vec<Value>, String> {
    let client = reqwest::Client::new();
    let url = config.get_api_url("products.json?limit=250");
    
    let response = client
        .get(&url)
        .headers(config.get_headers())
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let data: Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    let products = data["products"]
        .as_array()
        .ok_or("No products found")?;

    let mut low_stock_products = Vec::new();
    
    for product in products {
        let empty_vec = vec![];
        let variants = product["variants"].as_array().unwrap_or(&empty_vec);
        
        for variant in variants {
            let inventory_quantity = variant["inventory_quantity"]
                .as_i64()
                .unwrap_or(0) as i32;
            
            if inventory_quantity <= threshold {
                low_stock_products.push(json!({
                    "product_id": product["id"],
                    "product_title": product["title"],
                    "variant_id": variant["id"],
                    "variant_title": variant["title"],
                    "inventory_quantity": inventory_quantity,
                    "sku": variant["sku"]
                }));
            }
        }
    }

    Ok(low_stock_products)
} 