"use strict";
var fs = require('fs'),
	deasync = require('deasync'),
	// cache = require('redis'),
	// socket = require('socekt.io'),
	yml = {read: require('read-yaml'), write: require('write-yaml')},
	pgp = require('pg-promise')({ promiseLib: require('bluebird') }),
	db = pgp(GLOBAL.cfg.database),
	_ = {};
	
function loadBoardAssets(board,data,paths){
	let i = -1;
	while(++i < paths.length) {
		try {
			fs.statSync('./assets/'+board);
		} catch (e) {
			fs.mkdirSync('./assets/'+board);
		}
		try {
			let f = fs.statSync('./assets/'+board+'/'+paths[i].path);
			if (f.isDirectory()) {
				try {
					data[paths[i].key] = fs.readdirSync('./assets/'+board+'/'+paths[i].path).map((cur)=>{return '/'+board+'/files/'+paths[i].path+'/'+cur;});
				} catch(e) {
					data[paths[i].key] = fs.readdirSync('./assets/_/'+paths[i].path).map((cur)=>{return '/_/files/'+paths[i].path+'/'+cur;});
				}
				if (!data[paths[i].key].length)
					data[paths[i].key] = fs.readdirSync('./assets/_/'+paths[i].path).map((cur)=>{return '/_/files/'+paths[i].path+'/'+cur;});
			}
			else if (f.isFile()) data[paths[i].key] = '/'+board+'/files/'+paths[i].path;
		} catch (e) {
			try {
				fs.statSync('/_/files/'+paths[i].path);
				data[paths[i].key] = '/_/files/'+paths[i].path;
			} catch(e) {
				data[paths[i].key] = '';
			}
		}
	}
}

_.loadBoard = function(req,res,next){
	// cache board assets
	let done = false;
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
		done = true;
	}).catch((err) => {
		return next(err);
		done = null;
	});
	while (done === false) deasync.runLoopOnce();
	return (done === true ? next() : false);
};

_.loadUser = function(req,res,next){
	let auth = function(board,flag){
		if (!this.reg) return false;
		if (typeof flag == 'string') flag = [flag];
		let i = -1;
		while (++i < flag.length) {
			if (!this.flags[flag[i]]) 
				return false;
		}
		return true;
	};
	let anon = {
		reg:false
		,ip:req.ip
		,validated: false
		,global: false
		,screenname: null
		,capcode:null
		,flags: {}
		,auth:auth
	};
	if (!req.session.user){ // no user token present, assume anonymous user
		res.locals.user = anon;
		return next();
	}
	wait = true;
	db.one(GLOBAL.sql.view.user,{
		user: req.session.user,
		pass: null,
		board: req.params.board || '_'
	}).then((data)=>{
		res.locals.user = data;
		res.locals.user.reg = true;
		res.locals.user.ip = req.ip;
		res.locals.user.auth = auth;
		wait = false;
	}).catch((err)=>{ // user token failed, assume anonymous user
		req.session.user = null;
		res.locals.user = anon;
		wait = false;
	});
	while (wait) deasync.runLoopOnce();
	return next();
};

_.loadGlobal = function(req,res,next){ // don't know if we'll actually need this but it's here if so.
	return next();
};

_.handleAjaxError = function(err,req,res,next){
	if (!req.xhr) return next(err);
	console.log('ajax error', err);
	res.send(err);
};

_.handleError = function(err,req,res,next){
	console.log('request error', err);
	res.render('error.jade',err);
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