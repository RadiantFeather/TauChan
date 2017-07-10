"use strict";
//*/

const fs = require('fs');
const gm = require('gm');
const qs = require('querystring');
const utf8 = require('utf8');
const FFMpeg = require('fluent-ffmpeg');
const Request = require('request');
const PRequest = require('promisified-request');
const Socket = require('socket.io');
const Redis = require('koa-redis');
const Crypto = require('crypto');
const Config = require('../config');
const Encoder = require('node-html-encoder').Encoder;
const Bcrypt = require('bcrypt');
/*/
import {FS as fs} from 'fs';
import {GMagick as gm} from 'gm';
import {QString as qs} from 'querystring';
import FFMpeg from 'fluent-ffmpeg';
import Request from 'request';
import PRequest from 'promisified-request';
import Socket from 'socket.io';
import Redis from 'koa-redis';
import Crypto from 'crypto';
import Config from './config';
import Encoder from 'node-html-encoder';
import Bcrypt from 'bcrypt';
//*/
const request = PRequest.create(Request.defaults({timeout:5000}));
const encoder = new Encoder('entity');
const _ = {};
const CWD = process.cwd();
var emitError = ()=>{};

_.use = function(app){
	emitError = (level,detail)=>{
		let err = new Error(detail);
		err.log = level.toUpperCase();
		app.emit('error',err);
	};
	// only ever call this function once
	delete this.use;
};

_.mkerr = function(cat="?",err="Unknown error on category: "+cat){
	err = err instanceof Error?err:new Error(err);
	if (cat in Config.errors)
		if (err.constraint && err.constraint in Config.errors[cat])
			err.message = Config.errors[cat][err.constraint];
		else emitError('SERVER','Undefined constraint: '+err.constraint);
	return err;
};

function path(_path){
	let i=-1, dirs = _path.split('/');
	let absolute = dirs[0] == '';
	while (++i < dirs.length) {
		if (dirs[i] == '' || dirs[i] == '.') {
			dirs.splice(i,1);
			--i; continue;
		}
	}
	if (absolute)
		return CWD+'/'+dirs.slice(0,i+1).join('/');
	else
		return __dirname+'/'+dirs.slice(0,i+1).join('/');
}

_.exists = function (_path) {
	try {
		fs.statSync(path(_path));
		return true;
	} catch (e) {
		return false;
	}
};

_.mkdir = function (_path){
	if (_.exists(_path)) return;
	let i=-1, dirs = _path.split('/');
	while (++i < dirs.length) {
		if (dirs[i] == '' || dirs[i] == '.') {
			dirs.splice(i,1);
			--i; continue;
		}
		let p = CWD+'/'+dirs.slice(0,i+1).join('/');
		try { fs.statSync(p); } 
		catch (e) { fs.mkdirSync(p); }
	}
};
	
_.toInterval = function(seconds,mode){
	let s = seconds%60;
	let m = (seconds>=60?Math.round(seconds/60):null);
	let h = (m&&m>=60?Math.round(seconds/60/60):null);
	let d = (h&&h>=24?Math.round(seconds/60/60/24):null);
	switch(mode){
		case 1:
			return (h!==null?h+'h ':'')+(m!==null?(m%60)+'m ':'')+s+'s '; // eg. 5h 12m 42s
		case 2:
			return (h!==null?h+':':'')+(m===null?'00':(m=m%60)>9?m:'0'+m)+':'+(s>9?s:'0'+s); // eg. 5:12:42
		default:
			return (d!==null?d+' days ago':d) // eg. 4 days ago
			||	   (h!==null?h+' hours ago':h) // eg. 12 hours ago
			||	   (m!==null?m+' minutes ago':m) // eg. 32 minutes ago
			||	   'Just Now'; // anything less than a minute
	}
};

_.flattenFlags = function(flags,depth=[],out={}){
	let level;
	for (let i in flags){
		level = flags[i];
		depth.push(i);
		if (typeof level === 'object'){
			_.flattenFlags(level,depth,out);
		}
		else out[depth.join('-')] = level;
		depth.pop();
	}
	return out;
};

function URL(url){
	let s,t;
	
	this.protocol = '';
	this.domain = [];
	this.port = 80;
	this.uri = [];
	this.query = {};
	this.hash = '';
	
	t = url;
	if (t.indexOf('://') >-1 && t.split('://',1)[0]) {
		t = t.split('://');
		this.protocol = t.shift();
		if (this.protocol == 'https') this.port = 443;
		t = t.join('://');
	}
	if (t.slice(0,2) == '//') t = t.slice(2);
	if (t.split('/',1)[0]) {
		t = t.split('/');
		s = t.shift();
		if (s.indexOf(':') > 0){
			s = s.split(':');
			this.port = parseInt(s.pop(),10);
			s = s.pop();
		}
		this.domain = s.split('.');
		t = t.join('/');
	}
	if (t.split('?',1)[0]) {
		t = t.split('?');
		s = t.shift();
		if (s.indexOf('/')==0) s = s.slice(1);
		this.uri = s.split('/');
		this.uri.map((item)=>{return decodeURIComponent(item);});
		t = t.join('?');
	}
	if (t.split('#',1)[0]){
		t = t.split('#');
		this.query = qs.parse(t.shift());
		t = t.join('#');
	}
	if (t) this.hash = t;
	
	return this;
}
URL.prototype.protocolString = function(){ return this.domain.length&&this.protocol.length?this.protocol+':':''; };
URL.prototype.domainString = function(){ return this.domain.length?'//'+this.domain.join('.'):''; };
URL.prototype.portString = function(){
	if (this.protocol == 'http'&&this.port == 80) return '';
	if (this.protocol == 'https'&&this.port == 443) return '';
	return ':'+this.port;
};
URL.prototype.uriString = function(){
	return this.uri.length?'/'+this.uri.map((item)=>{return encodeURIComponent(item);}).join('/'):'/';
};
URL.prototype.queryString = function(){ 
	return Object.keys(this.query).length?'?'+qs.stringify(this.query):'';
};
URL.prototype.hashString = function(){
	return this.hash.length?'#'+this.hash:'';
};
URL.prototype.toString = URL.prototype.stringify = function(){
	let o;
	o = this.protocolString()+
		this.domainString()+
		this.portString()+
		this.uriString()+
		this.queryString()+
		this.hashString();
	return o;
};

_.URL = (str)=>{ return new URL(str);};

_.getDeleted = function(board){
	if (board.deletedimg) return Config.cdn+board.deletedimg;
	if (_.exists("/assets/_/media/deleted.png"))
		return Config.cdn+"/_/media/deleted.png";
	return _.genDeleted(board);
};

_.genDeleted = function(board){
	if (board.deletedimg) return;
	if (_.exists("/assets/_/media/deleted.png")) return;
	_.mkdir('/assets/_/media/');
	gm(200, 110, "#cc0000")
		.fontSize(15)
		.fill("#ffffff")
		.drawText(0, 0, 'DELETED', 'Center')
		.write(path("/assets/_/media/deleted.png"));
	return Config.cdn+"/_/media/deleted.png";
};

_.getSpoiler = function(board,size){
	if (!size || board.spoilerimg) return Config.cdn+board.spoilerimg;
	// autosize the values to be proportional to 200px
	size = size.split('x');
	let w = parseInt(size[0],10), h = parseInt(size[1],10);
	if (w > h){ h = parseInt(200 * h / w,10); w = 200; } 
	else if (h > w){ w = parseInt(200 * w / h,10); h = 200; } 
	else { 	w = 200; h = 200; }
	if (w%5 > 0) w -= w%5;
	if (h%5 > 0) h -= h%5;
	if (_.exists("/assets/_/media/spoiler."+w+"x"+h+".png"))
		return Config.cdn+"/_/media/spoiler."+w+"x"+h+".png";
	else return Config.cdn+"/_/spoiler.png";
};

_.genSpoiler = function(board,size){
	if (!size || board.spoilerimg) return;
	// autosize the values to be proportional to 200px
	size = size.split('x');
	let w = parseInt(size[0],10), h = parseInt(size[1],10);
	if (w > h){ h = parseInt(200 * h / w,10); w = 200; } 
	else if (h > w){ w = parseInt(200 * w / h,10); h = 200; } 
	else { 	w = 200; h = 200; }
	if (w%5 > 0) w -= w%5;
	if (h%5 > 0) h -= h%5;
	if (_.exists("/assets/_/media/spoiler."+w+"x"+h+".png")) return;
	_.mkdir('/assets/_/media/');
	gm(w, h, "#000000")
		.fontSize(15)
		.fill("#ffffff")
		.drawText(0, 0, 'SPOILER', 'Center')
		.write(path("/assets/_/media/spoiler."+w+"x"+h+".png"));
};

function properSize(val){
	switch(val.slice(val.length -2)){
		case 'Ki': return val.slice(0,val.length-2) + 'KB';
		case 'Mi': return val.slice(0,val.length-2) + 'MB';
		default: return val + 'B';
	}
}

const parseExternalMedia = async function parseExternalMedia(url) {
	let s,m=null,found,r={meta:{info:[]}},
		media = Config.cfg.external_media;
	for(let key in media) {
		if (media[key] instanceof Array){
			for (let val in media[key])
				if (new RegExp(media[key][val]).test(url)){
					found = key;
					break;
				}
			if (found) break;
		} else if (new RegExp(media[key]).test(url)){
			found = key;
			break;
		}
	}
	if (!found) throw new Error(url.substr(0,64)+(url.length>64?'[...]':'')+' did not match any supported embeds.');
	m = new URL(url);
	r.processed = true; // External media do not need to generate thumbnails
	let id, err =  new Error('No dicernable video ID was given.');
	switch (found) { // meta: title size duration dims
		// case 'vocaroo':
		// case 'twitch':
		// case 'livestream':
		// case 'hitbox':
		// case 'ustream':
		case 'imgur':
			if (!m.uri[0]) throw err;
			id = m.uri[0].split('.')[0];
			r.mediatype = 'img';
			r.src = 'https://i.imgur.com/'+m.uri[0];
			r.href = 'https://imgur.com/'+m.uri[0];
			r.thumb = 'https://i.imgur.com/'+id+'s.jpg';
			r.hash = Crypto.createHash('md5').update(found+'&'+id).digest('hex');
			r.meta.title = m.uri[0];
			r.processed = true;
			break;
		case 'youtube':
			id = m.domainString().slice(2)=='youtu.be'?m.uri[0]:m.query.v;
			if (!id) throw new Error('No dicernable youtube video ID was given.');
			r.mediatype = 'you';
			s = new URL('https://www.youtube.com/embed/'+id+'?vq=large&rel=0');
			if (m.query.t) s.query.t = m.query.t;
			else {
				if (m.query.start) s.query.start = m.query.start;
				if (m.query.end) s.query.end = m.query.end;
			}
			r.src = s.toString();
			r.thumb = 'https://img.youtube.com/vi/'+id+'/mqdefault.jpg';
			r.meta.dims = '320x180';
			r.meta.href = 'https://youtu.be/'+id;
			r.hash = Crypto.createHash('md5').update(found+'&'+id).digest('hex');
			try{
				let res = await request.get('https://youtube.com/get_video_info?video_id='+id);
				let data = qs.parse(res.body);
				console.log(data);
				if (data.status == 'fail'){
					let e = new Error(data.reason);
					e.videoID = id;
					e.expose = true;
					throw e;
				}
				r.meta.title = data.title;
				r.meta.info.push(_.toInterval(data.length_seconds,2));
			} catch(e){
				console.log('youtube error',e);
				r.meta.title = 'Youtube Video';
				r.meta.info.push('Title fetch failed');
			}
			break;
		case 'dailymotion':
			id = m.domainString()=='dai.ly'?m.uri[0]:m.uri[1].split('_')[0];
			if (!id) throw new Error('No dicernable dailymotion video ID was given.');
			r.mediatype = 'dly';
			s = new URL('https://www.dailymotion.com/embed/video/'+id);
			s.query.quality = 480;
			s.query['sharing-enabled'] = false;
			s.query['endscreen-enable'] = false;
			s.query.api = 1;
			if (m.query.start) s.query.start = m.query.start;
			r.src = s.toString();
			r.meta.href = 'https://dai.ly/'+id;
			r.meta.dims = '214x120';
			r.hash = Crypto.createHash('md5').update(found+'&'+id).digest('hex');
			try {
				let res = await request('https://api.dailymotion.com/video/'+id+'?fields=title,thumbnail_120_url,duration');
				let data = JSON.parse(res.body);
				r.thumb = data.thumbnail_120_url.replace('http:','https:');
				r.meta.title = data.title;
				r.meta.info.push(_.toInterval(data.duration,2));
			} catch(e){
				try{r.meta.title = m.uri[1].split('_')[1];}
				catch(e){
					console.log('dailymotion error',e);
					r.meta.title = 'Dailymotion Video';
					r.meta.info.push('Info fetch failed');
				}
				if (!_.exists("/assets/_/media/dailymotion.png"))
					await gm(214, 120, '#0066DC')
						.fontSize(20)
						.fill("#ffffff")
						.drawText(0, 0, 'Dailymotion Video', 'Center')
						.write(path("/assets/_/media/dailymotion.png"));
				r.thumb = '/_/media/dailymotion.png';
			}
			break;
	}
	console.log(r);
	return r;
};

const parseInternalMedia = async function parseInternalMedia(file,board,trackfiles) { // href src hash thumb meta mediatype nsfw
	var r={meta:{}},data,img,fn;
	_.mkdir('assets/'+board+'/media');
	switch (file.mimetype.toLowerCase()) {
		case 'image/jpg':
		case 'image/jpeg':
		case 'image/jpe':
		case 'image/png':
			r.mediatype = 'img';
			r.meta.title = file.originalname;
			// normalize path for windows
			file.path = file.path.replace(/\\/g,'/');
			// extract filename
			fn = file.path.split('/')[file.path.split('/').length-1];
			r.src = '/'+board+'/media/'+fn;
			r.thumb = '/'+board+'/media/'+fn+'.thumb.png';
			// get the unique md5 of the file
			r.hash = Crypto.createHash('md5').update(fs.readFileSync(Config.cwd+'/'+file.path, 'utf8')).digest('hex');
			// move file from temp location to asset storage
			// TODO implement CDN upload handling
			fs.renameSync(Config.cwd+'/'+file.path,Config.cwd+'/assets'+r.src);
			// declare image as removable upon request error
			trackfiles.push('/assets'+r.src);
			// create thumbnail
			img = gm(Config.cwd+'/assets'+r.src);
			data = await img.identify('%m %P %b');
			data = data.split(' ');
			data[2] = properSize(data[2]);
			r.meta.info = data;
			r.meta.type = data[0];
			r.meta.dims = data[1];
			r.meta.size = data[2];
			// declare image as removable upon request error
			trackfiles.push('/assets'+r.thumb);
			if (['JPEG','JPG'].contains(data[0]))
				img.noProfile();
			img.resize(200, 200);
			await img.write(Config.cwd+'/assets'+r.thumb);
			break;
			
		case 'image/gif':
			r.mediatype = 'img';
			r.meta.title = file.originalname;
			// normalize path for windows
			file.path = file.path.replace(/\\/g,'/');
			// extract filename
			fn = file.path.split('/')[file.path.split('/').length-1];
			r.src = '/'+board+'/media/'+fn;
			r.thumb = '/'+board+'/media/'+fn+'.thumb.png';
			// get the unique md5 of the file
			r.hash = Crypto.createHash('md5').update(fs.readFileSync(Config.cwd+'/'+file.path, 'utf8')).digest('hex');
			// move file from temp location to asset storage
			// TODO implement CDN upload handling
			fs.renameSync(Config.cwd+'/'+file.path,Config.cwd+'/assets'+r.src);
			// declare image as removable upon request error
			trackfiles.push('/assets'+r.src);
			// create thumbnail
			img = gm(Config.cwd+'/assets'+r.src+'[0]');
			data = await img.identify('%m %P %b');
			data = data.split(' ');
			data[2] = properSize(data[2]);
			r.meta.info = data;
			r.meta.type = data[0];
			r.meta.dims = data[1];
			r.meta.size = data[2];
			// declare image as removable upon request error
			trackfiles.push('/assets'+r.thumb);
			img.resize(200, 200);
			await img.write(Config.cwd+'/assets'+r.thumb);
			break;
			
		case 'audio/ogg':
			r.mediatype = 'aud';
			
			break;
		case 'audio/mpeg':
			r.mediatype = 'aud';
			
			break;
		case 'video/webm':
			r.mediatype = 'vid';
			
			break;
		case 'video/mp4':
			r.mediatype = 'vid';
			//check codec for H.264 and AAC allowed only
			
			break;
		case 'video/ogg':
			r.mediatype = 'vid';
			
			break;
		default:
			let err = 'Unsupported media type: '+ file.mimetype.toLowerCase() +' - '+ file.originalName;
			throw (new Error(err)).setstatus(415);
	}
	return r;
};
	
_.processPostMedia = async function(board,body,files,trackfiles) {
	this.mkdir('/assets/'+board.board+'/media');
	let i = -1, media = [], f;
	while (++i < board.mediauploadlimit) {
		if (!body['include'+i]) continue;
		if (!!body['is_external'+i]) {
			let m = await parseExternalMedia(body['out_media'+i]);
			m.nsfw = !!body['spoiler_media'+i];
			if (m.nsfw) _.genSpoiler(board,m.meta.dims);
			media.push(m);
		} else if (files) {
			f = files.filter((cur)=>{return cur.fieldname == 'in_media'+i;});
			if (!f.length) continue;
			let m = await parseInternalMedia(f[0],board.board,trackfiles);
			m.nsfw = !!body['spoiler_media'+i];
			if (m.nsfw) _.genSpoiler(board,m.meta.dims);
			media.push(m);
		}
	}
	return media;
};

_.posterID = function(ip,board,thread){
	let trip = Crypto.createHash('md5')
		.update(ip)
		.update(board)
		.update(thread.toString())
		.update(Config.cfg.secret)
		.digest();
	return Crypto.createHash('md5')
		.update(trip)
		.update(Config.cfg.secret)
		.digest()
		.toString('hex')
		.substr(0,Config.cfg.values.poster_id_length);
};

_.processTrip = function(trip,capcode){
	if (trip === null) return null;
	let t = trip;
	if (trip.indexOf('#') == 0) {
		let trip = t;
		trip = trip.substr(1);
		let i = -1;
		if (capcode && Config.cfg.capcodes) 
			while (++i < Config.cfg.capcodes){
				if (trip.trim().toLowerCase() == capcode.toLowerCase()){
					return ' ## '+capcode;
				}
			}
		if (Config.cfg.custom_tripcodes && '##'+trip in Config.cfg.custom_tripcodes)
			return '!!'+Config.cfg.custom_tripcodes['##'+trip];
		// if not a known capcode or custom trip, process as a secure trip
		trip = Crypto.createHash('sha256')
			.update('paranoid_normie')
			.update(trip)
			.update(Config.cfg.secret)
			.digest();
		return '!!'+ Crypto.createHash('sha1')
			.update(trip)
			.update(Config.cfg.secret)
			.digest()
			.toString('base64')
			.substr(0,10);
	} else {
		let trip = t;
		if (Config.cfg.custom_tripcodes && '#'+trip in Config.cfg.custom_tripcodes)
			return '!'+Config.cfg.custom_tripcodes['#'+trip];
		// process as an unsecure trip
		trip = Crypto.createHash('sha256')
			.update('normie')
			.update(trip)
			.digest();
		return '!'+ Crypto.createHash('sha1')
			.update(trip)
			.digest()
			.toString('base64')
			.substr(0,10);
	}
};

_.processMarkdown = function(ctx,next){
	// implement filters with PCRE based regex for faster processing
	return ctx.request.body.markdown; // placeholder
	let cursor = 0;
	
	
};

_.processTicker = function(markdown){
	return _.processMarkup(markdown,true);
};

_.processMarkup = function(markdown, ticker=false){
	if (!Config.cfg.markdown)
		return encoder.encodeHTML(markdown)
			.replace(new RegExp("&#13;",'g'),'')
			.replace(new RegExp("&#10;",'g'),'<br>');
	let keys = Config.cfg.markdown.custom, ignore = Config.cfg.markdown.ignore||null, 
		list = Config.cfg.markdown.list||{}, hlink = Config.cfg.markdown.hyperlink,
		markup = markdown.replace(new RegExp("\r",'g'),'').replace(new RegExp("\0",'g'),''), depth = [], track = [],
		cursor = 0, currentlist, links = [];
	// IGNORE ALL MARKDOWN AND JUST RETURN THE ENCODED CONTENT
	if (ignore && ignore.all.length && markup.substr(0,ignore.all.length) == ignore.all)
		return encoder.htmlEncode(markup.slice(ignore.all.length))
			.replace(new RegExp("&#13;",'g'),'')
			.replace(new RegExp("&#10;",'g'),'<br>');
	// Fix bricked keys and add store for nested keys (eg. nested spoilers)
	keys.forEach((item)=>{
		item.before = item.brick?'['+item.key+']':item.key;
		item.after = item.brick?'[/'+item.key+']':item.key;
		item.start = [];
	});
	list.forEach((item)=>{item.exclusiveline = true;});
	while (1){
		let e = depth[depth.length-1];
		
		// PARAGRAPH LEVEL MARKDOWN BYPASS
		if (!(e&&e.exclusivetext) && ignore && ignore.paragraph.length && markup.substr(cursor,ignore.paragraph.length) == ignore.paragraph){
			// confirm newline placement
			if (cursor == 0 || markup.substr(cursor-1,1)=="\n"){
				// bypass all markup until a newline
				markup = markup.splice(cursor,ignore.paragraph.length);
				while (markup.substr(cursor,1) != "\n" && cursor < markup.length) 
					cursor++;
			}
		}
		
		// SEGMENTED MARKDOWN BYPASS
		if (!(e&&e.exclusivetext) && ignore && ignore.open.length && markup.substr(cursor,ignore.open.length) == ignore.open){
			// check for the suppression close key first.
			if (ignore.close.length && markup.slice(cursor+ignore.open.length).indexOf(ignore.close) != -1){
				// bypass all markup within open and closing keys
				markup = markup.splice(cursor,ignore.open.length);
				while (markup.substr(cursor,ignore.close.length) != ignore.close && cursor < markup.length)
					cursor++;
				if (cursor < markup.length){
					markup = markup.splice(cursor,ignore.close.length);
					cursor -= ignore.open.length;
				}
			}
		}
		
		// NATURAL STRING MARKDOWN BYPASS (whitespace delimited)
		if (!(e&&e.exclusivetext) && ignore && ignore.string.length && markup.substr(cursor,ignore.string.length) == ignore.string){
			let ws = ["\n","\t"," "];
			// verify placement of key
			if (ws.indexOf(markup.substr(cursor-1,1)) != -1 && ws.indexOf(markup.substr(cursor+ignore.string.length,1)) == -1){
				// Bypass all markdown until a whitespace character is encountered
				markup = markup.splice(cursor,ignore.string.length);
				while(ws.indexOf(markup.substr(cursor,1)) == -1 && cursor < markup.length)
					cursor++;
			}
		}
		
		// CUSTOM ELEMENTS
		if (e && e.exclusivetext && e.after && markup.substr(cursor,e.after.length) == e.after){
			let k = keys.indexOf(e), a = "\r"+k+"\0\r", b = "\r\0"+k+"\r";
			let nlbefore = 0, nlafter = 0;
			// if a key is wrapped by newlines, remove the newlines on the INSIDE of the key match
			if (e.start[e.start.length-1] > 0 && markup.substr(e.start[e.start.length-1]-1,e.before.length+2) == "\n"+e.before+"\n")
				nlbefore = 1;
			else if (markup.substr(e.start[e.start.length-1],e.before.length+1) == e.before+"\n")
				nlbefore = 1;
			//console.log('Before: ', nlbefore, escape(markup.substr(e.start[e.start.length-1],e.before.length+nlbefore)));
			markup = markup.splice(e.start[e.start.length-1],e.before.length+nlbefore,b);
			cursor = cursor - e.before.length - nlbefore + b.length;
			if (cursor+e.after.length < markup.length && markup.substr(cursor-1,e.after.length+2) == "\n"+e.after+"\n")
				nlafter = 1;
			else if (markup.substr(cursor-1,e.after.length+1) == "\n"+e.after)
				nlafter = 1;
			//console.log('After: ', nlafter, escape(markup.substr(cursor-nlafter,e.after.length+nlafter)));
			markup = markup.splice(cursor-nlafter,e.after.length+nlafter,a);
			cursor = cursor - nlafter + a.length;
			e.start.pop();
			track.push(e);
			depth.pop();
			continue;
		}
		let i = -1, skip = true;
		// cycle through all the keys to see if the current cursor position matches
		while (++i < keys.length){
			let t = keys[i];
			// This does the actual injection of the nodes using the bookmarks
			if (t.after && depth.indexOf(t) != -1 && markup.substr(cursor,t.after.length) == t.after) {
				if (t.exclusiveline && markup.substr(cursor+t.after.length,1) != "\n" && cursor+t.after.length < markup.length) continue;
				// insert the text bookmarks for the opening and closing of the markdown
				if (markup.substr(cursor-t.before.length,t.before.length) == t.before) {
					// prevent unnecessary empty nodes from being generated
					markup = markup.splice(cursor-t.before.length,t.before.length+t.after.length);
					cursor -= t.before.length;
					t.start.pop();
					depth.splice(depth.lastIndexOf(t),1);
					continue;
				}
				let a = "\r"+i+"\0\r", b = "\r\0"+i+"\r";
				let nlbefore = 0, nlafter = 0;
				// if a key is wrapped by newlines, remove the newlines on the INSIDE of the key match
				if (t.start[t.start.length-1] > 0 && markup.substr(t.start[t.start.length-1]-1,t.before.length+2) == "\n"+t.before+"\n")
					nlbefore = 1;
				else if (markup.substr(t.start[t.start.length-1],t.before.length+1) == t.before+"\n")
					nlbefore = 1;
				//console.log(markup.substr(t.start[t.start.length-1],t.before.length+nlbefore));
				markup = markup.splice(t.start[t.start.length-1],t.before.length+nlbefore,b);
				cursor = cursor - t.before.length - nlbefore + b.length;
				if (cursor+t.after.length < markup.length && markup.substr(cursor-1,t.after.length+2) == "\n"+t.after+"\n")
					nlafter = 1;
				else if (markup.substr(cursor-1,t.after.length+1) == "\n"+t.after)
					nlafter = 1;
				//console.log(markup.substr(cursor-nlafter,t.after.length+nlafter));
				markup = markup.splice(cursor-nlafter,t.after.length+nlafter,a);
				cursor = cursor - nlafter + a.length;
				depth.splice(depth.lastIndexOf(t));
				t.start.pop();
				track.push(t);
				skip = false;
				break;
			} else if (markup.substr(cursor,t.before.length) == t.before && markup.substr(cursor,t.before.length+t.after.legnth) != t.before+t.after) {
				// This bookmarks the index of the markdown opening
				if (t.exclusiveline && cursor != 0 && markup.substr(cursor-1,1) != "\n") continue;
				t.start.push(cursor);
				depth.push(t);
				cursor += t.before.length;
				if (t.exclusiveline) {
					// exclusiveline will automatically close at a newline or end of text if not already.
					// does not actually consume text, only predicts that it's closing value is present.
					let hold = cursor--;
					while (markup.substr(++cursor,1) != "\n" && markup.substr(cursor,t.after.length) != t.after)
						if (cursor >= markup.length) 
							break;
					if (markup.substr(cursor,t.after.length) != t.after || cursor >= markup.length)
						markup = markup.splice(cursor,0,t.after);
					cursor = hold;
				}
				if (t.exclusivetext){
					// exclusivetext ignores all markdown (including suppression) until its closing key
					// consumes text unless closing key is not present
					let hold = cursor--;
					while (markup.substr(++cursor,t.after.length) != t.after){
						if (cursor >= markup.length) {
							cursor = hold;
							depth.pop();
							t.start.pop();
							break;
						}
					}
				}
				skip = false;
				break;
			}
		}
		
		// LISTS
		// if (!ticker && list){
		// for (i in list) {
		// 	let a = "\r"+i+"\0\r", b = "\r\0"+i+"\r",depth = '';
		// 	if (markup.substr(cursor-1,list[i].key.length+2) == "\n"+list[i].key+' '){
		// 		if (currentlist != i){
		// 			// close existing list and open new one
					
					
		// 			currentlist = i;
					
		// 		} else if (!currentlist){
		// 			// open new list
		// 			currentlist = i;
					
		// 		} else {
		// 			// close depths, close list item, open list item, open depths

		// 		}
		// 	} else if (currentlist && markup.substr(cursor-1,1) == "\n"){
		// 		// close depths then existing list
				
				
		// 		currentlist = null;
		// 	}
		// }}
		
		// HYPERLINKS 
		if (markup.substr(cursor,hlink.length) == hlink && cursor+hlink.length < markup.length){
			let ws = ["\n","\t"," "];
			let quoted = (markup.substr(cursor+hlink.length,1) == '"'?1:0);
			let newline = false;
			// verify corresponding close quote exists
			let point = cursor+hlink.length+1;
			if (quoted && markup.substr(point,1) != '"'){
				while (point < markup.length && markup.substr(point,1) != '"')
					// disallow newlines within quoted links
					if (markup.substr(point,1) == "\n") {
						newline = true;
						break;
					} else point++;
				if (point >= markup.length) quoted = 0;
			}
			else quoted = 0;
			if (!newline)
			if (
				((cursor == 0 || ws.indexOf(markup.substr(cursor-1,1))) != -1 && ws.indexOf(markup.substr(cursor+hlink.length,1)) == -1) ||
				(quoted && ws.indexOf(markup.substr(cursor+hlink.length,1)) == -1)
			){
				// Place bookmarks for inserting hyperlinks
				let a = "\r"+links.length+"\0\0\0\0\r", b = "\r\0\0\0\0"+links.length+"\r";
				
				markup = markup.splice(cursor,hlink.length+quoted,b);
				cursor += b.length;
				let start = cursor;
				if (quoted) ws = ['"'];
				while (ws.indexOf(markup.substr(cursor,1)) == -1 && cursor < markup.length)
					cursor++;
				let str = markup.slice(start,cursor);
				markup = markup.splice(cursor,quoted,a);
				cursor += a.length;
				links.push(str);
				
			}
		}
		if (skip) cursor++;
		if (cursor > markup.length) break;
	}
	// \r (aka &#13;) is the only character that is guarenteed not to be present before and after processing
	// because we remove all instances at the start of the processing, so we use that for bookmarking the
	// keys to allow for html sensitive characters to be used in markdown without accidental encoding errors.
	// Also prevents malicious html code from leaking through.
	let i = -1;
	markup = encoder.htmlEncode(markup.replace(/^[\n\t ]+|\n+$/g,''));
	while (++i < track.length) {
		let k = keys.indexOf(track[i]);
		markup = markup
			.replace(new RegExp("&#13;&#0;"+k+"&#13;",'g'),track[i].open)
			.replace(new RegExp("&#13;"+k+"&#0;&#13;",'g'),track[i].close);
	}
	//TODO insert html for any lists found
	
	// insert html for any hyperlinks found
	i = -1;
	while(++i < links.length)
	markup = markup
		.replace(new RegExp("&#13;&#0;&#0;&#0;&#0;"+i+"&#13;",'g'),'<a href="'+encodeURI(links[i])+'">')
		.replace(new RegExp("&#13;"+i+"&#0;&#0;&#0;&#0;&#13;",'g'),'</a>');
	// replace \n (aka &#10;) with <br> nodes
	return markup.replace(new RegExp("&#10;",'g'),'<br>');
};

// Sync is used since the functions that call these are typically asyncronous already
// 16 rounds is ~5 seconds per attempt.
const secureSaltRounds = 16;
_.encryptData = function(data){
	return Bcrypt.hashSync(data+Config.cfg.secret,secureSaltRounds);
};

_.compareData = function(data,hash){
	return Bcrypt.compareSync(data+Config.cfg.secret,hash);
};

_.maskData = function(...data){
	let cipher = Crypto.createCipher('bf-cbc',Config.cfg.secret);
	let mask = cipher.update(data.join("\0"),'utf8','hex');
	return mask + cipher.final('hex');
};
_.unmaskData = function(mask){
	let decipher = Crypto.createDecipher('bf-cbc',Config.cfg.secret);
	let data = decipher.update(mask,'hex','utf8');
	data = (data + decipher.final('utf8')).split("\0");
	if (data.length > 1) return data;
	return data[0];
};

// Secure string for inline scripts and styles
_.genSecure = function(){
	return	Crypto.createHash('sha256')
		.update(Config.cfg.secret)
		.update(Math.random().toString())
		.digest('hex');
};

function User(data,board,ip){
	let anon = {
		id: null
		,verified: false
		,global: false
		,username: null
		,email:null
		,screenname: null
		,roles:{}
	};
	for (var i in anon){
		if (data&&i in data) this[i] = data[i];
		else this[i] = anon[i];
	}
	// fix the returned value from the DB call
	if (this.roles instanceof Array) {
		let roles = {};
		this.roles.forEach((item)=>{
			roles[item.board] = {
				role:item.role,
				capcode:item.capcode,
				flags:item.flags
			};
		});
		this.roles = roles;
	}
	if (this.roles == null) this.roles = {};
	this.ip = ip;
	this.currentBoard = board||'';
	this.reg = data?true:false;
}

// Global flag registry for user auth permissions
const RegFlag = (flag,board)=>{
	let d = -1, level = board == '_'?Config.globalflags:Config.flags;
	while (++d < flag.length){
		if (!level[flag[d]]) level[flag[d]] = {};
		level = level[flag[d]];
	}
	level[flag[d]] = 'The flag '+flag.join('.')+' has not yet been described.';
	emitError('server', 'Please define flag: '+flag.join('.'));
	Config.yml.write(board == '_'?'./flags.global.yml':'./flags.yml',Config.flags,()=>{});
};
User.prototype.auth = function(flag,def,ault){
	function testRule(check) {
		let r;
		if (!('flags' in u) || !(check in u.flags)) r = !!def;
		else r = !!u.flags[check];
		return r;
	}
	let board = this.currentBoard;
	// allow auth for multiple boards
	if (def !== undefined) board = def, def = undefined;
	if (ault !== undefined) def = ault;
	if (!this.reg) return !!def;
	var u = board in this.roles?this.roles[board]:{};
	// Board owners and Global owners automatically have all rights for the current board.
	if (u.role == 'owner' || ('_' in this.roles && this.roles['_'].role == 'owner')) return true;
	if (typeof flag == 'string') flag = [flag];
	let i = -1,pass=[];
	while (++i < flag.length) {
		let ctx = flag[i].split('!');
		flag[i] = ctx.shift();
		if (ctx.length > 1) ctx = ctx.shift();
		else ctx = 'any';
		let level, d = -1, istrue = null;
		let f = flag[i].split('-');
		if (f.length == 1) f = flag[i].split('.'); // alternate, backwards-compatibility
		level = board == '_'? Config.globalflags : Config.flags;
		while (++d < f.length){
			if (f[d] in level){
				level = level[f[d]];
				continue;
			} else RegFlag(f,board);
		}
		if (typeof level == 'object'){
			for (let x in level){
				let y = testRule(f.join('-')+'-'+x);
				if (ctx == 'all' && !y){
					istrue = false;
					break;
				} else if (ctx == 'any' && y){
					istrue = true;
					break;
				}
			}
			if (istrue == null) istrue = ctx == 'all';
		}
		else istrue = testRule(f.join('-'));
		pass.push(istrue);
	}
	let o = pass.filter(x=>x);
	//console.log('Pass count: ',o);
	return o.length>0;
};
// User Cookie: ctx.cookies.set('user',ctx.session.user,{httpOnly:true,maxAge:1000*60*60*24*7});
_.User = User;


module.exports = _;
// export {_ as default};