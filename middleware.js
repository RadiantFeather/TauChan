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
				if (data[paths[i].key].length == 0)
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
		console.log(err);
		return next(err);
		done = null;
	});
	while (done === false) deasync.runLoopOnce();
	return (done === true ? next() : false);
};

_.loadUser = function(req,res,next){
	res.locals.user = {auth:()=>true};
	return next();
};

_.loadGlobal = function(req,res,next){ // don't know if we'll actually need this but it's here if so.
	return next();
};

_.handleAjaxError = function(err,req,res,next){
	console.log(err);
	if (!req.xhr) return next(err);
};

_.handleError = function(err,req,res,next){
	console.log(err);
	res.render('error.jade',err);
	if (res.locals.trackfiles&&res.locals.trackfiles.length){
		for (var i=0;i++;i<res.locals.trackfiles.length) {
			try {
				fs.unlinkSync('./'+res.locals.trackfiles[i]);
			} catch (e) {}
		}
	}
};

module.exports = _;