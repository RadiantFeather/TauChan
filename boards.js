"use strict";
var pgp = require('pg-promise')({ promiseLib: require('bluebird') }),
	multer = require('multer'),
	fs = require('fs'),
	request = require('request'),
	multer = require('multer'),
	cache = require('redis'),
	tpl = require('jade'),
	yml = {read: require('read-yaml'), write: require('write-yaml')},
	cfg = yml.read.sync('./conf/config.yml');
// var socket = require('socekt.io');

var handlers = {},_ = {},
	db = pgp(cfg.database);

/*
 *	GET request handlers
 */

_.index = function(req,res) { 	// board index
	// res.send('Index: '+ req.params.board);
	db.any(req.app.locals.sql.view.board_index, {
		board: req.params.board,
		page: req.query.page?parseInt(req.query.page):0
	}).then(function(data) {
		res.send(data);
	}).catch(function(err) {
		console.log(err);
		res.send(err);
	});
};

_.thread = function(req,res) {	// thread view
	// res.send('Thread: '+ req.params.board +'/'+ req.params.page);
	db.any(req.app.locals.sql.view.thread, {
		board: req.params.board,
		thread: parseInt(req.params.page),
		limit: req.query.preview?parseInt(req.query.preview):null
	}).then(function(data) {
		res.send(data);
	}).catch(function(err) {
		console.log(err);
		res.send(err);
	});
};

_.catalog = function(req,res) {
	// res.send('Preset Page: '+ req.params.board +'/'+ req.params.page);
	db.any(req.app.locals.sql.view.catalog, {
		board: req.params.board,
		limit: req.app.locals.board.threadlimit
	}).then(function(data) {
		res.send(data);
	}).catch(function(err) {
		console.log(err);
		res.send(err);
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
