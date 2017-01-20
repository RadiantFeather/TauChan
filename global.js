"use strict";
var fs = require('fs'),
	multer = require('multer'),
	pbody = multer({files:0}).single(),
	// request = require('request'),
	// socket = require('socekt.io'),
	// cache = require('redis'),
	// tpl = require('jade'),
	crypto = require('crypto'), deasync = require('deasync'),
	yml = {read: require('read-yaml'), write: require('write-yaml')},
	pgp = require('pg-promise')(GLOBAL.pgp),
	db = pgp(GLOBAL.cfg.database),
	handlers = {},
	_ = {};

/*
 *	GET request handlers
 */

_.index = function(req,res,next){	// moderation front page aka underboard
	if (!res.locals.user.reg) return this.login(req,res,next);
	db.any(GLOBAL.sql.view.user_roles,{
		id: res.locals.user.id
	}).then((data)=>{
		res.locals.page = {type:'mod',param:'index'};
		res.render('underboard.jade',{data});
	}).catch((err)=>{
		next(err);
	});
};

_.login = function(req,res,next){
	console.log(req.cookies.lastpage,req.path);
	if (res.locals.user.reg) return res.redirect(req.cookies.lastpage!=req.path?req.cookies.lastpage:'/_');
	res.render('login.jade');
};

_.signup = function(req,res,next){
	console.log(req.cookies.lastpage,req.path);
	if (res.locals.user.reg) return res.redirect(req.cookies.lastpage!=req.path?req.cookies.lastpage:'/');
	res.render('signup.jade');
};

_.createBoard = function(req,res,next){
	if (!res.locals.user.reg) return res.redirect('/_/login');
	res.render('createBoard.jade');
};
_.createBoard.reg = true;
_.createBoard.auth = function(req,res,next){
	if (GLOBAL.cfg.options.disable_usermade_boards)
		if (!res.locals.user.global || !res.locals.user.auth('site.board_create',0))
			return 'Unauthorized to create a board.';
	else if (GLOBAL.cfg.options.require_valid_email)
		if (!res.locals.user.verified || !res.locals.user.auth('site.board_create',1))
			return 'Unauthorized to create a board.';
	return true;
};

_.bans = function(req,res,next){
	res.send('Preset Global Page: /_/'+ req.params.page);
	return;
	res.locals.page = {type:'mod',param:'bans'};
};

_.banned = function(req,res,next){
	res.send('Preset Global Page: /_/'+ req.params.page);
	return;
	res.locals.page = {type:'mod',param:'banned'};
};

_.logs = function(req,res,next){
	res.send('Preset Global Page: /_/'+ req.params.page);
	return;
	res.locals.page = {type:'mod',param:'logs'};
};

_.reports = function(req,res,next){
	res.send('Preset Global Page: /_/'+ req.params.page);
	return;
	res.locals.page = {type:'mod',param:'reports'};
};

handlers.GET = _;
_ = {};

/*
 *	POST request handlers
 */

_.login = function(req,res,next){
	pbody(req,res,(err)=>{
		if (err) return next(err);
		db.one(GLOBAL.sql.view.user,{
			user:req.body.username,
			pass:req.body.passphrase,
			board:'_'
		}).then(()=>{
			let token = crypto
				.createHash('sha1')
				.update(req.body.username)
				.update(req.ip)
				.update(GLOBAL.cfg.secret)
				.digest('hex');
			db.none(GLOBAL.sql.modify.user_token,{
				user:req.body.username,
				token:token
			}).then(()=>{
				let x = {httpOnly:true};
				if (req.body.rememberme) x.maxAge = 1000*60*60*24*7;
				else x.expires = 0;
				res.cookie('user',token,x);
				res.redirect(req.cookies.lastpage!=req.path?req.cookies.lastpage:'/');
			}).catch((err)=>{
				next(err);
			});
		}).catch((err)=>{
			next(err.withrender('login.jade').data(req.body));
		});
	});
};

_.signup = function(req,res,next){
	pbody(req,res,(err)=>{
		if (err) return next(err);
		if (req.body.passphrase != req.body.validate){
			err = new Error('Passphrase mismatch. Try again.');
			return next(err.withrender('signup.jade').data(req.body));
		}
		let token = crypto
			.createHash('sha1')
			.update(req.body.username)
			.update(req.ip)
			.update(GLOBAL.cfg.secret)
			.digest('hex');
		db.none(GLOBAL.sql.modify.new_user,{
			user:req.body.username,
			nick:req.body.screenname,
			pass:req.body.passphrase,
			email:req.body.email,
			token:token
		}).then(()=>{
			let x = {httpOnly:true};
			if (req.body.rememberme) x.maxAge = 1000*60*60*24*7;
			else x.expires = 0;
			res.cookie('user',token,x);
			res.cookie('curpage',req.cookies.lastpage,{httpOnly:true,expires:0});
			res.redirect('/_/login');
		}).catch((err)=>{
			next(err);
		});
	});
};

var createBoard_constraintErrors = {
	boards_pkey: 'Board name already exists.'
	,locked_preview_limit: 'Invalid value for locked thread preview limit. Must be between 0 and 10 inclusively.'
	,pinned_preview_limit: 'Invalid value for pinned thread preview limit. Must be between 0 and 10 inclusively.'
	,sticky_preview_limit: 'Invalid value for sticky thread preview limit. Must be between 0 and 10 inclusively.'
	,cycle_preview_limit: 'Invalid value for cycle thread preview limit. Must be between 0 and 10 inclusively.'
	,archived_preview_limit: 'Invalid value for archived thread preview limit. Must be between 0 and 10 inclusively.'
	,standard_preview_limit: 'Invalid value for standard thread preview limit. Must be between 0 and 10 inclusively.'
	,thread_limit: 'Invalid value for per thread count limit. Must be between 10 and 150 inclusively.'
	,bump_limit: 'Invalid value for per thread bump limit (autosage). Must be between 100 and 1000 inclusively.'
	,media_limit: 'Invalid value for per thread total media limit. Must be between 0 and 750 inclusively.'
	,post_limit: 'Invalid value for per thread post limit. Must be between 100 and 1000 inclusively.'
	,media_upload_limit: 'Invalid value for per post media upload limit. Must be between 0 and 4 inclusively.'
	,archived_lifespan: 'Invalid value for archived posts lifespan. Must be between 1 day and 7 days inclusively.'
};
_.createBoard = function(req,res,next){
	pbody(req,res,(err)=>{
		if (err) return next(err);
		req.body.board = req.body.board.replace(/(?:^\/|\/$)/g,'');
		req.body.tags = req.body.tags.replace(/(?:^,|,$)/g,'');
		if (!(/^[a-zA-Z0-9_]+$/.test(req.body.board)))
			err = new Error('Board name is empty or contains invalid characters.');
		else if (req.body.board.length > 32)
			err = new Error('Board name is too long. Must be 32 characters or less.');
		else if (req.body.title.length == 0)
			err = new Error('Board title is empty. Must provide a title for the board.')
		else if (req.body.tags.replace(/,/g,'').length > 0 && !(/^[a-zA-Z0-9_]+(?:,[a-zA-Z0-9_]+)*$/.test(req.body.tags)))
			err = new Error('A tag with invalid characters was submitted.');
		else if (req.body.tags.split(',').length > 8)
			err = new Error('Too many tags were submitted. Must have no more than 8 tags.');
		else if (req.body.title.length > 32)
			err = new Error('Board title is too long. Must be 32 characters or less.');
		else if (req.body.noname.length > 16)
			err = new Error('Default anonymous name is too long. Must be 16 characters or less.');
		else if (req.body.subtitle.length > 128)
			err = new Error('Board subtitle is too long. Must be 128 characters or less.');
		else if (req.body.ticker.length > 256)
			err = new Error('Board information header is too long. Must be 256 characters or less.');
		
		if (err) {
			return next(err.withrender('createBoard.jade').setdata(req.body));
		} else {
			// finish
			let t = {};
			['board','title','subtitle'].forEach((item)=>{
				t[item] = item in req.body && req.body[item].length? pgp.as.text(req.body[item]): 'NULL';
			});
			
			['noname','archivedlifespan'].forEach((item)=>{
				t[item] = item in req.body && req.body[item].length? pgp.as.text(req.body[item]): 'DEFAULT';
			});
			
			['mediauploadlimit','postlimit','medialimit','bumplimit','threadlimit','standardlimit',
			'archivedlimit','cyclelimit','stickylimit','pinnedlimit','lockedlimit'].forEach((item)=>{
				t[item] = item in req.body? pgp.as.number(parseInt(req.body[item])): 'DEFAULT';
			});
			
			['listed','nsfw','perthreadunique','archivethreads','emailsubmit',
			'publiclogs','publicbans','publicedits','loguser','postids'].forEach((item)=>{
				t[item] = pgp.as.bool(!!req.body[item]);
			});
			
			t.tags = pgp.as.json('tags' in req.body? req.body.tags.split(','): []);
			
			let i,k=[],v=[];
			for (i in t){
				k.push(i);
				v.push(t[i]);
			}
			db.none(GLOBAL.sql.modify.new_board,{
				keys:k.join(','),
				values:v.join(','),
				id:res.locals.user.id,
				board:t.board
			}).then((data)=>{
				res.redirect('/'+req.body.board+'/');
			}).catch((err)=>{
				if (err.constraint&&err.constraint in createBoard_constraintErrors){
					err = new Error(createBoard_constraintErrors[err.constraint]);
				}
				next(err.withrender('createBoard.jade').setdata(req.body));
				// TODO: recache the board list and data?
			});
		}
	});
};
_.createBoard.reg = true;
_.createBoard.auth = handlers.GET.createBoard.auth;

handlers.POST = _;

function CSRF(req,res,next) {
	res.cookie('curpage',req.cookies.lastpage,{httpOnly:true});
	if (!req.session.csrf){
		if (req.query.csrf) next((new Error('Unauthorized or invalid CSRF token.')).setstatus(403));
		let token = GLOBAL.lib.genCSRF(req.ip,req.path);
		req.session.csrf = token;
		if (req.xhr) res.json({success:true,data:{csrf:token}});
		else res.render('CSRF.jade',{url:req.path+'?csrf='+token});
		return false;
	} else {
		if (req.query.csrf == req.session.csrf) return req.session.csrf = null,true;
		else next((new Error('Unauthorized or invalid CSRF token.')).setstatus(403));
	}
}

function tagCloud(){
	let res = [], cloud = {}, out = [];
	let wait = true;
	console.log('pass 1.2');
	db.any('SELECT tags FROM boards;').then((data)=>{
		res = data;
		wait = false;
	}).catch((err)=>{
		console.log(err);
		wait = null;
	});
	while (wait) deasync.runLoopOnce();
	if (wait === null) console.log('Tag Stats');
	console.log('pass 1.5');
	let i = -1;
	while (++i < res.length){
		res[i].tags.forEach((item)=>{
			if (item in cloud) cloud[item] += 1;
			else cloud[item] = 1;
		});
	}
	for (i in cloud){
		out.push({tag:i,count:cloud[i]});
	}
	out.sort((a,b)=>{ return a.count < b.count? 1: a.count > b.count? -1: 0; });
	return out;
}

handlers.pages = function(req,res,next){
	db.one(GLOBAL.sql.view.page, {
		board: '_',
		page: req.params.file
	}).then((data)=>{
		res.locals.page = {type:'custom',param:req.params.page};
		res.render('page.jade',{data: data}); // TODO
	}).catch((err)=>{
		return next(err.setstatus(404).setloc('global page serve'));
	});
};

handlers.index = function(req,res,next){
	console.log('pass 1');
	let t = (req.query.tags||'').split(','),
		nsfw = ['NULL','TRUE','FALSE'].indexOf(req.query.nsfw)>=0? req.query.nsfw:'NULL',
		all=[],any=[],none=[],
		reall=/^ *\+[a-zA-Z0-9_]+ *$/,reany=/^ *[a-zA-Z0-9_]+ *$/,renone=/^ *\-[a-zA-Z0-9_]+ *$/;
	if (t.length&&t[0]!==''){
		t.forEach((b)=>{if(reall.test(b))all.push(b.trim().slice(1));});
		t.forEach((b)=>{if(renone.test(b))none.push(b.trim().slice(1));});
		t.forEach((b)=>{if(reany.test(b))any.push(b.trim());});
	}
	let tags = tagCloud(GLOBAL.cfg.values.tag_cloud_count||25);
	// redis cache check/fetch with alternate tags filter?
	console.log('pass 2');
	db.any(GLOBAL.sql.view.overboard, {
		page: parseInt(req.query.page||1),
		all: all.length?'tags ?& '+pgp.as.array(all)+'::TEXT[]':'TRUE',
		any: any.length?'tags ?| '+pgp.as.array(any)+'::TEXT[]':'TRUE',
		none: none.length?'NOT tags ?| '+pgp.as.array(none)+'::TEXT[]':'TRUE',
		nsfw: {'TRUE':'FALSE','FALSE':'TRUE','NULL':'NULL'}[nsfw]
	}).then((data)=>{
		console.log('pass 3');
		res.locals.page = {type:'index',param:'index'};
		res.render('overboard.jade',{
			data: data,
			nsfw: nsfw,
			tags: req.query.tags,
			taglist: tags.slice(0,25), // only suggest up to the 25 most used tags
			curpage: parseInt(req.query.page||1),
			totalboards: data&&data.length?parseInt(data[0].total):0,
			cloud: tags.slice(0,GLOBAL.cfg.values.tag_cloud_count||25) //array of {tag:string,count:integer}
		}); 
	}).catch((err)=>{
		return next(err);
	});
};

module.exports = handlers;