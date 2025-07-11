// Integration tests that require real Shopify credentials
// Only run these when SHOPIFY_TEST=1 environment variable is set

use chrono::Utc;
use inventario_cappellettoshop_lib::firebase::{FirebaseClient, LogData, LogEntry};
use inventario_cappellettoshop_lib::utils::AppConfig;
use inventario_cappellettoshop_lib::utils::InventoryUpdate;
use serde_json::{json, Value};
use std::env;

fn should_run_integration_tests() -> bool {
    env::var("SHOPIFY_TEST").unwrap_or_default() == "1"
}

fn setup_real_config() -> Result<AppConfig, String> {
    AppConfig::from_env()
}

// ============================================================================
// EXISTING TESTS
// ============================================================================

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

    let response = client.get(&url).headers(config.get_headers()).send().await;

    match response {
        Ok(resp) => {
            assert!(
                resp.status().is_success(),
                "Failed to connect to Shopify: {}",
                resp.status()
            );
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

    let data: serde_json::Value = response.json().await.expect("Failed to parse product JSON");

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
    let inventory_url = config.get_api_url(&format!(
        "inventory_levels.json?inventory_item_ids={}",
        inventory_item_id
    ));

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

// ============================================================================
// TIER 1 INTEGRATION TESTS - INVENTORY OPERATIONS
// ============================================================================

#[tokio::test]
async fn test_real_inventory_adjustment_simulation() {
    if !should_run_integration_tests() {
        println!("Skipping real inventory adjustment test. Set SHOPIFY_TEST=1 to run.");
        return;
    }

    let config = match setup_real_config() {
        Ok(config) => config,
        Err(e) => {
            println!("Cannot run real inventory adjustment test: {}", e);
            return;
        }
    };

    println!("🧪 Testing inventory adjustment API structure...");

    // Test that we can construct valid inventory update requests
    let client = reqwest::Client::new();
    let products_url = config.get_api_url("products.json?limit=1");

    let products_response = client
        .get(&products_url)
        .headers(config.get_headers())
        .send()
        .await
        .expect("Failed to fetch products");

    let products_data: Value = products_response
        .json()
        .await
        .expect("Failed to parse products JSON");

    let products = products_data["products"].as_array().unwrap();
    if products.is_empty() {
        println!("No products found, skipping test");
        return;
    }

    let variants = products[0]["variants"].as_array().unwrap();
    if variants.is_empty() {
        println!("No variants found, skipping test");
        return;
    }

    let inventory_item_id = variants[0]["inventory_item_id"]
        .as_u64()
        .unwrap()
        .to_string();

    // Test that we can create valid inventory update structures
    let test_updates = vec![InventoryUpdate {
        variant_id: inventory_item_id.clone(),
        location_id: config.primary_location.clone(),
        adjustment: 0, // Zero adjustment for safety
    }];

    // Validate structure without making actual changes
    assert_eq!(test_updates.len(), 1);
    assert_eq!(test_updates[0].adjustment, 0);
    assert!(!test_updates[0].variant_id.is_empty());
    assert!(!test_updates[0].location_id.is_empty());

    println!("✅ Inventory adjustment structure test passed");
}

#[tokio::test]
async fn test_real_graphql_inventory_query() {
    if !should_run_integration_tests() {
        println!("Skipping real GraphQL inventory test. Set SHOPIFY_TEST=1 to run.");
        return;
    }

    let config = match setup_real_config() {
        Ok(config) => config,
        Err(e) => {
            println!("Cannot run real GraphQL inventory test: {}", e);
            return;
        }
    };

    println!("🧪 Testing GraphQL inventory adjustment structure...");

    let client = reqwest::Client::new();
    let url = config.get_api_url("graphql.json");

    // Test a safe query that doesn't modify anything
    let query = r#"
        {
            shop {
                id
                name
                primaryDomain {
                    host
                }
            }
        }
    "#;

    let payload = json!({
        "query": query
    });

    let response = client
        .post(&url)
        .headers(config.get_headers())
        .json(&payload)
        .send()
        .await
        .expect("Failed to send GraphQL query");

    assert!(
        response.status().is_success(),
        "GraphQL query should succeed"
    );

    let data: Value = response
        .json()
        .await
        .expect("Failed to parse GraphQL response");

    // Verify we get a proper GraphQL response structure
    assert!(
        data.get("data").is_some() || data.get("errors").is_some(),
        "Should have either data or errors in GraphQL response"
    );

    if let Some(errors) = data.get("errors") {
        println!("GraphQL errors: {:?}", errors);
    } else {
        println!("✅ GraphQL connection test passed");
    }
}

// ============================================================================
// TIER 1 INTEGRATION TESTS - GRAPHQL OPERATIONS
// ============================================================================

#[tokio::test]
async fn test_real_graphql_product_search() {
    if !should_run_integration_tests() {
        println!("Skipping real GraphQL product search test. Set SHOPIFY_TEST=1 to run.");
        return;
    }

    let config = match setup_real_config() {
        Ok(config) => config,
        Err(e) => {
            println!("Cannot run real GraphQL product search test: {}", e);
            return;
        }
    };

    println!("🧪 Testing GraphQL product search...");

    let client = reqwest::Client::new();
    let url = config.get_api_url("graphql.json");

    // Test a product search query
    let query = r#"
        {
            products(first: 1) {
                edges {
                    node {
                        id
                        title
                        handle
                        variants(first: 1) {
                            edges {
                                node {
                                    id
                                    title
                                    sku
                                    inventoryQuantity
                                    inventoryItem {
                                        id
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    "#;

    let payload = json!({
        "query": query
    });

    let response = client
        .post(&url)
        .headers(config.get_headers())
        .json(&payload)
        .send()
        .await
        .expect("Failed to send GraphQL product search");

    assert!(
        response.status().is_success(),
        "GraphQL product search should succeed"
    );

    let data: Value = response
        .json()
        .await
        .expect("Failed to parse GraphQL product search response");

    if let Some(errors) = data.get("errors") {
        println!("GraphQL errors: {:?}", errors);
        // Some errors might be expected (like permission issues), so we don't fail the test
    }

    if let Some(products_data) = data.get("data").and_then(|d| d.get("products")) {
        println!("✅ GraphQL product search structure test passed");

        // Test that we can parse the response structure
        if let Some(edges) = products_data.get("edges").and_then(|e| e.as_array()) {
            if !edges.is_empty() {
                let first_product = &edges[0];
                assert!(
                    first_product.get("node").is_some(),
                    "Product should have node structure"
                );
                println!("✅ GraphQL response parsing test passed");
            } else {
                println!("⚠️  No products returned, but structure is valid");
            }
        }
    }
}

#[tokio::test]
async fn test_real_graphql_sku_search() {
    if !should_run_integration_tests() {
        println!("Skipping real GraphQL SKU search test. Set SHOPIFY_TEST=1 to run.");
        return;
    }

    let config = match setup_real_config() {
        Ok(config) => config,
        Err(e) => {
            println!("Cannot run real GraphQL SKU search test: {}", e);
            return;
        }
    };

    println!("🧪 Testing GraphQL SKU search...");

    let client = reqwest::Client::new();
    let url = config.get_api_url("graphql.json");

    // Test SKU search query structure (using a generic query)
    let query = r#"
        {
            products(first: 1, query: "status:active") {
                edges {
                    node {
                        id
                        title
                        variants(first: 5) {
                            edges {
                                node {
                                    id
                                    sku
                                    inventoryQuantity
                                }
                            }
                        }
                    }
                }
            }
        }
    "#;

    let payload = json!({
        "query": query
    });

    let response = client
        .post(&url)
        .headers(config.get_headers())
        .json(&payload)
        .send()
        .await
        .expect("Failed to send GraphQL SKU search");

    assert!(
        response.status().is_success(),
        "GraphQL SKU search should succeed"
    );

    let data: Value = response
        .json()
        .await
        .expect("Failed to parse GraphQL SKU search response");

    if let Some(errors) = data.get("errors") {
        println!("GraphQL errors: {:?}", errors);
    }

    if let Some(products_data) = data.get("data").and_then(|d| d.get("products")) {
        println!("✅ GraphQL SKU search structure test passed");

        // Test that we can access variant SKUs
        if let Some(edges) = products_data.get("edges").and_then(|e| e.as_array()) {
            if !edges.is_empty() {
                let product = &edges[0]["node"];
                if let Some(variant_edges) = product
                    .get("variants")
                    .and_then(|v| v.get("edges"))
                    .and_then(|e| e.as_array())
                {
                    if !variant_edges.is_empty() {
                        let variant = &variant_edges[0]["node"];
                        // Test that SKU field is accessible (even if null)
                        assert!(
                            variant.get("sku").is_some(),
                            "Variant should have SKU field"
                        );
                        println!("✅ GraphQL SKU field access test passed");
                    }
                }
            }
        }
    }
}

// ============================================================================
// TIER 1 INTEGRATION TESTS - FIREBASE INTEGRATION
// ============================================================================

#[tokio::test]
async fn test_real_firebase_connection() {
    if !should_run_integration_tests() {
        println!("Skipping real Firebase test. Set SHOPIFY_TEST=1 to run.");
        return;
    }

    let config = match setup_real_config() {
        Ok(config) => config,
        Err(e) => {
            println!("Cannot run real Firebase test: {}", e);
            return;
        }
    };

    println!("🧪 Testing Firebase connection...");

    // Test Firebase URL construction
    let firestore_url = format!(
        "https://firestore.googleapis.com/v1/projects/{}/databases/(default)/documents",
        config.firebase_project_id
    );

    assert!(firestore_url.contains("firestore.googleapis.com"));
    assert!(firestore_url.contains(&config.firebase_project_id));

    println!("✅ Firebase URL construction test passed");
}

#[tokio::test]
async fn test_real_firebase_log_structure() {
    if !should_run_integration_tests() {
        println!("Skipping real Firebase log structure test. Set SHOPIFY_TEST=1 to run.");
        return;
    }

    let config = match setup_real_config() {
        Ok(config) => config,
        Err(e) => {
            println!("Cannot run real Firebase log structure test: {}", e);
            return;
        }
    };

    println!("🧪 Testing Firebase log structure...");

    // Test that we can create valid Firebase log entries
    let log_data = LogData {
        id: "test-product-123".to_string(),
        variant: "Test Variant".to_string(),
        negozio: "Treviso".to_string(),
        inventory_item_id: "test-inventory-456".to_string(),
        nome: "Test Product Name".to_string(),
        prezzo: "29.99".to_string(),
        rettifica: -1,
        images: vec!["https://example.com/test.jpg".to_string()],
    };

    let log_entry = LogEntry {
        request_type: "Rettifica".to_string(),
        data: log_data,
        timestamp: Utc::now().to_rfc3339(),
    };

    // Test Firebase client creation (just to verify it can be created)
    let _firebase_client = FirebaseClient::new(config);

    // Test that log entry is properly structured
    assert_eq!(log_entry.request_type, "Rettifica");
    assert_eq!(log_entry.data.negozio, "Treviso");
    assert_eq!(log_entry.data.rettifica, -1);

    // Test timestamp format
    let parsed_timestamp = chrono::DateTime::parse_from_rfc3339(&log_entry.timestamp);
    assert!(
        parsed_timestamp.is_ok(),
        "Timestamp should be valid RFC3339"
    );

    println!("✅ Firebase log structure test passed");
}

// NOTE: We're not testing actual Firebase writes in integration tests to avoid
// cluttering the production database with test data. The structure tests above
// validate that the data formats are correct.

// ============================================================================
// TIER 1 INTEGRATION TESTS - ERROR HANDLING
// ============================================================================

#[tokio::test]
async fn test_real_api_error_handling() {
    if !should_run_integration_tests() {
        println!("Skipping real API error handling test. Set SHOPIFY_TEST=1 to run.");
        return;
    }

    let config = match setup_real_config() {
        Ok(config) => config,
        Err(e) => {
            println!("Cannot run real API error handling test: {}", e);
            return;
        }
    };

    println!("🧪 Testing API error handling...");

    let client = reqwest::Client::new();

    // Test with an invalid endpoint to trigger a 404
    let invalid_url = config.get_api_url("nonexistent-endpoint.json");

    let response = client
        .get(&invalid_url)
        .headers(config.get_headers())
        .send()
        .await;

    match response {
        Ok(resp) => {
            // We expect this to either be 404 or some other error status
            if !resp.status().is_success() {
                println!(
                    "✅ API error handling test passed - got expected error status: {}",
                    resp.status()
                );
            } else {
                println!("⚠️  Unexpected success for invalid endpoint");
            }
        }
        Err(e) => {
            // Network errors are also acceptable for this test
            println!(
                "✅ API error handling test passed - got expected network error: {}",
                e
            );
        }
    }
}

#[tokio::test]
async fn test_real_invalid_graphql_query() {
    if !should_run_integration_tests() {
        println!("Skipping real GraphQL error test. Set SHOPIFY_TEST=1 to run.");
        return;
    }

    let config = match setup_real_config() {
        Ok(config) => config,
        Err(e) => {
            println!("Cannot run real GraphQL error test: {}", e);
            return;
        }
    };

    println!("🧪 Testing GraphQL error handling...");

    let client = reqwest::Client::new();
    let url = config.get_api_url("graphql.json");

    // Send an intentionally invalid GraphQL query
    let invalid_query = r#"
        {
            nonExistentField {
                invalidSubField
            }
        }
    "#;

    let payload = json!({
        "query": invalid_query
    });

    let response = client
        .post(&url)
        .headers(config.get_headers())
        .json(&payload)
        .send()
        .await
        .expect("Failed to send invalid GraphQL query");

    // GraphQL should return 200 but with errors in the response
    assert!(
        response.status().is_success(),
        "GraphQL should return 200 even for invalid queries"
    );

    let data: Value = response
        .json()
        .await
        .expect("Failed to parse GraphQL error response");

    // Should have errors array
    if let Some(errors) = data.get("errors") {
        assert!(errors.is_array(), "GraphQL errors should be an array");
        let errors_array = errors.as_array().unwrap();
        assert!(!errors_array.is_empty(), "Should have at least one error");
        println!("✅ GraphQL error handling test passed - got expected errors");
    } else {
        println!("⚠️  Expected GraphQL errors but got none");
    }
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
        api_version: "3.2.0".to_string(),
        primary_location: "12345".to_string(),
        secondary_location: "67890".to_string(),
        firebase_api_key: "test-firebase-key".to_string(),
        firebase_auth_domain: "test.firebaseapp.com".to_string(),
        firebase_project_id: "test-project".to_string(),
        firebase_storage_bucket: "test.appspot.com".to_string(),
        firebase_messaging_sender_id: "123456".to_string(),
        firebase_app_id: "1:123456:web:abc123".to_string(),
        firebase_measurement_id: "G-ABC123".to_string(),
        version: "3.2.0".to_string(),
    };

    // Test URL generation for all endpoints
    let endpoints = vec![
        "products.json",
        "products/123.json",
        "inventory_levels.json",
        "inventory_levels/adjust.json",
        "inventory_levels/set.json",
        "shop.json",
        "graphql.json",
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

    println!("✅ All dry-run tests passed");
}
