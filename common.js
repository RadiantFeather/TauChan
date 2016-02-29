var pgp = require('pg-promise')({ promiseLib: require('bluebird') }),
	multer = require('multer'),
	cache = require('redis'),
	tpl = require('jade'),
	request = require('request');
// var socket = require('socekt.io');
var _ = {};

_.loadBoard = function(req,res,next){
	return next();
};

_.loadUser = function(req,res,next){
	res.locals.user = {auth:()=>true};
	return next();
};

module.exports = _;