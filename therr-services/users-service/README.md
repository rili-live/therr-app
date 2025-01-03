# users-service
Provides endpoints to query data from users database

## Setting up therr_dev_users database
Make sure you have installed postgres.
Follow below steps with provided commands to configure database locally

1. Login to postgres service.
`psql postgres`

2. Create new user with password. Make your user a supeuser to avoid privilege issues. In .env file update the username and password.
`CREATE ROLE newUser WITH LOGIN PASSWORD ‘password’;`
`ALTER USER newUser WITH SUPERUSER;`

3. Now Create Database named therr_dev_users.
`CREATE DATABASE therr_dev_users;`

4. Access the created therr_dev_users database and create schema named main.
`\c therr_dev_users`
`CREATE SCHEMA main;`

5. Grant privilege for database usage and schema to your created user.
`GRANT ALL PRIVILEGES ON DATABASE therr_dev_users TO newUser;`
`GRANT USAGE ON SCHEMA main TO newUser;`

6. Now Run the migration script found in package.json.
`npm run migrations:run`

...
