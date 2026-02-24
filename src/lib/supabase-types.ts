export type AppRole = 'admin' | 'driver' | 'shop';
export type StopStatus = 'pending' | 'assigned' | 'picked' | 'delivered';

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  shop_name: string | null;
  default_pickup_address: string | null;
  default_pickup_lat: number | null;
  default_pickup_lng: number | null;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface Stop {
  id: string;
  order_code: string | null;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  delivery_address: string;
  delivery_lat: number;
  delivery_lng: number;
  client_name: string;
  client_phone: string | null;
  client_notes: string | null;
  driver_id: string | null;
  shop_id: string | null;
  status: StopStatus;
  created_at: string;
  updated_at: string;
  picked_at: string | null;
  delivered_at: string | null;
  created_by: string | null;
  proof_photo_url: string | null;
  distance_km: number | null;
  shop_name: string | null;
}

export interface DriverLocation {
  id: string;
  driver_id: string;
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  updated_at: string;
}

export interface StopWithDriver extends Stop {
  driver?: Profile;
}

export interface ProfileWithRole extends Profile {
  role: AppRole;
}
