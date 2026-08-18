/**
 * Typed client for the Foodiana backend API.
 *
 * This is the frontend's only data source — there is no Supabase client in the
 * browser any more. The service-role key, the staff password and every table
 * write live behind this HTTP boundary, which is also what makes the backend
 * independently scalable.
 */

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
).replace(/\/+$/, '');

const TOKEN_KEY = 'foodiana-staff-token';

export type StaffRole = 'admin' | 'agent';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** True when the venue is at capacity and the gate must hold entry. */
  get isCapacityFull() {
    return this.code === 'CAPACITY_FULL';
  }

  /** True when the token is missing, expired or rejected. */
  get isAuthFailure() {
    return this.status === 401;
  }
}

// ---- token storage ---------------------------------------------------------
// sessionStorage, so closing the tab signs the gate device out.

export const staffToken = {
  get(): string | null {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage.getItem(TOKEN_KEY);
  },
  set(token: string): void {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(TOKEN_KEY, token);
  },
  clear(): void {
    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem(TOKEN_KEY);
  },
};

// ---- transport -------------------------------------------------------------

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Attach the staff bearer token. */
  auth?: boolean;
  signal?: AbortSignal;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = false, signal } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['content-type'] = 'application/json';

  if (auth) {
    const token = staffToken.get();
    if (!token) throw new ApiError(401, 'UNAUTHORIZED', 'You are signed out. Please sign in again.');
    headers.authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      `Cannot reach the API at ${API_BASE_URL}. Check that the backend is running.`,
    );
  }

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    // An expired or revoked token should not leave the UI in a signed-in state.
    if (response.status === 401 && auth) staffToken.clear();
    throw new ApiError(
      response.status,
      (payload?.code as string) || 'REQUEST_FAILED',
      (payload?.error as string) || `Request failed with status ${response.status}`,
      payload?.details,
    );
  }

  return payload as T;
}

// ---- shared record types ---------------------------------------------------

export type TicketTier = {
  id: string;
  day: string;
  start_time: string;
  end_time: string;
  price: number;
  includes_concert: boolean;
  label_en: string;
  label_bn: string;
  is_active: boolean;
  display_order: number;
};

export type Visitor = {
  id: string;
  qr_code_id: string;
  name: string;
  email: string;
  mobile: string;
  profession: string;
  payment_status: string;
  payment_method: string | null;
  entry_status: boolean;
  exited_status: boolean;
  checked_in_at: string | null;
  exited_at: string | null;
  created_at: string;
  ticket_tier_id: string | null;
  ticket_price: number | null;
  includes_concert: boolean;
};

/** The subset of visitor columns the gate scanner receives. */
export type ScanVisitor = Omit<Visitor, 'email' | 'created_at'>;

export type VisitorMetrics = {
  total: number;
  paid: number;
  pending: number;
  checkedIn: number;
  exited: number;
  insideNow: number;
};

export type CrowdMetrics = {
  insideNow: number;
  capacity: number;
  available: number;
  isFull: boolean;
};

export type EventSettings = {
  event_date: string | null;
  event_end_date: string | null;
  ground_capacity: number;
  updated_at?: string | null;
};

export type ContentRecord = Record<string, unknown> & { id: string };

/** Real table names, which double as the content endpoint segment. */
export type ContentTable =
  | 'guests'
  | 'advisors'
  | 'management_members'
  | 'sponsors'
  | 'brand_stalls';

export type PublicContent = {
  eventDate: string | null;
  eventEndDate: string | null;
  guests: ContentRecord[];
  advisors: ContentRecord[];
  management: ContentRecord[];
  sponsors: ContentRecord[];
  brandStalls: ContentRecord[];
};

export type RegistrationInput = {
  name: string;
  email: string;
  mobile: string;
  dob: string;
  profession: string;
  ticket_tier_id: string;
};

export type RegistrationResult = {
  qr_code_id: string;
  name: string;
  price: number;
  includes_concert: boolean;
  label_en: string | null;
  label_bn: string | null;
};

export type VisitorFilter = 'all' | 'paid' | 'pending' | 'entered' | 'inside' | 'exited';

export type GateResult = {
  status: string;
  visitor: ScanVisitor;
  crowd: CrowdMetrics;
};

const query = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
};

// ---- endpoints -------------------------------------------------------------

export const api = {
  auth: {
    login: (password: string) =>
      request<{ token: string; role: StaffRole; expiresIn: string }>('/api/auth/login', {
        method: 'POST',
        body: { password },
      }),
    me: () => request<{ role: StaffRole }>('/api/auth/me', { auth: true }),
  },

  /** Unauthenticated reads for the landing page and registration form. */
  publicData: {
    content: (signal?: AbortSignal) =>
      request<PublicContent>('/api/public/content', { signal }),
    ticketTiers: (signal?: AbortSignal) =>
      request<{ tiers: TicketTier[] }>('/api/public/ticket-tiers', { signal }),
    eventSettings: (signal?: AbortSignal) =>
      request<{ eventDate: string | null; eventEndDate: string | null }>(
        '/api/public/event-settings',
        { signal },
      ),
  },

  register: (input: RegistrationInput) =>
    request<RegistrationResult>('/api/register', { method: 'POST', body: input }),

  scan: {
    crowd: (signal?: AbortSignal) =>
      request<{ crowd: CrowdMetrics }>('/api/scan/crowd', { auth: true, signal }),
    lookup: (qrCodeId: string) =>
      request<{ visitor: ScanVisitor; tier: TicketTier | null; status: string }>(
        `/api/scan/lookup/${encodeURIComponent(qrCodeId)}`,
        { auth: true },
      ),
    admit: (visitorId: string, paymentMethod?: 'Cash' | 'bKash') =>
      request<GateResult>(`/api/scan/visitor/${visitorId}/entry`, {
        method: 'POST',
        auth: true,
        body: { payment_method: paymentMethod ?? null },
      }),
    exit: (visitorId: string) =>
      request<GateResult>(`/api/scan/visitor/${visitorId}/exit`, {
        method: 'POST',
        auth: true,
      }),
  },

  admin: {
    metrics: () =>
      request<{ metrics: VisitorMetrics; crowd: CrowdMetrics }>('/api/admin/metrics', {
        auth: true,
      }),

    visitors: (params: { filter: VisitorFilter; search: string; page: number; pageSize: number }) =>
      request<{ visitors: Visitor[]; total: number; page: number; pageSize: number }>(
        `/api/admin/visitors${query(params)}`,
        { auth: true },
      ),

    markPaid: (id: string) =>
      request<{ visitor: Visitor }>(`/api/admin/visitors/${id}/payment`, {
        method: 'PATCH',
        auth: true,
      }),
    allowEntry: (id: string) =>
      request<{ status: string; visitor: Visitor | null; crowd: CrowdMetrics }>(
        `/api/admin/visitors/${id}/entry`,
        { method: 'PATCH', auth: true },
      ),
    markExited: (id: string) =>
      request<{ status: string; visitor: Visitor | null; crowd: CrowdMetrics }>(
        `/api/admin/visitors/${id}/exit`,
        { method: 'PATCH', auth: true },
      ),

    raffle: () =>
      request<{ visitors: Visitor[]; total: number }>('/api/admin/raffle', { auth: true }),

    ticketTiers: () =>
      request<{ tiers: TicketTier[] }>('/api/admin/ticket-tiers', { auth: true }),
    createTier: (payload: Partial<TicketTier>) =>
      request<{ tier: TicketTier }>('/api/admin/ticket-tiers', {
        method: 'POST',
        auth: true,
        body: payload,
      }),
    updateTier: (id: string, payload: Partial<TicketTier>) =>
      request<{ tier: TicketTier }>(`/api/admin/ticket-tiers/${id}`, {
        method: 'PATCH',
        auth: true,
        body: payload,
      }),
    deleteTier: (id: string) =>
      request<void>(`/api/admin/ticket-tiers/${id}`, { method: 'DELETE', auth: true }),

    eventSettings: () =>
      request<{ settings: EventSettings | null }>('/api/admin/event-settings', { auth: true }),
    updateEventSettings: (payload: Partial<EventSettings>) =>
      request<{ settings: EventSettings }>('/api/admin/event-settings', {
        method: 'PATCH',
        auth: true,
        body: payload,
      }),

    content: {
      list: (table: ContentTable) =>
        request<{ items: ContentRecord[] }>(`/api/admin/content/${table}`, { auth: true }),
      create: (table: ContentTable, payload: Record<string, unknown>) =>
        request<{ item: ContentRecord }>(`/api/admin/content/${table}`, {
          method: 'POST',
          auth: true,
          body: payload,
        }),
      update: (table: ContentTable, id: string, payload: Record<string, unknown>) =>
        request<{ item: ContentRecord }>(`/api/admin/content/${table}/${id}`, {
          method: 'PATCH',
          auth: true,
          body: payload,
        }),
      remove: (table: ContentTable, id: string) =>
        request<void>(`/api/admin/content/${table}/${id}`, { method: 'DELETE', auth: true }),
    },
  },
};
