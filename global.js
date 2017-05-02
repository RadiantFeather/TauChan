"use strict";

//*/
const fs = require('fs');
const Multer = require('./lib/koa-multer');
const Request = require('request');
const PRequest = require('promisified-request');
const Socket = require('socket.io');
const Redis = require('koa-redis');
const Crypto = require('crypto');
const Config = require('./config');

/*/
import * as fs from 'fs';
import Multer from 'koa-multer';
import Request from 'request';
import PRequest from 'promisified-request';
import Socket from 'socket.io';
import Redis from 'koa-redis';
import Crypto from 'crypto';
import Config from './config';

//*/

const request = PRequest.create(Request.defaults({}));
const db = Config.db;
const pgp = Config.pgp;
const handlers = {};
var _ = {};

/*
 *	GET request handlers
 */

_.index = async function(ctx,next){	// moderation front page aka underboard
	if (!ctx.state.user.reg) return this.login(ctx,next);
	let data = await db.any(Config.sql.view.user_roles,{
		id: ctx.state.user.id
	});
	ctx.state.page = {type:'mod',param:'index'};
	ctx.render('underboard',{data});
};

_.login = async function(ctx,next){
	console.log(ctx.cookies.lastpage,ctx.path);
	if (ctx.state.user.reg) return ctx.redirect(ctx.cookies.get('lastpage')!=ctx.path?ctx.cookies.get('lastpage'):'/_');
	ctx.render('login');
};

_.signup = async function(ctx,next){
	console.log(ctx.cookies.lastpage,ctx.path);
	if (ctx.state.user.reg) return ctx.redirect(ctx.cookies.get('lastpage')!=ctx.path?ctx.cookies.get('lastpage'):'/');
	ctx.render('signup');
};

_.logout = async function(ctx,next){
	ctx.cookies.set('curpage',ctx.cookies.get('lastpage'),{httpOnly:true});
	if (!ctx.session.user) ctx.redirect(ctx.cookies.get('lastpage'));
	try {
		await db.none(Config.sql.modify.user_token,{
			user:ctx.session.user.username,
			token:null
		});
		if (ctx.session.user) delete ctx.session.user;
		if (ctx.cookies.user) ctx.cookies.set('user',undefined,{httpOnly:true});
		return ctx.redirect(ctx.cookies.get('lastpage')!=ctx.path?ctx.cookies.get('lastpage'):'/_');
	} catch(err){
		throw err.setloc('/_/logout');
	}
	
};

_.createBoard = async function(ctx,next){
	if (!ctx.state.user.reg) return ctx.redirect('/_/login');
	ctx.render('editBoard');
};
_.createBoard.reg = true;
_.createBoard.auth = function(ctx,next){
	if (Config.cfg.options.disable_usermade_boards)
		if (!ctx.state.user.global || !ctx.state.user.auth('site.board.create',0))
			throw new Error('Unauthorized to create a board.');
	else if (Config.cfg.options.require_valid_email)
		if (!ctx.state.user.verified || !ctx.state.user.auth('site.board.create',1))
			throw new Error('Unauthorized to create a board.');
};

_.bans = async function(ctx,next){
	ctx.body = 'Preset Global Page: /_/'+ ctx.params.page;
	return;
	ctx.state.page = {type:'mod',param:'bans'};
};

_.banned = async function(ctx,next){
	ctx.body = 'Preset Global Page: /_/'+ ctx.params.page;
	return;
	ctx.state.page = {type:'mod',param:'banned'};
};

_.logs = async function(ctx,next){
	ctx.body = 'Preset Global Page: /_/'+ ctx.params.page;
	return;
	ctx.state.page = {type:'mod',param:'logs'};
};

_.reports = async function(ctx,next){
	ctx.body = 'Preset Global Page: /_/'+ ctx.params.page;
	return;
	ctx.state.page = {type:'mod',param:'reports'};
};

handlers.GET = _;
_ = {};

/*
 *	POST request handlers
 */

_.login = async function(ctx,next){
	ctx.checkCSRF();
	try {
		await db.one(Config.sql.view.user,{
			user:ctx.request.body.username,
			pass:ctx.request.body.passphrase,
			board:'_'
		});
		let token = Crypto
			.createHash('sha512')
			.update(ctx.request.body.username)
			.update(ctx.IP)
			.update(Config.cfg.secret)
			.digest('hex');
		try {
			await db.none(Config.sql.modify.user_token,{
				user:ctx.request.body.username,
				token:token
			});
			let x = {httpOnly:true};
			if (!!ctx.request.body.rememberme) x.maxAge = 1000*60*60*24*7;
			else x.expires = 0;
			ctx.cookies.set('user',token,x);
			ctx.redirect(ctx.cookies.get('lastpage')!=ctx.path?ctx.cookies.get('lastpage'):'/');
		} catch(err){
			throw err;
		}
	} catch(err){
		if (err.message=="No data returned from the query.")
			err.message = "Invalid username or password.";
		throw err.withrender('login').setdata(ctx.request.body);
	}
};

_.signup = async function(ctx,next){
	ctx.checkCSRF();
	let err;
	if (ctx.request.body.passphrase != ctx.request.body.validate)
		err = new Error('Passphrase mismatch. Try again.');
	if (!ctx.request.body.passphrase)
		err = new Error('Passphrase is REQUIRED.');
	if (!ctx.request.body.username)
		err = new Error('Username is REQUIRED.');
		
	if (err) return next(err.withrender('signup').setdata(ctx.request.body));
	let token = Crypto
		.createHash('sha1')
		.update(ctx.request.body.username)
		.update(ctx.ip)
		.update(Config.cfg.secret)
		.digest('hex');
	try {
		await db.none(Config.sql.modify.new_user,{
			user:ctx.request.body.username,
			nick:ctx.request.body.screenname||ctx.request.body.username,
			pass:ctx.request.body.passphrase,
			email:ctx.request.body.email||null,
			token:token
		});
		let x = {httpOnly:true};
		if (ctx.request.body.rememberme) x.maxAge = 1000*60*60*24*3; // 3 days
		else x.expires = 0;
		ctx.cookies.set('user',token,x);
		ctx.cookies.set('curpage',ctx.cookies.get('lastpage'),{httpOnly:true,expires:0});
		ctx.redirect('/_/login');
	} catch(err){
		throw Config.lib.mkerr('signup',err).withrender('signup').setdata(ctx.request.body);
	}
};


_.createBoard = async function(ctx,next){
	ctx.checkCSRF();
	let err;
	ctx.request.body.board = ctx.request.body.board.replace(/(?:^\/|\/$)/g,'');
	ctx.request.body.tags = ctx.request.body.tags.replace(/(?:^,|,$)/g,'');
	if (!(/^[a-zA-Z0-9_]+$/.test(ctx.request.body.board)))
		err = new Error('Board name is empty or contains invalid characters.');
	else if (ctx.request.body.board.length > 32)
		err = new Error('Board name is too long. Must be 32 characters or less.');
	else if (ctx.request.body.title.length == 0)
		err = new Error('Board title is empty. Must provide a title for the board.');
	else if (ctx.request.body.tags.replace(/,/g,'').length > 0 && !(/^[a-zA-Z0-9_]+(?:,[a-zA-Z0-9_]+)*$/.test(ctx.request.body.tags)))
		err = new Error('A tag with invalid characters was submitted.');
	else if (ctx.request.body.tags.split(',').length > 8)
		err = new Error('Too many tags were submitted. Must have no more than 8 tags.');
	else if (ctx.request.body.title.length > 32)
		err = new Error('Board title is too long. Must be 32 characters or less.');
	else if (ctx.request.body.noname.length > 32)
		err = new Error('Default anonymous name is too long. Must be 32 characters or less.');
	else if (ctx.request.body.subtitle.length > 128)
		err = new Error('Board subtitle is too long. Must be 128 characters or less.');
	else if (ctx.request.body.ticker.length > 256)
		err = new Error('Board information header is too long. Must be 256 characters or less.');
	
	if (err) {
		throw err.withrender('editBoard').setdata(ctx.request.body);
	} else {
		// finish
		let t = {};
		['board','title','subtitle'].forEach((item)=>{
			t[item] = item in ctx.request.body && ctx.request.body[item].length? pgp.as.text(ctx.request.body[item]): 'NULL';
		});
		
		['noname','archivedlifespan'].forEach((item)=>{
			t[item] = item in ctx.request.body && ctx.request.body[item].length? pgp.as.text(ctx.request.body[item]): 'DEFAULT';
		});
		
		['mediauploadlimit','postlimit','medialimit','bumplimit','threadlimit','standardlimit',
		'archivedlimit','cyclelimit','stickylimit','pinnedlimit','lockedlimit'].forEach((item)=>{
			t[item] = item in ctx.request.body? pgp.as.number(parseInt(ctx.request.body[item],10)): 'DEFAULT';
		});
		
		['listed','nsfw','perthreadunique','archivethreads','emailsubmit',
		'publiclogs','publicbans','publicedits','loguser','postids'].forEach((item)=>{
			t[item] = pgp.as.bool(!!ctx.request.body[item]);
		});
		
		t.tags = pgp.as.json('tags' in ctx.request.body? ctx.request.body.tags.split(','): []);
		t.ticker = pgp.as.text('ticker' in ctx.request.body? ctx.request.body.ticker: '');
		if (t.ticker) t.tickermarkup = pgp.as.text(Config.lib.processTicker(t.ticker));
		
		let i,k=[],v=[];
		for (i in t){
			k.push(i);
			v.push(t[i]);
		}
		try {
			db.none(Config.sql.modify.new_board,{
				keys:k.join(','),
				values:v.join(','),
				id:ctx.state.user.id,
				board:t.board
			});
			ctx.session.user = null; // Force recache of user data
			ctx.redirect('/'+ctx.request.body.board+'/');
		} catch(err){
			throw Config.lib.mkerr('editBoard',err).withrender('editBoard').setdata(ctx.request.body);
			// TODO: recache the board list and data?
		}
	}
};
_.createBoard.reg = true;
_.createBoard.auth = handlers.GET.createBoard.auth; 

handlers.POST = _;


//TODO implement redis cacheing.
const tagCloud = async function tagCloud(){
	let cloud = {}, out = [];
	try {
		let data = await db.any('SELECT tags FROM boards WHERE listed IS TRUE;');
		let i = -1;
		while (++i < data.length)
			data[i].tags.forEach((item)=>{
				if (item in cloud) cloud[item] += 1;
				else cloud[item] = 1;
			});
		for (i in cloud)
			out.push({tag:i,count:cloud[i]});
		out.sort((a,b)=>{ return a.count < b.count? 1: a.count > b.count? -1: 0; });
	} catch(err){
		console.log('DB error in global#tagCloud');
		console.log(err);
	}
	return out;
};

handlers.pages = async function(ctx,next){
	try {
		let data = await db.one(Config.sql.view.page, {
			board: '_',
			page: ctx.params.file
		});
		ctx.state = {type:'custom',param:ctx.params.page};
		ctx.render('page',{data: data}); // TODO
	} catch(err){
		throw err.setstatus(404).setloc('global page serve');
	}
};

handlers.index = async function(ctx,next){
	let t = (ctx.query.tags||'').split(','),
		nsfw = ['NULL','TRUE','FALSE'].contains(ctx.query.nsfw)? ctx.query.nsfw:'NULL',
		all=[],any=[],none=[],
		reall=/^ *\+[a-zA-Z0-9_]+ *$/,reany=/^ *[a-zA-Z0-9_]+ *$/,renone=/^ *\-[a-zA-Z0-9_]+ *$/;
	if (t.length&&t[0]!==''){
		t.forEach((b)=>{if(reall.test(b))all.push(b.trim().slice(1));});
		t.forEach((b)=>{if(renone.test(b))none.push(b.trim().slice(1));});
		t.forEach((b)=>{if(reany.test(b))any.push(b.trim());});
	}
	let tags = await tagCloud();
	// redis cache check/fetch with alternate tags filter?
	let data = await db.any(Config.sql.view.overboard, {
		page: parseInt(ctx.query.page||1,10),
		all: all.length?'tags ?& '+pgp.as.array(all)+'::TEXT[]':'TRUE',
		any: any.length?'tags ?| '+pgp.as.array(any)+'::TEXT[]':'TRUE',
		none: none.length?'NOT tags ?| '+pgp.as.array(none)+'::TEXT[]':'TRUE',
		nsfw: {'TRUE':'FALSE','FALSE':'TRUE','NULL':'NULL'}[nsfw]
	});
	ctx.state.page = {type:'index',param:'index'};
	ctx.render('overboard',{
		data, nsfw,
		tags: ctx.query.tags,
		taglist: tags.slice(0,25), // only suggest up to the 25 most used tags
		curpage: parseInt(ctx.query.page||1,10),
		totalboards: data&&data.length?parseInt(data[0].total,10):0,
		cloud: tags.slice(0,Config.cfg.values.tag_cloud_count||25) //array of {tag:string,count:integer}
	}); 
};

module.exports = handlers;
// export {handlers as default};