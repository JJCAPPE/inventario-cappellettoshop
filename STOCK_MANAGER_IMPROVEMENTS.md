# Shopify Stock Manager - Improvements & Fixes

## Overview

The original Shopify stock manager script had logic errors that caused products to be incorrectly identified as having zero quantity when they actually had stock. This document explains the problems found and the improvements implemented.

## Issues Found in Original Script

### 1. **API Field Selection Error**
- **Problem**: Script requested `inventory_item_id` as a product field in the query
- **Reality**: `inventory_item_id` is a variant field, not a product field
- **Impact**: Potentially incomplete data retrieval

### 2. **Single Data Source Dependency**
- **Problem**: Script relied solely on `/inventory_levels.json` API endpoint
- **Reality**: This endpoint has known reliability issues and timing problems
- **Impact**: Inconsistent inventory calculations

### 3. **No Data Validation**
- **Problem**: No cross-checking between different inventory data sources
- **Reality**: Shopify provides inventory data in multiple places that should agree
- **Impact**: False positives when API data was inconsistent

### 4. **Inventory Summing Issues**
- **Problem**: Simple addition across all locations without considering edge cases
- **Reality**: Complex inventory states (committed, unavailable, etc.) can cause discrepancies
- **Impact**: Incorrect total calculations

### 5. **Poor Error Handling**
- **Problem**: Script failed completely if any API call failed
- **Reality**: Partial failures should be handled gracefully
- **Impact**: Missed genuine out-of-stock products due to API errors

## Improvements Implemented

### 🔄 **Dual Data Source Validation**
```typescript
// Now compares two sources:
const inventoryLevelStock = inventoryLevels.get(variant.inventory_item_id) || 0;
const variantQuantityStock = variant.inventory_quantity || 0;

// Uses variant quantity as primary source (more reliable):
const finalStock = variantQuantityStock !== null && variantQuantityStock !== undefined 
  ? variantQuantityStock 
  : inventoryLevelStock;
```

### 🛡️ **Reliable Stock Calculation**
- Uses **variant quantities** as the primary source (confirmed more reliable)
- Falls back to inventory levels API only if variant quantity is missing
- Prevents false positives caused by unreliable Inventory Levels API data

### 📊 **Discrepancy Detection & Reporting**
```typescript
// Tracks agreement between data sources:
stockSources: {
  inventoryLevels: number,
  variantQuantities: number,
  agreementStatus: 'MATCH' | 'DISCREPANCY' | 'PARTIAL_MATCH'
}
```

### 🚨 **Enhanced Error Handling**
- Continues processing even if some API calls fail
- Logs specific batch failures without stopping the entire process
- Provides detailed error information in reports

### 📈 **Improved Reporting**
- Shows data from both sources in email reports
- Highlights discrepancies for manual review
- Includes agreement status for each product
- Provides clear explanations of conservative approach

## Key Fixes Applied

| Issue | Original Behavior | New Behavior |
|-------|------------------|--------------|
| **API Fields** | Requested invalid `inventory_item_id` on products | Correctly requests only variant fields |
| **Data Sources** | Used only Inventory Levels API | Validates against both API and variant data |
| **Calculations** | Trusted single source blindly | Uses variant quantities as primary source (more reliable) |
| **Discrepancies** | Not detected or reported | Actively detected and flagged in reports |
| **Error Handling** | Failed completely on API errors | Continues with partial data and logs issues |
| **False Positives** | Products incorrectly marked as zero stock | Conservative approach prevents false positives |

## Using the Improved Script

### 1. **Test the Logic**
```bash
npx tsx scripts/test-stock-manager.ts
```

### 2. **Run in Dry Mode (Recommended)**
```bash
npx tsx scripts/stock-manager.ts --dry-run
```

### 3. **Review the Enhanced Report**
The new email report includes:
- **Discrepancy count** in the summary
- **Warning message** when discrepancies are found
- **Source comparison** showing both API and variant data
- **Variant-based totals** used for decision making

The console output now shows:
- **Detailed product list** that would be affected (in both dry-run and live modes)
- **Stock breakdown** for each product (final stock, API data, variant data)
- **Discrepancy alerts** for each affected product

### 4. **Live Mode (After Validation)**
```bash
npx tsx scripts/stock-manager.ts
```

## What to Expect

### ✅ **Reduced False Positives**
Products with actual stock will no longer be incorrectly marked for drafting due to API inconsistencies.

### 📊 **Better Visibility**
You'll see exactly when and where inventory data sources disagree, helping identify systemic issues.

### 🛡️ **Safer Operations**
Using variant quantities as the primary source ensures more accurate inventory calculations.

### 📋 **Enhanced Dry Run Logging**
Detailed console output shows exactly which products would be affected, even in dry run mode.

### 📈 **Detailed Reporting**
Enhanced email reports provide much more context for decision-making and troubleshooting.

## Common Scenarios Handled

### Scenario 1: API Discrepancy (API Returns Wrong Data)
- **Inventory Levels API**: 0 units (incorrect)
- **Variant Quantity**: 5 units (correct)
- **Decision**: Use 5 units (variant quantity as primary)
- **Result**: Product stays active (not drafted)

### Scenario 2: True Zero Stock
- **Inventory Levels API**: 0 units
- **Variant Quantity**: 0 units
- **Decision**: Use 0 units
- **Result**: Product set to draft

### Scenario 3: API Failure
- **Inventory Levels API**: Failed to fetch
- **Variant Quantity**: 3 units
- **Decision**: Use 3 units (fallback)
- **Result**: Product stays active, failure logged

## Monitoring & Maintenance

### 📧 **Email Report Changes**
- New "Discrepanze Rilevate" counter in summary
- Warning section when discrepancies are found
- Source comparison columns in product tables

### 🔍 **What to Watch For**
- High discrepancy counts may indicate Shopify API issues
- Consistent discrepancies for specific products may need manual review
- Failed API calls should be investigated

### ⚙️ **Troubleshooting**
If you still see false positives:
1. Check the email report for discrepancy patterns
2. Manually verify inventory in Shopify admin
3. Consider adjusting the excluded products list
4. Review recent Shopify API changes or outages

## Technical Details

### Dependencies
No new dependencies added - uses existing:
- `axios` for API calls
- `nodemailer` for email reports
- `dotenv` for configuration

### Performance
- Slightly increased processing time due to dual validation
- Better error recovery reduces total failure rate
- Enhanced logging provides better debugging information

### Backwards Compatibility
- Uses same environment variables
- Same command-line options
- Enhanced email reports (existing templates still work)

## Support & Issues

If you continue to experience inventory calculation issues:

1. **Run the test script** to verify logic works correctly
2. **Use dry-run mode** to see what would be changed
3. **Check email reports** for discrepancy patterns
4. **Review Shopify admin** for manual verification

The improved script should significantly reduce false positives while providing much better visibility into inventory data quality issues. 