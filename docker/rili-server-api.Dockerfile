ARG NODE_VERSION=12.2.0
FROM node:$NODE_VERSION

ARG NODE_ENV=production
ENV NODE_ENV $NODE_ENV
ARG NODE_RUNNER=node
ENV NODE_RUNNER $NODE_RUNNER

EXPOSE 7770

RUN npm i npm@latest -g

# Create app directory
RUN mkdir /usr/src/app && mkdir /usr/src/app/rili-server && chown -R node:node /usr/src/app
WORKDIR /usr/src/app

# the official node image provides an unprivileged user as a security best practice
# but we have to manually enable it. We put it here so npm installs dependencies as the same
# user who runs the app. 
# https://github.com/nodejs/docker-node/blob/master/docs/BestPractices.md#non-root-user
USER node

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# Note: This is the root mono-repo directory
COPY package*.json ./
COPY .babelrc ./
COPY global-config.js ./
COPY webpack.parts.js ./
COPY rili-public-library/ ./rili-public-library/

# check every 30s to ensure this service returns HTTP 200
# HEALTHCHECK --interval=30s CMD node healthcheck.js

# Install dependencies and set PATH variable
# Even in production, set NODE_ENV to development so that all dependencies are installed
RUN NODE_ENV=development && npm ci && NODE_ENV=$NODE_ENV
ENV PATH $PATH:/usr/src/app/node_modules/.bin:$PATH

# Install and build libraries
WORKDIR /usr/src/app/rili-public-library/styles
RUN npm run build
WORKDIR /usr/src/app/rili-public-library/utilities
RUN npm run build
WORKDIR /usr/src/app/rili-public-library/react-components
RUN npm run build
WORKDIR /usr/src/app

COPY ./rili-server rili-server
WORKDIR /usr/src/app/rili-server

USER root
RUN chown -R node:node /usr/src/app
USER node
RUN if [ "$NODE_ENV" = "development" ]; then \
      echo "Building in $NODE_ENV environment" \
      && npm run build:dev; \
    else \
      echo "Building in $NODE_ENV environment" \
      && npm run build;\
    fi
RUN echo "Starting node with $NODE_RUNNER"

CMD npx $NODE_RUNNER --require=../node_modules/dotenv/config ./build/server-api.js dotenv_config_path=../.env --withAllLogs
