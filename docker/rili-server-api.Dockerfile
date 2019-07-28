ARG NODE_VERSION=12.2.0
FROM node:$NODE_VERSION

# set our node environment, either development or production
# defaults to production, compose overrides this to development on build and run
ARG NODE_ENV=production
ENV NODE_ENV $NODE_ENV

EXPOSE 7770

RUN npm i npm@latest -g

# Create app directory
RUN mkdir /usr/src/app && chown node:node /usr/src/app
WORKDIR /usr/src/app

# the official node image provides an unprivileged user as a security best practice
# but we have to manually enable it. We put it here so npm installs dependencies as the same
# user who runs the app. 
# https://github.com/nodejs/docker-node/blob/master/docs/BestPractices.md#non-root-user
USER node

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# Note: This is the root package.json
COPY package*.json ./

# RUN npm install
# If you are building your code for production
RUN npm ci --only=production

# Note: This is the api service package.json
COPY ./rili-server/package*.json ./

CMD [ "node", "--require=./node_modules/dotenv/config", "./build/server-api.js", "dotenv_config_path=./.env", "--withAllLogs" ]