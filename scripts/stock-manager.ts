import axios, { AxiosInstance } from "axios";
import "dotenv/config";
import nodemailer from "nodemailer";

// --- CONFIGURATION ---

const EXCLUDED_PRODUCT_IDS: string[] = ["3587363962985"];

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
  const apiVersion = process.env.SHOPIFY_API_VERSION || "2025-01";

  if (!shopDomain || !accessToken) {
    console.error(
      "❌ Missing required environment variables: SHOPIFY_SHOP_DOMAIN, SHOPIFY_ACCESS_TOKEN",
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
    const to = process.env.EMAIL_TO;

    if (!host || !port || !user || !pass || !from || !to) {
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


// --- CORE LOGIC ---

async function fetchAllProducts(client: AxiosInstance, log: (message: string) => void): Promise<ShopifyProduct[]> {
  let allProducts: ShopifyProduct[] = [];
  let url: string | undefined = "/products.json?limit=250&fields=id,title,status,variants&status=active";
  let pageCount = 0;

  while (url) {
    pageCount++;
    try {
      const response = await client.get(url);
      const products = response.data.products as ShopifyProduct[];
      log(
        `   📄 Page ${pageCount}: Fetched ${products.length} products`,
      );
      allProducts = allProducts.concat(products);

      const linkHeader = response.headers["link"] as string;
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
    .filter((product) => {
      if (product.status !== "active") return false;
      const hasStock = product.variants.some((v) => v.inventory_quantity > 0);
      return !hasStock;
    })
    .map((product) => ({
      id: product.id.toString(),
      title: product.title,
      is_excluded: EXCLUDED_PRODUCT_IDS.includes(product.id.toString()),
    }));
}

async function updateProductsToDraft(client: AxiosInstance, products: ProductNoStock[], log: (message: string) => void): Promise<UpdateResult[]> {
  const results: UpdateResult[] = [];
  for (const [index, product] of products.entries()) {
    log(
      `   📝 (${index + 1}/${products.length}) Updating: "${product.title}" (ID: ${product.id})`,
    );

    if (product.is_excluded) {
      log("   🛡️ EXCLUDED - Skipping update");
      results.push({ productId: product.id, title: product.title, success: true, error: "Excluded from updates" });
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
      results.push({ productId: product.id, title: product.title, success: true });
    } catch (error: any) {
      const errorMessage = error.response?.data?.errors || error.message;
      log(`   ❌ Failed to update: ${JSON.stringify(errorMessage)}`);
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

function generateHtmlReport(summary: UpdateSummary, products: ProductNoStock[], updateResults: UpdateResult[], dryRun: boolean, shopDomain: string): string {
    const now = new Date().toLocaleString('it-IT', { timeZone: 'CET' });
    const adminUrl = `https://${shopDomain}/admin`;

    let body = `
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #333; background-color: #f4f5f7; }
            .container { max-width: 800px; margin: 20px auto; padding: 20px; border-radius: 8px; background-color: #fff; box-shadow: 0 4px 8px rgba(0,0,0,0.05); }
            h1, h2 { color: #111; }
            h1 { font-size: 24px; text-align: center; margin-bottom: 10px; }
            h2 { font-size: 20px; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-top: 40px; }
            .subtitle { text-align: center; color: #666; margin-bottom: 30px; }
            .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 20px; margin: 20px 0; }
            .summary-item { background-color: #f9fafb; padding: 20px; border-radius: 8px; text-align: center; border: 1px solid #e5e7eb; }
            .summary-item strong { display: block; font-size: 28px; color: #005b99; }
            .product-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            .product-table th, .product-table td { text-align: left; padding: 12px 15px; border-bottom: 1px solid #ddd; }
            .product-table th { background-color: #f2f2f2; }
            .product-table tr:hover { background-color: #f5f5f5; }
            .status-cell { text-align: right; }
            .status-tag { padding: 5px 10px; border-radius: 15px; font-weight: bold; font-size: 0.9em; }
            .status-success { background-color: #d4edda; color: #155724; }
            .status-fail { background-color: #f8d7da; color: #721c24; }
            .status-excluded { background-color: #fff3cd; color: #856404; }
            .status-info { background-color: #d1ecf1; color: #0c5460; }
            .error-msg { color: #d9534f; font-size: 0.9em; }
            a { color: #007bff; text-decoration: none; }
            a:hover { text-decoration: underline; }
            footer { margin-top: 40px; text-align: center; font-size: 0.8em; color: #888; }
        </style>
        <div class="container">
            <h1>Report Inventario Shopify</h1>
            <p class="subtitle">Controllo automatico eseguito il: <strong>${now}</strong> | Negozio: <a href="https://${shopDomain}">${shopDomain}</a></p>
            ${dryRun ? '<h2 style="color: #f0ad4e; text-align: center;">⚠️ ESECUZIONE IN MODALITÀ ANTEPRIMA (DRY RUN) ⚠️</h2>' : ''}

            <h2>Riepilogo</h2>
            <div class="summary-grid">
                <div class="summary-item">Prodotti Trovati<strong>${summary.total_found}</strong></div>
                <div class="summary-item">Prodotti Aggiornati<strong>${summary.successful_updates}</strong></div>
                <div class="summary-item">Aggiornamenti Falliti<strong>${summary.failed_updates}</strong></div>
                <div class="summary-item">Prodotti Esclusi<strong>${summary.excluded_count}</strong></div>
            </div>
    `;

    const renderTable = (title: string, items: any[], columns: {header: string, cell: (item: any) => string}[]) => {
        let table = `<h2>${title}</h2>`;
        if (items.length === 0) {
            return table + '<p>Nessun prodotto in questa categoria.</p>';
        }
        table += '<table class="product-table"><thead><tr>';
        columns.forEach(col => table += `<th>${col.header}</th>`);
        table += '</tr></thead><tbody>';
        items.forEach(item => {
            table += '<tr>';
            columns.forEach(col => table += `<td>${col.cell(item)}</td>`);
            table += '</tr>';
        });
        table += '</tbody></table>';
        return table;
    };

    if (dryRun) {
        body += renderTable('Prodotti che verrebbero modificati', products, [
            { header: 'Prodotto', cell: p => `<a href="${adminUrl}/products/${p.id}">${p.title}</a>` },
            { header: 'ID', cell: p => p.id },
            { header: 'Stato', cell: p => `<div class="status-cell"><span class="status-tag ${p.is_excluded ? 'status-excluded' : 'status-info'}">${p.is_excluded ? 'ESCLUSO' : 'DA AGGIORNARE'}</span></div>` },
        ]);
    } else {
        const updated = updateResults.filter(r => r.success && !r.error);
        const failed = updateResults.filter(r => !r.success);

        if (updated.length > 0) {
            body += renderTable('Prodotti Aggiornati a Bozza', updated, [
                { header: 'Prodotto', cell: r => `<a href="${adminUrl}/products/${r.productId}">${r.title}</a>` },
                { header: 'ID', cell: r => r.productId },
                { header: 'Stato', cell: () => `<div class="status-cell"><span class="status-tag status-success">AGGIORNATO</span></div>` },
            ]);
        }

        if (failed.length > 0) {
            body += renderTable('Aggiornamenti Falliti', failed, [
                { header: 'Prodotto', cell: r => `<a href="${adminUrl}/products/${r.productId}">${r.title}</a>` },
                { header: 'ID', cell: r => r.productId },
                { header: 'Errore', cell: r => `<div class="status-cell"><span class="status-tag status-fail">FALLITO</span><br><small class="error-msg">${r.error}</small></div>` },
            ]);
        }
    }

    if (summary.total_found === 0) {
        body += '<h2>Risultato</h2><p style="text-align:center; font-size: 1.2em;">✅ Tutto in ordine! Nessun prodotto attivo con scorte esaurite trovato.</p>';
    }

    body += '<footer>Questo è un report automatico. Non rispondere a questa email.</footer></div>';
    return body;
}

async function sendEmailReport(emailConfig: EmailConfig, htmlBody: string, dryRun: boolean) {
    const transporter = nodemailer.createTransport({
        host: emailConfig.host,
        port: emailConfig.port,
        secure: emailConfig.port === 465, // true for 465, false for other ports
        auth: {
            user: emailConfig.user,
            pass: emailConfig.pass,
        },
    });

    const subject = dryRun ? 'Report Inventario Shopify (DRY RUN)' : 'Report Inventario Shopify';

    try {
        await transporter.sendMail({
            from: `"Shopify Stock Manager" <${emailConfig.from}>`,
            to: emailConfig.to,
            subject: subject,
            html: htmlBody,
        });
        console.log('✅ Email report sent successfully.');
    } catch (error) {
        console.error(`❌ Failed to send email report: ${error}`);
    }
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
    --silent         Do not log progress to console (for cron jobs).

CONFIGURATION:
    Reads configuration from the .env file in the project root.
    Ensure SHOPIFY_SHOP_DOMAIN, SHOPIFY_ACCESS_TOKEN are set.
    For email reports, also set EMAIL_* variables.
    `);
}


// --- MAIN EXECUTION ---

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run") || args.includes("-d");
  const showHelp = args.includes("--help") || args.includes("-h");
  const silent = args.includes("--silent");

  const log = silent ? (message: string) => {} : (message: string) => console.log(message);

  if (showHelp) {
    printHelp();
    return;
  }

  log("🛠️  Shopify Stock Manager (TypeScript Edition)");
  log("=============================================\n");

  try {
    const config = getAppConfig();
    const emailConfig = getEmailConfig();
    const client = createShopifyClient(config);

    log(`📍 Shop: ${config.shopDomain}`);
    log(`🔧 API Version: ${config.apiVersion}`);
    log(
      dryRun
        ? "🧪 DRY RUN MODE - No changes will be made"
        : "⚡ LIVE MODE - Products will be set to draft status",
    );

    log("\n📄 Fetching all products...");
    const allProducts = await fetchAllProducts(client, log);
    log(`✅ Fetched ${allProducts.length} total products`);

    log("\n🔍 Analyzing inventory...");
    const productsWithNoStock = findProductsWithNoStock(allProducts);
    log(
      `🎯 Found ${productsWithNoStock.length} active products with no stock`,
    );

    let updateResults: UpdateResult[] = [];
    if (!dryRun && productsWithNoStock.length > 0) {
        log("\n📝 Updating products to draft status...");
        updateResults = await updateProductsToDraft(client, productsWithNoStock, log);
    }

    const summary = generateSummary(productsWithNoStock, updateResults, dryRun);
    const htmlReport = generateHtmlReport(summary, productsWithNoStock, updateResults, dryRun, config.shopDomain);

    if (emailConfig) {
        await sendEmailReport(emailConfig, htmlReport, dryRun);
    } else if (!silent) {
        console.warn('⚠️ Email configuration not found, skipping email report. Set EMAIL_* env variables to enable.');
    }

    if (!silent) {
        // The equivalent of printResults is now part of the email report.
        // We can log a simple summary here for non-silent runs.
        log("\n🎉 Operation completed successfully!");
        if (!dryRun && summary.successful_updates > 0) {
            log(`📈 Updated ${summary.successful_updates} products to draft status`);
        }
    }

  } catch (error: any) {
    console.error("\n❌ Operation failed: ${error.message}");
    // Also send an email on failure if possible
    const emailConfig = getEmailConfig();
    if (emailConfig) {
        const errorHtml = `<h1>Shopify Stock Manager Failed</h1><p>The job failed with the following error:</p><pre>${error.stack}</pre>`;
        await sendEmailReport(emailConfig, errorHtml, false);
    }
    process.exit(1);
  }
}

main();

