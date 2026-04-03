-- Database and user setup
-- Run this as a PostgreSQL superuser (for local setup)

SELECT 'CREATE DATABASE api_security_platform'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'api_security_platform')\gexec

DO $$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'api_user') THEN
      CREATE ROLE api_user LOGIN PASSWORD 'secure_password';
   END IF;
END
$$;

GRANT ALL PRIVILEGES ON DATABASE api_security_platform TO api_user;

\connect api_security_platform

DO $$
DECLARE
   obj record;
BEGIN
   FOR obj IN
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
         AND tablename IN ('users', 'scans', 'results')
   LOOP
      EXECUTE format('ALTER TABLE public.%I OWNER TO api_user', obj.tablename);
   END LOOP;

   FOR obj IN
      SELECT sequencename
      FROM pg_sequences
      WHERE schemaname = 'public'
         AND sequencename IN ('users_id_seq', 'scans_id_seq', 'results_id_seq')
   LOOP
      EXECUTE format('ALTER SEQUENCE public.%I OWNER TO api_user', obj.sequencename);
   END LOOP;
END
$$;

GRANT USAGE, CREATE ON SCHEMA public TO api_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO api_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO api_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO api_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO api_user;
