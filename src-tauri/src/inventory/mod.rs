use crate::firebase::{
    create_inventory_log_data, DailyModificationGroup, DateRange, FirebaseClient, LogEntry,
    ModificationDetail, ProductModificationHistory, VariantModificationHistory,
};
use crate::location::LocationInfo;
use crate::utils::{AppConfig, InventoryUpdate, StatusResponse};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use tauri::State;

#[derive(Debug, Serialize, Deserialize)]
pub struct LocationConfigResponse {
    pub primary_location: LocationInfo,
    pub secondary_location: LocationInfo,
}

#[tauri::command]
pub async fn get_location_config(
    config: State<'_, AppConfig>,
) -> Result<LocationConfigResponse, String> {
    Ok(LocationConfigResponse {
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
    primary_location_name: String,
) -> Result<HashMap<String, HashMap<String, i32>>, String> {
    let client = reqwest::Client::new();
    let ids = inventory_item_ids.join(",");
    let url = config.get_api_url(&format!(
        "inventory_levels.json?inventory_item_ids={}&limit=250",
        ids
    ));

    println!(
        "🏪 Getting inventory for primary location: {}",
        primary_location_name
    );

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
        (
            config.primary_location.clone(),
            config.secondary_location.clone(),
        )
    } else {
        (
            config.secondary_location.clone(),
            config.primary_location.clone(),
        )
    };

    println!(
        "📍 Using Primary Location ID: {} ({})",
        primary_location_id, primary_location_name
    );
    println!(
        "📍 Using Secondary Location ID: {} ({})",
        secondary_location_id,
        if primary_location_name == "Treviso" {
            "Mogliano"
        } else {
            "Treviso"
        }
    );

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

        let available = level["available"].as_i64().unwrap_or(0) as i32;

        // Only include inventory for our two locations
        if location_id == primary_location_id || location_id == secondary_location_id {
            let location_label = if location_id == primary_location_id {
                "primary"
            } else {
                "secondary"
            };

            println!(
                "📦 Item {} at location {} ({}): {} available",
                inventory_item_id, location_id, location_label, available
            );

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
pub async fn get_inventory_levels(
    config: State<'_, AppConfig>,
    inventory_item_ids: Vec<String>,
) -> Result<HashMap<String, HashMap<String, i32>>, String> {
    let client = reqwest::Client::new();
    let ids = inventory_item_ids.join(",");
    let url = config.get_api_url(&format!(
        "inventory_levels.json?inventory_item_ids={}&limit=250",
        ids
    ));

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

        let available = level["available"].as_i64().unwrap_or(0) as i32;

        result
            .entry(inventory_item_id)
            .or_insert_with(HashMap::new)
            .insert(location_id, available);
    }

    Ok(result)
}

#[tauri::command]
pub async fn adjust_inventory(
    config: State<'_, AppConfig>,
    updates: Vec<InventoryUpdate>,
) -> Result<StatusResponse, String> {
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
pub async fn set_inventory_level(
    config: State<'_, AppConfig>,
    inventory_item_id: String,
    location_id: String,
    quantity: i32,
) -> Result<StatusResponse, String> {
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
pub async fn get_low_stock_products(
    config: State<'_, AppConfig>,
    threshold: i32,
) -> Result<Vec<Value>, String> {
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

    let mut low_stock_products = Vec::new();

    for product in products {
        let empty_vec = vec![];
        let variants = product["variants"].as_array().unwrap_or(&empty_vec);

        for variant in variants {
            let inventory_quantity = variant["inventory_quantity"].as_i64().unwrap_or(0) as i32;

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

#[tauri::command]
pub async fn decrease_inventory_with_logging(
    inventory_item_id: String,
    location_id: String,
    product_id: String,
    variant_title: String,
    product_name: String,
    price: String,
    negozio: String,
    images: Vec<String>,
    config: tauri::State<'_, AppConfig>,
) -> Result<StatusResponse, String> {
    println!("📦 Starting inventory decrease with logging:");
    println!("   🏪 Store: {}", negozio);
    println!("   📦 Product: {} ({})", product_name, variant_title);
    println!("   📍 Location ID: {}", location_id);
    println!("   🔢 Inventory Item ID: {}", inventory_item_id);

    // Adjust inventory first
    let update = InventoryUpdate {
        variant_id: inventory_item_id.clone(),
        location_id: location_id.clone(),
        adjustment: -1,
    };

    println!("📉 Adjusting Shopify inventory...");
    adjust_inventory(config.clone(), vec![update]).await?;
    println!("✅ Shopify inventory adjusted successfully");

    // Create log entry
    let log_data = create_inventory_log_data(
        product_id,
        variant_title,
        negozio,
        inventory_item_id,
        product_name,
        price,
        -1,
        images,
    );

    // Save to Firebase
    println!("📝 Creating Firebase log entry...");
    let firebase_client = FirebaseClient::new(config.inner().clone());
    let log_entry = LogEntry {
        request_type: "Rettifica".to_string(),
        data: log_data,
        timestamp: chrono::Utc::now().to_rfc3339(),
    };

    firebase_client.create_log(log_entry).await?;

    println!("✅ Inventory decrease completed with logging");
    Ok(StatusResponse {
        status: "success".to_string(),
        message: "Inventory decreased and logged successfully".to_string(),
    })
}

#[tauri::command]
pub async fn undo_decrease_inventory_with_logging(
    inventory_item_id: String,
    location_id: String,
    product_id: String,
    variant_title: String,
    product_name: String,
    price: String,
    negozio: String,
    images: Vec<String>,
    config: tauri::State<'_, AppConfig>,
) -> Result<StatusResponse, String> {
    println!("🔄 Starting inventory undo (increase) with logging:");
    println!("   🏪 Store: {}", negozio);
    println!("   📦 Product: {} ({})", product_name, variant_title);
    println!("   📍 Location ID: {}", location_id);
    println!("   🔢 Inventory Item ID: {}", inventory_item_id);

    // Adjust inventory first (increase by 1)
    let update = InventoryUpdate {
        variant_id: inventory_item_id.clone(),
        location_id: location_id.clone(),
        adjustment: 1,
    };

    println!("📈 Adjusting Shopify inventory (undo)...");
    adjust_inventory(config.clone(), vec![update]).await?;
    println!("✅ Shopify inventory adjusted successfully");

    // Create log entry
    let log_data = create_inventory_log_data(
        product_id,
        variant_title,
        negozio,
        inventory_item_id,
        product_name,
        price,
        1,
        images,
    );

    // Save to Firebase
    println!("📝 Creating Firebase log entry (undo)...");
    let firebase_client = FirebaseClient::new(config.inner().clone());
    let log_entry = LogEntry {
        request_type: "Annullamento".to_string(),
        data: log_data,
        timestamp: chrono::Utc::now().to_rfc3339(),
    };

    firebase_client.create_log(log_entry).await?;

    println!("✅ Inventory undo completed with logging");
    Ok(StatusResponse {
        status: "success".to_string(),
        message: "Inventory increase (undo) and logged successfully".to_string(),
    })
}

#[tauri::command]
pub async fn get_product_modification_history(
    product_id: String,
    location: String,
    days_back: i32,
    config: tauri::State<'_, AppConfig>,
) -> Result<ProductModificationHistory, String> {
    println!("📊 Starting modification history analysis:");
    println!("   📦 Product ID: {}", product_id);
    println!("   🏪 Location: {}", location);
    println!("   📅 Days back: {}", days_back);

    // Calculate date range
    let end_date = chrono::Utc::now();
    let start_date = end_date - chrono::Duration::days(days_back as i64);

    let start_date_str = start_date.to_rfc3339();
    let end_date_str = end_date.to_rfc3339();

    let date_range = DateRange {
        start_date: start_date_str.clone(),
        end_date: end_date_str.clone(),
        days_back,
    };

    println!("   🕐 Date range: {} to {}", start_date_str, end_date_str);

    // Step 1: Get Firebase logs for this product
    let firebase_client = FirebaseClient::new(config.inner().clone());
    let firebase_logs = firebase_client
        .get_logs_by_product_id(
            product_id.clone(),
            location.clone(),
            start_date_str.clone(),
            end_date_str.clone(),
        )
        .await?;

    println!(
        "📝 Found {} Firebase logs for this product",
        firebase_logs.len()
    );

    // Step 2: Get current product data from Shopify
    let product = crate::products::get_product_by_id(config.clone(), product_id.clone()).await?;
    println!("🛍️ Retrieved product: {}", product.title);

    // Step 3: Get current inventory levels
    let inventory_item_ids: Vec<String> = product
        .variants
        .iter()
        .map(|v| v.inventory_item_id.clone())
        .collect();

    let location_config = get_location_config(config.clone()).await?;
    let location_id = if location == "Treviso" {
        location_config.primary_location.id
    } else {
        location_config.secondary_location.id
    };

    println!("📍 Using location ID: {} for {}", location_id, location);

    let inventory_levels =
        get_inventory_levels_for_locations(config.clone(), inventory_item_ids, location.clone())
            .await?;

    println!(
        "📊 Retrieved inventory levels for {} variants",
        inventory_levels.len()
    );

    // Step 4: Analyze each variant
    let mut variants = Vec::new();

    for variant in &product.variants {
        println!("🔍 Analyzing variant: {}", variant.title);

        // Get Firebase logs for this specific variant
        let variant_logs: Vec<&LogEntry> = firebase_logs
            .iter()
            .filter(|log| log.data.variant == variant.title)
            .collect();

        println!(
            "   📝 Found {} Firebase logs for this variant",
            variant_logs.len()
        );

        // Calculate total app net changes (sum of all rettifica values)
        let app_net_change: i32 = variant_logs.iter().map(|log| log.data.rettifica).sum();

        // Group modifications by date
        let daily_groups = group_modifications_by_date(&variant_logs);

        // Get current inventory quantity
        let current_quantity = inventory_levels
            .get(&variant.inventory_item_id)
            .and_then(|inv| inv.get("primary"))
            .copied()
            .unwrap_or(0);

        println!("   📦 Current quantity: {}", current_quantity);
        println!("   📱 App net change: {}", app_net_change);

        // Enhanced Shopify change detection
        // To detect Shopify changes, we need to infer what the starting quantity was
        // and compare current quantity with expected quantity after our changes

        // For this analysis, let's estimate the Shopify changes by looking at
        // the discrepancy between what we expect and what we observe

        // First, get the earliest log timestamp to understand the analysis window
        let earliest_app_log = variant_logs.iter().min_by_key(|log| &log.timestamp);

        // For a more accurate analysis, we would need:
        // 1. Starting inventory at the beginning of the period
        // 2. Or inventory snapshots over time
        // 3. Or access to Shopify's inventory adjustment history

        // For now, let's use a simplified approach:
        // If we have app changes but inventory doesn't match expected pattern,
        // there might be external changes

        let shopify_net_change = if variant_logs.is_empty() {
            // No app changes, so any inventory changes would be external
            // But we don't have historical baseline, so assume 0 for now
            0
        } else {
            // We have app changes, check if current state suggests external changes
            // This is a simplified heuristic - in reality we'd need better baseline data
            if app_net_change != 0 && current_quantity == 0 && app_net_change > 0 {
                // We added inventory but current is 0 - suggests external removal
                -app_net_change
            } else if app_net_change == 0 && current_quantity != 0 {
                // No app changes but inventory exists - suggests external addition
                // But without baseline we can't calculate this accurately
                0
            } else {
                // For now, assume no external changes
                0
            }
        };

        let discrepancy = app_net_change != shopify_net_change;

        println!("   🏪 Estimated Shopify net change: {}", shopify_net_change);
        println!("   ⚠️ Discrepancy detected: {}", discrepancy);

        let variant_history = VariantModificationHistory {
            variant_title: variant.title.clone(),
            inventory_item_id: variant.inventory_item_id.clone(),
            app_net_change,
            shopify_net_change,
            discrepancy,
            current_quantity,
            daily_modifications: daily_groups,
        };

        variants.push(variant_history);
    }

    let history = ProductModificationHistory {
        product_id: product_id.clone(),
        location: location.clone(),
        date_range,
        variants,
    };

    println!("✅ Modification history analysis completed");
    Ok(history)
}

/// Group modifications by date and calculate net changes per day
fn group_modifications_by_date(logs: &[&LogEntry]) -> Vec<DailyModificationGroup> {
    use chrono::{DateTime, Utc};
    use std::collections::HashMap;

    let mut groups: HashMap<String, Vec<&LogEntry>> = HashMap::new();

    // Group logs by date
    for log in logs {
        // Parse timestamp and extract date
        let date = if let Ok(parsed_time) = DateTime::parse_from_rfc3339(&log.timestamp) {
            parsed_time.format("%Y-%m-%d").to_string()
        } else {
            // Fallback: try to extract date from timestamp string
            log.timestamp
                .split('T')
                .next()
                .unwrap_or("unknown")
                .to_string()
        };

        groups.entry(date).or_insert_with(Vec::new).push(log);
    }

    // Convert groups to DailyModificationGroup
    let mut daily_groups: Vec<DailyModificationGroup> = groups
        .into_iter()
        .map(|(date, day_logs)| {
            // Calculate net change for this date
            let app_net_change: i32 = day_logs.iter().map(|log| log.data.rettifica).sum();

            // Create modification details for this date
            let app_details: Vec<ModificationDetail> = day_logs
                .iter()
                .map(|log| ModificationDetail {
                    timestamp: log.timestamp.clone(),
                    source: "app".to_string(),
                    change: log.data.rettifica,
                    reason: Some(log.request_type.clone()),
                })
                .collect();

            // TODO: Improve Shopify change detection
            // Currently we can't accurately detect Shopify changes without:
            // 1. Historical inventory snapshots
            // 2. Access to Shopify's inventory adjustment history API
            // 3. Or implementing a baseline tracking system
            //
            // Future improvements:
            // 1. Store inventory snapshots daily/periodically in Firebase
            // 2. Use the new GraphQL adjustment API for our changes (marks them clearly)
            // 3. Implement a webhook listener for inventory changes
            // 4. Use Shopify's events API to track external changes
            //
            // For now, we'll show 0 Shopify changes per day
            let shopify_net_change = 0;
            let shopify_details = Vec::new();

            DailyModificationGroup {
                date: date.clone(),
                app_net_change,
                shopify_net_change,
                synchronized: app_net_change == shopify_net_change,
                app_details,
                shopify_details,
            }
        })
        .collect();

    // Sort by date (most recent first)
    daily_groups.sort_by(|a, b| b.date.cmp(&a.date));

    daily_groups
}

#[tauri::command]
pub async fn adjust_inventory_graphql(
    config: State<'_, AppConfig>,
    inventory_item_id: String,
    location_id: String,
    delta: i32,
    reason: String,
) -> Result<StatusResponse, String> {
    let client = reqwest::Client::new();
    let url = config.get_api_url("graphql.json");

    // Convert to Shopify Global IDs
    let inventory_item_gid = format!("gid://shopify/InventoryItem/{}", inventory_item_id);
    let location_gid = format!("gid://shopify/Location/{}", location_id);

    let query = r#"
        mutation inventoryAdjustQuantities($input: InventoryAdjustQuantitiesInput!) {
            inventoryAdjustQuantities(input: $input) {
                userErrors {
                    field
                    message
                }
                inventoryAdjustmentGroup {
                    id
                    createdAt
                    reason
                    changes {
                        name
                        delta
                    }
                }
            }
        }
    "#;

    let variables = json!({
        "input": {
            "reason": reason,
            "name": "available",
            "referenceDocumentUri": "app://inventario-cappelletto",
            "changes": [{
                "delta": delta,
                "inventoryItemId": inventory_item_gid,
                "locationId": location_gid
            }]
        }
    });

    let payload = json!({
        "query": query,
        "variables": variables
    });

    println!("🔄 Making GraphQL inventory adjustment:");
    println!("   📦 Inventory Item: {}", inventory_item_id);
    println!("   📍 Location: {}", location_id);
    println!("   📊 Delta: {}", delta);
    println!("   📝 Reason: {}", reason);

    let response = client
        .post(&url)
        .headers(config.get_headers())
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("GraphQL request failed: {}", e))?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!(
            "Failed to adjust inventory via GraphQL: {}",
            error_text
        ));
    }

    let response_json: Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse GraphQL response: {}", e))?;

    // Check for GraphQL errors
    if let Some(errors) = response_json.get("errors") {
        return Err(format!("GraphQL errors: {}", errors));
    }

    // Check for user errors
    if let Some(user_errors) =
        response_json["data"]["inventoryAdjustQuantities"]["userErrors"].as_array()
    {
        if !user_errors.is_empty() {
            return Err(format!("Inventory adjustment errors: {:?}", user_errors));
        }
    }

    println!("✅ GraphQL inventory adjustment completed successfully");

    Ok(StatusResponse {
        status: "success".to_string(),
        message: format!("Inventory adjusted by {} via GraphQL", delta),
    })
}
