SET TIME ZONE 'UTC';
CREATE TABLE IF NOT EXISTS boards (
	board VARCHAR(32) PRIMARY KEY,
	title VARCHAR(32) NOT NULL,
	subtitle VARCHAR(128),
	created TIMESTAMP DEFAULT NOW(),
	bumped TIMESTAMP,
	global BOOLEAN DEFAULT FALSE,
	noname VARCHAR(16) DEFAULT 'Anonymous',
	lockedlimit SMALLINT DEFAULT 0 CONSTRAINT locked_preview_limit CHECK (0 <= lockedlimit AND lockedlimit <= 10),
	pinnedlimit SMALLINT DEFAULT 1 CONSTRAINT pinned_preview_limit CHECK (0 <= pinnedlimit AND pinnedlimit <= 10),
	stickylimit SMALLINT DEFAULT 2 CONSTRAINT sticky_preview_limit CHECK (0 <= stickylimit AND stickylimit <= 10),
	cyclelimit SMALLINT DEFAULT 3 CONSTRAINT cycle_preview_limit CHECK (0 <= cyclelimit AND cyclelimit <= 10),
	archivedlimit SMALLINT DEFAULT 3 CONSTRAINT archived_preview_limit CHECK (0 <= archivedlimit AND archivedlimit <= 10),
	standardlimit SMALLINT DEFAULT 5 CONSTRAINT standard_preview_limit CHECK (0 <= standardlimit AND standardlimit <= 10),
	threadlimit SMALLINT DEFAULT 50 CONSTRAINT thread_limit CHECK (10 <= threadlimit AND threadlimit <= 150),
	bumplimit SMALLINT DEFAULT 150 CONSTRAINT bump_limit CHECK (100 <= bumplimit AND bumplimit <= 500),
	medialimit SMALLINT DEFAULT 250 CONSTRAINT media_limit CHECK (0 <= medialimit AND medialimit <= 750),
	postlimit SMALLINT DEFAULT 300 CONSTRAINT post_limit CHECK (100 <= postlimit AND postlimit <= 1000),
	mediauploadlimit SMALLINT DEFAULT 1 CONSTRAINT media_upload_limit CHECK (0 <= mediauploadlimit AND mediauploadlimit <= 4),
	archivedlifespan INTERVAL DEFAULT '3 days' CONSTRAINT  archived_lifespan_limit CHECK ('1 day'::INTERVAL <= archivedlifespan AND archivedlifespan <= '7 days'::INTERVAL),
	listed BOOLEAN NOT NULL DEFAULT TRUE,
	nsfw BOOLEAN NOT NULL DEFAULT TRUE,
	perthreadunique BOOLEAN DEFAULT FALSE,
	archivethreads BOOLEAN DEFAULT TRUE,
	postids BOOLEAN DEFAULT TRUE,
	emailsubmit BOOLEAN DEFAULT TRUE,
	publicbans BOOLEAN DEFAULT FALSE,
	publiclogs BOOLEAN DEFAULT TRUE,
	publicedits BOOLEAN DEFAULT TRUE,
	loguser BOOLEAN DEFAULT TRUE,
	ticker VARCHAR(256),
	tickermarkup TEXT,
	tags JSONB
);
CREATE INDEX board_tags ON boards USING GIN(tags);

CREATE TABLE IF NOT EXISTS posts (
	post INTEGER,
	thread INTEGER,
	board VARCHAR(32) NOT NULL REFERENCES boards (board) ON DELETE CASCADE ON UPDATE CASCADE,
	posted TIMESTAMP NOT NULL DEFAULT NOW(),
	ip INET NOT NULL,
	hash TEXT NOT NULL,
	edited TIMESTAMP,
	name VARCHAR(32),
	trip VARCHAR(16),
	subject VARCHAR(128),
	email VARCHAR(64),
	capcode VARCHAR(32),
	banned VARCHAR(128),
	markdown VARCHAR(2048) NOT NULL,
	markup TEXT,
	PRIMARY KEY (board, post),
	FOREIGN KEY (board, thread) REFERENCES posts (board, post) 
		ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX post_boards ON posts (board);
CREATE INDEX post_ips ON posts USING GIST (ip inet_ops);
CREATE INDEX post_threads ON posts (thread);
CREATE INDEX post_times ON posts (posted);
CREATE VIEW recent_posts AS SELECT * FROM posts 
	WHERE posted >= NOW() - '1 hour'::INTERVAL OFFSET 0; -- Yes this works

CREATE TABLE IF NOT EXISTS threads (
	op INTEGER,
	board VARCHAR(32) NOT NULL,
	bumped TIMESTAMP NOT NULL,
	pinned BOOLEAN DEFAULT FALSE, --Topmost thread, only one per board, must be stickied
	sticky BOOLEAN DEFAULT FALSE, --Keeps thread at the top, required for pinning a thread
	anchor BOOLEAN DEFAULT FALSE, --Prevents thread from falling off the board
	cycle BOOLEAN DEFAULT FALSE, --Overwrites oldest posts allowing continued bumping 
	locked BOOLEAN DEFAULT FALSE, --Restricts posting in thread to authorized users only
	sage BOOLEAN DEFAULT FALSE, --Prevents thread from being bumped to the top
	nsfw BOOLEAN DEFAULT FALSE, --Auto spoiler all images in the thread, ignored on NSFW boards
	archived TIMESTAMP, --Marked as fallen off the board into archive state
	featured BOOLEAN DEFAULT FALSE, --Marked as an immortal thread (can still be reported on)
	PRIMARY KEY (board, op),
	FOREIGN KEY (board, op) REFERENCES posts (board, post) 
		ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX catalog_sort ON threads (board, pinned, sticky, cycle, bumped);

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
	src TEXT NOT NULL,
	thumb TEXT NOT NULL,
	board VARCHAR(32),
	thread INTEGER NOT NULL,
	post INTEGER NOT NULL,
	mediatype CHAR(3) NOT NULL,
	nsfw BOOLEAN NOT NULL DEFAULT FALSE,
	deleted BOOLEAN DEFAULT FALSE,
	processed BOOLEAN DEFAULT FALSE,
	meta JSON,
	sort SMALLINT,
	FOREIGN KEY (board, post) REFERENCES posts (board, post) 
		ON DELETE CASCADE ON UPDATE CASCADE,
	UNIQUE (sort,board,post)
);
CREATE INDEX media_hash ON media (hash);

CREATE TABLE IF NOT EXISTS users (
	id SERIAL PRIMARY KEY,
	username VARCHAR(32) UNIQUE,
	screenname VARCHAR(32),
	passphrase VARCHAR(64) NOT NULL,
	email TEXT UNIQUE,
	verified BOOLEAN NOT NULL DEFAULT FALSE,
	global BOOLEAN NOT NULL DEFAULT FALSE,
	token TEXT UNIQUE
);

INSERT INTO users VALUES (0,'#system#','SYSTEM','','',TRUE,TRUE,NULL); --Passphrase-less user for system driven database operations that require a user

CREATE TABLE IF NOT EXISTS roles (
	role VARCHAR(16) NOT NULL,
	board VARCHAR(32) NOT NULL REFERENCES boards (board) 
		ON DELETE CASCADE ON UPDATE CASCADE,
	flags JSONB NOT NULL DEFAULT '{}',
	capcode TEXT NOT NULL,
	PRIMARY KEY (role, board)
);

CREATE TABLE IF NOT EXISTS assign (
	id INTEGER NOT NULL REFERENCES users (id) 
		ON DELETE CASCADE,
	board VARCHAR(32) NOT NULL REFERENCES boards (board) 
		ON DELETE CASCADE ON UPDATE CASCADE,
	role VARCHAR(16) NOT NULL,
	FOREIGN KEY (board,role) REFERENCES roles (board,role) 
		ON DELETE CASCADE ON UPDATE CASCADE,
	UNIQUE (id, board)
);

CREATE TABLE IF NOT EXISTS bans (
	ip INET NOT NULL,
	board VARCHAR(32) NOT NULL DEFAULT '_' REFERENCES boards (board) 
		ON DELETE CASCADE ON UPDATE CASCADE,
	created TIMESTAMP NOT NULL DEFAULT NOW(),
	expires INTERVAL NOT NULL CHECK (expires >= '0'),
	creator INTEGER NOT NULL DEFAULT 0 REFERENCES users (id) 
		ON DELETE SET DEFAULT,
	reason VARCHAR(128) NOT NULL DEFAULT 'No Reason Given',
	seen BOOLEAN NOT NULL DEFAULT FALSE,
	post JSON,
	PRIMARY KEY (ip, board),
	CONSTRAINT ip_is_range_banned EXCLUDE USING GIST (ip inet_ops WITH &&) WHERE (board = board OR board = '_') 
	/* ^ Reject bans that are already contained by a range ban (including global bans) */
);
CREATE INDEX ON bans USING GIST (ip inet_ops);

CREATE TABLE IF NOT EXISTS appeals (
	ip INET NOT NULL DEFAULT '::',
	board VARCHAR(32) NOT NULL DEFAULT '_',
	ban INET NOT NULL DEFAULT '::',
	created TIMESTAMP NOT NULL DEFAULT NOW(),
	approved TIMESTAMP,
	approval INTEGER DEFAULT 0 REFERENCES users (id) 
		ON DELETE SET DEFAULT,
	reason TEXT,
	FOREIGN KEY (board,ban) REFERENCES bans (board,ip)
		ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX ON appeals USING GIST (ip inet_ops);
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
	ORDER BY (b.board = '_'), b.board ASC;
	--Ban View (unverified) CALLWITH (board.id, user.ip)
*/

CREATE TABLE IF NOT EXISTS reports (
	ip INET NOT NULL DEFAULT '::',
	board VARCHAR(32) NOT NULL DEFAULT '_' REFERENCES boards (board) 
		ON DELETE CASCADE ON UPDATE CASCADE,
	created TIMESTAMP NOT NULL DEFAULT NOW(),
	post INTEGER NOT NULL,
	dismissed TIMESTAMP,
	reason VARCHAR(128) NOT NULL DEFAULT 'No reason given.',
	FOREIGN KEY (board, post) REFERENCES posts (board, post) 
		ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX report_ips ON reports USING GIST (ip inet_ops);
/*
SELECT r.post, r.created, r.reason, to_json(p) AS content,
	FROM posts p, reports r
	WHERE p.board = ? AND p.board = r.board AND p.post = r.post
		AND r.dismissed IS NULL
	ORDER BY r.post ASC, r.created ASC;
	--Reports View (unverified) CALLWITH (board.id)
*/

CREATE TABLE IF NOT EXISTS logs (
	board VARCHAR(32) NOT NULL DEFAULT '_' REFERENCES boards (board) 
		ON DELETE CASCADE ON UPDATE CASCADE,
	username VARCHAR(32),
	created TIMESTAMP NOT NULL DEFAULT NOW(),
	level LOGLEVEL NOT NULL,
	details TEXT
);
CREATE INDEX log_levels ON logs (board, level);
/*
SELECT *
	FROM (
		SELECT * FROM logs
		WHERE board = ? AND level <= ?
		ORDER BY created DESC
		LIMIT 100 OFFSET ? * 100
	) x
	ORDER BY created ASC;
	-Mod Logs View (unverified) CALLWITH (board.id, search.level, search.page)
*/

CREATE TABLE IF NOT EXISTS news (
	board VARCHAR(32) NOT NULL DEFAULT '_' REFERENCES boards (board)
		ON DELETE CASCADE ON UPDATE CASCADE,
	username VARCHAR(32) NOT NULL,
	created TIMESTAMP NOT NULL DEFAULT NOW(),
	edited TIMESTAMP,
	title VARCHAR(64),
	markdown VARCHAR(4096),
	markup TEXT
);

CREATE TABLE IF NOT EXISTS clean (
	board VARCHAR(32) NOT NULL REFERENCES boards (board) 
		ON DELETE CASCADE ON UPDATE CASCADE,
	post INTEGER NOT NULL,
	local INTEGER DEFAULT 0 REFERENCES users (id) 
		ON DELETE SET DEFAULT,
	localstamp TIMESTAMP,
	global INTEGER DEFAULT 0 REFERENCES users (id) 
		ON DELETE SET DEFAULT,
	globalstamp TIMESTAMP,
	PRIMARY KEY (board,post),
	FOREIGN KEY (board,post) REFERENCES posts (board,post) 
		ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS pages (
	board VARCHAR(32) NOT NULL REFERENCES boards (board) 
		ON DELETE CASCADE ON UPDATE CASCADE,
	page VARCHAR(16) NOT NULL,
	title VARCHAR(32),
	markdown VARCHAR(4096),
	markup TEXT,
	PRIMARY KEY (board, page)
);

