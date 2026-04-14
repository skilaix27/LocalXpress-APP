// ─── Enums / Literals ──────────────────────────────────────────────────────

export type AppRole = 'admin' | 'driver' | 'shop';

export type StopStatus = 'pending' | 'assigned' | 'picked' | 'delivered';

export type PackageSize = 'small' | 'medium' | 'large';

// ─── DB Entities ────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  password_hash: string;
  role: AppRole;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  shop_name: string | null;
  default_pickup_address: string | null;
  default_pickup_lat: number | null;
  default_pickup_lng: number | null;
  privacy_accepted_at: Date | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Stop {
  id: string;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  delivery_address: string;
  delivery_lat: number;
  delivery_lng: number;
  client_name: string;
  client_phone: string | null;
  client_notes: string | null;
  driver_id: string | null;   // → profiles.id
  shop_id: string | null;     // → profiles.id
  created_by: string;         // → users.id
  status: StopStatus;
  order_code: string;
  package_size: PackageSize;
  distance_km: number | null;
  shop_name: string | null;
  proof_photo_url: string | null;
  scheduled_pickup_at: Date | null;
  picked_at: Date | null;
  delivered_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface DriverLocation {
  id: string;
  driver_id: string;   // → profiles.id (UNIQUE)
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
  max_km: number;
  fixed_price: number;
  per_km_price: number;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
}

// ─── Express augmentation ───────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      user?: User;
      profile?: Profile;
      role?: AppRole;
    }
  }
}
