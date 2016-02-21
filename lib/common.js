var db = require('pg-promise');
var multer = require('multer');
var cache = require('redis');
var tpl = require('jade');
var request = require('request');
// var socket = require('socekt.io');
var _ = {}

_.loadBoard = function(req,res,next){
	next();
};

_.loadUsers = function(req,res,next){
	next();
};

module.exports = _;