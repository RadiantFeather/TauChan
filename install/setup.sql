CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE pg_opclass AS opc SET opcdefault = TRUE FROM pg_am am WHERE opc.opcmethod = am.oid AND am.amname = 'gist' AND opc.opcname = 'inet_ops' AND opcdefault = FALSE; 
/* Fix for GIST not using inet_ops as default inet opclass for some bloody reason. */

CREATE TYPE LOGLEVEL AS ENUM ('info','notice','warning','error','server');

CREATE USER tauchan UNENCRYPTED PASSWORD 'tauchan' SUPERUSER CREATEDB REPLICATION NOCREATEROLE INHERIT LOGIN;
/* UNENCRYPTED PASSWORD 'tauchan' */
CREATE DATABASE tauchan WITH OWNER tauchan;