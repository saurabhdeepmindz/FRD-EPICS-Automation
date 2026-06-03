-- ONE-TIME setup — grants prd_user the rights to create/alter schema objects.
-- After this runs once as postgres, all future migrations + `prisma db push`
-- can run as prd_user (no postgres superuser password needed again).
--
-- Run as: psql -U postgres -d new_prd_generator -f prisma/migrations/_setup_prd_user_permissions.sql

-- Let prd_user create tables, types, indexes in the public schema
GRANT ALL ON SCHEMA public TO prd_user;
GRANT CREATE ON SCHEMA public TO prd_user;

-- Give prd_user full rights on everything that already exists
GRANT ALL PRIVILEGES ON ALL TABLES    IN SCHEMA public TO prd_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO prd_user;

-- And on everything created in the future (so new tables auto-grant to prd_user)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO prd_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO prd_user;

-- Make prd_user the owner of public schema so it can CREATE TYPE going forward
ALTER SCHEMA public OWNER TO prd_user;
