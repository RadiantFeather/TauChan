"use strict";
const fs = require('fs');
require('./extend.js');
const _exists = function(path){
	try {
		fs.statSync(path);
		return true;
	} catch (e) { return false; }
};
if (!_exists('./conf/installed')) return console.log('App has not been installed yet. Please run the /install/app.js script to setup the application.');
if (!_exists('./conf/config.yml')) return console.log('Missing config file. Please run the /install/app.js script to setup the config file.');
console.log('Loading server...');
const express = require('express'),
	// cookie = require('cookie'),
	cookieParser = require('cookie-parser'),
	session = require('express-session'),
	yml = {read: require('read-yaml'), write: require('write-yaml')};

const pgpopts = {promiseLib: require('bluebird'), capSQL:true};


// Configuations
GLOBAL.cfg = yml.read.sync('./conf/config.yml');
GLOBAL.db = (GLOBAL.pgp = require('pg-promise')(pgpopts))(GLOBAL.cfg.database);
GLOBAL.sql = yml.read.sync('./sql.yml');
GLOBAL.flags = yml.read.sync('./flags.yml');
GLOBAL.errors = yml.read.sync('./errors.yml');

// var monitor = require('pg-monitor');
// monitor.attach(pgpopts);

if (GLOBAL.cfg.values.cdn_domain == 'localhost') GLOBAL.cdn = '';
else if (GLOBAL.cfg.values.cdn_domain.indexOf('://')<0)
	GLOBAL.cdn = GLOBAL.cfg.values.cdn_domain?'//'+GLOBAL.cfg.values.cdn_domain:'';

// Common functions
GLOBAL.lib = require('./lib');

// Content Security Policy setter function
let media_whitelist = {raw:[],embed:[]},om = GLOBAL.cfg.external_media;
for (let x in om) {
	if (!(om[x].regex instanceof RegExp)) om[x].regex = new RegExp(om[x].regex,'i');
	switch(om[x].type){
		case 'raw': media_whitelist.raw.concat(om[x].domains); break;
		case 'embed': media_whitelist.embed.concat(om[x].domains); break;
	}
}
const cspheadervalue = "default-src 'self';"+
	"script-src 'self' "+GLOBAL.cdn+";"+
	"style-src 'self' "+GLOBAL.cdn+";"+
	"img-src 'self' data: "+media_whitelist.raw.join(' ')+";"+
	"media-src 'self' "+media_whitelist.raw.join(' ')+";"+
	"connect-src 'self';"+
	"child-src 'self' "+media_whitelist.embed.join(' ')+";"
const CSPheader = (req,res,next)=>{res.set('Content-Security-Policy',cspheadervalue);if(next)return next();};

// Page request handlers
const global = require('./global'),
	boards = require('./boards'),
	middle = require('./middleware');

var app = express();

// override using the old jade engine
// uncomment only when pug has hit official release!
// app.engine('pug', require('pug').__express);

// Persistent locals for templates
app.locals.CDN = GLOBAL.cdn;
app.locals.SITE = GLOBAL.cfg.site;
app.locals.DEV = GLOBAL.cfg.devmode;
app.locals.F_POSTID = GLOBAL.lib.posterID;
app.locals.F_TOINTERVAL = GLOBAL.lib.toInterval;
app.locals.F_UTC = (timestamp,mode)=>{
	if (mode == 1) return (new Date(timestamp)).toUTCString();
	else if (mode == 2) return (new Date(timestamp)).toLocaleString();
	else return (new Date(timestamp)).toISOString();
};
app.locals.CLIENTDEPS = {
	'vQuery.js':'',
	'socket.io.js':'',
	'common.css':'',
	'icons.css':''
};
for (let i in app.locals.CLIENTDEPS){
	if (GLOBAL.cfg.external_sources && GLOBAL.cfg.external_sources[i])
		app.locals.CLIENTDEPS[i] = GLOBAL.cfg.external_sources[i];
	else app.locals.CLIENTDEPS[i] = GLOBAL.cdn+'/_/'+i;
}
var clientdepROOT = {
	'socket.io.js':'/node_modules/socket.io-client/'
}, requestCount = 0;

app.use(cookieParser());
app.use(session({
	secret: GLOBAL.cfg.secret,
	name: 'sid',
	saveUninitialized: false,
	resave: false,
	cookie: {
		path: '/',
		httpOnly: true,
		secure: false,
		maxAge: 1000*60*60*24*3
	}
})); // TODO: implement Redis into sessions

app.use((req,res,next)=>{
	if (req.method == 'GET') {
		let opts = {httpOnly:true};
		if (!req.cookies.curpage) res.cookie('lastpage', req.path, opts);
		else res.cookie('lastpage', req.cookies.curpage, opts);
		res.cookie('curpage', req.path, opts);
	}
	if (GLOBAL.cfg.devmode) {
		GLOBAL.cfg = yml.read.sync('./conf/config.yml');
		GLOBAL.sql = yml.read.sync('./sql.yml');
		GLOBAL.flags = yml.read.sync('./flags.yml');
	}
	res.locals.NOW = Date.now();
	res.locals.META = {};
	return next();
});

app.get('/:file.:ext',(req,res,next)=>{ // replace with nginx serve?
	res.cookie('curpage',req.cookies.lastpage,{httpOnly:true});
	let options = {
		root: __dirname,
		dotfiles: 'deny',
		headers: {
			'x-timestamp': res.locals.NOW,
			'x-sent': true
		}
	};
	if (req.params.ext == 'html' && !_exists('./'+req.params.file+'.'+req.params.ext)) {
		res.cookie('curpage',req.path,{httpOnly:true});		
		// view for custom global pages
		CSPheader(0,res);
		global.pages(req,res,next);
	} else if ((GLOBAL.cfg.root_whitelist||[]).indexOf(req.params.file+'.'+req.params.ext) > -1) {
		res.sendFile(req.params.file+'.'+req.params.ext,options, function (err) {
			if (err) res.sendStatus(err.status).end();
		});
	} else res.sendStatus(403).end();
});

app.get('/_/:file.:ext',(req,res,next)=>{ // replace with nginx serve?
	res.cookie('curpage',req.cookies.lastpage,{httpOnly:true});
	let f = req.params.file+'.'+req.params.ext, d = clientdepROOT,
		options = {
			root: __dirname +'/static/',
			dotfiles: 'deny',
			headers: {
				'x-timestamp': res.locals.NOW,
				'x-sent': true
			}
		};
	if (f in d)
		options.root = __dirname + d[f];
	res.sendFile(f, options, (err)=>{
		if (err) {
		  console.log('file error: ', f, err);
		  res.sendStatus(err.status).end();
		}
	});
});
if (!GLOBAL.cfg.values.cdn_domain || GLOBAL.cfg.values.cdn_domain == 'localhost') {
app.get('/:board/media/:file',(req,res,next)=>{ // board fileserve
	res.cookie('curpage',req.cookies.lastpage,{httpOnly:true});
	let options = {
		root: __dirname +'/assets/'+ req.params.board +'/media/',
		dotfiles: 'deny',
		headers: {
			'x-timestamp': res.locals.NOW,
			'x-sent': true
		}
	};
	res.sendFile(req.params.file, options, function (err) {
		if (err) {
		  console.log('file error: ', req.params.file, err);
		  res.status(err.status).end();
		}
	});
});
}

app.use((req,res,next)=>{
	console.log(
		"Requests made since boot: "+
		(++requestCount)+
		" - "+req.originalUrl+
		"; XHR: "+req.xhr+
		"; "+req.method+
		"; "+req.protocol+"; "
	);
	return next();
});

app.use('/_',middle.loadUser);
app.use('/:board',middle.loadUser);
app.use('/',middle.loadUser);
app.use(CSPheader);

app.all('/_/:page/:action?/:data?',middle.loadGlobal,(req,res,next)=>{
	let err;
	if (global[req.method] && global[req.method][req.params.page]) // global preset page
		if (global[req.method][req.params.page].reg && !res.locals.user.reg)
			res.redirect('/_/login');
		else if (global[req.method][req.params.page].auth)
			if ((err=global[req.method][req.params.page].auth(req,res,next))===true)
				global[req.method][req.params.page](req,res,next);
			else
				return next(err instanceof Error?err.setstatus(403):(new Error(err.messge||'Unauthorized')).setstatus(403));
		else global[req.method][req.params.page](req,res,next);
	else
		return next((new Error('Page not found')).setstatus(404).setloc('global page route'));
});

app.all('/:board/:page/:action?/:data?',middle.loadBoard,(req,res,next)=>{
	let err;
	if (boards[req.method] && boards[req.method][req.params.page] && req.params.page != 'thread')
		if (boards[req.method][req.params.page].reg && !res.locals.user.reg)
			res.redirect('/_/login');
		else if (boards[req.method][req.params.page].auth)
			if ((err=boards[req.method][req.params.page].auth(req,res,next))===true)
				boards[req.method][req.params.page](req,res,next);
			else
				return next(err instanceof Error?err.setstatus(403):(new Error(err.message||'Unauthorized')).setstatus(403));
		else boards[req.method][req.params.page](req,res,next);
	else if (boards[req.method] && boards[req.method].thread && /^\d+$/.test(req.params.page)) 
		boards[req.method].thread(req,res,next);
	else if (req.method == 'GET' && boards[req.method] && boards[req.method].pages) 
		boards[req.method].pages(req,res,next); // Run as a custom board page
	else
		return next((new Error('Page not found')).setstatus(404).setloc('board page route'));
});

app.all('/_',middle.loadGlobal,(req,res,next)=>{
	if (global[req.method] && global[req.method].index)
		global[req.method].index(req,res,next);
	else
		return next((new Error('Page not found')).setstatus(404).setloc('underboard route'));
});
app.all('/:board',middle.loadBoard,(req,res,next)=>{
	if (boards[req.method] && boards[req.method].index) 
		boards[req.method].index(req,res,next);
	else
		return next((new Error('Page not found')).setstatus(404).setloc('board route'));
});

app.get('/',(req,res,next)=>{
	if (global.index)
		global.index(req,res,next);
	else
		return next((new Error('Page not found')).setstatus(404).setloc('overboard route'));
});

app.use(middle.handleAjaxError,middle.handleError);

app.listen(GLOBAL.cfg.port,()=>{
  console.log('Now listening on port '+GLOBAL.cfg.port+'.');
});
