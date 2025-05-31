use crate::utils::{AppConfig, Product, ProductVariant};
use serde_json::{json, Value};
use tauri::State;
use regex::Regex;

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
    
    // Fetch more products - Shopify allows up to 250 per request
    let url = config.get_api_url("products.json?limit=250&status=active");
    
    println!("🔍 Fetching products from URL: {}", url);
    
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

    println!("📊 Total products fetched: {}", products.len());

    let mut result = Vec::new();
    let mut all_skus = Vec::new();
    
    // Filter products that have variants matching the SKU
    for (i, product) in products.iter().enumerate() {
        if let Some(variants) = product["variants"].as_array() {
            println!("🔍 Product {}: {} has {} variants", i + 1, 
                product["title"].as_str().unwrap_or("Unknown"), 
                variants.len()
            );
            
            for (j, variant) in variants.iter().enumerate() {
                if let Some(variant_sku) = variant["sku"].as_str() {
                    all_skus.push(variant_sku.to_string());
                    println!("  📦 Variant {}: SKU = '{}'", j + 1, variant_sku);
                    
                    if variant_sku.to_lowercase().contains(&sku.to_lowercase()) {
                        println!("✅ MATCH FOUND! SKU '{}' contains '{}'", variant_sku, sku);
                        let parsed_product = parse_product_from_json(product)?;
                        result.push(parsed_product);
                        break; // Don't add the same product multiple times
                    }
                } else {
                    println!("  ⚠️ Variant {} has no SKU", j + 1);
                }
            }
        } else {
            println!("⚠️ Product has no variants array");
        }
    }
    
    println!("🎯 Searched for SKU: '{}'", sku);
    println!("📋 All SKUs found: {:?}", &all_skus[..std::cmp::min(all_skus.len(), 10)]); // Show first 10 SKUs
    if all_skus.len() > 10 {
        println!("   ... and {} more SKUs", all_skus.len() - 10);
    }
    println!("🔍 Total unique SKUs: {}", all_skus.len());
    println!("✅ Products matching SKU '{}': {}", sku, result.len());

    Ok(result)
}

/// Enhanced search that looks for both title and SKU matches
#[tauri::command]
pub async fn search_products_enhanced(config: State<'_, AppConfig>, query: String) -> Result<Vec<Product>, String> {
    println!("🚀 Enhanced search starting for query: '{}'", query);
    
    let mut result = Vec::new();
    let mut found_product_ids = std::collections::HashSet::new();

    // First try GraphQL-based partial title search (much better than REST)
    println!("🔍 Phase 1: GraphQL title search with partial matching");
    match search_products_by_name_graphql(config.clone(), query.clone(), None, None).await {
        Ok(graphql_products) => {
            println!("✅ GraphQL search returned {} products", graphql_products.len());
            for product in graphql_products {
                found_product_ids.insert(product.id.clone());
                result.push(product);
            }
        }
        Err(e) => {
            println!("⚠️ GraphQL search failed, falling back to REST: {}", e);
            // Fallback to REST API title search if GraphQL fails
            let client = reqwest::Client::new();
            let encoded_query = urlencoding::encode(&query);
            let title_url = config.get_api_url(&format!("products.json?title={}&limit=250", encoded_query));
            
            match client.get(&title_url).headers(config.get_headers()).send().await {
                Ok(title_response) => {
                    if let Ok(title_data) = title_response.json::<Value>().await {
                        if let Some(products) = title_data["products"].as_array() {
                            for product in products {
                                if let Ok(parsed_product) = parse_product_from_json(product) {
                                    found_product_ids.insert(parsed_product.id.clone());
                                    result.push(parsed_product);
                                }
                            }
                        }
                    }
                }
                Err(e) => println!("❌ REST fallback also failed: {}", e),
            }
        }
    }

    // If we still have few results, also search by SKU
    if result.len() < 10 {
        println!("🔍 Phase 2: SKU search (current results: {})", result.len());
        match search_products_by_sku(config, query.clone()).await {
            Ok(sku_results) => {
                println!("✅ SKU search returned {} products", sku_results.len());
                for product in sku_results {
                    // Avoid duplicates from title search
                    if !found_product_ids.contains(&product.id) {
                        result.push(product);
                    }
                }
            }
            Err(e) => {
                println!("⚠️ SKU search failed: {}", e);
            }
        }
    }

    println!("🎯 Enhanced search for '{}' completed: {} total results", query, result.len());
    Ok(result)
}

/// Find exact product by SKU - returns the first exact match
#[tauri::command]
pub async fn find_product_by_exact_sku(config: State<'_, AppConfig>, sku: String) -> Result<Option<Product>, String> {
    let client = reqwest::Client::new();
    let url = config.get_api_url("products.json?limit=250&status=active");
    
    println!("🎯 Looking for EXACT SKU match: '{}'", sku);
    
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

    println!("📊 Checking {} products for exact SKU match", products.len());

    // Look for exact SKU match
    for product in products {
        if let Some(variants) = product["variants"].as_array() {
            for variant in variants {
                if let Some(variant_sku) = variant["sku"].as_str() {
                    if variant_sku.eq_ignore_ascii_case(&sku) {
                        println!("✅ EXACT MATCH FOUND! SKU: '{}'", variant_sku);
                        return Ok(Some(parse_product_from_json(product)?));
                    }
                }
            }
        }
    }

    println!("❌ No exact match found for SKU: '{}'", sku);
    Ok(None)
}

fn clean_html_description(html: &str) -> String {
    // Remove HTML tags
    let tag_regex = Regex::new(r"<[^>]*>").unwrap();
    let without_tags = tag_regex.replace_all(html, "");
    
    // Decode common HTML entities
    let cleaned = without_tags
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&nbsp;", " ");
    
    // Clean up multiple spaces and newlines
    let space_regex = Regex::new(r"\s+").unwrap();
    let final_text = space_regex.replace_all(&cleaned, " ");
    
    final_text.trim().to_string()
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
    
    // Clean the HTML description
    let raw_description = product["body_html"]
        .as_str()
        .unwrap_or("");
    let description = if raw_description.is_empty() {
        String::new()
    } else {
        clean_html_description(raw_description)
    };
    
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

/// Search products by partial name using GraphQL (more flexible than REST)
#[tauri::command]
pub async fn search_products_by_name_graphql(
    config: State<'_, AppConfig>, 
    name: String, 
    sort_key: Option<String>,
    sort_reverse: Option<bool>
) -> Result<Vec<Product>, String> {
    let client = reqwest::Client::new();
    let graphql_url = format!("https://{}/admin/api/{}/graphql.json", 
        config.shop_domain, config.api_version);
    
    // Use the provided sort key or default to RELEVANCE
    let sort_key = sort_key.unwrap_or_else(|| "RELEVANCE".to_string());
    let sort_reverse = sort_reverse.unwrap_or(false);
    
    // Build the GraphQL query with wildcard for partial matching, sorting, and reverse option
    let query = format!(
        r#"
        {{
            products(first: 40, query: "title:{}* status:active", sortKey: {}, reverse: {}) {{
                edges {{
                    node {{
                        id
                        title
                        descriptionHtml
                        updatedAt
                        priceRangeV2 {{
                            minVariantPrice {{
                                amount
                            }}
                        }}
                        images(first: 5) {{
                            edges {{
                                node {{
                                    src
                                }}
                            }}
                        }}
                        variants(first: 50) {{
                            edges {{
                                node {{
                                    id
                                    title
                                    inventoryItem {{
                                        id
                                    }}
                                    inventoryQuantity
                                    price
                                    sku
                                }}
                            }}
                        }}
                    }}
                }}
            }}
        }}
        "#,
        name.replace("\"", "\\\""), // Escape quotes in search term
        sort_key,
        sort_reverse
    );

    println!("🔍 GraphQL Search for name: '{}' with sort key: '{}', reverse: {}", name, sort_key, sort_reverse);
    println!("📋 GraphQL Query: {}", query);

    let payload = json!({
        "query": query
    });

    let response = client
        .post(&graphql_url)
        .headers(config.get_headers())
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("GraphQL request failed: {}", e))?;

    let data: Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse GraphQL JSON: {}", e))?;

    // Check for GraphQL errors
    if let Some(errors) = data.get("errors") {
        return Err(format!("GraphQL errors: {}", errors));
    }

    let products = data["data"]["products"]["edges"]
        .as_array()
        .ok_or("No products found in GraphQL response")?;

    println!("📊 GraphQL returned {} products for '{}'", products.len(), name);

    let mut result = Vec::new();
    for edge in products {
        let product_node = &edge["node"];
        
        // Extract basic product info
        let gql_id = product_node["id"].as_str().unwrap_or("");
        let id = gql_id.split('/').last().unwrap_or(gql_id).to_string();
        
        let title = product_node["title"].as_str().unwrap_or("Unknown").to_string();
        
        let raw_description = product_node["descriptionHtml"].as_str().unwrap_or("");
        let description = if raw_description.is_empty() {
            String::new()
        } else {
            clean_html_description(raw_description)
        };

        let price = product_node["priceRangeV2"]["minVariantPrice"]["amount"]
            .as_str()
            .unwrap_or("0.00")
            .to_string();

        // Extract images
        let images: Vec<String> = product_node["images"]["edges"]
            .as_array()
            .map(|imgs| {
                imgs.iter()
                    .filter_map(|img| img["node"]["src"].as_str())
                    .map(|s| s.to_string())
                    .collect()
            })
            .unwrap_or_default();

        // Extract variants
        let variants: Vec<ProductVariant> = product_node["variants"]["edges"]
            .as_array()
            .map(|vars| {
                vars.iter()
                    .filter_map(|var| {
                        let var_node = &var["node"];
                        let gql_inventory_item_id = var_node["inventoryItem"]["id"].as_str()?;
                        let inventory_item_id = gql_inventory_item_id.split('/').last()?.to_string();
                        
                        Some(ProductVariant {
                            inventory_item_id,
                            title: var_node["title"].as_str().unwrap_or("Default").to_string(),
                            inventory_quantity: var_node["inventoryQuantity"].as_i64().unwrap_or(0) as i32,
                            price: var_node["price"].as_str().unwrap_or("0.00").to_string(),
                            sku: var_node["sku"].as_str().map(|s| s.to_string()),
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();

        let total_inventory: i32 = variants.iter().map(|v| v.inventory_quantity).sum();

        let product = Product {
            id,
            title,
            price,
            description,
            images,
            variants,
            total_inventory,
            locations: std::collections::HashMap::new(),
        };

        println!("✅ Parsed product: {} (ID: {})", product.title, product.id);
        result.push(product);
    }

    println!("🎯 GraphQL search for '{}' returned {} products", name, result.len());
    Ok(result)
} 