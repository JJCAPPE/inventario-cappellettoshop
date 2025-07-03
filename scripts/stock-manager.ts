import axios, { AxiosInstance } from 'axios';
import 'dotenv/config';

// --- CONFIGURATION ---

const EXCLUDED_PRODUCT_IDS: string[] = ['3587363962985'];

interface AppConfig {
  shopDomain: string;
  accessToken: string;
  apiVersion: string;
}

// --- TYPES ---

interface ShopifyProduct {
  id: number;
  title: string;
  status: string;
  variants: {
    inventory_quantity: number;
  }[];
}

interface ProductNoStock {
  id: string;
  title: string;
  is_excluded: boolean;
}

interface UpdateResult {
  productId: string;
  title: string;
  success: boolean;
  error?: string;
}

interface UpdateSummary {
  total_found: number;
  excluded_count: number;
  eligible_count: number;
  successful_updates: number;
  failed_updates: number;
}

// --- UTILITY FUNCTIONS ---

function getAppConfig(): AppConfig {
  const shopDomain = process.env.SHOPIFY_SHOP_DOMAIN;
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
  const apiVersion = process.env.SHOPIFY_API_VERSION || '2024-07';

  if (!shopDomain || !accessToken) {
    console.error('❌ Missing required environment variables: SHOPIFY_SHOP_DOMAIN, SHOPIFY_ACCESS_TOKEN');
    process.exit(1);
  }

  return { shopDomain, accessToken, apiVersion };
}

function createShopifyClient(config: AppConfig): AxiosInstance {
  return axios.create({
    baseURL: `https://${config.shopDomain}/admin/api/${config.apiVersion}`,
    headers: {
      'X-Shopify-Access-Token': config.accessToken,
      'Content-Type': 'application/json',
    },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseLinkHeader(header: string): { next?: string } {
    if (!header) return {};
    const links: { [key: string]: string } = {};
    header.split(',').forEach(part => {
        const section = part.split(';');
        if (section.length < 2) return;
        const url = section[0].replace(/<(.*)>/, '$1').trim();
        const name = section[1].replace(/rel="(.*)"/, '$1').trim();
        links[name] = url;
    });
    return { next: links['next'] };
}


// --- CORE LOGIC ---

async function fetchAllProducts(client: AxiosInstance): Promise<ShopifyProduct[]> {
  let allProducts: ShopifyProduct[] = [];
  let url: string | undefined = '/products.json?limit=250&fields=id,title,status,variants&status=active';
  let pageCount = 0;

  while (url) {
    pageCount++;
    try {
      const response = await client.get(url);
      const products = response.data.products as ShopifyProduct[];
      console.log(`   📄 Page ${pageCount}: Fetched ${products.length} products`);
      allProducts = allProducts.concat(products);

      const linkHeader = response.headers['link'] as string;
      const parsedLink = parseLinkHeader(linkHeader);
      url = parsedLink.next;

      if (url) {
        await sleep(100); // Respect rate limits
      }

    } catch (error: any) {
      throw new Error(`Failed to fetch products: ${error.message}`);
    }
  }

  return allProducts;
}

function findProductsWithNoStock(products: ShopifyProduct[]): ProductNoStock[] {
  return products
    .filter(product => {
      if (product.status !== 'active') return false;
      const hasStock = product.variants.some(v => v.inventory_quantity > 0);
      return !hasStock;
    })
    .map(product => ({
      id: product.id.toString(),
      title: product.title,
      is_excluded: EXCLUDED_PRODUCT_IDS.includes(product.id.toString()),
    }));
}

async function updateProductsToDraft(client: AxiosInstance, products: ProductNoStock[]): Promise<UpdateResult[]> {
  const results: UpdateResult[] = [];
  for (const [index, product] of products.entries()) {
    console.log(`   📝 (${index + 1}/${products.length}) Updating: "${product.title}" (ID: ${product.id})`);

    if (product.is_excluded) {
      console.log('   🛡️ EXCLUDED - Skipping update');
      results.push({ productId: product.id, title: product.title, success: true, error: 'Excluded from updates' });
      continue;
    }

    try {
      await client.put(`/products/${product.id}.json`, {
        product: {
          id: product.id,
          status: 'draft',
        },
      });
      console.log('   ✅ Successfully set to draft');
      results.push({ productId: product.id, title: product.title, success: true });
    } catch (error: any) {
      const errorMessage = error.response?.data?.errors || error.message;
      console.error(`   ❌ Failed to update: ${JSON.stringify(errorMessage)}`);
      results.push({ productId: product.id, title: product.title, success: false, error: JSON.stringify(errorMessage) });
    }

    if (index < products.length - 1) {
        await sleep(250); // Rate limiting
    }
  }
  return results;
}

function generateSummary(products: ProductNoStock[], updateResults: UpdateResult[], dryRun: boolean): UpdateSummary {
    const total_found = products.length;
    const excluded_count = products.filter(p => p.is_excluded).length;
    const eligible_count = total_found - excluded_count;
    const successful_updates = dryRun ? 0 : updateResults.filter(r => r.success && !r.error).length;
    const failed_updates = dryRun ? 0 : updateResults.filter(r => !r.success).length;

    return { total_found, excluded_count, eligible_count, successful_updates, failed_updates };
}

function printResults(products: ProductNoStock[], updateResults: UpdateResult[], summary: UpdateSummary, dryRun: boolean) {
    console.log("\n🎯 FINAL RESULTS:");
    console.log("═".repeat(80));

    if (products.length === 0) {
        console.log("✨ No active products found with zero stock!");
    } else {
        console.log(`📦 Found ${summary.total_found} active products with no stock`);

        if (dryRun) {
            console.log("\n🧪 DRY RUN - Products that would be affected:");
            products.forEach((p, i) => {
                const status = p.is_excluded ? '[EXCLUDED]' : '';
                console.log(`${i + 1}. "${p.title}" (ID: ${p.id}) ${status}`);
            });
            if (summary.excluded_count > 0) {
                console.log(`\n🛡️ ${summary.excluded_count} products are excluded from updates.`);
            }
            console.log(`\n💡 ${summary.eligible_count} products would be updated to draft status.`);
        } else {
            console.log(`\n✅ Successfully updated: ${summary.successful_updates} products`);
            if (summary.excluded_count > 0) {
                console.log(`🛡️ Excluded from updates: ${summary.excluded_count} products`);
            }
            if (summary.failed_updates > 0) {
                console.log(`❌ Failed to update: ${summary.failed_updates} products`);
                console.log("\nFailed products:");
                updateResults.filter(r => !r.success).forEach((r, i) => {
                    console.log(`${i + 1}. "${r.title}" (ID: ${r.productId}): ${r.error}`);
                });
            }
        }
    }
    console.log("═".repeat(80));
}

function printHelp() {
    console.log(`
Shopify Stock Manager - TypeScript Edition

DESCRIPTION:
    Scans all active products in your Shopify store and automatically
    sets products with zero inventory to 'draft' status.

USAGE:
    npx tsx scripts/stock-manager.ts [OPTIONS]

OPTIONS:
    -d, --dry-run    Preview changes without making any updates.
    -h, --help       Show this help message.

CONFIGURATION:
    Reads configuration from the .env file in the project root.
    Ensure SHOPIFY_SHOP_DOMAIN and SHOPIFY_ACCESS_TOKEN are set.
    `);
}


// --- MAIN EXECUTION ---

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-d');
  const showHelp = args.includes('--help') || args.includes('-h');

  if (showHelp) {
    printHelp();
    return;
  }

  console.log("🛠️  Shopify Stock Manager (TypeScript Edition)");
  console.log("=============================================\n");

  try {
    const config = getAppConfig();
    const client = createShopifyClient(config);

    console.log(`📍 Shop: ${config.shopDomain}`);
    console.log(`🔧 API Version: ${config.apiVersion}`);
    console.log(dryRun ? "🧪 DRY RUN MODE - No changes will be made" : "⚡ LIVE MODE - Products will be set to draft status");

    console.log("\n📄 Fetching all products...");
    const allProducts = await fetchAllProducts(client);
    console.log(`✅ Fetched ${allProducts.length} total products`);

    console.log("\n🔍 Analyzing inventory...");
    const productsWithNoStock = findProductsWithNoStock(allProducts);
    console.log(`🎯 Found ${productsWithNoStock.length} active products with no stock`);

    let updateResults: UpdateResult[] = [];
    if (!dryRun && productsWithNoStock.length > 0) {
        console.log("\n📝 Updating products to draft status...");
        updateResults = await updateProductsToDraft(client, productsWithNoStock);
    }

    const summary = generateSummary(productsWithNoStock, updateResults, dryRun);
    printResults(productsWithNoStock, updateResults, summary, dryRun);

    console.log("\n🎉 Operation completed successfully!");
    if (!dryRun && summary.successful_updates > 0) {
        console.log(`📈 Updated ${summary.successful_updates} products to draft status`);
    }

  } catch (error: any) {
    console.error(`\n❌ Operation failed: ${error.message}`);
    process.exit(1);
  }
}

main();