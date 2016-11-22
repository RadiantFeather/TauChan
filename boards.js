"use strict";
var fs = require('fs'),
	// request = require('request'),
	// socket = require('socekt.io'),
	deasync = require('deasync'),
	// cache = require('redis'),
	pgp = require('pg-promise')(GLOBAL.pgp),
	db = pgp(GLOBAL.cfg.database),
	handlers = {},
	_ = {},
	
	multer = require('multer'),
	pbody = multer({files:0}).single(),
	pfiles = multer({
		storage: multer.diskStorage({
			destination: (req, file, cb) => {
				GLOBAL.lib.mkdir('./cache/uploads');
				cb(null, 'cache/uploads/');
			},
			filename: (req, file, cb) => {
				cb(null, Date.now() + '.' + file.originalname);
			}
		})
		,files: 4
		,fileSize: GLOBAL.cfg.values.max_upload_size_in_kb*1024
	}).any();

/*
 *	GET request handlers
 */

_.index = function(req,res,next) { 	// board index
	db.any(GLOBAL.sql.view.board_index, {
		board: req.params.board,
		page: req.query.page ? parseInt(req.query.page) : 1,
	}).then((data)=>{
		let board = res.locals.board;
		res.locals.META.keywords = '/'+board.board+'/';
		res.locals.META.title = '/'+board.board+'/ - '+res.app.locals.SITE.name;
		res.locals.META.desc = '/'+board.board+'/ - '+board.title;
		res.locals.page = {type:'index',param:'index'};
		res.render('threads.jade',{data,curpage:parseInt(req.query.page||1)});
	}).catch((err)=>{
		return next(err.setstatus(500));
	});
};

_.archive = function(req,res,next) {	// archive view
	db.any(GLOBAL.sql.view.archive, {
		board: req.params.board,
		page: req.query.page ? parseInt(req.query.page) : 1,
	}).then((data)=>{
		let board = res.locals.board;
		res.locals.META.keywords = '/'+board.board+'/';
		res.locals.META.title = '/'+board.board+'/archive - '+res.app.locals.SITE.name;
		res.locals.META.desc = '/'+board.board+'/archive - '+board.title+': '+(board.subtitle||'');
		res.locals.page = {type:'archive',param:parseInt(req.params.page)};
		res.render('threads.jade',{data,curpage:parseInt(req.query.page||1)});
	}).catch((err)=>{
		return next(err.setstatus(500));
	});
};

_.thread = function(req,res,next) {	// thread view
	db.any(GLOBAL.sql.view.thread, {
		board: req.params.board,
		thread: parseInt(req.params.page),
		limit: req.query.preview ? parseInt(req.query.preview) : null,
	}).then((data)=>{
		res.locals.META.keywords = '/'+res.locals.board.board+'/';
		res.locals.META.desc = data[0].markdown.substring(128);
		res.locals.META.title = '/'+res.locals.board.board+'/ - '+(data[0].subject || data[0].markdown.substring(0,24));
		res.locals.page = {type:(data[0].archived===null?'thread':'archived_thread'),param:req.params.page};
		res.render('threads.jade',{data});
	}).catch((err)=>{
		return next(err.setstatus(500));
	});
};

_.catalog = function(req,res,next) {
	db.any(GLOBAL.sql.view.catalog, {
		board: req.params.board,
		limit: res.locals.board.threadlimit
	}).then((data)=>{
		console.log(data);
		res.locals.page = {type:'index',param:'catalog'};
		res.render('catalog.jade',{data}); 
	}).catch((err)=>{
		return next(err.setstatus(500));
	});
};

_.spoilerMedia = function(req,res,next) {
	if(!CSRF(req,res,next)) return;
	// TODO
	
};
_.spoilerMedia.auth = function(req,res,next){
	return res.locals.user.auth('post.spoiler_media');
};

_.deleteMedia = function(req,res,next) {
	if(!CSRF(req,res,next)) return;
	// TODO
	
};
_.deleteMedia.auth = function(req,res,next) {
	return res.locals.user.auth('post.delete_media');
};

_.ban = function(req,res,next) {
	res.send('Preset Page: '+ req.params.board +'/'+ req.params.page);
	return;
	res.cookie('curpage',req.cookies.lastpage,{httpOnly:true});
	if (!CSRF(req,res,next)) return;
	res.render('ban.jade',{ // TODO
		board:req.params.board,
		post:req.params.action
	});
};
_.ban.auth = function(req,res,next) {
	return res.locals.user.auth('thread.post_ban');
};

_.delete = function(req,res,next) {
	res.send('Preset Page: '+ req.params.board +'/'+ req.params.page);
	return;
	db.one(GLOBAL.sql.view.post)
};
_.delete.auth = function(req,res,next){
	return res.locals.user.auth('thread.post_delete');
};

_.bans = function(req,res,next) {
	res.send('Preset Page: '+ req.params.board +'/'+ req.params.page);
};

_.banned = function(req,res,next) {
	res.send('Preset Page: '+ req.params.board +'/'+ req.params.page);
	return;
	db.any(GLOBAL.sql.view.banned,{
		board: req.params.board,
		ip: req.ip
	}).then((data)=>{
		res.render('banned.jade',{data}); // TODO
	}).catch((err)=>{
		next(err.withlog('error'));
	});
};

_.history = function(req,res,next) {
	res.send('Preset Page: '+ req.params.board +'/'+ req.params.page);
};

_.logs = function(req,res,next) {
	res.send('Preset Page: '+ req.params.board +'/'+ req.params.page);
};

_.reports = function(req,res,next) {
	res.send('Preset Page: '+ req.params.board +'/'+ req.params.page);
};

_.pages = function(req,res,next) { // custom board pages
	if (req.params.page != 'pages'){
		db.one(GLOBAL.sql.view.page, req.params).then((data)=>{
			res.locals.page = {type:'custom',param:req.params.page};
			res.render('page.jade',{data});  // TODO
		}).catch((err)=>{
			return next(err.setstatus(404));
		});
	} else {
		db.any(GLOBAL.sql.view.pages,{board:req.params.board}).then((data)=>{
			res.locals.page = {type:'index',param:'custom'};
			res.render('pageList.jade',{data});	// TODO
		}).catch((err)=>{
			return next(err.setstatus(500).withlog('error'));
		});
	}
};

_.settings = function(req,res,next) {
	res.send('Preset Page: '+ req.params.board +'/'+ req.params.page);
};

handlers.GET = _;
_ = {};

/*
 *	POST request handlers
 */

_.index = _.catalog = function(req,res,next) { // New thread
	pfiles(req,res,(err)=>{
		res.locals.trackfiles = [];
		if (req.files) req.files.forEach((item)=>{res.locals.trackfiles.push(item.path);});
		console.log('trackable',res.locals.trackfiles);
		if (err) return next(err);
		if (req.files.reduce((a,b)=>{ return a+b.size;},0) > (GLOBAL.cfg.values.max_upload_size_in_kb * 1024))
			return next((new Error('Files size exceeds the maximum upload size limit.')).setstatus(413));
		let post = {};
		['name', 'trip', 'capcode', 'subject','email']
			.forEach((part)=>{ post[part] = part in req.body&&req.body[part].length?req.body[part]:null; });
		if (!res.locals.board.emailsubmit) post.email = null;
		['nsfw','sage','pinned','sticky','cycle','anchor','locked']
			.forEach((part)=>{ post[part] = part in req.body?!!req.body[part]:false})
		post.board = req.params.board;
		post.ip = req.ip;
		post.hash = GLOBAL.lib.maskIP(req.ip,req.params.board);
		if (post.name && post.name.indexOf('#') != -1){
			req.body.trip = post.name.substr(post.name.indexOf('#')+1);
			post.name = post.name.splice(0,post.name.indexOf('#'));
			if (!req.body.trip || (req.body.trip.indexOf('#') != -1 && req.body.trip.length < 2))
				req.body.trip = null;
			post.trip = GLOBAL.lib.processTrip(req.body.trip,res.locals.user.roles[req.params.board].capcodee);
			if (post.trip && post.trip.indexOf(' ## ') == 0) {
				post.capcode = post.trip;
				post.trip = null;
			}
		}
		post.cites = pgp.as.json((req.body.markdown.match(/(?:^| |\n)>>\d+(?:$| |\n)/g)||[]).forEach((item,i,arr)=>{
			arr[i] = [post.board,post.thread,item.trim().substr(2)].join('/');
		}));
		post.markdown = GLOBAL.lib.processMarkdown(req,res,next);
		post.markup = GLOBAL.lib.processMarkup(post.markdown);
		post.media = GLOBAL.lib.processPostMedia(res.locals.board,req.body,req.files,res.locals.trackfiles);
		if (post.media instanceof Error) return next(post.media);
		post.media = pgp.as.json(post.media);
		console.log(post.media);
		db.one(GLOBAL.sql.modify.new_thread,post).then((data)=>{
			res.redirect('/'+data.board+'/'+data.thread);
			GLOBAL.lib.log('info','New thread: /'+data.board+'/'+data.thread);
		}).catch((err)=>{
			return next(err.setstatus(500));
		});
	});
};

_.thread = function(req,res,next) { // New reply to thread
	pfiles(req,res,(err)=>{
		res.locals.trackfiles = [];
		if (req.files) req.files.forEach((item)=>{res.locals.trackfiles.push(item.path);});
		console.log('trackable',res.locals.trackfiles);
		if (err) return next(err);
		if (req.files.reduce((a,b)=>{ return a+b.size;},0) > (GLOBAL.cfg.values.max_upload_size_in_kb * 1024))
			return next(new Error('Files size exceeds the maximum upload size limit.'));
		let post = {};
		['name', 'trip', 'capcode', 'subject','email']
			.forEach((part)=>{ post[part] = part in req.body&&req.body[part].length?req.body[part]:null; });
		if (!res.locals.board.emailsubmit) post.email = null;
		post.board = req.params.board;
		post.thread = parseInt(req.params.page);
		post.ip = req.ip;
		post.hash = GLOBAL.lib.maskIP(req.ip,req.params.board);
		console.log(post.longhash);
		post.sage = !!req.body.sage;
		if (post.name && post.name.indexOf('#') != -1){
			req.body.trip = post.name.substr(post.name.indexOf('#')+1);
			post.name = post.name.splice(0,post.name.indexOf('#'));
			if (!req.body.trip || (req.body.trip.indexOf('#') != -1 && req.body.trip.length < 2))
				req.body.trip = null;
			post.trip = GLOBAL.lib.processTrip(req.body.trip,res.locals.user.roles[req.params.board].capcode);
			if (post.trip && post.trip.indexOf(' ## ') == 0) {
				post.capcode = post.trip;
				post.trip = null;
			}
		}
		post.markdown = req.body.markdown = GLOBAL.lib.processMarkdown(req,res,next);
		post.markup = GLOBAL.lib.processMarkup(req.body.markdown);
		post.media = GLOBAL.lib.processPostMedia(res.locals.board,req.body,req.files,res.locals.trackfiles);
		if (post.media instanceof Error) return next(post.media);
		post.media = pgp.as.json(post.media);
		console.log(post.media);
		post.cites = pgp.as.json((post.markdown.match(/(?:^| |\n)>>\d+(?:$| |\n)/g)||[]).forEach((item,i,arr)=>{
			arr[i] = [post.board,post.thread,item.trim().substr(2)].join('/');
		}));
		db.one(GLOBAL.sql.modify.new_reply,post).then((data)=>{
			res.redirect('/'+data.board+'/'+data.thread+'#'+data.post);
		}).catch((err)=>{
			return next(err.setstatus(500));
		});
	});
};

_.ban = function(req,res,next) {
	if (!CSRF(req,res,next)) return;
	pbody(req,res,(err)=>{
		if (err) return next(err);
		db.none(GLOBAL.sql.modify.ban,{
			board: req.params.board,
			post: req.params.action,
			user: res.locals.user.id,
			reason: req.body.reason,
			expires: req.body.expires,
			bantext: req.body.bantext,
			range: req.body.range
		}).then(()=>{
			res.redirect(req.cookies.lastpage);
		}).catch((err)=>{
			next(err.withlog('error'));
		});
	});
};
_.ban.auth = handlers.GET.ban.auth;

_.pages = function(req,res,next) { // Manage custom board pages
	if (!CSRF(req,res,next)) return;
	pbody(req,res,(err)=>{
		if (err) return next(err);
		let markup = GLOBAL.lib.processMarkup(req.body.markdown);
		
		db.none(GLOBAL.sql.modify.page,{
			title: req.body.title,
			
		}).then(()=>{
			
		}).catch((err)=>{
			next(err.withlog('error'));
		});
	});
};

_.settings = function(req,res,next) {
	
};

handlers.POST = _;

function CSRF(req,res,next) {
	res.cookie('curpage',req.cookies.lastpage,{httpOnly:true});
	if (!req.session.csrf){
		if (req.body.csrf||req.query.csrf) next((new Error('Unauthorized or invalid CSRF token.')).setstatus(403));
		let token = GLOBAL.lib.genCSRF(req.ip,req.path);
		req.session.csrf = token;
		if (req.xhr) res.json({success:true,data:{csrf:token}});
		else res.render('CSRF.jade',{url:req.path+'?csrf='+token});
		return false
	} else {
		if ((req.body.csrf||req.query.csrf) == req.session.csrf) return req.session.csrf = null,true;
		else next((new Error('Unauthorized or invalid CSRF token.')).setstatus(403));
	}
};

module.exports = handlers;
