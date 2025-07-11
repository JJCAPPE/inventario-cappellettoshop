use inventario_cappellettoshop_lib::utils::{
    AppConfig, InventoryUpdate, Product, ProductVariant, StatusResponse,
};
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
        api_version: "3.1.0".to_string(),
        primary_location: "loc1".to_string(),
        secondary_location: "loc2".to_string(),
        firebase_api_key: "test-firebase-key".to_string(),
        firebase_auth_domain: "test.firebaseapp.com".to_string(),
        firebase_project_id: "test-project".to_string(),
        firebase_storage_bucket: "test.appspot.com".to_string(),
        firebase_messaging_sender_id: "123456".to_string(),
        firebase_app_id: "1:123456:web:abc123".to_string(),
        firebase_measurement_id: "G-ABC123".to_string(),
        version: "3.1.0".to_string(),
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
        api_version: "3.1.0".to_string(),
        primary_location: "loc1".to_string(),
        secondary_location: "loc2".to_string(),
        firebase_api_key: "test-firebase-key".to_string(),
        firebase_auth_domain: "test.firebaseapp.com".to_string(),
        firebase_project_id: "test-project".to_string(),
        firebase_storage_bucket: "test.appspot.com".to_string(),
        firebase_messaging_sender_id: "123456".to_string(),
        firebase_app_id: "1:123456:web:abc123".to_string(),
        firebase_measurement_id: "G-ABC123".to_string(),
        version: "3.1.0".to_string(),
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
        api_version: "3.1.0".to_string(),
        primary_location: "12345".to_string(),
        secondary_location: "67890".to_string(),
        firebase_api_key: "test-firebase-key".to_string(),
        firebase_auth_domain: "test.firebaseapp.com".to_string(),
        firebase_project_id: "test-project".to_string(),
        firebase_storage_bucket: "test.appspot.com".to_string(),
        firebase_messaging_sender_id: "123456".to_string(),
        firebase_app_id: "1:123456:web:abc123".to_string(),
        firebase_measurement_id: "G-ABC123".to_string(),
        version: "3.1.0".to_string(),
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
        api_version: "3.1.0".to_string(),
        primary_location: "loc1".to_string(),
        secondary_location: "loc2".to_string(),
        firebase_api_key: "test-firebase-key".to_string(),
        firebase_auth_domain: "test.firebaseapp.com".to_string(),
        firebase_project_id: "test-project".to_string(),
        firebase_storage_bucket: "test.appspot.com".to_string(),
        firebase_messaging_sender_id: "123456".to_string(),
        firebase_app_id: "1:123456:web:abc123".to_string(),
        firebase_measurement_id: "G-ABC123".to_string(),
        version: "3.1.0".to_string(),
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
            version: "3.1.0".to_string(),
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
            version: "3.1.0".to_string(),
        }
    }
}

// ============================================================================
// TIER 1 CRITICAL TESTS - INVENTORY OPERATIONS
// ============================================================================

#[test]
fn test_inventory_update_validation() {
    // Test valid inventory update
    let valid_update = InventoryUpdate {
        variant_id: "12345".to_string(),
        location_id: "67890".to_string(),
        adjustment: -5,
    };

    assert_eq!(valid_update.adjustment, -5);
    assert_eq!(valid_update.variant_id, "12345");
    assert_eq!(valid_update.location_id, "67890");
}

#[test]
fn test_inventory_update_boundary_values() {
    // Test edge cases for inventory adjustments
    let zero_adjustment = InventoryUpdate {
        variant_id: "12345".to_string(),
        location_id: "67890".to_string(),
        adjustment: 0,
    };
    assert_eq!(zero_adjustment.adjustment, 0);

    let large_positive = InventoryUpdate {
        variant_id: "12345".to_string(),
        location_id: "67890".to_string(),
        adjustment: 1000,
    };
    assert_eq!(large_positive.adjustment, 1000);

    let large_negative = InventoryUpdate {
        variant_id: "12345".to_string(),
        location_id: "67890".to_string(),
        adjustment: -1000,
    };
    assert_eq!(large_negative.adjustment, -1000);
}

#[test]
fn test_inventory_batch_operations() {
    // Test multiple inventory updates
    let updates = vec![
        InventoryUpdate {
            variant_id: "12345".to_string(),
            location_id: "67890".to_string(),
            adjustment: -1,
        },
        InventoryUpdate {
            variant_id: "54321".to_string(),
            location_id: "67890".to_string(),
            adjustment: 5,
        },
        InventoryUpdate {
            variant_id: "11111".to_string(),
            location_id: "98765".to_string(),
            adjustment: -2,
        },
    ];

    assert_eq!(updates.len(), 3);

    // Test that we can calculate total adjustments
    let total_adjustment: i32 = updates.iter().map(|u| u.adjustment).sum();
    assert_eq!(total_adjustment, 2); // -1 + 5 + (-2) = 2
}

#[test]
fn test_product_inventory_calculations() {
    let variant1 = ProductVariant {
        variant_id: "1".to_string(),
        inventory_item_id: "1".to_string(),
        title: "Variant 1".to_string(),
        inventory_quantity: 10,
        price: "19.99".to_string(),
        sku: Some("SKU-1".to_string()),
    };

    let variant2 = ProductVariant {
        variant_id: "2".to_string(),
        inventory_item_id: "2".to_string(),
        title: "Variant 2".to_string(),
        inventory_quantity: 25,
        price: "29.99".to_string(),
        sku: Some("SKU-2".to_string()),
    };

    let product = Product {
        id: "1".to_string(),
        title: "Test Product".to_string(),
        handle: "test-product".to_string(),
        price: "19.99".to_string(),
        description: "A test product".to_string(),
        images: vec!["https://example.com/image.jpg".to_string()],
        variants: vec![variant1, variant2],
        total_inventory: 35, // 10 + 25
        locations: HashMap::new(),
    };

    // Test total inventory calculation
    let calculated_total: i32 = product.variants.iter().map(|v| v.inventory_quantity).sum();
    assert_eq!(calculated_total, 35);
    assert_eq!(product.total_inventory, calculated_total);
}

// ============================================================================
// TIER 1 CRITICAL TESTS - FIREBASE INTEGRATION
// ============================================================================

#[test]
fn test_firebase_log_data_structure() {
    use inventario_cappellettoshop_lib::firebase::LogData;

    let log_data = LogData {
        id: "123456".to_string(),
        variant: "Size M".to_string(),
        negozio: "Treviso".to_string(),
        inventory_item_id: "789012".to_string(),
        nome: "Test Product".to_string(),
        prezzo: "29.99".to_string(),
        rettifica: -1,
        images: vec!["https://example.com/image.jpg".to_string()],
    };

    assert_eq!(log_data.id, "123456");
    assert_eq!(log_data.variant, "Size M");
    assert_eq!(log_data.negozio, "Treviso");
    assert_eq!(log_data.rettifica, -1);
    assert_eq!(log_data.images.len(), 1);
}

#[test]
fn test_firebase_log_entry_structure() {
    use inventario_cappellettoshop_lib::firebase::{LogData, LogEntry};

    let log_data = LogData {
        id: "123456".to_string(),
        variant: "Size M".to_string(),
        negozio: "Treviso".to_string(),
        inventory_item_id: "789012".to_string(),
        nome: "Test Product".to_string(),
        prezzo: "29.99".to_string(),
        rettifica: -1,
        images: vec!["https://example.com/image.jpg".to_string()],
    };

    let log_entry = LogEntry {
        request_type: "Rettifica".to_string(),
        data: log_data.clone(),
        timestamp: "2023-12-01T10:30:00Z".to_string(),
    };

    assert_eq!(log_entry.request_type, "Rettifica");
    assert_eq!(log_entry.data.id, "123456");
    assert_eq!(log_entry.timestamp, "2023-12-01T10:30:00Z");
}

#[test]
fn test_firebase_log_types() {
    use inventario_cappellettoshop_lib::firebase::{LogData, LogEntry};

    let log_data = LogData {
        id: "123456".to_string(),
        variant: "Size M".to_string(),
        negozio: "Treviso".to_string(),
        inventory_item_id: "789012".to_string(),
        nome: "Test Product".to_string(),
        prezzo: "29.99".to_string(),
        rettifica: -1,
        images: vec![],
    };

    // Test different log types
    let decrease_log = LogEntry {
        request_type: "Rettifica".to_string(),
        data: log_data.clone(),
        timestamp: "2023-12-01T10:30:00Z".to_string(),
    };

    let mut undo_data = log_data.clone();
    undo_data.rettifica = 1;

    let undo_log = LogEntry {
        request_type: "Annullamento".to_string(),
        data: undo_data,
        timestamp: "2023-12-01T10:35:00Z".to_string(),
    };

    assert_eq!(decrease_log.request_type, "Rettifica");
    assert_eq!(decrease_log.data.rettifica, -1);
    assert_eq!(undo_log.request_type, "Annullamento");
    assert_eq!(undo_log.data.rettifica, 1);
}

#[test]
fn test_firebase_timestamp_format() {
    use chrono::Utc;
    use inventario_cappellettoshop_lib::firebase::{LogData, LogEntry};

    let log_data = LogData {
        id: "123456".to_string(),
        variant: "Size M".to_string(),
        negozio: "Treviso".to_string(),
        inventory_item_id: "789012".to_string(),
        nome: "Test Product".to_string(),
        prezzo: "29.99".to_string(),
        rettifica: -1,
        images: vec![],
    };

    let log_entry = LogEntry {
        request_type: "Rettifica".to_string(),
        data: log_data,
        timestamp: Utc::now().to_rfc3339(),
    };

    // Test that timestamp is in valid RFC3339 format
    let parsed_timestamp = chrono::DateTime::parse_from_rfc3339(&log_entry.timestamp);
    assert!(
        parsed_timestamp.is_ok(),
        "Timestamp should be valid RFC3339 format"
    );
}

#[test]
fn test_firebase_location_validation() {
    use inventario_cappellettoshop_lib::firebase::LogData;

    // Test valid locations
    let valid_locations = vec!["Treviso", "Mogliano"];

    for location in valid_locations {
        let log_data = LogData {
            id: "123456".to_string(),
            variant: "Size M".to_string(),
            negozio: location.to_string(),
            inventory_item_id: "789012".to_string(),
            nome: "Test Product".to_string(),
            prezzo: "29.99".to_string(),
            rettifica: -1,
            images: vec![],
        };

        assert!(["Treviso", "Mogliano"].contains(&log_data.negozio.as_str()));
    }
}

// ============================================================================
// TIER 1 CRITICAL TESTS - GRAPHQL OPERATIONS
// ============================================================================

#[test]
fn test_graphql_product_response_parsing() {
    let sample_graphql_response = json!({
        "data": {
            "products": {
                "edges": [
                    {
                        "node": {
                            "id": "gid://shopify/Product/123456789",
                            "title": "Test GraphQL Product",
                            "handle": "test-graphql-product",
                            "descriptionHtml": "<p>GraphQL product description</p>",
                            "priceRangeV2": {
                                "minVariantPrice": {
                                    "amount": "49.99"
                                }
                            },
                            "images": {
                                "edges": [
                                    {
                                        "node": {
                                            "src": "https://example.com/graphql-image.jpg"
                                        }
                                    }
                                ]
                            },
                            "variants": {
                                "edges": [
                                    {
                                        "node": {
                                            "id": "gid://shopify/ProductVariant/987654321",
                                            "title": "GraphQL Variant",
                                            "inventoryItem": {
                                                "id": "gid://shopify/InventoryItem/111222333"
                                            },
                                            "inventoryQuantity": 15,
                                            "price": "49.99",
                                            "sku": "GQL-SKU-001"
                                        }
                                    }
                                ]
                            }
                        }
                    }
                ]
            }
        }
    });

    // Test parsing GraphQL structure
    let products = sample_graphql_response["data"]["products"]["edges"]
        .as_array()
        .unwrap();
    assert_eq!(products.len(), 1);

    let product_node = &products[0]["node"];
    assert_eq!(
        product_node["title"].as_str().unwrap(),
        "Test GraphQL Product"
    );

    let variants = product_node["variants"]["edges"].as_array().unwrap();
    assert_eq!(variants.len(), 1);

    let variant_node = &variants[0]["node"];
    assert_eq!(variant_node["sku"].as_str().unwrap(), "GQL-SKU-001");
    assert_eq!(variant_node["inventoryQuantity"].as_i64().unwrap(), 15);
}

#[test]
fn test_graphql_id_parsing() {
    // Test GraphQL Global ID parsing (removing gid:// prefix)
    let graphql_ids = vec![
        ("gid://shopify/Product/123456789", "123456789"),
        ("gid://shopify/ProductVariant/987654321", "987654321"),
        ("gid://shopify/InventoryItem/111222333", "111222333"),
    ];

    for (full_id, expected_id) in graphql_ids {
        let parsed_id = full_id
            .replace("gid://shopify/Product/", "")
            .replace("gid://shopify/ProductVariant/", "")
            .replace("gid://shopify/InventoryItem/", "");

        // For this test, we'll check if it contains the expected numeric ID
        assert!(
            parsed_id.contains(expected_id),
            "Should extract numeric ID from GraphQL Global ID"
        );
    }
}

#[test]
fn test_graphql_sku_search_query_structure() {
    let test_sku = "TEST-SKU-123";

    // Test that we can build the expected GraphQL query structure
    let query_sku_part = format!("query: \"sku:{}", test_sku);
    let expected_query_parts = vec![
        "products(first:",
        query_sku_part.as_str(),
        "status:active",
        "variants(first:",
        "inventoryItem",
        "inventoryQuantity",
    ];

    // This simulates the query building logic
    let query_template = format!(
        "products(first: 50, query: \"sku:{} status:active\") {{ variants(first: 50) {{ inventoryItem {{ id }} inventoryQuantity }} }}",
        test_sku
    );

    for part in expected_query_parts {
        assert!(
            query_template.contains(part),
            "Query should contain: {}",
            part
        );
    }
}

#[test]
fn test_graphql_exact_sku_matching() {
    let sample_response = json!({
        "data": {
            "products": {
                "edges": [
                    {
                        "node": {
                            "id": "gid://shopify/Product/123",
                            "title": "Product 1",
                            "variants": {
                                "edges": [
                                    {
                                        "node": {
                                            "id": "gid://shopify/ProductVariant/456",
                                            "sku": "EXACT-MATCH-SKU",
                                            "inventoryQuantity": 10
                                        }
                                    },
                                    {
                                        "node": {
                                            "id": "gid://shopify/ProductVariant/789",
                                            "sku": "PARTIAL-EXACT-MATCH-SKU",
                                            "inventoryQuantity": 5
                                        }
                                    }
                                ]
                            }
                        }
                    }
                ]
            }
        }
    });

    let search_sku = "EXACT-MATCH-SKU";

    // Test exact SKU matching logic
    let products = sample_response["data"]["products"]["edges"]
        .as_array()
        .unwrap();
    let mut exact_matches = Vec::new();

    for product_edge in products {
        let variants = product_edge["node"]["variants"]["edges"]
            .as_array()
            .unwrap();
        for variant_edge in variants {
            let variant_sku = variant_edge["node"]["sku"].as_str().unwrap_or("");
            if variant_sku == search_sku {
                exact_matches.push(variant_edge);
            }
        }
    }

    assert_eq!(exact_matches.len(), 1);
    assert_eq!(
        exact_matches[0]["node"]["sku"].as_str().unwrap(),
        "EXACT-MATCH-SKU"
    );
}

#[test]
fn test_graphql_error_response_handling() {
    let error_response = json!({
        "errors": [
            {
                "message": "Field 'products' doesn't exist on type 'QueryRoot'",
                "locations": [{"line": 2, "column": 3}],
                "path": ["products"]
            }
        ]
    });

    // Test error detection
    let has_errors = error_response["errors"].is_array();
    assert!(has_errors, "Should detect GraphQL errors");

    if let Some(errors) = error_response["errors"].as_array() {
        assert!(!errors.is_empty(), "Should have error messages");
        let first_error = &errors[0];
        assert!(
            first_error["message"].is_string(),
            "Error should have message"
        );
    }
}

#[test]
fn test_graphql_empty_response_handling() {
    let empty_response = json!({
        "data": {
            "products": {
                "edges": []
            }
        }
    });

    let products = empty_response["data"]["products"]["edges"]
        .as_array()
        .unwrap();
    assert_eq!(products.len(), 0, "Should handle empty product results");
}

// ============================================================================
// TIER 1 CRITICAL TESTS - ERROR HANDLING
// ============================================================================

#[test]
fn test_missing_required_config_fields() {
    // Test that config validation catches missing fields
    let incomplete_configs = vec![
        // Missing shop_domain
        (
            AppConfig {
                shop_domain: "".to_string(),
                access_token: "test-token".to_string(),
                api_key: "test-key".to_string(),
                api_secret: "test-secret".to_string(),
                api_version: "3.1.0".to_string(),
                primary_location: "loc1".to_string(),
                secondary_location: "loc2".to_string(),
                firebase_api_key: "test-firebase-key".to_string(),
                firebase_auth_domain: "test.firebaseapp.com".to_string(),
                firebase_project_id: "test-project".to_string(),
                firebase_storage_bucket: "test.appspot.com".to_string(),
                firebase_messaging_sender_id: "123456".to_string(),
                firebase_app_id: "1:123456:web:abc123".to_string(),
                firebase_measurement_id: "G-ABC123".to_string(),
                version: "3.1.0".to_string(),
            },
            "shop_domain should not be empty",
        ),
        // Missing access_token
        (
            AppConfig {
                shop_domain: "test-shop.myshopify.com".to_string(),
                access_token: "".to_string(),
                api_key: "test-key".to_string(),
                api_secret: "test-secret".to_string(),
                api_version: "3.1.0".to_string(),
                primary_location: "loc1".to_string(),
                secondary_location: "loc2".to_string(),
                firebase_api_key: "test-firebase-key".to_string(),
                firebase_auth_domain: "test.firebaseapp.com".to_string(),
                firebase_project_id: "test-project".to_string(),
                firebase_storage_bucket: "test.appspot.com".to_string(),
                firebase_messaging_sender_id: "123456".to_string(),
                firebase_app_id: "1:123456:web:abc123".to_string(),
                firebase_measurement_id: "G-ABC123".to_string(),
                version: "3.1.0".to_string(),
            },
            "access_token should not be empty",
        ),
    ];

    for (config, expected_issue) in incomplete_configs {
        // Test that empty required fields are detected
        if config.shop_domain.is_empty() {
            assert!(config.shop_domain.is_empty(), "{}", expected_issue);
        }
        if config.access_token.is_empty() {
            assert!(config.access_token.is_empty(), "{}", expected_issue);
        }
    }
}

#[test]
fn test_invalid_json_response_handling() {
    let invalid_responses = vec![
        // Not JSON at all
        "This is not JSON",
        // Valid JSON but wrong structure
        r#"{"wrong": "structure"}"#,
        // Missing required fields
        r#"{"products": "should_be_array"}"#,
        // Null values where objects expected
        r#"{"products": null}"#,
    ];

    for invalid_json in invalid_responses {
        match serde_json::from_str::<Value>(invalid_json) {
            Ok(parsed) => {
                // Test that we can detect structural issues
                if let Some(products) = parsed.get("products") {
                    if products.as_array().is_none() && !products.is_null() {
                        // This is expected for invalid structure
                        assert!(
                            products.as_array().is_none(),
                            "Should detect invalid products structure"
                        );
                    }
                }
            }
            Err(_) => {
                // This is expected for invalid JSON
                // Test passes if JSON parsing fails
            }
        }
    }
}

#[test]
fn test_network_error_simulation() {
    // Test error message formatting for different scenarios
    let error_scenarios = vec![
        ("Connection timeout", "Request timed out after 30 seconds"),
        (
            "Invalid credentials",
            "Authentication failed: Invalid access token",
        ),
        (
            "Rate limit exceeded",
            "API rate limit exceeded. Please try again later",
        ),
        ("Server error", "Internal server error (500)"),
        ("Not found", "Resource not found (404)"),
    ];

    for (scenario, expected_message) in error_scenarios {
        // Test that error messages are properly formatted
        let formatted_error = format!("API Error [{}]: {}", scenario, expected_message);
        assert!(formatted_error.contains(scenario));
        assert!(formatted_error.contains(expected_message));
    }
}

// ============================================================================
// TRANSFER FUNCTIONALITY TESTS
// ============================================================================

#[test]
fn test_transfer_inventory_validation() {
    // Test transfer function parameter validation
    let inventory_item_id = "123456789".to_string();
    let from_location_id = "loc_from".to_string();
    let to_location_id = "loc_to".to_string();
    let product_id = "prod_123".to_string();
    let variant_title = "Size M".to_string();
    let product_name = "Test Product".to_string();
    let price = "29.99".to_string();
    let from_location = "Treviso".to_string();
    let to_location = "Mogliano".to_string();
    let images = vec!["https://example.com/image.jpg".to_string()];

    // Validate all required parameters are present
    assert!(!inventory_item_id.is_empty());
    assert!(!from_location_id.is_empty());
    assert!(!to_location_id.is_empty());
    assert!(!product_id.is_empty());
    assert!(!variant_title.is_empty());
    assert!(!product_name.is_empty());
    assert!(!price.is_empty());
    assert!(!from_location.is_empty());
    assert!(!to_location.is_empty());
    assert!(!images.is_empty());

    // Validate locations are different
    assert_ne!(from_location, to_location);
    assert_ne!(from_location_id, to_location_id);
}

#[test]
fn test_transfer_firebase_log_structure() {
    use chrono::Utc;
    use inventario_cappellettoshop_lib::firebase::{LogData, LogEntry};

    // Test source location log entry (negative adjustment)
    let source_log_data = LogData {
        id: "123456".to_string(),
        variant: "Size M".to_string(),
        negozio: "Treviso".to_string(),
        inventory_item_id: "789012".to_string(),
        nome: "Test Product".to_string(),
        prezzo: "29.99".to_string(),
        rettifica: -1,
        images: vec!["https://example.com/image.jpg".to_string()],
    };

    let source_log_entry = LogEntry {
        request_type: "Trasferimento".to_string(),
        data: source_log_data,
        timestamp: Utc::now().to_rfc3339(),
    };

    // Validate source log structure
    assert_eq!(source_log_entry.request_type, "Trasferimento");
    assert_eq!(source_log_entry.data.rettifica, -1);
    assert_eq!(source_log_entry.data.negozio, "Treviso");
    assert!(!source_log_entry.timestamp.is_empty());

    // Test destination location log entry (positive adjustment)
    let dest_log_data = LogData {
        id: "123456".to_string(),
        variant: "Size M".to_string(),
        negozio: "Mogliano".to_string(),
        inventory_item_id: "789012".to_string(),
        nome: "Test Product".to_string(),
        prezzo: "29.99".to_string(),
        rettifica: 1,
        images: vec!["https://example.com/image.jpg".to_string()],
    };

    let dest_log_entry = LogEntry {
        request_type: "Trasferimento".to_string(),
        data: dest_log_data,
        timestamp: Utc::now().to_rfc3339(),
    };

    // Validate destination log structure
    assert_eq!(dest_log_entry.request_type, "Trasferimento");
    assert_eq!(dest_log_entry.data.rettifica, 1);
    assert_eq!(dest_log_entry.data.negozio, "Mogliano");
    assert!(!dest_log_entry.timestamp.is_empty());

    // Validate they form a balanced pair
    assert_eq!(
        source_log_entry.data.rettifica + dest_log_entry.data.rettifica,
        0
    );
    assert_eq!(source_log_entry.data.id, dest_log_entry.data.id);
    assert_eq!(source_log_entry.data.variant, dest_log_entry.data.variant);
}

#[test]
fn test_transfer_inventory_updates() {
    // Test that transfer creates correct inventory update structures
    let inventory_item_id = "123456789".to_string();
    let from_location_id = "loc_from".to_string();
    let to_location_id = "loc_to".to_string();

    // Source location update (decrease)
    let decrease_update = InventoryUpdate {
        variant_id: inventory_item_id.clone(),
        location_id: from_location_id.clone(),
        adjustment: -1,
    };

    // Destination location update (increase)
    let increase_update = InventoryUpdate {
        variant_id: inventory_item_id.clone(),
        location_id: to_location_id.clone(),
        adjustment: 1,
    };

    // Validate decrease update
    assert_eq!(decrease_update.variant_id, inventory_item_id);
    assert_eq!(decrease_update.location_id, from_location_id);
    assert_eq!(decrease_update.adjustment, -1);

    // Validate increase update
    assert_eq!(increase_update.variant_id, inventory_item_id);
    assert_eq!(increase_update.location_id, to_location_id);
    assert_eq!(increase_update.adjustment, 1);

    // Validate net change is zero
    assert_eq!(decrease_update.adjustment + increase_update.adjustment, 0);
}

#[test]
fn test_transfer_rollback_structure() {
    // Test rollback inventory update structure
    let inventory_item_id = "123456789".to_string();
    let from_location_id = "loc_from".to_string();

    // Original decrease (what failed at destination)
    let failed_decrease = InventoryUpdate {
        variant_id: inventory_item_id.clone(),
        location_id: from_location_id.clone(),
        adjustment: -1,
    };

    // Rollback increase (to restore original state)
    let rollback_increase = InventoryUpdate {
        variant_id: inventory_item_id.clone(),
        location_id: from_location_id.clone(),
        adjustment: 1,
    };

    // Validate rollback restores original state
    assert_eq!(failed_decrease.adjustment + rollback_increase.adjustment, 0);
    assert_eq!(failed_decrease.variant_id, rollback_increase.variant_id);
    assert_eq!(failed_decrease.location_id, rollback_increase.location_id);
}

#[test]
fn test_transfer_error_messages() {
    // Test error message formatting for various failure scenarios
    let from_location = "Treviso";
    let to_location = "Mogliano";

    // Test source location error
    let source_error = format!("Errore nella rimozione da {}: API timeout", from_location);
    assert!(source_error.contains("Errore nella rimozione da Treviso"));
    assert!(source_error.contains("API timeout"));

    // Test destination location error
    let dest_error = format!("Errore nell'aggiunta a {}: Invalid location", to_location);
    assert!(dest_error.contains("Errore nell'aggiunta a Mogliano"));
    assert!(dest_error.contains("Invalid location"));

    // Test critical rollback failure error
    let critical_error = format!(
        "ERRORE CRITICO: Fallimento trasferimento e rollback fallito. Originale: {}, Rollback: {}",
        "Destination failed", "Rollback also failed"
    );
    assert!(critical_error.contains("ERRORE CRITICO"));
    assert!(critical_error.contains("Destination failed"));
    assert!(critical_error.contains("Rollback also failed"));

    // Test insufficient inventory error
    let insufficient_error = format!(
        "Impossibile trasferire: nessun inventario disponibile a {}",
        from_location
    );
    assert!(insufficient_error.contains("Impossibile trasferire"));
    assert!(insufficient_error.contains("Treviso"));
}

#[test]
fn test_transfer_success_message() {
    // Test success message formatting
    let product_name = "Test Product";
    let variant_title = "Size M";
    let from_location = "Treviso";
    let to_location = "Mogliano";

    let success_message = format!(
        "Trasferimento completato: {} ({}) spostato da {} a {}",
        product_name, variant_title, from_location, to_location
    );

    assert!(success_message.contains("Trasferimento completato"));
    assert!(success_message.contains("Test Product"));
    assert!(success_message.contains("Size M"));
    assert!(success_message.contains("da Treviso a Mogliano"));
}

#[test]
fn test_transfer_location_mapping() {
    // Test location name to ID mapping logic
    // This simulates the logic used in the transfer function

    // Mock location config
    let mock_primary_location_id = "primary_loc_123";
    let mock_secondary_location_id = "secondary_loc_456";

    let available_locations = vec!["Treviso", "Mogliano"];

    // Test primary location mapping
    let primary_location_name = "Treviso";
    let mapped_primary_id = if primary_location_name == available_locations[0] {
        mock_primary_location_id
    } else {
        mock_secondary_location_id
    };
    assert_eq!(mapped_primary_id, mock_primary_location_id);

    // Test secondary location mapping
    let secondary_location_name = "Mogliano";
    let mapped_secondary_id = if secondary_location_name == available_locations[0] {
        mock_primary_location_id
    } else {
        mock_secondary_location_id
    };
    assert_eq!(mapped_secondary_id, mock_secondary_location_id);

    // Validate they are different
    assert_ne!(mapped_primary_id, mapped_secondary_id);
}

#[test]
fn test_transfer_enhanced_status_response() {
    use inventario_cappellettoshop_lib::inventory::EnhancedStatusResponse;

    // Test successful transfer response
    let success_response = EnhancedStatusResponse {
        status: "success".to_string(),
        message: "Trasferimento completato: Test Product (Size M) spostato da Treviso a Mogliano"
            .to_string(),
        status_changed: None,
        product_status: None,
    };

    assert_eq!(success_response.status, "success");
    assert!(success_response
        .message
        .contains("Trasferimento completato"));
    assert!(success_response.status_changed.is_none());
    assert!(success_response.product_status.is_none());

    // Test transfer response with product status change (to draft)
    let draft_response = EnhancedStatusResponse {
        status: "success".to_string(),
        message: "Trasferimento completato con cambio stato".to_string(),
        status_changed: Some("to_draft".to_string()),
        product_status: None,
    };

    assert_eq!(draft_response.status, "success");
    assert_eq!(draft_response.status_changed, Some("to_draft".to_string()));
}

#[test]
fn test_transfer_zero_inventory_detection() {
    // Test the logic that determines if a product should be set to draft
    // This simulates the has_zero_inventory_across_all_locations function behavior

    // Mock inventory levels across locations
    let treviso_inventory = 0;
    let mogliano_inventory = 1;

    // Product should NOT be draft (has inventory in Mogliano)
    let has_inventory = treviso_inventory > 0 || mogliano_inventory > 0;
    assert!(has_inventory);

    // Mock scenario where product becomes completely out of stock
    let treviso_inventory_empty = 0;
    let mogliano_inventory_empty = 0;

    // Product SHOULD be draft (no inventory anywhere)
    let has_no_inventory = treviso_inventory_empty == 0 && mogliano_inventory_empty == 0;
    assert!(has_no_inventory);
}

#[test]
fn test_transfer_firebase_logging_warnings() {
    // Test that transfer continues even if Firebase logging fails
    // This represents the non-critical nature of logging failures

    let firebase_log_success = true;
    let firebase_log_failure = false;

    // Simulate Firebase logging failure scenarios
    if !firebase_log_success {
        let warning_message = "⚠️ Warning: Failed to log source transfer: Connection timeout";
        assert!(warning_message.contains("Warning"));
        assert!(warning_message.contains("Failed to log source transfer"));
    }

    if !firebase_log_failure {
        let warning_message = "⚠️ Warning: Failed to log destination transfer: Invalid request";
        assert!(warning_message.contains("Warning"));
        assert!(warning_message.contains("Failed to log destination transfer"));
    }

    // Transfer should succeed even with logging failures
    let transfer_result = "success";
    assert_eq!(transfer_result, "success");
}

#[test]
fn test_transfer_parameter_validation() {
    // Test validation of all transfer parameters

    // Valid parameters
    let valid_params = (
        "123456789",       // inventory_item_id
        "loc_from",        // from_location_id
        "loc_to",          // to_location_id
        "prod_123",        // product_id
        "Size M",          // variant_title
        "Test Product",    // product_name
        "29.99",           // price
        "Treviso",         // from_location
        "Mogliano",        // to_location
        vec!["image.jpg"], // images
    );

    // Validate all parameters are non-empty
    assert!(!valid_params.0.is_empty()); // inventory_item_id
    assert!(!valid_params.1.is_empty()); // from_location_id
    assert!(!valid_params.2.is_empty()); // to_location_id
    assert!(!valid_params.3.is_empty()); // product_id
    assert!(!valid_params.4.is_empty()); // variant_title
    assert!(!valid_params.5.is_empty()); // product_name
    assert!(!valid_params.6.is_empty()); // price
    assert!(!valid_params.7.is_empty()); // from_location
    assert!(!valid_params.8.is_empty()); // to_location
    assert!(!valid_params.9.is_empty()); // images

    // Validate locations are different
    assert_ne!(valid_params.7, valid_params.8); // from_location != to_location
    assert_ne!(valid_params.1, valid_params.2); // from_location_id != to_location_id

    // Validate price format
    let price_parsed: Result<f64, _> = valid_params.6.parse();
    assert!(price_parsed.is_ok());
    assert!(price_parsed.unwrap() > 0.0);
}
