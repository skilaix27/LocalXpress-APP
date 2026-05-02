const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ─── Token management ─────────────────────────────────────────────────────────
export function getToken(): string | null {
  return localStorage.getItem('lx_token');
}
export function setToken(token: string): void {
  localStorage.setItem('lx_token', token);
}
export function clearToken(): void {
  localStorage.removeItem('lx_token');
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────
async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      errMsg = body.error || body.message || errMsg;
    } catch {}
    throw new Error(errMsg);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { method: 'POST', headers, body: formData });
  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      errMsg = body.error || errMsg;
    } catch {}
    throw new Error(errMsg);
  }
  return res.json();
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    apiFetch<{
      token: string;
      user: {
        id: string;
        email: string;
        role: string;
        profile: {
          id: string;
          full_name: string;
          phone: string | null;
          avatar_url: string | null;
          shop_name: string | null;
          default_pickup_address: string | null;
          default_pickup_lat: number | null;
          default_pickup_lng: number | null;
          privacy_accepted_at: string | null;
        };
      };
    }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  me: () =>
    apiFetch<{
      id: string;
      email: string;
      is_active: boolean;
      role: string | null;
      profile: {
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
        privacy_accepted_at: string | null;
      } | null;
    }>('/api/auth/me'),
};

// ─── Users ────────────────────────────────────────────────────────────────────
export const usersApi = {
  list: (params?: { limit?: number; page?: number; search?: string }) => {
    const q = new URLSearchParams();
    q.set('limit', String(params?.limit ?? 100));
    if (params?.page) q.set('page', String(params.page));
    if (params?.search) q.set('search', params.search);
    return apiFetch<{
      data: Array<{
        id: string;
        email: string;
        is_active: boolean;
        created_at: string;
        role: string;
        full_name: string;
        profile_id: string;
        phone: string | null;
        shop_name: string | null;
        avatar_url: string | null;
      }>;
      total: number;
    }>(`/api/users?${q}`);
  },

  lookupEmail: (name: string) =>
    apiFetch<{ email: string }>(`/api/users/lookup-email?name=${encodeURIComponent(name)}`),

  create: (body: Record<string, unknown>) =>
    apiFetch<unknown>('/api/users', { method: 'POST', body: JSON.stringify(body) }),

  update: (id: string, body: Record<string, unknown>) =>
    apiFetch<unknown>(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  delete: (id: string) =>
    apiFetch<void>(`/api/users/${id}`, { method: 'DELETE' }),
};

// ─── Profiles ─────────────────────────────────────────────────────────────────
export const profilesApi = {
  me: () => apiFetch<{
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
    privacy_accepted_at: string | null;
  }>('/api/profiles/me'),

  listAll: (role?: string) => {
    const q = new URLSearchParams();
    if (role) q.set('role', role);
    return apiFetch<Array<{
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
      privacy_accepted_at: string | null;
      email: string;
      role: string;
    }>>(`/api/profiles${q.toString() ? '?' + q : ''}`);
  },

  updateMe: (body: Record<string, unknown>) =>
    apiFetch<unknown>('/api/profiles/me', { method: 'PATCH', body: JSON.stringify(body) }),

  updateById: (id: string, body: Record<string, unknown>) =>
    apiFetch<unknown>(`/api/profiles/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
};

// ─── Stops ────────────────────────────────────────────────────────────────────
export const stopsApi = {
  list: (params?: { limit?: number; page?: number }) => {
    const q = new URLSearchParams();
    q.set('limit', String(params?.limit ?? 100));
    if (params?.page) q.set('page', String(params.page));
    return apiFetch<{ data: unknown[]; total: number; totalPages: number }>(`/api/stops?${q}`);
  },

  create: (body: Record<string, unknown>) =>
    apiFetch<unknown>('/api/stops', { method: 'POST', body: JSON.stringify(body) }),

  update: (id: string, body: Record<string, unknown>) =>
    apiFetch<unknown>(`/api/stops/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  delete: (id: string) =>
    apiFetch<void>(`/api/stops/${id}`, { method: 'DELETE' }),
};

// ─── Archived stops ───────────────────────────────────────────────────────────
export const archivedStopsApi = {
  list: (params?: { limit?: number; page?: number }) => {
    const q = new URLSearchParams();
    q.set('limit', String(params?.limit ?? 100));
    if (params?.page) q.set('page', String(params.page));
    return apiFetch<{ data: unknown[]; total: number; totalPages: number }>(`/api/stops/archived?${q}`);
  },
};

// ─── Driver locations ─────────────────────────────────────────────────────────
export const locationsApi = {
  list: () => apiFetch<unknown[]>('/api/driver-locations'),
  upsert: (body: { lat: number; lng: number }) =>
    apiFetch<unknown>('/api/driver-locations', { method: 'PUT', body: JSON.stringify(body) }),
};

// ─── Pricing zones ────────────────────────────────────────────────────────────
export const zonesApi = {
  list: () => apiFetch<unknown[]>('/api/pricing-zones'),
  create: (body: Record<string, unknown>) =>
    apiFetch<unknown>('/api/pricing-zones', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Record<string, unknown>) =>
    apiFetch<unknown>(`/api/pricing-zones/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (id: string) =>
    apiFetch<void>(`/api/pricing-zones/${id}`, { method: 'DELETE' }),
};

// ─── Uploads ──────────────────────────────────────────────────────────────────
export const uploadsApi = {
  uploadProof: (stopId: string, blob: Blob) => {
    const fd = new FormData();
    fd.append('photo', blob, 'proof.jpg');
    return apiUpload<{ photo: unknown; url: string }>(`/api/uploads/proof/${stopId}`, fd);
  },
};

// ─── Superadmin ───────────────────────────────────────────────────────────────
export interface SuperAdminMetrics {
  users: {
    total_users: number;
    active_users: number;
    total_admins: number;
    total_shops: number;
    total_drivers: number;
  };
  stops: {
    total_active_stops: number;
    total_archived_stops: number;
    stops_today: number;
    stops_this_week: number;
    stops_this_month: number;
    pending_stops: number;
    assigned_stops: number;
    picked_stops: number;
    delivered_stops: number;
    cancelled_stops: number;
  };
  finances: {
    revenue_today: number;
    revenue_this_month: number;
    total_pending_client_payment: number;
    total_pending_driver_payment: number;
    total_paid_by_clients: number;
    total_paid_to_drivers: number;
    estimated_company_margin: number;
  };
  photos: {
    total_photos: number;
    total_photo_size_bytes: number;
    total_photo_size_mb: number;
    latest_photo_created_at: string | null;
  };
  activity: {
    last_stop_created_at: string | null;
    last_user_created_at: string | null;
  };
  order_types: {
    business_today: number;
    individual_today: number;
    individual_paid_today: number;
    individual_pending_today: number;
    revenue_business_today: number;
    revenue_individual_today: number;
  };
}

export interface SuperAdminStop {
  id: string;
  order_code: string | null;
  status: string;
  client_name: string;
  client_phone: string | null;
  pickup_address: string;
  delivery_address: string;
  shop_name: string | null;
  shop_id: string | null;
  driver_id: string | null;
  driver_name: string;
  distance_km: number | null;
  price: number | null;
  price_driver: number | null;
  price_company: number | null;
  paid_by_client: boolean;
  paid_to_driver: boolean;
  created_at: string;
  scheduled_pickup_at: string | null;
  delivered_at: string | null;
  is_archived: boolean;
  order_type: string;
  payment_status: string;
  source: string;
  customer_email: string | null;
  stripe_checkout_session_id: string | null;
}

export interface SuperAdminStopsResponse {
  data: SuperAdminStop[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  summary: {
    total_price: number;
    total_price_driver: number;
  };
}

export interface SuperAdminStopsParams {
  page?: number;
  limit?: number;
  status?: string;
  date_from?: string;
  date_to?: string;
  shop_id?: string;
  driver_id?: string;
  paid_by_client?: string;
  paid_to_driver?: string;
  search?: string;
  archived?: string;
  order_type?: string;
  source?: string;
  payment_status?: string;
}

export type BulkPaymentAction =
  | 'mark_client_paid'
  | 'mark_client_unpaid'
  | 'mark_driver_paid'
  | 'mark_driver_unpaid';

export const superadminApi = {
  getMetrics: () => apiFetch<SuperAdminMetrics>('/api/superadmin/metrics'),

  bulkUpdatePayments: (stop_ids: string[], action: BulkPaymentAction) =>
    apiFetch<{ updated: number }>('/api/superadmin/stops/payments', {
      method: 'PATCH',
      body: JSON.stringify({ stop_ids, action }),
    }),

  getStops: (params: SuperAdminStopsParams = {}) => {
    const q = new URLSearchParams();
    if (params.page)          q.set('page', String(params.page));
    if (params.limit)         q.set('limit', String(params.limit));
    if (params.status)        q.set('status', params.status);
    if (params.date_from)     q.set('date_from', params.date_from);
    if (params.date_to)       q.set('date_to', params.date_to);
    if (params.shop_id)       q.set('shop_id', params.shop_id);
    if (params.driver_id)     q.set('driver_id', params.driver_id);
    if (params.paid_by_client !== undefined) q.set('paid_by_client', params.paid_by_client);
    if (params.paid_to_driver !== undefined) q.set('paid_to_driver', params.paid_to_driver);
    if (params.search)        q.set('search', params.search);
    if (params.archived)      q.set('archived', params.archived);
    if (params.order_type)    q.set('order_type', params.order_type);
    if (params.source)        q.set('source', params.source);
    if (params.payment_status) q.set('payment_status', params.payment_status);
    return apiFetch<SuperAdminStopsResponse>(`/api/superadmin/stops?${q}`);
  },

  exportStops: (params: SuperAdminStopsParams = {}) => {
    const token = getToken();
    const q = new URLSearchParams();
    if (params.status)        q.set('status', params.status);
    if (params.date_from)     q.set('date_from', params.date_from);
    if (params.date_to)       q.set('date_to', params.date_to);
    if (params.shop_id)       q.set('shop_id', params.shop_id);
    if (params.driver_id)     q.set('driver_id', params.driver_id);
    if (params.paid_by_client !== undefined) q.set('paid_by_client', params.paid_by_client);
    if (params.paid_to_driver !== undefined) q.set('paid_to_driver', params.paid_to_driver);
    if (params.search)        q.set('search', params.search);
    if (params.archived)      q.set('archived', params.archived);
    if (params.order_type)    q.set('order_type', params.order_type);
    if (params.source)        q.set('source', params.source);
    if (params.payment_status) q.set('payment_status', params.payment_status);
    const API_URL_VAL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    return fetch(`${API_URL_VAL}/api/superadmin/export/stops?${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function getPhotoUrl(urlOrPath: string | null | undefined): string | null {
  if (!urlOrPath) return null;
  if (urlOrPath.startsWith('http')) return urlOrPath;
  // Backend stores paths like /uploads/proofs/filename.jpg or proofs/filename.jpg
  if (urlOrPath.startsWith('/')) return `${API_URL}${urlOrPath}`;
  return `${API_URL}/uploads/${urlOrPath}`;
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Fetch all pages of a paginated endpoint
export async function fetchAllPages<T>(
  fetcher: (page: number) => Promise<{ data: T[]; total: number; totalPages: number }>
): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  while (true) {
    const res = await fetcher(page);
    all.push(...res.data);
    if (page >= res.totalPages || res.data.length === 0) break;
    page++;
  }
  return all;
}
