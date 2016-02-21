console.log('Loading server...');
var express = require('express');
var app = express();

var global = require('./global')
var boards = require('./boards');
// var lib = require('./lib/common');

// app.use(lib.loadBoard);
// app.use(lib.loadUser);

app.all('/:board/:page/:action?/:data?',function(req,res){
	console.log(req.params.board,req.params.page,req.method);
	if (req.params.board == '_') {
		if (global[req.method] && global[req.method][req.params.page]) global.get[req.params.page](req,res);
		else res.sendStatus(404);
	} else {
		if (boards[req.method] && boards[req.method][req.params.page]) boards[req.method][req.params.page](req,res);
		else if (boards[req.method] && boards[req.method][0] && /^\d+$/.test(req.params.page)) boards[req.method][0](req,res);
		else if (boards[req.method] && boards[req.method].pages) boards[req.method].pages(req,res); // Run as a custom board page
		else res.sendStatus(404);
	}
});


app.all('/:board',function(req,res){
	if (req.params.board == '_' && global[req.method] && global[req.method].index) global[req.method].index(req,res);
	else if (boards[req.method] && boards[req.method].index) boards[req.method].index(req,res);
	else res.sendStatus(404);
});

app.get('/', function (req, res) {
  res.send('Overboard page.');
});

app.listen(3000, function () {
  console.log('Listening on port 3000!');
});