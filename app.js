"use strict";
String.prototype.splice = function(i,c,a){
	return this.slice(0,i)+(add||'')+this.slice(index+count);
};
var fs = require('fs');
var _exists = function(path){
	try {
		fs.statSync(path);
		return true;
	} catch (e) { return false; }
};
if (!_exists('./conf/installed')) return console.log('App has not been installed yet. Please run the /install/app.js script to setup the application.');
if (!_exists('./conf/config.yml')) return console.log('Missing config file. Please run the /install/app.js script to setup the config file.');
console.log('Loading server...');
var express = require('express'),
	cookie = require('cookie'),
	cookieParser = require('cookie-parser'),
	session = require('express-session'),
	yml = {read: require('read-yaml'), write: require('write-yaml')};

// Configuations
GLOBAL.sql = yml.read.sync('./sql.yml');
GLOBAL.cfg = yml.read.sync('./conf/config.yml');

// Common functions
GLOBAL.lib = require('./lib');

let flags = {};
GLOBAL.register_flag = function(cat,flag){
	if (!flags[cat]) flags[cat] = [];
	flags.forEach((item)=>{flags[cat].push(flag)});
};

// Page request handlers
var global = require('./global'),
	boards = require('./boards'),
	middle = require('./middleware');
	
var app = express();
app.locals.flags = flags;

app.use((req,res,next)=>{
	req.now = Date.now();
	if (GLOBAL.cfg.site.devmode) {
		GLOBAL.cfg = yml.read.sync('./conf/config.yml');
		GLOBAL.sql = yml.read.sync('./sql.yml');
	}
	if (GLOBAL.cfg.values.cdn_domain.indexOf('://') == -1)
		res.locals.cdn = GLOBAL.cfg.values.cdn_domain?'http'+(res.secure?'s://':'://')+GLOBAL.cfg.values.cdn_domain:'';
	if (res.locals.cdn == 'localhost') res.locals.cdn = '';
	return next();
});
// app.use(cookieParser());
// app.use(function(req,res,next) {
	// req.cookie = (key,val,options)=>{
		// options = options || {};
		// if (val == null) {
			// val = '';
			// options.maxAge = 0;
		// } else val = val.toString();
		// res.setHeader('Set-Cookie',cookie.serialize(key,val,options));
		// return req;
	// };
	// return next();
// });
app.use(session({
	secret: GLOBAL.cfg.site.secret,
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
app.use(middle.loadUser);

app.all('/_/:page/:action?/:data?',middle.loadGlobal,(req,res,next)=>{
	if (global[req.method] && global[req.method][req.params.page]) // global preset page
		global.get[req.params.page](req,res,next);
	else {
		res.status(404);
		return next(new Error('Page not found'));
	}
});
if (!GLOBAL.cfg.values.cdn_domain) {
app.get('/:board/media/:file*',(req,res,next)=>{ // fileserve 
	let options = {
		root: __dirname +'/assets/'+ req.params.board +'/media/',
		dotfiles: 'deny',
		headers: {
			'x-timestamp': Date.now(),
			'x-sent': true
		}
	};
	res.sendFile(req.params.file, options, function (err) {
		if (err) {
		  console.log(err);
		  res.status(err.status).end();
		}
	});
});
}

app.get('/favicon.ico',(req,res,next)=>{
	let options = {
		root: __dirname,
		dotfiles: 'deny',
		headers: {
			'x-timestamp': Date.now(),
			'x-sent': true
		}
	};
	res.sendFile('favicon.ico',options, function (err) {
		if (err){
			res.status(err.status).end();
		}
	});
});

app.all('/:board/:page/:action?/:data?',middle.loadBoard,(req,res,next)=>{
	if (boards[req.method] && boards[req.method][req.params.page] && req.params.page != 'thread') 
		boards[req.method][req.params.page](req,res,next);
	else if (boards[req.method] && boards[req.method].thread && /^\d+$/.test(req.params.page)) boards[req.method].thread(req,res,next);
	else if (boards[req.method] && boards[req.method].pages) boards[req.method].pages(req,res,next); // Run as a custom board page
	else {
		res.status(404);
		return next(new Error('Page not found'));
	}
});

app.all('/_',middle.loadGlobal,(req,res,next)=>{
	if (global[req.method] && global[req.method].index)
		global[req.method].index(req,res,next);
	else {
		res.status(404);
		return next(new Error('Page not found'));
	}
});
app.all('/:board',middle.loadBoard,(req,res,next)=>{
	if (boards[req.method] && boards[req.method].index) boards[req.method].index(req,res,next);
	else {
		res.status(404);
		return next(new Error('Page not found'));
	}
});

app.get('/',(req,res,next)=>{
	res.send('Overboard page.');
});

app.use(middle.handleAjaxError);
app.use(middle.handleError);

app.listen(GLOBAL.cfg.port,()=>{
  console.log('Now listening on port '+GLOBAL.cfg.port+'.');
});
