-------------------------------------------
-- Encrypt and validate passwords with crypt-md5
--
CREATE OR REPLACE FUNCTION hash_password() RETURNS TRIGGER AS $$
DECLARE
	r BOOLEAN;
BEGIN
	IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.passphrase IS NOT NULL AND OLD.passphrase = crypt(NEW.passphrase, OLD.passphrase))) THEN
		NEW.passphrase := crypt(NEW.passphrase,gen_salt('crypt-md5'));
	END IF;
END;$$ LANGUAGE plpgsql;

CREATE TRIGGER hash_password
	BEFORE INSERT OR UPDATE ON users
	FOR EACH ROW
	EXECUTE PROCEDURE hash_password();
	
CREATE OR REPLACE FUNCTION fetch_user(_user VARCHAR(32), _pass VARCHAR(64)) RETURNS RECORD AS $$
DECLARE
	r RECORD;
BEGIN
	SELECT * INTO r FROM users WHERE username = _user AND (passphrase = crypt(_pass, passphrase));
	RETURN r;
END;$$ LANGUAGE plpgsql;

-------------------------------------------
-- Compiles post numbers that have cited the requested post into a JSON array
--
CREATE OR REPLACE FUNCTION fetch_cites(_board VARCHAR(32), _thread INTEGER, _post INTEGER) RETURNS JSON AS $$
DECLARE
	target RECORD; rv INTEGER[];
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
DECLARE
	target RECORD; rv TEXT[];
BEGIN
	FOR target IN SELECT loc FROM media WHERE board = _board AND post = _post ORDER BY sort ASC LOOP
		rv := rv || target.loc;
	END LOOP;
	RETURN array_to_json(rv);
END;$$ LANGUAGE plpgsql;

-------------------------------------------
-- Concats the cite values for proper indexing support
--
CREATE OR REPLACE FUNCTION clean_cites() RETURNS TRIGGER AS $$
DECLARE
	target RECORD; rv TEXT[];
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
DECLARE
	temp BIGINT;
BEGIN
	IF (TG_OP = 'INSERT') THEN
		EXECUTE format('CREATE SEQUENCE %I MINVALUE 1 OWNED BY boards.board',concat_ws('_',NEW.board,'post','seq'));
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
-- Proxy function that takes care of managing data for new posts.
-- 
CREATE OR REPLACE VIEW post AS 	
	SELECT _.*, p.*, t.pinned, t.sticky, t.anchor, t.cycle, t.locked, t.sage, t.nsfw 
	FROM posts p, threads t, (VALUES ('1'::JSON,'1'::JSONB)) AS _(media,cites);
	
CREATE OR REPLACE FUNCTION post() RETURNS TRIGGER AS $$
DECLARE
	b RECORD; m RECORD; h JSONB;
	i BIGINT;
BEGIN
	SELECT bumplimit,threadlimit,postlimit,noname INTO b FROM boards WHERE board = NEW.board;
	SELECT nextval(concat_ws('_',NEW.board,'post','seq')) INTO NEW.post;
	IF (NEW.thread IS NULL) THEN NEW.thread := NEW.post; END IF;
	IF (NEW.name = '') THEN NEW.name := NULL; END IF;
	IF (NEW.posted IS NULL) THEN NEW.posted := NOW(); END IF; --Set manually to update the recent post bump value for the board
	IF (NEW.media IS NOT NULL) THEN
		FOR m IN SELECT * FROM json_array_elements(NEW.media) LOOP
			h := h || m->hash;
		END LOOP;
		PERFORM check_media(NEW.board, NEW.thread, array_to_json(h)); -- Validate post media requirements
	END IF;
	
	SELECT COUNT(1) INTO i FROM posts WHERE board = NEW.board AND post <> thread AND capcode IS NULL;
	IF (NEW.capcode IS NULL AND i >= b.postlimit) THEN
		RAISE check_violation	--Validate thread reply limit
			USING MESSAGE = 'New post failed.',
			DETAIL = 'Thread has reached the reply limit.',
			CONSTRAINT = 'thread_reply_limit_reached';
	END IF;
	
	INSERT INTO posts(post, thread, board, posted, ip, name, trip, subject, email, capcode, markdown, markup) VALUES
		(NEW.post, NEW.thread, NEW.board, NEW.posted, NEW.ip, NEW.name, NEW.trip, NEW.subject, NEW.email, NEW.capcode, NEW.markdown, NEW.markup);
	
	IF (NEW.post = NEW.thread) THEN
		IF (NEW.pinned IS TRUE) THEN	--Only one pinned thread allowed per board and pinned thread must be a sticky
			UPDATE threads SET pinned = FALSE WHERE board = NEW.board AND pinned = TRUE;
			NEW.sticky = TRUE;
		END IF;
		INSERT INTO threads (op,board,bumped,pinned,sticky,anchor,cycle,locked,sage,nsfw) 
			VALUES (NEW.thread, NEW.board, NEW.posted, 
			coalesce(new.pinned,FALSE), coalesce(NEW.sticky,FALSE), 
			coalesce(NEW.anchor,FALSE), coalesce(NEW.cycle,FALSE), 
			coalesce(NEW.locked,FALSE), coalesce(NEW.sage,FALSE), 
			coalesce(NEW.nsfw,FALSE)
		);
	END IF;
	
	UPDATE threads SET archived = NOW() WHERE op IN ( --Archive threads that have fallen past the board thread limit
		SELECT op FROM threads
		WHERE board = NEW.board
		ORDER BY pinned DESC, sticky DESC, anchor DESC, bumped DESC, op DESC
		OFFSET b.threadlimit
	);
	
	SELECT COUNT(1) INTO i FROM posts WHERE board = NEW.board AND thread = NEW.thread AND post <> NEW.thread;
	IF (i <= b.bumplimit) THEN
		UPDATE boards SET bumped = NEW.posted WHERE board = NEW.board; --Update recent post bump for board
	END IF;
	IF (NEW.media IS NOT NULL) THEN
		FOR m IN SELECT * FROM json_to_recordset(NEW.media) AS _(hash TEXT, board VARCHAR(32), thread INTEGER, post INTEGER, nsfw BOOLEAN, loc TEXT) LOOP
			INSERT INTO media (hash,board,thread,post,nsfw,loc) VALUES (m.hash,m.board,m.thread,m.post,m.nsfw,m.loc);
		END LOOP;
	END IF;
	IF (NEW.cites IS NOT NULL) THEN
		INSERT INTO cites (board,thread,post,targets) VALUES (NEW.board, NEW.thread, NEW.post, NEW.cites);
	END IF;
	RETURN NEW;
--EXCEPTION WHEN OTHERS THEN --Revert post sequence if inserts fail then reraise the exception.
--	PERFORM setval(concat_ws('_',NEW.board,'post','seq'),currval(concat_ws('_',NEW.board,'post','seq'))-1);
--	RAISE;
END;$$ LANGUAGE plpgsql;

CREATE TRIGGER post 
	INSTEAD OF INSERT ON post 
	FOR EACH ROW 
	EXECUTE PROCEDURE post();

-------------------------------------------
-- Pre-new_post-insert check to validate board requirements for media
--
CREATE OR REPLACE FUNCTION check_media(_board VARCHAR(32), _thread INTEGER, _hashes JSONB) RETURNS VOID AS $$
DECLARE
	found_hash TEXT;
	b RECORD; i BIGINT;
BEGIN
	SELECT imglimit,perthreadunique INTO b FROM boards WHERE board = _board;
	SELECT hash INTO found_hash FROM media WHERE board = _board AND ((b.perthreadunique AND thread = _thread) OR TRUE) AND _hashes ? hash LIMIT 1;
	SELECT COUNT(1) INTO i FROM media WHERE board = _board AND thread = _thread;
	IF (jsonb_array_length(_hashes,1) > 0 AND i + jsonb_array_length(_hashes,1) > b.imglimit) THEN 
		RAISE check_violation	--Validate thread image limit
			USING MESSAGE = 'New post failed.',
			DETAIL = 'Thread has reached the image limit.',
			CONSTRAINT = 'thread_image_limit_reached';
	ELSIF (jsonb_array_length(_hashes,1) > 0 AND found_hash) THEN	--Validate image uniqueness
		RAISE unique_violation
			USING MESSAGE = 'New post failed.',
			DETAIL = 'Duplicate image found.',
			HINT = found_hash,
			CONSTRAINT = 'duplicate_image_found';
	END IF;
END;$$ LANGUAGE plpgsql;

-------------------------------------------
-- Function for handling a ban user request.
--
CREATE OR REPLACE VIEW ban AS
	SELECT b.board, b.creator, b.reason, b.expires, _.notice, _.range 
	FROM bans b, (VALUES (0,NULL::VARCHAR(128),0)) AS _(post,notice,range);
	
CREATE OR REPLACE FUNCTION ban() RETURNS TRIGGER AS $$
DECLARE
	p RECORD;
	f SMALLINT := 1;
	g BOOLEAN;
	-- Might there be a better regex for URL hunting? (this is borrowed from infinity for the time being)
	r TEXT := '\b((?:https?://|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:".,<>?«»“”‘’]))';
BEGIN
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
		IF (NEW.expires IS NULL OR NEW.expires > '1 year') THEN NEW.expires := '1 year'::INTERVAL; END IF;
	ELSE 
		IF (NEW.expires IS NULL OR NEW.expires > '3 months') THEN NEW.expires := '3 months'::INTERVAL; END IF;
	END IF;
	IF (family(p.ip) = 6) THEN f := 4; END IF;
	SELECT * INTO p FROM (
		VALUES (
			p.board, p.thread, p.post, p.posted, p.ip,
			regexp_replace(p.postbody, r, '#Link-Expunged#', 'ixg')
		)
	) AS _(board,thread,post,posted,ip,postbody);
	IF (NEW.expires <> '0') THEN -- Set mask length if not a warning
		p.ip := set_masklen(p.ip,NEW.range*f);
	END IF;
	INSERT INTO bans(ip,board,expires,author,reason,post)
		VALUES (p.ip,NEW.board,NEW.expires,NEW.creator,NEW.reason,to_json(p));
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
CREATE OR REPLACE FUNCTION mask_ip(_ip CIDR, _board VARCHAR(32) DEFAULT '_', _salt TEXT DEFAULT NULL) RETURNS TEXT AS $$
DECLARE
	f SMALLINT := 1;
	r TEXT; l INT := 0;
BEGIN
	IF (_salt IS NOT NULL) THEN
		r := substring(encode(digest(_salt||_ip||_board,'sha1'),'hex') from 1 for 16);
	ELSE
		IF (family(_ip) = 6) THEN f := 4; END IF;
		r := host(set_masklen(_ip,16*f))::TEXT; -- Hide the back half of the IP
		IF (f = 4) THEN 
			l := length(r) - length(regexp_replace(r,':(?!:)','','g')) - (length(r) = 2)::INT;
			IF (l > 4) THEN l := 0; END IF;
			r := btrim(replace(r,'::',repeat(':0',4-l)) || ':x:x:x:x',':');
		ELSE 
			r := replace(r,'.0','.x');
		END IF;
	END IF;
	RETURN r;
END;$$ LANGUAGE plpgsql;
