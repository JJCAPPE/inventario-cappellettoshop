# Firebase & Location Management Integration

This document describes the Firebase logging and location management features that have been integrated into the Tauri backend to replicate the functionality from the old Electron app.

## 🔥 Firebase Integration

### Overview
The Firebase integration provides comprehensive logging of all inventory operations, matching the functionality from the old implementation. All inventory changes are automatically logged to Firestore for audit trails and analytics.

### Backend Implementation

#### Firebase Module (`src/firebase/mod.rs`)
- **FirebaseClient**: Handles all Firestore REST API interactions
- **LogData**: Data structure for inventory operation logs
- **LogEntry**: Complete log entry with metadata
- **Tauri Commands**: Exposed functions for frontend use

#### Key Features
- ✅ **Automatic Logging**: All inventory operations are logged with full context
- ✅ **Location Filtering**: Logs are filtered by store location (Treviso/Mogliano)  
- ✅ **Date Filtering**: Only today's logs are retrieved by default
- ✅ **Search Functionality**: Logs can be filtered by product name
- ✅ **REST API Integration**: Uses Firestore REST API (no SDK dependencies)

#### Tauri Commands Available
```rust
// Create a new log entry
firebase::create_log(request_type: String, data: LogData) -> StatusResponse

// Get filtered logs  
firebase::get_logs(query: Option<String>, location: String) -> Vec<LogEntry>

// Get Firebase configuration
firebase::get_firebase_config() -> FirebaseConfig
```

### Frontend TypeScript Integration

#### FirebaseAPI Class (`src/services/tauri.ts`)
```typescript
// Create log entry
await TauriAPI.Firebase.createLog("decrease_inventory", logData);

// Get today's logs for Treviso
await TauriAPI.Firebase.getLogs(undefined, "Treviso");

// Search logs by product name
await TauriAPI.Firebase.getLogs("scarpe", "Treviso");

// Helper to create log data structure
const logData = TauriAPI.Firebase.createInventoryLogData(
  productId, variantTitle, negozio, inventoryItemId, 
  productName, price, adjustment, images
);
```

## 📍 Location Management Integration

### Overview
Location management handles the store location settings (Treviso vs Mogliano) and provides location-aware inventory operations.

### Backend Implementation

#### Location Module (`src/location/mod.rs`)
- **LocationInfo**: Store location data structure
- **LocationConfig**: Primary/secondary location configuration
- **File-based Storage**: Persists location setting to JSON file
- **Location Constants**: Predefined store locations and IDs

#### Key Features
- ✅ **Persistent Storage**: Location preference saved to app data directory
- ✅ **Location Switching**: Easy switching between Treviso and Mogliano
- ✅ **Configuration Management**: Dynamic primary/secondary location assignment
- ✅ **Cross-platform**: Uses Tauri's path resolver for app data directory

#### Tauri Commands Available
```rust
// Get current location setting
location::get_app_location() -> String

// Set location preference  
location::set_app_location(location: String) -> StatusResponse

// Get all available locations
location::get_available_locations() -> Vec<LocationInfo>

// Get location by name
location::get_location_by_name(location_name: String) -> LocationInfo

// Get current location configuration  
location::get_current_location_config() -> LocationConfig
```

### Frontend TypeScript Integration

#### LocationAPI Class (`src/services/tauri.ts`)
```typescript
// Get current location
const currentLocation = await TauriAPI.Location.getAppLocation();

// Set location to Treviso
await TauriAPI.Location.setAppLocation("Treviso");

// Get available locations
const locations = await TauriAPI.Location.getAvailableLocations();

// Get location configuration (primary/secondary)
const config = await TauriAPI.Location.getCurrentLocationConfig();
```

## 🔄 Enhanced Inventory Operations

### Overview
Enhanced inventory functions that automatically log operations to Firebase, replicating the exact behavior from the old implementation.

### Backend Implementation

#### Enhanced Commands
```rust
// Decrease inventory with automatic Firebase logging
inventory::decrease_inventory_with_logging(
    inventory_item_id: String,
    location_id: String, 
    product_id: String,
    variant_title: String,
    product_name: String,
    price: String,
    negozio: String,
    images: Vec<String>
) -> StatusResponse

// Undo decrease with automatic Firebase logging  
inventory::undo_decrease_inventory_with_logging(
    // ... same parameters
) -> StatusResponse
```

### Frontend TypeScript Integration

#### Enhanced InventoryAPI Methods
```typescript
// Decrease inventory with logging
await TauriAPI.Inventory.decreaseInventoryWithLogging(
  inventoryItemId, locationId, productId, variantTitle,
  productName, price, negozio, images
);

// Undo decrease with logging
await TauriAPI.Inventory.undoDecreaseInventoryWithLogging(
  inventoryItemId, locationId, productId, variantTitle,
  productName, price, negozio, images
);
```

## 🔧 Configuration

### Environment Variables Required
```env
# Firebase Configuration
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
FIREBASE_MEASUREMENT_ID=your_measurement_id

# Location IDs
LOCATION_TREVISO=3708157983
LOCATION_MOGLIANO=31985336425
```

## 📊 Data Structures

### LogData Structure
```typescript
interface LogData {
  id: string;                    // Product ID
  variant: string;               // Variant title (e.g., "Taglia 42")
  negozio: string;              // Store location ("Treviso" or "Mogliano")
  inventory_item_id: string;     // Shopify inventory item ID
  nome: string;                 // Product name
  prezzo: string;               // Product price
  rettifica: number;            // Inventory adjustment (-1, +1, etc.)
  images: string[];             // Product image URLs
}
```

### LogEntry Structure
```typescript
interface LogEntry {
  request_type: string;         // "decrease_inventory" or "undo_decrease_inventory"
  data: LogData;               // The log data
  timestamp: string;           // ISO timestamp
}
```

## 🎯 Migration Benefits

### Compared to Old Implementation
- ✅ **Type Safety**: Full Rust/TypeScript type safety
- ✅ **Performance**: Native IPC instead of HTTP
- ✅ **Security**: No exposed backend server
- ✅ **Maintainability**: Clean modular architecture
- ✅ **Error Handling**: Comprehensive error handling
- ✅ **Logging**: Structured logging with console output
- ✅ **Testing**: Testable components with unit tests

### Backward Compatibility
- ✅ **Same Data Format**: LogData structure matches old implementation
- ✅ **Same Firebase Collection**: Uses same "logs" collection
- ✅ **Same Location Logic**: Treviso/Mogliano behavior preserved
- ✅ **Same Filtering**: Date and location filtering preserved

## 🚀 Usage Examples

### Complete Inventory Operation with Logging
```typescript
import TauriAPI from './services/tauri';

// Get current location
const currentLocation = await TauriAPI.Location.getAppLocation();

// Decrease inventory with automatic logging
await TauriAPI.Inventory.decreaseInventoryWithLogging(
  "12345678",           // inventory_item_id
  "3708157983",         // location_id (Treviso)
  "98765",              // product_id
  "Taglia 42",          // variant_title
  "Scarpe Nike Air",    // product_name
  "89.99",              // price
  currentLocation,      // negozio ("Treviso")
  ["https://...jpg"]    // images
);

// Get today's logs
const logs = await TauriAPI.Firebase.getLogs(undefined, currentLocation);
console.log(`Found ${logs.length} operations today`);
```

## 🔍 Debugging & Monitoring

### Console Logging
All API calls include comprehensive console logging:
- 🔍 Raw API responses with data
- 📊 Summary statistics (counts, etc.)
- 📝 Operation details
- 🏪 Location information
- ❌ Error details with context

### Log Levels
- **Info**: Successful operations and responses
- **Warn**: Non-critical issues (missing optional data)
- **Error**: Failed operations with full error context

This integration provides a robust, maintainable, and secure foundation for inventory management with comprehensive audit trails through Firebase logging. 

# Firebase Integration for Inventory Logging

This document describes the Firebase integration for logging inventory operations in the Tauri-based inventory management system.

## Overview

The Firebase integration provides automatic logging of inventory operations to Firestore, maintaining compatibility with the previous ShopifyReact implementation while adding modern features like 24-hour filtering and real-time updates.

## Key Features

### 🕐 24-Hour Log Filtering
- **Smart Time Filtering**: Shows logs from the last 24 hours instead of just today's date
- **Real-time Updates**: Automatically refreshes to show the most recent operations
- **Timezone Aware**: Properly handles timezone differences using UTC timestamps

### 🔄 Automatic Logging
- **Seamless Integration**: Inventory operations automatically create Firebase logs
- **No Manual Intervention**: Logs are created transparently during inventory adjustments
- **Backward Compatibility**: Maintains the same log format as the old ShopifyReact system

### 🎯 Enhanced UI
- **Loading States**: Visual feedback during log fetching operations
- **Error Handling**: Graceful error display with retry options
- **Manual Refresh**: One-click refresh button for immediate updates
- **Search Filtering**: Real-time search through log entries

## Architecture

### Backend Components

#### 1. Firebase Module (`src/firebase/mod.rs`)
```rust
// Core structures
pub struct LogData { /* product and operation details */ }
pub struct LogEntry { /* complete log entry with timestamp */ }
pub struct FirebaseClient { /* Firestore REST API client */ }

// Key functions
pub async fn create_log() -> Result<StatusResponse, String>
pub async fn get_logs() -> Result<Vec<LogEntry>, String>
```

#### 2. Enhanced Inventory Operations
```rust
// New logging-enabled functions
pub async fn decrease_inventory_with_logging() -> Result<StatusResponse, String>
pub async fn undo_decrease_inventory_with_logging() -> Result<StatusResponse, String>
```

### Frontend Components

#### 1. LogContext (`src/contexts/LogContext.tsx`)
```typescript
interface LogContextType {
  logs: LogEntry[];
  loading: boolean;
  error: string | null;
  fetchLogs: (query?: string) => Promise<void>;
  refreshLogs: () => Promise<void>;
}
```

#### 2. DataPage Component (`src/components/DataPage.tsx`)
- **24-Hour View**: Displays "Modifiche Recenti (Ultime 24h)"
- **Real-time Search**: Filter logs by product name
- **Visual Indicators**: Color-coded operation types (Rettifica/Annullamento)
- **Enhanced Timestamps**: Shows date and time (DD/MM HH:mm format)

## API Reference

### Tauri Commands

#### `create_log`
```rust
#[tauri::command]
pub async fn create_log(
    request_type: String,
    data: LogData,
) -> Result<StatusResponse, String>
```

#### `get_logs`
```rust
#[tauri::command]
pub async fn get_logs(
    query: Option<String>,
    location: String,
) -> Result<Vec<LogEntry>, String>
```

### Frontend API

#### FirebaseAPI Class
```typescript
class FirebaseAPI {
  static async createLog(requestType: string, data: LogData): Promise<StatusResponse>
  static async getLogs(query?: string, location?: string): Promise<LogEntry[]>
  static async getFirebaseConfig(): Promise<FirebaseConfig>
}
```

## Usage Examples

### Automatic Logging (Recommended)
```typescript
// This automatically creates a Firebase log
await TauriAPI.Inventory.decreaseInventoryWithLogging(
  inventoryItemId,
  locationId,
  productId,
  variantTitle,
  productName,
  price,
  negozio,
  images
);
```

### Manual Log Retrieval
```typescript
// Get logs from last 24 hours for current location
const logs = await TauriAPI.Firebase.getLogs();

// Search logs by product name
const searchResults = await TauriAPI.Firebase.getLogs("MARC JACOBS");
```

### Using LogContext in Components
```typescript
const { logs, loading, error, fetchLogs, refreshLogs } = useLogs();

// Fetch logs on component mount
useEffect(() => {
  fetchLogs();
}, [fetchLogs]);

// Manual refresh
const handleRefresh = () => {
  refreshLogs();
};
```

## Configuration

### Environment Variables
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
VITE_FIREBASE_MEASUREMENT_ID=G-ABCDEFGHIJ
```

### Firestore Structure
```
logs/
├── document_id_1/
│   ├── requestType: "Rettifica"
│   ├── timestamp: "2024-01-15T10:30:00Z"
│   └── data/
│       ├── id: "product_id"
│       ├── nome: "Product Name"
│       ├── negozio: "Treviso"
│       ├── rettifica: -1
│       └── ...
```

## Migration from ShopifyReact

### Key Improvements
1. **24-Hour Filtering**: More comprehensive than daily filtering
2. **Type Safety**: Full TypeScript support with proper type definitions
3. **Error Handling**: Robust error handling with user feedback
4. **Performance**: Optimized queries and caching
5. **UI/UX**: Modern Ant Design components with loading states

### Compatibility
- **Log Format**: 100% compatible with existing Firebase logs
- **API Endpoints**: Maintains same functionality as `/log` and `/log-getdata`
- **Location Filtering**: Preserves location-based filtering logic

## Troubleshooting

### Common Issues

#### 1. No Logs Appearing
```typescript
// Check if using the correct function
❌ TauriAPI.Inventory.adjustInventory() // Old function, no logging
✅ TauriAPI.Inventory.decreaseInventoryWithLogging() // New function with logging
```

#### 2. Firebase Connection Issues
```bash
# Check console for Firebase errors
🔍 Look for: "Firebase request failed" or "Firestore error"
🔧 Verify: Environment variables are correctly set
```

#### 3. Timestamp Issues
```typescript
// Logs use ISO 8601 format
✅ "2024-01-15T10:30:00Z" // Correct format
❌ "2024-01-15 10:30:00"  // Incorrect format
```

### Debug Console Output
The system provides detailed console logging:
```
🔥 Attempting to create Firebase log...
   📝 Request Type: Rettifica
   🏪 Store: Treviso
   📦 Product: MARC JACOBS - The Small Tote Bag
   🌐 Firebase URL: https://firestore.googleapis.com/v1/projects/.../documents/logs
   📡 Firebase response status: 200
✅ Firebase log created successfully!
   📄 Document ID: abc123def456
```

## Performance Considerations

### Optimization Features
- **Client-side Filtering**: Search filtering happens locally for better performance
- **Timestamp Sorting**: Logs are sorted by timestamp (most recent first)
- **Pagination**: Limited to 100 most recent logs to prevent memory issues
- **Caching**: LogContext maintains state to avoid unnecessary API calls

### Best Practices
1. Use `refreshLogs()` sparingly to avoid API rate limits
2. Implement search debouncing for better user experience
3. Monitor Firebase usage to stay within quotas
4. Use loading states to provide user feedback

## Future Enhancements

### Planned Features
- **Real-time Subscriptions**: Live updates using Firestore listeners
- **Offline Support**: Cache logs for offline viewing
- **Advanced Filtering**: Date range pickers and advanced search
- **Export Functionality**: Export logs to CSV/Excel
- **Analytics Dashboard**: Visual charts and statistics

### Extensibility
The modular architecture allows for easy extension:
- Add new log types by extending `LogData` structure
- Implement custom filtering logic in `parse_firestore_logs_response`
- Add new UI components using the existing `LogContext`

This integration provides a robust, maintainable, and secure foundation for inventory management with comprehensive audit trails through Firebase logging. 