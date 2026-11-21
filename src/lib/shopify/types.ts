/** Client-safe catalog types (adapted from the verified UCP 2026-08-25 response schema). */
export interface ClothingSearchQuery {
  /** Shopper-style words, e.g. "orange pocket t-shirt". */
  query: string;
  category: string;
  color?: string;
  style?: string;
  description?: string;
}

export interface ClothingProduct {
  id: string;
  variantId: string;
  title: string;
  merchant: string;
  merchantUrl?: string;
  imageUrl?: string;
  imageAlt?: string;
  /** Formatted for display, from the catalog's minor-unit amount. */
  price?: string;
  amountMinor?: number;
  currency?: string;
  available?: boolean;
  /** Variant URL exactly as returned (query string included), per Shop's guidelines. */
  productUrl: string;
  options: { name: string; label: string }[];
  colors: string[];
  features: string[];
  rating?: { value: number; count: number };
}

export interface CatalogSearchResult {
  products: ClothingProduct[];
  totalCount?: number;
  warnings: string[];
}

