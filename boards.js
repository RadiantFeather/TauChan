"use strict";
var fs = require('fs'),
	// request = require('request'),
	// socket = require('socekt.io'),
	deasync = require('deasync'),
	// cache = require('redis'),
	// tpl = require('jade'),
	// yml = {read: require('read-yaml'), write: require('write-yaml')},
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
				cb(null, Date.now() + '.' + file.originalname.split('.')[file.originalname.split('.').length-1]);
			}
		})
		,files: 4
		,fileSize: GLOBAL.cfg.values.max_upload_size_in_kb*1024
	});

/*
 *	GET request handlers
 */

_.index = function(req,res,next) { 	// board index
	// res.send('Index: '+ req.params.board);
	db.any(GLOBAL.sql.view.board_index, {
		board: req.params.board,
		page: req.query.page ? parseInt(req.query.page) : 0,
		salt: req.app.locals.cfg.site.secret
	}).then((data)=>{
		res.render('threads.jade',{
			board: res.locals.board,
			user: res.locals.user,
			data: data,
			cdn: res.locals.cdn,
			sitename: req.app.locals.cfg.site.name,
			page: {type:'index',param:''}
		});
		// res.send(data);
	}).catch((err)=>{
		console.log(err);
		res.status(500);
		return next(err);
	});
};

_.thread = function(req,res,next) {	// thread view
	// res.send('Thread: '+ req.params.board +'/'+ req.params.page);
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
		// res.send(data);
	}).catch((err)=>{
		console.log(err);
		res.status(404);
		return next(err);
	});
};

_.catalog = function(req,res,next) {
	// res.send('Preset Page: '+ req.params.board +'/'+ req.params.page);
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
		console.log(err);
		res.status(500);
		return next(err);
	});
};

_.pages = function(req,res,next) { // custom board pages
	// res.send('Custom Page: '+ req.params.board +'/'+ req.params.page);
	db.one(GLOBAL.sql.view.custom, req.params).then((data)=>{
		res.render('custom.jade',{
			board: res.locals.board,
			user: res.locals.user,
			data: data,
			cdn: res.locals.cdn,
			page: {type:'custom',param:req.params.page}
		});
	}).catch((err)=>{
		console.log(err);
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
		res.locals.trackfiles = req.files.reduce((a,b)=>{return a.push(b.path);},[]);
		if (err) return next(err);
		
		if (req.files.reduce((a,b)=>{ return a+b.size;},0) > (GLOBAL.cfg.values.max_upload_size_in_kb * 1024))
			return next(new Error('Files size exceeds the maximum upload size limit.'));
		
		let post = {};
		post.media = GLOBAL.lib.processPostMedia(req,res,next);
		// if (post.media.length > res.locals.board.mediauploadlimit)
			// return next(new Error('File count exceeds the board\'s media upload limit.'));
		// let done = null;
		// db.none('SELECT check_media($[board],$[thread],$[hashes]::JSONB);',{
			// board: req.params.board,
			// thread: req.params.page,
			// hashes: pgp.as.json(post.media.reduce((a,b)=>{return a.push(b.hash);},[]));
		// }).then((data)=>{done = true;}).catch((err)=>{
			// console.log(err)
			// res.status(500);
			// next(err);
			// done = false;
		// });
		// while(done===null)deasync.runLoopOnce();
		// if(done===false) return next('Uncaught Error Occurred.');
		
		res.send('Check console.');
	});
};

_.pages = function(req,res,next) { // Manage custom board pages
	
};

_.settings = function(req,res,next) {
	
};

handlers.POST = _;

module.exports = handlers;
