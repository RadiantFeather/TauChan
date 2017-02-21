"use strict";
var fs = require('fs'),
	// request = require('request'),
	// socket = require('socekt.io'),
	deasync = require('deasync'),
	// cache = require('redis'),
	db = GLOBAL.db, pgp = GLOBAL.pgp,
	noop = ()=>{},
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
	}).any(),reservedPages;

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
		page: parseInt(req.query.page||1),
	}).then((data)=>{
		let board = res.locals.board;
		res.locals.META.keywords = '/'+board.board+'/';
		res.locals.META.title = '/'+board.board+'/archive - '+res.app.locals.SITE.name;
		res.locals.META.desc = '/'+board.board+'/archive - '+board.title+': '+(board.subtitle||'');
		res.locals.page = {type:'archive',param:'index'};
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
		data.forEach((x,i,a)=>{a[i].longhash = GLOBAL.lib.maskIP(x.ip);});
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
	res.render('bnd.jade',{ // TODO
		mode:'b',
		board:req.params.board,
		post:parseInt(req.params.action)
	});
};
_.ban.auth = function(req,res,next) {
	return res.locals.user.auth('thread.post_ban');
};

_.delete = function(req,res,next) {
	res.send('Preset Page: '+ req.params.board +'/'+ req.params.page);
	return;
	db.one(GLOBAL.sql.view.post,{
		board:req.params.board,
		post:parseInt(req.params.action)
	}).then((data)=>{
		res.render('bnd.jade',{mode:'d',data});
	}).catch((e)=>{
		
	});
};
_.delete.auth = function(req,res,next){
	return res.locals.user.auth('thread.post_delete');
};

_.bnd = function(req,res,next) {
	res.send('Preset Page: '+ req.params.board +'/'+ req.params.page);
	return;
	db.one(GLOBAL.sql.view.post,{
		board:req.params.board,
		post:parseInt(req.params.action)
	}).then((data)=>{
		res.render('bnd.jade',{mode:'d',data});
	}).catch((e)=>{
		
	});
};
_.bnd.auth = function(req,res,next){
	return res.locals.user.auth(['thread.post.ban','thread.post.delete']);
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

_.report = function(req,res,next) {
	res.send('Preset Page: '+ req.params.board +'/'+ req.params.page);
};

_.reports = function(req,res,next) {
	res.send('Preset Page: '+ req.params.board +'/'+ req.params.page);
};

_.pages = function(req,res,next) { // custom board pages
	if (req.params.page != 'pages'){
		db.one(GLOBAL.sql.view.page, req.params).then((data)=>{
			res.locals.page = {type:'custom',param:req.params.page};
			res.render('pages.jade',{data});  // TODO
		}).catch((err)=>{
			return next(err.setstatus(404));
		});
	} else {
		db.any(GLOBAL.sql.view.pages,{board:req.params.board}).then((data)=>{
			res.locals.page = {type:'index',param:'custom'};
			res.render('pages.jade',{data});	// TODO
		}).catch((err)=>{
			return next(err.setstatus(500).withlog('error'));
		});
	}
};

_.editPage = function(req,res,next){
	
};

_.deletePage = function(req,res,next){
	
};

_.settings = function(req,res,next) {
	db.one(GLOBAL.sql.view.board_settings,{board:req.params.board})
	.then((data)=>{
		res.locals.editmode = true;
		res.locals.page = {type:'mod',param:'settings'};
		console.log(data.archivedlifespan.valueOf());
		res.render('editBoard.jade',{
			data,
			info_auth: !res.locals.user.auth('board.settings.info'),
			limit_auth: !res.locals.user.auth('board.settings.limits'),
			flag_auth: !res.locals.user.auth('board.settings.flags'),
			header_auth: !res.locals.user.auth('board.settings.header'),
			lifespan_auth: !res.locals.user.auth('board.settings.archive_lifespan')
		});
	}).catch((err)=>{
		next(GLOBAL.lib.mkerr('settings',err).setstatus(500));
	});
};
_.settings.auth = function(req,res,next){
	return res.locals.user.auth('board.settings!any');
};

_.roles = function(req,res,next){
	if (req.params.action && req.params.action == 'edit'){
		switch(req.params.action){
			case 'new': break;
			case 'edit':
				if (!req.params.data) return next(new Error("Must specify a role to edit"));
		
				db.one(GLOBAL.sql.view.role,{
					board: req.params.board,
					role: req.params.data
				}).then((data)=>{
					
				}).catch((err)=>{
					next(GLOBAL.lib.mkerr('roles',err));
				});
		}
		
		
	} else {
		db.any(GLOBAL.sql.view.roles,{
			board:req.params.board
		}).then((data)=>{
			let out = {};
			data.forEach((item)=>{
				if (item.role in out) out[item.role].push(item);
				else (out[item.role] = []).push(item);
			})
			res.locals.page = {type:'index',param:'roles'};
			res.render('roles.jade',{data});
		}).catch((err)=>{
			next(err);
		});
	}
};

handlers.GET = _;
reservedPages = Object.keys(_).push('media');
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
			.forEach((part)=>{ 
				if (!(part in GLOBAL.flags) || res.locals.user.auth('thread.'+part))
					post[part] = part in req.body?!!req.body[part]:false;
			});
		post.board = req.params.board;
		post.ip = req.ip;
		post.hash = GLOBAL.lib.maskIP(req.ip,req.params.board);
		if (post.name && post.name.indexOf('#') != -1){
			req.body.trip = post.name.substr(post.name.indexOf('#')+1);
			post.name = post.name.slice(0,post.name.indexOf('#'));
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
			// GLOBAL.lib.log('info','New thread: /'+data.board+'/'+data.thread);
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
			post.name = post.name.slice(0,post.name.indexOf('#'));
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
			res.redirect('/'+data.board+'/'+data.thread+'#_'+data.post);
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
	pbody(req,res,(err)=>{
		console.log(req.params);
		if (err) return next(err);
		req.body.tags = req.body.tags.replace(/(?:^,|,$)/g,'');
		res.locals.editmode = true;
		if (req.body.title.length == 0)
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
			return next(err.withrender('editBoard.jade').setdata(req.body));
		} else {
			// finish
			let t = {};
			if(res.locals.user.auth('board.settings.info'))
				['title','subtitle','noname'].forEach((item)=>{
						if(item in req.body && req.body[item].length) t[item] = pgp.as.text(req.body[item]);
				});
			if(res.locals.user.auth('board.settings.archive_lifespan'))
				['archivedlifespan'].forEach((item)=>{
						if(item in req.body && req.body[item].length) t[item] = pgp.as.text(req.body[item]);
				});
			if (res.locals.user.auth('board.settings.limits'))
				['mediauploadlimit','postlimit','medialimit','bumplimit','threadlimit','standardlimit',
				'archivedlimit','cyclelimit','stickylimit','pinnedlimit','lockedlimit'].forEach((item)=>{
					if (item in req.body) t[item] = pgp.as.number(parseInt(req.body[item]));
				});
			if(res.locals.user.auth('board.settings.flags'))
				['listed','nsfw','perthreadunique','archivethreads','emailsubmit','publiclogs',
				'publicbans','publicedits','loguser','postids'].forEach((item)=>{
					t[item] = pgp.as.bool(!!req.body[item]);
				});
			
			if (res.locals.user.auth('board.settings.info'))
				t.tags = pgp.as.json('tags' in req.body? req.body.tags.split(','): []);
			if (res.locals.user.auth('board.settings.header')) {
				t.ticker = pgp.as.text('ticker' in req.body? req.body.ticker: '');
				if (t.ticker) t.tickermarkup = pgp.as.text(GLOBAL.lib.processTicker(t.ticker));
			}
			
			let i,k=[],v=[];
			for (i in t){
				k.push(i);
				v.push(t[i]);
			}
			db.none(GLOBAL.sql.modify.old_board,{
				keys:k.join(','),
				values:v.join(','),
				board:req.params.board
			}).then(()=>{
				res.redirect('/'+req.params.board+'/');
			}).catch((err)=>{
				if (err.constraint&&err.constraint in GLOBAL.errors.editBoard_constraints){
					err.message = GLOBAL.errors.editBoard_constraints[err.constraint];
				}
				next(err.withrender('editBoard.jade').setdata(req.body));
				// TODO: recache the board list and data?
			});
		}
	});
};
_.settings.auth = handlers.GET.settings.auth;

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
