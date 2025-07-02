use crate::utils::AppConfig;
use futures::future::join_all;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashSet;
use std::time::Duration;
use tauri::State;
use tokio::time::sleep;

// Products to exclude from automatic draft status (add IDs here)
const EXCLUDED_PRODUCT_IDS: &[u64] = &[3587363962985]; // Excluded as requested

// Convert to strings for comparison since Shopify IDs can be strings or numbers
lazy_static::lazy_static! {
    static ref EXCLUDED_IDS_SET: HashSet<String> = {
        EXCLUDED_PRODUCT_IDS
            .iter()
            .map(|id| id.to_string())
            .collect()
    };
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProductNoStock {
    pub id: String,
    pub title: String,
    pub status: String,
    pub is_excluded: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StockUpdateResult {
    pub products_found: Vec<ProductNoStock>,
    pub update_results: Vec<UpdateResult>,
    pub summary: UpdateSummary,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateResult {
    pub product_id: String,
    pub title: String,
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateSummary {
    pub total_found: usize,
    pub excluded_count: usize,
    pub eligible_count: usize,
    pub successful_updates: usize,
    pub failed_updates: usize,
}

/// Shopify Products API response for pagination
#[derive(Debug, Deserialize)]
struct ProductsResponse {
    products: Vec<ShopifyProduct>,
}

#[derive(Debug, Deserialize)]
pub struct ShopifyProduct {
    id: u64,
    title: String,
    status: String,
    variants: Vec<ShopifyVariant>,
}

#[derive(Debug, Deserialize)]
struct ShopifyVariant {
    inventory_quantity: i32,
}

/// Tauri command to get products with no stock (dry run)
#[tauri::command]
pub async fn get_products_with_no_stock(
    config: State<'_, AppConfig>,
) -> Result<StockUpdateResult, String> {
    println!("🔍 Starting dry run scan for products with no stock...");
    scan_and_update_products(&*config, true).await
}

/// Tauri command to update products with no stock to draft status
#[tauri::command]
pub async fn update_products_no_stock_to_draft(
    config: State<'_, AppConfig>,
) -> Result<StockUpdateResult, String> {
    println!("⚡ Starting live update of products with no stock...");
    scan_and_update_products(&*config, false).await
}

/// Core function that scans all products and optionally updates them
async fn scan_and_update_products(
    config: &AppConfig,
    dry_run: bool,
) -> Result<StockUpdateResult, String> {
    let client = reqwest::Client::new();

    println!("📍 Shop: {}", config.shop_domain);
    println!("🔧 API Version: {}", config.api_version);
    if dry_run {
        println!("🧪 DRY RUN MODE - No changes will be made");
    } else {
        println!("⚡ LIVE MODE - Products will be set to draft status");
    }

    // Step 1: Fetch all products with concurrent requests
    println!("\n📄 Fetching all products...");
    let all_products = fetch_all_products_concurrent(&client, config).await?;
    println!("✅ Fetched {} total products", all_products.len());

    // Step 2: Find products with no stock
    println!("\n🔍 Analyzing inventory...");
    let products_with_no_stock = find_products_with_no_stock(all_products);
    println!(
        "🎯 Found {} active products with no stock",
        products_with_no_stock.len()
    );

    // Step 3: Update products if not dry run
    let mut update_results = Vec::new();
    if !dry_run && !products_with_no_stock.is_empty() {
        println!("\n📝 Updating products to draft status...");
        update_results = update_products_to_draft(&client, config, &products_with_no_stock).await?;
    }

    // Step 4: Generate summary
    let summary = generate_summary(&products_with_no_stock, &update_results);

    // Step 5: Print results
    print_results(&products_with_no_stock, &update_results, &summary, dry_run);

    Ok(StockUpdateResult {
        products_found: products_with_no_stock,
        update_results,
        summary,
    })
}

/// Fetch all products using concurrent requests for better performance
pub async fn fetch_all_products_concurrent(
    client: &reqwest::Client,
    config: &AppConfig,
) -> Result<Vec<ShopifyProduct>, String> {
    let mut all_products = Vec::new();
    let mut page_info: Option<String> = None;
    let mut page_count = 0;

    loop {
        page_count += 1;

        // Create batch of concurrent requests (3 pages at a time for rate limiting)
        let mut tasks = Vec::new();
        let batch_size = 3;

        for i in 0..batch_size {
            if i == 0 || page_info.is_some() {
                let task_client = client.clone();
                let task_config = config.clone();
                let task_page_info = page_info.clone();

                tasks.push(tokio::spawn(async move {
                    fetch_single_page(&task_client, &task_config, task_page_info).await
                }));

                // Only first request uses current page_info, others will be None (handled by API)
                if i == 0 {
                    page_info = None;
                }
            }
        }

        // Execute batch and collect results
        let results = join_all(tasks).await;
        let mut next_page_info = None;
        let mut batch_products = Vec::new();

        for result in results {
            match result {
                Ok(Ok((products, page_info_opt))) => {
                    batch_products.extend(products);
                    if next_page_info.is_none() {
                        next_page_info = page_info_opt;
                    }
                }
                Ok(Err(e)) => return Err(e),
                Err(e) => return Err(format!("Task failed: {}", e)),
            }
        }

        if batch_products.is_empty() {
            break;
        }

        println!(
            "   📄 Page {}: {} products",
            page_count,
            batch_products.len()
        );
        all_products.extend(batch_products);

        page_info = next_page_info;
        if page_info.is_none() {
            break;
        }

        // Small delay to respect rate limits
        sleep(Duration::from_millis(100)).await;
    }

    Ok(all_products)
}

/// Fetch a single page of products
async fn fetch_single_page(
    client: &reqwest::Client,
    config: &AppConfig,
    page_info: Option<String>,
) -> Result<(Vec<ShopifyProduct>, Option<String>), String> {
    let mut url = config.get_api_url("products.json");
    url.push_str("?limit=250&fields=id,title,status,variants");

    if let Some(info) = page_info {
        url.push_str(&format!("&page_info={}", info));
    } else {
        // Only add status filter on first request (not when paginating)
        url.push_str("&status=active");
    }

    let response = client
        .get(&url)
        .headers(config.get_headers())
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
            "HTTP error! status: {} - {} | Response: {}",
            status,
            status.canonical_reason().unwrap_or("Unknown"),
            error_text
        ));
    }

    // Extract pagination info from Link header
    let next_page_info = extract_next_page_info(&response);

    let data: ProductsResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;

    Ok((data.products, next_page_info))
}

/// Extract next page info from Link header
fn extract_next_page_info(response: &reqwest::Response) -> Option<String> {
    response
        .headers()
        .get("Link")?
        .to_str()
        .ok()?
        .split(',')
        .find(|link| link.contains("rel=\"next\""))?
        .split('?')
        .nth(1)?
        .split('&')
        .find(|param| param.starts_with("page_info="))?
        .strip_prefix("page_info=")?
        .split('>')
        .next()
        .map(|s| s.to_string())
}

/// Find products that are active but have no stock
pub fn find_products_with_no_stock(products: Vec<ShopifyProduct>) -> Vec<ProductNoStock> {
    products
        .into_iter()
        .filter_map(|product| {
            if product.status == "active" {
                let has_stock = product
                    .variants
                    .iter()
                    .any(|variant| variant.inventory_quantity > 0);

                if !has_stock {
                    let is_excluded = EXCLUDED_IDS_SET.contains(&product.id.to_string());
                    return Some(ProductNoStock {
                        id: product.id.to_string(),
                        title: product.title,
                        status: product.status,
                        is_excluded,
                    });
                }
            }
            None
        })
        .collect()
}

/// Update products to draft status
pub async fn update_products_to_draft(
    client: &reqwest::Client,
    config: &AppConfig,
    products: &[ProductNoStock],
) -> Result<Vec<UpdateResult>, String> {
    let mut results = Vec::new();

    for (index, product) in products.iter().enumerate() {
        println!(
            "   📝 ({}/{}) Updating: \"{}\" (ID: {})",
            index + 1,
            products.len(),
            product.title,
            product.id
        );

        if product.is_excluded {
            println!("   🛡️ EXCLUDED - Skipping update");
            results.push(UpdateResult {
                product_id: product.id.clone(),
                title: product.title.clone(),
                success: true, // Consider excluded as "success" (intentionally skipped)
                error: Some("Excluded from updates".to_string()),
            });
            continue;
        }

        match update_single_product_status(client, config, &product.id, "draft").await {
            Ok(_) => {
                println!("   ✅ Successfully set to draft");
                results.push(UpdateResult {
                    product_id: product.id.clone(),
                    title: product.title.clone(),
                    success: true,
                    error: None,
                });
            }
            Err(e) => {
                println!("   ❌ Failed to update: {}", e);
                results.push(UpdateResult {
                    product_id: product.id.clone(),
                    title: product.title.clone(),
                    success: false,
                    error: Some(e),
                });
            }
        }

        // Rate limiting delay
        if index < products.len() - 1 {
            sleep(Duration::from_millis(250)).await;
        }
    }

    Ok(results)
}

/// Update a single product's status
async fn update_single_product_status(
    client: &reqwest::Client,
    config: &AppConfig,
    product_id: &str,
    status: &str,
) -> Result<(), String> {
    let url = config.get_api_url(&format!("products/{}.json", product_id));

    let request_body = json!({
        "product": {
            "id": product_id.parse::<u64>().map_err(|e| format!("Invalid product ID: {}", e))?,
            "status": status
        }
    });

    let response = client
        .put(&url)
        .headers(config.get_headers())
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "HTTP error! status: {} - {}",
            response.status(),
            response.status().canonical_reason().unwrap_or("Unknown")
        ));
    }

    Ok(())
}

/// Generate summary statistics
pub fn generate_summary(
    products: &[ProductNoStock],
    update_results: &[UpdateResult],
) -> UpdateSummary {
    let excluded_count = products.iter().filter(|p| p.is_excluded).count();
    let eligible_count = products.len() - excluded_count;
    let successful_updates = update_results
        .iter()
        .filter(|r| r.success && r.error.is_none())
        .count();
    let failed_updates = update_results.iter().filter(|r| !r.success).count();

    UpdateSummary {
        total_found: products.len(),
        excluded_count,
        eligible_count,
        successful_updates,
        failed_updates,
    }
}

/// Print results to console
pub fn print_results(
    products: &[ProductNoStock],
    update_results: &[UpdateResult],
    summary: &UpdateSummary,
    dry_run: bool,
) {
    println!("\n🎯 FINAL RESULTS:");
    println!("{}", "═".repeat(80));

    if products.is_empty() {
        println!("✨ No active products found with zero stock!");
    } else {
        println!(
            "📦 Found {} active products with no stock",
            summary.total_found
        );

        if dry_run {
            println!("\n🧪 DRY RUN - Products that would be affected:");
            for (index, product) in products.iter().enumerate() {
                if product.is_excluded {
                    println!(
                        "{}. \"{}\" (ID: {}) [EXCLUDED]",
                        index + 1,
                        product.title,
                        product.id
                    );
                } else {
                    println!("{}. \"{}\" (ID: {})", index + 1, product.title, product.id);
                }
            }

            if summary.excluded_count > 0 {
                println!(
                    "\n🛡️ {} products are excluded from updates",
                    summary.excluded_count
                );
            }
            println!(
                "\n💡 {} products would be updated to draft status.",
                summary.eligible_count
            );
        } else {
            println!(
                "\n✅ Successfully updated: {} products",
                summary.successful_updates
            );
            if summary.excluded_count > 0 {
                println!(
                    "🛡️ Excluded from updates: {} products",
                    summary.excluded_count
                );
            }
            if summary.failed_updates > 0 {
                println!("❌ Failed to update: {} products", summary.failed_updates);
                println!("\nFailed products:");
                for (index, result) in update_results.iter().filter(|r| !r.success).enumerate() {
                    println!(
                        "{}. \"{}\" (ID: {}): {}",
                        index + 1,
                        result.title,
                        result.product_id,
                        result.error.as_deref().unwrap_or("Unknown error")
                    );
                }
            }
        }
    }

    println!("{}", "═".repeat(80));
    println!("✅ Scan complete!");
}
