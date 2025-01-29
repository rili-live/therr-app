ARG NODE_VERSION=20.18.1
FROM node:${NODE_VERSION}-alpine as base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
# Needed for bcrypt
RUN apk add --no-cache python3 make g++

RUN npm i npm@latest -g

# Create app directory
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
COPY ./therr-public-library ./therr-public-library
COPY ./.babelrc ./
COPY ./global-config.js ./
COPY ./webpack.parts.js ./
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci --ignore-scripts --omit=optional --legacy-peer-deps; \
  elif [ -f pnpm-lock.yaml ]; then yarn global add pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi
RUN npm i sass-embedded-linux-musl-arm64 -D --legacy-peer-deps
RUN npm rebuild bcrypt --build-from-source

# Install and build styles library
WORKDIR /app/therr-public-library/therr-styles
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci --ignore-scripts --omit=optional --legacy-peer-deps; \
  elif [ -f pnpm-lock.yaml ]; then yarn global add pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi
RUN npm run build

# Install and build JS utilities library
WORKDIR /app/therr-public-library/therr-js-utilities
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci --ignore-scripts --omit=optional --legacy-peer-deps; \
  elif [ -f pnpm-lock.yaml ]; then yarn global add pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi
RUN npm run build

# Install and build ReactJS library
WORKDIR /app/therr-public-library/therr-react
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci --ignore-scripts --omit=optional --legacy-peer-deps; \
  elif [ -f pnpm-lock.yaml ]; then yarn global add pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi
RUN npm run build

WORKDIR /app

CMD ["sh"]
