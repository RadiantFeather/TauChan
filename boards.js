var db = require('pg-promise');
var multer = require('multer');
var cache = require('redis');
var tpl = require('jade');
var request = require('request');
// var socket = require('socekt.io');

var handlers = {},_ = {};

/*
 *	GET request handlers
 */

_.index = function(req,res) { 	// board index
	res.send('Index: '+ req.params.board);
};

_[0] = function(req,res) {	// thread view
	res.send('Thread: '+ req.params.board +'/'+ req.params.page);
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
