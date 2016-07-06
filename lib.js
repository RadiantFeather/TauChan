"use strict";
var fs = require('fs'),
	deasync = require('deasync'),
	// cache = require('redis'),
	// socket = require('socekt.io'),
	crypto = require('crypto'),
	qs = require('querystring'),
	ffmpeg = require('fluent-ffmpeg'),
	encoder = require('node-html-encoder').Encoder('numerical'),
	easyimg = require('easyimage'),
	yml = {read: require('read-yaml'), write: require('write-yaml')},
	// pgp = require('pg-promise')({ promiseLib: require('bluebird') }),
	// db = pgp(GLOBAL.cfg.database),
	reeeee = {
		imgur: /^https:\/\/i\.imgur\.com\/(([^/.]+)\.(?:jpg|png|gif))+/i
		,youtube: /^https?:\/\/(?:\w+\.)?(?:youtube\.com\/watch\?|youtu\.be\/)(?:&?v=)?([a-zA-Z0-9_-]{10,11})?(?:(?:[?&]t=(\w+))|(?:[&?]start=(\d+))?(?:[&?]end=(\d+))?)?/i
		
	},
	
	_ = {};
	
_.exists = function(path){
	try {
		fs.statSync(path);
		return true;
	} catch (e) { return false; }
};

_.mkdir = function(path){
	if (_.exists(path)) return;
	let i=-1, dirs = path.split('/');
	while (++i < dirs.length) {
		if (dirs[i] == '' || dirs[i] == '.' || dirs[i] == '..') {
			dirs.splice(i--,1);
			continue;
		}
		let p = './'+dirs.slice(0,i+1).join('/');
		try { fs.statSync(p); } 
		catch (e) { fs.mkdirSync(p); }
	}
};
	
_.toHumanTime = function(seconds){
	let s = seconds%60;
	let m = (seconds>=60?seconds/60%60:null);
	let h = (m&&m>=60?seconds/60/60%24:null);
	return (h!==null?h+'h':'')+(m!==null?m+'m':'')+s+'s';
};

_.urldigest = function(url,decode){
	let r,s,t,p = {
		protocol:'', hash:'', port: 80,
		domain:'', domainparts:[],
		uri:'', uriparts:[],
		query:'', queryparts:{}
	};
	t = url;
	if (t.split('://',1)[0]) {
		t = t.split('://');
		p.protocol = t.shift();
		t = t.join('://');
	}
	if (t.split('/',1)[0]) {
		t = t.split('/');
		p.domain = t.shift();
		if (p.domain.indexOf(':') > 0){
			let x = p.domain.split(':');
			p.port = parseInt(x.pop());
			p.domain = x.pop();
		}
		p.domainparts = p.domain.split('.');
		t = t.join('/');
	}
	if (t.split('?',1)[0]) {
		t = t.split('?');
		if (decode){
			p.uri = decodeUriComponent(t.shift());
			p.uri.split('/').each((item)=>{p.uriparts.push(decodeUriComponent(item));});
		} else {
			p.uri = t.shift();
			p.uriparts = p.uri.split('/');
		}
		t = t.join('?');
	}
	if (t.split('#',1)[0]){
		t = t.split('#');
		p.query = t.shift();
		s = p.query.split('&');
		s.forEach((item)=>{
			if (!item) return;
			r = item.split('=');
			if (decode) p.queryparts[r.shift()] = decodeUriComponent(r.join('='));
			else p.queryparts[r.shift()] = r.join('=');
		});
		t = t.join('#');
	}
	if (t) p.hash = t;
	return p;
};
	
function parseExternalMedia(url,req,res,next) {
	var m={},done,key,r={meta:{}};
	for(key in reeeee)if((m=reeeee[key].exec(url))!==null)break; 
	if (m === null) return next(new Error(url.substr(0,64)+(url.length>64?'[...]':'')+' did not match any supported embeds.'));
	r.processed = true; // External media do not need to generate thumbnails
	switch (key) { // meta: title size duration dims
		// case 'vocaroo':
		// case 'twitch':
		// case 'livestream':
		// case 'hitbox':
		// case 'ustream':
		case 'imgur':
			r.mediatype = 'img';
			r.src = m[0];
			r.thumb = 'https://i.imgur.com/'+m[2]+'s.jpg';
			r.hash = crypto.createHash('md5').update(key+':'+m[2]).digest('hex');
			r.meta.title = m[1];
			r.processed = true;
			break;
		case 'youtube':
			r.mediatype = 'you';
			r.src = 'https://www.youtube.com/embed/'+m[1]+'?vq=large&rel=0';
			if (m[2]) r.src += '&t='+m[2];
			else {
				if (m[3]) r.src += '&start='+m[3];
				if (m[4]) r.src += '&end='+m[4];
			}
			r.thumb = 'https://img.youtube.com/vi/'+m[1]+'/mqdefault.jpg'
			r.hash = crypto.createHash('md5').update(key+':'+m[1]).digest('hex');
			r.meta.link = '//youtu.be/'+m[1];
			done = false;
			request({url:'http://youtube.com/get_video_info?video_id='+m[1],timeout:5},(err,req,res)=>{
				if (err) {
					r.meta.title = 'Youtube Video';
					done = true;
					return;
				}
				let data = querystring.parse(res);
				r.meta.title = data.title;
				r.meta.duration = _.toHumanTime(data.length_seconds);
				done = true;
				return;
			});
			while (!done) deasync.runLoopOnce();
			break;
		case 'dailymotion':
			r.mediatype = 'dly';
			r.src = '//www.dailymotion.com/embed/video/'+m[1]+'?quality=480&sharing-enable=false&endscreen-enable=false';
			if (m[2]) r.src += '&start='+m[2];
			r.hash = crypto.createHash('md5').update(key+':'+m[1]).digest('hex');
			done = false;
			request({url:'//api.dailymotion.com/video/'+m[1]+'?fields=title,thumbnail_120_url,tiny_url,duration',timeout:5},(err,req,res)=>{
				if (err) {
					r.meta.title = 'Dailymotion Video';
					done = true
					return;
				}
				let data = querystring.parse(res);
				r.thumb = data.thumbnail_120_url;
				r.meta.title = data.title;
				r.meta.link = data.tiny_url;
				r.meta.duration = data.duration;
				done = true;
				return;
			});
			while (!done) deasync.runLoopOnce();
			break;
	}
	return r;
};

function parseInternalMedia(file,req,res,next) { // src hash thumb meta mediatype nsfw
	let r={meta:{}};
	switch (file.mimetype.toLowerCase()) { // meta: title size duration dims link
		case 'image/jpg':
		case 'image/jpeg':
		case 'image/jpe':
		case 'image/png':
			try {
				r.mediatype = 'img';
				r.meta.title = file.originalname;
				file.path = file.path.replace(/\\/g,'/');
				let fn = file.path.split('/')[file.path.split('/').length-1];
				r.src = '/'+req.params.board+'/media/'+fn;
				r.thumb = '/'+req.params.board+'/media/'+fn+'.thumb.jpg';
				fs.renameSync(__dirname+'/'+file.path,__dirname+'/assets'+r.src);
				res.locals.trackfiles.push('/assets'+r.src);
				r.hash = crypto.createHash('md5').update(fs.readFileSync(__dirname+'/assets'+r.src, 'utf8')).digest('hex');
				let done = false;
				easyimg.info(__dirname+'/assets'+r.src).then((file)=>{
					console.log('large',file);
					r.meta.dims = file.width+'x'+file.height;
					easyimg.resize({src:__dirname+'/assets'+r.src, dst:__dirname+'/assets'+r.thumb, quality:50, width:300, height:300}).then((file)=>{
						console.log('thumb',file);
						res.locals.trackfiles.push('/assets'+r.thumb);
						done = true;
					}).catch((err)=>{
						next(err);
						done = true;
					});
				}).catch((err)=>{
					next(err);
					done = true;
				});
				while (!done) deasync.runLoopOnce();
			} catch(err) {
				res.status(500);
				return next(err);
			}
			
			break;
		case 'image/gif':
			r.mediatype = 'img';
			
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
	}
	return r;
};
	
_.processPostMedia = function(req,res,next) {
	_.mkdir('./assets/'+req.params.board+'/media');
	let i = -1, media = [], f;
	while (++i < res.locals.board.mediauploadlimit) {
		if (req.body['media'+i]) {
			let m = parseExternalMedia(req.body['media'+i],req,res,next);
			m.nsfw = !!req.body['spoiler_media'+i];
			media.push(m);
		} else if (req.files && (f = req.files.filter((cur)=>{return cur.fieldname == 'media'+i;})).length) {
			let m = parseInternalMedia(f[0],req,res,next);
			m.nsfw = !!req.body['spoiler_media'+i];
			media.push(m);
		}
	}
	return media;
};

_.posterID = function(req,res,next){
	let trip = crypto.createHash('sha1')
		.update(req.ip)
		.update(req.params.board)
		.update(req.params.thread)
		.update(GLOBAL.cfg.site.secret)
		.digest();
	return crypto.createHash('sha1')
		.update(trip)
		.update(GLOBAL.cfg.site.secret)
		.digest()
		.toString('hex')
		.substr(0,GLOBAL.cfg.values.poster_id_length);	
};

_.processTrip = function(req,res,next){
	if (req.body.trip === null) return null;
	if (req.body.trip.indexOf('#') == 0) {
		req.body.trip = req.body.trip.substr(1);
		let i = -1;
		while (++i < GLOBAL.cfg.capcodes){
			if (req.body.trip.trim().toLowerCase() == res.locals.user.capcode.toLowerCase()){
				return ' ## '+res.locals.user.capcode;
			}
		}
		if (GLOBAL.cfg.custom_tripcodes['##'+req.body.trip])
			return '!!'+GLOBAL.cfg.custom_tripcodes['##'+req.body.trip];
		// if not a known capcode or custom trip, process as a secure trip
		let trip = crypto.createHash('sha256')
			.update('paranoid_normie.'+req.body.trip)
			.update(GLOBAL.cfg.site.secret)
			.digest();
		return '!!'+ crypto.createHash('sha1')
			.update(trip)
			.update(GLOBAL.cfg.site.secret)
			.digest()
			.toString('base64')
			.substr(0,10);
	} else {
		if (GLOBAL.cfg.custom_tripcodes['#'+req.body.trip])
			return '!'+GLOBAL.cfg.custom_tripcodes['#'+req.body.trip];
		// process as an unsecure trip
		let trip = crypto.createHash('sha256')
			.update('normie.'+req.body.trip)
			.digest();
		return '!'+crypto.createHash('sha1')
			.update(trip)
			.digest()
			.toString('base64')
			.substr(0,10);
	}
};

_.processMarkdown = function(req,res,next){
	// implement filters with PCRE based regex for faster processing
	return req.body.markdown; // placeholder
};

_.processMarkup = function(req,res,next){
	if (!GLOBAL.cfg.markup) 
		return encoder.htmlEncode(req.body.markdown)
			.replace(new RegExp("\r",'g'),'')
			.replace(new RegExp("\n",'g'),'<br>');
	let keys = GLOBAL.cfg.markdown, suppress = GLOBAL.cfg.supress_markup||null, 
		markup = req.body.markdown.replace(new RegExp("\r",'g'),''), depth = [], cursor = 0;
	if (suppress && markup.slice(0,suppress.all.length) == suppress.all)
		return encoder.htmlEncode(markup.splice(0,suppress.all.length));
	keys.forEach((item)=>{
		item.before = item.brick?'['+item.key+']':item.key;
		if (item.wrap) item.after = item.brick?'[/'+item.key+']':item.key;
		item.start = null;
	});
	while (1){
		if (suppress && markup.slice(cursor,suppress.paragraph.length+1) == "\n"+suppress.paragraph){
			// close depths
			let i = -1, c = 0;
			while (++i < depth.length){
				if (depth[depth.length-1-i].exclusiveline){
					depth.splice(depth.length-1-i,1);
					continue;
				}
			}
			i = -1;
			while (++i < depth.length){
				let t = depth[i], k = keys.indexOf(t),
					a = "\r"+k+"\r\r", b = "\r\r"+k+"\r";
				markup = markup.splice(t.start,t.before.length,b);
				cursor = cursor - t.before.length + b.length;
				markup = markup.splice(cursor,t.after.length,a);
				c = c + a.length;
			}
			cursor += c;
			markup = markup.splice(cursor,suppress.paragraph.length);
			while (markup.slice(cursor,++cursor) != "\n") if (cursor >= markup.length) break;
			// reopen depths in original order if not at the end of the markdown
			i = -1;
			if (cursor < markup.length) {
				while (++i < depth.length){
					depth[i].start = cursor;
					markup = markup.splice(cursor,0,depth[i].before);
					cursor += depth[i].before.length;
				}
			} else break;
		}
		if (suppress && markup.slice(cursor,suppress.open.length) == suppress.open){
			// check for the suppression close key first.
			if (markup.slice(cursor+suppress.open.length).indexOf(suppress.close) != -1){
				// close depths
				let i = -1, c = 0;
				while (++i <= depth.length){
					if (depth[depth.length-1-i].exclusiveline){
						depth.splice(depth.length-1-i,1);
						continue;
					}
					let t = depth[depth.length-1-i],k = keys.indexOf(t);
					markup = markup.splice(t.start,t.before.length,b);
					cursor = cursor - t.before.length + b;
					markup = markup.splice(cursor,t.after.length,a);
					c = c + a.length;
				}
				cursor += c;
				// remove suppression markup
				let start = cursor;
				while (markup.slice(cursor,suppress.close.length) != suppress.close){
					if (cursor >= markup.length) break;
					markup = markup.splice(start,suppress.open.length);
					markup = markup.splice(cursor,suppress.close.length);
					cursor++;
				}
				// reopen depths in original order
				i = -1;
				while (++i < depth.length){
					depth[i].start = cursor;
					markup = markup.splice(cursor,0,depth[i].before);
					cursor += depth[i].before.length;
				}
			}
		}
		let t = depth[depth.length-1];
		if (t && t.exclusivetext && t.after && markup.slice(cursor,t.after.length) == t.after){ 
			let k = keys.indexOf(t), a = "\r"+k+"\r\r", b = "\r\r"+k+"\r";
			markup = markup.splice(t.start,t.before.length,b);
			cursor = cursor - t.before.length + b.length;
			markup = markup.splice(cursor,t.after.length,a);
			cursor = cursor + a.length;
			continue;
		}
		let i = -1, skip = true;
		while (++i < keys.length){
			if (keys[i].after && markup.slice(cursor,keys[i].after.length) == keys[i].after && depth.indexOf(keys[i]) != -1) {
				if (keys[i].exclusiveline && markup.slice(cursor,1) != "\n") continue;
				// insert the text bookmarks for the opening and closing of the markdown
				depth.splice(depth.indexOf(keys[i]));
				let a = "\r"+i+"\r\r", b = "\r\r"+i+"\r";
				markup = markup.splice(keys[i].start,keys[i].before.length,b);
				cursor = cursor - keys[i].before.length + b.length;
				markup = markup.splice(cursor,keys[i].after.length,a);
				cursor = cursor + a.length;
				skip = false;
				break;
			} else if (markup.slice(cursor,keys[i].before.length) == keys[i].before) {
				// Bookmark the index of the markdown opening
				if (keys[i].exclusiveline && markup.slice(cursor-1,1) != "\n") continue;
				keys[i].start = cursor;
				depth.push(keys[i]);
				cursor += keys[i].before.length;
				skip = false;
				break;
			}
		}
		if (skip) cursor++;
		if (cursor >= markup.length) break;
	}
	// \r is the only character that is guarenteed to not be present before and after processing
	// because we remove all instances at the start of the processing so we use that as
	// the bookmark for the keys to allow for html sensitive characters to be 
	// used in markdown without accidental encoding errors.
	i = -1;
	while (++i < keys.length) 
		markup = encoder.htmlEncode(markup)
			.replace(new RegExp("\r\r"+i+"\r",'g'),keys[i].open)
			.replace(new RegExp("\r"+i+"\r\r",'g'),keys[i].close);
	return markup.replace(new RegExp("\n",'g'),'<br>');
};

module.exports = _;
