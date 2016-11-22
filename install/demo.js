"use strict";
console.log('Loading Demo Setup...');
var pgp = require('pg-promise')({promiseLib: require('bluebird'), capSQL:true}),
	yml = {read: require('read-yaml'), write: require('write-yaml')},
	deasync = require('deasync'), crypto = require('crypto'),
	cfg = yml.read.sync('./conf/config.yml'), process = require('process'),
	sql = (file) => pgp.QueryFile(file,{debug: true, minify: false}),
	db = pgp(cfg.database);
	
	
GLOBAL.cfg = cfg;
var lib = require('../lib');
var Chance = require('./chance.js')(cfg.secret);
var cfg = yml.read.sync('./install/demo.yml');

var opts = {};
opts.max_posts_per_board = cfg.max_posts_per_board;
opts.num_of_boards = parseInt(process.argv[2])||cfg.num_of_boards;
opts.posted_max = Chance.natural({min:172800,max:259200}); // between 48 and 72 hours

function kv(obj,keys){
	let out = {k:[],v:[]};
	for (var x in obj){
		out.k.push(x);
		out.v.push(obj[x]);
	}
	return out;
}

var wait = true;
db.none(sql('./install/demosetup.sql')).then(()=>{
	console.log('Cleaning up database...');
	db.none('VACUUM FULL ANALYZE;').then(()=>{
		wait = false;
	}).catch((err)=>{
		console.log(err);
		wait = null;
	});
}).catch((err)=>{
	console.log(err);
	wait = null;
});
while (wait) deasync.runLoopOnce();
if (wait === null) return pgp.end(),console.log('Setup failed. Exiting.');
wait = true;

var boards = cfg.boards;
var genboards = [];
var tags = cfg.tags;
var posts = cfg.posts;
var users = [];
var threads = {};

for (let i=-1,x,j,k; ++i < posts.length;){
	posts[i].markup = lib.processMarkup(posts[i].markdown);
	if (users.length == 0 || Chance.bool({likelihood:75})) x = genuser();
	else x = Chance.pickone(users);
	posts[i].ip = x.ip;
	posts[i].hash = x.hash;
	if ('sage' in x) posts[i].sage = x.sage;
	if ('trip' in x) posts[i].trip = x.trip;
	if ('capcode' in x) posts[i].capcode = x.capcode;
	if ('name' in x) posts[i].name = x.name;
	if ('subject' in x) posts[i].subject = x.subject;
	if ('email' in x) posts[i].email = x.email;
	console.log(posts[i]);
	console.log('-----------');
}
// console.log(posts);


function genboard(){
	//board, title, listed, nsfw, tags
	let out = {};
	let t = genboards.map((item)=>{return item.board;});
	let l = Chance.natural({min:1,max:8});
	do{
	out.board = Chance.word({length:l});
	} while (t.indexOf(out.board) >=0);
	out.title = Chance.n(Chance.word,Chance.natural({min:1,max:4}),{length:Chance.natural({min:4,max:7})}).join(' ');
	out.listed = Chance.bool({likelihood:75});
	out.nsfw = Chance.bool();
	out.tags = gentags();
	out.postlimit = opts.max_posts_per_board;
	return out;
}

function gentags(){
	let y = Chance.natural({min:2,max:5}),out = [];
	while (y-->0){
		let s = Chance.bool({likelihood:100-tags.length-out.length});
		let x,l = Chance.natural({min:2,max:3});
		do {
			if (s) x = Chance.word({syllables:l});
			else x = Chance.pickone(tags);
		} while (out.indexOf(x) >=0);
		out.push(x);
	}
	tags.concat(out);
	return out;
}

function genuser(){
	let out = {};
	out.ip = Chance.bool()?Chance.ip():Chance.ipv6();
	out.hash = lib.maskIP(out.ip);
	if (Chance.bool({likelihood:90})){ //anonymous
		if (Chance.bool({likelihood:30})) out.sage = true;
	} else { //registered
		out.name = Chance.name();
		if (Chance.bool()) out.subject = Chance.sentence({punctuation:false,words:Chance.natural({max:10})});
		if (Chance.bool({likelihood:10})) 
			out.trip = lib.processTrip(
				(Chance.bool({likelihood:30})?'##':'#')+
				Chance.string({length:Chance.natural({min:5,max:10})})
			);
		else if (Chance.bool({likelihood:1})) out.capcode = ' ## '+Chance.word();
	}
	if (Chance.bool({likelihood:25})) out.email = Chance.email();
	users.push(out);
	return out;
}

function genpost(board){
	let out = {};
	out.board = board?board:Chance.pickone(boards).board;
	if (threads[out.board].ops.length && Chance.bool({likelihood:75}))
		out.thread = Chance.pickone(threads[out.board].ops);
	out.markdown = Chance.paragraph({sentences:Chance.natural({min:2,max:10})}).slice(0,2048);
	out.markup = lib.processMarkup(out.markdown);
	let x;
	if (users.length == 0 || Chance.bool({likelihood:25})) x = genuser();
	else x = Chance.pickone(users);	
	out.ip = x.ip;
	out.hash = x.hash;
	if ('sage' in x) out.sage = x.sage;
	if ('trip' in x) out.trip = x.trip;
	if ('capcode' in x) out.capcode = x.capcode;
	if ('name' in x) out.name = x.name;
	if ('subject' in x) out.subject = x.subject;
	if ('email' in x) out.email = x.email;
	return out;
}


console.log('Setting up the demo...');

console.log('Setting up custom and generated boards and posts...');

for (let i=-1,b,m,SQL;++i < opts.num_of_boards;) {
	if (i < boards.length) b = boards[i];
	else b = genboard();
	genboards.push(b);
	b.tags = pgp.as.json(b.tags);
	if (!threads[b.board]) threads[b.board] = {posts:[],ops:[]};
	m = kv(b);
	SQL = 'INSERT INTO boards ('+m.k.join(',')+') '+
		'VALUES ('+Array(m.v.length).fill('').map((item,i)=>{
			let o = '$'+(i+1);
			if (m.k[i] == 'tags') o+='^';
			return o;
		}).join(',')+');';
	db.none(SQL,m.v).then(()=>{
		wait = false;
	}).catch((e)=>{
		if (e.constraint == 'boards_pkey') 
			console.log(genboards);
		console.log(e);
		wait = null;
	});
	while (wait) deasync.runLoopOnce();
	if (wait === null) return pgp.end(),console.log('Setup failed. Exiting.');
	wait = true;
	if (i) process.stdout.write("\n");
	console.log('Setting up posts for board \''+b.board+'\' (#'+(i+1)+')');
	m = posts.filter((item)=>{return item.board == b.board});
	let postnum = Chance.natural({min:5,max:opts.max_posts_per_board});
	for (let j=-1,d,y,n,p;++j < postnum;){
		process.stdout.write("\rPost #"+(j+1));
		if (j < m.length) p = posts[j];
		else p = genpost(b.board);
		if (j>0) {
			y -= Chance.natural({max:y/(opts.max_posts_per_board-j)});
		} else y = opts.posted_max;
		let time = "(NOW() - '"+y+" seconds'::INTERVAL)";
		n = kv(p);
		SQL = 'INSERT INTO post ('+n.k.join(',')+',posted) '+
			'VALUES ('+Array(n.v.length).fill('').map((item,i)=>{return '$'+(i+1);}).join(',')+','+time+') '+
			'RETURNING board,post,thread;';
		db.one(SQL,n.v).then((data)=>{
			threads[data.board].posts.push(data.post);
			if (data.post == data.thread)
				threads[data.board].ops.push(data.thread);
			wait = false;
		}).catch((e)=>{
			process.stdout.write("\n");
			console.log(e);
			wait = null;
		});
		while (wait) deasync.runLoopOnce();
		if (wait === null) return pgp.end(),console.log('Setup failed. Exiting.');
		wait = true;
		if (j+1 == opts.postnum) process.stdout.write("\n");
	}
	process.stdout.write("\n");
}


return pgp.end(), console.log('Demo setup is complete.');
