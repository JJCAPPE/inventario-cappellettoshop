export interface ProductDetails {
  nomeArticolo: string;
  id: string;
  handle: string;
  prezzo: string;
  descrizioneArticolo: string;
  immaginiArticolo: string[];
  varaintiArticolo: Array<{
    inventory_item_id: string;
    title: string;
    inventory_quantity: number;
  }>;
  recentlyModified: boolean;
}

export interface SecondaryDetails {
  availableVariants: Array<{
    inventory_item_id: string;
    title: string;
    inventory_quantity: number;
  }>;
}

export interface LogEntry {
  requestType: string;
  timestamp: string;
  data: {
    id: string;
    variant: string;
    negozio: string;
    inventory_item_id: string;
    nome: string;
    prezzo: string;
    rettifica: number;
    images: string[];
  };
}

// Add missing types from Tauri API
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

export interface InventoryLevel {
  primary: number;
  secondary: number;
}

export interface LocationConfig {
  primary_location: {
    id: string;
    name: string;
  };
  secondary_location: {
    id: string;
    name: string;
  };
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

export interface SearchProductsResponse {
  products: Product[];
  total_count: number;
}

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

export interface FirebaseConfig {
  api_key: string;
  auth_domain: string;
  project_id: string;
  storage_bucket: string;
  messaging_sender_id: string;
  app_id: string;
  measurement_id: string;
}

// New modification history types
export interface ProductModificationHistory {
  product_id: string;
  location: string;
  date_range: DateRange;
  variants: VariantModificationHistory[];
}

export interface VariantModificationHistory {
  variant_title: string;
  inventory_item_id: string;
  app_net_change: number; // Total net change from app in period
  current_quantity: number;
  daily_modifications: DailyModificationGroup[]; // Daily breakdown
}

export interface DailyModificationGroup {
  date: string; // YYYY-MM-DD format for grouping
  app_net_change: number; // Net change from app for this date
  app_details: ModificationDetail[]; // Individual app modifications
}

export interface ModificationDetail {
  timestamp: string;
  source: string; // "app" or "shopify"
  change: number;
  reason?: string;
}

export interface DateRange {
  start_date: string;
  end_date: string;
  days_back: number;
}

export type TimeRangeOption = {
  label: string;
  value: number;
  description: string;
};

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  message: string;
  type: ToastType;
}

export interface SearchResult {
  id: string;
  title: string;
  image?: string;
}
