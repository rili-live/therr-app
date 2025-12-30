# Therr App
<!-- main: [![Build Status](https://travis-ci.org/rili-live/therr-app.svg?branch=main)](https://travis-ci.org/rili-live/therr-app) | stage: [![Build Status](https://travis-ci.org/rili-live/therr-app.svg?branch=stage)](https://travis-ci.org/rili-live/therr-app) -->
main: [![CircleCI](https://circleci.com/gh/rili-live/therr-app/tree/main.svg?style=svg)](https://circleci.com/gh/rili-live/therr-app/tree/main) | stage: [![CircleCI](https://circleci.com/gh/rili-live/therr-app/tree/stage.svg?style=svg)](https://circleci.com/gh/rili-live/therr-app/tree/stage)
#
## Mobile Build
main: [![Build status](https://build.appcenter.ms/v0.1/apps/0f4a527c-5807-47dc-bea5-ff66fbdab26c/branches/main/badge)](https://appcenter.ms)
#

## Description
A social network that connects people by proximity through the distance of time

## Getting Started

### Option 1: Docker Compose - Backend Services (Recommended)

Run backend services in Docker, frontend locally. Best balance of convenience and debugging.

```bash
# Start backend stack (first run takes ~5-10 min)
npm run docker:dev:up

# View logs
npm run docker:dev:logs

# Stop everything
npm run docker:dev:down

# Clean restart (wipes databases)
npm run docker:dev:clean && npm run docker:dev:up
```

Then start frontend apps locally (in separate terminals):
```bash
cd therr-client-web && npm run dev          # Web Client: http://localhost:7070
cd therr-client-web-dashboard && npm run dev # Dashboard: http://localhost:7071
```

Backend services available at:
- API Gateway: http://localhost:7770
- Users Service: http://localhost:7771
- Messages Service: http://localhost:7772
- Maps Service: http://localhost:7773
- Reactions Service: http://localhost:7774
- Push Notifications: http://localhost:7775
- WebSocket: http://localhost:7743

### Option 2: Docker Compose - Infrastructure Only (Hybrid)

Run databases in Docker, services locally. Best performance, lower memory usage.

```bash
# Start postgres + redis
npm run docker:infra:up

# Run services locally (in separate terminals)
npm run install:all && npm run build:all:dev
cd therr-api-gateway && npm run dev
cd therr-services/users-service && npm run dev
# ... etc for other services
```

### Option 3: Manual Setup

If you prefer running services natively:

#### Database Setup
First we need to setup Postgres and Redis to run locally. Mac users can install [postgres with brew](https://formulae.brew.sh/formula/postgresql@14). Make sure postgis is installed as it's required for maps services.

**Using Docker for databases only:**
```bash
npm run docker:run:postgres  # PostgreSQL on port 5431
npm run docker:run:redis     # Redis on port 6380
```

We need to create 4 dev databases: `therr_dev_users`, `therr_dev_maps`, `therr_dev_reactions`, `therr_dev_messages`. Then run the database migration scripts found in each sub-directory. See each microservice README.md for detailed steps.

#### Installing Dependencies
We have helper scripts in the root package.json. Use nvm to manage node versions.

```bash
npm run install:all      # Install deps across all packages
npm run build:all:dev    # Build all custom libraries
```

#### Running Services
Setup the `.env` with correct credentials (copy from `.env.template`). Each microservice can be started with:

```bash
cd therr-services/users-service
npm run dev  # Runs webpack watch + nodemon
```

See each microservice README.md for detailed steps.

## Documentation
Documentation is mantained within the repo to align with a mentality of inline documentation,
knowledge share, self documenting code, and consolidation of information/configrations.
* [Architecture Overview](./docs/ARCHITECTURE.md) - System design, patterns, and technical decisions
* [General Documentation & Best Practices](./docs/#readme)
* [CI/CD Documentation](./docs/#readme)

### Libraries & Utilities Docs
*These packages should use treeshaking and emphasize reusability, clean code, single-purpose methodologies*
* [JS Utilities Documentation](./therr-public-library/therr-js-utilities/#readme)
* [React Library Documentation](./therr-public-library/therr-react/#readme)
* [Styles Library Documentation](./therr-public-library/therr-styles/#readme)

### API Gateway Docs
*API Gateway is a public service that interfaces with microservices. It adds a
layer of abstraction along with security and validations.*
* [API Gateway Documentation](./therr-api-gateway/#readme)

### Microservice Docs
*Microservices are secured in a private subnet (excluding websocket-service).*
* [Maps Service Documentation](./therr-services/maps-service/#readme)
* [Messages Service Documentation](./therr-services/messages-service/#readme)
* [Users Service Documentation](./therr-services/users-service/#readme)
* [Websocket Service Documentation](./therr-services/websocket-service/#readme)

### Frontend Docs
*The web frontend and mobile app frontend share a common redux layer from the Therr React Library*
* [Therr Client Mobile Documentation](./TherrMobile/#readme)
* [Therr Client Web Documentation](./therr-client-web/#readme)
* [Therr Client Web Dashbaord Documentation](./therr-client-web-dashboard/#readme)
