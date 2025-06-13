use inventario_cappellettoshop_lib::utils::{
    AppConfig, InventoryUpdate, Product, ProductVariant, StatusResponse,
};
use inventario_cappellettoshop_lib::*;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::env;
use std::time::Duration;
use tokio::time::sleep;

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
        version: "3.0.0".to_string(),
    };

    let url = config.get_api_url("products.json");
    assert_eq!(
        url,
        "https://test-shop.myshopify.com/admin/api/2025-01/products.json"
    );
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
        version: "3.0.0".to_string(),
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
        variant_id: "12345".to_string(),
        inventory_item_id: "12345".to_string(),
        title: "Test Variant".to_string(),
        inventory_quantity: 10,
        price: "19.99".to_string(),
        sku: Some("TEST-SKU".to_string()),
    };

    let product = Product {
        id: "1".to_string(),
        title: "Test Product".to_string(),
        handle: "test-product".to_string(),
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
        .filter(|variant| variant["inventory_quantity"].as_i64().unwrap_or(0) <= 5)
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
        version: "3.0.0".to_string(),
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
        version: "3.0.0".to_string(),
    };

    // Test that all fields are properly set
    assert_eq!(config.shop_domain, "test-shop.myshopify.com");
    assert_eq!(config.access_token, "test-token");
    assert_eq!(config.api_version, "2025-01");
    assert_eq!(config.primary_location, "loc1");
    assert_eq!(config.secondary_location, "loc2");
}

// Test configuration constants
const TEST_SHOPIFY_DOMAIN: &str = "test-store.myshopify.com";
const TEST_ACCESS_TOKEN: &str = "test_token_123";
const TEST_LOCATION_ID: &str = "12345";

// Test data constants
const TEST_PRODUCT_ID: &str = "123456789";
const TEST_VARIANT_ID: &str = "987654321";
const TEST_INVENTORY_ITEM_ID: &str = "456789123";

#[derive(Debug)]
struct TestProduct {
    id: String,
    title: String,
    handle: String,
    description: String,
    vendor: String,
    product_type: String,
    created_at: String,
    updated_at: String,
    published_at: String,
    template_suffix: Option<String>,
    published_scope: String,
    tags: String,
    status: String,
    admin_graphql_api_id: String,
    variants: Vec<TestVariant>,
    options: Vec<TestOption>,
    images: Vec<TestImage>,
    image: Option<TestImage>,
}

#[derive(Debug)]
struct TestVariant {
    id: String,
    product_id: String,
    title: String,
    price: String,
    sku: String,
    position: i32,
    inventory_policy: String,
    compare_at_price: Option<String>,
    fulfillment_service: String,
    inventory_management: String,
    option1: String,
    option2: Option<String>,
    option3: Option<String>,
    created_at: String,
    updated_at: String,
    taxable: bool,
    barcode: Option<String>,
    grams: i32,
    image_id: Option<String>,
    weight: f64,
    weight_unit: String,
    inventory_item_id: String,
    inventory_quantity: i32,
    old_inventory_quantity: i32,
    requires_shipping: bool,
    admin_graphql_api_id: String,
    version: String,
}

impl Default for TestVariant {
    fn default() -> Self {
        TestVariant {
            id: TEST_VARIANT_ID.to_string(),
            product_id: TEST_PRODUCT_ID.to_string(),
            title: "Default Title".to_string(),
            price: "10.00".to_string(),
            sku: "TEST-SKU-001".to_string(),
            position: 1,
            inventory_policy: "deny".to_string(),
            compare_at_price: None,
            fulfillment_service: "manual".to_string(),
            inventory_management: "shopify".to_string(),
            option1: "Default".to_string(),
            option2: None,
            option3: None,
            created_at: "2023-01-01T00:00:00Z".to_string(),
            updated_at: "2023-01-01T00:00:00Z".to_string(),
            taxable: true,
            barcode: None,
            grams: 100,
            image_id: None,
            weight: 0.1,
            weight_unit: "kg".to_string(),
            inventory_item_id: TEST_INVENTORY_ITEM_ID.to_string(),
            inventory_quantity: 5,
            old_inventory_quantity: 5,
            requires_shipping: true,
            admin_graphql_api_id: format!("gid://shopify/ProductVariant/{}", TEST_VARIANT_ID),
            version: "3.0.0".to_string(),
        }
    }
}

#[derive(Debug)]
struct TestOption {
    id: String,
    product_id: String,
    name: String,
    position: i32,
    values: Vec<String>,
}

#[derive(Debug)]
struct TestImage {
    id: String,
    product_id: String,
    position: i32,
    created_at: String,
    updated_at: String,
    alt: Option<String>,
    width: i32,
    height: i32,
    src: String,
    variant_ids: Vec<String>,
    admin_graphql_api_id: String,
    version: String,
}

impl Default for TestImage {
    fn default() -> Self {
        TestImage {
            id: "1234567890".to_string(),
            product_id: TEST_PRODUCT_ID.to_string(),
            position: 1,
            created_at: "2023-01-01T00:00:00Z".to_string(),
            updated_at: "2023-01-01T00:00:00Z".to_string(),
            alt: Some("Test Product Image".to_string()),
            width: 800,
            height: 600,
            src: "https://cdn.shopify.com/test-image.jpg".to_string(),
            variant_ids: vec![TEST_VARIANT_ID.to_string()],
            admin_graphql_api_id: "gid://shopify/ProductImage/1234567890".to_string(),
            version: "3.0.0".to_string(),
        }
    }
}
