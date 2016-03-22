"use strict";
var fs = require('fs'),
	// multer = require('multer'),
	// request = require('request'),
	// socket = require('socekt.io'),
	// cache = require('redis'),
	// tpl = require('jade'),
	yml = {read: require('read-yaml'), write: require('write-yaml')},
	pgp = require('pg-promise')({ promiseLib: require('bluebird') }),
	db = pgp(GLOBAL.cfg.database),
	handlers = {},
	_ = {};

/*
 *	GET request handlers
 */

_.index = function(req,res,next){	// moderation front page
	res.send('Moderation front page');
	if (!res.locals.user.auth(req)) return res.sendStatus(403);
	
};

_.bans = function(req,res,next){
	res.send('Preset Global Page: '+ req.params.board +'/'+ req.params.page);
	if (!res.locals.user.auth(req,res)) return res.sendStatus(403);
};

_.banned = function(req,res,next){
	res.send('Preset Global Page: '+ req.params.board +'/'+ req.params.page);
};

_.logs = function(req,res,next){
	res.send('Preset Global Page: '+ req.params.board +'/'+ req.params.page);
};

_.reports = function(req,res,next){
	res.send('Preset Global Page: '+ req.params.board +'/'+ req.params.page);
};

handlers.GET = _;
_ = {};

/*
 *	POST request handlers
 */

handlers.POST = _;

module.exports = handlers;