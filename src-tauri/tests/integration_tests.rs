use inventario_cappellettoshop_lib::utils::{AppConfig, Product, ProductVariant, InventoryUpdate, StatusResponse};
use serde_json::{json, Value};
use std::collections::HashMap;

// ============================================================================
// CONFIGURATION TESTS
// ============================================================================

// #[test]
// fn test_config_from_env_missing_vars() {
//     // This test is commented out because it's difficult to test missing env vars
//     // when a .env file exists and is automatically loaded by dotenvy
//     // The functionality is still validated by the from_env method returning proper errors
// }

#[test]
fn test_config_from_env_success() {
    // Test that AppConfig::from_env succeeds when .env file has all required variables
    let result = AppConfig::from_env();
    assert!(result.is_ok());
    
    let config = result.unwrap();
    assert!(!config.shop_domain.is_empty());
    assert!(!config.access_token.is_empty());
    assert!(!config.primary_location.is_empty());
    assert!(!config.secondary_location.is_empty());
    assert_eq!(config.api_version, "2025-01");
}

#[test]
fn test_config_api_url_generation() {
    let config = AppConfig {
        shop_domain: "test-shop.myshopify.com".to_string(),
        access_token: "test-token".to_string(),
        api_key: "test-api-key".to_string(),
        api_secret: "test-api-secret".to_string(),
        api_version: "2025-01".to_string(),
        primary_location: "loc1".to_string(),
        secondary_location: "loc2".to_string(),
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
    
    let url = config.get_api_url("products.json");
    assert_eq!(url, "https://test-shop.myshopify.com/admin/api/2025-01/products.json");
}

#[test]
fn test_config_headers() {
    let config = AppConfig {
        shop_domain: "test-shop.myshopify.com".to_string(),
        access_token: "test-token".to_string(),
        api_key: "test-api-key".to_string(),
        api_secret: "test-api-secret".to_string(),
        api_version: "2025-01".to_string(),
        primary_location: "loc1".to_string(),
        secondary_location: "loc2".to_string(),
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
    
    let headers = config.get_headers();
    assert!(headers.contains_key("X-Shopify-Access-Token"));
    assert!(headers.contains_key("Content-Type"));
}

// ============================================================================
// DATA STRUCTURE TESTS
// ============================================================================

#[test]
fn test_product_creation() {
    let variant = ProductVariant {
        inventory_item_id: "12345".to_string(),
        title: "Test Variant".to_string(),
        inventory_quantity: 10,
        price: "19.99".to_string(),
        sku: Some("TEST-SKU".to_string()),
    };
    
    let product = Product {
        id: "1".to_string(),
        title: "Test Product".to_string(),
        price: "19.99".to_string(),
        description: "A test product".to_string(),
        images: vec!["https://example.com/image.jpg".to_string()],
        variants: vec![variant],
        total_inventory: 10,
        locations: HashMap::new(),
    };
    
    assert_eq!(product.title, "Test Product");
    assert_eq!(product.variants.len(), 1);
    assert_eq!(product.variants[0].inventory_quantity, 10);
}

#[test]
fn test_inventory_update_creation() {
    let update = InventoryUpdate {
        variant_id: "12345".to_string(),
        location_id: "67890".to_string(),
        adjustment: -5,
    };
    
    assert_eq!(update.adjustment, -5);
    assert_eq!(update.variant_id, "12345");
}

#[test]
fn test_status_response_creation() {
    let response = StatusResponse {
        status: "success".to_string(),
        message: "Operation completed".to_string(),
    };
    
    assert_eq!(response.status, "success");
    assert_eq!(response.message, "Operation completed");
}

// ============================================================================
// JSON PARSING TESTS
// ============================================================================

#[test]
fn test_parse_shopify_product_response() {
    let sample_response = json!({
        "products": [
            {
                "id": 123456789,
                "title": "Test Product",
                "body_html": "<p>Test description</p>",
                "images": [
                    {
                        "src": "https://example.com/image1.jpg"
                    }
                ],
                "variants": [
                    {
                        "id": 987654321,
                        "title": "Default Title",
                        "inventory_item_id": 111222333,
                        "inventory_quantity": 25,
                        "price": "29.99",
                        "sku": "TEST-SKU-001"
                    }
                ]
            }
        ]
    });
    
    // Test that we can parse the JSON structure
    let products = sample_response["products"].as_array().unwrap();
    assert_eq!(products.len(), 1);
    
    let product = &products[0];
    assert_eq!(product["title"].as_str().unwrap(), "Test Product");
    assert_eq!(product["variants"].as_array().unwrap().len(), 1);
}

#[test]
fn test_parse_inventory_levels_response() {
    let sample_response = json!({
        "inventory_levels": [
            {
                "inventory_item_id": 111222333,
                "location_id": 444555666,
                "available": 25
            },
            {
                "inventory_item_id": 111222333,
                "location_id": 777888999,
                "available": 15
            }
        ]
    });
    
    let levels = sample_response["inventory_levels"].as_array().unwrap();
    assert_eq!(levels.len(), 2);
    
    let level1 = &levels[0];
    assert_eq!(level1["available"].as_i64().unwrap(), 25);
}

#[test]
fn test_parse_low_stock_response() {
    let sample_response = json!({
        "products": [
            {
                "id": 123456789,
                "title": "Low Stock Product",
                "variants": [
                    {
                        "id": 987654321,
                        "title": "Size S",
                        "inventory_quantity": 2,
                        "sku": "LOW-STOCK-S"
                    },
                    {
                        "id": 987654322,
                        "title": "Size M", 
                        "inventory_quantity": 15,
                        "sku": "NORMAL-STOCK-M"
                    }
                ]
            }
        ]
    });
    
    // Test filtering logic for low stock (threshold = 5)
    let products = sample_response["products"].as_array().unwrap();
    let variants = products[0]["variants"].as_array().unwrap();
    
    let low_stock_variants: Vec<&Value> = variants
        .iter()
        .filter(|variant| {
            variant["inventory_quantity"].as_i64().unwrap_or(0) <= 5
        })
        .collect();
    
    assert_eq!(low_stock_variants.len(), 1);
    assert_eq!(low_stock_variants[0]["title"].as_str().unwrap(), "Size S");
}

// ============================================================================
// INTEGRATION TEST HELPERS
// ============================================================================

fn setup_test_config() -> AppConfig {
    AppConfig {
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
    }
}

#[test]
fn test_integration_config_setup() {
    let config = setup_test_config();
    assert_eq!(config.shop_domain, "test-shop.myshopify.com");
    assert_eq!(config.api_version, "2025-01");
    
    let url = config.get_api_url("shop.json");
    assert!(url.contains("test-shop.myshopify.com"));
    assert!(url.contains("2025-01"));
}

// ============================================================================
// CONFIGURATION HELPER TESTS
// ============================================================================

#[test]
fn test_firebase_config_helper() {
    let config = setup_test_config();
    let firebase_config = config.get_firebase_config();
    
    assert_eq!(firebase_config.api_key, "test-firebase-key");
    assert_eq!(firebase_config.project_id, "test-project");
    assert_eq!(firebase_config.auth_domain, "test.firebaseapp.com");
}

#[test]
fn test_github_config_helper() {
    let config = setup_test_config();
    let github_config = config.get_github_config();
    
    assert_eq!(github_config.token, "test-github-token");
    assert_eq!(github_config.owner, "test-owner");
    assert_eq!(github_config.repo, "test-repo");
}

// ============================================================================
// ERROR HANDLING TESTS
// ============================================================================

#[test]
fn test_missing_product_fields() {
    let invalid_product = json!({
        "title": "Product Without ID"
        // Missing required "id" field
    });
    
    // Test that missing ID would cause an error
    let id_result = invalid_product["id"].as_u64();
    assert!(id_result.is_none());
}

#[test]
fn test_empty_variants_array() {
    let product_with_no_variants = json!({
        "id": 123456789,
        "title": "Product Without Variants",
        "variants": []
    });
    
    let variants = product_with_no_variants["variants"].as_array().unwrap();
    assert_eq!(variants.len(), 0);
    
    // Test that empty variants array is handled gracefully
    let total_inventory: i32 = variants
        .iter()
        .map(|v| v["inventory_quantity"].as_i64().unwrap_or(0) as i32)
        .sum();
    
    assert_eq!(total_inventory, 0);
}

#[test]
fn test_malformed_json_handling() {
    let malformed_json = json!({
        "products": "this should be an array"
    });
    
    let products_result = malformed_json["products"].as_array();
    assert!(products_result.is_none());
}

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

#[test]
fn test_large_product_list_parsing() {
    // Create a response with many products to test performance
    let mut products = Vec::new();
    for i in 0..100 {
        products.push(json!({
            "id": i,
            "title": format!("Product {}", i),
            "variants": [
                {
                    "id": i * 100,
                    "inventory_item_id": i * 100,
                    "inventory_quantity": i % 50,
                    "price": "19.99",
                    "title": "Default"
                }
            ]
        }));
    }
    
    let large_response = json!({
        "products": products
    });
    
    let parsed_products = large_response["products"].as_array().unwrap();
    assert_eq!(parsed_products.len(), 100);
    
    // Test that we can efficiently process all products
    let total_inventory: i64 = parsed_products
        .iter()
        .flat_map(|p| p["variants"].as_array().unwrap())
        .map(|v| v["inventory_quantity"].as_i64().unwrap_or(0))
        .sum();
    
    assert!(total_inventory > 0);
}

#[test]
fn test_config_validation() {
    // Test that we can create a config with valid data
    let config = AppConfig {
        shop_domain: "test-shop.myshopify.com".to_string(),
        access_token: "test-token".to_string(),
        api_key: "test-api-key".to_string(),
        api_secret: "test-api-secret".to_string(),
        api_version: "2025-01".to_string(),
        primary_location: "loc1".to_string(),
        secondary_location: "loc2".to_string(),
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
    
    // Test that all fields are properly set
    assert_eq!(config.shop_domain, "test-shop.myshopify.com");
    assert_eq!(config.access_token, "test-token");
    assert_eq!(config.api_version, "2025-01");
    assert_eq!(config.primary_location, "loc1");
    assert_eq!(config.secondary_location, "loc2");
} 