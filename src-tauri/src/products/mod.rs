use crate::utils::{AppConfig, Product, ProductVariant};
use regex::Regex;
use serde_json::{json, Value};
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

    let products = data["products"].as_array().ok_or("No products found")?;

    let mut result = Vec::new();
    for product in products {
        let parsed_product = parse_product_from_json(product)?;
        result.push(parsed_product);
    }

    Ok(result)
}

#[tauri::command]
pub async fn get_product_by_id(
    config: State<'_, AppConfig>,
    product_id: String,
) -> Result<Product, String> {
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
pub async fn search_products(
    config: State<'_, AppConfig>,
    query: String,
) -> Result<Vec<Product>, String> {
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

    let products = data["products"].as_array().ok_or("No products found")?;

    let mut result = Vec::new();
    for product in products {
        let parsed_product = parse_product_from_json(product)?;
        result.push(parsed_product);
    }

    Ok(result)
}

/// Search products by SKU using GraphQL - much more efficient than REST pagination
#[tauri::command]
pub async fn search_products_by_sku_graphql(
    config: State<'_, AppConfig>,
    sku: String,
) -> Result<Vec<Product>, String> {
    let client = reqwest::Client::new();
    let graphql_url = format!(
        "https://{}/admin/api/{}/graphql.json",
        config.shop_domain, config.api_version
    );

    println!("🎯 GraphQL SKU Search for: '{}'", sku);

    // Use GraphQL to search for products by SKU - much more efficient
    let query = format!(
        r#"
        {{
            products(first: 50, query: "sku:{} status:active") {{
                edges {{
                    node {{
                        id
                        title
                        handle
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
        sku
    );

    let request_body = serde_json::json!({
        "query": query
    });

    let response = client
        .post(&graphql_url)
        .headers(config.get_headers())
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("GraphQL request failed: {}", e))?;

    let response_text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    println!("📡 GraphQL Response received");

    let data: Value = serde_json::from_str(&response_text)
        .map_err(|e| format!("Failed to parse GraphQL response: {}", e))?;

    if let Some(errors) = data["errors"].as_array() {
        println!("❌ GraphQL Errors: {:?}", errors);
        return Err(format!("GraphQL errors: {:?}", errors));
    }

    let products = data["data"]["products"]["edges"]
        .as_array()
        .ok_or("No products found in GraphQL response")?;

    println!("📊 GraphQL returned {} products", products.len());

    let mut result = Vec::new();
    for edge in products {
        let product_node = &edge["node"];

        // Convert GraphQL response to our Product struct
        let product = convert_graphql_product_to_product(product_node)?;

        // Check if any variant has the exact SKU we're looking for
        let has_matching_sku = product.variants.iter().any(|v| {
            v.sku
                .as_ref()
                .map_or(false, |s| s.eq_ignore_ascii_case(&sku))
        });

        if has_matching_sku {
            println!("✅ Found product with matching SKU: {}", product.title);
            result.push(product);
        }
    }

    println!(
        "🎯 GraphQL SKU search for '{}' found {} products",
        sku,
        result.len()
    );
    Ok(result)
}

/// Find exact product by SKU using GraphQL - returns the first exact match with variant info
#[tauri::command]
pub async fn find_product_by_exact_sku_graphql(
    config: State<'_, AppConfig>,
    sku: String,
) -> Result<Option<(Product, String)>, String> {
    let client = reqwest::Client::new();
    let graphql_url = format!(
        "https://{}/admin/api/{}/graphql.json",
        config.shop_domain, config.api_version
    );

    println!("🎯 Looking for EXACT SKU match via GraphQL: '{}'", sku);

    // Search for products that contain this SKU
    let query = format!(
        r#"
        {{
            products(first: 10, query: "sku:{} status:active") {{
                edges {{
                    node {{
                        id
                        title
                        handle
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
        sku
    );

    let request_body = serde_json::json!({
        "query": query
    });

    let response = client
        .post(&graphql_url)
        .headers(config.get_headers())
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("GraphQL request failed: {}", e))?;

    let response_text = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    let data: Value = serde_json::from_str(&response_text)
        .map_err(|e| format!("Failed to parse GraphQL response: {}", e))?;

    if let Some(errors) = data["errors"].as_array() {
        println!("❌ GraphQL Errors: {:?}", errors);
        return Err(format!("GraphQL errors: {:?}", errors));
    }

    let products = data["data"]["products"]["edges"]
        .as_array()
        .ok_or("No products found in GraphQL response")?;

    println!(
        "📊 GraphQL returned {} products for exact SKU search",
        products.len()
    );

    // Look for exact SKU match in the returned products
    for edge in products {
        let product_node = &edge["node"];
        let product = convert_graphql_product_to_product(product_node)?;

        // Clone product to avoid borrow checker issues
        let product_clone = product.clone();

        // Find the variant with the exact matching SKU
        for variant in &product_clone.variants {
            if let Some(variant_sku) = &variant.sku {
                if variant_sku.eq_ignore_ascii_case(&sku) {
                    println!(
                        "✅ EXACT MATCH FOUND! Product: '{}', Variant: '{}', SKU: '{}'",
                        product.title, variant.title, variant_sku
                    );
                    return Ok(Some((product, variant.inventory_item_id.clone())));
                }
            }
        }
    }

    println!("❌ No exact SKU match found for: '{}'", sku);
    Ok(None)
}

/// Enhanced search that looks for both title and SKU matches
#[tauri::command]
pub async fn enhanced_search_products(
    config: State<'_, AppConfig>,
    query: String,
) -> Result<Vec<Product>, String> {
    println!("🚀 Enhanced search starting for query: '{}'", query);
    let mut result = Vec::new();
    let mut found_product_ids = std::collections::HashSet::new();

    // PHASE 1: Check if query is an exact SKU match
    if query.trim().len() > 5 {
        // SKUs are typically longer than 5 characters
        println!("🔍 Phase 1: Checking for exact SKU match");
        match find_product_by_exact_sku_graphql(config.clone(), query.trim().to_string()).await {
            Ok(Some((product, _variant_id))) => {
                println!("✅ Found exact SKU match, returning immediately");
                found_product_ids.insert(product.id.clone());
                result.push(product);
                return Ok(result); // Return immediately for exact SKU match
            }
            Ok(None) => {
                println!("🔍 No exact SKU match found, continuing to title search");
            }
            Err(e) => {
                println!("⚠️ SKU search failed: {}", e);
            }
        }
    }

    // PHASE 2: Title search using GraphQL
    println!("🔍 Phase 2: GraphQL title search");
    match search_products_by_name_graphql(config.clone(), query.clone(), None, None).await {
        Ok(title_products) => {
            println!(
                "✅ GraphQL title search returned {} products",
                title_products.len()
            );
            for product in title_products {
                if !found_product_ids.contains(&product.id) {
                    found_product_ids.insert(product.id.clone());
                    result.push(product);
                }
            }
        }
        Err(e) => {
            println!(
                "⚠️ GraphQL title search failed, falling back to REST: {}",
                e
            );
            // Fallback to REST API title search if GraphQL fails
            let client = reqwest::Client::new();
            let encoded_query = urlencoding::encode(&query);
            let title_url =
                config.get_api_url(&format!("products.json?title={}&limit=250", encoded_query));

            match client
                .get(&title_url)
                .headers(config.get_headers())
                .send()
                .await
            {
                Ok(title_response) => {
                    if let Ok(title_data) = title_response.json::<Value>().await {
                        if let Some(products) = title_data["products"].as_array() {
                            for product in products {
                                if let Ok(parsed_product) = parse_product_from_json(product) {
                                    if !found_product_ids.contains(&parsed_product.id) {
                                        found_product_ids.insert(parsed_product.id.clone());
                                        result.push(parsed_product);
                                    }
                                }
                            }
                        }
                    }
                }
                Err(e) => println!("❌ REST fallback also failed: {}", e),
            }
        }
    }

    // PHASE 3: If we still have few results, also search by SKU (partial matches)
    if result.len() < 10 {
        println!(
            "🔍 Phase 3: SKU partial search (current results: {})",
            result.len()
        );
        match search_products_by_sku_graphql(config.clone(), query.clone()).await {
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

    println!(
        "🎯 Enhanced search for '{}' completed: {} total results",
        query,
        result.len()
    );
    Ok(result)
}

/// Helper function to convert GraphQL product response to our Product struct
fn convert_graphql_product_to_product(product_node: &Value) -> Result<Product, String> {
    let id = product_node["id"]
        .as_str()
        .ok_or("Product ID missing")?
        .replace("gid://shopify/Product/", "");

    let title = product_node["title"]
        .as_str()
        .ok_or("Product title missing")?
        .to_string();

    let handle = product_node["handle"].as_str().unwrap_or("").to_string();

    let description = product_node["descriptionHtml"]
        .as_str()
        .unwrap_or("")
        .to_string();

    let price = product_node["priceRangeV2"]["minVariantPrice"]["amount"]
        .as_str()
        .unwrap_or("0.00")
        .to_string();

    let images: Vec<String> = product_node["images"]["edges"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .map(|edge| edge["node"]["src"].as_str().unwrap_or("").to_string())
        .collect();

    let variants: Vec<ProductVariant> = product_node["variants"]["edges"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .map(|edge| {
            let variant_node = &edge["node"];
            ProductVariant {
                title: variant_node["title"].as_str().unwrap_or("").to_string(),
                inventory_item_id: variant_node["inventoryItem"]["id"]
                    .as_str()
                    .unwrap_or("")
                    .replace("gid://shopify/InventoryItem/", ""),
                inventory_quantity: variant_node["inventoryQuantity"].as_i64().unwrap_or(0) as i32,
                price: variant_node["price"].as_str().unwrap_or("0.00").to_string(),
                sku: variant_node["sku"].as_str().map(|s| s.to_string()),
            }
        })
        .collect();

    Ok(Product {
        id,
        title,
        handle,
        description,
        price,
        total_inventory: variants.iter().map(|v| v.inventory_quantity).sum(),
        images,
        variants,
        locations: std::collections::HashMap::new(),
    })
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

    let title = product["title"].as_str().unwrap_or("Unknown").to_string();

    let handle = product["handle"].as_str().unwrap_or("").to_string();

    // Clean the HTML description
    let raw_description = product["body_html"].as_str().unwrap_or("");
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
                        inventory_item_id: var["inventory_item_id"].as_u64()?.to_string(),
                        title: var["title"].as_str().unwrap_or("Default").to_string(),
                        inventory_quantity: var["inventory_quantity"].as_i64().unwrap_or(0) as i32,
                        price: var["price"].as_str().unwrap_or("0.00").to_string(),
                        sku: var["sku"].as_str().map(|s| s.to_string()),
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    let total_inventory: i32 = variants.iter().map(|v| v.inventory_quantity).sum();

    let price = variants
        .first()
        .map(|v| v.price.clone())
        .unwrap_or_else(|| "0.00".to_string());

    Ok(Product {
        id,
        title,
        handle,
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
    sort_reverse: Option<bool>,
) -> Result<Vec<Product>, String> {
    let client = reqwest::Client::new();
    let graphql_url = format!(
        "https://{}/admin/api/{}/graphql.json",
        config.shop_domain, config.api_version
    );

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
                        handle
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

    println!(
        "🔍 GraphQL Search for name: '{}' with sort key: '{}', reverse: {}",
        name, sort_key, sort_reverse
    );
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

    println!(
        "📊 GraphQL returned {} products for '{}'",
        products.len(),
        name
    );

    let mut result = Vec::new();
    for edge in products {
        let product_node = &edge["node"];

        // Extract basic product info
        let gql_id = product_node["id"].as_str().unwrap_or("");
        let id = gql_id.split('/').last().unwrap_or(gql_id).to_string();

        let title = product_node["title"]
            .as_str()
            .unwrap_or("Unknown")
            .to_string();

        let handle = product_node["handle"].as_str().unwrap_or("").to_string();

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
                        let inventory_item_id =
                            gql_inventory_item_id.split('/').last()?.to_string();

                        Some(ProductVariant {
                            inventory_item_id,
                            title: var_node["title"].as_str().unwrap_or("Default").to_string(),
                            inventory_quantity: var_node["inventoryQuantity"].as_i64().unwrap_or(0)
                                as i32,
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
            handle,
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

    println!(
        "🎯 GraphQL search for '{}' returned {} products",
        name,
        result.len()
    );
    Ok(result)
}
