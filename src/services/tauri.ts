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

// Product API functions
export class ProductAPI {
  /**
   * Get all products (limit 250)
   */
  static async getProducts(): Promise<Product[]> {
    try {
      return await invoke<Product[]>("get_products");
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
      return await invoke<Product>("get_product_by_id", { productId });
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
      return await invoke<Product[]>("search_products", { query });
    } catch (error) {
      console.error("Error searching products:", error);
      throw new Error(`Failed to search products: ${error}`);
    }
  }

  /**
   * Search products by SKU
   */
  static async searchProductsBySku(sku: string): Promise<Product[]> {
    try {
      return await invoke<Product[]>("search_products_by_sku", { sku });
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
      return await invoke<Product[]>("search_products_enhanced", { query });
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
      return await invoke<Product | null>("find_product_by_exact_sku", { sku });
    } catch (error) {
      console.error("Error finding product by exact SKU:", error);
      throw new Error(`Failed to find product by SKU: ${error}`);
    }
  }
}

// Inventory API functions
export class InventoryAPI {
  /**
   * Get inventory levels for specific items
   */
  static async getInventoryLevels(
    inventoryItemIds: string[]
  ): Promise<{ [itemId: string]: { [locationId: string]: number } }> {
    try {
      return await invoke("get_inventory_levels", { inventoryItemIds });
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
      return await invoke<StatusResponse>("adjust_inventory", { updates });
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
      return await invoke<StatusResponse>("set_inventory_level", {
        inventoryItemId,
        locationId,
        quantity,
      });
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
      return await invoke("get_low_stock_products", { threshold });
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
      return await invoke<StatusResponse>("test_shopify_connection");
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
      return await invoke<string>("greet", { name });
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
