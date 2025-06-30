#!/usr/bin/env cargo

use inventario_cappellettoshop_lib::stock::*;
use inventario_cappellettoshop_lib::utils::AppConfig;
use std::env;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("🛠️  Shopify Stock Manager (Rust Edition)");
    println!("=========================================\n");

    // Parse command line arguments
    let args: Vec<String> = env::args().collect();
    let dry_run = args.contains(&"--dry-run".to_string()) || args.contains(&"-d".to_string());

    // Load configuration
    let config = match AppConfig::from_env() {
        Ok(config) => config,
        Err(e) => {
            eprintln!("❌ Failed to load configuration: {}", e);
            eprintln!("💡 Make sure your .env file is properly configured.");
            std::process::exit(1);
        }
    };

    // Show help if requested
    if args.contains(&"--help".to_string()) || args.contains(&"-h".to_string()) {
        print_help();
        return Ok(());
    }

    // Run the stock management
    match scan_and_update_products_standalone(&config, dry_run).await {
        Ok(result) => {
            println!("\n🎉 Operation completed successfully!");
            if !dry_run && result.summary.successful_updates > 0 {
                println!(
                    "📈 Updated {} products to draft status",
                    result.summary.successful_updates
                );
            }
        }
        Err(e) => {
            eprintln!("\n❌ Operation failed: {}", e);
            std::process::exit(1);
        }
    }

    Ok(())
}

/// Standalone version that doesn't require Tauri State
async fn scan_and_update_products_standalone(
    config: &AppConfig,
    dry_run: bool,
) -> Result<StockUpdateResult, String> {
    use inventario_cappellettoshop_lib::stock::StockUpdateResult;

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

/// Print help information
fn print_help() {
    println!("Shopify Stock Manager - Rust Edition");
    println!();
    println!("DESCRIPTION:");
    println!("    Scans all active products in your Shopify store and automatically");
    println!("    sets products with zero inventory to 'draft' status to prevent");
    println!("    customers from seeing products they can't purchase.");
    println!();
    println!("USAGE:");
    println!("    cargo run --bin stock_manager [OPTIONS]");
    println!();
    println!("OPTIONS:");
    println!("    -d, --dry-run    Preview changes without making any updates");
    println!("    -h, --help       Show this help message");
    println!();
    println!("EXAMPLES:");
    println!("    # Preview what would be changed (recommended first)");
    println!("    cargo run --bin stock_manager --dry-run");
    println!();
    println!("    # Actually update products to draft status");
    println!("    cargo run --bin stock_manager");
    println!();
    println!("CONFIGURATION:");
    println!("    Reads configuration from .env file in the project root.");
    println!("    Make sure SHOPIFY_SHOP_DOMAIN, SHOPIFY_ACCESS_TOKEN, etc. are set.");
}
