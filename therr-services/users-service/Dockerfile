# Rebuild the source code only when needed
FROM therrapp/service-dependencies AS builder

ARG BUILD_MODE=production
ENV BUILD_MODE $BUILD_MODE

RUN npm i npm@latest -g

WORKDIR /app

# Create app directory
RUN mkdir /app/therr-services && mkdir /app/therr-services/users-service
WORKDIR /app/therr-services/users-service
COPY . .

# Install microservice dependencies
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci --ignore-scripts --omit=optional --legacy-peer-deps; \
  elif [ -f pnpm-lock.yaml ]; then yarn global add pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi
RUN if [ "$BUILD_MODE" = "development" ]; then \
    echo "Building in $BUILD_MODE mode" \
    && npm run build:dev; \
  else \
    echo "Building in $BUILD_MODE mode" \
    && npm run build;\
  fi

# Production image, copy all the files and run next
FROM builder AS runner
WORKDIR /app

# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodeuser

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/therr-services/users-service ./therr-services/users-service

COPY --from=builder --chown=nodeuser:nodejs /app/therr-services/users-service/build ./
COPY --from=builder --chown=nodeuser:nodejs /app/therr-services/users-service/build ./build

WORKDIR /app/therr-services/users-service

# check every 30s to ensure this service returns HTTP 200
# HEALTHCHECK --interval=30s CMD node healthcheck.js

# Run app with an environment equal to the mode that it was built
ARG BUILD_MODE=production
ENV BUILD_MODE $BUILD_MODE
ENV NODE_ENV $BUILD_MODE
RUN echo "Running app in $NODE_ENV"

USER nodeuser
EXPOSE 7771
ENV PORT 7771

CMD ["node", "build/server.js"]
