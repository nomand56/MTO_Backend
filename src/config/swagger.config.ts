import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const API_ENDPOINTS = `
## Implemented API Modules

### Users
- \`GET /users/profile\`
- \`PATCH /users/profile\`
- \`PATCH /users/preferences\`
- \`PATCH /users/language\`
- \`PATCH /users/notification-settings\`
- \`PATCH /users/privacy\`
- \`GET /users/activity\`
- \`GET /users/statistics\`

### Saved Addresses
- \`GET /saved-addresses\`
- \`POST /saved-addresses\`
- \`PATCH /saved-addresses/:id\`
- \`DELETE /saved-addresses/:id\`
- \`GET /saved-addresses/default\`
- \`POST /saved-addresses/default\`

### Bookings
- \`POST /bookings\`
- \`POST /bookings/estimate\`
- \`POST /bookings/preview\`
- \`GET /bookings\`
- \`GET /bookings/:id\`
- \`PATCH /bookings/:id\`
- \`DELETE /bookings/:id\`
- \`POST /bookings/:id/cancel\`
- \`POST /bookings/:id/reschedule\`
- \`POST /bookings/:id/duplicate\`
- \`POST /bookings/:id/rebook\`
- \`GET /bookings/:id/status\`
- \`GET /bookings/:id/timeline\`
- \`GET /bookings/:id/location\`
- \`GET /bookings/:id/tracking\`
- \`POST /bookings/:id/share\`
- \`GET /bookings/:id/items\`
- \`POST /bookings/:id/items\`
- \`PATCH /bookings/:id/items/:itemId\`
- \`DELETE /bookings/:id/items/:itemId\`
- \`POST /bookings/:id/items/photo\`

### Vehicles
- \`GET /vehicle-recommendations\`
- \`POST /vehicle-recommendations/calculate\`
- \`GET /vehicle-types\`
- \`GET /vehicle-types/:id\`

### Zones
- \`GET /zones\`
- \`GET /zones/check\`
- \`GET /zones/pricing\`
- \`GET /zones/availability\`
- \`POST /zones\` (admin)
- \`PATCH /zones/:id\` (admin)
- \`DELETE /zones/:id\` (admin)
`;

export function setupSwagger(app: INestApplication, apiPrefix: string) {
  const config = new DocumentBuilder()
    .setTitle('MoveThisOut API')
    .setDescription(
      `MoveThisOut is a marketplace backend for moving services.

## Overview
Customers create moving requests, movers submit quotes, and bookings are confirmed after negotiation.

## Authentication
Most endpoints require a JWT access token. Obtain one via \`POST /auth/login\` or \`POST /auth/register\`, then click **Authorize** and paste: \`Bearer <accessToken>\`

## Roles
- **customer** — create requests, accept quotes, manage bookings, reviews, payments
- **mover** — submit quotes, manage profile, update booking status and tracking
- **admin** — verify users, manage disputes, promotions, analytics, zones

## WebSocket (Real-time chat)
- Namespace: \`/chat\`
- Connect with JWT in \`auth.token\` or \`Authorization: Bearer <token>\`
- Events: \`joinBooking\`, \`sendMessage\`, \`newMessage\`

## Response format
All REST responses are wrapped as:
\`\`\`json
{ "success": true, "data": { ... } }
\`\`\`
Errors return:
\`\`\`json
{ "success": false, "statusCode": 400, "message": "...", "path": "...", "timestamp": "..." }
\`\`\`
${API_ENDPOINTS}`,
    )
    .setVersion('1.0.0')
    .setContact('MoveThisOut', 'https://movethisout.com', 'support@movethisout.com')
    .addServer(`http://localhost:3000/${apiPrefix}`, 'Local development')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'JWT access token from /auth/login',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Health', 'Service health check')
    .addTag('Auth', 'Registration, login, tokens, password reset, email verification')
    .addTag('Users', 'Profile, preferences, privacy, activity, and statistics')
    .addTag('Saved Addresses', 'Saved places and default address management')
    .addTag('Bookings', 'Booking creation, estimates, live tracking, and items')
    .addTag('Vehicles', 'Vehicle types and load-based recommendations')
    .addTag('Zones', 'Service zones, coverage checks, pricing, and availability')
    .addTag('Customers', 'Customer moving requests, quotes, bookings, reviews, payments')
    .addTag('Movers', 'Mover profiles, quotes, bookings, tracking')
    .addTag('Admin', 'User verification, disputes, promotions, analytics')
    .addTag('Notifications', 'In-app notifications')
    .addTag('Messaging', 'Booking chat messages')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey, methodKey) => `${controllerKey}_${methodKey}`,
    deepScanRoutes: true,
  });

  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'MoveThisOut API Docs',
    jsonDocumentUrl: 'api/docs-json',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
      showRequestDuration: true,
      tryItOutEnabled: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  return document;
}
