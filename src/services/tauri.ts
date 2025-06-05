import { invoke } from "@tauri-apps/api/core";

// Type definitions for API responses
export interface Product {
  id: string;
  title: string;
  handle: string;
  price: string;
  description: string;
  images: string[];
  variants: ProductVariant[];
  total_inventory: number;
  locations: { [key: string]: number };
}

export interface ProductVariant {
  inventory_item_id: string;
  title: string;
  inventory_quantity: number;
  price: string;
  sku?: string;
}

export interface InventoryUpdate {
  variant_id: string;
  location_id: string;
  adjustment: number;
}

export interface StatusResponse {
  status: string;
  message: string;
}

export interface LocationConfig {
  primary_location: LocationInfo;
  secondary_location: LocationInfo;
}

export interface LocationInfo {
  name: string;
  id: string;
}

// Firebase-related type definitions
export interface LogData {
  id: string;
  variant: string;
  negozio: string;
  inventory_item_id: string;
  nome: string;
  prezzo: string;
  rettifica: number;
  images: string[];
}

export interface LogEntry {
  request_type: string;
  data: LogData;
  timestamp: string;
}

export interface FirebaseConfig {
  api_key: string;
  auth_domain: string;
  project_id: string;
  storage_bucket: string;
  messaging_sender_id: string;
  app_id: string;
  measurement_id: string;
}

// Product API functions
export class ProductAPI {
  /**
   * Get all products (limit 250)
   */
  static async getProducts(): Promise<Product[]> {
    try {
      const result = await invoke<Product[]>("get_products");
      console.log("🔍 Raw API Response - get_products:", result);
      return result;
    } catch (error) {
      console.error("Error fetching products:", error);
      throw new Error(`Failed to fetch products: ${error}`);
    }
  }

  /**
   * Get a specific product by ID
   */
  static async getProductById(productId: string): Promise<Product> {
    try {
      const result = await invoke<Product>("get_product_by_id", { productId });
      console.log(
        `🔍 Raw API Response - get_product_by_id (${productId}):`,
        result
      );
      return result;
    } catch (error) {
      console.error("Error fetching product by ID:", error);
      throw new Error(`Failed to fetch product ${productId}: ${error}`);
    }
  }

  /**
   * Search products by title
   */
  static async searchProducts(query: string): Promise<Product[]> {
    try {
      const result = await invoke<Product[]>("search_products", { query });
      console.log(`🔍 Raw API Response - search_products (${query}):`, result);
      return result;
    } catch (error) {
      console.error("Error searching products:", error);
      throw new Error(`Failed to search products: ${error}`);
    }
  }

  /**
   * Search products by partial name using GraphQL (better partial matching)
   */
  static async searchProductsByNameGraphQL(
    name: string,
    sortKey?: string,
    sortReverse?: boolean
  ): Promise<Product[]> {
    try {
      const result = await invoke<Product[]>(
        "search_products_by_name_graphql",
        {
          name,
          sortKey: sortKey || "RELEVANCE",
          sortReverse: sortReverse || false,
        }
      );
      console.log(
        `🔍 Raw API Response - search_products_by_name_graphql (${name}, sort: ${
          sortKey || "RELEVANCE"
        }, reverse: ${sortReverse || false}):`,
        result
      );
      console.log(
        `📊 GraphQL search found ${result.length} products for "${name}"`
      );
      return result;
    } catch (error) {
      console.error("Error in GraphQL product search:", error);
      throw new Error(`Failed to search products by name: ${error}`);
    }
  }

  /**
   * Search products by SKU
   */
  static async searchProductsBySku(sku: string): Promise<Product[]> {
    try {
      const result = await invoke<Product[]>("search_products_by_sku", { sku });
      console.log(
        `🔍 Raw API Response - search_products_by_sku (${sku}):`,
        result
      );
      return result;
    } catch (error) {
      console.error("Error searching products by SKU:", error);
      throw new Error(`Failed to search products by SKU: ${error}`);
    }
  }

  /**
   * Enhanced search that looks for both title and SKU matches
   */
  static async searchProductsEnhanced(query: string): Promise<Product[]> {
    try {
      const result = await invoke<Product[]>("search_products_enhanced", {
        query,
      });
      console.log(
        `🔍 Raw API Response - search_products_enhanced (${query}):`,
        result
      );
      console.log(`📊 Found ${result.length} products matching "${query}"`);
      return result;
    } catch (error) {
      console.error("Error in enhanced product search:", error);
      throw new Error(`Failed to search products: ${error}`);
    }
  }

  /**
   * Find exact product by SKU - returns single match or null
   */
  static async findProductByExactSku(sku: string): Promise<Product | null> {
    try {
      const result = await invoke<Product | null>("find_product_by_exact_sku", {
        sku,
      });
      console.log(
        `🔍 Raw API Response - find_product_by_exact_sku (${sku}):`,
        result
      );
      if (result) {
        console.log(`✅ Found exact SKU match: ${result.title}`);
      } else {
        console.log(`❌ No exact SKU match found for: ${sku}`);
      }
      return result;
    } catch (error) {
      console.error("Error finding product by exact SKU:", error);
      throw new Error(`Failed to find product by SKU: ${error}`);
    }
  }
}

// Inventory API functions
export class InventoryAPI {
  /**
   * Get location configuration from backend
   */
  static async getLocationConfig(): Promise<LocationConfig> {
    try {
      const result = await invoke<LocationConfig>("get_location_config");
      console.log(`🔍 Raw API Response - get_location_config:`, result);
      return result;
    } catch (error) {
      console.error("Error fetching location config:", error);
      throw new Error(`Failed to fetch location config: ${error}`);
    }
  }

  /**
   * Get inventory levels for specific items with location awareness
   */
  static async getInventoryLevelsForLocations(
    inventoryItemIds: string[],
    primaryLocationName: string
  ): Promise<{ [itemId: string]: { primary: number; secondary: number } }> {
    try {
      const result = await invoke<{
        [itemId: string]: { primary?: number; secondary?: number };
      }>("get_inventory_levels_for_locations", {
        inventoryItemIds,
        primaryLocationName,
      });
      console.log(
        `🔍 Raw API Response - get_inventory_levels_for_locations:`,
        result
      );
      console.log(`🏪 Primary location: ${primaryLocationName}`);
      console.log(
        `📊 Inventory levels for ${inventoryItemIds.length} items:`,
        inventoryItemIds
      );

      // Ensure all items have both primary and secondary values
      const processedResult: {
        [itemId: string]: { primary: number; secondary: number };
      } = {};
      for (const itemId of inventoryItemIds) {
        const itemData = result[itemId] || {};
        processedResult[itemId] = {
          primary: itemData.primary || 0,
          secondary: itemData.secondary || 0,
        };
      }

      return processedResult;
    } catch (error) {
      console.error("Error fetching location-aware inventory levels:", error);
      throw new Error(`Failed to fetch inventory levels: ${error}`);
    }
  }

  /**
   * Get inventory levels for specific items (legacy function)
   */
  static async getInventoryLevels(
    inventoryItemIds: string[]
  ): Promise<{ [itemId: string]: { [locationId: string]: number } }> {
    try {
      const result = await invoke<{
        [itemId: string]: { [locationId: string]: number };
      }>("get_inventory_levels", { inventoryItemIds });
      console.log(`🔍 Raw API Response - get_inventory_levels:`, result);
      console.log(
        `📊 Inventory levels for ${inventoryItemIds.length} items:`,
        inventoryItemIds
      );
      return result;
    } catch (error) {
      console.error("Error fetching inventory levels:", error);
      throw new Error(`Failed to fetch inventory levels: ${error}`);
    }
  }

  /**
   * Adjust inventory quantities
   */
  static async adjustInventory(
    updates: InventoryUpdate[]
  ): Promise<StatusResponse> {
    try {
      const result = await invoke<StatusResponse>("adjust_inventory", {
        updates,
      });
      console.log(`🔍 Raw API Response - adjust_inventory:`, result);
      console.log(`📝 Inventory adjustments:`, updates);
      return result;
    } catch (error) {
      console.error("Error adjusting inventory:", error);
      throw new Error(`Failed to adjust inventory: ${error}`);
    }
  }

  /**
   * Set exact inventory level
   */
  static async setInventoryLevel(
    inventoryItemId: string,
    locationId: string,
    quantity: number
  ): Promise<StatusResponse> {
    try {
      const result = await invoke<StatusResponse>("set_inventory_level", {
        inventoryItemId,
        locationId,
        quantity,
      });
      console.log(`🔍 Raw API Response - set_inventory_level:`, result);
      console.log(
        `📝 Set inventory: Item ${inventoryItemId} at location ${locationId} to ${quantity}`
      );
      return result;
    } catch (error) {
      console.error("Error setting inventory level:", error);
      throw new Error(`Failed to set inventory level: ${error}`);
    }
  }

  /**
   * Get products with low stock
   */
  static async getLowStockProducts(threshold: number): Promise<any[]> {
    try {
      const result = await invoke<any[]>("get_low_stock_products", {
        threshold,
      });
      console.log(
        `🔍 Raw API Response - get_low_stock_products (threshold: ${threshold}):`,
        result
      );
      console.log(`📊 Found ${result.length} products with low stock`);
      return result;
    } catch (error) {
      console.error("Error fetching low stock products:", error);
      throw new Error(`Failed to fetch low stock products: ${error}`);
    }
  }

  /**
   * Decrease inventory by 1 and log to Firebase (enhanced function)
   */
  static async decreaseInventoryWithLogging(
    inventoryItemId: string,
    locationId: string,
    productId: string,
    variantTitle: string,
    productName: string,
    price: string,
    negozio: string,
    images: string[]
  ): Promise<StatusResponse> {
    try {
      const result = await invoke<StatusResponse>(
        "decrease_inventory_with_logging",
        {
          inventoryItemId,
          locationId,
          productId,
          variantTitle,
          productName,
          price,
          negozio,
          images,
        }
      );
      console.log(
        `🔍 Raw API Response - decrease_inventory_with_logging:`,
        result
      );
      console.log(
        `📝 Decreased inventory for ${productName} (${variantTitle}) at ${negozio}`
      );
      return result;
    } catch (error) {
      console.error("Error decreasing inventory with logging:", error);
      throw new Error(`Failed to decrease inventory: ${error}`);
    }
  }

  /**
   * Undo inventory decrease (increase by 1) and log to Firebase (enhanced function)
   */
  static async undoDecreaseInventoryWithLogging(
    inventoryItemId: string,
    locationId: string,
    productId: string,
    variantTitle: string,
    productName: string,
    price: string,
    negozio: string,
    images: string[]
  ): Promise<StatusResponse> {
    try {
      const result = await invoke<StatusResponse>(
        "undo_decrease_inventory_with_logging",
        {
          inventoryItemId,
          locationId,
          productId,
          variantTitle,
          productName,
          price,
          negozio,
          images,
        }
      );
      console.log(
        `🔍 Raw API Response - undo_decrease_inventory_with_logging:`,
        result
      );
      console.log(
        `📝 Undid inventory decrease for ${productName} (${variantTitle}) at ${negozio}`
      );
      return result;
    } catch (error) {
      console.error("Error undoing inventory decrease with logging:", error);
      throw new Error(`Failed to undo inventory decrease: ${error}`);
    }
  }
}

// Firebase API functions
export class FirebaseAPI {
  /**
   * Create a log entry in Firebase
   */
  static async createLog(
    requestType: string,
    data: LogData
  ): Promise<StatusResponse> {
    try {
      const result = await invoke<StatusResponse>("create_log", {
        requestType,
        data,
      });
      console.log(`🔍 Raw API Response - create_log (${requestType}):`, result);
      console.log(`📝 Log data:`, data);
      return result;
    } catch (error) {
      console.error("Error creating log:", error);
      throw new Error(`Failed to create log: ${error}`);
    }
  }

  /**
   * Get logs from Firebase with optional filtering
   */
  static async getLogs(query?: string, location?: string): Promise<LogEntry[]> {
    try {
      const result = await invoke<LogEntry[]>("get_logs", {
        query: query || null,
        location: location || "Treviso", // Default to Treviso
      });
      console.log(
        `🔍 Raw API Response - get_logs (query: ${query}, location: ${location}):`,
        result
      );
      console.log(`📊 Found ${result.length} log entries`);
      return result;
    } catch (error) {
      console.error("Error fetching logs:", error);
      throw new Error(`Failed to fetch logs: ${error}`);
    }
  }

  /**
   * Get Firebase configuration
   */
  static async getFirebaseConfig(): Promise<FirebaseConfig> {
    try {
      const result = await invoke<FirebaseConfig>("get_firebase_config");
      console.log(`🔍 Raw API Response - get_firebase_config:`, result);
      return result;
    } catch (error) {
      console.error("Error fetching Firebase config:", error);
      throw new Error(`Failed to fetch Firebase config: ${error}`);
    }
  }

  /**
   * Helper function to create inventory log data
   */
  static createInventoryLogData(
    productId: string,
    variantTitle: string,
    negozio: string,
    inventoryItemId: string,
    productName: string,
    price: string,
    adjustment: number,
    images: string[]
  ): LogData {
    return {
      id: productId,
      variant: variantTitle,
      negozio,
      inventory_item_id: inventoryItemId,
      nome: productName,
      prezzo: price,
      rettifica: adjustment,
      images,
    };
  }

  /**
   * Get logs from Firebase with date range filtering
   */
  static async getLogsDateRange(
    startDate: string,
    endDate: string,
    query?: string,
    location?: string
  ): Promise<LogEntry[]> {
    try {
      const result = await invoke<LogEntry[]>("get_logs_date_range", {
        query: query || null,
        location: location || "Treviso", // Default to Treviso
        startDate,
        endDate,
      });
      console.log(
        `🔍 Raw API Response - get_logs_date_range (${startDate} to ${endDate}, query: ${query}, location: ${location}):`,
        result
      );
      console.log(`📊 Found ${result.length} log entries in date range`);
      return result;
    } catch (error) {
      console.error("Error fetching logs with date range:", error);
      throw new Error(`Failed to fetch logs with date range: ${error}`);
    }
  }
}

// Location API functions
export class LocationAPI {
  /**
   * Get the currently set app location
   */
  static async getAppLocation(): Promise<string> {
    try {
      const result = await invoke<string>("get_app_location");
      console.log(`🔍 Raw API Response - get_app_location:`, result);
      return result;
    } catch (error) {
      console.error("Error fetching app location:", error);
      throw new Error(`Failed to fetch app location: ${error}`);
    }
  }

  /**
   * Set the app location
   */
  static async setAppLocation(location: string): Promise<StatusResponse> {
    try {
      const result = await invoke<StatusResponse>("set_app_location", {
        location,
      });
      console.log(
        `🔍 Raw API Response - set_app_location (${location}):`,
        result
      );
      return result;
    } catch (error) {
      console.error("Error setting app location:", error);
      throw new Error(`Failed to set app location: ${error}`);
    }
  }

  /**
   * Get all available locations
   */
  static async getAvailableLocations(): Promise<LocationInfo[]> {
    try {
      const result = await invoke<LocationInfo[]>("get_available_locations");
      console.log(`🔍 Raw API Response - get_available_locations:`, result);
      return result;
    } catch (error) {
      console.error("Error fetching available locations:", error);
      throw new Error(`Failed to fetch available locations: ${error}`);
    }
  }

  /**
   * Get location info by name
   */
  static async getLocationByName(locationName: string): Promise<LocationInfo> {
    try {
      const result = await invoke<LocationInfo>("get_location_by_name", {
        locationName,
      });
      console.log(
        `🔍 Raw API Response - get_location_by_name (${locationName}):`,
        result
      );
      return result;
    } catch (error) {
      console.error("Error fetching location by name:", error);
      throw new Error(`Failed to fetch location by name: ${error}`);
    }
  }

  /**
   * Get current location configuration (primary and secondary)
   */
  static async getCurrentLocationConfig(): Promise<LocationConfig> {
    try {
      const result = await invoke<LocationConfig>(
        "get_current_location_config"
      );
      console.log(`🔍 Raw API Response - get_current_location_config:`, result);
      return result;
    } catch (error) {
      console.error("Error fetching current location config:", error);
      throw new Error(`Failed to fetch current location config: ${error}`);
    }
  }
}

// Status API functions
export class StatusAPI {
  /**
   * Test Shopify connection
   */
  static async testShopifyConnection(): Promise<StatusResponse> {
    try {
      const result = await invoke<StatusResponse>("test_shopify_connection");
      console.log("🔍 Raw API Response - test_shopify_connection:", result);
      return result;
    } catch (error) {
      console.error("Error testing Shopify connection:", error);
      throw new Error(`Failed to test connection: ${error}`);
    }
  }

  /**
   * Test greeting function
   */
  static async greet(name: string): Promise<string> {
    try {
      const result = await invoke<string>("greet", { name });
      console.log(`🔍 Raw API Response - greet (${name}):`, result);
      return result;
    } catch (error) {
      console.error("Error in greet function:", error);
      throw new Error(`Failed to greet: ${error}`);
    }
  }
}

// Combined API class for convenience
export class TauriAPI {
  static readonly Product = ProductAPI;
  static readonly Inventory = InventoryAPI;
  static readonly Firebase = FirebaseAPI;
  static readonly Location = LocationAPI;
  static readonly Status = StatusAPI;
}

export default TauriAPI;
