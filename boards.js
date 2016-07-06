"use strict";
var fs = require('fs'),
	// request = require('request'),
	// socket = require('socekt.io'),
	deasync = require('deasync'),
	// cache = require('redis'),
	pgp = require('pg-promise')({ promiseLib: require('bluebird') }),
	db = pgp(GLOBAL.cfg.database),
	handlers = {},
	_ = {},
	
	multer = require('multer'),
	parseUpload = multer({
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
	});

/*
 *	GET request handlers
 */

_.index = function(req,res,next) { 	// board index
	db.any(GLOBAL.sql.view.board_index, {
		board: req.params.board,
		page: req.query.page ? parseInt(req.query.page) : 0,
		salt: GLOBAL.cfg.site.secret
	}).then((data)=>{
		res.render('threads.jade',{
			board: res.locals.board,
			user: res.locals.user,
			data: data,
			cdn: res.locals.cdn,
			sitename: GLOBAL.cfg.site.name,
			page: {type:'index',param:'index'}
		});
		// res.send(data);
	}).catch((err)=>{
		res.status(500);
		return next(err);
	});
};

_.archive = function(req,res,next) {	// archive view
	db.any(GLOBAL.sql.view.archive, {
		board: req.params.board,
		page: req.query.page ? parseInt(req.query.page) : 0,
		salt: GLOBAL.cfg.site.secret
	}).then((data)=>{
		res.render('threads.jade',{
			board: res.locals.board,
			user: res.locals.user,
			data: data,
			cdn: res.locals.cdn,
			sitename: GLOBAL.cfg.site.name,
			page: {type:'index',param:'archive'}
		});
	}).catch((err)=>{
		res.status(500);
		return next(err);
	});
};

_.thread = function(req,res,next) {	// thread view
	db.any(GLOBAL.sql.view.thread, {
		board: req.params.board,
		thread: parseInt(req.params.page),
		limit: req.query.preview ? parseInt(req.query.preview) : null,
		salt: GLOBAL.cfg.site.secret
	}).then((data)=>{
		res.render('threads.jade',{
			board: res.locals.board,
			user: res.locals.user,
			data: data,
			cdn: res.locals.cdn,
			title: data[0].markdown.substring(0,24),
			sitename: GLOBAL.cfg.site.name,
			page: {type:(data[0].archived===null?'thread':'archive'),param:req.params.page}
		});
	}).catch((err)=>{
		res.status(404);
		return next(err);
	});
};

_.catalog = function(req,res,next) {
	db.any(GLOBAL.sql.view.catalog, {
		board: req.params.board,
		limit: res.locals.board.threadlimit
	}).then((data)=>{
		console.log(data);
		res.render('catalog.jade',{
			board: res.locals.board,
			user: res.locals.user,
			data: data,
			cdn: res.locals.cdn,
			title: data[0].markdown.substring(0,24),
			sitename: GLOBAL.cfg.site.name,
			page: {type:'catalog',param:'catalog'}
		}); 
	}).catch((err)=>{
		res.status(500);
		return next(err);
	});
};

_.pages = function(req,res,next) { // custom board pages
	db.one(GLOBAL.sql.view.custom, req.params).then((data)=>{
		res.render('custom.jade',{
			board: res.locals.board,
			user: res.locals.user,
			data: data,
			cdn: res.locals.cdn,
			page: {type:'custom',param:req.params.page}
		});
	}).catch((err)=>{
		res.status(404);
		return next(err);
	});
};

_.bans = function(req,res,next) {
	res.send('Preset Page: '+ req.params.board +'/'+ req.params.page);
};

_.banned = function(req,res,next) {
	res.send('Preset Page: '+ req.params.board +'/'+ req.params.page);
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

_.settings = function(req,res,next) {
	res.send('Preset Page: '+ req.params.board +'/'+ req.params.page);
};

handlers.GET = _;
_ = {};

/*
 *	POST request handlers
 */

_.index = _.catalog = function(req,res,next) { // New thread
	
};

_.thread = function(req,res,next) { // New reply to thread
	parseUpload.any()(req,res,(err)=>{
		res.locals.trackfiles = [];
		if (req.files) req.files.forEach((item)=>{res.locals.trackfiles.push(item.path);});
		console.log('trackable',res.locals.trackfiles);
		if (err) return next(err);
		if (req.files.reduce((a,b)=>{ return a+b.size;},0) > (GLOBAL.cfg.values.max_upload_size_in_kb * 1024))
			return next(new Error('Files size exceeds the maximum upload size limit.'));
		let post = {}, parts = ['name', 'trip', 'capcode', 'subject','email'];
		parts.forEach((part)=>{ post[part] = req.body[part]!==undefined?req.body[part]:null; });
		post.board = req.params.board;
		post.thread = pgp.as.number(parseInt(req.params.page));
		post.ip = req.ip;
		post.sage = pgp.as.bool(!!req.body.sage);
		if (post.name && post.name.indexOf('#') != -1){
			req.body.trip = post.name.substr(post.name.indexOf('#')+1);
			post.name = post.name.splice(0,post.name.indexOf('#'));
			if (!req.body.trip || (req.body.trip.indexOf('#') != -1 && req.body.trip.length < 2))
				req.body.trip = null;
			post.trip = GLOBAL.lib.processTrip(req,res,next);
			if (post.trip && post.trip.indexOf(' ## ') == 0) {
				post.capcode = post.trip;
				post.trip = null;
			}
		}
		post.markdown = req.body.markdown = GLOBAL.lib.processMarkdown(req,res,next);
		post.markup = GLOBAL.lib.processMarkup(req,res,next);
		post.media = pgp.as.json(GLOBAL.lib.processPostMedia(req,res,next));
		post.cites = pgp.as.json((post.markdown.match(/(?:^| |\n)>>\d+(?:$| |\n)/g)||[]).forEach((item,i,arr)=>{
			arr[i] = [post.board,post.page,item.trim().substr(2)].join('/');
		}));
		db.one(GLOBAL.sql.modify.new_reply,post).then((data)=>{
			console.log('Success.');
			res.redirect('/'+data.board+'/'+data.thread+'#'+data.post);
		}).catch((err)=>{
			res.status(500);
			return next(err);
		});
	});
};

_.pages = function(req,res,next) { // Manage custom board pages
	
};

_.settings = function(req,res,next) {
	
};

handlers.POST = _;

module.exports = handlers;
