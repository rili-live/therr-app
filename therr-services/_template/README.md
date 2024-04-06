# new-service

This is a starter template for creating a new microservice. Start by making a copy of the `_starter_template` directory and rename it. For example `restaurants-service`.


Next perform the following steps
1. Find and replace `new-service` in `/microservices/restaurants-service/Dockerfile`, `/microservices/restaurants-service/src/tracing.ts` and `/microservices/restaurants-service/package.json` with `restaurants-service`.
2. Replace `3330` in `/microservices/restaurants-service//Dockerfile` with an available port
3. Replace `NEW_SERVICE_API_PORT` in `/microservices/restaurants-service/index.ts` with an appropriately named env variable. Then add the env variable to `/.env.template` and your local `.env` file. The port should match the port in the `Dockerfile`
4. Replace `NEW_SERVICE_DATABASE` in `/microservices/restaurants-service/src/store/connections.ts` and `/microservices/restaurants-service/src/store/knexfile.js` with the name of the new database for this microservice. Also make the same changes in the respective `.env*` files
5. To deploy the new microservice, update the relevant Kubernetes IAC in `/k8s/prod`