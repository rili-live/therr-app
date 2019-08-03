ARG NODE_VERSION=10.15.3
FROM node:$NODE_VERSION

# set our node environment, either development or production
# defaults to production, compose overrides this to development on build and run
ARG NODE_ENV=production
ENV NODE_ENV $NODE_ENV
ARG NODE_RUNNER=nodemon
ENV NODE_RUNNER $NODE_RUNNER

EXPOSE 7770

RUN npm i npm@latest -g

# Create app directory
RUN mkdir /usr/src/app && chown -R node:node /usr/src/app
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
RUN npm install --no-optional && npm cache clean --force
ENV PATH /usr/src/app/node_modules/.bin:$PATH
COPY rili-server/package*.json ./

# check every 30s to ensure this service returns HTTP 200
# HEALTHCHECK --interval=30s CMD node healthcheck.js

RUN echo "Starting node with $NODE_RUNNER"

CMD npx $NODE_RUNNER --require=./node_modules/dotenv/config ./build/server-api.js dotenv_config_path=./.env --withAllLogs
