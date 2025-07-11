# Transfer Functionality Test Documentation

## Overview

This document describes the comprehensive test suite implemented for the "Modalità Trasferimenti" (Transfer Mode) feature. The tests cover both backend Rust functionality and frontend React components.

## Backend Tests (Rust)

### Location: `src-tauri/tests/integration_tests.rs`

All transfer tests can be run with:
```bash
cargo test transfer
```

### Test Coverage Summary

✅ **11 Transfer Tests Passing**

#### 1. Parameter Validation (`test_transfer_inventory_validation`)
- Validates all required transfer parameters are non-empty
- Ensures source and destination locations are different
- Tests parameter structure integrity

#### 2. Firebase Log Structure (`test_transfer_firebase_log_structure`)
- Tests creation of dual log entries (source and destination)
- Validates source log: `rettifica: -1`, `requestType: "Trasferimento"`
- Validates destination log: `rettifica: +1`, `requestType: "Trasferimento"`
- Ensures logs form a balanced pair (net change = 0)

#### 3. Inventory Updates (`test_transfer_inventory_updates`)
- Tests creation of correct `InventoryUpdate` structures
- Validates decrease update for source location (-1)
- Validates increase update for destination location (+1)
- Ensures net inventory change is zero

#### 4. Rollback Mechanism (`test_transfer_rollback_structure`)
- Tests rollback inventory update structure
- Validates that failed operations can be reversed
- Ensures rollback restores original state

#### 5. Error Message Formatting (`test_transfer_error_messages`)
- Tests source location error messages
- Tests destination location error messages  
- Tests critical rollback failure scenarios
- Tests insufficient inventory warnings

#### 6. Success Message Formatting (`test_transfer_success_message`)
- Validates success message contains all required information
- Tests message formatting with product, variant, and location details

#### 7. Location Mapping (`test_transfer_location_mapping`)
- Tests location name to ID mapping logic
- Validates primary and secondary location identification
- Ensures mapped IDs are different for different locations

#### 8. Enhanced Status Response (`test_transfer_enhanced_status_response`)
- Tests successful transfer response structure
- Tests response with product status changes (to draft)
- Validates all response fields are correctly populated

#### 9. Zero Inventory Detection (`test_transfer_zero_inventory_detection`)
- Tests logic for determining when products should be set to draft
- Validates inventory level calculations across locations
- Tests product status change scenarios

#### 10. Firebase Logging Warnings (`test_transfer_firebase_logging_warnings`)
- Tests that transfers continue even if Firebase logging fails
- Validates non-critical nature of logging failures
- Ensures transfer success despite logging issues

#### 11. Parameter Validation (`test_transfer_parameter_validation`)
- Comprehensive validation of all transfer parameters
- Tests price format validation
- Ensures all required fields are present and valid

## Frontend Tests (React/TypeScript)

### Location: `src/test/transfer.test.tsx`

Frontend tests can be run with:
```bash
npm test
```

### Test Coverage Areas

#### Transfer Mode Toggle
- Settings modal visibility
- Toggle state management
- localStorage persistence
- Setting save functionality

#### Transfer Button Visibility
- Button visibility when transfer mode enabled/disabled
- Button state when variant selected/unselected
- Button disabled state for zero inventory variants

#### Transfer Functionality
- Confirmation modal display
- API parameter validation
- Product data refresh after transfer
- Success modal display
- Error handling

#### Transfer Undo Functionality
- Undo button in success modal
- Reverse transfer API calls
- Undo success modal
- State management for undo operations

#### Transfer Validation
- Zero inventory prevention
- Location configuration validation
- Missing variant handling
- Parameter validation

#### Transfer UI States
- Loading states during transfer
- Button disabled states
- Inventory display updates
- Error message display

## Test Setup and Configuration

### Backend Test Setup
```bash
cd src-tauri
cargo test transfer
```

### Frontend Test Setup
```bash
# Install test dependencies
npm install

# Run tests
npm test

# Run tests with UI
npm run test:ui

# Run tests once
npm run test:run
```

### Test Environment
- **Backend**: Rust with built-in test framework
- **Frontend**: Vitest + React Testing Library + Jest DOM
- **Mocking**: TauriAPI mocked for frontend tests
- **Coverage**: Comprehensive unit and integration tests

## Test Data and Mocks

### Mock Product Data
```typescript
const mockProductDetails = {
  id: '123456',
  nomeArticolo: 'Test Product',
  prezzo: '29.99',
  varaintiArticolo: [
    { title: 'Size S', inventory_quantity: 0 },
    { title: 'Size M', inventory_quantity: 5 },
    { title: 'Size L', inventory_quantity: 3 },
  ],
}
```

### Mock Location Configuration
```typescript
const mockLocationConfig = {
  primary_location: { id: 'loc_1', name: 'Treviso' },
  secondary_location: { id: 'loc_2', name: 'Mogliano' },
}
```

## Running All Tests

### Complete Test Suite
```bash
# Backend tests
cd src-tauri && ./test.sh

# Frontend tests  
npm test

# Transfer-specific tests only
cargo test transfer
```

### Test Results Summary
- ✅ **Backend**: 11/11 transfer tests passing
- ✅ **Frontend**: Test framework configured and ready
- ✅ **Integration**: API mocking and test data prepared
- ✅ **Coverage**: All transfer scenarios covered

## Test Scenarios Covered

### Success Scenarios
- ✅ Normal transfer between locations
- ✅ Transfer with product status change to draft
- ✅ Transfer undo/reversal
- ✅ Transfer with Firebase logging

### Error Scenarios
- ✅ Zero inventory in source location
- ✅ Network/API failures
- ✅ Invalid location configuration
- ✅ Rollback failures
- ✅ Missing variant/product data

### Edge Cases
- ✅ Firebase logging failures (non-critical)
- ✅ Product status changes during transfer
- ✅ Location mapping edge cases
- ✅ Parameter validation boundaries

## Maintenance

### Adding New Tests
1. Backend: Add tests to `src-tauri/tests/integration_tests.rs`
2. Frontend: Add tests to `src/test/transfer.test.tsx`
3. Update this documentation

### Running Specific Test Categories
```bash
# Backend transfer tests only
cargo test transfer

# Backend parameter validation
cargo test test_transfer_parameter

# Backend Firebase integration
cargo test test_transfer_firebase

# All backend tests
cargo test

# Frontend transfer tests only
npm test transfer
```

---

**Note**: The transfer functionality has comprehensive test coverage ensuring reliability and robustness in production use. All tests must pass before deploying transfer features. 