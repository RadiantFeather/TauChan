var fs = require('fs');

if (!fs.existsSync('./install/done')) return console.log('App has not been installed yet. Please run the /install/run.js script to setup the application.');
console.log('Loading server...');
var express = require('express'),
	cparser = require('cookie-parser'),
	yaml = {read: require('read-yaml'), write: require('write-yaml')},
	global = require('./global'),
	boards = require('./boards'),
	lib = require('./lib/common');

	
if (fs.existsSync('./config.yml')) cfg = yaml.read.sync('./config.yml');
else cfg = {};

app = express();
app.use(cparser());
app.use(lib.loadBoard);
app.use(lib.loadUser);

app.all('/:board/:page/:action?/:data?',function(req,res){
	if (req.params.board == '_') {
		if (global[req.method] && global[req.method][req.params.page]) // global preset page
			if (res.locals.user.auth(req))
				global.get[req.params.page](req,res);
			else res.sendStatus(403);
		else res.sendStatus(404);
	} else {
		if (boards[req.method] && boards[req.method][req.params.page]) 
			boards[req.method][req.params.page](req,res);
		else if (boards[req.method] && boards[req.method][0] && /^\d+$/.test(req.params.page)) boards[req.method][0](req,res);
		else if (boards[req.method] && boards[req.method].pages) boards[req.method].pages(req,res); // Run as a custom board page
		else res.sendStatus(404);
	}
});


app.all('/:board',function(req,res){
	if (req.params.board == '_' && global[req.method] && global[req.method].index) 
		if (res.locals.user.auth(req,res))
			global[req.method].index(req,res);
		else res.sendStatus(403);
	else if (boards[req.method] && boards[req.method].index) boards[req.method].index(req,res);
	else res.sendStatus(404);
});

app.get('/', function (req, res) {
  res.send('Overboard page.');
});

app.listen(3000, function () {
  console.log('Listening on port 3000!');
});
