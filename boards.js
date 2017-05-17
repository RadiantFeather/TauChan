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
const Lib = require('./lib');
/*/
import {FS as fs} from 'fs';
import Multer from 'koa-multer';
import Request from 'request';
import PRequest from 'promisified-request';
import Socket from 'socket.io';
import Redis from 'koa-redis';
import Crypto from 'crypto';
import Config from './config';
import Lib from './lib';
//*/
const request = PRequest.create(Request.defaults({}));
const db = Config.db;
const pgp = Config.pgp;
const handlers = {};
const noop = ()=>{};
const __ = (arg)=>{console.log('Val check',arg); return arg;};
var _ = {};

const roleRegex = /^[^!@#$%^&*()_+~`={}|[\]\/\\?"'<>,.:;-]+$/;
const pageRegex = /^[0-9]*[a-zA-Z_]+[0-9]*$/;
	
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
	try{
		let data = await db.many(Config.sql.view.thread, {
			board: ctx.params.board,
			post: parseInt(ctx.params.page,10),
			limit: ctx.query.preview ? parseInt(ctx.query.preview,10) : null,
		});
		data.forEach((x,i,a)=>{a[i].longhash = Config.lib.maskData(x.ip);});
		ctx.state.META.keywords = '/'+ctx.state.board.board+'/';
		ctx.state.META.desc = data[0].markdown.substring(128);
		ctx.state.META.title = '/'+ctx.state.board.board+'/ - '+(data[0].subject || data[0].markdown.substring(0,24));
		ctx.state.page = {type:(data[0].archived===null?'thread':'archived_thread'),param:ctx.params.page};
		ctx.render('threads',{data});
	} catch(err){
		// If post is not a thread OP, check if post exists at all and redirect accordingly
		try{
			let post = await db.one(Config.sql.view.post,{
				board:ctx.params.board,
				post:parseInt(ctx.params.page,10)
			});
			ctx.redirect('/'+post.board+'/'+post.thread+'#_'+post.post);
		}catch(e){
			// Post doesn't exist at all
			throw e.setloc('thread view');
		}
	}
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
_.spoilerMedia.auth = function(ctx){
	if(!ctx.state.user.auth('post.media.spoiler'))
		throw '';
};

_.deleteMedia = async function(ctx,next) {
	// if(!CSRF(ctx,next)) return;
	// TODO
	
};
_.deleteMedia.auth = function(ctx){
	if(!ctx.state.user.auth('post.media.delete'))
		throw '';
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
_.ban.auth = function(ctx) {
	if(!ctx.state.user.auth('post.ban'))
		throw 'Unauthorized for: thread.post.ban';
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
_.delete.auth = function(ctx){
	if(!ctx.state.user.auth('post.delete'))
		throw '';
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
_.bnd.auth = function(ctx){
	if(!ctx.state.user.auth(['thread.post.ban','thread.post.delete']))
		throw 403;
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
	ctx.state.managepages = ctx.state.user.auth('board.manage.pages');
	if (ctx.params.page != 'pages'){
		try {
			let data = await db.one(Config.sql.view.page, {
				board: ctx.params.board,
				page: ctx.params.page
			});
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
	if (ctx.params.action){
		let data = await db.one(Config.sql.view.page,{
			board: ctx.params.board,
			page: ctx.params.action
		});
		ctx.state.page = {type:'manage',param:'editpage'};
		ctx.state.flags = Config.flags;
		ctx.state.editmode = true;
		ctx.render('editPage',{data});
	} else {
		ctx.state.page = {type:'manage',param:'newpage'};
		ctx.state.flags = Config.flags;
		ctx.render('editPage');
	}
};

_.editPage.auth = function(ctx){
	if (!ctx.state.user.auth('board.manage.pages'))
		throw '';
};

_.settings = async function(ctx,next) {
	let data = await db.one(Config.sql.view.board_settings,{board:ctx.params.board});
	data.tags = data.tags.join(',');
	ctx.state.editmode = true;
	ctx.state.page = {type:'manage',param:'settings'};
	ctx.render('editBoard',{
		data,
		info_auth: !ctx.state.user.auth('board.settings.info'),
		limit_auth: !ctx.state.user.auth('board.settings.limits'),
		flag_auth: !ctx.state.user.auth('board.settings.flags'),
		header_auth: !ctx.state.user.auth('board.settings.header'),
		lifespan_auth: !ctx.state.user.auth('board.settings.archive_lifespan')
	});
};
_.settings.auth = function(ctx){
	if(!ctx.state.user.auth('board.settings'))
		throw '';
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
		out[out.length-1].users.push({username:item.username,screenname:item.screenname,id:item.id});
	});
	ctx.state.manageroles = ctx.state.user.auth('board.manage.roles.edit');
	ctx.state.manageusers = ctx.state.user.auth('board.manage.roles.manage');
	ctx.state.page = {type:'index',param:'roles'};
	ctx.render('roles',{data:out});
};
_.roles.auth = function(ctx){
	if(!ctx.state.user.auth('board.manage.roles!any'))
		throw '';
};

_.editRole = async function(ctx,next){
	if (ctx.params.action){
		let data = await db.one(Config.sql.view.role,{
			board: ctx.params.board,
			role: ctx.params.action
		});
		ctx.state.page = {type:'manage',param:'editrole'};
		ctx.state.flags = Config.flags;
		ctx.state.editmode = true;
		ctx.render('editRole',{data});
	} else {
		ctx.state.page = {type:'manage',param:'newrole'};
		ctx.state.flags = Config.flags;
		ctx.render('editRole');
	}
};
_.editRole.reg = true;
_.editRole.auth = function(ctx){
	if (!ctx.state.user.auth('board.manage.roles.edit'))
		throw '';
	if (ctx.params.action == 'owner')
		throw 'Cannot edit the Owner role.';
};

handlers.GET = _;
// prevent custom pages (only via GET method) from path names already is use by app
const reservedPages = Object.keys(_);
reservedPages.push('media');
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
	post.hash = Config.lib.maskData(ctx.IP,ctx.params.board);
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
	post.hash = Config.lib.maskData(ctx.IP,ctx.params.board);
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

// ------------- Modify custom board pages -------------------

_.editPage = async function(ctx,next){
	ctx.checkCSRF();
	ctx.state.editmode = !!ctx.params.action;
	let err;
	if (!ctx.params.action&&!ctx.request.body.page)
		err = new Error("No page was specified.");
	else if (!pageRegex.test(ctx.params.action||ctx.request.body.page))
		err = new Error("Invalid page name. Must only contain letters and numbers and cannot be only numbers.");
	else if ((ctx.params.action || ctx.request.body.page).length > 16)
		err = new Error("Page name is too long. Must be no more than 16 characters.");
	else if (ctx.request.body.title.length > 32)
		err = new Error("Page title is too long. Must be no more than 32 characters.");
	else if (ctx.request.body.markdown.length > 4096)
		err = new Error("Markdown content is too long. Must be no more than 4096 characters.");
	else if (~reservedPages.indexOf(ctx.params.action||ctx.request.body.page))
		err = new Error("Page name conflicts with a reserved page. Please choose a different name.");
		
	if (ctx.params.action) ctx.request.body.page = ctx.params.action;
	if (err) throw err.withrender('editPage').setdata(ctx.request.body);
	
	let markup = Lib.processMarkup(ctx.request.body.markdown);
	if (ctx.query.preview){
		ctx.render('editPage',{data:ctx.request.body,previewMarkup:markup});
		return;
	}
	
	let t = {};
	t.board = ctx.params.board;
	t.title = ctx.request.body.title;
	t.markdown = Config.pgp.as.text(ctx.request.body.markdown);
	t.markup = Config.pgp.as.text(markup);
	
	if (ctx.params.action) {
		t.page = ctx.params.action;
		await db.none(Config.sql.modify.old_page,t);
		ctx.redirect('/'+ctx.params.board+'/'+ctx.params.action);
	} else {
		t.page = ctx.request.body.page;
		await db.none(Config.sql.modify.new_page,t);
		ctx.redirect('/'+ctx.params.board+'/'+ctx.request.body.page);
	}
	
};
_.editPage.auth = function(ctx){
	if (!ctx.state.user.auth('board.manage.pages'))
		throw '';
};

_.deletePage = async function(ctx,next){
	ctx.checkCSRF();
	let err;
	if (ctx.params.action != ctx.request.body.verify)
		err = new Error("Verification field does not match.");
	
	if (err) throw err;
	
	await db.none(Config.sql.modify.delete_page,{
		board:ctx.params.board,
		page:ctx.params.action
	});
	ctx.redirect('/'+ctx.params.board+'/pages');
};
_.deletePage.auth = function(ctx){
	if (!ctx.params.action)
		throw 'Must specify a page to delete.';
	if (!ctx.state.user.auth('baord.manage.pages'))
		throw '';
};

// ----------------- Modify board settings -------------------

_.settings = async function(ctx,next) {
	ctx.checkCSRF();
	let err;
	ctx.request.body.tags = ctx.request.body.tags.replace(/(?:^,|,$)/g,'');
	ctx.state.editmode = true;
	if (ctx.request.body.title.length == 0)
		err = new Error('Board title is empty. Must provide a title for the board.');
	else if (ctx.request.body.tags.replace(/,/g,'').length > 0 && !(/^[a-zA-Z0-9_]+(?:,[a-zA-Z0-9_]+)*$/.test(ctx.request.body.tags)))
		err = new Error('A tag with invalid characters was submitted.');
	else if (ctx.request.body.tags.split(',').length > 8)
		err = new Error('Too many tags were submitted. Boards can have no more than 8 tags.');
	else if (ctx.request.body.title.length > 32)
		err = new Error('Board title is too long. Must be 32 characters or less.');
	else if (ctx.request.body.noname.length > 32)
		err = new Error('Default anonymous name is too long. Must be 32 characters or less.');
	else if (ctx.request.body.subtitle.length > 128)
		err = new Error('Board subtitle is too long. Must be 128 characters or less.');
	else if (ctx.request.body.ticker.length > 256)
		err = new Error('Board information header is too long. Must be 256 characters or less.');
	
	if (err) throw err.withrender('editBoard').setdata(ctx.request.body);
	else {
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
			throw Lib.mkerr('editBoard',err).withrender('editBoard').setdata(ctx.request.body);
			// TODO: recache the board list and data?
		}
	}
};
_.settings.auth = handlers.GET.settings.auth;

// -------------- Modify board roles and users ------------------

_.editRole = async function(ctx,next){
	ctx.checkCSRF();
	ctx.state.editmode = !!ctx.params.action;
	let err;
	if (!ctx.params.action&&!ctx.request.body.role)
		err = new Error("No role was specified.");
	else if (!roleRegex.test(ctx.params.action||ctx.request.body.role))
		err = new Error("Invalid role name. Verify no special characters are present.");
	else if (('capcode' in ctx.request.body) && !/^[^#].{3,}/.test(ctx.request.body.capcode))
		err = new Error("Invalid capcode. Verify it has at least 4 characters and doesn't start with a \#.");
	else if ((ctx.params.action || ctx.request.body.role).length > 16)
		err = new Error("Role name is too long. Must be no more than 16 characters.");
	else if (ctx.request.body.capcode.length > 32)
		err = new Error("Role capcode is too long. Must be no more than 32 characters.");
	// normalize flags firstly
	const nflags = {};
	let cflags = Lib.flattenFlags(Config.flags);
	for (let flag in cflags) {
		if (flag in ctx.request.body) {
			if (ctx.request.body[flag].toLowerCase() == 'yes') nflags[flag] = true;
			if (ctx.request.body[flag].toLowerCase() == 'no') nflags[flag] = false;
		}
	}
	if (err) {
		ctx.state.flags = Config.flags;
		throw err.setstatus(400).withrender('editRole').setdata({
			role:ctx.params.role||ctx.request.body.role,
			capcode:ctx.request.body.capcode,
			flags:nflags
		});
	}
	else {
		let t = {};
		t.board = ctx.params.board;
		t.flags = pgp.as.json(nflags);
		t.capcode = ctx.request.body.capcode;
		
		try {
			if (ctx.params.action){
				t.role = ctx.params.action;
				await db.none(Config.sql.modify.old_role, t);
			} else {
				t.role = ctx.request.body.role.toLowerCase();
				await db.none(Config.sql.modify.new_role, t);
			}
			ctx.redirect('/'+t.board+'/roles/');
		} catch(err){
			ctx.state.flags = Config.flags;
			throw Lib.mkerr('editRole',err).withrender('editRole').setdata({
				role:ctx.params.action||ctx.request.body.role,
				capcode:ctx.request.body.capcode,
				flags:nflags
			});
		}
	}
};
_.editRole.auth = handlers.GET.editRole.auth;

_.deleteRole = async function(ctx,next){
	ctx.checkCSRF();
	let err;
	if (ctx.params.action != ctx.request.body.verify)
		err = new Error('Role name verification failed. Double check your spelling.');
		
	if (err) throw err;
	
	await db.none(Config.sql.modify.delete_role,{
		board: ctx.params.board,
		role: ctx.params.action
	});
	ctx.redirect('/'+ctx.params.board+'/roles');
	
};
_.deleteRole.auth = function(ctx){
	if (!ctx.params.action)
		throw 'Must specify a role to delete.';
	if (ctx.params.action == ctx.state.user.roles[ctx.params.board].role)
		throw 'Cannot delete the role you belong to.';
	if (ctx.params.action == 'owner')
		throw 'Cannot delete the owner role.';
	if (!ctx.state.user.auth(['board.manage.roles.edit','board.manage.roles.manage']))
		throw '';
};

_.addToRole = async function(ctx,next){
	ctx.checkCSRF();
	let err;
	if (ctx.request.body.username == ctx.state.user.username)
		err = (new Error('Cannot add yourself to a role.')).setstatus(403);
	
	if (err) throw err;
	
	await db.none(Config.sql.modify.add_to_role,{
		board: ctx.params.board,
		role: ctx.params.action,
		username: ctx.request.body.username
	});
	ctx.redirect('/'+ctx.params.board+'/roles');
};
_.addToRole.auth = function(ctx){
	if (!ctx.state.user.auth('board.manage.roles.manage'))
		throw '';
	if (!ctx.params.action)
		throw 'Must specify a role to add to.';
	if (ctx.params.action == 'owner' && ctx.state.user.roles[ctx.params.board].role != 'owner')
		throw 'Only the board owner(s) can promote a user to the OWNER role.';
};

_.removeFromRole = async function(ctx,next){
	ctx.checkCSRF();
	let err;
	if (ctx.request.body.username == ctx.state.user.username)
		err = (new Error('Cannot remove yourself from a role.')).setstatus(403);
		
	if (err) throw err;
	
	await db.none(Config.sql.modify.remove_from_role,{
		board: ctx.params.board,
		username: ctx.request.body.username
	});
	ctx.redirect('/'+ctx.params.board+'/roles');
	
};
_.removeFromRole.auth = function(ctx){
	if (!ctx.state.user.auth('board.manage.roles.manage'))
		throw '';
	if (!ctx.params.action)
		throw 'Must specify a role to remove from.';
	if (ctx.params.action == 'owner' && ctx.state.user.roles[ctx.params.board].role != 'owner')
		throw 'Only the board owner(s) can demote a user from the OWNER role.';
};

handlers.POST = _;


module.exports = handlers;
// export {handlers as default};
