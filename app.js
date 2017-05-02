
const fs = require('fs');
// import {FS as fs} from 'fs';
const noop = ()=>{};
const _exists = function(path){
	try {
		fs.statSync(path);
		return true;
	} catch (e) { return false; }
};
if (!_exists('./conf/installed')) return console.log('App has not been installed yet. Please run the /install/app.js script to setup the application.');
if (!_exists('./conf/config.yml')) return console.log('Missing config file. Please run the /install/app.js script to setup the config file.');
console.log('Loading server...');
require('./extend');


//*/

// imports
const Koa = require('koa');
const Session = require('koa-session2');
//const Convert = require('koa-convert');
const CSRF = require('koa-csrf').default;
const Pug = require('koa-pug');
const Redis = require('koa-redis');
const FileSend = require('koa-send');
const UserAgent = require('koa-useragent');
const BodyParser = require('koa-bodyparser');
const Router = require('koa-router');
const DetectAjax = require('koa-isajax');

const Config = require('./config');
const Lib = require('./lib');
Config.lib = Lib;

/*/ 

// imports for when the feature is supported in node.
import Koa from 'koa';
import Session from 'koa-session2';
//import Convert from 'koa-convert';
import CSRF from 'koa-csrf';
import Pug from 'koa-pug';
import Redis from 'koa-redis';
import FileSend from 'koa-send';
import UserAgent from 'koa-useragent';
import BodyParser from 'koa-bodyparser';
import Router from 'koa-router';
import DetectAjax from 'koa-isajax';

import Config from './config';
import Lib from './lib';
Config.lib = Lib;

//*/

// Content Security Policy value
let whitelist = Config.cfg.external_whitelist;
const cspheadervalue = "default-src 'self';"+
	"script-src 'self' 'nonce-#inline#' "+Config.cdn+" "+(whitelist.script||[]).join(' ')+"; "+
	"style-src 'self' 'nonce-#inline#' "+Config.cdn+" "+(whitelist.style||[]).join(' ')+"; "+
	"img-src 'self' data: "+(whitelist.raw||[]).join(' ')+"; "+
	"media-src 'self' "+(whitelist.raw||[]).join(' ')+"; "+
	"connect-src 'self'; "+
	"child-src 'self' "+(whitelist.embed||[]).join(' ')+"; ";
	
// Request headers setter function
const HTMLheaders = (ctx,next)=>{
	ctx.state.INLINEHASH = Config.lib.genNonce();
	let cspval = cspheadervalue.replace(new RegExp("#inline#",'g'),ctx.state.INLINEHASH);
	ctx.set('Content-Security-Policy',cspval);
	ctx.set('X-Content-Security-Policy',cspval); // Old IE
	ctx.set('X-Webkit-CSP',cspval); // Old Chrome
	ctx.set('Content-Type', 'text/html; charset=utf-8');
	// ctx.set('Expect-CT', 'enforce; max-age=60;');
	ctx.set('Referrer-Policy', 'strict-origin');
	ctx.set('X-Xss-Protection', '1; mode=block');
	ctx.set('X-Content-Type-Options', 'nosniff');
	ctx.set('X-Frame-Options', 'SAMEORIGIN');
	// ctx.set('Strict-Transport-Security', 'max-age=631138519');
	// ctx.set('Public-Key-Pins', 'pin-sha256="INSERTSTRINGHERE"; max-age=1000; includeSubdomains;');
	if (next) return next();
};


// Page request handlers
const global = require('./global'),
	boards = require('./boards'),
	middle = require('./middleware');


// Setting up Pug Template Renderer
const pug = new Pug({
  viewPath: './views',
  debug: Config.env === 'development',
  pretty: false,
  compileDebug: false,
  locals: {},
  //basedir: 'path/for/pug/extends',
  helperPath: [
  ]
});
// Persistent locals
pug.locals.CDN = Config.cdn;
pug.locals.DEV = Config.cfg.devmode;
pug.locals.F_POSTID = Config.lib.posterID;
pug.locals.F_SPOILER = Config.lib.getSpoiler;
pug.locals.F_TOINTERVAL = Config.lib.toInterval;
pug.locals.F_UTC = (timestamp,mode)=>{
	if (mode == 1) return (new Date(timestamp)).toUTCString();
	else if (mode == 2) return (new Date(timestamp)).toLocaleString();
	else return (new Date(timestamp)).toISOString();
};
// client dependencies: External url or leave blank for local
pug.locals.CLIENTDEPS = {
	'vQuery.js':'',
	'socket.io.js':'',
	'common.css':'',
	'icons.css':''
};
// Dependencies are internal or external?
for (let i in pug.locals.CLIENTDEPS){
	if (Config.cfg.external_sources && Config.cfg.external_sources[i])
		pug.locals.CLIENTDEPS[i] = Config.cfg.external_sources[i];
	else pug.locals.CLIENTDEPS[i] = Config.cdn+'/_/'+i;
}
// alternate local locations if not located in the /static/ folder
var clientdepROOT = {
	'socket.io.js':'/node_modules/socket.io-client/'
};


// BEGIN APP DECLARATION

const app = new Koa();

// CSRF validator
const checkCSRF = new CSRF({
  invalidSessionSecretMessage: 'Invalid session secret',
  invalidSessionSecretStatusCode: 403,
  invalidTokenMessage: 'Invalid CSRF token',
  invalidTokenStatusCode: 403,
  excludedMethods: [ 'GET', 'HEAD', 'OPTIONS' ],
  disableQuery: true
});

app.context.checkCSRF = function(){
	return checkCSRF(this,noop);
};

app.context.json = (obj)=>{
	this.type = 'text/json';
	this.body = JSON.stringify(obj);
};

app.keys = [Config.cfg.secret,'reeeenormiesgetoutofmycode'];
pug.use(app);

// Error handling must be first!
app.use(middle.handleErrors);

// ctx.request.body
app.use(BodyParser());
// ctx.userAgent
app.use(UserAgent);
// ctx.state.xhr
app.use(DetectAjax());

app.use(Session({
	key: 'sid',
	//store: new Redis(),
	cookie: {
		path: '/',
		httpOnly: true,
		secure: false,
		maxAge: 1000*60*60*24*3
	}
})); // TODO: implement Redis into sessions

app.use((ctx,next)=>{
	// Handle use for the redirection cookies
	if (ctx.method == 'GET') {
		let opts = {httpOnly:true};
		if (!ctx.cookies.get('curpage')) ctx.cookies.set('lastpage', ctx.path, opts);
		else ctx.cookies.set('lastpage', ctx.cookies.get('curpage'), opts);
		ctx.cookies.set('curpage', ctx.path, opts);
	}
	
	// Devmode dynamic reloading
	if (Config.env == 'development') {
		Config.reload();
		if ('simip' in ctx.query){
			if (ctx.query.simip == '')
				delete ctx.session.IP;
			ctx.IP = ctx.session.IP = ctx.query.simip||ctx.ip;
		} else ctx.IP = ctx.session.IP||ctx.ip;
	} else ctx.IP = ctx.ip;
	
	ctx.state.NOW = Date.now();
	ctx.state.META = {};
	ctx.state.SITE = Config.cfg.site;
	
	return next();
});

// ----------------   BEGIN ROUTER DECLARATION  ----------------------

const router = new Router();

// ----------------   BEGIN FILE SERVE   ----------------------



// Global custom pages if HTML or optional whitelisted files in server root
router.get('/:file.:ext',(ctx,next)=>{ // replace with nginx serve?
	ctx.cookies.set('curpage',ctx.cookies.get('lastpage'),{httpOnly:true});
	let options = {
		root: __dirname
	};
	if (ctx.params.ext == 'html' && !_exists('./'+ctx.params.file+'.'+ctx.params.ext)) {
		ctx.cookies.set('curpage',ctx.path,{httpOnly:true});		
		// view for custom global pages
		HTMLheaders(ctx);
		return global.pages(ctx,next);
	} else if ((Config.cfg.root_whitelist||[]).contains(ctx.params.file+'.'+ctx.params.ext)) {
		//TODO convert to koa-send
		ctx.set('X-Timestamp',ctx.state.NOW);
		ctx.set('X-Sent',true);
		return FileSend(ctx, ctx.params.file+'.'+ctx.params.ext,options);
	} else ctx.throw(403);
});

// Static file serve for things like CSS and JS
router.get('/_/:file.:ext',(ctx,next)=>{ // replace with nginx serve?
	ctx.cookies.set('curpage',ctx.cookies.get('lastpage'),{httpOnly:true});
	let f = ctx.params.file+'.'+ctx.params.ext, d = clientdepROOT,
		options = {
			root: __dirname +'/static/'
		};
	if (f in d)
		options.root = __dirname + d[f];
	ctx.set('X-Sent',true);
	ctx.set('X-Timestamp',ctx.state.NOW);
	return FileSend(ctx, f, options);
});
// Board specific media serve
if (!Config.cfg.values.cdn_domain || Config.cfg.values.cdn_domain == 'localhost') { // possibly manage with nginx
router.get('/:board/media/:file',(ctx,next)=>{
	ctx.cookies.set('curpage',ctx.cookies.get('lastpage'),{httpOnly:true});
	let options = {
		root: __dirname +'/assets/'+ ctx.params.board +'/media/',
	};
	ctx.set('X-Sent',true);
	ctx.set('X-Timestamp',ctx.state.NOW);
	return FileSend(ctx,ctx.params.file,options);
});
}


// ----------------    END FILE SERVE   ----------------------



// CSRF setter only, bypass validation on methods
const setCSRF = new CSRF({
	excludedMethods: [ 'GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS' ],
	disableQuery: true
});

// set CSRF only on page GET requests
router.use((ctx,next)=>{
	if (ctx.method == "GET"){
		setCSRF(ctx,noop);
		// make CSRF available to templates.
		ctx.state.CSRF = ctx.csrf;
	}
	return next();
});

// simple request logger
var requestCount = 0;
router.use((ctx,next)=>{
	console.log(ctx.path, ctx.IP,
		"Requests made since boot: "+
		(++requestCount)+
		" - "+ctx.originalUrl+
		(ctx.state.xhr?"; XHR: ":" ")+
		"; "+ctx.method+
		"; "+ctx.protocol+"; "
	);
	return next();
});

// API Endpoint?
//router.use('/$',API.router);

router.use('/_',middle.loadUser);
router.use('/:board',middle.loadUser);
router.use('/',middle.loadUser);
router.use(HTMLheaders);


router.all('/_/:page/:action?/:data?',middle.loadGlobal, (ctx,next)=>{
	if (!!global[ctx.method] && !!global[ctx.method][ctx.params.page]) // global preset page
		if (!!global[ctx.method][ctx.params.page].reg && !ctx.state.user.reg)
			ctx.redirect('/_/login');
		else if (!!global[ctx.method][ctx.params.page].auth)
			try {
				// Auth must throw if user is unauthorized for this method/page
				global[ctx.method][ctx.params.page].auth(ctx,next);
				return global[ctx.method][ctx.params.page](ctx,next);
			} catch(err){
				ctx.throw(err.message||'Unauthorized',401);
			}
		else return global[ctx.method][ctx.params.page](ctx,next);
	else
		throw (new Error('Page not found')).setstatus(404).setloc('global page route');
});

router.all('/:board/:page/:action?/:data?',middle.loadBoard,(ctx,next)=>{
	if (!!boards[ctx.method] && !!boards[ctx.method][ctx.params.page] && ctx.params.page != 'thread')
		if (!!boards[ctx.method][ctx.params.page].reg && !ctx.state.user.reg)
			ctx.redirect('/_/login');
		else if (!!boards[ctx.method][ctx.params.page].auth)
			try {
				// Auth must throw if user is unauthorized for this method/page
				boards[ctx.method][ctx.params.page].auth(ctx,next);
				return boards[ctx.method][ctx.params.page](ctx,next);
			} catch(err){
				ctx.throw(err.message||'Unauthorized',401);
			}
		else return boards[ctx.method][ctx.params.page](ctx,next);
	else if (!!boards[ctx.method] && boards[ctx.method].thread && /^\d+$/.test(ctx.params.page)) 
		return boards[ctx.method].thread(ctx,next);
	else if (ctx.method == 'GET' && !!boards[ctx.method] && !!boards[ctx.method].pages) 
		return boards[ctx.method].pages(ctx,next); // Run as a custom board page
	else
		throw (new Error('Page not found')).setstatus(404).setloc('board page route');
});

router.all('/_',middle.loadGlobal,(ctx,next)=>{
	if (!!global[ctx.method] && global[ctx.method].index)
		return global[ctx.method].index(ctx,next);
	else
		throw (new Error('Page not found')).setstatus(404).setloc('underboard route');
});
router.all('/:board',middle.loadBoard,(ctx,next)=>{
	if (!!boards[ctx.method] && boards[ctx.method].index) 
		return boards[ctx.method].index(ctx,next);
	else
		throw (new Error('Page not found')).setstatus(404).setloc('board index route');
});

router.get('/',(ctx,next)=>{
	if (!!global.index)
		return global.index(ctx,next);
	else
		throw (new Error('Page not found')).setstatus(404).setloc('overboard route');
});

app.use(router.routes());
app.listen(Config.cfg.port,()=>{
  console.log('Now listening on port '+Config.cfg.port+'.');
});

// require('http2')
// 	.createServer({key:'',cert:''},app)
// 	.listen(Config.cfg.port,()=>{
// 	  console.log('Now listening on port '+Config.cfg.port+'.');
// 	});