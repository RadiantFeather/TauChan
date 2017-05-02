"use strict";

//*/

const fs = require('fs');
const Redis = require('koa-redis');
const Config = require('./config');
/*/

import * as fs from 'fs';
import Redis from 'koa-redis';
import Config from './config';
//*/

const db = Config.db;
const pgp = Config.pgp;
const _ = {};
	
function loadBoardAssets(board,data,paths){
	let i = -1;
	while(++i < paths.length) {
		Config.lib.mkdir('./assets/'+board);
		try {
			let f = fs.statSync('./assets/'+board+'/'+paths[i].path);
			if (f.isDirectory()) {
				try {
					data[paths[i].key] = fs.readdirSync('./assets/'+board+'/'+paths[i].path).map((cur)=>{return '/'+board+'/media/'+paths[i].path+'/'+cur;});
				} catch(e) {
					data[paths[i].key] = fs.readdirSync('./static/'+paths[i].path).map((cur)=>{return '/_/'+paths[i].path+'/'+cur;});
				}
				if (!data[paths[i].key].length)
					data[paths[i].key] = fs.readdirSync('./static/'+paths[i].path).map((cur)=>{return '/_/'+paths[i].path+'/'+cur;});
			}
			else if (f.isFile()) data[paths[i].key] = '/'+board+'/media/'+paths[i].path;
		} catch (e) {
			try {
				fs.statSync('./static/'+paths[i].path);
				data[paths[i].key] = '/_/'+paths[i].path;
			} catch(e) {
				data[paths[i].key] = '';
			}
		}
	}
}

_.loadBoard = async function(ctx,next){
	try {
		let data = await db.one('SELECT * FROM boards WHERE board = ${board};', {
			board: ctx.params.board
		});
		loadBoardAssets(ctx.params.board,data,[
			{key:'spoilerimg',path:'spoiler.png'}
			,{key:'missingimg',path:'missing.png'}
			,{key:'deletedimg',path:'deleted.png'}
			,{key:'processingimg',path:'processing.png'}
			// ,{key:'videothumb',path:'video.png'}
			// ,{key:'audiothumb',path:'audio.png'}
			// ,{key:'banners',path:'banners'}
			// ,{key:'flags',path:'flags'}
		]);
		ctx.state.board = data;
		//TODO cache board assets
		return next();
	} catch(err) {
		ctx.throw(err.message,404);
	}
};

_.loadUser = async function(ctx,next){
	if (ctx.state.user) return next(); // User has already been defined, skip
	console.log("\nUser session",ctx.session);
	if (ctx.session.user){ // User data is present, set with new IP and board references
		ctx.state.user = new Config.lib.User(ctx.session.user,ctx.params.board,ctx.IP);
		return next();
	}
	console.log("\nUser cookie",ctx.cookies.get('user'));
	if (!ctx.cookies.get('user')){ // No cookie present, assume anonymous user
		delete ctx.session.user;
		ctx.state.user = new Config.lib.User(null,ctx.params.board,ctx.IP);
		return next();
	}
	try {
		let data = await db.one(Config.sql.view.user,{
			user: ctx.cookies.get('user'),
			pass: null,
			board: ctx.params.board || '_'
		});
		ctx.session.user = {};
		for (let key in data)
			ctx.session.user[key] = data[key];
		ctx.state.user = ctx.state.user = new Config.lib.User(data,ctx.params.board,ctx.IP);
		return next();
	} catch(err){ 
		// user token failed, assume anonymous user
		delete ctx.session.user;
		ctx.state.user = new Config.lib.User(null,ctx.params.board,ctx.IP);
		return next();
	}
};

_.loadGlobal = async function(ctx,next){ // don't know if we'll actually need this but it's here if so.
	return next();
};

_.log = async function(ctx,err){
	console.log(err);
	return;
	try {
		await db.none(Config.sql.modify.new_log,{
			board: ctx.params.board||'_',
			user: ctx.state.user.reg&&ctx.board.loguser?ctx.state.user.username:null,
			level: err.log,
			detail: err.message
		});
	} catch(err){
		console.log('LOGGING ERROR: ',err);
		console.log('Level: '+err.log,'Detail: '+err.message);
	}
};

_.handleErrors = async function(ctx,next){
	try {
		await next();
	} catch (err){
		if (ctx.state.xhr) {
			if (err.log) _.log(ctx,err);
			console.log('Ajax Error');
			console.log(err);
			ctx.json({success:false,data:{status:ctx.status||500,message:err.message}});
		} else {
			if (err.log) _.log(ctx,err);
			let x,y=[];
			for (x in ctx.params){
				y.push(x+': '+ctx.params[x]);
			}
			console.log('Request Error');
			console.log(err);
			err.back = ctx.cookies.get('lastpage');
			if (err.sendStatus) ctx.status = err.status||ctx.status;
			else ctx.render(err.render||'error',{status:ctx.status||500,err:err,data:err.data||null});
			let tf = ctx.state.trackfiles;
			if (tf && tf.length) {
				let i=-1;
				while (++i < tf.length)
					try {
						fs.unlinkSync('./'+tf[i]);
					} catch (e) {}
			}
		}
		//ctx.app.emit('error', err, ctx);
	}
};

module.exports = _;
// export {_ as default};
