import { invoke } from "@tauri-apps/api/core";
import type {
  Product,
  LocationConfig,
  InventoryUpdate,
  StatusResponse,
  ProductModificationHistory,
  EnhancedStatusResponse,
  LocationInfo,
  FirebaseConfig,
  LogData,
  CheckRequestWithId,
} from "../types/index";
import { message } from "antd";

// Local type definitions that don't conflict
export interface ProductVariant {
  inventory_item_id: string;
  title: string;
  inventory_quantity: number;
  price: string;
  sku?: string;
}

// Firebase-related type definitions
export interface LogEntry {
  requestType: string;
  data: LogData;
  timestamp: string;
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
   * Enhanced search - checks SKU first, then falls back to title search
   */
  static async enhancedSearchProducts(query: string): Promise<Product[]> {
    try {
      const result = await invoke<Product[]>("enhanced_search_products", {
        query,
      });
      console.log(
        `🔍 Raw API Response - enhanced_search_products (${query}):`,
        result
      );
      return result;
    } catch (error) {
      console.error("Error in enhanced search:", error);
      throw new Error(`Failed to search products: ${error}`);
    }
  }

  /**
   * Search products by SKU using GraphQL
   */
  static async searchProductsBySkuGraphQL(sku: string): Promise<Product[]> {
    try {
      const result = await invoke<Product[]>("search_products_by_sku_graphql", {
        sku,
      });
      console.log(
        `🔍 Raw API Response - search_products_by_sku_graphql (${sku}):`,
        result
      );
      return result;
    } catch (error) {
      console.error("Error searching products by SKU with GraphQL:", error);
      throw new Error(`Failed to search products by SKU: ${error}`);
    }
  }

  /**
   * Find exact product by SKU using GraphQL - returns product and matching variant ID
   */
  static async findProductByExactSkuGraphQL(
    sku: string
  ): Promise<{ product: Product; variantInventoryItemId: string } | null> {
    try {
      const result = await invoke<[Product, string] | null>(
        "find_product_by_exact_sku_graphql",
        { sku }
      );
      console.log(
        `🔍 Raw API Response - find_product_by_exact_sku_graphql (${sku}):`,
        result
      );
      if (result) {
        const [product, variantInventoryItemId] = result;
        console.log(
          `✅ Found exact SKU match: ${product.title}, variant: ${variantInventoryItemId}`
        );
        return { product, variantInventoryItemId };
      } else {
        console.log(`❌ No exact SKU match found for: ${sku}`);
        return null;
      }
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
  ): Promise<EnhancedStatusResponse> {
    try {
      const result = await invoke<EnhancedStatusResponse>(
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

      // Show enhanced toast notifications based on status changes
      if (result.status_changed === "to_draft") {
        message.warning({
          content: `${productName} è stato impostato come bozza (inventario esaurito)`,
          duration: 5,
        });
      }

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
  ): Promise<EnhancedStatusResponse> {
    try {
      const result = await invoke<EnhancedStatusResponse>(
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

      // Show enhanced toast notifications based on status changes
      if (result.status_changed === "to_active") {
        message.success({
          content: `${productName} è stato riattivato (inventario disponibile)`,
          duration: 5,
        });
      }

      return result;
    } catch (error) {
      console.error("Error undoing inventory decrease with logging:", error);
      throw new Error(`Failed to undo inventory decrease: ${error}`);
    }
  }

  /**
   * Get modification history for a specific product
   */
  static async getProductModificationHistory(
    productId: string,
    location: string,
    daysBack: number
  ): Promise<ProductModificationHistory> {
    try {
      const result = await invoke<ProductModificationHistory>(
        "get_product_modification_history",
        {
          productId,
          location,
          daysBack,
        }
      );
      console.log(
        `🔍 Raw API Response - get_product_modification_history:`,
        result
      );
      console.log(`📊 Analysis for product ${productId} over ${daysBack} days`);
      return result;
    } catch (error) {
      console.error("Error getting product modification history:", error);
      throw new Error(`Failed to get modification history: ${error}`);
    }
  }

  /**
   * Transfer inventory between locations and log to Firebase
   */
  static async transferInventoryBetweenLocations(
    inventoryItemId: string,
    fromLocationId: string,
    toLocationId: string,
    productId: string,
    variantTitle: string,
    productName: string,
    price: string,
    fromLocation: string,
    toLocation: string,
    images: string[]
  ): Promise<EnhancedStatusResponse> {
    try {
      const result = await invoke<EnhancedStatusResponse>(
        "transfer_inventory_between_locations",
        {
          inventoryItemId,
          fromLocationId,
          toLocationId,
          productId,
          variantTitle,
          productName,
          price,
          fromLocation,
          toLocation,
          images,
        }
      );

      console.log(
        `🔍 Raw API Response - transfer_inventory_between_locations:`,
        result
      );
      console.log(
        `📝 Transferred inventory for ${productName} (${variantTitle}) from ${fromLocation} to ${toLocation}`
      );

      return result;
    } catch (error) {
      console.error("Error transferring inventory between locations:", error);
      throw new Error(`Failed to transfer inventory: ${error}`);
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

  /**
   * Get logs for a specific product ID within a date range
   */
  static async getLogsByProductId(
    productId: string,
    location: string,
    startDate: string,
    endDate: string
  ): Promise<LogEntry[]> {
    try {
      const result = await invoke<LogEntry[]>("get_logs_by_product_id", {
        productId,
        location,
        startDate,
        endDate,
      });
      console.log(
        `🔍 Raw API Response - get_logs_by_product_id (product: ${productId}, location: ${location}):`,
        result
      );
      console.log(`📊 Found ${result.length} logs for product ${productId}`);
      return result;
    } catch (error) {
      console.error("Error fetching logs by product ID:", error);
      throw new Error(`Failed to fetch product logs: ${error}`);
    }
  }

  /**
   * Create a check request document in Firebase
   */
  static async createCheckRequest(checkRequest: any): Promise<void> {
    try {
      console.log("🔄 Creating check request in Firebase:", checkRequest);
      await invoke("create_check_request", { checkRequest });
      console.log("✅ Check request created successfully");
    } catch (error) {
      console.error("❌ Error creating check request:", error);
      throw new Error(`Failed to create check request: ${error}`);
    }
  }

  /**
   * Get check requests from Firebase filtered by location
   */
  static async getCheckRequests(
    location: string
  ): Promise<CheckRequestWithId[]> {
    try {
      const result = await invoke<CheckRequestWithId[]>("get_check_requests", {
        location,
      });
      console.log(
        `🔍 Raw API Response - get_check_requests (location: ${location}):`,
        result
      );
      console.log(`📊 Found ${result.length} check requests for ${location}`);
      return result;
    } catch (error) {
      console.error("Error fetching check requests:", error);
      throw new Error(`Failed to fetch check requests: ${error}`);
    }
  }

  /**
   * Update a check request status (complete or cancel)
   */
  static async updateCheckRequest(
    documentId: string,
    status: "completed" | "cancelled",
    closingNotes: string
  ): Promise<void> {
    try {
      console.log(
        `🔄 Updating check request ${documentId} to status: ${status}`
      );
      await invoke("update_check_request", {
        documentId,
        status,
        closingNotes,
      });
      console.log("✅ Check request updated successfully");
    } catch (error) {
      console.error("❌ Error updating check request:", error);
      throw new Error(`Failed to update check request: ${error}`);
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
