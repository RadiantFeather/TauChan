-------------------------------------------
-- Encrypt and validate passwords with md5 salt
--
CREATE OR REPLACE FUNCTION hash_password() RETURNS TRIGGER AS $$
BEGIN
	NEW.passphrase := crypt(NEW.passphrase,gen_salt('md5'::TEXT));
	RETURN NEW;
END;$$ LANGUAGE plpgsql;

CREATE TRIGGER hash_password
	BEFORE INSERT OR UPDATE OF passphrase ON users
	FOR EACH ROW
	EXECUTE PROCEDURE hash_password();
	
-------------------------------------------
-- Convience function for getting a user value via login or existing token
--
CREATE OR REPLACE FUNCTION fetch_user(_user VARCHAR(32), _pass VARCHAR(64)) RETURNS SETOF users AS $$
BEGIN
	IF (_pass IS NOT NULL) THEN
		RETURN QUERY SELECT * FROM users WHERE username = _user AND (passphrase = crypt(_pass, passphrase));
	ELSE
		RETURN QUERY SELECT * FROM users WHERE token = _user;
	END IF;
END;$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fetch_user_roles(_user INTEGER) RETURNS JSONB[] AS $$
DECLARE rv JSONB[]; x RECORD;
BEGIN
	FOR x IN SELECT r.board,r.capcode,r.role,r.flags 
		FROM assign a RIGHT OUTER JOIN roles r ON (a.board = r.board AND a.role = r.role) 
		WHERE a.id = _user
	LOOP
		rv := rv || jsonb_build_object('board',x.board,'capcode',x.capcode,'role',x.role,'flags',x.flags);
	END LOOP;
	RETURN rv;
END;$$ LANGUAGE plpgsql;

-------------------------------------------
-- Compiles post numbers that have cited the requested post into a JSON array
--
CREATE OR REPLACE FUNCTION fetch_cites(_board VARCHAR(32), _thread INTEGER, _post INTEGER) RETURNS JSON AS $$
DECLARE target RECORD; rv INTEGER[];
BEGIN
	FOR target IN SELECT board,thread,post FROM cites WHERE board = _board AND thread = _thread AND cites.targets ? CONCAT_WS('/',_board,_thread,_post) ORDER BY post ASC LOOP
		rv := rv || target.post;
	END LOOP;
	RETURN array_to_json(rv);
END;$$ LANGUAGE plpgsql;

-------------------------------------------
-- Compiles media locations into a correctly ordered JSON array
--
CREATE OR REPLACE FUNCTION fetch_media(_board VARCHAR(32), _post INTEGER) RETURNS JSON AS $$
DECLARE target RECORD; rv JSON[];
BEGIN
	FOR target IN SELECT * FROM media WHERE board = _board AND post = _post ORDER BY sort ASC LOOP
		rv := rv || to_json(target);
	END LOOP;
	RETURN array_to_json(rv);
END;$$ LANGUAGE plpgsql;

-------------------------------------------
-- Concats the cite values for proper indexing support
--
CREATE OR REPLACE FUNCTION clean_cites() RETURNS TRIGGER AS $$
DECLARE target RECORD; rv TEXT[];
BEGIN
	IF (jsonb_array_length(NEW.targets) > 0) THEN
		FOR target IN SELECT board,thread,post FROM jsonb_populate_recordset(NULL::TEXT,NEW.targets) LOOP
			rv := rv || CONCAT_WS('/',target.board,target.thread,target.post);
		END LOOP;
		NEW.targets := array_to_jsonb(rv);
	END IF;
	RETURN NEW;
END;$$ LANGUAGE plpgsql;

CREATE TRIGGER clean_cites
	BEFORE INSERT OR UPDATE ON cites
	FOR EACH ROW
	EXECUTE PROCEDURE clean_cites();
	
-------------------------------------------
-- Updates sort field with proper order value
--
CREATE OR REPLACE FUNCTION order_media() RETURNS TRIGGER AS $$
BEGIN
	SELECT COUNT(1) INTO NEW.sort FROM media WHERE board = NEW.board AND post = NEW.post;
	RETURN NEW;
END;$$ LANGUAGE plpgsql;

CREATE TRIGGER order_media
	BEFORE INSERT ON media
	FOR EACH ROW
	EXECUTE PROCEDURE order_media();
	
-------------------------------------------
-- Manage the post sequences since it's relied on per board.
--
CREATE OR REPLACE FUNCTION board_seq() RETURNS TRIGGER AS $$
DECLARE temp BIGINT;
BEGIN
	IF (TG_OP = 'INSERT') THEN
		EXECUTE format('CREATE SEQUENCE %I MINVALUE 1',concat_ws('_',NEW.board,'post','seq'));
		RETURN NEW;
	ELSIF (TG_OP = 'DELETE') THEN
		EXECUTE format('DROP SEQUENCE IF EXISTS %I',concat_ws('_',OLD.board,'post','seq'));
		RETURN OLD;
	ELSIF (TG_OP = 'UPDATE') THEN 
		IF (OLD.board <> NEW.board) THEN	--Update post sequence id if board id changes
			temp := currval(concat_ws('_',OLD.board,'post','seq'));
			EXECUTE format('DROP SEQUENCE %I',concat_ws('_',OLD.board,'post','seq'));
			EXECUTE format('CREATE SEQUENCE %I MINVALUE 1 OWNED BY boards.board',concat_ws('_',NEW.board,'post','seq'));
			PERFORM setval(concat_ws('_',NEW.board,'post','seq'),temp);
		END IF;
		RETURN NEW;
	END IF;
END;$$ LANGUAGE plpgsql;

CREATE TRIGGER board_seq 
	AFTER INSERT OR DELETE OR UPDATE ON boards
	FOR EACH ROW
	EXECUTE PROCEDURE board_seq();
	
-------------------------------------------
-- Update necessary tables that utilize username.
--
CREATE OR REPLACE FUNCTION username_change() RETURNS TRIGGER AS $$
BEGIN
	IF (TG_OP = 'UPDATE' AND OLD.username <> NEW.username) THEN 
		UPDATE news SET username = NEW.username WHERE username = OLD.username;
		UPDATE logs SET username = NEW.username WHERE username = OLD.username;
	END IF;
	RETURN NEW;
END;$$ LANGUAGE plpgsql;

CREATE TRIGGER username_change
	AFTER UPDATE ON users
	FOR EACH ROW
	EXECUTE PROCEDURE username_change();
	
-------------------------------------------
-- Proxy function that takes care of managing data for new posts.
-- 
CREATE OR REPLACE VIEW post AS 	
	SELECT _.*, p.*, t.pinned, t.sticky, t.anchor, t.cycle, t.locked, t.sage, t.nsfw 
	FROM posts p, threads t, (VALUES ('1'::JSONB,'1'::JSONB)) AS _(media,cites);
	
CREATE OR REPLACE FUNCTION post() RETURNS TRIGGER AS $$
DECLARE b RECORD; m RECORD; n RECORD; h JSONB; i BIGINT;
BEGIN
	SET TIME ZONE 'UTC';
	SELECT NEXTVAL(CONCAT_WS('_',NEW.board,'post','seq')) INTO NEW.post;
	SELECT bumplimit,threadlimit,postlimit,noname,archivethreads,archivedlifespan INTO b FROM boards WHERE board = NEW.board;
	IF (NEW.thread IS NULL) THEN NEW.thread := NEW.post; END IF;
	IF (NEW.name = '') THEN NEW.name := NULL; END IF;
	IF (NEW.email = 'sage') THEN NEW.sage := TRUE; END IF;
	IF (NEW.posted IS NULL) THEN NEW.posted := NOW(); END IF; --Set manually to update the recent post bump value for the board
	IF (NEW.media IS NOT NULL) THEN
		FOR m IN SELECT * FROM jsonb_array_elements(NEW.media) LOOP
			h := h || m.value;
		END LOOP;
		IF (jsonb_array_length(h) > 0) THEN 
			PERFORM check_media(NEW.board, NEW.thread, h); -- Validate post media requirements
		END IF;
	END IF;
	
	SELECT COUNT(1) INTO i FROM posts WHERE board = NEW.board AND post <> thread AND capcode IS NULL;
	IF (NEW.capcode IS NULL AND i >= b.postlimit) THEN
		RAISE check_violation	--Validate thread reply limit
			USING MESSAGE = 'New post failed.',
			DETAIL = 'Thread has reached the reply limit.',
			CONSTRAINT = 'thread_reply_limit_reached';
	END IF;
	
	INSERT INTO posts(post, thread, board, posted, ip, hash, name, trip, subject, email, capcode, markdown, markup) VALUES (
		NEW.post, NEW.thread, NEW.board, NEW.posted, NEW.ip, NEW.hash, NEW.name, NEW.trip, 
		NEW.subject, NEW.email, NEW.capcode, NEW.markdown, NEW.markup
	);
	
	IF (NEW.post = NEW.thread) THEN
		IF (NEW.pinned IS TRUE) THEN	--Only one pinned thread allowed per board and pinned thread must be a sticky
			UPDATE threads SET pinned = FALSE WHERE board = NEW.board AND pinned = TRUE;
			NEW.sticky = TRUE;
		END IF;
		INSERT INTO threads (op,board,bumped,pinned,sticky,anchor,cycle,locked,sage,nsfw) 
			VALUES (NEW.thread, NEW.board, NEW.posted, 
			coalesce(NEW.pinned,FALSE), coalesce(NEW.sticky,FALSE), 
			coalesce(NEW.anchor,FALSE), coalesce(NEW.cycle,FALSE), 
			coalesce(NEW.locked,FALSE), coalesce(NEW.sage,FALSE), 
			coalesce(NEW.nsfw,FALSE)
		);
	ELSIF (NEW.sage IS FALSE) THEN --Bump threads for non-sage replies.
		UPDATE threads SET bumped = NEW.posted WHERE op = NEW.thread AND sage = FALSE;
	END IF;
	
	IF (b.archivethreads IS TRUE) THEN
		DELETE FROM posts p USING threads t --Delete threads that have expired past their archived lifespan
		WHERE p.post = p.thread AND p.post = t.op 
			AND t.archived IS NOT NULL AND NEW.posted - t.archived > b.archivedlifespan;
		UPDATE threads SET archived = NEW.posted WHERE op IN ( --Archive threads that have fallen past the board thread limit
			SELECT op FROM threads
			WHERE board = NEW.board
			ORDER BY pinned DESC, sticky DESC, anchor DESC, bumped DESC, op DESC
			OFFSET b.threadlimit
		);
	ELSE 
		DELETE FROM posts p USING threads t --Delete threads that have fallen past the board thread limit
		WHERE p.post IN (
			SELECT op FROM threads
			WHERE board = NEW.board
			ORDER BY pinned DESC, sticky DESC, anchor DESC, bumped DESC, op DESC
			OFFSET b.threadlimit
		);
	END IF;
	
	SELECT COUNT(1) INTO i FROM posts WHERE board = NEW.board AND thread = NEW.thread AND post <> NEW.thread;
	IF (i <= b.bumplimit) THEN
		UPDATE boards SET bumped = NEW.posted WHERE board = NEW.board; --Update recent post bump for board
	END IF;
	IF (NEW.media IS NOT NULL) THEN
		FOR m IN SELECT * FROM jsonb_to_recordset(NEW.media) AS _(hash TEXT, board VARCHAR(32), thread INTEGER, post INTEGER, mediatype CHAR(3), nsfw BOOLEAN, src TEXT, thumb TEXT, meta JSON) LOOP
			INSERT INTO media (hash,board,thread,post,mediatype,nsfw,src,thumb,meta) VALUES (m.hash,NEW.board,NEW.thread,NEW.post,m.mediatype,m.nsfw,m.src,m.thumb,m.meta);
		END LOOP;
	END IF;
	IF (NEW.cites IS NOT NULL) THEN
		INSERT INTO cites (board,thread,post,targets) VALUES (NEW.board, NEW.thread, NEW.post, NEW.cites);
	END IF;
	RETURN NEW;
-- EXCEPTION WHEN OTHERS THEN --Revert post sequence if inserts fail then reraise the exception.
	-- PERFORM setval(concat_ws('_',NEW.board,'post','seq'),currval(concat_ws('_',NEW.board,'post','seq'))-1);
	-- RAISE;
END;$$ LANGUAGE plpgsql;

CREATE TRIGGER post 
	INSTEAD OF INSERT ON post 
	FOR EACH ROW 
	EXECUTE PROCEDURE post();

-------------------------------------------
-- Pre-new_post-insert check to validate board requirements for media
--
CREATE OR REPLACE FUNCTION check_media(_board VARCHAR(32), _thread INTEGER, _hashes JSONB) RETURNS VOID AS $$
DECLARE found_hash TEXT; b RECORD; i BIGINT;
BEGIN
	SELECT medialimit,mediauploadlimit,perthreadunique INTO b FROM boards WHERE board = _board;
	SELECT hash INTO found_hash FROM media WHERE board = _board AND ((b.perthreadunique IS TRUE AND thread = _thread) OR b.perthreadunique IS FALSE) AND _hashes ? hash LIMIT 1;
	SELECT COUNT(1) INTO i FROM media WHERE board = _board AND thread = _thread;
	IF (jsonb_array_length(_hashes) > 0 AND i + jsonb_array_length(_hashes) > b.medialimit) THEN 
		RAISE check_violation	--Validate thread image limit
			USING MESSAGE = 'New post failed.',
			DETAIL = 'Thread has reached the image limit.',
			CONSTRAINT = 'thread_image_limit_reached';
	ELSIF (jsonb_array_length(_hashes) > 0 AND found_hash) THEN	--Validate image uniqueness
		RAISE unique_violation
			USING MESSAGE = 'New post failed.',
			DETAIL = 'Duplicate image found.',
			HINT = found_hash,
			CONSTRAINT = 'duplicate_image_found';
	ELSIF (jsonb_array_length(_hashes) > 0 AND jsonb_array_length(_hashes) > b.mediauploadlimit) THEN
		RAISE check_violation
			USING MESSAGE = 'Media upload failed.',
			DETAIL = 'Uploaded image count exceeds allowed amount.',
			CONSTRAINT = 'image_upload_limit_reached';
	END IF;
END;$$ LANGUAGE plpgsql;

-------------------------------------------
-- Function for handling a ban user request.
--
CREATE OR REPLACE VIEW ban AS
	SELECT b.board, b.creator, b.reason, b.expires, _.notice, _.range, _.post
	FROM bans b, (VALUES (0,NULL::VARCHAR(128),0)) AS _(post,notice,range);
	
CREATE OR REPLACE FUNCTION ban() RETURNS TRIGGER AS $$
DECLARE
	ip INET;
	p RECORD;
	f SMALLINT := 1;
	g BOOLEAN;
	-- Might there be a better regex for URL hunting? (this is borrowed from infinity for the time being)
	r TEXT := '\b((?:https?://|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:".,<>?«»“”‘’]))';
BEGIN
	SET TIME ZONE 'UTC';
	IF (NEW.board IS NULL OR NEW.post IS NULL) THEN
		RAISE not_null_violation;
	END IF;
	IF (NEW.range IS NULL) THEN NEW.range := 32; END IF;
	IF (NEW.creator IS NULL) THEN NEW.creator := 0; END IF;
	IF (NOT EXISTS(SELECT * INTO p FROM posts WHERE board = NEW.board AND post = NEW.post LIMIT 1)) THEN
		RAISE case_not_found
			USING MESSAGE = 'Ban and Delete failed.',
			DETAIL = 'Post does not exist.',
			CONSTRAINT = 'post_not_found';
	END IF;
	SELECT global INTO g FROM boards WHERE board = NEW.board;
	IF (g) THEN
		IF (NEW.expires IS NULL OR NEW.expires > '1 year'::INTERVAL) THEN NEW.expires := '1 year'::INTERVAL; END IF;
	ELSE 
		IF (NEW.expires IS NULL OR NEW.expires > '3 months'::INTERVAL) THEN NEW.expires := '3 months'::INTERVAL; END IF;
	END IF;
	IF (family(p.ip) = 6) THEN f := 4; END IF;
	SELECT * INTO p FROM (
		VALUES (
			p.board, p.thread, p.post, p.posted, p.ip,
			regexp_replace(p.markup, r, '#Link-Expunged#', 'ixg')
		)
	) AS _(board,thread,post,posted,ip,markup);
	IF (NEW.expires <> '0') THEN -- Set mask length if not a warning
		ip := set_masklen(p.ip,NEW.range*f);
	ELSE ip := p.ip; END IF;
	INSERT INTO bans(ip,board,expires,author,reason,post)
		VALUES (ip,NEW.board,NEW.expires,NEW.creator,NEW.reason,to_json(p));
	IF (NEW.expires <> '0' AND NEW.notice IS NOT NULL) THEN
		UPDATE posts SET bantext = NEW.notice WHERE board = NEW.board AND post = NEW.post;
	END IF;
	RETURN NEW;
END;$$ LANGUAGE plpgsql;

CREATE TRIGGER ban
	INSTEAD OF INSERT ON ban
	FOR EACH ROW EXECUTE PROCEDURE ban();
	
-------------------------------------------
-- Function for masking user IPs (with optional hashing).
--
CREATE OR REPLACE FUNCTION mask_ip(_ip CIDR, _board VARCHAR(32)) RETURNS TEXT AS $$
DECLARE f SMALLINT := 1; r TEXT; l INT := 0;
BEGIN
	IF (family(_ip) = 6) THEN f := 4; END IF;
	r := host(set_masklen(_ip,16*f))::TEXT; -- Hide the back half of the IP
	IF (f = 4) THEN 
		l := length(r) - length(regexp_replace(r,':(?!:)','','g')) - (length(r) = 2)::INT;
		IF (l > 4) THEN l := 0; END IF;
		r := btrim(replace(r,'::',repeat(':0',4-l)) || ':x:x:x:x',':');
	ELSE 
		r := replace(r,'.0','.x');
	END IF;
	RETURN r;
END;$$ LANGUAGE plpgsql;

-------------------------------------------
-- Function for determining the page a thread is located on.
--
CREATE OR REPLACE FUNCTION fetch_page(_board VARCHAR(32), _thread INTEGER) RETURNS SMALLINT AS $$
DECLARE r RECORD;
BEGIN
	SELECT COUNT(1) FILTER (WHERE x.n % 10 = 0) OVER (ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) + 1 AS page INTO r FROM (
		SELECT t.op, COUNT(1) OVER (ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS n 
		FROM threads t WHERE t.board = _board AND t.archived IS NULL
		ORDER BY t.pinned DESC, t.sticky DESC, t.bumped DESC, t.op DESC
	) x WHERE x.op = _thread LIMIT 1;
	RETURN r.page::SMALLINT;
END;$$ LANGUAGE plpgsql;
