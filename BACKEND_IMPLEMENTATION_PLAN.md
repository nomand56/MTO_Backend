# MoveThisOut Backend Implementation Plan

## 1. Product Overview
MoveThisOut is a marketplace for moving services where customers request jobs, movers submit offers, and admins oversee the platform. The backend must support:
- customer and mover onboarding
- moving request lifecycle
- quote and negotiation workflow
- booking management
- real-time communication and tracking
- notifications and reviews
- admin operations and analytics

## 2. Recommended Tech Stack
- Runtime: Node.js
- Framework: NestJS (TypeScript)
- Database: PostgreSQL
- Cache/Realtime: Redis + WebSockets / Socket.IO
- Background Jobs: BullMQ
- File Storage: AWS S3 or Azure Blob Storage
- Authentication: JWT + refresh tokens
- Search: Elasticsearch or PostgreSQL full-text search for initial release
- Messaging/Email: SendGrid / Mailgun / Twilio
- Monitoring: Prometheus + Grafana + Sentry
- Containerization: Docker + Docker Compose
- Deployment: AWS / Azure / DigitalOcean

## 3. Backend Architecture
Use a modular monolith initially for faster delivery, then split into services later if traffic grows.

### Core Modules
1. Auth & Identity
   - registration/login
   - role-based access control
   - OTP/email verification
   - password reset
   - session and refresh token handling

2. User Management
   - customer profile
   - mover profile
   - documents and verification status
   - service areas and availability

3. Moving Requests & RFQ
   - create request
   - attach pickup/destination info
   - item descriptions and moving requirements
   - request lifecycle status

4. Quotes & Negotiation
   - mover offers
   - counteroffers
   - accepted/rejected offers
   - negotiation history

5. Booking Management
   - confirmed bookings
   - scheduling and rescheduling
   - cancellations
   - payment and booking status transitions

6. Messaging & Notifications
   - in-app chat between customer and mover
   - push/email/SMS notifications
   - booking reminders and status updates

7. Tracking & Job Progress
   - live status updates
   - GPS events or manual status tracking
   - timeline history

8. Reviews & Ratings
   - submit reviews after completion
   - moderation and reporting

9. Admin Panel APIs
   - manage users and movers
   - verify movers
   - moderate disputes
   - manage promotions and categories
   - view analytics and reports

10. Payments & Invoicing
   - deposit/booking payments
   - platform commissions
   - refunds and invoice generation

## 4. Database Design
### Main Entities
- users
- roles
- user_profiles
- mover_profiles
- mover_verifications
- service_areas
- moving_requests
- request_items
- quotes
- quote_counteroffers
- bookings
- booking_status_history
- messages
- notifications
- tracking_events
- reviews
- payments
- promotions
- disputes
- admin_settings
- audit_logs

### Relationships
- one user can have one profile and multiple roles
- one moving request belongs to one customer and many quotes
- one booking belongs to one request and one mover
- one booking can have many status updates, messages, and tracking events
- one review belongs to one booking

## 5. API Design Structure
### Auth APIs
- POST /auth/register
- POST /auth/login
- POST /auth/refresh-token
- POST /auth/forgot-password
- POST /auth/reset-password
- POST /auth/verify-email

### Customer APIs
- POST /customers/requests
- GET /customers/requests
- GET /customers/requests/:id
- POST /customers/requests/:id/quotes/:quoteId/accept
- POST /customers/requests/:id/quotes/:quoteId/counteroffer
- GET /customers/bookings
- GET /customers/bookings/:id
- POST /customers/bookings/:id/cancel
- POST /customers/bookings/:id/review

### Mover APIs
- POST /movers/profile
- PUT /movers/profile
- GET /movers/available-requests
- POST /movers/requests/:id/quote
- POST /movers/quotes/:id/counteroffer
- POST /movers/bookings/:id/accept
- POST /movers/bookings/:id/update-status
- GET /movers/bookings

### Admin APIs
- GET /admin/users
- PUT /admin/users/:id/verify
- GET /admin/bookings
- GET /admin/disputes
- POST /admin/promotions
- GET /admin/analytics

## 6. Core Business Workflows
### Customer Request Flow
1. Customer submits a moving request
2. Request is stored and matched to relevant movers
3. Movers submit quotes
4. Customer reviews quotes and negotiates
5. Booking is confirmed when both parties agree
6. Booking status and tracking updates are published
7. Review is submitted after completion

### Mover Onboarding Flow
1. Mover registers
2. Mover submits profile, documents, and service area
3. Admin verifies identity and service quality
4. Verified mover can start receiving bookings

## 7. Security & Compliance Requirements
- JWT-based authentication with refresh tokens
- Role-based access control for customer, mover, admin
- Input validation and sanitization
- rate limiting and brute-force protection
- encryption for sensitive data
- audit logs for admin actions
- secure file upload handling
- GDPR-style data deletion and privacy controls

## 8. Non-Functional Requirements
- support for concurrent booking requests
- low-latency quote and chat operations
- high availability for booking and tracking flows
- observability with logs, metrics, and traces
- horizontal scalability for future growth

## 9. Recommended Backend Structure
```text
src/
  main.ts
  app.module.ts
  common/
    decorators/
    filters/
    guards/
    interceptors/
    pipes/
    utils/
  auth/
  users/
  movers/
  requests/
  quotes/
  bookings/
  messaging/
  notifications/
  tracking/
  reviews/
  payments/
  admin/
  analytics/
  config/
  database/
  jobs/
```

## 10. Implementation Phases
### Phase 1 – MVP
- user registration and authentication
- customer request creation
- mover quote submission
- booking confirmation
- basic admin dashboard
- notifications

### Phase 2 – Real-Time & Marketplace Features
- in-app messaging
- negotiation workflow
- live tracking updates
- push notifications
- booking history and review flow

### Phase 3 – Scale & Growth
- advanced analytics
- promotions and referral engine
- multi-region support
- payment split support
- dispute resolution workflows

## 11. Suggested Delivery Timeline
- Week 1–2: requirements, database schema, auth, user profiles
- Week 3–4: requests, quotes, and booking flow
- Week 5–6: messaging, notifications, and reviews
- Week 7–8: admin APIs, analytics, testing, deployment

## 12. Testing Strategy
- unit tests for services and validators
- integration tests for booking and negotiation flows
- API tests for all major endpoints
- load testing for quote and booking spikes
- end-to-end tests for customer/mover/admin journeys

## 13. Recommended First Deliverables
1. Authentication and role-based access
2. Customer and mover profile modules
3. Moving request creation and quote submission
4. Booking confirmation and status transitions
5. Basic notification engine
6. Admin user and booking oversight

## 14. Final Recommendation
Build the backend as a modular monolith first, with clear domain boundaries and event-driven hooks for later service extraction. This provides the fastest path to MVP while keeping the architecture scalable for future growth.
