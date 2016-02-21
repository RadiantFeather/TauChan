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

_.index = function(req,res){		// moderation front page
	res.send('Moderation front page');
};

_.bans = function(req,res){
	res.send('Preset Global Page: '+ req.params.board +'/'+ req.params.page);
};

_.banned = function(req,res){
	res.send('Preset Global Page: '+ req.params.board +'/'+ req.params.page);
};

_.logs = function(req,res){
	res.send('Preset Global Page: '+ req.params.board +'/'+ req.params.page);
};

_.reports = function(req,res){
	res.send('Preset Global Page: '+ req.params.board +'/'+ req.params.page);
};

handlers.GET = _;
_ = {};

/*
 *	POST request handlers
 */

handlers.POST = _;

module.exports = handlers;