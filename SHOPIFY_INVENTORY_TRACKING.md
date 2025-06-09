# Shopify Inventory Change Tracking Strategy

## Current Implementation

The modification history feature currently shows:
- ✅ **App changes**: Accurately tracked via Firebase logs with `data.rettifica` values
- ⚠️ **Shopify changes**: Currently set to 0 (not tracked)

## Why Shopify Changes Aren't Tracked Yet

The official Shopify Admin API **does not provide access to inventory adjustment history** through any public GraphQL query or REST endpoint. The internal admin API (used by Shopify's admin interface) has this data but:

1. **Requires admin session cookies/tokens** (not app tokens)
2. **Uses CSRF protection** 
3. **Is an internal API** not intended for external apps
4. **Would violate Shopify's terms of service** to reverse-engineer

## Observed Shopify Admin API Call

The Shopify admin interface uses this call to get inventory history:

```bash
POST https://admin.shopify.com/api/shopify/cappelletto?operation=InventoryAdjustments&type=query

# GraphQL Query:
query InventoryAdjustments($locationId: ID!, $inventoryItemId: ID!) {
  inventoryHistory(
    locationId: $locationId
    inventoryItemId: $inventoryItemId
  ) {
    edges {
      node {
        id
        createdAt
        displayReason
        reason
        app { title }
        quantitiesSnapshot {
          name
          delta
        }
      }
    }
  }
}
```

**Key insights from the response:**
- `delta` shows actual changes (+2, -1, etc.)
- `app.title` identifies which app made the change
- `reason` shows the type of adjustment
- `createdAt` provides timestamps

## Future Implementation Strategies

### Option 1: Enhanced App-Based Tracking ✅ (Recommended)

1. **Use GraphQL for our adjustments**:
   ```rust
   adjust_inventory_graphql(item_id, location_id, delta, "correction")
   ```

2. **Store inventory snapshots** in Firebase daily/periodically:
   ```rust
   struct InventorySnapshot {
       date: String,
       inventory_item_id: String,
       location_id: String,
       quantity: i32,
   }
   ```

3. **Infer external changes** by comparing:
   - Expected quantity (last snapshot + our logged changes)
   - Actual current quantity
   - Difference = external changes

### Option 2: Webhook-Based Tracking 🔄 (Complex)

1. **Set up Shopify webhooks** for inventory level updates
2. **Log external changes** when webhook fires but no recent app log exists
3. **Requires webhook infrastructure** and proper filtering

### Option 3: Periodic Polling 📊 (Resource intensive)

1. **Poll inventory levels** every hour/day
2. **Compare with expected levels** based on logged changes
3. **Infer external changes** from discrepancies

### Option 4: GraphQL Events API 🔍 (Future)

Monitor Shopify's API roadmap for:
- Inventory adjustment history queries
- Event-based inventory tracking
- Enhanced audit trail access

## Current Workaround

The modification history modal shows:
- **App changes**: Real net changes from Firebase logs
- **Shopify changes**: 0 (placeholder)
- **Status**: "Sincronizzato" when no discrepancies detected

This provides value for:
- ✅ Tracking app-based inventory changes
- ✅ Showing daily modification breakdowns
- ✅ Identifying patterns in app usage
- ⚠️ Missing external Shopify changes (orders, manual adjustments, other apps)

## Implementation Timeline

### Phase 1: Current (Completed)
- ✅ App change tracking via Firebase
- ✅ Net change calculations
- ✅ Daily grouping and display
- ✅ GraphQL adjustment capability

### Phase 2: Enhanced Detection (Next)
- 📅 Implement inventory snapshots
- 📅 Add baseline tracking
- 📅 Improve discrepancy detection
- 📅 Switch to GraphQL for app adjustments

### Phase 3: Advanced Features (Future)
- 📅 Webhook integration
- 📅 Real-time change notifications
- 📅 Advanced reconciliation tools
- 📅 External app change attribution 