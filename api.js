"use strict";

//*/
const Router = require('koa-router');
const Redis = require('koa-redis');
const Crypto = require('crypto');
const Config = require('./config');
const Lib = require('./lib');
/*/ 
import Router from 'koa-router';
import Redis from 'koa-redis';
import Crypto from 'crypto';
import Config from './config';
import Lib from './lib';
//*/

	
const db = Config.db;
const handlers = {};
let _ = {};
let modified = {};

_.index = async function(ctx,next){ // list of threads (greater detail)
	
	
};

_.threads = async function(ctx,next){ // list of threads (lesser detail, preferred)
	// cache check with redis
	let data = await db.any(Config.sql.view.thread_list,{board:ctx.params.board});
	
	
};

_.catalog = async function(ctx,next){ // catalog specific details
	
};

_.thread = async function(ctx,next){ // specific thread details
	
	
};

_.pages = async function(ctx,next){
	if (ctx.params.page == 'pages'){ // list of pages
		let data = await db.any(Config.sql.view.pages,{board:ctx.params.board});
	} else { // specific page details
		let data = await db.oneOrNone(Config.sql.view.page,{board:ctx.params.board,page:ctx.params.page});
	}
};

handlers.board = _;

handlers.history = async function(ctx, next){
	
	
};

handlers.index = async function(ctx,next){ // list of public boards
	
	
};

module.exports = handlers;

// export router as default;