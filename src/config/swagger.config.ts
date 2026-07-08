import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

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
- **admin** — verify users, manage disputes, promotions, analytics

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
`,
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
    .addTag('Customers', 'Customer moving requests, quotes, bookings, reviews, payments')
    .addTag('Movers', 'Mover profiles, quotes, bookings, tracking')
    .addTag('Admin', 'User verification, disputes, promotions, analytics')
    .addTag('Notifications', 'In-app notifications')
    .addTag('Messaging', 'Booking chat messages')
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey, methodKey) => `${controllerKey}_${methodKey}`,
  });

  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'MoveThisOut API Docs',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
      showRequestDuration: true,
      tryItOutEnabled: true,
    },
  });

  return document;
}
