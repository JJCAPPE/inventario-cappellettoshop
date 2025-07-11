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
) -> Result<EnhancedStatusResponse, String> {
    println!("📦 Starting enhanced inventory decrease with logging:");
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

    // Check if product now has zero inventory across all locations
    let mut status_changed = None;
    let mut current_product_status = None;

    let has_zero_inventory = has_zero_inventory_across_all_locations(&config, &product_id).await?;

    if has_zero_inventory {
        println!("🎯 Product has zero inventory across all locations - setting to draft");
        match update_product_status(&config, &product_id, "draft").await {
            Ok(_) => {
                status_changed = Some("to_draft".to_string());
                current_product_status = Some("draft".to_string());
                println!("✅ Product status updated to draft");
            }
            Err(e) => {
                println!("⚠️ Failed to update product status to draft: {}", e);
                // Continue with the operation even if status update fails
            }
        }
    }

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

    let base_message = "Inventario diminuito e registrato con successo".to_string();
    let enhanced_message = match &status_changed {
        Some(_) => format!(
            "{} - Prodotto impostato come bozza (inventario esaurito)",
            base_message
        ),
        None => base_message,
    };

    println!("✅ Enhanced inventory decrease completed with logging");
    Ok(EnhancedStatusResponse {
        status: "success".to_string(),
        message: enhanced_message,
        status_changed,
        product_status: current_product_status,
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
) -> Result<EnhancedStatusResponse, String> {
    println!("🔄 Starting enhanced inventory undo (increase) with logging:");
    println!("   🏪 Store: {}", negozio);
    println!("   📦 Product: {} ({})", product_name, variant_title);
    println!("   📍 Location ID: {}", location_id);
    println!("   🔢 Inventory Item ID: {}", inventory_item_id);

    // Check if product currently has zero inventory (to know if we should activate it)
    let had_zero_inventory = has_zero_inventory_across_all_locations(&config, &product_id).await?;

    // Adjust inventory first (increase by 1)
    let update = InventoryUpdate {
        variant_id: inventory_item_id.clone(),
        location_id: location_id.clone(),
        adjustment: 1,
    };

    println!("📈 Adjusting Shopify inventory (undo)...");
    adjust_inventory(config.clone(), vec![update]).await?;
    println!("✅ Shopify inventory adjusted successfully");

    // If product had zero inventory and now has some, set it back to active
    let mut status_changed = None;
    let mut current_product_status = None;

    if had_zero_inventory {
        println!("🎯 Product previously had zero inventory - setting back to active");
        match update_product_status(&config, &product_id, "active").await {
            Ok(_) => {
                status_changed = Some("to_active".to_string());
                current_product_status = Some("active".to_string());
                println!("✅ Product status updated to active");
            }
            Err(e) => {
                println!("⚠️ Failed to update product status to active: {}", e);
                // Continue with the operation even if status update fails
            }
        }
    }

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

    let base_message = "Inventario ripristinato e registrato con successo".to_string();
    let enhanced_message = match &status_changed {
        Some(_) => format!(
            "{} - Prodotto riattivato (inventario disponibile)",
            base_message
        ),
        None => base_message,
    };

    println!("✅ Enhanced inventory undo completed with logging");
    Ok(EnhancedStatusResponse {
        status: "success".to_string(),
        message: enhanced_message,
        status_changed,
        product_status: current_product_status,
    })
}

/// Transfer inventory between two locations and log to Firebase  
#[tauri::command]
pub async fn transfer_inventory_between_locations(
    inventory_item_id: String,
    from_location_id: String,
    to_location_id: String,
    product_id: String,
    variant_title: String,
    product_name: String,
    price: String,
    from_location: String,
    to_location: String,
    images: Vec<String>,
    config: tauri::State<'_, AppConfig>,
) -> Result<EnhancedStatusResponse, String> {
    println!(
        "🔄 Starting inventory transfer for product: {} ({})",
        product_name, variant_title
    );
    println!("📦 Inventory item ID: {}", inventory_item_id);
    println!(
        "📍 From location: {} (ID: {})",
        from_location, from_location_id
    );
    println!("📍 To location: {} (ID: {})", to_location, to_location_id);

    // Note: Inventory validation is handled by the frontend (same logic as variant selection)
    // The frontend ensures only variants with stock > 0 in the primary location can be transferred

    // Step 4: Execute the transfer (decrease from source, increase at destination)
    println!("📉 Decreasing inventory at source location...");
    let decrease_update = InventoryUpdate {
        variant_id: inventory_item_id.clone(),
        location_id: from_location_id.clone(),
        adjustment: -1,
    };

    let from_result = adjust_inventory(config.clone(), vec![decrease_update]).await;

    if let Err(e) = from_result {
        return Err(format!(
            "Errore nella rimozione da {}: {}",
            from_location, e
        ));
    }

    println!("📈 Increasing inventory at destination location...");
    let increase_update = InventoryUpdate {
        variant_id: inventory_item_id.clone(),
        location_id: to_location_id.clone(),
        adjustment: 1,
    };

    let to_result = adjust_inventory(config.clone(), vec![increase_update]).await;

    if let Err(e) = to_result {
        // Rollback: restore the source location inventory
        println!("❌ Error at destination, rolling back source location...");
        let rollback_update = InventoryUpdate {
            variant_id: inventory_item_id.clone(),
            location_id: from_location_id.clone(),
            adjustment: 1,
        };
        let rollback_result = adjust_inventory(config.clone(), vec![rollback_update]).await;

        if let Err(rollback_err) = rollback_result {
            return Err(format!(
                "ERRORE CRITICO: Fallimento trasferimento e rollback fallito. Originale: {}, Rollback: {}",
                e, rollback_err
            ));
        }
        return Err(format!("Errore nell'aggiunta a {}: {}", to_location, e));
    }

    println!("✅ Inventory transfer successful");

    // Step 5: Create Firebase log entries (one for each location)
    let firebase_client = FirebaseClient::new(config.inner().clone());

    // Log entry for source location (negative adjustment)
    let source_log_data = crate::firebase::LogData {
        id: product_id.clone(),
        variant: variant_title.clone(),
        negozio: from_location.clone(),
        inventory_item_id: inventory_item_id.clone(),
        nome: product_name.clone(),
        prezzo: price.clone(),
        rettifica: -1, // Negative 1 for removal from source
        images: images.clone(),
    };

    println!("📝 Creating Firebase log for source location (removal)");
    let source_log_entry = crate::firebase::LogEntry {
        request_type: "Trasferimento".to_string(),
        data: source_log_data,
        timestamp: chrono::Utc::now().to_rfc3339(),
    };

    let source_log_result = firebase_client.create_log(source_log_entry).await;

    if let Err(e) = source_log_result {
        println!("⚠️ Warning: Failed to log source transfer: {}", e);
        // Don't fail the entire operation for logging issues, but warn
    }

    // Log entry for destination location (positive adjustment)
    let dest_log_data = crate::firebase::LogData {
        id: product_id.clone(),
        variant: variant_title.clone(),
        negozio: to_location.clone(),
        inventory_item_id: inventory_item_id.clone(),
        nome: product_name.clone(),
        prezzo: price.clone(),
        rettifica: 1, // Positive 1 for addition to destination
        images: images.clone(),
    };

    println!("📝 Creating Firebase log for destination location (addition)");
    let dest_log_entry = crate::firebase::LogEntry {
        request_type: "Trasferimento".to_string(),
        data: dest_log_data,
        timestamp: chrono::Utc::now().to_rfc3339(),
    };

    let dest_log_result = firebase_client.create_log(dest_log_entry).await;

    if let Err(e) = dest_log_result {
        println!("⚠️ Warning: Failed to log destination transfer: {}", e);
        // Don't fail the entire operation for logging issues, but warn
    }

    println!("✅ Firebase logs created successfully for transfer");

    // Step 6: Check if product status needs to change due to inventory levels
    let status_changed = match has_zero_inventory_across_all_locations(&config, &product_id).await {
        Ok(true) => {
            println!("🔄 Product has zero inventory across all locations, setting to draft");
            update_product_status(&config, &product_id, "draft").await?;
            Some("to_draft".to_string())
        }
        Ok(false) => {
            println!("✅ Product still has inventory in some locations");
            None
        }
        Err(e) => {
            println!(
                "⚠️ Warning: Could not check product inventory status: {}",
                e
            );
            None
        }
    };

    // Return enhanced response with status change information
    Ok(EnhancedStatusResponse {
        status: "success".to_string(),
        message: format!(
            "Trasferimento completato: {} ({}) spostato da {} a {}",
            product_name, variant_title, from_location, to_location
        ),
        status_changed,
        product_status: None, // We don't fetch current status for transfers
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

        // All logic for Shopify change detection and discrepancy has been removed.

        let variant_history = VariantModificationHistory {
            variant_title: variant.title.clone(),
            inventory_item_id: variant.inventory_item_id.clone(),
            app_net_change,
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
    use chrono::DateTime;
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

            // Shopify-related logic has been removed.

            DailyModificationGroup {
                date: date.clone(),
                app_net_change,
                app_details,
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

/// Check if a product has zero inventory across all locations
async fn has_zero_inventory_across_all_locations(
    config: &tauri::State<'_, AppConfig>,
    product_id: &str,
) -> Result<bool, String> {
    println!("🔍 Checking total inventory for product {}", product_id);

    // Get product details to find all variants
    let product =
        crate::products::get_product_by_id(config.clone(), product_id.to_string()).await?;

    // Get all inventory item IDs
    let inventory_item_ids: Vec<String> = product
        .variants
        .iter()
        .map(|v| v.inventory_item_id.clone())
        .collect();

    // Get inventory levels across all locations
    let inventory_levels = get_inventory_levels(config.clone(), inventory_item_ids).await?;

    // Check if all variants have zero inventory across all locations
    let has_inventory = inventory_levels
        .values()
        .any(|location_map| location_map.values().any(|&quantity| quantity > 0));

    let is_zero = !has_inventory;
    println!("📊 Product {} has zero inventory: {}", product_id, is_zero);

    Ok(is_zero)
}

/// Update product status (active/draft)
async fn update_product_status(
    config: &tauri::State<'_, AppConfig>,
    product_id: &str,
    new_status: &str,
) -> Result<(), String> {
    println!(
        "📝 Updating product {} status to: {}",
        product_id, new_status
    );

    let client = reqwest::Client::new();
    let url = config.get_api_url(&format!("products/{}.json", product_id));

    let request_body = json!({
        "product": {
            "id": product_id.parse::<u64>().map_err(|e| format!("Invalid product ID: {}", e))?,
            "status": new_status
        }
    });

    let response = client
        .put(&url)
        .headers(config.get_headers())
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unable to read error".to_string());
        return Err(format!(
            "Failed to update product status: {} - {}",
            status, error_text
        ));
    }

    println!(
        "✅ Successfully updated product {} status to {}",
        product_id, new_status
    );
    Ok(())
}

/// Enhanced response that includes status change information
#[derive(Debug, Serialize, Deserialize)]
pub struct EnhancedStatusResponse {
    pub status: String,
    pub message: String,
    pub status_changed: Option<String>, // "to_draft", "to_active", or None
    pub product_status: Option<String>, // Current product status
}
