import { Request } from 'express';

export type AppRole = 'admin' | 'driver' | 'shop';
export type StopStatus = 'pending' | 'assigned' | 'picked' | 'delivered';
export type PackageSize = 'small' | 'medium' | 'large';

export interface User {
  id: string;
  email: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  shop_name: string | null;
  default_pickup_address: string | null;
  default_pickup_lat: number | null;
  default_pickup_lng: number | null;
  iban: string | null;
  nif: string | null;
  fiscal_address: string | null;
  admin_notes: string | null;
  privacy_accepted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: Date;
}

export interface Stop {
  id: string;
  order_code: string | null;
  pickup_address: string;
  pickup_lat: number | null;
  pickup_lng: number | null;
  delivery_address: string;
  delivery_lat: number | null;
  delivery_lng: number | null;
  client_name: string;
  client_phone: string | null;
  client_notes: string | null;
  driver_id: string | null;
  shop_id: string | null;
  created_by: string | null;
  status: StopStatus;
  package_size: PackageSize | null;
  distance_km: number | null;
  price: number | null;
  price_driver: number | null;
  price_company: number | null;
  paid_by_client: boolean;
  paid_by_client_at: Date | null;
  paid_to_driver: boolean;
  paid_to_driver_at: Date | null;
  proof_photo_url: string | null;
  shop_name: string | null;
  scheduled_pickup_at: Date | null;
  picked_at: Date | null;
  delivered_at: Date | null;
  created_at: Date;
  updated_at: Date;
  // individual order delivery notification
  delivery_notified_at: Date | null;
  delivery_notification_error: string | null;
  // extra fields from individual / B2B orders
  source: string | null;
  order_type: string | null;
  customer_email: string | null;
  customer_full_name: string | null;
  customer_phone: string | null;
  payment_status: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
}

export interface DriverLocation {
  id: string;
  driver_id: string;
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  updated_at: Date;
}

export interface PricingZone {
  id: string;
  name: string;
  min_km: number;
  max_km: number | null;
  fixed_price: number | null;
  per_km_price: number | null;
  price_driver: number | null;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

export interface OrderPhoto {
  id: string;
  stop_id: string;
  driver_id: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: Date;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}

export interface AuthPayload {
  sub: string;
  role: AppRole;
  profileId: string;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthPayload;
}

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
