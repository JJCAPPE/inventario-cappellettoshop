# 🧪 Shopify Inventory App Test Suite

A minimal but comprehensive test suite for the Tauri Shopify inventory app.

## Quick Start

```bash
# Quick validation (recommended for daily use)
./test.sh quick

# Run all unit tests
./test.sh unit

# Run JSON parsing tests
./test.sh mock

# Run with real Shopify API (requires .env file)
SHOPIFY_TEST=1 ./test.sh integration
```

## Test Types

### 1. **Unit Tests** (`./test.sh unit`)
- Configuration validation
- Data structure creation
- URL generation
- Header generation
- No external dependencies

### 2. **Mock Tests** (`./test.sh mock`)
- JSON parsing from sample Shopify responses
- Product data extraction
- Inventory level parsing
- Low stock filtering logic
- Error handling for malformed data

### 3. **Integration Tests** (`./test.sh integration`)
- Real Shopify API connection testing
- Requires environment variables in `.env` file
- Only runs when `SHOPIFY_TEST=1` is set
- Tests actual HTTP requests

### 4. **Dry Run Tests** (`./test.sh dry`)
- Logic validation without API calls
- URL generation for all endpoints
- Configuration setup
- Fast validation

## Test Coverage

✅ **Configuration**
- Environment variable loading
- API URL generation  
- HTTP header creation
- Error handling for missing vars

✅ **Data Structures**
- Product creation and validation
- ProductVariant handling
- InventoryUpdate objects
- StatusResponse formatting

✅ **JSON Parsing**
- Shopify product response parsing
- Inventory levels extraction
- Low stock product filtering
- Error handling for invalid JSON

✅ **API Endpoints**
- Products endpoint URL generation
- Inventory levels endpoint
- Adjustment endpoint
- Search functionality

✅ **Error Handling**
- Missing product fields
- Empty variant arrays
- Malformed JSON responses
- Network error scenarios

## Environment Setup

### For Unit/Mock Tests (no setup required)
```bash
./test.sh unit
./test.sh mock
./test.sh quick
```

### For Integration Tests
1. Create `.env` file in `src-tauri/` directory:
```bash
# Shopify API Credentials
SHOPIFY_API_KEY=your-api-key
SHOPIFY_API_SECRET_KEY=your-api-secret
SHOPIFY_ACCESS_TOKEN=your-access-token
SHOPIFY_SHOP_DOMAIN=your-shop-name.myshopify.com
SHOPIFY_API_VERSION=2025-01

# Store Locations
LOCATION_TREVISO=your-treviso-location-id
LOCATION_MOGLIANO=your-mogliano-location-id

# Firebase Credentials (optional for basic tests)
FIREBASE_API_KEY=your-firebase-api-key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your-sender-id
FIREBASE_APP_ID=your-app-id
FIREBASE_MEASUREMENT_ID=your-measurement-id

# GitHub Auto-Updater (optional for basic tests)
UPDATER_GITHUB_TOKEN=your-github-token
UPDATER_GITHUB_OWNER=your-github-username
UPDATER_GITHUB_REPO=your-repo-name

# App Version
VERSION=3.1.0
```

2. Run integration tests:
```bash
SHOPIFY_TEST=1 ./test.sh integration
```

## Test Commands Reference

| Command | Description | Requirements |
|---------|-------------|--------------|
| `./test.sh quick` | Fast validation | None |
| `./test.sh unit` | All unit tests | None |
| `./test.sh mock` | JSON parsing tests | None |
| `./test.sh dry` | Logic-only tests | None |
| `./test.sh integration` | Real API tests | `.env` file + `SHOPIFY_TEST=1` |
| `./test.sh all` | Everything | `.env` file |

## Sample Test Output

```bash
🧪 Shopify Inventory App Test Suite
======================================
Running quick validation tests...
✅ Tests completed successfully!
```

## Troubleshooting

### Common Issues

1. **"module `utils` is private"**
   - This is fixed by making modules public in `lib.rs`

2. **"SHOPIFY_SHOP_DOMAIN must be set"**
   - Create `.env` file with required environment variables
   - Or run unit tests instead: `./test.sh unit`

3. **"Failed to connect to Shopify"**
   - Check your Shopify credentials in `.env`
   - Verify your access token has correct permissions
   - Make sure shop domain is correct (without .myshopify.com)

### Performance Testing

The test suite includes performance tests for large product lists:
- Tests parsing 100+ products
- Validates efficient inventory calculations
- Ensures memory usage stays reasonable

## Adding New Tests

### Unit Test Example
```rust
#[test]
fn test_new_feature() {
    let config = setup_test_config();
    // Your test logic here
    assert_eq!(expected, actual);
}
```

### Integration Test Example
```rust
#[tokio::test]
async fn test_new_api_endpoint() {
    if !should_run_integration_tests() {
        return;
    }
    // Your async test logic here
}
```

## Continuous Integration

Add to your CI pipeline:
```yaml
- name: Run Tests
  run: |
    cd src-tauri
    ./test.sh unit
    ./test.sh mock
```

---

**💡 Tip**: Use `./test.sh quick` for daily development - it runs the most important tests in under 5 seconds! 