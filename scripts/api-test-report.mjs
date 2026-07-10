/**
 * Comprehensive API test runner - hits every endpoint and writes a text report.
 */
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const BASE = 'http://localhost:3000/api/v1';
const suffix = `${Date.now()}`;
const report = [];
let passCount = 0;
let failCount = 0;
let skipCount = 0;

const state = {
  customerToken: null,
  customerRefresh: null,
  moverToken: null,
  adminToken: null,
  customerId: null,
  moverId: null,
  customerEmail: `apitest-customer-${suffix}@example.com`,
  moverEmail: `apitest-mover-${suffix}@example.com`,
  password: 'Password123!',
  savedAddressId: null,
  vehicleTypeId: null,
  zoneId: null,
  draftBookingId: null,
  bookingId: null,
  bookingItemId: null,
  requestId: null,
  quoteId: null,
  notificationId: null,
  disputeId: null,
  paymentId: null,
  moverUserId: null,
  verificationToken: null,
  resetToken: null,
};

function truncate(obj, maxLen = 2000) {
  const str = JSON.stringify(obj, null, 2);
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '\n... [truncated]';
}

function log(section, method, path, status, body, note = '') {
  const ok = status >= 200 && status < 300;
  if (ok) passCount++;
  else if (status === 0) skipCount++;
  else failCount++;

  report.push('');
  report.push('='.repeat(80));
  report.push(`${section} | ${method} ${path}`);
  report.push(`STATUS: ${status || 'ERROR'} ${ok ? '✓ PASS' : status === 0 ? '⊘ SKIP' : '✗ FAIL'}`);
  if (note) report.push(`NOTE: ${note}`);
  report.push('-'.repeat(80));
  report.push(typeof body === 'string' ? body : truncate(body));
}

async function waitForServer(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return;
    } catch {
      // server not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('Server not available at ' + BASE);
}

const delay = (ms = 100) => new Promise((r) => setTimeout(r, ms));

async function req(method, path, { token, body, query } = {}) {
  await delay();
  const url = new URL(BASE + path);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let data;
    const text = await res.text();
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { raw: text };
    }
    return { status: res.status, data };
  } catch (err) {
    return { status: 0, data: { error: err.message } };
  }
}

const bookingPayload = {
  pickupAddress: { street: '100 King St W', city: 'Toronto', province: 'ON', postalCode: 'M5H 1A1', country: 'CA' },
  destinationAddress: { street: '200 Bay St', city: 'Toronto', province: 'ON', postalCode: 'M5J 2J4', country: 'CA' },
  scheduledDate: '2026-09-15T10:00:00.000Z',
  items: [{ name: 'Boxes', quantity: 5, weightKg: 20, volumeM3: 1.5 }],
  distanceKm: 5.2,
  notes: 'API test booking',
};

async function run() {
  await waitForServer();
  report.push('MTO BACKEND - COMPREHENSIVE API TEST REPORT');
  report.push(`Generated: ${new Date().toISOString()}`);
  report.push(`Base URL: ${BASE}`);
  report.push('');

  // ── HEALTH ──
  {
    const r = await req('GET', '/health');
    log('HEALTH', 'GET', '/health', r.status, r.data);
  }

  // ── AUTH ──
  {
    const r = await req('POST', '/auth/register', {
      body: {
        email: state.customerEmail,
        password: state.password,
        role: 'customer',
        firstName: 'API',
        lastName: 'Customer',
        phone: '4165550100',
      },
    });
    log('AUTH', 'POST', '/auth/register (customer)', r.status, r.data);
    if (r.data?.data?.tokens) {
      state.customerToken = r.data.data.tokens.accessToken;
      state.customerRefresh = r.data.data.tokens.refreshToken;
      state.customerId = r.data.data.user?.id;
    }
  }

  {
    const r = await req('POST', '/auth/register', {
      body: {
        email: state.moverEmail,
        password: state.password,
        role: 'mover',
        businessName: 'API Test Movers',
        phone: '4165550200',
      },
    });
    log('AUTH', 'POST', '/auth/register (mover)', r.status, r.data);
    if (r.data?.data?.tokens) {
      state.moverToken = r.data.data.tokens.accessToken;
      state.moverUserId = r.data.data.user?.id;
    }
    if (r.data?.data?.verificationToken) {
      state.verificationToken = r.data.data.verificationToken;
    }
  }

  {
    const r = await req('POST', '/auth/login', {
      body: { email: state.customerEmail, password: state.password },
    });
    log('AUTH', 'POST', '/auth/login (customer)', r.status, r.data);
    if (r.data?.data?.tokens) {
      state.customerToken = r.data.data.tokens.accessToken;
      state.customerRefresh = r.data.data.tokens.refreshToken;
    }
  }

  {
    const r = await req('POST', '/auth/login', {
      body: { email: 'admin@movethisout.com', password: 'Admin123!' },
    });
    log('AUTH', 'POST', '/auth/login (admin)', r.status, r.data);
    if (r.data?.data?.tokens) state.adminToken = r.data.data.tokens.accessToken;
  }

  {
    const r = await req('GET', '/auth/me', { token: state.customerToken });
    log('AUTH', 'GET', '/auth/me', r.status, r.data);
    if (r.data?.data?.id) state.customerId = r.data.data.id;
  }

  {
    const r = await req('POST', '/auth/refresh', { body: { refreshToken: state.customerRefresh } });
    log('AUTH', 'POST', '/auth/refresh', r.status, r.data);
    if (r.data?.data?.accessToken) {
      state.customerToken = r.data.data.accessToken;
      state.customerRefresh = r.data.data.refreshToken;
    }
  }

  {
    const forgotRes = await req('POST', '/auth/forgot-password', { body: { email: state.customerEmail } });
    log('AUTH', 'POST', '/auth/forgot-password', forgotRes.status, forgotRes.data);
    if (forgotRes.data?.data?.resetToken) {
      state.resetToken = forgotRes.data.data.resetToken;
    }
  }

  if (state.resetToken) {
    const r = await req('POST', '/auth/reset-password', {
      body: { token: state.resetToken, password: state.password },
    });
    log('AUTH', 'POST', '/auth/reset-password', r.status, r.data);
  } else {
    log('AUTH', 'POST', '/auth/reset-password', 0, { skip: 'No reset token returned' });
  }

  if (state.verificationToken) {
    const r = await req('POST', '/auth/verify-email', { body: { token: state.verificationToken } });
    log('AUTH', 'POST', '/auth/verify-email', r.status, r.data);
  } else {
    log('AUTH', 'POST', '/auth/verify-email', 0, { skip: 'No verification token returned' });
  }

  // ── VEHICLES (public) ──
  {
    const r = await req('GET', '/vehicle-recommendations');
    log('VEHICLES', 'GET', '/vehicle-recommendations', r.status, r.data);
  }

  {
    const r = await req('POST', '/vehicle-recommendations/calculate', {
      body: { items: [{ name: 'Sofa', quantity: 1, weightKg: 50, volumeM3: 2 }], distanceKm: 10 },
    });
    log('VEHICLES', 'POST', '/vehicle-recommendations/calculate', r.status, r.data);
  }

  {
    const r = await req('GET', '/vehicle-types');
    log('VEHICLES', 'GET', '/vehicle-types', r.status, r.data);
    const types = r.data?.data;
    if (Array.isArray(types) && types.length) state.vehicleTypeId = types[0].id;
  }

  if (state.vehicleTypeId) {
    const r = await req('GET', `/vehicle-types/${state.vehicleTypeId}`);
    log('VEHICLES', 'GET', `/vehicle-types/${state.vehicleTypeId}`, r.status, r.data);
  } else {
    log('VEHICLES', 'GET', '/vehicle-types/:id', 0, { skip: 'No vehicle type ID available' });
  }

  // ── ZONES (public reads) ──
  {
    const r = await req('GET', '/zones');
    log('ZONES', 'GET', '/zones', r.status, r.data);
    const zones = r.data?.data;
    if (Array.isArray(zones) && zones.length) state.zoneId = zones[0].id;
  }

  {
    const r = await req('GET', '/zones/check', { query: { latitude: 43.6532, longitude: -79.3832 } });
    log('ZONES', 'GET', '/zones/check', r.status, r.data);
  }

  {
    const r = await req('GET', '/zones/pricing', {
      query: { latitude: 43.6532, longitude: -79.3832, distanceKm: 10 },
    });
    log('ZONES', 'GET', '/zones/pricing', r.status, r.data);
  }

  {
    const r = await req('GET', '/zones/availability', {
      query: { latitude: 43.6532, longitude: -79.3832, scheduledAt: '2026-09-15T10:00:00.000Z' },
    });
    log('ZONES', 'GET', '/zones/availability', r.status, r.data);
  }

  // ── ZONES (admin) ──
  {
    const r = await req('POST', '/zones', {
      token: state.adminToken,
      body: {
        name: `API Test Zone ${suffix}`,
        boundary: { type: 'circle', coordinates: { lat: 43.7, lng: -79.4, radiusKm: 10 } },
        baseFee: 30,
        isActive: true,
      },
    });
    log('ZONES', 'POST', '/zones (admin create)', r.status, r.data);
    if (r.data?.data?.id) state.zoneId = r.data.data.id;
  }

  if (state.zoneId) {
    {
      const r = await req('PATCH', `/zones/${state.zoneId}`, {
        token: state.adminToken,
        body: { baseFee: 35 },
      });
      log('ZONES', 'PATCH', `/zones/${state.zoneId}`, r.status, r.data);
    }
  }

  // ── USERS ──
  {
    const r = await req('GET', '/users/profile', { token: state.customerToken });
    log('USERS', 'GET', '/users/profile', r.status, r.data);
  }

  {
    const r = await req('PATCH', '/users/profile', {
      token: state.customerToken,
      body: { firstName: 'API', lastName: 'Tester', phone: '4165550199' },
    });
    log('USERS', 'PATCH', '/users/profile', r.status, r.data);
  }

  {
    const r = await req('PATCH', '/users/preferences', {
      token: state.customerToken,
      body: { preferences: { theme: 'dark', notifications: true } },
    });
    log('USERS', 'PATCH', '/users/preferences', r.status, r.data);
  }

  {
    const r = await req('PATCH', '/users/language', {
      token: state.customerToken,
      body: { language: 'en' },
    });
    log('USERS', 'PATCH', '/users/language', r.status, r.data);
  }

  {
    const r = await req('PATCH', '/users/notification-settings', {
      token: state.customerToken,
      body: { notificationSettings: { email: true, push: false, sms: false } },
    });
    log('USERS', 'PATCH', '/users/notification-settings', r.status, r.data);
  }

  {
    const r = await req('PATCH', '/users/privacy', {
      token: state.customerToken,
      body: { privacy: { showProfile: true, shareData: false } },
    });
    log('USERS', 'PATCH', '/users/privacy', r.status, r.data);
  }

  {
    const r = await req('GET', '/users/activity', { token: state.customerToken });
    log('USERS', 'GET', '/users/activity', r.status, r.data);
  }

  {
    const r = await req('GET', '/users/statistics', { token: state.customerToken });
    log('USERS', 'GET', '/users/statistics', r.status, r.data);
  }

  // ── SAVED ADDRESSES ──
  {
    const r = await req('POST', '/saved-addresses', {
      token: state.customerToken,
      body: {
        label: 'Home',
        street: '123 Test Ave',
        city: 'Toronto',
        province: 'ON',
        postalCode: 'M5V 1A1',
        country: 'CA',
        isDefault: true,
      },
    });
    log('SAVED ADDRESSES', 'POST', '/saved-addresses', r.status, r.data);
    if (r.data?.data?.id) state.savedAddressId = r.data.data.id;
  }

  {
    const r = await req('GET', '/saved-addresses', { token: state.customerToken });
    log('SAVED ADDRESSES', 'GET', '/saved-addresses', r.status, r.data);
  }

  {
    const r = await req('GET', '/saved-addresses/default', { token: state.customerToken });
    log('SAVED ADDRESSES', 'GET', '/saved-addresses/default', r.status, r.data);
  }

  if (state.savedAddressId) {
    {
      const r = await req('PATCH', `/saved-addresses/${state.savedAddressId}`, {
        token: state.customerToken,
        body: { label: 'Home Updated' },
      });
      log('SAVED ADDRESSES', 'PATCH', `/saved-addresses/${state.savedAddressId}`, r.status, r.data);
    }

    {
      const r = await req('POST', '/saved-addresses/default', {
        token: state.customerToken,
        body: { addressId: state.savedAddressId },
      });
      log('SAVED ADDRESSES', 'POST', '/saved-addresses/default', r.status, r.data);
    }
  }

  // ── BOOKINGS (customer direct) ──
  {
    const payload = { ...bookingPayload };
    if (state.vehicleTypeId) payload.vehicleTypeId = state.vehicleTypeId;
    const r = await req('POST', '/bookings/estimate', { token: state.customerToken, body: payload });
    log('BOOKINGS', 'POST', '/bookings/estimate', r.status, r.data);
  }

  {
    const payload = { ...bookingPayload };
    if (state.vehicleTypeId) payload.vehicleTypeId = state.vehicleTypeId;
    const r = await req('POST', '/bookings/preview', { token: state.customerToken, body: payload });
    log('BOOKINGS', 'POST', '/bookings/preview', r.status, r.data);
  }

  {
    const payload = { ...bookingPayload };
    if (state.vehicleTypeId) payload.vehicleTypeId = state.vehicleTypeId;
    const r = await req('POST', '/bookings', { token: state.customerToken, body: payload });
    log('BOOKINGS', 'POST', '/bookings (create draft)', r.status, r.data);
    if (r.data?.data?.id) state.draftBookingId = r.data.data.id;
  }

  {
    const r = await req('GET', '/bookings', { token: state.customerToken });
    log('BOOKINGS', 'GET', '/bookings', r.status, r.data);
  }

  if (state.draftBookingId) {
    const id = state.draftBookingId;

    {
      const r = await req('GET', `/bookings/${id}`, { token: state.customerToken });
      log('BOOKINGS', 'GET', `/bookings/${id}`, r.status, r.data);
    }

    {
      const r = await req('PATCH', `/bookings/${id}`, {
        token: state.customerToken,
        body: { notes: 'Updated via API test' },
      });
      log('BOOKINGS', 'PATCH', `/bookings/${id}`, r.status, r.data);
    }

    {
      const r = await req('GET', `/bookings/${id}/status`, { token: state.customerToken });
      log('BOOKINGS', 'GET', `/bookings/${id}/status`, r.status, r.data);
    }

    {
      const r = await req('GET', `/bookings/${id}/timeline`, { token: state.customerToken });
      log('BOOKINGS', 'GET', `/bookings/${id}/timeline`, r.status, r.data);
    }

    {
      const r = await req('GET', `/bookings/${id}/location`, { token: state.customerToken });
      log('BOOKINGS', 'GET', `/bookings/${id}/location`, r.status, r.data);
    }

    {
      const r = await req('GET', `/bookings/${id}/tracking`, { token: state.customerToken });
      log('BOOKINGS', 'GET', `/bookings/${id}/tracking`, r.status, r.data);
    }

    {
      const r = await req('POST', `/bookings/${id}/share`, {
        token: state.customerToken,
        body: { sharedWithEmail: 'friend@example.com', expiresInHours: 24 },
      });
      log('BOOKINGS', 'POST', `/bookings/${id}/share`, r.status, r.data);
    }

    {
      const r = await req('GET', `/bookings/${id}/items`, { token: state.customerToken });
      log('BOOKINGS', 'GET', `/bookings/${id}/items`, r.status, r.data);
      const items = r.data?.data;
      if (Array.isArray(items) && items.length) state.bookingItemId = items[0].id;
    }

    {
      const r = await req('POST', `/bookings/${id}/items`, {
        token: state.customerToken,
        body: { name: 'Desk', quantity: 1, weightKg: 30 },
      });
      log('BOOKINGS', 'POST', `/bookings/${id}/items`, r.status, r.data);
      if (r.data?.data?.id) state.bookingItemId = r.data.data.id;
    }

    if (state.bookingItemId) {
      {
        const r = await req('PATCH', `/bookings/${id}/items/${state.bookingItemId}`, {
          token: state.customerToken,
          body: { quantity: 2 },
        });
        log('BOOKINGS', 'PATCH', `/bookings/${id}/items/${state.bookingItemId}`, r.status, r.data);
      }

      {
        const r = await req('POST', `/bookings/${id}/items/photo`, {
          token: state.customerToken,
          body: { photoUrl: 'https://example.com/photo.jpg', itemId: state.bookingItemId },
        });
        log('BOOKINGS', 'POST', `/bookings/${id}/items/photo`, r.status, r.data);
      }
    }

    {
      const r = await req('POST', `/bookings/${id}/reschedule`, {
        token: state.customerToken,
        body: { scheduledDate: '2026-09-20T14:00:00.000Z', note: 'Rescheduled' },
      });
      log('BOOKINGS', 'POST', `/bookings/${id}/reschedule`, r.status, r.data);
    }

    {
      const dupRes = await req('POST', `/bookings/${id}/duplicate`, { token: state.customerToken });
      log('BOOKINGS', 'POST', `/bookings/${id}/duplicate`, dupRes.status, dupRes.data);
      const draftId = dupRes.data?.data?.id;

      if (draftId) {
        const r = await req('DELETE', `/bookings/${draftId}`, { token: state.customerToken });
        log('BOOKINGS', 'DELETE', `/bookings/${draftId} (draft)`, r.status, r.data);
      }
    }

    {
      const r = await req('POST', `/bookings/${id}/rebook`, { token: state.customerToken });
      log('BOOKINGS', 'POST', `/bookings/${id}/rebook`, r.status, r.data);
    }
  }

  // ── MOVERS profile + verify ──
  {
    const r = await req('POST', '/movers/profile', {
      token: state.moverToken,
      body: {
        businessName: 'API Test Movers',
        phone: '4165550200',
        bio: 'Professional movers',
        serviceAreas: ['Toronto'],
        documents: [{ type: 'license', url: 'https://example.com/license.pdf' }],
      },
    });
    log('MOVERS', 'POST', '/movers/profile', r.status, r.data);
  }

  {
    const r = await req('PUT', '/movers/profile', {
      token: state.moverToken,
      body: {
        businessName: 'API Test Movers Updated',
        serviceAreas: ['Toronto', 'Mississauga'],
      },
    });
    log('MOVERS', 'PUT', '/movers/profile', r.status, r.data);
  }

  {
    const r = await req('GET', '/movers/profile', { token: state.moverToken });
    log('MOVERS', 'GET', '/movers/profile', r.status, r.data);
  }

  if (state.moverUserId && state.adminToken) {
    const r = await req('PUT', `/admin/users/${state.moverUserId}/verify`, { token: state.adminToken });
    log('ADMIN', 'PUT', `/admin/users/${state.moverUserId}/verify`, r.status, r.data, 'Verify mover for quoting');
  }

  // ── CUSTOMERS marketplace flow ──
  {
    const r = await req('POST', '/customers/requests', {
      token: state.customerToken,
      body: {
        pickupAddress: '100 Start St, Toronto',
        destinationAddress: '200 End Ave, Toronto',
        movingDate: '2026-09-15',
        items: [{ name: 'Boxes', quantity: 10 }],
        additionalNotes: 'API test request',
      },
    });
    log('CUSTOMERS', 'POST', '/customers/requests', r.status, r.data);
    if (r.data?.data?.id) state.requestId = r.data.data.id;
  }

  {
    const r = await req('GET', '/customers/requests', { token: state.customerToken });
    log('CUSTOMERS', 'GET', '/customers/requests', r.status, r.data);
  }

  if (state.requestId) {
    {
      const r = await req('GET', `/customers/requests/${state.requestId}`, { token: state.customerToken });
      log('CUSTOMERS', 'GET', `/customers/requests/${state.requestId}`, r.status, r.data);
    }
  }

  {
    const r = await req('GET', '/movers/available-requests', { token: state.moverToken });
    log('MOVERS', 'GET', '/movers/available-requests', r.status, r.data);
  }

  if (state.requestId) {
    {
      const r = await req('POST', `/movers/requests/${state.requestId}/quote`, {
        token: state.moverToken,
        body: { price: 850, estimatedHours: 6, notes: 'Full service move' },
      });
      log('MOVERS', 'POST', `/movers/requests/${state.requestId}/quote`, r.status, r.data);
      if (r.data?.data?.id) state.quoteId = r.data.data.id;
    }
  }

  if (state.quoteId) {
    {
      const r = await req('POST', `/customers/requests/${state.requestId}/quotes/${state.quoteId}/counteroffer`, {
        token: state.customerToken,
        body: { price: 780, notes: 'Customer counter' },
      });
      log('CUSTOMERS', 'POST', `/customers/requests/.../counteroffer`, r.status, r.data);
    }

    {
      const r = await req('POST', `/movers/quotes/${state.quoteId}/counteroffer/respond`, {
        token: state.moverToken,
        body: { accept: true },
      });
      log('MOVERS', 'POST', `/movers/quotes/${state.quoteId}/counteroffer/respond`, r.status, r.data);
    }
  }

  if (state.requestId && state.quoteId) {
    {
      const r = await req('POST', `/customers/requests/${state.requestId}/quotes/${state.quoteId}/accept`, {
        token: state.customerToken,
      });
      log('CUSTOMERS', 'POST', `/customers/requests/.../accept`, r.status, r.data);
      if (r.data?.data?.id) state.bookingId = r.data.data.id;
    }
  }

  {
    const r = await req('GET', '/customers/bookings', { token: state.customerToken });
    log('CUSTOMERS', 'GET', '/customers/bookings', r.status, r.data);
  }

  if (state.bookingId) {
    const id = state.bookingId;

    {
      const r = await req('GET', `/customers/bookings/${id}`, { token: state.customerToken });
      log('CUSTOMERS', 'GET', `/customers/bookings/${id}`, r.status, r.data);
    }

    {
      const r = await req('GET', '/movers/bookings', { token: state.moverToken });
      log('MOVERS', 'GET', '/movers/bookings', r.status, r.data);
    }

    {
      const r = await req('POST', `/movers/bookings/${id}/accept`, { token: state.moverToken });
      log('MOVERS', 'POST', `/movers/bookings/${id}/accept`, r.status, r.data);
    }

    {
      const r = await req('POST', `/movers/bookings/${id}/tracking`, {
        token: state.moverToken,
        body: { type: 'location_update', status: 'in_transit', latitude: 43.65, longitude: -79.38, note: 'En route' },
      });
      log('MOVERS', 'POST', `/movers/bookings/${id}/tracking`, r.status, r.data);
    }

    {
      const r = await req('GET', `/movers/bookings/${id}/tracking`, { token: state.moverToken });
      log('MOVERS', 'GET', `/movers/bookings/${id}/tracking`, r.status, r.data);
    }

    {
      const r = await req('POST', `/movers/bookings/${id}/update-status`, {
        token: state.moverToken,
        body: { status: 'completed', note: 'Move completed' },
      });
      log('MOVERS', 'POST', `/movers/bookings/${id}/update-status (completed)`, r.status, r.data);
    }

    {
      const r = await req('POST', `/customers/bookings/${id}/payment`, {
        token: state.customerToken,
        body: { amount: 780, transactionRef: `TXN-${suffix}` },
      });
      log('CUSTOMERS', 'POST', `/customers/bookings/${id}/payment`, r.status, r.data);
      if (r.data?.data?.id) state.paymentId = r.data.data.id;
    }

    {
      const r = await req('POST', `/customers/bookings/${id}/review`, {
        token: state.customerToken,
        body: { rating: 5, comment: 'Great service from API test' },
      });
      log('CUSTOMERS', 'POST', `/customers/bookings/${id}/review`, r.status, r.data);
    }

    // Create second booking for dispute/cancel tests
    const req2 = await req('POST', '/customers/requests', {
      token: state.customerToken,
      body: {
        pickupAddress: '50 Cancel St',
        destinationAddress: '60 Cancel Ave',
        movingDate: '2026-10-01',
        items: [{ name: 'Chair', quantity: 2 }],
      },
    });
    if (req2.data?.data?.id) {
      const req2Id = req2.data.data.id;
      const quote2 = await req('POST', `/movers/requests/${req2Id}/quote`, {
        token: state.moverToken,
        body: { price: 400, estimatedHours: 3 },
      });
      if (quote2.data?.data?.id) {
        const book2 = await req('POST', `/customers/requests/${req2Id}/quotes/${quote2.data.data.id}/accept`, {
          token: state.customerToken,
        });
        if (book2.data?.data?.id) {
          const cancelId = book2.data.data.id;
          const r = await req('POST', `/customers/bookings/${cancelId}/cancel`, {
            token: state.customerToken,
            body: { reason: 'Plans changed' },
          });
          log('CUSTOMERS', 'POST', `/customers/bookings/${cancelId}/cancel`, r.status, r.data);
        }
      }
    }

    // Cancel an open direct booking via /bookings/:id/cancel
    const openCancelRes = await req('POST', '/bookings', {
      token: state.customerToken,
      body: { ...bookingPayload, notes: 'Booking to cancel via /bookings endpoint' },
    });
    if (openCancelRes.data?.data?.id) {
      const openCancelId = openCancelRes.data.data.id;
      const r = await req('POST', `/bookings/${openCancelId}/cancel`, {
        token: state.customerToken,
        body: { reason: 'No longer needed' },
      });
      log('BOOKINGS', 'POST', `/bookings/${openCancelId}/cancel`, r.status, r.data);
    }

    // Dispute on completed booking
    {
      const r = await req('POST', `/customers/bookings/${id}/dispute`, {
        token: state.customerToken,
        body: { reason: 'Minor damage to item during API test' },
      });
      log('CUSTOMERS', 'POST', `/customers/bookings/${id}/dispute`, r.status, r.data);
      if (r.data?.data?.id) state.disputeId = r.data.data.id;
    }

    // ── MESSAGING ──
    {
      const r = await req('GET', `/bookings/${id}/messages`, { token: state.customerToken });
      log('MESSAGING', 'GET', `/bookings/${id}/messages`, r.status, r.data);
    }

    {
      const r = await req('POST', `/bookings/${id}/messages`, {
        token: state.customerToken,
        body: { content: 'Hello mover, when will you arrive?' },
      });
      log('MESSAGING', 'POST', `/bookings/${id}/messages`, r.status, r.data);
    }

    {
      const r = await req('POST', `/bookings/${id}/messages`, {
        token: state.moverToken,
        body: { content: 'Arriving in 30 minutes!' },
      });
      log('MESSAGING', 'POST', `/bookings/${id}/messages (mover)`, r.status, r.data);
    }

    {
      const r = await req('PATCH', `/bookings/${id}/messages/read`, { token: state.customerToken });
      log('MESSAGING', 'PATCH', `/bookings/${id}/messages/read`, r.status, r.data);
    }
  }

  // ── NOTIFICATIONS ──
  {
    const r = await req('GET', '/notifications', { token: state.customerToken });
    log('NOTIFICATIONS', 'GET', '/notifications', r.status, r.data);
    const notifs = r.data?.data;
    if (Array.isArray(notifs) && notifs.length) state.notificationId = notifs[0].id;
  }

  if (state.notificationId) {
    {
      const r = await req('PATCH', `/notifications/${state.notificationId}/read`, { token: state.customerToken });
      log('NOTIFICATIONS', 'PATCH', `/notifications/${state.notificationId}/read`, r.status, r.data);
    }
  }

  {
    const r = await req('PATCH', '/notifications/read-all', { token: state.customerToken });
    log('NOTIFICATIONS', 'PATCH', '/notifications/read-all', r.status, r.data);
  }

  // ── ADMIN ──
  {
    const r = await req('GET', '/admin/users', { token: state.adminToken });
    log('ADMIN', 'GET', '/admin/users', r.status, r.data);
  }

  {
    const r = await req('GET', '/admin/bookings', { token: state.adminToken });
    log('ADMIN', 'GET', '/admin/bookings', r.status, r.data);
  }

  {
    const r = await req('GET', '/admin/disputes', { token: state.adminToken });
    log('ADMIN', 'GET', '/admin/disputes', r.status, r.data);
    if (!state.disputeId) {
      const disputes = r.data?.data;
      if (Array.isArray(disputes) && disputes.length) state.disputeId = disputes[0].id;
    }
  }

  if (state.disputeId) {
    const r = await req('POST', `/admin/disputes/${state.disputeId}/resolve`, {
      token: state.adminToken,
      body: { resolution: 'Refund issued - API test resolution' },
    });
    log('ADMIN', 'POST', `/admin/disputes/${state.disputeId}/resolve`, r.status, r.data);
  }

  {
    const r = await req('POST', '/admin/promotions', {
      token: state.adminToken,
      body: {
        code: `TEST${suffix.slice(-6)}`,
        title: 'API Test Promo',
        description: '10% off',
        discountPercent: 10,
        validFrom: '2026-01-01T00:00:00.000Z',
        validTo: '2027-12-31T23:59:59.000Z',
      },
    });
    log('ADMIN', 'POST', '/admin/promotions', r.status, r.data);
  }

  if (state.paymentId) {
    const r = await req('POST', `/admin/payments/${state.paymentId}/refund`, { token: state.adminToken });
    log('ADMIN', 'POST', `/admin/payments/${state.paymentId}/refund`, r.status, r.data);
  } else {
    log('ADMIN', 'POST', '/admin/payments/:id/refund', 0, { skip: 'No payment ID from flow' });
  }

  {
    const r = await req('GET', '/admin/analytics', { token: state.adminToken });
    log('ADMIN', 'GET', '/admin/analytics', r.status, r.data);
  }

  // ── CLEANUP: saved address delete, zone delete ──
  if (state.savedAddressId) {
    const r = await req('DELETE', `/saved-addresses/${state.savedAddressId}`, { token: state.customerToken });
    log('SAVED ADDRESSES', 'DELETE', `/saved-addresses/${state.savedAddressId}`, r.status, r.data);
  }

  if (state.zoneId) {
    const r = await req('DELETE', `/zones/${state.zoneId}`, { token: state.adminToken });
    log('ZONES', 'DELETE', `/zones/${state.zoneId}`, r.status, r.data);
  }

  // ── AUTH LOGOUT (last) ──
  {
    const r = await req('POST', '/auth/logout', { token: state.customerToken });
    log('AUTH', 'POST', '/auth/logout', r.status, r.data);
  }

  // ── SUMMARY ──
  report.push('');
  report.push('='.repeat(80));
  report.push('SUMMARY');
  report.push('='.repeat(80));
  report.push(`Total endpoints tested: ${passCount + failCount + skipCount}`);
  report.push(`PASSED (2xx): ${passCount}`);
  report.push(`FAILED (non-2xx): ${failCount}`);
  report.push(`SKIPPED: ${skipCount}`);
  report.push(`Success rate: ${((passCount / (passCount + failCount || 1)) * 100).toFixed(1)}%`);
  report.push('');
  report.push('Test accounts created:');
  report.push(`  Customer: ${state.customerEmail}`);
  report.push(`  Mover: ${state.moverEmail}`);
  report.push(`  Admin: admin@movethisout.com (seeded)`);

  const outPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'API_TEST_REPORT.txt');
  writeFileSync(outPath, report.join('\n'), 'utf8');
  console.log(`Report written to: ${outPath}`);
  console.log(`PASSED: ${passCount} | FAILED: ${failCount} | SKIPPED: ${skipCount}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
