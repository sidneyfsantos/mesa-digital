export const CONTRACTS_PACKAGE_NAME = "@mesa-digital/contracts" as const;
export interface HealthResponse {
  status: "ok";
}
export type ServicePointKind = "FIXED_TABLE" | "MOBILE_TAB";
export interface PublicModifierOption {
  id: string;
  name: string;
  priceDeltaMinor: number;
}
export interface PublicModifierGroup {
  id: string;
  name: string;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  options: PublicModifierOption[];
}
export interface PublicCatalogProduct {
  id: string;
  name: string;
  description: string | null;
  priceMinor: number;
  currency: "BRL";
  available: boolean;
  photos: { url: string; alt: string }[];
  modifierGroups: PublicModifierGroup[];
}
export interface PublicCatalogCategory {
  id: string;
  name: string;
  description: string | null;
  products: PublicCatalogProduct[];
}
export interface PublicCatalog {
  establishment: {
    displayName: string;
    primaryColor: string;
    logoUrl: string | null;
    coverUrl: string | null;
  };
  entry: {
    kind: "QR";
    servicePoint: { kind: ServicePointKind; label: string };
  };
  categories: PublicCatalogCategory[];
}
