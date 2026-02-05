export type AppRole = 'admin' | 'driver';
export type StopStatus = 'pending' | 'picked' | 'delivered';

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
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
  driver_id: string | null;
  status: StopStatus;
  created_at: string;
  updated_at: string;
  picked_at: string | null;
  delivered_at: string | null;
  created_by: string | null;
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
