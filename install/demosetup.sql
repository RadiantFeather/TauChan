TRUNCATE boards CASCADE;
TRUNCATE posts CASCADE;
DO $$DECLARE r text;
BEGIN
	FOR r IN SELECT c.relname FROM pg_class c 
	WHERE c.relkind = 'S' AND c.relname LIKE '%_post_seq' LOOP
		EXECUTE 'DROP SEQUENCE ' || r;
	END LOOP;
END;$$ LANGUAGE plpgsql;
--Setup boards
INSERT INTO boards (board, title, listed, nsfw, tags) VALUES
 ('b', 'Random', TRUE, TRUE, '["random","social","world","memes"]')
,('a', 'Anime', TRUE, FALSE, '["anime","cartoon","animation","memes"]')
,('news', 'World News and Happenings', TRUE, FALSE, '["news","world","politics","information"]')
,('pol', 'Pollitically Incorrect', TRUE, TRUE, '["politics", "memes", "discussion"]')
,('isis', 'Terrorist Activities', FALSE, TRUE, '["discussion", "world", "social"]')
,('pone', 'My Little Pony', TRUE, FALSE, '["pony","toys","cartoon","animation","discussion"]')
;


