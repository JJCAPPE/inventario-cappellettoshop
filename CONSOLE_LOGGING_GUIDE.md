# Console Logging Guide - Firebase Integration

This guide shows you exactly what console output to expect when using the Firebase logging functionality, including document IDs for verification in the Firebase console.

## 🔥 Firebase Document Creation Logging

When you call `decreaseInventoryWithLogging()` or `undoDecreaseInventoryWithLogging()`, you'll see detailed console output like this:

### Example: Decrease Inventory with Logging
```
📦 Starting inventory decrease with logging:
   🏪 Store: Treviso
   📦 Product: Scarpe Nike Air Max (Taglia 42)
   📍 Location ID: 3708157983
   🔢 Inventory Item ID: 12345678901

📉 Adjusting Shopify inventory...
✅ Shopify inventory adjusted successfully

📝 Creating Firebase log entry...

🔥 Firebase Log Created:
   📄 Document ID: ABcd1234efGH5678ijKL
   📝 Request Type: decrease_inventory
   🏪 Store: Treviso
   📦 Product: Scarpe Nike Air Max (Taglia 42)
   📊 Adjustment: -1
   🕒 Timestamp: 2024-01-15T10:30:45.123Z

✅ Inventory decrease completed with logging
```

### Example: Undo Decrease (Increase) with Logging
```
🔄 Starting inventory undo (increase) with logging:
   🏪 Store: Mogliano
   📦 Product: Stivali Timberland (Taglia 40)
   📍 Location ID: 31985336425
   🔢 Inventory Item ID: 98765432101

📈 Adjusting Shopify inventory (undo)...
✅ Shopify inventory adjusted successfully

📝 Creating Firebase log entry (undo)...

🔥 Firebase Log Created:
   📄 Document ID: XYz9876wVU5432tsRQ
   📝 Request Type: undo_decrease_inventory
   🏪 Store: Mogliano
   📦 Product: Stivali Timberland (Taglia 40)
   📊 Adjustment: +1
   🕒 Timestamp: 2024-01-15T10:32:15.456Z

✅ Inventory undo completed with logging
```

## 📖 Firebase Document Retrieval Logging

When you call `getLogs()` to retrieve logs, you'll see detailed filtering and retrieval information:

### Example: Get All Today's Logs for Treviso
```
🔍 Fetching Firebase logs:
   🏪 Store filter: Treviso

🔍 Processing 15 Firestore documents
   ⏭️  Skipping document DEf4567ghI8901jkLM - wrong location (Mogliano != Treviso)
   ⏭️  Skipping document NOp2345qrS6789tuVW - not today (2024-01-14T15:20:30.789Z)
   ✅ Including document ABcd1234efGH5678ijKL - Scarpe Nike Air Max (Taglia 42, decrease_inventory)
   ✅ Including document QRs8901uvW2345xyZA - Giacca North Face (Taglia M, decrease_inventory)
   ⏭️  Skipping document BCd5678fgH9012klMN - wrong location (Mogliano != Treviso)
   ✅ Including document TUv6789wxY3456zaBC - Pantaloni Levi's (Taglia 32, undo_decrease_inventory)

📊 Firebase logs retrieved:
   📄 Total documents found: 3
   1 [decrease_inventory] Scarpe Nike Air Max - Taglia 42 (Treviso)
   2 [decrease_inventory] Giacca North Face - Taglia M (Treviso)
   3 [undo_decrease_inventory] Pantaloni Levi's - Taglia 32 (Treviso)
```

### Example: Search Logs by Product Name
```
🔍 Fetching Firebase logs:
   🏪 Store filter: Treviso
   🔎 Product name filter: nike

🔍 Processing 15 Firestore documents
   ⏭️  Skipping document DEf4567ghI8901jkLM - wrong location (Mogliano != Treviso)
   ⏭️  Skipping document QRs8901uvW2345xyZA - doesn't match query 'nike' (Giacca North Face)
   ✅ Including document ABcd1234efGH5678ijKL - Scarpe Nike Air Max (Taglia 42, decrease_inventory)
   ✅ Including document ZYx1234uvW5678rsQP - Nike Swoosh T-Shirt (Taglia L, decrease_inventory)

📊 Firebase logs retrieved:
   📄 Total documents found: 2
   1 [decrease_inventory] Scarpe Nike Air Max - Taglia 42 (Treviso)
   2 [decrease_inventory] Nike Swoosh T-Shirt - Taglia L (Treviso)
```

## 🔍 Verifying in Firebase Console

To verify these documents in your Firebase Console:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `shopify-inventario`
3. Navigate to **Firestore Database**
4. Look for the `logs` collection
5. Find documents with the IDs shown in the console output

### Document Structure in Firestore
Each document will have this structure:
```json
{
  "requestType": "decrease_inventory",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "data": "{\"id\":\"98765\",\"variant\":\"Taglia 42\",\"negozio\":\"Treviso\",\"inventory_item_id\":\"12345678901\",\"nome\":\"Scarpe Nike Air Max\",\"prezzo\":\"89.99\",\"rettifica\":-1,\"images\":[\"https://...\"]}"
}
```

## ❌ Error Logging

If there are any issues, you'll see detailed error messages:

### Firebase Connection Error
```
❌ Firebase Error: {
  "error": {
    "code": 401,
    "message": "Request had invalid authentication credentials."
  }
}
```

### Shopify API Error  
```
📦 Starting inventory decrease with logging:
   🏪 Store: Treviso
   📦 Product: Test Product (Taglia M)
   📍 Location ID: 3708157983
   🔢 Inventory Item ID: invalid_id

📉 Adjusting Shopify inventory...
❌ Failed to adjust inventory: Shopify API error: {"errors":{"inventory_item_id":["does not exist"]}}
```

## 💡 Tips for Debugging

1. **Document IDs**: Use the logged document IDs to quickly find specific entries in Firebase Console
2. **Filtering**: Watch the "Skipping document" messages to understand why certain logs aren't included
3. **Timestamps**: All timestamps are in ISO format (UTC timezone)
4. **Error Context**: Error messages include full context about what operation failed
5. **Store Filtering**: Each operation shows which store it's filtering for

This comprehensive logging makes it easy to track exactly what's happening with your inventory operations and verify that all data is being saved correctly to Firebase! 