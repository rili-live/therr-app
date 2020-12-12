# Therr App
master: [![Build Status](https://travis-ci.org/rili-live/therr-app.svg?branch=master)](https://travis-ci.org/rili-live/therr-app) | stage: [![Build Status](https://travis-ci.org/rili-live/therr-app.svg?branch=stage)](https://travis-ci.org/rili-live/therr-app)
#
## Mobile Build
master: [![Build status](https://build.appcenter.ms/v0.1/apps/0f4a527c-5807-47dc-bea5-ff66fbdab26c/branches/master/badge)](https://appcenter.ms)
#

## Description
A social network that connects people by proximity through the distance of time

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
