"use strict";
var pgp = require('pg-promise')({ promiseLib: require('bluebird') }),
	multer = require('multer'),
	deasync = require('deasync'),
	cache = require('redis'),
	tpl = require('jade'),
	request = require('request'),
	yml = {read: require('read-yaml'), write: require('write-yaml')},
	db = pgp(req.app.locals.cfg.database);
// var socket = require('socekt.io');
var _ = {};

_.loadBoard = function(req,res){
	let done = false;
	db.one('SELECT * FROM boards WHERE board = ${board};', {
		board: req.params.board
	}).then((data) => {
		done = true;
		req.app.locals.board = data;
	}).catch((err) => {
		done = null;
		res.status(404).send(err);
	});
	while (done === false) deasync.runLoopOnce();
	return (done === null ? false : true);
};

_.loadUser = function(req,res,next){
	res.locals.user = {auth:()=>true};
	return next();
};


module.exports = _;