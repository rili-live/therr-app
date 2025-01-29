# Rebuild the source code only when needed
FROM therrapp/service-dependencies AS builder

ARG BUILD_MODE=production
ENV BUILD_MODE $BUILD_MODE

RUN npm i npm@latest -g

WORKDIR /app

# Create client web directory
RUN mkdir /app/therr-client-web-dashboard
WORKDIR /app/therr-client-web-dashboard
COPY ./therr-client-web-dashboard .

# Create client web dashboard directory
RUN mkdir /app/therr-client-web
WORKDIR /app/therr-client-web
COPY ./therr-client-web .
COPY ./_bin/start-frontend-services.sh .

# Install microservice dependencies (client-web)
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

# Install microservice dependencies (client-web-dashboard)
WORKDIR /app/therr-client-web-dashboard
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
WORKDIR /app/therr-client-web

# Production image, copy all the files and run next
FROM builder AS runner
WORKDIR /app

# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodeuser

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/therr-client-web ./therr-client-web
COPY --from=builder /app/therr-client-web-dashboard ./therr-client-web-dashboard

COPY --from=builder --chown=nodeuser:nodejs /app/therr-client-web/start-frontend-services.sh ./
COPY --from=builder --chown=nodeuser:nodejs /app/therr-client-web/build ./
COPY --from=builder --chown=nodeuser:nodejs /app/therr-client-web/build ./build
COPY --from=builder --chown=nodeuser:nodejs /app/therr-client-web-dashboard/build ./
COPY --from=builder --chown=nodeuser:nodejs /app/therr-client-web-dashboard/build ./build

WORKDIR /app/therr-client-web

# check every 30s to ensure this service returns HTTP 200
# HEALTHCHECK --interval=30s CMD node healthcheck.js

# Run app with an environment equal to the mode that it was built
ARG BUILD_MODE=production
ENV BUILD_MODE $BUILD_MODE
ENV NODE_ENV $BUILD_MODE
RUN echo "Running app in $NODE_ENV"

USER nodeuser
EXPOSE 7070 7071
ENV PORT 7770
ENV PORT_DASHBOARD 7771

# Run both servers simultaneously
# https://stackoverflow.com/questions/46496743/what-is-the-proper-way-to-start-multiple-local-node-js-servers
CMD ./start-frontend-services.sh
