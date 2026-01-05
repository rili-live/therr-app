# Claude Code Instructions - API Gateway

## Service Overview

- **Port**: 7770
- **Database**: None (uses Redis for rate limiting)
- **Purpose**: Public API entry point, routing, authentication, rate limiting

## Key Responsibilities

- JWT authentication and user context extraction
- Rate limiting (Redis-backed)
- CORS and security headers
- Request validation
- Proxying requests to internal microservices

## Directory Structure

```
src/
├── middleware/
│   ├── authenticate.ts         # JWT verification (required)
│   ├── authenticateOptional.ts # JWT verification (optional)
│   ├── authorize.ts            # Access level checks
│   ├── handleServiceRequest.ts # Service proxy logic
│   └── rateLimiters.ts         # Rate limit configuration
├── routes/
│   └── index.ts                # Main router setup
├── services/                   # Per-service route definitions
│   ├── users/router.ts
│   ├── maps/router.ts
│   ├── messages/router.ts
│   ├── reactions/router.ts
│   ├── push-notifications/router.ts
│   └── campaigns/router.ts
├── store/
│   ├── UsersService.ts         # User service client
│   ├── MapsService.ts          # Maps service client
│   └── redisClient.ts          # Redis connection
└── validation/                 # Request validation schemas
```

## Key Patterns

### Header Propagation
After JWT verification, user context is forwarded to services via headers:
```
x-userid, x-username, x-user-access-levels, x-organizations, x-brand-variation, x-platform, x-localecode
```

### Service Routing
Each service has its own router in `src/services/{service}/router.ts`:
- Defines routes with validation middleware
- Specifies auth requirements per endpoint
- Configures rate limits per endpoint

### Rate Limiting
Two tiers in `middleware/rateLimiters.ts`:
- Generic: 1000 requests/minute per IP
- Endpoint-specific: configurable per route (login, registration, etc.)

### Request Validation
Uses `express-validator` for input validation:
- Validation schemas in `src/services/{service}/validation/`
- Applied as middleware before handler

### Proxy Pattern
`handleServiceRequest.ts` proxies to internal services:
- Forwards authenticated user context
- Handles response streaming
- Error normalization

## Adding New Endpoints

1. Add route in `src/services/{service}/router.ts`
2. Add validation in `src/services/{service}/validation/`
3. Optionally add rate limit in `middleware/rateLimiters.ts`
4. Add handler in the target microservice

## Related Services

- Routes to: users-service, maps-service, messages-service, reactions-service, push-notifications-service
- Uses: Redis for rate limiting and caching

## Code Quality

Before completing code changes, run linting and fix all errors:

```bash
npx eslint src/**/*.ts --fix   # Auto-fix issues
npx eslint src/**/*.ts         # Verify no errors remain
```

See root `CLAUDE.md` for full code quality requirements.
