"use strict";
var fs = require('fs'),
	deasync = require('deasync'),
	// cache = require('redis'),
	yml = {read: require('read-yaml'), write: require('write-yaml')},
	db = GLOBAL.db, pgp = GLOBAL.pgp,
	_ = {};
	
function loadBoardAssets(board,data,paths){
	let i = -1;
	while(++i < paths.length) {
		GLOBAL.lib.mkdir('./assets/'+board);
		try {
			let f = fs.statSync('./assets/'+board+'/'+paths[i].path);
			if (f.isDirectory()) {
				try {
					data[paths[i].key] = fs.readdirSync('./assets/'+board+'/'+paths[i].path).map((cur)=>{return '/'+board+'/media/'+paths[i].path+'/'+cur;});
				} catch(e) {
					data[paths[i].key] = fs.readdirSync('./static/'+paths[i].path).map((cur)=>{return '/_/static/'+paths[i].path+'/'+cur;});
				}
				if (!data[paths[i].key].length)
					data[paths[i].key] = fs.readdirSync('./static/'+paths[i].path).map((cur)=>{return '/_/static/'+paths[i].path+'/'+cur;});
			}
			else if (f.isFile()) data[paths[i].key] = '/'+board+'/media/'+paths[i].path;
		} catch (e) {
			try {
				fs.statSync('./static/'+paths[i].path);
				data[paths[i].key] = '/_/static/'+paths[i].path;
			} catch(e) {
				data[paths[i].key] = '';
			}
		}
	}
}

_.loadBoard = function(req,res,next){
	db.one('SELECT * FROM boards WHERE board = ${board};', {
		board: req.params.board
	}).then((data) => {
		loadBoardAssets(req.params.board,data,[
			{key:'spoilerimg',path:'spoiler.png'}
			,{key:'missingimg',path:'missing.png'}
			,{key:'deletedimg',path:'deleted.png'}
			,{key:'videothumb',path:'video.png'}
			,{key:'audiothumb',path:'audio.png'}
			// ,{key:'banners',path:'banners'}
			// ,{key:'flags',path:'flags'}
		]);
		res.locals.board = data;
		// cache board assets
		next();
	}).catch((err) => {
		// GLOBAL.lib.logError('middle.loadBoard',err);
		next(err.setstatus(404));
	});
};

_.loadUser = function(req,res,next){
	if (res.locals.user) return next(); // User has already been defined, skip
	if (req.session.user){ // User data is present, set with new IP and board references
		res.locals.user = new GLOBAL.lib.User(req.session.user,req.params.board,req.ip);
		return next();
	}
	if (!req.cookies.user){ // No cookie present, assume anonymous user
		req.session.user = null;
		res.locals.user = new GLOBAL.lib.User(null,req.params.board,req.ip);
		return next();
	}
	db.one(GLOBAL.sql.view.user,{
		user: req.cookies.user,
		pass: null,
		board: req.params.board || '_'
	}).then((data)=>{
		req.session.user = data;
		res.locals.user = new GLOBAL.lib.User(data,req.params.board,req.ip);
		next();
	}).catch(()=>{ // user token failed, assume anonymous user
		req.session.user = null;
		res.locals.user = new GLOBAL.lib.User(null,req.params.board,req.ip);
		next();
	});
};

_.loadGlobal = function(req,res,next){ // don't know if we'll actually need this but it's here if so.
	return next();
};

_.log = function(req,res,level,detail){
	console.log(level,detail);
	return;
	db.none(GLOBAL.sql.modify.new_log,{
		board: req.params.board||'_',
		user: res.locals.user.reg&&res.locals.board.loguser?res.locals.user.username:null,
		level: level,
		detail: detail.toString()
	}).catch((err)=>{
		console.log('LOGGING ERROR: ',err);
	});
};

_.handleAjaxError = function(err,req,res,next){
	if (err.status) res.status(err.status);
	err.xhr = req.xhr;
	if (!req.xhr) return next(err);
	if (err.log) _.log(req,res,err.log,err);
	console.log('Ajax Error');
	console.log(err);
	res.json({success:false,data:{status:res.statusCode||500,message:err.message}});
};

_.handleError = function(err,req,res,next){
	if (err.log) _.log(req,res,err.log,err);
	let x,y=[];
	for (x in req.params){
		y.push(x+': '+req.params[x]);
	}
	console.log('Request Error');
	console.log(err);
	err.back = req.cookies.lastpage;
	if (err.sendStatus) res.sendStatus(res.statusCode);
	else res.render(err.render||'error.jade',{status:res.statusCode||500,err:err,data:err.data||null});
	let tf = res.locals.trackfiles;
	res.end();
	if (tf && tf.length) {
		let i=-1;
		while (++i < tf.length) {
			try {
				fs.unlinkSync('./'+tf[i]);
			} catch (e) {}
		}
	}
};

module.exports = _;
