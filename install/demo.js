"use strict";
console.log('Loading Demo Setup...');


//*/

const Config = require('../config');
const Lib = require('../lib');
const Gen = require('./gen');

/*/

import Config from '../config';
import Lib from '../Lib';
import Gen from './gen';

//*/

const db = Config.db;
const pgp = Config.pgp;
const yml = Config.yml;
const sql = file=> pgp.QueryFile(file,{debug:true,minify:true});
const Chance = new Gen(Config.cfg.secret);

	
require('../extend');
	
(async ()=>{
	const cfg = yml.read.sync(__dirname+'/demo.yml');
	
	var opts = {};
	opts.max_posts_per_board = parseInt(process.argv[3]||cfg.max_posts_per_board||250,10);
	opts.min_posts_per_board = parseInt(process.argv[4]||cfg.min_posts_per_board||50,10);
	opts.num_of_boards = parseInt(process.argv[2]||cfg.num_of_boards||500,10);
	opts.posted_max = Chance.natural({min:172800,max:259200}); // between 48 and 72 hours
	
	function kv(obj){
		let out = {k:[],v:[]};
		for (var x in obj){
			out.k.push(x);
			out.v.push(obj[x]);
		}
		return out;
	}
	
	await db.none(sql(__dirname+'/demosetup.sql'));
	console.log('Cleaning up database...');
	await db.none('VACUUM FULL ANALYZE;');
	console.log('Done!');
	
	var boards = cfg.boards;
	var genboards = [];
	var tags = cfg.tags;
	var posts = cfg.posts;
	var users = [];
	var threads = {};
	
	for (let i=-1,x; ++i < posts.length;){
		posts[i].markup = Lib.processMarkup(posts[i].markdown);
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
		// console.log(posts[i]);
		// console.log('-----------');
	}
	
	
	function genboard(){
		//board, title, listed, nsfw, tags
		let out = {},reset=false,tries=0;
		let l = Chance.natural({min:1,max:8});
		let t = genboards.map((item)=>{return item.board;});
		do {
			if (tries > 100) reset = true;
			if (reset){
				l = l%8+1;
				tries = 0;
				reset = false;
			}
			out.board = Chance.word({length:l});
			tries++;
		} while (t.contains(out.board));
		out.title = Chance.n(Chance.word,Chance.natural({min:1,max:4}),{length:Chance.natural({min:4,max:7})}).join(' ');
		out.listed = Chance.bool({likelihood:75});
		out.nsfw = Chance.bool();
		out.tags = gentags();
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
			} while (out.contains(x));
			out.push(x);
		}
		tags.concat(out);
		return out;
	}
	
	function genuser(){
		let out = {};
		out.ip = Chance.bool()?Chance.ip():Chance.ipv6();
		out.hash = Lib.maskData(out.ip);
		if (Chance.bool({likelihood:90})){ //anonymous
			if (Chance.bool({likelihood:30})) out.sage = true;
		} else { //registered
			out.name = Chance.name();
			if (Chance.bool()) {
				out.subject = Chance.genNounPhrase({words:Chance.natural({max:10})});
				out.subject = out.subject.slice(0,out.subject.lastIndexOf(' ',128));
			}
			if (Chance.bool({likelihood:10})) 
				out.trip = Lib.processTrip(
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
		board = board?board:Chance.pickone(boards);
		out.board = board.board;
		let tries = 0;
		if (threads[out.board].ops.length && Chance.bool({likelihood:90}))
			do {
				tries++;
				out.thread = Chance.pickone(threads[out.board].ops);
			} while(threads[out.board].replies[out.thread.toString()].length > board.postlimit);
		out.markdown = Chance.genParagraph({sentences:Chance.natural({min:2,max:10})});
		out.markdown = out.markdown.slice(0,out.markdown.lastIndexOf('.',2048)+1);
		out.markup = Lib.processMarkup(out.markdown);
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
		b.tags = pgp.as.json(b.tags);
		if (!threads[b.board]) threads[b.board] = {posts:[],ops:[],replies:{}};
		m = kv(b);
		SQL = 'INSERT INTO boards ('+m.k.join(',')+') '+
			'VALUES ('+Array(m.v.length).fill('').map((item,i)=>{
				let o = '$'+(i+1);
				if (m.k[i] == 'tags') o+='^';
				return o;
			}).join(',')+') RETURNING *,archivedlifespan::TEXT AS archivedlifespan;';
		try{
			let data = await db.one(SQL,m.v);
			genboards.push(data);
		} catch(e){
			if (e.constraint == 'boards_pkey') 
				console.log(genboards);
			console.log(e);
			pgp.end();
			console.log('Setup failed. Exiting.');
			return;
		}
		if (i) process.stdout.write("\n");
		m = posts.filter((item)=>{return item.board == b.board});
		let postnum = Chance.natural({min:opts.min_posts_per_board,max:opts.max_posts_per_board});
		console.log('Setting up posts for board \''+b.board+'\' (#'+(i+1)+') with '+postnum+' posts');
		for (let j=-1,y,n,p;++j < postnum;){
			//let waitTill = new Date(new Date().getTime() + 120); // speed limit the post insertion
			process.stdout.write("\rPost #"+(j+1));
			if (j < m.length) p = posts[j];
			else p = genpost(b);
			if (j>0) {
				y -= Chance.natural({max:y/(opts.max_posts_per_board-j)});
			} else y = opts.posted_max;
			let time = "(NOW() - '"+y+" seconds'::INTERVAL)";
			n = kv(p);
			SQL = 'INSERT INTO post ('+n.k.join(',')+',posted) '+
				'VALUES ('+Array(n.v.length).fill('').map((item,i)=>{return '$'+(i+1);}).join(',')+','+time+') '+
				'RETURNING board,post,thread;';
			try {
				let data = await db.one(SQL,n.v);
				threads[data.board].posts.push(data.post);
				if (data.post == data.thread) {
					threads[data.board].ops.push(data.thread);
					threads[data.board].replies[data.thread.toString()] = 0;
				} else {
					threads[data.board].replies[data.thread.toString()]++;
				}
			} catch(e){
				process.stdout.write("\n");
				console.log(e);
				pgp.end();
				console.log('Setup failed. Exiting.');
				console.log(threads[b.board].replies);
				console.log('Failed on '+b.board+' with thread '+p.thread);
				return;
			}
			if (j+1 == opts.postnum) process.stdout.write("\n");
			//while(waitTill > new Date()){}
		}
		process.stdout.write("\n");
	}
	
	pgp.end();
	console.log('Demo setup is complete.');
	return;
})().catch(err=>{console.log(err);pgp.end();});