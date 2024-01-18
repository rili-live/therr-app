ARG NODE_VERSION=20.11.0
FROM node:$NODE_VERSION

# Run install in development for devDependencies/dependencies to be installed correctly
ENV NODE_ENV development

ARG BUILD_MODE=production
ENV BUILD_MODE $BUILD_MODE

RUN npm i npm@latest -g

# Create app directory
RUN mkdir /usr/src/app && mkdir /usr/src/app/therr-services && mkdir /usr/src/app/therr-services/messages-service && chown -R node:node /usr/src/app
WORKDIR /usr/src/app

# the official node image provides an unprivileged user as a security best practice
# but we have to manually enable it. We put it here so npm installs dependencies as the same
# user who runs the app. 
# https://github.com/nodejs/docker-node/blob/master/docs/BestPractices.md#non-root-user
USER node

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# Note: This is the root mono-repo directory
COPY ./package*.json ./
COPY ./.babelrc ./
COPY ./global-config.js ./
COPY ./webpack.parts.js ./
COPY ./therr-public-library ./therr-public-library

# Set libary directory permissions
USER root
RUN chown -R node:node /usr/src/app
USER node

# Install dependencies and set PATH variable
# Even in production, install devDependencies
RUN npm ci --omit=optional --legacy-peer-deps
ENV PATH $PATH:/usr/src/app/node_modules/.bin:$PATH

# Install and build libraries
WORKDIR /usr/src/app/therr-public-library/therr-js-utilities
RUN npm run build

# Copy main app files
WORKDIR /usr/src/app
COPY ./therr-services/messages-service ./therr-services/messages-service
USER root
RUN chown -R node:node /usr/src/app/therr-services/messages-service
USER node
WORKDIR /usr/src/app/therr-services/messages-service

RUN if [ "$BUILD_MODE" = "development" ]; then \
      echo "Building in $BUILD_MODE mode" \
      && npm run build:dev; \
    else \
      echo "Building in $BUILD_MODE mode" \
      && npm run build;\
    fi

# check every 30s to ensure this service returns HTTP 200
# HEALTHCHECK --interval=30s CMD node healthcheck.js

# Run app with an environment equal to the mode that it was built
ARG BUILD_MODE=production
ENV BUILD_MODE $BUILD_MODE
ENV NODE_ENV $BUILD_MODE
RUN echo "Running app in $NODE_ENV"

EXPOSE 7772

CMD ["node", "./build/server.js"]
