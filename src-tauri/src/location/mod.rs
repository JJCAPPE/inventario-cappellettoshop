use serde::{Deserialize, Serialize};
use tauri::Manager;
use crate::utils::{AppConfig, StatusResponse};
use std::fs;
use std::path::PathBuf;

// ============================================================================
// DATA STRUCTURES FOR LOCATION MANAGEMENT
// ============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LocationInfo {
    pub name: String,
    pub id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LocationConfig {
    pub primary_location: LocationInfo,
    pub secondary_location: LocationInfo,
}

#[derive(Debug, Serialize, Deserialize)]
struct LocationSetting {
    location: String,
}

// ============================================================================
// PREDEFINED LOCATIONS (matching old implementation)
// ============================================================================

pub const LOCATIONS: &[(&str, &str)] = &[
    ("Treviso", "3708157983"),
    ("Mogliano", "31985336425"),
];

// ============================================================================
// LOCATION MANAGEMENT FUNCTIONS
// ============================================================================

/// Get app data directory path for storing location settings
fn get_app_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("Could not get app data directory: {}", e))
}

/// Get the location file path
fn get_location_file_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = get_app_data_dir(app)?;
    Ok(app_data_dir.join("locationCappelletto.json"))
}

// ============================================================================
// TAURI COMMANDS FOR LOCATION MANAGEMENT
// ============================================================================

#[tauri::command]
pub async fn get_app_location(app: tauri::AppHandle) -> Result<String, String> {
    let location_file = get_location_file_path(&app)?;
    
    if location_file.exists() {
        let content = fs::read_to_string(&location_file)
            .map_err(|e| format!("Failed to read location file: {}", e))?;
        
        let location_setting: LocationSetting = serde_json::from_str(&content)
            .map_err(|e| format!("Failed to parse location file: {}", e))?;
        
        Ok(location_setting.location)
    } else {
        Err("Location not set".to_string())
    }
}

#[tauri::command]
pub async fn set_app_location(location: String, app: tauri::AppHandle) -> Result<StatusResponse, String> {
    let app_data_dir = get_app_data_dir(&app)?;
    
    // Create app data directory if it doesn't exist
    fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data directory: {}", e))?;
    
    let location_file = get_location_file_path(&app)?;
    let location_setting = LocationSetting { location };
    
    let json_content = serde_json::to_string_pretty(&location_setting)
        .map_err(|e| format!("Failed to serialize location setting: {}", e))?;
    
    fs::write(&location_file, json_content)
        .map_err(|e| format!("Failed to write location file: {}", e))?;
    
    Ok(StatusResponse {
        status: "success".to_string(),
        message: "Location set successfully".to_string(),
    })
}

#[tauri::command]
pub async fn get_available_locations() -> Result<Vec<LocationInfo>, String> {
    Ok(LOCATIONS
        .iter()
        .map(|(name, id)| LocationInfo {
            name: name.to_string(),
            id: id.to_string(),
        })
        .collect())
}

#[tauri::command]
pub async fn get_location_by_name(location_name: String) -> Result<LocationInfo, String> {
    LOCATIONS
        .iter()
        .find(|(name, _)| *name == location_name)
        .map(|(name, id)| LocationInfo {
            name: name.to_string(),
            id: id.to_string(),
        })
        .ok_or_else(|| format!("Location '{}' not found", location_name))
}

#[tauri::command]
pub async fn get_current_location_config(
    app: tauri::AppHandle,
    config: tauri::State<'_, AppConfig>,
) -> Result<LocationConfig, String> {
    // Get the currently set location
    let current_location = get_app_location(app).await.unwrap_or("Treviso".to_string());
    
    // Determine primary and secondary locations
    let (primary, secondary) = if current_location == "Treviso" {
        (
            LocationInfo {
                name: "Treviso".to_string(),
                id: config.primary_location.clone(),
            },
            LocationInfo {
                name: "Mogliano".to_string(),
                id: config.secondary_location.clone(),
            },
        )
    } else {
        (
            LocationInfo {
                name: "Mogliano".to_string(),
                id: config.secondary_location.clone(),
            },
            LocationInfo {
                name: "Treviso".to_string(),
                id: config.primary_location.clone(),
            },
        )
    };
    
    Ok(LocationConfig {
        primary_location: primary,
        secondary_location: secondary,
    })
} 