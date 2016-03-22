"use strict";
var fs = require('fs');

if (!fs.existsSync('./conf/installed')) return console.log('App has not been installed yet. Please run the /install/app.js script to setup the application.');
if (!fs.existsSync('./conf/config.yml')) return console.log('Missing config file. Please run the /install/app.js script to setup the config file.');
console.log('Loading server...');
var express = require('express'),
	cparser = require('cookie-parser'),
	yml = {read: require('read-yaml'), write: require('write-yaml')};

// Configuations
GLOBAL.sql = yml.read.sync('./sql.yml');
GLOBAL.cfg = yml.read.sync('./conf/config.yml');

// Common functions
GLOBAL.lib = require('./lib');

// Custom handlers
var global = require('./global'),
	boards = require('./boards'),
	middle = require('./middleware');
	
var app = express();

app.use((req,res,next)=>{
	req.now = Date.now();
	if (GLOBAL.cfg.site.devmode) {
		GLOBAL.cfg = yml.read.sync('./conf/config.yml');
		GLOBAL.sql = yml.read.sync('./sql.yml');
	}
	res.locals.cdn = GLOBAL.cfg.values.cdn_domain?'http'+(res.secure?'s://':'://')+GLOBAL.cfg.values.cdn_domain:'';
	return next();
});
app.use(cparser());
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
app.get('/:board/files/:file',(req,res,next)=>{ // fileserve 
	var options = {
		root: __dirname +'/assets/'+ req.params.board +'/files/',
		dotfiles: 'deny',
		headers: {
			'x-timestamp': Date.now(),
			'x-sent': true
		}
	};
	res.sendFile(req.params.name, options, function (err) {
		if (err) {
		  console.log(err);
		  res.status(err.status).end();
		}
	});
});
}

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
	if (req.params.board == '_' && global[req.method] && global[req.method].index)
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
