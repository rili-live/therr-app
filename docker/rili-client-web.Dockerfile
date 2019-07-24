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

# Note: This is the client web app package.json
COPY ./rili-client-web/package*.json ./

EXPOSE 7070
CMD [ "node", "--require=./node_modules/dotenv/config", "./build/server-client.js", "dotenv_config_path=./.env", "--withAllLogs" ]