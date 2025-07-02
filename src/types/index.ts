export interface ProductDetails {
  nomeArticolo: string;
  id: string;
  handle: string;
  prezzo: string;
  descrizioneArticolo: string;
  immaginiArticolo: string[];
  varaintiArticolo: Array<{
    variant_id: string;
    inventory_item_id: string;
    title: string;
    inventory_quantity: number;
  }>;
  recentlyModified: boolean;
}

export interface SecondaryDetails {
  availableVariants: Array<{
    variant_id: string;
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
  variant_id: string;
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

// Enhanced status response that includes product status change information
export interface EnhancedStatusResponse {
  status: string;
  message: string;
  status_changed?: string; // "to_draft", "to_active", or undefined
  product_status?: string; // Current product status ("draft", "active", etc.)
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

// Location-related types
export interface LocationInfo {
  name: string;
  id: string;
}

// Check request types
export interface CheckRequest {
  check_all: boolean;
  checked: boolean;
  checked_at?: string;
  checked_by?: string;
  location: string[];
  notes: string;
  priority: string;
  product_id: number;
  product_name: string;
  requested_by: string;
  status: string;
  timestamp: string;
  variant_id?: number;
  variant_name?: string;
  image_url?: string;
}

export interface CheckRequestWithId extends CheckRequest {
  id: string; // Document ID from Firebase
  closing_notes?: string;
}
