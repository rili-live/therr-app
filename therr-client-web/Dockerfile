ARG NODE_VERSION=20.18.1
FROM node:$NODE_VERSION

# Build in development allow devDependencies/dependencies to be installed correctly
ENV NODE_ENV development

ARG BUILD_MODE=production
ENV BUILD_MODE $BUILD_MODE

RUN npm i npm@latest -g

# Create app directory
RUN mkdir /usr/src/app && mkdir /usr/src/app/client-web && chown -R node:node /usr/src/app
WORKDIR /usr/src/app

# the official node image provides an unprivileged user as a security best practice
# but we have to manually enable it. We put it here so npm installs dependencies as the same
# user who runs the app. 
# https://github.com/nodejs/docker-node/blob/master/docs/BestPractices.md#non-root-user
USER node

# Copy parent app config
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# Note: This is the root mono-repo directory
COPY ./package*.json ./
COPY ./.babelrc ./
COPY ./global-config.js ./
COPY ./webpack.parts.js ./
COPY ./node_modules ./node_modules
COPY ./therr-public-library ./therr-public-library

# Set libary directory permissions
USER root
RUN chown -R node:node /usr/src/app
USER node

# Install (shared) parent app dependencies and set PATH variable
# Even in production, install devDependencies
# RUN npm ci --no-optional
ENV PATH $PATH:/usr/src/app/node_modules/.bin:$PATH

# Install and build libraries (commented out bc run by ci/cd at base)
# WORKDIR /usr/src/app/therr-public-library/therr-styles
# RUN npm run build
# WORKDIR /usr/src/app/therr-public-library/therr-js-utilities
# RUN npm run build
# WORKDIR /usr/src/app/therr-public-library/therr-react
# RUN npm run build

# Copy main app files
WORKDIR /usr/src/app
COPY ./therr-client-web ./therr-client-web
COPY ./_bin/start-frontend-services.sh ./therr-client-web/start-frontend-services.sh
COPY ./therr-client-web-dashboard ./therr-client-web-dashboard
USER root
RUN chown -R node:node /usr/src/app/therr-client-web /usr/src/app/therr-client-web-dashboard
USER node

WORKDIR /usr/src/app/therr-client-web-dashboard
RUN if [ "$BUILD_MODE" = "development" ]; then \
      echo "Building dashboard app in $BUILD_MODE mode" \
      && npm run build:dev; \
    else \
      echo "Building dashboard app in $BUILD_MODE mode" \
      && npm run build; \
    fi

WORKDIR /usr/src/app/therr-client-web
RUN if [ "$BUILD_MODE" = "development" ]; then \
      echo "Building web app in $BUILD_MODE mode" \
      && npm run build:dev; \
    else \
      echo "Building web app in $BUILD_MODE mode" \
      && npm run build; \
    fi

# check every 30s to ensure this service returns HTTP 200
# HEALTHCHECK --interval=30s CMD node healthcheck.js

# Run app with an environment equal to the mode that it was built
ARG BUILD_MODE=production
ENV BUILD_MODE $BUILD_MODE
ENV NODE_ENV $BUILD_MODE
RUN echo "Running app in $NODE_ENV"

EXPOSE 7070 7071

# Run both servers simultaneously
# https://stackoverflow.com/questions/46496743/what-is-the-proper-way-to-start-multiple-local-node-js-servers
CMD ./start-frontend-services.sh
