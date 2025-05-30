#!/bin/bash

# Shopify Inventory App Test Suite
# Usage: ./test.sh [type]
# Types: unit, integration, all

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

TEST_TYPE=${1:-unit}

echo -e "${YELLOW}🧪 Shopify Inventory App Test Suite${NC}"
echo "======================================"

case $TEST_TYPE in
  "unit")
    echo -e "${YELLOW}Running unit tests (no API calls)...${NC}"
    cargo test --lib
    ;;
  
  "integration")
    echo -e "${YELLOW}Running integration tests (requires .env file)...${NC}"
    if [ ! -f .env ]; then
      echo -e "${RED}❌ .env file not found. Integration tests require Shopify credentials.${NC}"
      echo "Please create a .env file with your Shopify credentials."
      exit 1
    fi
    echo -e "${YELLOW}Set SHOPIFY_TEST=1 to run real API tests${NC}"
    SHOPIFY_TEST=1 cargo test --test test_runner
    ;;
  
  "dry")
    echo -e "${YELLOW}Running dry-run tests (logic only, no API calls)...${NC}"
    cargo test test_dry_run
    ;;
  
  "mock")
    echo -e "${YELLOW}Running mock data tests...${NC}"
    cargo test test_parse
    ;;
  
  "all")
    echo -e "${YELLOW}Running all tests...${NC}"
    echo ""
    echo -e "${YELLOW}1. Unit tests${NC}"
    cargo test --lib
    echo ""
    echo -e "${YELLOW}2. Integration tests${NC}"
    cargo test --test integration_tests
    echo ""
    echo -e "${YELLOW}3. Real API tests (if enabled)${NC}"
    if [ "$SHOPIFY_TEST" = "1" ]; then
      cargo test --test test_runner
    else
      echo -e "${YELLOW}Skipped (set SHOPIFY_TEST=1 to enable)${NC}"
    fi
    ;;
  
  "quick")
    echo -e "${YELLOW}Running quick validation tests...${NC}"
    cargo check && cargo test test_config && cargo test test_dry_run
    ;;
  
  *)
    echo -e "${RED}Unknown test type: $TEST_TYPE${NC}"
    echo "Available types:"
    echo "  unit        - Unit tests (no API calls)"
    echo "  integration - Integration tests (requires .env)"
    echo "  dry         - Dry-run tests (logic only)"
    echo "  mock        - Mock data parsing tests"
    echo "  all         - All tests"
    echo "  quick       - Quick validation"
    exit 1
    ;;
esac

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✅ Tests completed successfully!${NC}"
else
  echo -e "${RED}❌ Some tests failed.${NC}"
  exit 1
fi 