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
import {FS as fs} from 'fs';
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
const noop = ()=>{};
var _ = {};
	
const processPostFiles = Multer({
		storage: Multer.diskStorage({
			destination: (ctx, file, cb) => {
				Config.lib.mkdir('./cache/uploads');
				cb(null, 'cache/uploads/');
			},
			filename: (ctx, file, cb) => {
				cb(null, Date.now() + '.' + file.originalname);
			}
		}),
		limits: {
			files: 4,
			fileSize: Config.cfg.values.max_upload_size_in_kb*1024
		}
	}).any();

/*
 *	GET request handlers
 */

_.index = async function(ctx,next) { 	// board index
	let data = await db.any(Config.sql.view.board_index, {
		board: ctx.params.board,
		page: ctx.query.page ? parseInt(ctx.query.page,10) : 1,
	});
	let board = ctx.state.board;
	ctx.state.META.keywords = '/'+board.board+'/';
	ctx.state.META.title = '/'+board.board+'/ - '+ctx.state.SITE.name;
	ctx.state.META.desc = '/'+board.board+'/ - '+board.title;
	ctx.state.page = {type:'index',param:'index'};
	ctx.render('threads',{data,curpage:parseInt(ctx.query.page||1,10)});
};

_.archive = async function(ctx,next) {	// archive view
	let data = await db.any(Config.sql.view.archive, {
		board: ctx.params.board,
		page: parseInt(ctx.query.page||1,10),
	});
	let board = ctx.state.board;
	ctx.state.META.keywords = '/'+board.board+'/';
	ctx.state.META.title = '/'+board.board+'/archive - '+ctx.state.SITE.name;
	ctx.state.META.desc = '/'+board.board+'/archive - '+board.title+': '+(board.subtitle||'');
	ctx.state.page = {type:'archive',param:'index'};
	ctx.render('threads',{data,curpage:parseInt(ctx.query.page||1,10)});
};

_.thread = async function(ctx,next) {	// thread view
	let data = await db.any(Config.sql.view.thread, {
		board: ctx.params.board,
		thread: parseInt(ctx.params.page,10),
		limit: ctx.query.preview ? parseInt(ctx.query.preview,10) : null,
	});
	data.forEach((x,i,a)=>{a[i].longhash = Config.lib.maskIP(x.ip);});
	ctx.state.META.keywords = '/'+ctx.state.board.board+'/';
	ctx.state.META.desc = data[0].markdown.substring(128);
	ctx.state.META.title = '/'+ctx.state.board.board+'/ - '+(data[0].subject || data[0].markdown.substring(0,24));
	ctx.state.page = {type:(data[0].archived===null?'thread':'archived_thread'),param:ctx.params.page};
	ctx.render('threads',{data});
};

_.catalog = async function(ctx,next) {
	let data = await db.any(Config.sql.view.catalog, {
		board: ctx.params.board,
		limit: ctx.state.board.threadlimit
	});
	console.log(data);
	ctx.state.page = {type:'index',param:'catalog'};
	ctx.render('catalog',{data});
};

_.spoilerMedia = async function(ctx,next) {
	// if(!CSRF(ctx,next)) return;
	// TODO
	
};
_.spoilerMedia.auth = function(ctx,next){
	return ctx.state.user.auth('post.spoiler_media');
};

_.deleteMedia = async function(ctx,next) {
	// if(!CSRF(ctx,next)) return;
	// TODO
	
};
_.deleteMedia.auth = function(ctx,next) {
	return ctx.state.user.auth('post.delete_media');
};

_.ban = async function(ctx,next) {
	ctx.body = 'Preset Page: '+ ctx.params.board +'/'+ ctx.params.page;
	return;
	ctx.cookie.set('curpage',ctx.cookies.get('lastpage'),{httpOnly:true});
	// if (!CSRF(ctx,next)) return;
	ctx.render('bnd',{ // TODO
		mode:'b',
		board:ctx.params.board,
		post:parseInt(ctx.params.action,10)
	});
};
_.ban.auth = function(ctx,next) {
	return ctx.state.user.auth('thread.post_ban');
};

_.delete = async function(ctx,next) {
	ctx.body = 'Preset Page: '+ ctx.params.board +'/'+ ctx.params.page;
	return;
	let data = await db.one(Config.sql.view.post,{
		board:ctx.params.board,
		post:parseInt(ctx.params.action,10)
	});
	ctx.render('bnd',{mode:'d',data});
};
_.delete.auth = function(ctx,next){
	return ctx.state.user.auth('thread.post_delete');
};

_.bnd = async function(ctx,next) {
	ctx.body = 'Preset Page: '+ ctx.params.board +'/'+ ctx.params.page;
	return;
	let data = await db.one(Config.sql.view.post,{
		board:ctx.params.board,
		post:parseInt(ctx.params.action,10)
	});
	ctx.render('bnd',{mode:'bd',data});
};
_.bnd.auth = function(ctx,next){
	return ctx.state.user.auth(['thread.post.ban','thread.post.delete']);
};

_.bans = async function(ctx,next) {
	ctx.body = 'Preset Page: '+ ctx.params.board +'/'+ ctx.params.page;
};

_.banned = async function(ctx,next) {
	ctx.body = 'Preset Page: '+ ctx.params.board +'/'+ ctx.params.page;
	return;
	let data = await db.any(Config.sql.view.banned,{
		board: ctx.params.board,
		ip: ctx.IP
	});
	ctx.render('banned',{data}); // TODO
};

_.history = async function(ctx,next) {
	ctx.body = 'Preset Page: '+ ctx.params.board +'/'+ ctx.params.page;
};

_.logs = async function(ctx,next) {
	ctx.body = 'Preset Page: '+ ctx.params.board +'/'+ ctx.params.page;
};

_.report = async function(ctx,next) {
	ctx.body = 'Preset Page: '+ ctx.params.board +'/'+ ctx.params.page;
};

_.reports = async function(ctx,next) {
	ctx.body = 'Preset Page: '+ ctx.params.board +'/'+ ctx.params.page;
};

_.pages = async function(ctx,next) { // custom board pages
	if (ctx.params.page != 'pages'){
		try {
			let data = await db.one(Config.sql.view.page, ctx.params);
			ctx.state.page = {type:'custom',param:ctx.params.page};
			ctx.render('pages',{data});  // TODO
		} catch(err){
			throw err.setstatus(404);
		}
	} else {
		let data = await db.any(Config.sql.view.pages,{board:ctx.params.board});
		ctx.state.page = {type:'index',param:'custom'};
		ctx.render('pages',{data});	// TODO
	}
};

_.editPage = async function(ctx,next){
	
};

_.deletePage = async function(ctx,next){
	
};

_.settings = async function(ctx,next) {
	let data = await db.one(Config.sql.view.board_settings,{board:ctx.params.board});
	data.tags = data.tags.join(',');
	ctx.state.editmode = true;
	ctx.state.page = {type:'mod',param:'settings'};
	ctx.render('editBoard',{
		data,
		info_auth: !ctx.state.user.auth('board.settings.info'),
		limit_auth: !ctx.state.user.auth('board.settings.limits'),
		flag_auth: !ctx.state.user.auth('board.settings.flags'),
		header_auth: !ctx.state.user.auth('board.settings.header'),
		lifespan_auth: !ctx.state.user.auth('board.settings.archive_lifespan')
	});
};
_.settings.auth = function(ctx,next){
	return ctx.state.user.auth('board.settings!any');
};

_.editRole = async function(ctx,next){
	if (ctx.params.action){
		ctx.state.page = {type:'mod',param:'editrole'};
		let data = await db.one(Config.sql.view.role,{
			board: ctx.params.board,
			role: ctx.params.data
		});
		ctx.render('editRole.pug',{data,flags:Config.flags});
	} else {
		ctx.state.page = {type:'mod',param:'newrole'};
		ctx.render('editRole',{flags:Config.flags});
	}
};
_.editRole.reg = true;
_.editRole.auth = function(ctx,next){
	return ctx.state.user.auth('board.manage.roles.edit');
};

_.roles = async function(ctx,next){
	let data = await db.any(Config.sql.view.board_roles,{ board:ctx.params.board });
	let out = [];
	let lastrole;
	data.forEach((item)=>{
		if (lastrole != item.role) {
			lastrole = item.role;
			out.push({role:item.role,capcode:item.capcode,users:[]});
		}
		out[out.length-1].users.push({username:item.username,screenname:item.screenname});
	});
	ctx.state.page = {type:'index',param:'roles'};
	ctx.render('roles',{data:out});
};
_.roles.auth = function(ctx,next){
	return ctx.state.user.auth('board.manage.roles!any');
};

handlers.GET = _;
// prevent custom pages from path names already is use by app
const reservedPages = Object.keys(_).push('media');
_ = {};

/*
 *	POST request handlers
 */

_.index = _.catalog = async function(ctx,next) { // New thread
	await processPostFiles(ctx,noop);
	ctx.checkCSRF();
	ctx.state.trackfiles = [];
	if (ctx.request.files) ctx.request.files.forEach((item)=>{ctx.state.trackfiles.push(item.path);});
	console.log('trackable',ctx.state.trackfiles);
	if (ctx.request.files && ctx.request.files.reduce((a,b)=>{ return a+b.size;},0) > (Config.cfg.values.max_upload_size_in_kb * 1024))
		throw (new Error('Files size exceeds the maximum upload size limit.')).setstatus(413);
	let post = {};
	['name', 'trip', 'capcode', 'subject','email']
		.forEach((part)=>{ post[part] = part in ctx.request.body&&ctx.request.body[part].length?ctx.request.body[part]:null; });
	if (!ctx.state.board.emailsubmit) post.email = null;
	['nsfw','sage','pinned','sticky','cycle','anchor','locked']
		.forEach((part)=>{ 
			if (!(part in Config.flags) || ctx.state.user.auth('thread.'+part))
				post[part] = part in ctx.request.body?!!ctx.request.body[part]:false;
		});
	post.board = ctx.params.board;
	post.ip = ctx.IP;
	post.hash = Config.lib.maskIP(ctx.IP,ctx.params.board);
	if (post.name && post.name.indexOf('#') != -1){
		ctx.request.body.trip = post.name.substr(post.name.indexOf('#')+1);
		post.name = post.name.slice(0,post.name.indexOf('#'));
		if (!ctx.request.body.trip || (ctx.request.body.trip.indexOf('#') != -1 && ctx.request.body.trip.length < 2))
			ctx.request.body.trip = null;
		post.trip = Config.lib.processTrip(ctx.request.body.trip,ctx.state.user.roles[ctx.params.board].capcodee);
		if (post.trip && post.trip.indexOf(' ## ') == 0) {
			post.capcode = post.trip;
			post.trip = null;
		}
	}
	post.cites = pgp.as.json((ctx.request.body.markdown.match(/(?:^| |\n)>>\d+(?:$| |\n)/g)||[]).forEach((item,i,arr)=>{
		arr[i] = [post.board,post.thread,item.trim().substr(2)].join('/');
	}));
	post.markdown = ctx.request.body.markdown = Config.lib.processMarkdown(ctx,next);
	post.markup = Config.lib.processMarkup(post.markdown);
	post.media = await Config.lib.processPostMedia(ctx.state.board,ctx.request.body,ctx.request.files,ctx.state.trackfiles);
	post.media = pgp.as.json(post.media);
	console.log('Post media: ',post.media);
	try {
		let data = await db.one(Config.sql.modify.new_thread,post);
		ctx.redirect('/'+data.board+'/'+data.thread);
		// Config.lib.log('info','New thread: /'+data.board+'/'+data.thread);
	} catch(err){
		throw err.setstatus(500);
	}
};

_.thread = async function(ctx,next) { // New reply to thread
	await processPostFiles(ctx,noop);
	ctx.checkCSRF();
	ctx.state.trackfiles = [];
	if (ctx.request.files) ctx.request.files.forEach((item)=>{ctx.state.trackfiles.push(item.path);});
	console.log('trackable',ctx.state.trackfiles);
	if (ctx.request.files.reduce((a,b)=>{ return a+b.size;},0) > (Config.cfg.values.max_upload_size_in_kb * 1024))
		throw (new Error('Files size exceeds the maximum upload size limit.')).setstatus(413);
	let post = {};
	['name', 'trip', 'capcode', 'subject','email']
		.forEach((part)=>{ post[part] = part in ctx.request.body&&ctx.request.body[part].length?ctx.request.body[part]:null; });
	if (!ctx.state.board.emailsubmit) post.email = null;
	post.board = ctx.params.board;
	post.thread = parseInt(ctx.params.page,10);
	post.ip = ctx.IP;
	post.hash = Config.lib.maskIP(ctx.IP,ctx.params.board);
	post.sage = !!ctx.request.body.sage;
	if (post.name && !post.name.contains('#')){
		ctx.request.body.trip = post.name.substr(post.name.indexOf('#')+1);
		post.name = post.name.slice(0,post.name.indexOf('#'));
		if (!ctx.request.body.trip || (!ctx.request.body.trip.contains('#') && ctx.request.body.trip.length < 2))
			ctx.request.body.trip = null;
		post.trip = Config.lib.processTrip(ctx.request.body.trip,ctx.state.user.roles[ctx.params.board].capcode);
		if (post.trip && post.trip.indexOf(' ## ') == 0) {
			post.capcode = post.trip;
			post.trip = null;
		}
	}
	post.markdown = ctx.request.body.markdown = Config.lib.processMarkdown(ctx,next);
	post.markup = Config.lib.processMarkup(ctx.request.body.markdown);
	post.media = await Config.lib.processPostMedia(ctx.state.board,ctx.request.body,ctx.request.files,ctx.state.trackfiles);
	post.media = pgp.as.json(post.media);
	console.log('Post media: '+post.media);
	post.cites = pgp.as.json((post.markdown.match(/(?:^| |\n)>>\d+(?:$| |\n)/g)||[]).forEach((item,i,arr)=>{
		arr[i] = [post.board,post.thread,item.trim().substr(2)].join('/');
	}));
	try {
		let data = await db.one(Config.sql.modify.new_reply,post);
		ctx.redirect('/'+data.board+'/'+data.thread+'#_'+data.post);
	} catch(err){
		throw err.setstatus(500);
	}
};

_.ban = async function(ctx,next) {
	ctx.checkCSRF();
	try {
		await db.none(Config.sql.modify.ban,{
			board: ctx.params.board,
			post: ctx.params.action,
			user: ctx.state.user.id,
			reason: ctx.request.body.reason,
			expires: ctx.request.body.expires,
			bantext: ctx.request.body.bantext,
			range: ctx.request.body.range
		});
		ctx.redirect(ctx.cookies.get('lastpage'));
	} catch(err){
		throw err.withlog('error');
	}
};
_.ban.auth = handlers.GET.ban.auth;

_.pages = async function(ctx,next) { // Manage custom board pages
	ctx.checkCSRF();
	
	let markup = Config.lib.processMarkup(ctx.request.body.markdown);
	try {
		await db.none(Config.sql.modify.page,{
			title: ctx.request.body.title,
			
		});
		
	} catch(err){
		throw err.withlog('error');
	}
};

_.settings = async function(ctx,next) {
	console.log(ctx.params);
	ctx.checkCSRF();
	let err;
	ctx.request.body.tags = ctx.request.body.tags.replace(/(?:^,|,$)/g,'');
	ctx.state.editmode = true;
	if (ctx.request.body.title.length == 0)
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
		if(ctx.state.user.auth('board.settings.info'))
			['title','subtitle','noname'].forEach((item)=>{
					if(item in ctx.request.body && ctx.request.body[item].length) t[item] = pgp.as.text(ctx.request.body[item]);
			});
		if(ctx.state.user.auth('board.settings.archive_lifespan'))
			['archivedlifespan'].forEach((item)=>{
					if(item in ctx.request.body && ctx.request.body[item].length) t[item] = pgp.as.text(ctx.request.body[item]);
			});
		if (ctx.state.user.auth('board.settings.limits'))
			['mediauploadlimit','postlimit','medialimit','bumplimit','threadlimit','standardlimit',
			'archivedlimit','cyclelimit','stickylimit','pinnedlimit','lockedlimit'].forEach((item)=>{
				if (item in ctx.request.body) t[item] = pgp.as.number(parseInt(ctx.request.body[item],10));
			});
		if(ctx.state.user.auth('board.settings.flags'))
			['listed','nsfw','perthreadunique','archivethreads','emailsubmit','publiclogs',
			'publicbans','publicedits','loguser','postids'].forEach((item)=>{
				t[item] = pgp.as.bool(!!ctx.request.body[item]);
			});
		
		if (ctx.state.user.auth('board.settings.info'))
			t.tags = pgp.as.json('tags' in ctx.request.body? ctx.request.body.tags.split(','): []);
		if (ctx.state.user.auth('board.settings.header')) {
			t.ticker = pgp.as.text('ticker' in ctx.request.body? ctx.request.body.ticker: '');
			if (t.ticker) t.tickermarkup = pgp.as.text(Config.lib.processTicker(t.ticker));
		}
		
		let i,k=[],v=[];
		for (i in t){
			k.push(i);
			v.push(t[i]);
		}
		try {
			await db.none(Config.sql.modify.old_board,{
				keys:k.join(','),
				values:v.join(','),
				board:ctx.params.board
			});
			ctx.redirect('/'+ctx.params.board+'/');
		} catch(err){
			if (err.constraint&&err.constraint in Config.errors.editBoard_constraints){
				err.message = Config.errors.editBoard_constraints[err.constraint];
			}
			throw err.withrender('editBoard').setdata(ctx.request.body);
			// TODO: recache the board list and data?
		}
	}
};
_.settings.auth = handlers.GET.settings.auth;

_.editRole = async function(ctx,next){
	ctx.checkCSRF();
	if (ctx.params.action){
		switch(ctx.params.action){
			case 'add':
				break;
			case 'remove':
				break;
		}
	}
};

handlers.POST = _;


module.exports = handlers;
// export {handlers as default};
