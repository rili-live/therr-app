#!/bin/bash
set -e

echo "Initializing Therr development databases..."

# Create databases for each microservice
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_USER" <<-EOSQL
    -- Create databases for each microservice
    CREATE DATABASE therr_dev_users;
    CREATE DATABASE therr_dev_messages;
    CREATE DATABASE therr_dev_maps;
    CREATE DATABASE therr_dev_reactions;

    -- Grant permissions
    GRANT ALL PRIVILEGES ON DATABASE therr_dev_users TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE therr_dev_messages TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE therr_dev_maps TO $POSTGRES_USER;
    GRANT ALL PRIVILEGES ON DATABASE therr_dev_reactions TO $POSTGRES_USER;
EOSQL

# Enable PostGIS extension on maps database (requires PostGIS image)
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "therr_dev_maps" <<-EOSQL
    CREATE EXTENSION IF NOT EXISTS postgis;
    CREATE EXTENSION IF NOT EXISTS postgis_topology;
EOSQL

echo "Databases initialized successfully!"
