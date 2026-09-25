export const CONTRACTS_PACKAGE_NAME = "@mesa-digital/contracts" as const;
export interface HealthResponse {
  status: "ok";
}
export type ServicePointKind = "FIXED_TABLE" | "MOBILE_TAB";
export type ProductionStationKind = "KITCHEN" | "BAR" | "OTHER";
export type OrderItemStatus = "ACCEPTED" | "IN_PREPARATION" | "READY" | "DELIVERED" | "CANCELLED";
export type OrderStatus = "ACCEPTED" | "CONFIRMED" | "IN_PRODUCTION" | "READY" | "COMPLETED" | "CANCELLATION_REQUESTED" | "CANCELLED";

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
export interface CreateOrderRequest {
  items: Array<{
    productId: string;
    quantity: number;
    modifierOptionIds: string[];
  }>;
}
export interface CreateOrderResponse {
  order: {
    id: string;
    reference: string;
    status: "ACCEPTED";
    totalMinor: number;
    createdAt: string;
    items: Array<{
      id: string;
      name: string;
      quantity: number;
      unitPriceMinor: number;
      modifiersTotalMinor: number;
      lineTotalMinor: number;
      status: "ACCEPTED";
      stationId: string | null;
    }>;
  };
}

export interface ProductionStation {
  id: string;
  name: string;
  kind: ProductionStationKind;
  active: boolean;
  sortOrder: number;
}
export interface ProductRouting {
  productId: string;
  productName: string;
  stationId: string;
  stationName: string;
  stationKind: ProductionStationKind;
}
export interface StationItem {
  id: string;
  orderId: string;
  productName: string;
  quantity: number;
  status: OrderItemStatus;
  stationId: string;
  createdAt: string;
  startedAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  orderReference: string;
  orderStatus: OrderStatus;
  serviceSessionId: string;
}
export interface DeliveryItem {
  id: string;
  orderId: string;
  productName: string;
  quantity: number;
  status: "READY";
  stationId: string;
  createdAt: string;
  readyAt: string | null;
  orderReference: string;
  serviceSessionId: string;
}
export interface TransitionItemRequest {
  status: OrderItemStatus;
}
export interface TransitionItemResponse {
  itemId: string;
  status: OrderItemStatus;
  timestamp: string;
}
