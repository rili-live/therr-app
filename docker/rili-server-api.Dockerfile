FROM node:12.2.0

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# Note: This is the root package.json
COPY package*.json ./

# RUN npm install
# If you are building your code for production
RUN npm ci --only=production

# Note: This is the api service package.json
COPY ./rili-server/package*.json ./

EXPOSE 7770
CMD [ "node", "--require=./node_modules/dotenv/config", "./build/server-api.js", "dotenv_config_path=./.env", "--withAllLogs" ]