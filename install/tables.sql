CREATE TABLE IF NOT EXISTS boards (
	board VARCHAR(32) PRIMARY KEY,
	title VARCHAR(64) NOT NULL,
	listed BOOLEAN NOT NULL DEFAULT TRUE,
	nsfw BOOLEAN NOT NULL DEFAULT TRUE,
	created TIMESTAMP DEFAULT NOW(),
	bumped TIMESTAMP,
	global BOOLEAN DEFAULT FALSE,
	noname VARCHAR(16) DEFAULT 'Anonymous',
	lockedlimit SMALLINT DEFAULT 0 CONSTRAINT max_locked_preview_limit CHECK (lockedlimit <= 10),
	pinnedlimit SMALLINT DEFAULT 1 CONSTRAINT max_pinned_preview_limit CHECK (pinnedlimit <= 10),
	stickylimit SMALLINT DEFAULT 2 CONSTRAINT max_sticky_preview_limit CHECK (stickylimit <= 10),
	cyclelimit SMALLINT DEFAULT 3 CONSTRAINT max_cycle_preview_limit CHECK (cyclelimit <= 10),
	archivedlimit SMALLINT DEFAULT 3 CONSTRAINT max_archived_preview_limit CHECK (archivedlimit <= 10),
	standardlimit SMALLINT DEFAULT 5 CONSTRAINT max_preview_limit CHECK (standardlimit <= 10),
	threadlimit SMALLINT DEFAULT 50 CONSTRAINT max_thread_limit CHECK (threadlimit <= 150),
	bumplimit SMALLINT DEFAULT 150 CONSTRAINT max_bump_limit CHECK (bumplimit <= 500),
	imagelimit SMALLINT DEFAULT 250 CONSTRAINT max_image_limit CHECK (imagelimit <= 750),
	postlimit SMALLINT DEFAULT 300 CONSTRAINT max_post_limit CHECK (postlimit <= 1000),
	imageuploadlimit SMALLINT DEFAULT 1 CONSTRAINT max_image_upload_limit CHECK (imageuploadlimit <= 4),
	archivedlifespan INTERVAL DEFAULT '3 days' CONSTRAINT  max_archived_lifespan CHECK (archivedlifespan <= '7 days'::INTERVAL),
	perthreadunique BOOLEAN DEFAULT FALSE,
	archivethreads BOOLEAN DEFAULT TRUE,
	emailsubmit BOOLEAN DEFAULT TRUE,
	publicbans BOOLEAN DEFAULT FALSE,
	publiclogs BOOLEAN DEFAULT TRUE,
	publicedits BOOLEAN DEFAULT TRUE,
	loguser BOOLEAN DEFAULT TRUE,
	preticker VARCHAR(256),
	postticker TEXT,
	tags JSONB
);
CREATE INDEX board_tags ON boards USING GIN(tags);
/*
SELECT x.*
	FROM (
		SELECT b.*, CURRVAL(CONCAT_WS('_', b.board, 'post', 'seq')) AS post_count,
		(SELECT COUNT(1) FROM recent_posts WHERE board = b.board) AS posts_per_hour, 
		(SELECT COUNT(DISTINCT ip) FROM recent_posts WHERE board = b.board) AS active_users
		FROM boards b
		WHERE listed = TRUE
		AND tags ?& ?::TEXT[] //REQUIRED tags
		AND tags ?| ?::TEXT[] //OPTIONAL tags
		AND NOT tags ?| ?::TEXT[] //IGNORE tags
	) x
	ORDER BY x.active_users DESC, x.posts_per_hour DESC, x.post_count DESC
	LIMIT 50 OFFSET (50 * ?) + 50;
	--Board View (unverified) CALLWITH (search.tags.all, search.tags.any, search.tags.none, search.page)
*/

CREATE TABLE IF NOT EXISTS posts (
	post INTEGER,
	thread INTEGER,
	board VARCHAR(32) NOT NULL REFERENCES boards (board) ON DELETE CASCADE ON UPDATE CASCADE,
	posted TIMESTAMP NOT NULL DEFAULT NOW(),
	ip INET NOT NULL DEFAULT '::',
	edited TIMESTAMP,
	name VARCHAR(32),
	trip VARCHAR(16),
	subject VARCHAR(128),
	email VARCHAR(64),
	capcode VARCHAR(64),
	banned VARCHAR(128),
	markdown VARCHAR (2048) NOT NULL,
	markup TEXT,
	PRIMARY KEY (board, post),
	FOREIGN KEY (board, thread) REFERENCES posts (board, post) 
		ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX post_boards ON posts (board);
CREATE INDEX post_ips ON posts USING GIST (ip);
CREATE INDEX post_threads ON posts (thread);
CREATE INDEX post_times ON posts (posted);
CREATE VIEW recent_posts AS SELECT * FROM posts 
	WHERE posted >= NOW() - '1 hour'::INTERVAL OFFSET 0; -- Yes this works
/*
WITH _ AS (SELECT * FROM (VALUES (?::TEXT,?::INET,?::INT,?::INT)) AS _(board,ip,limit,page))
SELECT p.* FROM posts p, _
	WHERE board = _.board AND ip = _.ip
	ORDER BY posted DESC
	LIMIT _.limit OFFSET _.page * _.limit + _.limit;
	--Post History View (unverified) CALLWITH (board.id, user.ip, search.limit, search.page)
	
WITH _ AS (SELECT * FROM (VALUES (?,?,?)) AS _(board,limit,page))
SELECT p.* FROM posts p, _
	WHERE p.board = _.board ORDER BY posted DESC
	LIMIT _.limit OFFSET _.limit * _.page + _.limit;
	--Recent Posts View (unverified) CALLWITH (board.id, search.limit, search.page)
	
SELECT x.* 
	FROM (
		SELECT p.*, t.pinned, t.sticky, t.anchor, t.cycle, t.locked, t.bumped, t.sage, 
			(p.post = t.op) AS is_op, cl.local AS local_clean, cl.global AS global_clean, 
			fetch_cites(p.board,p.thread,p.post) AS targets, c.targets AS cites, 
			fetch_media(p.board,p.post) AS media
		FROM posts p, threads t , clean cl, cites c,
		WHERE p.board = ? AND t.board = p.board AND p.thread = ? AND t.op = p.thread
			AND cl.board = p.board AND cl.post = p.post AND c.board = p.board AND c.post = p.post
		ORDER BY (p.post = t.op) DESC, p.posted DESC;
		LIMIT ? + 1
	) x
	ORDER BY x.is_op DESC, x.posted ASC;
	--Thread view (verified) CALLWITH (board.id, thread.id, search.replylimit)
	
WITH _ AS (SELECT board, stickylimit, cyclelimit, lockedlimit, standardlimit, ?::INTEGER AS page FROM boards WHERE board = ?)
SELECT x.*
	FROM (
		--Fetch Raw Data
		SELECT ROW_NUMBER() OVER (PARTITION BY p.thread ORDER BY (p.post = t.op) DESC, p.post ASC) AS m, --Enumerate the correct post order per thread
			COUNT(1) FILTER (WHERE p.post = t.op) OVER (ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS n, --Enumerate the threads
			p.*, t.pinned, t.sticky, t.anchor, t.cycle, t.locked, t.bumped, t.sage, t.nsfw, c.targets AS cites,
			cl.local AS local_clean, cl.global AS global_clean, (p.post = t.op) AS is_op,
			fetch_cites(p.board,p.thread,p.post) AS targets, fetch_media(p.board,p.post) AS media
		FROM posts p, threads t, cites c, clean cl, _
		WHERE p.board = _.board AND t.board = p.board AND p.thread = t.op 
			AND c.board = p.board AND c.post = p.post AND t.archived IS NULL
			AND cl.board = p.board AND cl.post = p.post
		ORDER BY t.pinned DESC, t.sticky DESC, t.bumped DESC, p.thread DESC, (p.post = t.op) DESC, p.post ASC --Proper sorting
	) x, _
	WHERE (
		(x.pinned AND x.m <= _.pinnedlimit + 1) --Filter threads for preview limit values
		OR (x.sticky AND x.m <= _.stickylimit + 1) 
		OR (x.cycle AND x.m <= _.cyclelimit + 1)
		OR (x.locked AND x.m <= _.lockedlimit + 1)
		OR x.m <= _.standardlimit + 1
		) AND x.n > (_.page * 10) AND x.n <= (_.page * 10) + 10; --LIMIT + OFFSET filter proxy
	--Index View (unverified) CALLWITH (search.page, board.id)
	
WITH _ AS (SELECT board, archivedlimit, archivedlifespan, ? AS page FROM boards WHERE board = ?)
SELECT x.*
	FROM (
		--Fetch Raw Data
		SELECT ROW_NUMBER() OVER (PARTITION BY p.thread ORDER BY (p.post = t.op) DESC, p.post DESC) AS m, --Enumerate the correct post order per thread
			COUNT(1) FILTER (WHERE p.post = t.op) OVER (ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS n, --Enumerate the threads
			p.*, t.archived, t.bumped, (p.post = t.op) AS is_op, FETCH_media(p.board,p.post) as media
		FROM posts p, threads t, _
		WHERE p.board = _.board AND p.thread = t.op AND t.archived < NOW() - _.archivedlifespan
		ORDER BY t.archived DESC, t.bumped DESC, p.thread DESC, (p.post = t.op) DESC, p.post ASC --Proper sorting
	) x, _
	WHERE (x.m <= _.archivedlimit + 1) --Filterd threads for archived preview limit
	AND x.n > (_.page * 10) AND x.n <= (_.page * 10) + 10; --LIMIT + OFFSET filter proxy
	--Archive View (unverified) CALLWITH (search.page, board.id)
	
UPDATE posts SET archived = NOW()
	WHERE thread IN (
		WITH _ AS (SELECT board, threadlimit FROM boards WHERE board = ?)
		SELECT t.op FROM threads t, _
		WHERE t.board = _.board
		ORDER BY t.sticky DESC, t.anchor DESC, t.bumped DESC, t.op DESC
		OFFSET _.threadlimit
	);
	--Vaccuum threads (needs reverified) CALLWITH (board.id)
	
DELETE FROM posts
	WHERE thread IN (
		WITH _ AS (SELECT board, archivedlimit, perpagelimit FROM boards WHERE b.board = ?)
		SELECT t.op FROM threads t, _
		WHERE t.board = _.board AND t.archived IS NOT NULL AND t.archived < NOW() - _.archivedlifespan
	)
	RETURNING *;
	--Vaccuum archive (unverified) CALLWITH (board.id)
*/

CREATE TABLE IF NOT EXISTS threads (
	op INTEGER,
	board VARCHAR(32) NOT NULL,
	bumped TIMESTAMP NOT NULL,
	pinned BOOLEAN DEFAULT FALSE, --Topmost thread, only one per board, must be stickied
	sticky BOOLEAN DEFAULT FALSE, --Keeps thread at the top, required for pinning a thread
	anchor BOOLEAN DEFAULT FALSE, --Prevents thread from falling off the board
	cycle BOOLEAN DEFAULT FALSE, --Limits thread post_count, overwrites oldest posts
	locked BOOLEAN DEFAULT FALSE, --Restricts posting in thread to authorized users only
	sage BOOLEAN DEFAULT FALSE, --Prevents thread from being bumped to the top
	nsfw BOOLEAN DEFAULT FALSE, --Auto spoiler all images in the thread, ignored on NSFW boards
	archived TIMESTAMP, --Marked as fallen off the board into archive state
	PRIMARY KEY (board, op),
	FOREIGN KEY (board, op) REFERENCES posts (board, post) 
		ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX catalog_sort ON threads (board, pinned, sticky, cycle, bumped);
/*
WITH _ AS (SELECT board, threadlimit FROM boards WHERE board = ?)
SELECT t.*, (SELECT COUNT(1) FROM posts p WHERE p.board = t.board AND p.thread = t.op AND p.post <> t.op) AS replies,
	(SELECT COUNT(1) FROM media m WHERE m.board = t.board AND m.thread = t.op) AS images,
	COUNT(1) FILTER (WHERE x.n % 10 = 0) OVER (ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS page --Enumerate the pages
	FROM (
		SELECT *,COUNT(1) OVER (ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) - 1 AS n --Enumerate the threads
		FROM threads t, _ WHERE t.board = _.board AND t.archived IS NULL
		ORDER BY pinned DESC, sticky DESC, bumped DESC
		LIMIT _.threadlimit
	) t;
	--Catalog view (needs reverified) CALLWITH (board.id)
*/

CREATE TABLE IF NOT EXISTS cites (
	board VARCHAR(32) NOT NULL,
	thread INTEGER NOT NULL,
	post INTEGER NOT NULL,
	targets JSONB,
	PRIMARY KEY (board, post),
	FOREIGN KEY (board, post) REFERENCES posts (board, post) 
		ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX cite_targets ON cites USING GIN (targets);

CREATE TABLE IF NOT EXISTS media (
	hash TEXT,
	loc TEXT NOT NULL,
	thumb TEXT NOT NULL,
	board VARCHAR(32),
	thread INTEGER NOT NULL,
	post INTEGER NOT NULL,
	mediatype CHAR(3) NOT NULL,
	nsfw BOOLEAN NOT NULL DEFAULT FALSE,
	uploadname TEXT,
	sort SMALLINT,
	FOREIGN KEY (board, post) REFERENCES posts (board, post) 
		ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX media_hash ON media (hash);

CREATE TABLE IF NOT EXISTS users (
	id SERIAL PRIMARY KEY,
	username VARCHAR(32) NOT NULL UNIQUE,
	passphrase VARCHAR(64) NOT NULL,
	email TEXT UNIQUE,
	validated BOOLEAN NOT NULL DEFAULT FALSE,
	global BOOLEAN NOT NULL DEFAULT FALSE,
	token TEXT UNIQUE
);

INSERT INTO users VALUES (0,'SYSTEM','','',TRUE); --Passphrase-less user for system driven database operations that require a user

CREATE TABLE IF NOT EXISTS flags (
	role VARCHAR(16) NOT NULL,
	board VARCHAR(32) NOT NULL REFERENCES boards (board) ON DELETE CASCADE ON UPDATE CASCADE,
	flags JSONB NOT NULL DEFAULT '{}',
	PRIMARY KEY (role, board)
);

CREATE TABLE IF NOT EXISTS roles (
	id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
	board VARCHAR(32) NOT NULL,
	role VARCHAR(16) NOT NULL,
	FOREIGN KEY (board,role) REFERENCES flags (board,role) ON DELETE CASCADE ON UPDATE CASCADE,
	UNIQUE (id, board)
);
/*
SELECT users.*,roles.role FROM users,roles WHERE roles.user = users.id AND roles.board = ?
*/

CREATE TABLE IF NOT EXISTS bans (
	ip INET NOT NULL DEFAULT '::',
	board VARCHAR(32) NOT NULL DEFAULT '_',
	created TIMESTAMP NOT NULL DEFAULT NOW(),
	expires INTERVAL NOT NULL CHECK (expires >= '0'),
	creator INTEGER NOT NULL DEFAULT 0 REFERENCES users (id) ON DELETE SET DEFAULT,
	reason TEXT NOT NULL DEFAULT 'No Reason Given',
	seen BOOLEAN NOT NULL DEFAULT FALSE,
	post JSON,
	PRIMARY KEY (ip, board),
	FOREIGN KEY (board) REFERENCES boards (board) ON DELETE CASCADE ON UPDATE CASCADE,
	CONSTRAINT ip_is_banned EXCLUDE USING GIST (ip WITH &&) WHERE (board = board OR board = '_') --Reject bans that are already contained by a range ban (including global bans)
);
CREATE INDEX ON bans USING GIST (ip);

CREATE TABLE IF NOT EXISTS appeals (
	ip INET NOT NULL DEFAULT '::',
	board VARCHAR(32) NOT NULL DEFAULT '_',
	ban INET NOT NULL DEFAULT '::',
	created TIMESTAMP NOT NULL DEFAULT NOW(),
	approved TIMESTAMP,
	approval INTEGER DEFAULT 0 REFERENCES users (id) ON DELETE SET DEFAULT,
	reason TEXT,
	FOREIGN KEY (board,ban) REFERENCES bans (board,ip)
		ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX ON appeals USING GIST (ip);
/*
SELECT b.created,b.expires,b.reason,b.post,(b.ip >> a.ip) AS ranged
	FROM bans b, appeals a
	WHERE (a.board = ? OR a.board = '_') AND b.board = a.board
		AND a.ip = ? AND b.ip >>= a.ip
		AND a.approved IS NOT NULL;
	--Ban Check (unverified) CALLWITH (board.id, user.ip)

SELECT b.ip,b.board,b.created,b.reason,b.post,a.created AS appealed,a.approved
	(b.created + b.expires - NOW()) AS expires,(b.ip >> a.ip) AS ranged
	FROM bans b, appeals a
	WHERE (a.board = ? OR a.board = '_') AND b.board = a.board 
		AND a.ip = ? AND b.ip >>= a.ip
	ORDER BY b.board ASC;
	--Ban View (unverified) CALLWITH (board.id, user.ip)
*/

CREATE TABLE IF NOT EXISTS reports (
	ip INET NOT NULL DEFAULT '::',
	board VARCHAR(32) NOT NULL DEFAULT '_',
	created TIMESTAMP NOT NULL DEFAULT NOW(),
	post INTEGER NOT NULL,
	dismissed BOOLEAN DEFAULT FALSE,
	reason VARCHAR(128) NOT NULL DEFAULT 'Unspecified Reason.',
	FOREIGN KEY (board, post) REFERENCES posts (board, post) 
		ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX report_ips ON reports USING GIST (ip);
/*
SELECT r.post, r.created, r.reason, to_json(p) AS content,
	FROM posts p, reports r
	WHERE p.board = ? AND p.board = r.board AND p.post = r.post
		AND r.dismissed IS FALSE
	ORDER BY p.post ASC, r.created ASC;
	--Reports View (unverified) CALLWITH (board.id)
*/

CREATE TABLE IF NOT EXISTS logs (
	board VARCHAR(32) NOT NULL DEFAULT '_',
	username VARCHAR(32) NOT NULL,
	created TIMESTAMP NOT NULL DEFAULT NOW(),
	level LOGLEVEL NOT NULL,
	details TEXT
);
CREATE INDEX log_levels ON logs (board, level);
/*
SELECT *
	FROM (
		SELECT * FROM logs
		WHERE board = ? AND level = ?
		ORDER BY created DESC
		LIMIT 100 OFFSET ? * 100
	) x
	ORDER BY created ASC;
	-Mod Logs View (unverified) CALLWITH (board.id, search.level, search.page)
*/

CREATE TABLE IF NOT EXISTS news (
	board VARCHAR(32) NOT NULL DEFAULT '_',
	username VARCHAR(32) NOT NULL,
	created TIMESTAMP NOT NULL DEFAULT NOW(),
	edited TIMESTAMP,
	title VARCHAR(64),
	markdown VARCHAR(2048),
	markup TEXT
);


CREATE TABLE IF NOT EXISTS clean (
	board VARCHAR(32) NOT NULL,
	post INTEGER NOT NULL,
	local INTEGER DEFAULT 0 REFERENCES users (id) ON DELETE SET DEFAULT,
	localstamp TIMESTAMP,
	global INTEGER DEFAULT 0 REFERENCES users (id) ON DELETE SET DEFAULT,
	globalstamp TIMESTAMP,
	PRIMARY KEY (board,post),
	FOREIGN KEY (board,post) REFERENCES posts (board,post) 
		ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS pages (
	board VARCHAR(32) NOT NULL REFERENCES boards (board) ON DELETE CASCADE,
	page VARCHAR(16) NOT NULL,
	title VARCHAR(32),
	markdown VARCHAR(2048),
	markup TEXT,
	PRIMARY KEY (board, page)
);

