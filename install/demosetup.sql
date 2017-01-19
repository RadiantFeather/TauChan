TRUNCATE boards CASCADE;
TRUNCATE users CASCADE;
TRUNCATE assign CASCADE;
TRUNCATE news CASCADE;
TRUNCATE logs CASCADE;
DO $$DECLARE r text;
BEGIN
	FOR r IN SELECT c.relname FROM pg_class c 
	WHERE c.relkind = 'S' AND c.relname LIKE '%_post_seq' LOOP
		EXECUTE 'DROP SEQUENCE ' || r;
	END LOOP;
END;$$ LANGUAGE plpgsql;
 


