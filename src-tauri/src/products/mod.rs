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

/// Search products by SKU across all variants
/// Since Shopify doesn't have a direct SKU search endpoint, we fetch all products and filter
#[tauri::command]
pub async fn search_products_by_sku(config: State<'_, AppConfig>, sku: String) -> Result<Vec<Product>, String> {
    let client = reqwest::Client::new();
    
    // Shopify doesn't have direct SKU search, so we fetch all products and filter
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
    
    // Filter products that have variants matching the SKU
    for product in products {
        if let Some(variants) = product["variants"].as_array() {
            let has_matching_sku = variants.iter().any(|variant| {
                if let Some(variant_sku) = variant["sku"].as_str() {
                    variant_sku.to_lowercase().contains(&sku.to_lowercase())
                } else {
                    false
                }
            });
            
            if has_matching_sku {
                let parsed_product = parse_product_from_json(product)?;
                result.push(parsed_product);
            }
        }
    }

    Ok(result)
}

/// Enhanced search that looks for both title and SKU matches
#[tauri::command]
pub async fn search_products_enhanced(config: State<'_, AppConfig>, query: String) -> Result<Vec<Product>, String> {
    let client = reqwest::Client::new();
    
    // First try title search
    let encoded_query = urlencoding::encode(&query);
    let title_url = config.get_api_url(&format!("products.json?title={}&limit=250", encoded_query));
    
    let title_response = client
        .get(&title_url)
        .headers(config.get_headers())
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let title_data: Value = title_response
        .json()
        .await
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    let mut result = Vec::new();
    let mut found_product_ids = std::collections::HashSet::new();

    // Process title search results
    if let Some(products) = title_data["products"].as_array() {
        for product in products {
            if let Ok(parsed_product) = parse_product_from_json(product) {
                found_product_ids.insert(parsed_product.id.clone());
                result.push(parsed_product);
            }
        }
    }

    // If no title matches or looking for more, also search by SKU
    if result.len() < 10 {  // Only search SKU if we have few results
        let sku_results = search_products_by_sku(config, query).await?;
        
        for product in sku_results {
            // Avoid duplicates from title search
            if !found_product_ids.contains(&product.id) {
                result.push(product);
            }
        }
    }

    Ok(result)
}

/// Find exact product by SKU - returns the first exact match
#[tauri::command]
pub async fn find_product_by_exact_sku(config: State<'_, AppConfig>, sku: String) -> Result<Option<Product>, String> {
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

    // Look for exact SKU match
    for product in products {
        if let Some(variants) = product["variants"].as_array() {
            for variant in variants {
                if let Some(variant_sku) = variant["sku"].as_str() {
                    if variant_sku.eq_ignore_ascii_case(&sku) {
                        return Ok(Some(parse_product_from_json(product)?));
                    }
                }
            }
        }
    }

    Ok(None)
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