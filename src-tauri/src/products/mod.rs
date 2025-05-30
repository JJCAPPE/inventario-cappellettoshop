use crate::utils::{AppConfig, Product, ProductVariant};
use serde_json::Value;
use tauri::State;

#[tauri::command]
pub async fn get_products(config: State<'_, AppConfig>) -> Result<Vec<Product>, String> {
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

    let mut result = Vec::new();
    for product in products {
        let parsed_product = parse_product_from_json(product)?;
        result.push(parsed_product);
    }

    Ok(result)
}

#[tauri::command]
pub async fn get_product_by_id(config: State<'_, AppConfig>, product_id: String) -> Result<Product, String> {
    let client = reqwest::Client::new();
    let url = config.get_api_url(&format!("products/{}.json", product_id));
    
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

    let product = &data["product"];
    parse_product_from_json(product)
}

#[tauri::command]
pub async fn search_products(config: State<'_, AppConfig>, query: String) -> Result<Vec<Product>, String> {
    let client = reqwest::Client::new();
    let encoded_query = urlencoding::encode(&query);
    let url = config.get_api_url(&format!("products.json?title={}&limit=250", encoded_query));
    
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

    let mut result = Vec::new();
    for product in products {
        let parsed_product = parse_product_from_json(product)?;
        result.push(parsed_product);
    }

    Ok(result)
}

fn parse_product_from_json(product: &Value) -> Result<Product, String> {
    let id = product["id"]
        .as_u64()
        .ok_or("Missing product id")?
        .to_string();
    
    let title = product["title"]
        .as_str()
        .unwrap_or("Unknown")
        .to_string();
    
    let description = product["body_html"]
        .as_str()
        .unwrap_or("")
        .to_string();
    
    let images: Vec<String> = product["images"]
        .as_array()
        .map(|imgs| {
            imgs.iter()
                .filter_map(|img| img["src"].as_str())
                .map(|s| s.to_string())
                .collect()
        })
        .unwrap_or_default();

    let variants: Vec<ProductVariant> = product["variants"]
        .as_array()
        .map(|vars| {
            vars.iter()
                .filter_map(|var| {
                    Some(ProductVariant {
                        inventory_item_id: var["inventory_item_id"]
                            .as_u64()?
                            .to_string(),
                        title: var["title"]
                            .as_str()
                            .unwrap_or("Default")
                            .to_string(),
                        inventory_quantity: var["inventory_quantity"]
                            .as_i64()
                            .unwrap_or(0) as i32,
                        price: var["price"]
                            .as_str()
                            .unwrap_or("0.00")
                            .to_string(),
                        sku: var["sku"]
                            .as_str()
                            .map(|s| s.to_string()),
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    let total_inventory: i32 = variants
        .iter()
        .map(|v| v.inventory_quantity)
        .sum();

    let price = variants
        .first()
        .map(|v| v.price.clone())
        .unwrap_or_else(|| "0.00".to_string());

    Ok(Product {
        id,
        title,
        price,
        description,
        images,
        variants,
        total_inventory,
        locations: std::collections::HashMap::new(), // Will be populated by inventory functions
    })
} 