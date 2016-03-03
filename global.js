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

var handlers = {},_ = {},
	db = pgp(cfg.database);

/*
 *	GET request handlers
 */

_.index = function(req,res){		// moderation front page
	res.send('Moderation front page');
	if (!res.locals.user.auth(req)) return res.sendStatus(403);
	
};

_.bans = function(req,res){
	res.send('Preset Global Page: '+ req.params.board +'/'+ req.params.page);
	if (!res.locals.user.auth(req,res)) return res.sendStatus(403);
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
 
_.install = function(req,res){
	
};

handlers.POST = _;

module.exports = handlers;