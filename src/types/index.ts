export interface ProductDetails {
  nomeArticolo: string;
  id: string;
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
