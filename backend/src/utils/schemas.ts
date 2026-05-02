import { z } from 'zod';

// ─── Auth ──────────────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// ─── Users ────────────────────────────────────────────────────────────────────
export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  full_name: z.string().min(1),
  phone: z.string().optional(),
  role: z.enum(['admin', 'driver', 'shop']),
  shop_name: z.string().optional(),
  default_pickup_address: z.string().optional(),
  default_pickup_lat: z.number().optional(),
  default_pickup_lng: z.number().optional(),
  is_active: z.boolean().default(true),
});

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  full_name: z.string().min(1).optional(),
  phone: z.string().optional().nullable(),
  is_active: z.boolean().optional(),
  shop_name: z.string().optional().nullable(),
  default_pickup_address: z.string().optional().nullable(),
  default_pickup_lat: z.number().optional().nullable(),
  default_pickup_lng: z.number().optional().nullable(),
  iban: z.string().optional().nullable(),
  nif: z.string().optional().nullable(),
  fiscal_address: z.string().optional().nullable(),
  admin_notes: z.string().optional().nullable(),
});

// ─── Profiles ─────────────────────────────────────────────────────────────────
export const updateProfileSchema = z.object({
  full_name: z.string().min(1).optional(),
  phone: z.string().optional().nullable(),
  avatar_url: z.string().url().optional().nullable(),
  shop_name: z.string().optional().nullable(),
  default_pickup_address: z.string().optional().nullable(),
  default_pickup_lat: z.number().optional().nullable(),
  default_pickup_lng: z.number().optional().nullable(),
  privacy_accepted_at: z.string().datetime().optional().nullable(),
});

// ─── Stops ────────────────────────────────────────────────────────────────────
export const createStopSchema = z.object({
  pickup_address: z.string().min(1),
  pickup_lat: z.number().optional().nullable(),
  pickup_lng: z.number().optional().nullable(),
  delivery_address: z.string().min(1),
  delivery_lat: z.number().optional().nullable(),
  delivery_lng: z.number().optional().nullable(),
  client_name: z.string().min(1),
  client_phone: z.string().optional().nullable(),
  client_notes: z.string().optional().nullable(),
  driver_id: z.string().uuid().optional().nullable(),
  shop_id: z.string().uuid().optional().nullable(),
  package_size: z.enum(['small', 'medium', 'large']).optional().nullable(),
  distance_km: z.number().optional().nullable(),
  price: z.number().optional().nullable(),
  price_driver: z.number().optional().nullable(),
  price_company: z.number().optional().nullable(),
  shop_name: z.string().optional().nullable(),
  scheduled_pickup_at: z.string().datetime().optional().nullable(),
});

export const updateStopSchema = z.object({
  pickup_address: z.string().min(1).optional(),
  pickup_lat: z.number().optional().nullable(),
  pickup_lng: z.number().optional().nullable(),
  delivery_address: z.string().min(1).optional(),
  delivery_lat: z.number().optional().nullable(),
  delivery_lng: z.number().optional().nullable(),
  client_name: z.string().min(1).optional(),
  client_phone: z.string().optional().nullable(),
  client_notes: z.string().optional().nullable(),
  driver_id: z.string().uuid().optional().nullable(),
  shop_id: z.string().uuid().optional().nullable(),
  status: z.enum(['pending', 'assigned', 'picked', 'delivered']).optional(),
  package_size: z.enum(['small', 'medium', 'large']).optional().nullable(),
  distance_km: z.number().optional().nullable(),
  price: z.number().optional().nullable(),
  price_driver: z.number().optional().nullable(),
  price_company: z.number().optional().nullable(),
  paid_by_client: z.boolean().optional(),
  paid_to_driver: z.boolean().optional(),
  proof_photo_url: z.string().optional().nullable(),
  shop_name: z.string().optional().nullable(),
  scheduled_pickup_at: z.string().datetime().optional().nullable(),
  admin_notes: z.string().optional().nullable(),
});

export const updateStopStatusSchema = z.object({
  status: z.enum(['pending', 'assigned', 'picked', 'delivered']),
  proof_photo_url: z.string().optional().nullable(),
});

export const createOrderApiSchema = z.object({
  pickup_address: z.string().min(1),
  pickup_lat: z.number().optional().nullable(),
  pickup_lng: z.number().optional().nullable(),
  delivery_address: z.string().min(1),
  delivery_lat: z.number().optional().nullable(),
  delivery_lng: z.number().optional().nullable(),
  client_name: z.string().min(1),
  client_phone: z.string().optional().nullable(),
  client_notes: z.string().optional().nullable(),
  package_size: z.enum(['small', 'medium', 'large']).optional(),
  shop_name: z.string().optional().nullable(),
  scheduled_pickup_at: z.string().datetime({ offset: true }).optional().nullable(),
  distance_km: z.number().positive().optional().nullable(),
  source: z.string().max(64).optional().nullable(),
  email_from: z.string().max(320).optional().nullable(),
  email_subject: z.string().max(998).optional().nullable(),
  // Individual orders support
  order_type: z.enum(['business', 'individual']).optional(),
  payment_status: z.enum(['unpaid', 'pending', 'paid', 'failed', 'refunded']).optional(),
  customer_email: z.string().email().max(320).optional().nullable(),
  customer_full_name: z.string().max(255).optional().nullable(),
  customer_phone: z.string().max(50).optional().nullable(),
  stripe_checkout_session_id: z.string().max(255).optional().nullable(),
  stripe_payment_intent_id: z.string().max(255).optional().nullable(),
  // External order code accepted only for individual orders (must match LXP- format)
  order_code: z.string().max(64).optional().nullable(),
});

// ─── Driver locations ─────────────────────────────────────────────────────────
export const upsertLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().optional().nullable(),
  speed: z.number().optional().nullable(),
});

// ─── Pricing zones ────────────────────────────────────────────────────────────
export const createPricingZoneSchema = z.object({
  name: z.string().min(1),
  min_km: z.number().min(0),
  max_km: z.number().optional().nullable(),
  fixed_price: z.number().optional().nullable(),
  per_km_price: z.number().optional().nullable(),
  price_driver: z.number().min(0).optional().nullable(),
  sort_order: z.number().int().default(0),
});

export const updatePricingZoneSchema = createPricingZoneSchema.partial();
