CREATE EXTENSION IF NOT EXISTS pgcrypto; 

UPDATE pg_opclass AS opc SET opcdefault = TRUE
FROM pg_am am
WHERE opc.opcmethod = am.oid 
AND am.amname = 'gist' 
AND opc.opcname = 'inet_ops'
AND opc.opcdefault = FALSE; -- Fix for GIST not using inet_ops as default inet opclass for some bloody reason.
DO $$BEGIN 
	IF (NOT EXISTS (SELECT 1 FROM pg_catalog.pg_type WHERE typname = 'loglevel')) THEN 
		CREATE TYPE loglevel AS ENUM('access','info','notice','alert');
	END IF;
END$$;

