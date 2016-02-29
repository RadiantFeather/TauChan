var pgp = require('pg-promise')({ promiseLib: require('bluebird') }),
	multer = require('multer'),
	fs = require('fs'),
	request = require('request'),
	multer = require('multer'),
	cache = require('redis'),
	yml = {read: require('read-yaml'), write: require('write-yaml')},
	tpl = require('jade');
// var socket = require('socekt.io');

var handlers = {},_ = {};

/*
 *	GET request handlers
 */

_.index = function(req,res) { 	// board index
	res.send('Index: '+ req.params.board);
};

_[0] = function(req,res) {	// thread view
	//res.send('Thread: '+ req.params.board +'/'+ req.params.page);
	db.any(
		'SELECT x.* '+
			'FROM ('+
				'SELECT p.*, t.pinned, t.sticky, t.anchor, t.cycle, t.locked, t.bumped, t.sage, '+
				'(p.post = t.op) AS is_op, cl.local AS local_clean, cl.global AS global_clean, '+
				'fetch_cites(p.board,p.thread,p.post) AS targets, c.targets AS cites, '+
				'fetch_media(p.board,p.post) AS media'+
				'FROM posts p, threads t , clean cl, _'+
				'WHERE p.board = ${board} AND t.board = p.board AND p.thread = ${thread} AND t.op = p.thread'+
				'AND cl.board = p.board AND cl.post = p.post'+
				'ORDER BY (p.post = t.op) DESC p.posted DESC'+
				'LIMIT ${limit} + 1'+
			') x'+
			'ORDER BY x.is_op DESC x.posted ASC', {
		board: req.params.board, 
		thread: req.params.thread, 
		limit: req.query.preview?req.query.preview:null
	}).then(function(data) {
		res.send(data);
	}).catch(function(err) {
		res.send(err)
	});
};

_.pages = function(req,res) { // custom board pages
	res.send('Custom Page: '+ req.params.board +'/'+ req.params.page);
};

_.bans = function(req,res) {
	res.send('Preset Page: '+ req.params.board +'/'+ req.params.page);
};

_.banned = function(req,res) {
	res.send('Preset Page: '+ req.params.board +'/'+ req.params.page);
};

_.catalog = function(req,res) {
	res.send('Preset Page: '+ req.params.board +'/'+ req.params.page);
};

_.logs = function(req,res) {
	res.send('Preset Page: '+ req.params.board +'/'+ req.params.page);
};

_.reports = function(req,res) {
	res.send('Preset Page: '+ req.params.board +'/'+ req.params.page);
};

_.settings = function(req,res) {
	res.send('Preset Page: '+ req.params.board +'/'+ req.params.page);
};

handlers.GET = _;
_ = {};

/*
 *	POST request handlers
 */

_.index = _.catalog = function(req,res) { // New thread
	
};

_[0] = function(req,res) { // New reply to thread
	
};

_.pages = function(req,res) { // Manage custom board pages
	
};

_.settings = function(req,res) {
	
};

handlers.POST = _;

module.exports = handlers;
