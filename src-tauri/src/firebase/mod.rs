use crate::utils::{AppConfig, StatusResponse};
use chrono::DateTime;
use chrono::Utc;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::HashMap;

// ============================================================================
// DATA STRUCTURES FOR FIREBASE LOGGING
// ============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LogData {
    pub id: String,
    pub variant: String,
    pub negozio: String,
    pub inventory_item_id: String,
    pub nome: String,
    pub prezzo: String,
    pub rettifica: i32,
    pub images: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LogEntry {
    #[serde(rename = "requestType")]
    pub request_type: String,
    pub data: LogData,
    pub timestamp: String, // ISO string format for compatibility with old system
}

#[derive(Debug, Serialize, Deserialize)]
struct FirestoreDocument {
    pub fields: HashMap<String, FirestoreValue>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(untagged)]
enum FirestoreValue {
    StringValue { string_value: String },
    IntegerValue { integer_value: String },
    ArrayValue { array_value: ArrayValues },
    MapValue { map_value: MapValues },
}

#[derive(Debug, Serialize, Deserialize)]
struct ArrayValues {
    values: Vec<FirestoreValue>,
}

#[derive(Debug, Serialize, Deserialize)]
struct MapValues {
    fields: HashMap<String, FirestoreValue>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProductModificationHistory {
    pub product_id: String,
    pub location: String,
    pub date_range: DateRange,
    pub variants: Vec<VariantModificationHistory>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VariantModificationHistory {
    pub variant_title: String,
    pub inventory_item_id: String,
    pub app_net_change: i32, // Total net change from app in period
    pub current_quantity: i32,
    pub daily_modifications: Vec<DailyModificationGroup>, // Daily breakdown
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DailyModificationGroup {
    pub date: String,                         // YYYY-MM-DD format for grouping
    pub app_net_change: i32,                  // Net change from app for this date
    pub app_details: Vec<ModificationDetail>, // Individual app modifications
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModificationDetail {
    pub timestamp: String,
    pub source: String, // "app" or "shopify"
    pub change: i32,
    pub reason: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DateRange {
    pub start_date: String,
    pub end_date: String,
    pub days_back: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CheckRequest {
    pub check_all: bool,
    pub checked: bool,
    pub checked_at: Option<String>,
    pub checked_by: Option<String>,
    pub location: Vec<String>,
    pub notes: String,
    pub priority: String,
    pub product_id: i64,
    pub product_name: String,
    pub requested_by: String,
    pub status: String,
    pub timestamp: String,
    pub variant_id: Option<i64>,
    pub variant_name: Option<String>,
    pub image_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CheckRequestWithId {
    pub id: String, // Document ID from Firebase
    pub check_all: bool,
    pub checked: bool,
    pub checked_at: Option<String>,
    pub checked_by: Option<String>,
    pub location: Vec<String>,
    pub notes: String,
    pub priority: String,
    pub product_id: i64,
    pub product_name: String,
    pub requested_by: String,
    pub status: String,
    pub timestamp: String,
    pub variant_id: Option<i64>,
    pub variant_name: Option<String>,
    pub closing_notes: Option<String>,
    pub image_url: Option<String>,
}

// ============================================================================
// FIREBASE CLIENT IMPLEMENTATION
// ============================================================================

pub struct FirebaseClient {
    client: Client,
    config: AppConfig,
    firestore_url: String,
}

impl FirebaseClient {
    pub fn new(config: AppConfig) -> Self {
        let firestore_url = format!(
            "https://firestore.googleapis.com/v1/projects/{}/databases/(default)/documents",
            config.firebase_project_id
        );

        Self {
            client: Client::new(),
            config,
            firestore_url,
        }
    }

    /// Create a new log entry in Firestore
    pub async fn create_log(&self, log_entry: LogEntry) -> Result<StatusResponse, String> {
        println!("🔥 Attempting to create Firebase log...");
        println!("   📝 Request Type: {}", log_entry.request_type);
        println!("   🏪 Store: {}", log_entry.data.negozio);
        println!("   📦 Product: {}", log_entry.data.nome);

        let collection_url = format!("{}/logs", self.firestore_url);
        println!("   🌐 Firebase URL: {}", collection_url);

        // Convert LogEntry to Firestore document format
        let firestore_doc = self.log_entry_to_firestore_doc(&log_entry)?;

        let response = self
            .client
            .post(&collection_url)
            .header("Content-Type", "application/json")
            .query(&[("key", &self.config.firebase_api_key)])
            .json(&firestore_doc)
            .send()
            .await
            .map_err(|e| {
                println!("❌ Firebase request failed: {}", e);
                format!("Failed to send request to Firestore: {}", e)
            })?;

        println!("   📡 Firebase response status: {}", response.status());

        if response.status().is_success() {
            // Parse the response to get the document ID
            let response_data: serde_json::Value = response
                .json()
                .await
                .map_err(|e| format!("Failed to parse Firestore response: {}", e))?;

            // Extract document ID from the response
            let document_id = if let Some(name) = response_data["name"].as_str() {
                // Extract ID from path like "projects/PROJECT_ID/databases/(default)/documents/logs/DOCUMENT_ID"
                name.split('/').last().unwrap_or("unknown").to_string()
            } else {
                "unknown".to_string()
            };

            println!("✅ Firebase log created successfully!");
            println!("   📄 Document ID: {}", document_id);

            Ok(StatusResponse {
                status: "success".to_string(),
                message: format!("Log entry created successfully with ID: {}", document_id),
            })
        } else {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            println!("❌ Firebase error: {}", error_text);
            Err(format!("Firestore error: {}", error_text))
        }
    }

    /// Get logs from Firestore with filtering
    pub async fn get_logs(
        &self,
        query_param: Option<String>,
        negozio: String,
    ) -> Result<Vec<LogEntry>, String> {
        println!("🔍 Getting logs from Firestore for location: {}", negozio);
        println!("📝 Query parameter: {:?}", query_param);

        // Get the current date in the user's local timezone (like ShopifyReact does)
        // ShopifyReact uses: new Date().toISOString().split("T")[0]
        let now = chrono::Local::now();
        let today = now.format("%Y-%m-%d").to_string();

        // Create the upper bound with Unicode character (same as ShopifyReact)
        // Note: We need to be careful with Unicode serialization
        let today_upper = format!("{}￿", today); // Using the actual Unicode character instead of escape

        println!(
            "📅 Filtering for today: {} (upper bound: {})",
            today, today_upper
        );
        println!("📅 Using local timezone date instead of UTC");

        // Use the runQuery endpoint with proper timestamp filtering
        let url = format!("{}:runQuery", self.firestore_url);

        println!("🌐 Firestore query URL: {}", url);

        // Create the query with proper Unicode handling
        let query_body = serde_json::json!({
            "structuredQuery": {
                "from": [{"collectionId": "logs"}],
                "where": {
                    "compositeFilter": {
                        "op": "AND",
                        "filters": [
                            {
                                "fieldFilter": {
                                    "field": {"fieldPath": "timestamp"},
                                    "op": "GREATER_THAN_OR_EQUAL",
                                    "value": {"stringValue": today}
                                }
                            },
                            {
                                "fieldFilter": {
                                    "field": {"fieldPath": "timestamp"},
                                    "op": "LESS_THAN",
                                    "value": {"stringValue": today_upper}
                                }
                            },
                            {
                                "fieldFilter": {
                                    "field": {"fieldPath": "data.negozio"},
                                    "op": "EQUAL",
                                    "value": {"stringValue": negozio}
                                }
                            }
                        ]
                    }
                },
                "orderBy": [
                    {
                        "field": {"fieldPath": "timestamp"},
                        "direction": "DESCENDING"
                    }
                ],
                "limit": 100
            }
        });

        println!(
            "📋 Query body with timestamp filtering: {}",
            serde_json::to_string_pretty(&query_body)
                .unwrap_or_else(|_| "Unable to serialize".to_string())
        );

        let response = self
            .client
            .post(&url)
            .header("Content-Type", "application/json")
            .query(&[("key", &self.config.firebase_api_key)])
            .json(&query_body)
            .send()
            .await
            .map_err(|e| format!("Failed to get logs from Firestore: {}", e))?;

        println!("📡 Firebase response status: {}", response.status());

        if response.status().is_success() {
            let firestore_response: serde_json::Value = response
                .json()
                .await
                .map_err(|e| format!("Failed to parse Firestore response: {}", e))?;

            println!(
                "📋 Raw Firestore response structure: {}",
                serde_json::to_string_pretty(&firestore_response)
                    .unwrap_or_else(|_| "Unable to serialize".to_string())
            );

            // Parse logs with the fixed parsing method
            let all_logs =
                self.parse_firestore_runquery_response(firestore_response, &query_param)?;
            println!(
                "✅ Found {} logs for location {} within date range",
                all_logs.len(),
                negozio
            );

            // Print some sample logs for debugging
            if !all_logs.is_empty() {
                println!("📊 Sample log timestamps:");
                for (i, log) in all_logs.iter().take(5).enumerate() {
                    println!(
                        "  {}. {} - {} - {}",
                        i + 1,
                        log.timestamp,
                        log.data.negozio,
                        log.data.nome
                    );
                }
            } else {
                println!("ℹ️ No logs found for today ({})", today);
                println!("🔍 This could mean:");
                println!("   - No inventory operations happened today");
                println!("   - Logs have different timestamp format");
                println!("   - Index might not support this query combination");
            }

            Ok(all_logs)
        } else {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            println!("❌ Firebase error response: {}", error_text);
            Err(format!("Failed to get logs: {}", error_text))
        }
    }

    /// Get logs from Firestore with date range filtering (for statistics)
    pub async fn get_logs_date_range(
        &self,
        query_param: Option<String>,
        negozio: String,
        start_date: String,
        end_date: String,
    ) -> Result<Vec<LogEntry>, String> {
        println!(
            "🔍 Getting logs from Firestore for location: {} with date range: {} to {}",
            negozio, start_date, end_date
        );
        println!("📝 Query parameter: {:?}", query_param);

        // Create the upper bound with Unicode character for end date
        let end_date_upper = format!("{}￿", end_date);

        println!(
            "📅 Filtering from: {} to: {} (upper bound: {})",
            start_date, end_date, end_date_upper
        );

        // Use the runQuery endpoint with proper timestamp filtering
        let url = format!("{}:runQuery", self.firestore_url);

        println!("🌐 Firestore query URL: {}", url);

        // Create the query with date range filtering
        let query_body = serde_json::json!({
            "structuredQuery": {
                "from": [{"collectionId": "logs"}],
                "where": {
                    "compositeFilter": {
                        "op": "AND",
                        "filters": [
                            {
                                "fieldFilter": {
                                    "field": {"fieldPath": "timestamp"},
                                    "op": "GREATER_THAN_OR_EQUAL",
                                    "value": {"stringValue": start_date}
                                }
                            },
                            {
                                "fieldFilter": {
                                    "field": {"fieldPath": "timestamp"},
                                    "op": "LESS_THAN",
                                    "value": {"stringValue": end_date_upper}
                                }
                            },
                            {
                                "fieldFilter": {
                                    "field": {"fieldPath": "data.negozio"},
                                    "op": "EQUAL",
                                    "value": {"stringValue": negozio}
                                }
                            }
                        ]
                    }
                },
                "orderBy": [
                    {
                        "field": {"fieldPath": "timestamp"},
                        "direction": "DESCENDING"
                    }
                ],
                "limit": 500
            }
        });

        println!(
            "📋 Query body with date range filtering: {}",
            serde_json::to_string_pretty(&query_body)
                .unwrap_or_else(|_| "Unable to serialize".to_string())
        );

        let response = self
            .client
            .post(&url)
            .header("Content-Type", "application/json")
            .query(&[("key", &self.config.firebase_api_key)])
            .json(&query_body)
            .send()
            .await
            .map_err(|e| format!("Failed to get logs from Firestore: {}", e))?;

        println!("📡 Firebase response status: {}", response.status());

        if response.status().is_success() {
            let firestore_response: serde_json::Value = response
                .json()
                .await
                .map_err(|e| format!("Failed to parse Firestore response: {}", e))?;

            // Parse logs with the existing parsing method
            let all_logs =
                self.parse_firestore_runquery_response(firestore_response, &query_param)?;
            println!(
                "✅ Found {} logs for location {} within date range {} to {}",
                all_logs.len(),
                negozio,
                start_date,
                end_date
            );

            Ok(all_logs)
        } else {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            println!("❌ Firebase error response: {}", error_text);
            Err(format!("Failed to get logs: {}", error_text))
        }
    }

    /// Convert LogEntry to Firestore document format
    fn log_entry_to_firestore_doc(
        &self,
        log_entry: &LogEntry,
    ) -> Result<FirestoreDocument, String> {
        let mut fields = HashMap::new();

        // Add requestType
        fields.insert(
            "requestType".to_string(),
            FirestoreValue::StringValue {
                string_value: log_entry.request_type.clone(),
            },
        );

        // Add timestamp
        fields.insert(
            "timestamp".to_string(),
            FirestoreValue::StringValue {
                string_value: log_entry.timestamp.clone(),
            },
        );

        // Add data object as separate nested fields (not as JSON string)
        let mut data_fields = HashMap::new();

        // Add individual data fields
        data_fields.insert(
            "id".to_string(),
            FirestoreValue::StringValue {
                string_value: log_entry.data.id.clone(),
            },
        );

        data_fields.insert(
            "variant".to_string(),
            FirestoreValue::StringValue {
                string_value: log_entry.data.variant.clone(),
            },
        );

        data_fields.insert(
            "negozio".to_string(),
            FirestoreValue::StringValue {
                string_value: log_entry.data.negozio.clone(),
            },
        );

        data_fields.insert(
            "inventory_item_id".to_string(),
            FirestoreValue::StringValue {
                string_value: log_entry.data.inventory_item_id.clone(),
            },
        );

        data_fields.insert(
            "nome".to_string(),
            FirestoreValue::StringValue {
                string_value: log_entry.data.nome.clone(),
            },
        );

        data_fields.insert(
            "prezzo".to_string(),
            FirestoreValue::StringValue {
                string_value: log_entry.data.prezzo.clone(),
            },
        );

        data_fields.insert(
            "rettifica".to_string(),
            FirestoreValue::IntegerValue {
                integer_value: log_entry.data.rettifica.to_string(),
            },
        );

        // Convert images array to Firestore array format
        let image_values: Vec<FirestoreValue> = log_entry
            .data
            .images
            .iter()
            .map(|img| FirestoreValue::StringValue {
                string_value: img.clone(),
            })
            .collect();

        data_fields.insert(
            "images".to_string(),
            FirestoreValue::ArrayValue {
                array_value: ArrayValues {
                    values: image_values,
                },
            },
        );

        // Create the data map field
        fields.insert(
            "data".to_string(),
            FirestoreValue::MapValue {
                map_value: MapValues {
                    fields: data_fields,
                },
            },
        );

        Ok(FirestoreDocument { fields })
    }

    /// Convert CheckRequest to Firestore document format
    fn check_request_to_firestore_doc(
        &self,
        check_request: &CheckRequest,
    ) -> Result<FirestoreDocument, String> {
        let mut fields = HashMap::new();

        // Add all the fields from the CheckRequest struct
        fields.insert(
            "check_all".to_string(),
            FirestoreValue::StringValue {
                string_value: check_request.check_all.to_string(),
            },
        );

        fields.insert(
            "checked".to_string(),
            FirestoreValue::StringValue {
                string_value: check_request.checked.to_string(),
            },
        );

        if let Some(checked_at) = &check_request.checked_at {
            fields.insert(
                "checked_at".to_string(),
                FirestoreValue::StringValue {
                    string_value: checked_at.clone(),
                },
            );
        }

        if let Some(checked_by) = &check_request.checked_by {
            fields.insert(
                "checked_by".to_string(),
                FirestoreValue::StringValue {
                    string_value: checked_by.clone(),
                },
            );
        }

        // Convert location array to Firestore array format
        let location_values: Vec<FirestoreValue> = check_request
            .location
            .iter()
            .map(|loc| FirestoreValue::StringValue {
                string_value: loc.clone(),
            })
            .collect();

        fields.insert(
            "location".to_string(),
            FirestoreValue::ArrayValue {
                array_value: ArrayValues {
                    values: location_values,
                },
            },
        );

        fields.insert(
            "notes".to_string(),
            FirestoreValue::StringValue {
                string_value: check_request.notes.clone(),
            },
        );

        fields.insert(
            "priority".to_string(),
            FirestoreValue::StringValue {
                string_value: check_request.priority.clone(),
            },
        );

        fields.insert(
            "product_id".to_string(),
            FirestoreValue::IntegerValue {
                integer_value: check_request.product_id.to_string(),
            },
        );

        fields.insert(
            "product_name".to_string(),
            FirestoreValue::StringValue {
                string_value: check_request.product_name.clone(),
            },
        );

        fields.insert(
            "requested_by".to_string(),
            FirestoreValue::StringValue {
                string_value: check_request.requested_by.clone(),
            },
        );

        fields.insert(
            "status".to_string(),
            FirestoreValue::StringValue {
                string_value: check_request.status.clone(),
            },
        );

        fields.insert(
            "timestamp".to_string(),
            FirestoreValue::StringValue {
                string_value: check_request.timestamp.clone(),
            },
        );

        if let Some(variant_id) = check_request.variant_id {
            fields.insert(
                "variant_id".to_string(),
                FirestoreValue::IntegerValue {
                    integer_value: variant_id.to_string(),
                },
            );
        }

        if let Some(variant_name) = &check_request.variant_name {
            fields.insert(
                "variant_name".to_string(),
                FirestoreValue::StringValue {
                    string_value: variant_name.clone(),
                },
            );
        }

        if let Some(image_url) = &check_request.image_url {
            fields.insert(
                "image_url".to_string(),
                FirestoreValue::StringValue {
                    string_value: image_url.clone(),
                },
            );
        }

        Ok(FirestoreDocument { fields })
    }

    /// Parse Firestore runQuery response to LogEntry vector (for structured queries)
    fn parse_firestore_runquery_response(
        &self,
        response: serde_json::Value,
        query_param: &Option<String>,
    ) -> Result<Vec<LogEntry>, String> {
        // The runQuery response is an array where each item has a "document" field
        let response_array = response.as_array().ok_or("Response is not an array")?;

        println!(
            "📊 Found {} items in Firestore runQuery response",
            response_array.len()
        );

        let mut logs = Vec::new();

        for item in response_array {
            // Each item in runQuery response has a "document" field
            if let Some(document) = item.get("document") {
                if let Ok(log_entry) = self.parse_firestore_document(document) {
                    // Apply client-side filtering by product name (same as ShopifyReact)
                    if let Some(query) = query_param {
                        if !log_entry
                            .data
                            .nome
                            .to_lowercase()
                            .contains(&query.to_lowercase())
                        {
                            continue;
                        }
                    }

                    logs.push(log_entry);
                }
            }
        }

        println!("✅ Successfully parsed {} logs after filtering", logs.len());

        // Note: Firestore query already handles sorting, but ensure consistency
        logs.sort_by(|a, b| {
            // Try to parse as RFC3339 first, then fallback to string comparison
            match (
                DateTime::parse_from_rfc3339(&a.timestamp),
                DateTime::parse_from_rfc3339(&b.timestamp),
            ) {
                (Ok(a_time), Ok(b_time)) => b_time.cmp(&a_time), // Descending order
                _ => b.timestamp.cmp(&a.timestamp),              // Fallback to string comparison
            }
        });

        Ok(logs)
    }

    /// Parse a single Firestore document to LogEntry
    fn parse_firestore_document(&self, doc: &serde_json::Value) -> Result<LogEntry, String> {
        let fields = doc["fields"]
            .as_object()
            .ok_or("Invalid document format: missing fields")?;

        let request_type = fields
            .get("requestType")
            .and_then(|v| v["stringValue"].as_str())
            .ok_or("Missing requestType")?
            .to_string();

        let timestamp = fields
            .get("timestamp")
            .and_then(|v| v["stringValue"].as_str())
            .ok_or("Missing timestamp")?
            .to_string();

        // Parse the data map field instead of a JSON string
        let data_map = fields
            .get("data")
            .and_then(|v| v["mapValue"]["fields"].as_object())
            .ok_or("Missing data map")?;

        // Extract individual data fields from the map
        let id = data_map
            .get("id")
            .and_then(|v| v["stringValue"].as_str())
            .ok_or("Missing data.id")?
            .to_string();

        let variant = data_map
            .get("variant")
            .and_then(|v| v["stringValue"].as_str())
            .ok_or("Missing data.variant")?
            .to_string();

        let negozio = data_map
            .get("negozio")
            .and_then(|v| v["stringValue"].as_str())
            .ok_or("Missing data.negozio")?
            .to_string();

        let inventory_item_id = data_map
            .get("inventory_item_id")
            .and_then(|v| {
                // Handle both stringValue and integerValue formats
                v["stringValue"]
                    .as_str()
                    .or_else(|| v["integerValue"].as_str())
            })
            .ok_or("Missing data.inventory_item_id")?
            .to_string();

        let nome = data_map
            .get("nome")
            .and_then(|v| v["stringValue"].as_str())
            .ok_or("Missing data.nome")?
            .to_string();

        let prezzo = data_map
            .get("prezzo")
            .and_then(|v| v["stringValue"].as_str())
            .ok_or("Missing data.prezzo")?
            .to_string();

        let rettifica = data_map
            .get("rettifica")
            .and_then(|v| v["integerValue"].as_str())
            .and_then(|s| s.parse::<i32>().ok())
            .ok_or("Missing or invalid data.rettifica")?;

        // Parse images array
        let images = data_map
            .get("images")
            .and_then(|v| v["arrayValue"]["values"].as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|img| img["stringValue"].as_str())
                    .map(|s| s.to_string())
                    .collect::<Vec<String>>()
            })
            .unwrap_or_default();

        let data = LogData {
            id,
            variant,
            negozio,
            inventory_item_id,
            nome,
            prezzo,
            rettifica,
            images,
        };

        Ok(LogEntry {
            request_type,
            data,
            timestamp,
        })
    }

    /// Get logs for a specific product ID within a date range
    pub async fn get_logs_by_product_id(
        &self,
        product_id: String,
        location: String,
        start_date: String,
        end_date: String,
    ) -> Result<Vec<LogEntry>, String> {
        println!("🔍 Fetching Firebase logs for product ID: {}", product_id);
        println!("   📅 Date range: {} to {}", start_date, end_date);
        println!("   🏪 Location: {}", location);

        // Create the upper bound with Unicode character for end date
        let end_date_upper = format!("{}￿", end_date);

        // Use the runQuery endpoint with proper timestamp filtering (same pattern as get_logs_date_range)
        let url = format!("{}:runQuery", self.firestore_url);

        println!("🌐 Firestore query URL: {}", url);

        // Build the structured query to filter by product ID, location, and date range
        let query_body = serde_json::json!({
            "structuredQuery": {
                "from": [{"collectionId": "logs"}],
                "where": {
                    "compositeFilter": {
                        "op": "AND",
                        "filters": [
                            {
                                "fieldFilter": {
                                    "field": {"fieldPath": "data.id"},
                                    "op": "EQUAL",
                                    "value": {"stringValue": product_id}
                                }
                            },
                            {
                                "fieldFilter": {
                                    "field": {"fieldPath": "data.negozio"},
                                    "op": "EQUAL",
                                    "value": {"stringValue": location}
                                }
                            },
                            {
                                "fieldFilter": {
                                    "field": {"fieldPath": "timestamp"},
                                    "op": "GREATER_THAN_OR_EQUAL",
                                    "value": {"stringValue": start_date}
                                }
                            },
                            {
                                "fieldFilter": {
                                    "field": {"fieldPath": "timestamp"},
                                    "op": "LESS_THAN",
                                    "value": {"stringValue": end_date_upper}
                                }
                            }
                        ]
                    }
                },
                "orderBy": [
                    {
                        "field": {"fieldPath": "timestamp"},
                        "direction": "DESCENDING"
                    }
                ],
                "limit": 100
            }
        });

        println!(
            "📋 Query body for product {}: {}",
            product_id,
            serde_json::to_string_pretty(&query_body)
                .unwrap_or_else(|_| "Unable to serialize".to_string())
        );

        let response = self
            .client
            .post(&url)
            .header("Content-Type", "application/json")
            .query(&[("key", &self.config.firebase_api_key)])
            .json(&query_body)
            .send()
            .await
            .map_err(|e| format!("Failed to get product logs from Firestore: {}", e))?;

        println!("📡 Firebase response status: {}", response.status());

        if response.status().is_success() {
            let firestore_response: serde_json::Value = response
                .json()
                .await
                .map_err(|e| format!("Failed to parse Firestore response: {}", e))?;

            // Parse logs using existing method
            let logs = self.parse_firestore_runquery_response(firestore_response, &None)?;

            println!(
                "✅ Found {} logs for product {} in location {} within date range",
                logs.len(),
                product_id,
                location
            );

            Ok(logs)
        } else {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            println!("❌ Firebase error response: {}", error_text);

            // Check if this is an index-related error
            if error_text.contains("index") || error_text.contains("FAILED_PRECONDITION") {
                Err(format!(
                    "Firebase index required for product modification history query. Please create a composite index in Firebase Console with fields: data.id (Ascending), data.negozio (Ascending), timestamp (Descending). Error: {}", 
                    error_text
                ))
            } else {
                Err(format!("Failed to get product logs: {}", error_text))
            }
        }
    }

    /// Create a check request document in Firestore
    pub async fn create_check_request(
        &self,
        check_request: CheckRequest,
    ) -> Result<StatusResponse, String> {
        println!("🔥 Creating check request in Firebase...");
        println!(
            "   📋 Product: {} (ID: {})",
            check_request.product_name, check_request.product_id
        );
        println!("   👤 Requested by: {}", check_request.requested_by);
        println!("   📍 Locations: {:?}", check_request.location);

        let collection_url = format!("{}/checks", self.firestore_url);
        println!("   🌐 Firebase URL: {}", collection_url);

        // Convert CheckRequest to Firestore document format
        let firestore_doc = self.check_request_to_firestore_doc(&check_request)?;

        let response = self
            .client
            .post(&collection_url)
            .header("Content-Type", "application/json")
            .query(&[("key", &self.config.firebase_api_key)])
            .json(&firestore_doc)
            .send()
            .await
            .map_err(|e| {
                println!("❌ Firebase request failed: {}", e);
                format!("Failed to send request to Firestore: {}", e)
            })?;

        println!("   📡 Firebase response status: {}", response.status());

        if response.status().is_success() {
            // Parse the response to get the document ID
            let response_data: serde_json::Value = response
                .json()
                .await
                .map_err(|e| format!("Failed to parse Firestore response: {}", e))?;

            // Extract document ID from the response
            let document_id = if let Some(name) = response_data["name"].as_str() {
                // Extract ID from path like "projects/PROJECT_ID/databases/(default)/documents/checks/DOCUMENT_ID"
                name.split('/').last().unwrap_or("unknown").to_string()
            } else {
                "unknown".to_string()
            };

            println!("✅ Check request created successfully!");
            println!("   📄 Document ID: {}", document_id);

            Ok(StatusResponse {
                status: "success".to_string(),
                message: format!(
                    "Check request created successfully with ID: {}",
                    document_id
                ),
            })
        } else {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            println!("❌ Firebase error: {}", error_text);
            Err(format!("Firestore error: {}", error_text))
        }
    }

    /// Get check requests from Firestore filtered by location
    pub async fn get_check_requests(
        &self,
        location: String,
    ) -> Result<Vec<CheckRequestWithId>, String> {
        println!(
            "🔥 Getting check requests from Firebase for location: {}",
            location
        );

        let query_url = format!("{}:runQuery", self.firestore_url);
        println!("   🌐 Firebase URL: {}", query_url);

        // Create a structured query to filter by location
        let query = json!({
            "structuredQuery": {
                "from": [{
                    "collectionId": "checks"
                }],
                "where": {
                    "fieldFilter": {
                        "field": {
                            "fieldPath": "location"
                        },
                        "op": "ARRAY_CONTAINS",
                        "value": {
                            "stringValue": location
                        }
                    }
                },
                "orderBy": [{
                    "field": {
                        "fieldPath": "timestamp"
                    },
                    "direction": "DESCENDING"
                }]
            }
        });

        let response = self
            .client
            .post(&query_url)
            .header("Content-Type", "application/json")
            .query(&[("key", &self.config.firebase_api_key)])
            .json(&query)
            .send()
            .await
            .map_err(|e| format!("Failed to send request to Firestore: {}", e))?;

        println!("   📡 Firebase response status: {}", response.status());

        if response.status().is_success() {
            let response_data: serde_json::Value = response
                .json()
                .await
                .map_err(|e| format!("Failed to parse Firestore response: {}", e))?;

            let check_requests = self.parse_firestore_check_requests_response(response_data)?;

            println!(
                "✅ Found {} check requests for location {}",
                check_requests.len(),
                location
            );

            Ok(check_requests)
        } else {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            println!("❌ Firebase error response: {}", error_text);
            Err(format!("Failed to get check requests: {}", error_text))
        }
    }

    /// Update a check request status and add closing notes
    pub async fn update_check_request(
        &self,
        document_id: String,
        status: String,
        closing_notes: String,
    ) -> Result<StatusResponse, String> {
        println!(
            "🔥 Updating check request {} to status: {}",
            document_id, status
        );

        let document_url = format!("{}/checks/{}", self.firestore_url, document_id);
        println!("   🌐 Firebase URL: {}", document_url);

        // Create update document with status and closing_notes fields
        let update_doc = json!({
            "fields": {
                "status": {
                    "stringValue": status
                },
                "closing_notes": {
                    "stringValue": closing_notes
                },
                "checked": {
                    "booleanValue": status == "completed"
                },
                "checked_at": {
                    "stringValue": Utc::now().to_rfc3339()
                }
            }
        });

        let response = self
            .client
            .patch(&document_url)
            .header("Content-Type", "application/json")
            .query(&[
                ("key", &self.config.firebase_api_key),
                ("updateMask.fieldPaths", &"status".to_string()),
                ("updateMask.fieldPaths", &"closing_notes".to_string()),
                ("updateMask.fieldPaths", &"checked".to_string()),
                ("updateMask.fieldPaths", &"checked_at".to_string()),
            ])
            .json(&update_doc)
            .send()
            .await
            .map_err(|e| format!("Failed to send request to Firestore: {}", e))?;

        println!("   📡 Firebase response status: {}", response.status());

        if response.status().is_success() {
            println!("✅ Check request updated successfully!");

            Ok(StatusResponse {
                status: "success".to_string(),
                message: format!("Check request {} updated to {}", document_id, status),
            })
        } else {
            let error_text = response
                .text()
                .await
                .unwrap_or_else(|_| "Unknown error".to_string());
            println!("❌ Firebase error: {}", error_text);
            Err(format!("Firestore error: {}", error_text))
        }
    }

    /// Parse check requests from Firestore runQuery response
    fn parse_firestore_check_requests_response(
        &self,
        response: serde_json::Value,
    ) -> Result<Vec<CheckRequestWithId>, String> {
        let mut check_requests = Vec::new();

        if let Some(documents) = response.as_array() {
            for document_result in documents {
                if let Some(document) = document_result.get("document") {
                    match self.parse_firestore_check_request_document(document) {
                        Ok(check_request) => check_requests.push(check_request),
                        Err(e) => {
                            println!("⚠️ Skipping invalid check request document: {}", e);
                        }
                    }
                }
            }
        }

        Ok(check_requests)
    }

    /// Parse a single check request document from Firestore
    fn parse_firestore_check_request_document(
        &self,
        doc: &serde_json::Value,
    ) -> Result<CheckRequestWithId, String> {
        let fields = doc["fields"].as_object().ok_or("Document missing fields")?;

        // Extract document ID from name path
        let document_id = if let Some(name) = doc["name"].as_str() {
            name.split('/').last().unwrap_or("unknown").to_string()
        } else {
            "unknown".to_string()
        };

        // Helper function to extract string value
        let get_string_field = |field_name: &str| -> Result<String, String> {
            fields
                .get(field_name)
                .and_then(|f| f.get("stringValue"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .ok_or_else(|| format!("Missing or invalid {} field", field_name))
        };

        // Helper function to extract optional string value
        let get_optional_string_field = |field_name: &str| -> Option<String> {
            fields
                .get(field_name)
                .and_then(|f| f.get("stringValue"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        };

        // Helper function to extract integer value
        let get_integer_field = |field_name: &str| -> Result<i64, String> {
            fields
                .get(field_name)
                .and_then(|f| f.get("integerValue"))
                .and_then(|v| v.as_str())
                .and_then(|s| s.parse::<i64>().ok())
                .ok_or_else(|| format!("Missing or invalid {} field", field_name))
        };

        // Helper function to extract optional integer value
        let get_optional_integer_field = |field_name: &str| -> Option<i64> {
            fields
                .get(field_name)
                .and_then(|f| f.get("integerValue"))
                .and_then(|v| v.as_str())
                .and_then(|s| s.parse::<i64>().ok())
        };

        // Helper function to extract boolean value
        let get_boolean_field = |field_name: &str| -> bool {
            fields
                .get(field_name)
                .and_then(|f| f.get("booleanValue"))
                .and_then(|v| v.as_bool())
                .unwrap_or(false)
        };

        // Helper function to extract array of strings (for location)
        let get_string_array_field = |field_name: &str| -> Result<Vec<String>, String> {
            let array_value = fields
                .get(field_name)
                .and_then(|f| f.get("arrayValue"))
                .and_then(|av| av.get("values"))
                .and_then(|v| v.as_array())
                .ok_or_else(|| format!("Missing or invalid {} array field", field_name))?;

            let mut result = Vec::new();
            for value in array_value {
                if let Some(string_val) = value.get("stringValue").and_then(|v| v.as_str()) {
                    result.push(string_val.to_string());
                }
            }

            if result.is_empty() {
                return Err(format!("{} array is empty", field_name));
            }

            Ok(result)
        };

        let check_request = CheckRequestWithId {
            id: document_id,
            check_all: get_boolean_field("check_all"),
            checked: get_boolean_field("checked"),
            checked_at: get_optional_string_field("checked_at"),
            checked_by: get_optional_string_field("checked_by"),
            location: get_string_array_field("location")?,
            notes: get_string_field("notes").unwrap_or_default(),
            priority: get_string_field("priority")?,
            product_id: get_integer_field("product_id")?,
            product_name: get_string_field("product_name")?,
            requested_by: get_string_field("requested_by")?,
            status: get_string_field("status")?,
            timestamp: get_string_field("timestamp")?,
            variant_id: get_optional_integer_field("variant_id"),
            variant_name: get_optional_string_field("variant_name"),
            closing_notes: get_optional_string_field("closing_notes"),
            image_url: get_optional_string_field("image_url"),
        };

        Ok(check_request)
    }
}

// ============================================================================
// TAURI COMMANDS FOR FIREBASE
// ============================================================================

#[tauri::command]
pub async fn create_log(
    request_type: String,
    data: LogData,
    config: tauri::State<'_, AppConfig>,
) -> Result<StatusResponse, String> {
    let firebase_client = FirebaseClient::new(config.inner().clone());

    let log_entry = LogEntry {
        request_type,
        data,
        timestamp: Utc::now().to_rfc3339(),
    };

    firebase_client.create_log(log_entry).await
}

#[tauri::command]
pub async fn get_logs(
    query: Option<String>,
    location: String,
    config: tauri::State<'_, AppConfig>,
) -> Result<Vec<LogEntry>, String> {
    let firebase_client = FirebaseClient::new(config.inner().clone());
    firebase_client.get_logs(query, location).await
}

#[tauri::command]
pub async fn get_logs_date_range(
    query: Option<String>,
    location: String,
    start_date: String,
    end_date: String,
    config: tauri::State<'_, AppConfig>,
) -> Result<Vec<LogEntry>, String> {
    let firebase_client = FirebaseClient::new(config.inner().clone());
    firebase_client
        .get_logs_date_range(query, location, start_date, end_date)
        .await
}

#[tauri::command]
pub async fn get_firebase_config(
    config: tauri::State<'_, AppConfig>,
) -> Result<crate::utils::FirebaseConfig, String> {
    Ok(config.get_firebase_config())
}

#[tauri::command]
pub async fn get_logs_by_product_id(
    product_id: String,
    location: String,
    start_date: String,
    end_date: String,
    config: tauri::State<'_, AppConfig>,
) -> Result<Vec<LogEntry>, String> {
    let firebase_client = FirebaseClient::new(config.inner().clone());
    firebase_client
        .get_logs_by_product_id(product_id, location, start_date, end_date)
        .await
}

#[tauri::command]
pub async fn create_check_request(
    check_request: CheckRequest,
    config: tauri::State<'_, AppConfig>,
) -> Result<StatusResponse, String> {
    let firebase_client = FirebaseClient::new(config.inner().clone());
    firebase_client.create_check_request(check_request).await
}

#[tauri::command]
pub async fn get_check_requests(
    location: String,
    config: tauri::State<'_, AppConfig>,
) -> Result<Vec<CheckRequestWithId>, String> {
    let firebase_client = FirebaseClient::new(config.inner().clone());
    firebase_client.get_check_requests(location).await
}

#[tauri::command]
pub async fn update_check_request(
    document_id: String,
    status: String,
    closing_notes: String,
    config: tauri::State<'_, AppConfig>,
) -> Result<StatusResponse, String> {
    let firebase_client = FirebaseClient::new(config.inner().clone());
    firebase_client
        .update_check_request(document_id, status, closing_notes)
        .await
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/// Create a log entry for inventory operations
pub fn create_inventory_log_data(
    product_id: String,
    variant_title: String,
    negozio: String,
    inventory_item_id: String,
    product_name: String,
    price: String,
    adjustment: i32,
    images: Vec<String>,
) -> LogData {
    LogData {
        id: product_id,
        variant: variant_title,
        negozio,
        inventory_item_id,
        nome: product_name,
        prezzo: price,
        rettifica: adjustment,
        images,
    }
}
