import axios, { AxiosInstance } from "axios";
import "dotenv/config";
import nodemailer from "nodemailer";

// --- CONFIGURATION ---

const EXCLUDED_PRODUCT_IDS: string[] = ["3587363962985"];

// Configuration interfaces
interface AppConfig {
  shopDomain: string;
  accessToken: string;
  apiVersion: string;
}

interface EmailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  to: string;
}

// --- ENHANCED TYPES ---

interface ShopifyVariant {
  id: number;
  inventory_quantity: number;
  inventory_item_id: number;
  sku: string;
  title: string;
  price: string;
}

interface ShopifyProduct {
  id: number;
  title: string;
  status: string;
  variants: ShopifyVariant[];
}

interface InventoryLevel {
  inventory_item_id: number;
  available: number;
  location_id: number;
}

interface ProductStockInfo {
  id: string;
  title: string;
  totalStock: number;
  variants: VariantStockInfo[];
  is_excluded: boolean;
  stockSources: {
    inventoryLevels: number;
    variantQuantities: number;
    agreementStatus: "MATCH" | "DISCREPANCY" | "PARTIAL_MATCH";
  };
}

interface VariantStockInfo {
  id: number;
  sku: string;
  title: string;
  inventoryItemId: number;
  inventoryLevelStock: number;
  variantQuantityStock: number;
  finalStock: number;
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
  discrepancies_found: number;
  negative_stock_count: number;
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

function getEmailConfig(): EmailConfig | null {
  const host = process.env.EMAIL_SERVER_HOST;
  const port = process.env.EMAIL_SERVER_PORT;
  const user = process.env.EMAIL_SERVER_USER;
  const pass = process.env.EMAIL_SERVER_PASSWORD;
  const from = process.env.EMAIL_FROM;
  const to = "elisa@cappellettoshop.it, giacomo.cappelletto@icloud.com";

  if (!host || !port || !user || !pass || !from) {
    return null;
  }

  return {
    host,
    port: parseInt(port, 10),
    user,
    pass,
    from,
    to,
  };
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
      return retry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

function parseLinkHeader(header: string): { next?: string } {
  if (!header) return {};
  const links: { [key: string]: string } = {};
  header.split(",").forEach((part) => {
    const section = part.split(";");
    if (section.length < 2) return;
    const url = section[0].replace(/<(.*)>/, "$1").trim();
    const name = section[1].replace(/rel="(.*)"/, "$1").trim();
    links[name] = url;
  });
  return { next: links["next"] };
}

// --- ENHANCED CORE LOGIC ---

async function fetchAllProducts(
  client: AxiosInstance,
  log: (message: string) => void
): Promise<ShopifyProduct[]> {
  let allProducts: ShopifyProduct[] = [];
  let url:
    | string
    | undefined = `/products.json?limit=250&fields=id,title,status,variants&status=active`;
  let pageCount = 0;

  while (url) {
    pageCount++;
    try {
      const response = await retry(() => client.get(url!));
      const products = response.data.products as ShopifyProduct[];
      log(`   📄 Page ${pageCount}: Fetched ${products.length} products`);
      allProducts = allProducts.concat(products);

      const linkHeader = response.headers["link"] as string;
      const parsedLink = parseLinkHeader(linkHeader);
      url = parsedLink.next;

      if (url) {
        await sleep(500);
      }
    } catch (error: any) {
      throw new Error(`Failed to fetch products: ${error.message}`);
    }
  }

  return allProducts;
}

async function getInventoryLevels(
  client: AxiosInstance,
  itemIds: number[],
  log: (message: string) => void
): Promise<Map<number, number>> {
  const inventoryMap = new Map<number, number>();
  const batchSize = 50;

  for (let i = 0; i < itemIds.length; i += batchSize) {
    const batch = itemIds.slice(i, i + batchSize);
    log(
      `   📦 Fetching inventory for ${batch.length} items (batch ${
        Math.floor(i / batchSize) + 1
      })...`
    );

    try {
      const response = await retry(() =>
        client.get(
          `/inventory_levels.json?inventory_item_ids=${batch.join(",")}`
        )
      );
      const levels = response.data.inventory_levels as InventoryLevel[];

      for (const level of levels) {
        const current = inventoryMap.get(level.inventory_item_id) || 0;
        const newTotal = current + (level.available || 0);
        inventoryMap.set(level.inventory_item_id, newTotal);
      }

      log(
        `      ✅ Successfully fetched ${levels.length} inventory levels from this batch`
      );
    } catch (error: any) {
      log(
        `      ⚠️ Failed to fetch inventory levels for batch ${
          Math.floor(i / batchSize) + 1
        }: ${error.message}`
      );
      // Continue with other batches even if one fails
    }

    await sleep(500);
  }

  return inventoryMap;
}

async function analyzeProductStock(
  client: AxiosInstance,
  products: ShopifyProduct[],
  log: (message: string) => void
): Promise<ProductStockInfo[]> {
  const allInventoryItemIds = products.flatMap((p) =>
    p.variants.map((v) => v.inventory_item_id)
  );
  log(
    `🔍 Found ${allInventoryItemIds.length} total inventory items to analyze.`
  );

  // Get inventory levels from the API
  const inventoryLevels = await getInventoryLevels(
    client,
    allInventoryItemIds,
    log
  );
  log(`✅ Fetched inventory levels for ${inventoryLevels.size} items.`);

  const productStockInfos: ProductStockInfo[] = [];

  for (const product of products) {
    if (product.status !== "active") continue;

    const variants: VariantStockInfo[] = [];
    let totalInventoryLevelsStock = 0;
    let totalVariantQuantitiesStock = 0;

    log(`\n   🔍 Analyzing "${product.title}" (ID: ${product.id}):`);

    // Analyze each variant
    for (const variant of product.variants) {
      const inventoryLevelStock =
        inventoryLevels.get(variant.inventory_item_id) || 0;
      const variantQuantityStock = variant.inventory_quantity || 0;

      // Use variant quantity as primary source since it's more reliable
      // Only fall back to inventory levels if variant quantity is missing/null
      const finalStock =
        variantQuantityStock !== null && variantQuantityStock !== undefined
          ? variantQuantityStock
          : inventoryLevelStock;

      variants.push({
        id: variant.id,
        sku: variant.sku || "",
        title: variant.title,
        inventoryItemId: variant.inventory_item_id,
        inventoryLevelStock,
        variantQuantityStock,
        finalStock,
      });

      totalInventoryLevelsStock += inventoryLevelStock;
      totalVariantQuantitiesStock += variantQuantityStock;

      log(`      📦 Variant "${variant.title}" (SKU: ${variant.sku}):`);
      log(`         - Inventory Levels API: ${inventoryLevelStock}`);
      log(
        `         - Variant Quantity: ${variantQuantityStock} ✓ (primary source)`
      );
      log(`         - Final Stock: ${finalStock}`);
    }

    // Calculate total using conservative approach
    const totalStock = variants.reduce((sum, v) => sum + v.finalStock, 0);

    // Determine agreement status
    let agreementStatus: "MATCH" | "DISCREPANCY" | "PARTIAL_MATCH" = "MATCH";
    if (Math.abs(totalInventoryLevelsStock - totalVariantQuantitiesStock) > 0) {
      if (
        totalInventoryLevelsStock === 0 ||
        totalVariantQuantitiesStock === 0
      ) {
        agreementStatus = "DISCREPANCY";
      } else {
        agreementStatus = "PARTIAL_MATCH";
      }
    }

    log(`      📊 Summary:`);
    log(`         - Total via Inventory Levels: ${totalInventoryLevelsStock}`);
    log(
      `         - Total via Variant Quantities: ${totalVariantQuantitiesStock} ✓ (primary)`
    );
    log(`         - Final Total: ${totalStock}`);
    log(`         - Agreement Status: ${agreementStatus}`);

    productStockInfos.push({
      id: product.id.toString(),
      title: product.title,
      totalStock,
      variants,
      is_excluded: EXCLUDED_PRODUCT_IDS.includes(product.id.toString()),
      stockSources: {
        inventoryLevels: totalInventoryLevelsStock,
        variantQuantities: totalVariantQuantitiesStock,
        agreementStatus,
      },
    });
  }

  return productStockInfos;
}

function findProductsWithNoStock(
  productStockInfos: ProductStockInfo[]
): ProductStockInfo[] {
  return productStockInfos.filter((product) => product.totalStock <= 0);
}

function findProductsWithNegativeStock(
  productStockInfos: ProductStockInfo[]
): ProductStockInfo[] {
  return productStockInfos.filter((product) =>
    product.variants.some((variant) => variant.variantQuantityStock < 0)
  );
}

async function updateProductsToDraft(
  client: AxiosInstance,
  products: ProductStockInfo[],
  log: (message: string) => void
): Promise<UpdateResult[]> {
  const results: UpdateResult[] = [];
  for (const [index, product] of products.entries()) {
    log(
      `   📝 (${index + 1}/${products.length}) Updating: "${
        product.title
      }" (ID: ${product.id})`
    );

    if (product.is_excluded) {
      log("   🛡️ EXCLUDED - Skipping update");
      results.push({
        productId: product.id,
        title: product.title,
        success: true,
        error: "Excluded from updates",
      });
      continue;
    }

    try {
      await client.put(`/products/${product.id}.json`, {
        product: {
          id: product.id,
          status: "draft",
        },
      });
      log("   ✅ Successfully set to draft");
      results.push({
        productId: product.id,
        title: product.title,
        success: true,
      });
    } catch (error: any) {
      const errorMessage = error.response?.data?.errors || error.message;
      log(`   ❌ Failed to update: ${JSON.stringify(errorMessage)}`);
      results.push({
        productId: product.id,
        title: product.title,
        success: false,
        error: JSON.stringify(errorMessage),
      });
    }

    if (index < products.length - 1) {
      await sleep(250);
    }
  }
  return results;
}

function generateSummary(
  products: ProductStockInfo[],
  updateResults: UpdateResult[],
  dryRun: boolean
): UpdateSummary {
  const productsWithNoStock = products.filter(
    (product) => product.totalStock <= 0
  );
  const total_found = productsWithNoStock.length;
  const excluded_count = productsWithNoStock.filter(
    (p) => p.is_excluded
  ).length;
  const eligible_count = total_found - excluded_count;
  const successful_updates = dryRun
    ? 0
    : updateResults.filter((r) => r.success && !r.error).length;
  const failed_updates = dryRun
    ? 0
    : updateResults.filter((r) => !r.success).length;
  const discrepancies_found = products.filter(
    (p) => p.stockSources.agreementStatus !== "MATCH"
  ).length;
  const negative_stock_count = products.filter(
    (p) =>
      !p.is_excluded &&
      p.variants.some((variant) => variant.variantQuantityStock < 0)
  ).length;

  return {
    total_found,
    excluded_count,
    eligible_count,
    successful_updates,
    failed_updates,
    discrepancies_found,
    negative_stock_count,
  };
}

function generateHtmlReport(
  summary: UpdateSummary,
  products: ProductStockInfo[],
  updateResults: UpdateResult[],
  dryRun: boolean,
  shopDomain: string
): string {
  const now = new Date().toLocaleString("it-IT", { timeZone: "CET" });
  const adminUrl = `https://${shopDomain}/admin`;

  let body = `
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #333; background-color: #f4f5f7; }
            .container { max-width: 900px; margin: 20px auto; padding: 20px; border-radius: 8px; background-color: #fff; box-shadow: 0 4px 8px rgba(0,0,0,0.05); }
            h1, h2 { color: #111; }
            h1 { font-size: 24px; text-align: center; margin-bottom: 10px; }
            h2 { font-size: 20px; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-top: 40px; }
            .subtitle { text-align: center; color: #666; margin-bottom: 30px; }
            .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; margin: 20px 0; }
            .summary-item { background-color: #f9fafb; padding: 20px; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb; }
            .summary-item strong { display: block; font-size: 28px; color: #005b99; }
            .product-table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px; }
            .product-table th, .product-table td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #ddd; }
            .product-table th { background-color: #f2f2f2; font-weight: bold; }
            .product-table tr:hover { background-color: #f5f5f5; }
            .status-cell { text-align: right; }
            .status-tag { padding: 4px 8px; border-radius: 12px; font-weight: bold; font-size: 0.8em; }
            .status-success { background-color: #d4edda; color: #155724; }
            .status-fail { background-color: #f8d7da; color: #721c24; }
            .status-excluded { background-color: #fff3cd; color: #856404; }
            .status-info { background-color: #d1ecf1; color: #0c5460; }
            .status-warning { background-color: #ffeaa7; color: #856404; }
            .error-msg { color: #d9534f; font-size: 0.8em; }
            a { color: #007bff; text-decoration: none; }
            a:hover { text-decoration: underline; }
            footer { margin-top: 40px; text-align: center; font-size: 0.8em; color: #888; }
            .discrepancy-note { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
        </style>
        <div class="container">
            <h1>Report Inventario Shopify (Versione Migliorata)</h1>
            <p class="subtitle">Controllo automatico eseguito il: <strong>${now}</strong> | Negozio: <a href="https://${shopDomain}">${shopDomain}</a></p>
            ${
              dryRun
                ? '<h2 style="color: #f0ad4e; text-align: center;">⚠️ ESECUZIONE IN MODALITÀ ANTEPRIMA (DRY RUN) ⚠️</h2>'
                : ""
            }

            <h2>Riepilogo</h2>
            <div class="summary-grid">
                <div class="summary-item">Prodotti Trovati<strong>${
                  summary.total_found
                }</strong></div>
                <div class="summary-item">Prodotti Aggiornati<strong>${
                  summary.successful_updates
                }</strong></div>
                <div class="summary-item">Aggiornamenti Falliti<strong>${
                  summary.failed_updates
                }</strong></div>
                <div class="summary-item">Prodotti Esclusi<strong>${
                  summary.excluded_count
                }</strong></div>
                <div class="summary-item">Quantità Negative<strong style="color: #dc3545;">${
                  summary.negative_stock_count
                }</strong></div>
            </div>
    `;

  // Add negative stock products table if any exist (excluding blacklisted products)
  const negativeStockProducts = products.filter(
    (p) =>
      !p.is_excluded &&
      p.variants.some((variant) => variant.variantQuantityStock < 0)
  );

  if (negativeStockProducts.length > 0) {
    body += `
        <h2 style="color: #dc3545;">⚠️ Prodotti con Quantità Negative (Errori di Inventario)</h2>
        <div style="background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 15px; margin: 20px 0;">
            <strong>Attenzione:</strong> I seguenti prodotti hanno varianti con quantità negative. Questo indica errori nei dati di inventario che dovrebbero essere corretti manualmente.
        </div>
        <table class="product-table">
            <thead>
                <tr>
                    <th>Prodotto</th>
                    <th>ID</th>
                    <th>Varianti con Quantità Negative</th>
                    <th>Stock Totale</th>
                </tr>
            </thead>
            <tbody>`;

    negativeStockProducts.forEach((product) => {
      const negativeVariants = product.variants.filter(
        (v) => v.variantQuantityStock < 0
      );
      const variantDetails = negativeVariants
        .map(
          (v) => `${v.title} (${v.sku || "No SKU"}): ${v.variantQuantityStock}`
        )
        .join("<br>");

      body += `
                <tr>
                    <td><a href="${adminUrl}/products/${product.id}">${product.title}</a></td>
                    <td>${product.id}</td>
                    <td style="color: #dc3545; font-weight: bold;">${variantDetails}</td>
                    <td>${product.totalStock}</td>
                </tr>`;
    });

    body += `
            </tbody>
        </table>`;
  }

  const renderTable = (
    title: string,
    items: any[],
    columns: { header: string; cell: (item: any) => string }[]
  ) => {
    let table = `<h2>${title}</h2>`;
    if (items.length === 0) {
      return table + "<p>Nessun prodotto in questa categoria.</p>";
    }
    table += '<table class="product-table"><thead><tr>';
    columns.forEach((col) => (table += `<th>${col.header}</th>`));
    table += "</tr></thead><tbody>";
    items.forEach((item) => {
      table += "<tr>";
      columns.forEach((col) => (table += `<td>${col.cell(item)}</td>`));
      table += "</tr>";
    });
    table += "</tbody></table>";
    return table;
  };

  if (dryRun) {
    const productsWithNoStock = products.filter(
      (product) => product.totalStock <= 0
    );
    body += renderTable(
      "Prodotti che verrebbero modificati",
      productsWithNoStock,
      [
        {
          header: "Prodotto",
          cell: (p) => `<a href="${adminUrl}/products/${p.id}">${p.title}</a>`,
        },
        { header: "ID", cell: (p) => p.id },
        { header: "Stock Finale", cell: (p) => p.totalStock.toString() },
        {
          header: "Stock API",
          cell: (p) => p.stockSources.inventoryLevels.toString(),
        },
        {
          header: "Stock Varianti",
          cell: (p) => p.stockSources.variantQuantities.toString(),
        },
        {
          header: "Stato",
          cell: (p) =>
            `<div class="status-cell"><span class="status-tag ${
              p.is_excluded ? "status-excluded" : "status-info"
            }">${p.is_excluded ? "ESCLUSO" : "DA AGGIORNARE"}</span></div>`,
        },
      ]
    );
  } else {
    const updated = updateResults.filter((r) => r.success && !r.error);
    const failed = updateResults.filter((r) => !r.success);

    if (updated.length > 0) {
      body += renderTable("Prodotti Aggiornati a Bozza", updated, [
        {
          header: "Prodotto",
          cell: (r) =>
            `<a href="${adminUrl}/products/${r.productId}">${r.title}</a>`,
        },
        { header: "ID", cell: (r) => r.productId },
        {
          header: "Stato",
          cell: () =>
            `<div class="status-cell"><span class="status-tag status-success">AGGIORNATO</span></div>`,
        },
      ]);
    }

    if (failed.length > 0) {
      body += renderTable("Aggiornamenti Falliti", failed, [
        {
          header: "Prodotto",
          cell: (r) =>
            `<a href="${adminUrl}/products/${r.productId}">${r.title}</a>`,
        },
        { header: "ID", cell: (r) => r.productId },
        {
          header: "Errore",
          cell: (r) =>
            `<div class="status-cell"><span class="status-tag status-fail">FALLITO</span><br><small class="error-msg">${r.error}</small></div>`,
        },
      ]);
    }
  }

  if (summary.eligible_count === 0 && summary.negative_stock_count === 0) {
    body +=
      '<h2>Risultato</h2><p style="text-align:center; font-size: 1.2em;">✅ Tutto in ordine! Nessun prodotto con problemi di inventario trovato.</p>';
  }

  body +=
    "<footer>Questo è un report automatico migliorato che utilizza le quantità delle varianti come fonte primaria per maggiore affidabilità. Non rispondere a questa email.</footer></div>";
  return body;
}

async function sendEmailReport(
  emailConfig: EmailConfig,
  htmlBody: string,
  dryRun: boolean
) {
  const transporter = nodemailer.createTransport({
    host: emailConfig.host,
    port: emailConfig.port,
    secure: emailConfig.port === 465,
    auth: {
      user: emailConfig.user,
      pass: emailConfig.pass,
    },
  });

  const subject = dryRun
    ? "Report Inventario Shopify (DRY RUN) - Versione Migliorata"
    : "Report Inventario Shopify - Versione Migliorata";

  try {
    await transporter.sendMail({
      from: `"Shopify Stock Manager" <${emailConfig.from}>`,
      to: emailConfig.to,
      subject: subject,
      html: htmlBody,
    });
    console.log("✅ Email report sent successfully.");
  } catch (error) {
    console.error(`❌ Failed to send email report: ${error}`);
  }
}

function printHelp() {
  console.log(`
Shopify Stock Manager - Enhanced TypeScript Edition

DESCRIPTION:
    Scans all active products in your Shopify store and automatically
    sets products with zero inventory to 'draft' status. 
    
    IMPROVEMENTS:
    - Uses multiple data sources for inventory validation
    - Prioritizes variant quantities (more reliable than Inventory Levels API)
    - Better error handling and discrepancy detection
    - Enhanced reporting with source comparison
    - Detailed product lists in dry-run mode
    - Detection and reporting of products with negative inventory quantities

USAGE:
    npx tsx scripts/stock-manager.ts [OPTIONS]

OPTIONS:
    -d, --dry-run    Preview changes without making any updates.
    -h, --help       Show this help message.

CONFIGURATION:
    Reads configuration from the .env file in the project root.
    Ensure SHOPIFY_SHOP_DOMAIN and SHOPIFY_ACCESS_TOKEN are set.
    For email reports, also set EMAIL_* variables.
    `);
}

// --- MAIN EXECUTION ---

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run") || args.includes("-d");
  const showHelp = args.includes("--help") || args.includes("-h");

  const log = (message: string) => console.log(message);

  if (showHelp) {
    printHelp();
    return;
  }

  log("🛠️  Shopify Stock Manager - Enhanced TypeScript Edition");
  log("=======================================================\n");

  try {
    const config = getAppConfig();
    const emailConfig = getEmailConfig();
    const client = createShopifyClient(config);

    log(`📍 Shop: ${config.shopDomain}`);
    log(`🔧 API Version: ${config.apiVersion}`);
    log(
      dryRun
        ? "🧪 DRY RUN MODE - No changes will be made"
        : "⚡ LIVE MODE - Products will be set to draft status"
    );

    log("\n📄 Fetching all products...");
    const allProducts = await fetchAllProducts(client, log);
    log(`✅ Fetched ${allProducts.length} total products`);

    log("\n🔍 Analyzing inventory with enhanced validation...");
    const productStockInfos = await analyzeProductStock(
      client,
      allProducts,
      log
    );

    const productsWithNoStock = findProductsWithNoStock(productStockInfos);
    log(
      `\n🎯 Found ${productsWithNoStock.length} active products with no stock`
    );

    // Detailed list of products that would be processed
    if (productsWithNoStock.length > 0) {
      log(
        `\n📋 List of products that ${
          dryRun ? "would be" : "will be"
        } set to draft:`
      );
      productsWithNoStock.forEach((product, index) => {
        const status = product.is_excluded ? "🛡️ EXCLUDED" : "📝 TO DRAFT";
        log(
          `   ${index + 1}. ${status} - "${product.title}" (ID: ${product.id})`
        );
        log(
          `      Stock: ${product.totalStock} | API: ${product.stockSources.inventoryLevels} | Variants: ${product.stockSources.variantQuantities}`
        );
        if (product.stockSources.agreementStatus !== "MATCH") {
          log(
            `      ⚠️ Data discrepancy detected: ${product.stockSources.agreementStatus}`
          );
        }
      });
    }

    const discrepancies = productStockInfos.filter(
      (p) => p.stockSources.agreementStatus !== "MATCH"
    );
    if (discrepancies.length > 0) {
      log(
        `\n⚠️  Detected ${discrepancies.length} inventory discrepancies between data sources`
      );
      log(
        `💡 Using variant quantities as primary source (more reliable than Inventory Levels API)`
      );
    }

    const productsWithNegativeStock = findProductsWithNegativeStock(
      productStockInfos
    ).filter((p) => !p.is_excluded);
    if (productsWithNegativeStock.length > 0) {
      log(
        `\n🚨 Found ${productsWithNegativeStock.length} products with negative variant quantities (inventory errors):`
      );
      productsWithNegativeStock.forEach((product, index) => {
        const negativeVariants = product.variants.filter(
          (v) => v.variantQuantityStock < 0
        );
        log(`   ${index + 1}. "${product.title}" (ID: ${product.id})`);
        negativeVariants.forEach((variant) => {
          log(
            `      🔴 Variant "${variant.title}" (SKU: ${
              variant.sku || "No SKU"
            }): ${variant.variantQuantityStock}`
          );
        });
      });
      log(
        "   💡 These inventory errors should be corrected manually in Shopify admin."
      );
    }

    let updateResults: UpdateResult[] = [];
    if (!dryRun && productsWithNoStock.length > 0) {
      log("\n📝 Updating products to draft status...");
      updateResults = await updateProductsToDraft(
        client,
        productsWithNoStock,
        log
      );
    }

    const summary = generateSummary(productStockInfos, updateResults, dryRun);
    const htmlReport = generateHtmlReport(
      summary,
      productStockInfos,
      updateResults,
      dryRun,
      config.shopDomain
    );

    if (emailConfig) {
      await sendEmailReport(emailConfig, htmlReport, dryRun);
    } else {
      console.warn(
        "⚠️ Email configuration not found, skipping email report. Set EMAIL_* env variables to enable."
      );
    }

    log("\n🎉 Enhanced analysis completed successfully!");
    if (!dryRun && summary.successful_updates > 0) {
      log(`📈 Updated ${summary.successful_updates} products to draft status`);
    }
    if (summary.discrepancies_found > 0) {
      log(
        `📊 Found ${summary.discrepancies_found} data source discrepancies - check the report for details`
      );
    }
    if (summary.negative_stock_count > 0) {
      log(
        `🚨 Found ${summary.negative_stock_count} products with negative inventory quantities - these require manual correction`
      );
    }
  } catch (error: any) {
    console.error(`\n❌ Operation failed: ${error.message}`);
    const emailConfig = getEmailConfig();
    if (emailConfig) {
      const errorHtml = `<h1>Shopify Stock Manager Failed</h1><p>The enhanced job failed with the following error:</p><pre>${error.stack}</pre>`;
      await sendEmailReport(emailConfig, errorHtml, false);
    }
    process.exit(1);
  }
}

main();
