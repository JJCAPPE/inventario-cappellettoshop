import axios, { AxiosInstance } from "axios";
import "dotenv/config";

// --- CONFIGURATION ---

interface AppConfig {
  shopDomain: string;
  accessToken: string;
  apiVersion: string;
}

// --- TYPES ---

interface UpdateResult {
  productId: string;
  title: string;
  success: boolean;
  error?: string;
}

// --- UTILITY FUNCTIONS ---

function getAppConfig(): AppConfig {
  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
  const apiVersion = process.env.SHOPIFY_API_VERSION || "2024-07";

  if (!shopDomain || !accessToken) {
    console.error(
      "❌ Missing required environment variables: SHOPIFY_SHOP_DOMAIN, SHOPIFY_ACCESS_TOKEN"
    );
    process.exit(1);
  }

  return { shopDomain, accessToken, apiVersion };
}

function createShopifyClient(config: AppConfig): AxiosInstance {
  return axios.create({
    baseURL: `https://${config.shopDomain}/admin/api/${config.apiVersion}`,
    headers: {
      "X-Shopify-Access-Token": config.accessToken,
      "Content-Type": "application/json",
    },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function retry<T>(
  fn: () => Promise<T>,
  retries = 5,
  delay = 1000
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && error.response && error.response.status === 429) {
      const retryAfter = error.response.headers["retry-after"]
        ? parseInt(error.response.headers["retry-after"]) * 1000
        : delay;
      console.warn(
        `⚠️ Rate limit hit. Retrying in ${retryAfter / 1000} seconds...`
      );
      await sleep(retryAfter);
      return retry(fn, retries - 1, delay * 2); // Exponential backoff
    }
    throw error;
  }
}

// --- CORE LOGIC ---

async function getProductTitle(
  client: AxiosInstance,
  productId: string
): Promise<string> {
  try {
    const response = await retry(() =>
      client.get(`/products/${productId}.json?fields=title`)
    );
    return response.data.product.title;
  } catch (error) {
    console.warn(
      `⚠️ Could not fetch title for product ID ${productId}: ${error.message}`
    );
    return `Unknown Product (ID: ${productId})`;
  }
}

async function updateProductsToActive(
  client: AxiosInstance,
  productIds: string[],
  log: (message: string) => void
): Promise<UpdateResult[]> {
  const results: UpdateResult[] = [];
  for (const [index, productId] of productIds.entries()) {
    const title = await getProductTitle(client, productId);
    log(
      `   📝 (${index + 1}/${
        productIds.length
      }) Updating: "${title}" (ID: ${productId})`
    );

    try {
      await retry(() =>
        client.put(`/products/${productId}.json`, {
          product: {
            id: productId,
            status: "active",
          },
        })
      );
      log("   ✅ Successfully set to active");
      results.push({ productId: productId, title: title, success: true });
    } catch (error: any) {
      const errorMessage = error.response?.data?.errors || error.message;
      log(`   ❌ Failed to update: ${JSON.stringify(errorMessage)}`);
      results.push({
        productId: productId,
        title: title,
        success: false,
        error: JSON.stringify(errorMessage),
      });
    }

    if (index < productIds.length - 1) {
      await sleep(250);
    }
  }
  return results;
}

// --- MAIN EXECUTION ---

async function main() {
  const log = (message: string) => console.log(message);

  log("🛠️  Shopify Product Activator");
  log("=============================================\n");

  try {
    const config = getAppConfig();
    const client = createShopifyClient(config);

    log(`📍 Shop: ${config.shopDomain}`);
    log(`🔧 API Version: ${config.apiVersion}`);

    // Add your product IDs here
    const productIdsToActivate: string[] = [
      // Products to activate eg: '14877385392476'
    ];

    if (productIdsToActivate.length === 0) {
      log(
        "⚠️ No products to activate. Please add product IDs to the 'productIdsToActivate' array in the script."
      );
      return;
    }

    log(`\n📝 Activating ${productIdsToActivate.length} products...`);
    const updateResults = await updateProductsToActive(
      client,
      productIdsToActivate,
      log
    );

    const successfulUpdates = updateResults.filter((r) => r.success).length;
    const failedUpdates = updateResults.filter((r) => !r.success).length;

    log("\n🎉 Operation completed!");
    log(`📈 Successfully activated ${successfulUpdates} products.`);
    if (failedUpdates > 0) {
      log(`❌ Failed to activate ${failedUpdates} products.`);
      updateResults
        .filter((r) => !r.success)
        .forEach((r) => {
          log(`   - ${r.title} (ID: ${r.productId}): ${r.error}`);
        });
    }
  } catch (error: any) {
    console.error(`\n❌ Operation failed: ${error.message}`);
    process.exit(1);
  }
}

main();
