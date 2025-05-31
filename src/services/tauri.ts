import { invoke } from "@tauri-apps/api/core";

// Type definitions for API responses
export interface Product {
  id: string;
  title: string;
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
  static readonly Status = StatusAPI;
}

export default TauriAPI;
