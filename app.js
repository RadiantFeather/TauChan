"use strict";
var fs = require('fs');

if (!fs.existsSync('./conf/installed')) return console.log('App has not been installed yet. Please run the /install/app.js script to setup the application.');
if (!fs.existsSync('./conf/config.yml')) return console.log('Missing config file. Please run the /install/app.js script to setup the config file.');
console.log('Loading server...');
var express = require('express'),
	cparser = require('cookie-parser'),
	yml = {read: require('read-yaml'), write: require('write-yaml')},
	global = require('./global'),
	boards = require('./boards'),
	lib = require('./common'),


app = express();
app.locals.sql = yml.read.sync('./sql.yml');
app.locals.cfg = yml.read.sync('./conf/config.yml');
app.use((req,res,next)=>{
	if (NODE_ENV == 'development' || req.app.locals.cfg.site.devmode) {
		app.locals.cfg = yml.read.sync('./conf/config.yml');
		app.locals.sql = yml.read.sync('./sql.yml');
	}
	return next();
});
app.use(cparser());
app.use(lib.loadUser);

app.all('/:board/:page/:action?/:data?',function(req,res){
	if (!lib.loadBoard(req,res)) return res.status(404).render('error.jade');
	if (req.params.board == '_') {
		if (global[req.method] && global[req.method][req.params.page]) // global preset page
			global.get[req.params.page](req,res);
		else res.sendStatus(404);
	} else {
		if (boards[req.method] && boards[req.method][req.params.page] && req.params.page != 'thread') 
			boards[req.method][req.params.page](req,res);
		else if (boards[req.method] && boards[req.method].thread && /^\d+$/.test(req.params.page)) boards[req.method].thread(req,res);
		else if (boards[req.method] && boards[req.method].pages) boards[req.method].pages(req,res); // Run as a custom board page
		else res.sendStatus(404);
	}
});


app.all('/:board',function(req,res){
	if (!lib.loadBoard(req,res)) return res.status(404).render('error.jade');
	if (req.params.board == '_' && global[req.method] && global[req.method].index)
		global[req.method].index(req,res);
	else if (boards[req.method] && boards[req.method].index) boards[req.method].index(req,res);
	else res.sendStatus(404);
});

app.get('/', function (req, res) {
  res.send('Overboard page.');
});

app.listen(3000, function () {
  console.log('Now listening on port 3000.');
});
