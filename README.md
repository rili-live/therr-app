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
First we need to setup Postgres and Redis to run locally. Mac users can install [postgres with brew](https://formulae.brew.sh/formula/postgresql@14). It's best to configure postgres with no password for simplicity. We can also create a user and grant them superuser privileges. See 'Database Setup below'. Also make sure postgis is installed along with postgres as its required for maps services. See 'Database Setup below'.

#### Database Setup
We first need to create our 4 dev databases therr_dev_users, therr_dev_maps, therr_dev_reactions, therr_dev_messages and create a schema, "main" in each db. Then we can proceed to run the database migration scrips found in each sub-directory. See each microservice README.md (ie. therr-services/users-service/README.md) for detailed steps.

#### Installing Dependencies
We have some helper scripts in the root package.json. Try `npm run install:all` to loop through each microservice and install npm packages. This script first preps your environment to ensure you have the correct npm and node version. It's best to use nvm to manage these versions. Run `npm run build:all:dev` from the root to build all the custom libraries.

#### Running The App Locally
Setup the .env with correct credentials. Each microservice has it's own package.json with start scripts. We can simply build with `npm run build:dev` then run `npm run start` to run the nodejs service with nodemon. See each microservice README.md (ie. therr-services/users-service/README.md) for detailed steps.

## Documentation
Documentation is mantained within the repo to align with a mentality of inline documentation,
knowledge share, self documenting code, and consolidation of information/configrations.
* [General Documentation & Best Practices](./_docs/#readme)
* [CI/CD Documentation](./_docs/#readme)

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

...
