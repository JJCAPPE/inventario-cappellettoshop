// Integration tests that require real Shopify credentials
// Only run these when SHOPIFY_TEST=1 environment variable is set

use inventario_cappellettoshop_lib::utils::AppConfig;
use std::env;

fn should_run_integration_tests() -> bool {
    env::var("SHOPIFY_TEST").unwrap_or_default() == "1"
}

fn setup_real_config() -> Result<AppConfig, String> {
    AppConfig::from_env()
}

#[tokio::test]
async fn test_real_shopify_connection() {
    if !should_run_integration_tests() {
        println!("Skipping real Shopify test. Set SHOPIFY_TEST=1 to run.");
        return;
    }

    let config = match setup_real_config() {
        Ok(config) => config,
        Err(e) => {
            println!("Cannot run real Shopify test: {}", e);
            return;
        }
    };

    // Test basic connection
    let client = reqwest::Client::new();
    let url = config.get_api_url("shop.json");
    
    let response = client
        .get(&url)
        .headers(config.get_headers())
        .send()
        .await;
    
    match response {
        Ok(resp) => {
            assert!(resp.status().is_success(), "Failed to connect to Shopify: {}", resp.status());
            println!("✅ Shopify connection test passed");
        }
        Err(e) => {
            panic!("❌ Shopify connection test failed: {}", e);
        }
    }
}

#[tokio::test]
async fn test_real_product_fetch() {
    if !should_run_integration_tests() {
        println!("Skipping real product fetch test. Set SHOPIFY_TEST=1 to run.");
        return;
    }

    let config = match setup_real_config() {
        Ok(config) => config,
        Err(e) => {
            println!("Cannot run real product test: {}", e);
            return;
        }
    };

    let client = reqwest::Client::new();
    let url = config.get_api_url("products.json?limit=1");
    
    let response = client
        .get(&url)
        .headers(config.get_headers())
        .send()
        .await
        .expect("Failed to fetch products");
    
    assert!(response.status().is_success());
    
    let data: serde_json::Value = response
        .json()
        .await
        .expect("Failed to parse product JSON");
    
    assert!(data["products"].is_array());
    println!("✅ Product fetch test passed");
}

#[tokio::test]
async fn test_real_inventory_levels() {
    if !should_run_integration_tests() {
        println!("Skipping real inventory test. Set SHOPIFY_TEST=1 to run.");
        return;
    }

    let config = match setup_real_config() {
        Ok(config) => config,
        Err(e) => {
            println!("Cannot run real inventory test: {}", e);
            return;
        }
    };

    // First get a product to get inventory item IDs
    let client = reqwest::Client::new();
    let products_url = config.get_api_url("products.json?limit=1");
    
    let products_response = client
        .get(&products_url)
        .headers(config.get_headers())
        .send()
        .await
        .expect("Failed to fetch products");
    
    let products_data: serde_json::Value = products_response
        .json()
        .await
        .expect("Failed to parse products JSON");
    
    let products = products_data["products"].as_array().unwrap();
    if products.is_empty() {
        println!("No products found, skipping inventory test");
        return;
    }
    
    let variants = products[0]["variants"].as_array().unwrap();
    if variants.is_empty() {
        println!("No variants found, skipping inventory test");
        return;
    }
    
    let inventory_item_id = variants[0]["inventory_item_id"].as_u64().unwrap();
    
    // Now test inventory levels
    let inventory_url = config.get_api_url(&format!("inventory_levels.json?inventory_item_ids={}", inventory_item_id));
    
    let inventory_response = client
        .get(&inventory_url)
        .headers(config.get_headers())
        .send()
        .await
        .expect("Failed to fetch inventory levels");
    
    assert!(inventory_response.status().is_success());
    
    let inventory_data: serde_json::Value = inventory_response
        .json()
        .await
        .expect("Failed to parse inventory JSON");
    
    assert!(inventory_data["inventory_levels"].is_array());
    println!("✅ Inventory levels test passed");
}

// Dry-run tests (no actual API calls, just test the logic)
#[test]
fn test_dry_run_all_functions() {
    println!("🧪 Running dry-run tests for all functions...");
    
    // Test that all our data structures can be created
    let config = AppConfig {
        shop_domain: "test-shop.myshopify.com".to_string(),
        access_token: "test-token".to_string(),
        api_key: "test-api-key".to_string(),
        api_secret: "test-api-secret".to_string(),
        api_version: "2025-01".to_string(),
        primary_location: "12345".to_string(),
        secondary_location: "67890".to_string(),
        firebase_api_key: "test-firebase-key".to_string(),
        firebase_auth_domain: "test.firebaseapp.com".to_string(),
        firebase_project_id: "test-project".to_string(),
        firebase_storage_bucket: "test.appspot.com".to_string(),
        firebase_messaging_sender_id: "123456".to_string(),
        firebase_app_id: "1:123456:web:abc123".to_string(),
        firebase_measurement_id: "G-ABC123".to_string(),
        github_token: "test-github-token".to_string(),
        github_owner: "test-owner".to_string(),
        github_repo: "test-repo".to_string(),
        version: "2.2.0".to_string(),
    };
    
    // Test URL generation for all endpoints
    let endpoints = vec![
        "products.json",
        "products/123.json",
        "inventory_levels.json",
        "inventory_levels/adjust.json",
        "inventory_levels/set.json",
        "shop.json",
    ];
    
    for endpoint in endpoints {
        let url = config.get_api_url(endpoint);
        assert!(url.contains("test-shop.myshopify.com"));
        assert!(url.contains("2025-01"));
        assert!(url.contains(endpoint));
    }
    
    // Test header generation
    let headers = config.get_headers();
    assert!(headers.contains_key("X-Shopify-Access-Token"));
    assert!(headers.contains_key("Content-Type"));
    
    // Test Firebase config helper
    let firebase_config = config.get_firebase_config();
    assert_eq!(firebase_config.api_key, "test-firebase-key");
    assert_eq!(firebase_config.project_id, "test-project");
    
    // Test GitHub config helper
    let github_config = config.get_github_config();
    assert_eq!(github_config.token, "test-github-token");
    assert_eq!(github_config.owner, "test-owner");
    
    println!("✅ All dry-run tests passed");
} 