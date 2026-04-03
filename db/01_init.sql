-- Database and user setup
-- Run this as a PostgreSQL superuser (for local setup)

CREATE DATABASE api_security_platform;

DO $$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'api_user') THEN
      CREATE ROLE api_user LOGIN PASSWORD 'secure_password';
   END IF;
END
$$;

GRANT ALL PRIVILEGES ON DATABASE api_security_platform TO api_user;
