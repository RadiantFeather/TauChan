"use strict";
var fs = require('fs'),
	deasync = require('deasync'),
	// cache = require('redis'),
	// socket = require('socekt.io'),
	crypto = require('crypto'),
	qs = require('querystring'),
	// ffmpeg = require('fluent-ffmpeg'),
	request = require('request'), gm = require('gm'),
	encoder = new (require('node-html-encoder')).Encoder('entity'),
	yml = {read: require('read-yaml'), write: require('write-yaml')},
	
	_ = {};
	
GLOBAL.cfg = GLOBAL.cfg||yml.read.sync('./conf/config.yml');
	
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
	
_.toInterval = function(seconds,mode){
	let s = seconds%60;
	let m = (seconds>=60?Math.round(seconds/60):null);
	let h = (m&&m>=60?Math.round(seconds/60/60):null);
	let d = (h&&h>=24?Math.round(seconds/60/60/24):null);
	switch(mode){
		case 1:
			return (h!==null?h+'h ':'')+(m!==null?(m%60)+'m ':'')+s+'s '; // eg. 5h 12m 42s
		case 2:
			return (h!==null?h:'')+':'+(m===null?'00':(m=m%60)>9?m:'0'+m)+':'+(s>9?s:'0'+s); // eg. 5:12:42
		default:
			return (d!==null?d+' days ago':d) // eg. 4 days ago
			||	   (h!==null?h+' hours ago':h) // eg. 12 hours ago
			||	   (m!==null?m+' minutes ago':m) // eg. 32 minutes ago
			||	   'Just Now'; // anything less than a minute
	}
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
			this.port = parseInt(s.pop());
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
		this.query = qs.parse(t.shift())
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
	
function parseExternalMedia(url) {
	let s,m=null,done,key,found,r={meta:{}};
	for(key of GLOBAL.cfg.external_media) {
		if (key.regex instanceof Array){
			for (let val of key.regex)
				if (val.test(url)){
					found = key;
					break;
				}
			if (found) break;
		} else if (key.regex.test(url)){
			found = key;
			break;
		}
	}
	let err = new Error(url.substr(0,64)+(url.length>64?'[...]':'')+' did not match any supported embeds.');
	if (!found) return err;
	m = new URL(url);
	r.processed = true; // External media do not need to generate thumbnails
	let id = 'temp';
	switch (found) { // meta: title size duration dims
		// case 'vocaroo':
		// case 'twitch':
		// case 'livestream':
		// case 'hitbox':
		// case 'ustream':
		case 'imgur':
			if (!m.uri[0]) return err;
			id = m.uri[0].split('.')[0];
			r.mediatype = 'img';
			r.src = 'https://i.imgur.com/'+m.uri[0];
			r.href = 'https://imgur.com/'+m.uri[0];
			r.thumb = 'https://i.imgur.com/'+id+'s.jpg';
			r.hash = crypto.createHash('md5').update(found+'&'+id).digest('hex');
			r.meta.title = m.uri[0];
			r.processed = true;
			break;
		case 'youtube':
			id = m.domainString()=='youtu.be'?m.uri[0]:m.query.v;
			if (!id) return err;
			r.mediatype = 'you';
			s = new URL('https://www.youtube.com/embed/'+id+'?vq=large&rel=0');
			if (m.query.t) s.query.t = m.query.t;
			else {
				if (m.query.start) s.query.start = m.query.start;
				if (m.query.end) s.query.end = m.query.end;
			}
			r.src = s.stringify();
			r.thumb = 'https://img.youtube.com/vi/'+id+'/mqdefault.jpg';
			r.hash = crypto.createHash('md5').update(found+'&'+id).digest('hex');
			r.href = 'https://youtu.be/'+id;
			done = false;
			request({url:'https://youtube.com/get_video_info?video_id='+id,timeout:5},(err,req,res)=>{
				if (err) {
					r.meta.title = 'Youtube Video';
					done = true;
					return;
				}
				let data = qs.parse(res);
				r.meta.title = data.title;
				r.meta.duration = _.toInterval(data.length_seconds,2);
				done = true;
				return;
			});
			while (!done) deasync.runLoopOnce();
			break;
		case 'dailymotion':
			id = m.domainString()=='dai.ly'?m.uri[0]:m.uri[1].split('_')[0];
			if (!id) return err;
			r.mediatype = 'dly';
			s = new URL('https://www.dailymotion.com/embed/video/'+id+'?quality=480&sharing-enable=false&endscreen-enable=false');
			if (m.query.start) s.query.start = m.query.start;
			r.src = s.stringify();
			r.href = 'https://dai.ly/'+id;
			r.hash = crypto.createHash('md5').update(found+'&'+id).digest('hex');
			done = false;
			request({url:'https://api.dailymotion.com/video/'+id+'?fields=title,thumbnail_120_url,duration',timeout:5},(err,req,res)=>{
				let data = qs.parse(res);
				if (err) {
					try{r.meta.title = m.uri[1].split('_')[1];}
					catch(e){r.meta.title = 'Dailymotion Video';}
					done = true;
					return;
				}
				r.thumb = data.thumbnail_120_url;
				r.meta.title = data.title;
				r.meta.duration = _.toInterval(data.duration,2);
				done = true;
				return;
			});
			while (!done) deasync.runLoopOnce();
			break;
	}
	return r;
}

function parseInternalMedia(file,board,trackfiles) { // src hash thumb meta mediatype nsfw
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
				r.src = r.href = '/'+board+'/media/'+fn;
				r.thumb = '/'+board+'/media/'+fn+'.thumb.jpg';
				fs.renameSync(__dirname+'/'+file.path,__dirname+'/assets'+r.src);
				trackfiles.push('/assets'+r.src);
				r.hash = crypto.createHash('md5').update(fs.readFileSync(__dirname+'/assets'+r.src, 'utf8')).digest('hex');
				let done = false;
				gm(__dirname+'/assets'+r.src).size((err, size)=>{
					if (err){
					r = err;
						done = true;
					} else {
						r.meta.dims = size.width+'x'+size.height;
						this.resize(300, 300);
						this.write(__dirname+'/assets'+r.thumb,(err)=>{
							if (err) {
								r = err;
								done = true;
							} else {
								console.log('thumb',file);
								trackfiles.push('/assets'+r.thumb);
								done = true;
							}
						});
					}
				});
				while (!done) deasync.runLoopOnce();
			} catch(err) {
				return err.setstatus(500);
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
		default:
			let err = 'Unsupported media type: '+ file.mimetype.toLowerCase() +' - '+ file.originalName;
			return (new Error(err)).setstatus(415);
	}
	return r;
}
	
_.processPostMedia = function(board,body,files,trackfiles) {
	this.mkdir('./assets/'+board.board+'/media');
	let i = -1, media = [], f;
	while (++i < board.mediauploadlimit) {
		if (!body['include'+i]) break;
		if (!body['is_external'+i]) {
			let m = parseExternalMedia(body['in_media'+i]);
			if (m instanceof Error) return m;
			m.nsfw = !!body['spoiler_media'+i];
			media.push(m);
		} else if (files) {
			f = files.filter((cur)=>{return cur.fieldname == 'out_media'+i;});
			if (!f.length) continue;
			let m = parseInternalMedia(f[0],board.board,trackfiles);
			if (m instanceof Error) return m;
			m.nsfw = !!body['spoiler_media'+i];
			media.push(m);
		}
	}
	return media;
};

_.posterID = function(ip,board,thread){
	let trip = crypto.createHash('sha1')
		.update(ip)
		.update(board)
		.update(thread.toString())
		.update(GLOBAL.cfg.secret)
		.digest();
	return crypto.createHash('sha1')
		.update(trip)
		.update(GLOBAL.cfg.secret)
		.digest()
		.toString('hex')
		.substr(0,GLOBAL.cfg.values.poster_id_length);
};

_.processTrip = function(trip,capcode){
	if (trip === null) return null;
	let t = trip;
	if (trip.indexOf('#') == 0) {
		let trip = t;
		trip = trip.substr(1);
		let i = -1;
		if (capcode && GLOBAL.cfg.capcodes) 
			while (++i < GLOBAL.cfg.capcodes){
				if (trip.trim().toLowerCase() == capcode.toLowerCase()){
					return ' ## '+capcode;
				}
			}
		if (GLOBAL.cfg.custom_tripcodes && '##'+trip in GLOBAL.cfg.custom_tripcodes)
			return '!!'+GLOBAL.cfg.custom_tripcodes['##'+trip];
		// if not a known capcode or custom trip, process as a secure trip
		trip = crypto.createHash('sha256')
			.update('paranoid_normie')
			.update(trip)
			.update(GLOBAL.cfg.secret)
			.digest();
		return '!!'+ crypto.createHash('sha1')
			.update(trip)
			.update(GLOBAL.cfg.secret)
			.digest()
			.toString('base64')
			.substr(0,10);
	} else {
		let trip = t;
		if (GLOBAL.cfg.custom_tripcodes && '#'+trip in GLOBAL.cfg.custom_tripcodes)
			return '!'+GLOBAL.cfg.custom_tripcodes['#'+trip];
		// process as an unsecure trip
		trip = crypto.createHash('sha256')
			.update('normie')
			.update(trip)
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
	let cursor = 0;
	
	
};

_.processTicker = function(markdown){
	// Ticker only should allow INLINE markup. No exclusive lines.
	let keys = GLOBAL.cfg.markdown.custom, depth = [], track = [], cursor = 0,
		markup = markdown.replace(new RegExp("\r",'g'),'');
	keys.forEach((item)=>{
		item.before = item.brick?'['+item.key+']':item.key;
		item.after = item.brick?'[/'+item.key+']':item.key;
		item.start = [];
	});
	while (1){
		let e = depth[depth.length-1];
		if (e && e.exclusivetext && e.after && markup.substr(cursor,e.after.length) == e.after){
			let k = keys.indexOf(e), a = "\r"+k+"\0\r", b = "\r\0"+k+"\r";
			markup = markup.splice(e.start[e.start.length-1],e.before.length,b);
			cursor = cursor - e.before.length + b.length;
			markup = markup.splice(cursor,e.after.length,a);
			cursor = cursor + a.length;
			e.start.pop();
			track.push(e);
			depth.pop();
			continue;
		}
		let i = -1, skip = true;
		while (++i < keys.length){
			let t = keys[i];
			if (t.after && depth.indexOf(t) != -1 && markup.substr(cursor,t.after.length) == t.after) {
				if (t.exclusiveline) continue;
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
				markup = markup.splice(t.start[t.start.length-1],t.before.length,b);
				cursor = cursor - t.before.length + b.length;
				markup = markup.splice(cursor,t.after.length,a);
				cursor = cursor + a.length;
				depth.splice(depth.lastIndexOf(t));
				t.start.pop();
				track.push(t);
				skip = false;
				break;
			} else if (markup.substr(cursor,t.before.length) == t.before && markup.substr(cursor,t.before.length+t.after.legnth) != t.before+t.after) {
				// Bookmark the index of the markdown opening
				if (t.exclusiveline) continue;
				t.start.push(cursor);
				depth.push(t);
				cursor += t.before.length;
				
				if (t.exclusivetext){
					// exclusivetext ignores all markdown (including suppression) until its closing text
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
	return markup;
};

_.processMarkup = function(markdown){
	if (!GLOBAL.cfg.markdown)
		return encoder.encodeHTML(markdown)
			.replace(new RegExp("&#13;",'g'),'')
			.replace(new RegExp("&#10;",'g'),'<br>');
	let keys = GLOBAL.cfg.markdown.custom, ignore = GLOBAL.cfg.markdown.ignore||null, 
		list = GLOBAL.cfg.markdown.list||{}, hlink = GLOBAL.cfg.markdown.hyperlink,
		markup = markdown.replace(new RegExp("\r",'g'),''), depth = [], track = [],
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
			markup = markup.splice(e.start[e.start.length-1],e.before.length,b);
			cursor = cursor - e.before.length + b.length;
			markup = markup.splice(cursor,e.after.length,a);
			cursor = cursor + a.length;
			e.start.pop();
			track.push(e);
			depth.pop();
			continue;
		}
		let i = -1, skip = true;
		while (++i < keys.length){
			let t = keys[i];
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
				markup = markup.splice(t.start[t.start.length-1],t.before.length,b);
				cursor = cursor - t.before.length + b.length;
				markup = markup.splice(cursor,t.after.length,a);
				cursor = cursor + a.length;
				depth.splice(depth.lastIndexOf(t));
				t.start.pop();
				track.push(t);
				skip = false;
				break;
			} else if (markup.substr(cursor,t.before.length) == t.before && markup.substr(cursor,t.before.length+t.after.legnth) != t.before+t.after) {
				// Bookmark the index of the markdown opening
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
					// exclusivetext ignores all markdown (including suppression) until its closing text
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
		// if (list){
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
		if (markup.substr(cursor,hlink.length) == hlink && cursor+hlink.length+1 < markup.length){
			let ws = ["\n","\t"," "];
			if (ws.indexOf(markup.substr(cursor-1,1)) != -1 && ws.indexOf(markup.substr(cursor+hlink.length,1)) == -1){
				// Place bookmarks for inserting hyperlinks
				let a = "\r"+links.length+"\0\0\0\0\r", b = "\r\0\0\0\0"+links.length+"\r";
				markup = markup.splice(cursor,hlink.length,b);
				cursor += b.length;
				let start = cursor;
				while (ws.indexOf(markup.substr(cursor,1)) == -1 && cursor < markup.length)
					cursor++;
				let str = markup.slice(start,cursor);
				markup = markup.splice(cursor,0,a);
				cursor += a.length;
				links.push(str);
				console.log(str);
				
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
	// insert html for any hyperlinks found
	i = -1;
	while(++i < links.length)
	markup = markup
		.replace(new RegExp("&#13;&#0;&#0;&#0;&#0;"+i+"&#13;",'g'),'<a href="'+encoder.htmlEncode(links[i])+'">')
		.replace(new RegExp("&#13;"+i+"&#0;&#0;&#0;&#0;&#13;",'g'),'</a>');
	// replace \n (aka &#10;) with <br> nodes
	return markup.replace(new RegExp("&#10;",'g'),'<br>');
};

_.maskIP = function(ip){
	let cipher = crypto.createCipher('bf-cbc',GLOBAL.cfg.secret);
	let mask = cipher.update(ip,'utf8','hex');
	return mask + cipher.final('hex');
};
_.unmaskIP = function(mask){
	let decipher = crypto.createDecipher('bf-cbc',GLOBAL.cfg.secret);
	let data = decipher.update(mask,'hex','utf8');
	return data + decipher.final('utf8');
};

_.genCSRF = function(ip,path){
	return crypto.createHash('sha256')
		.update(GLOBAL.cfg.secret)
		.update(ip)
		.update(path)
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
if (GLOBAL.cfg.devmode) {
	var RegFlag = (flag)=>{
		let d = -1, level = GLOBAL.flags;
		while (++d < flag.length){
			if (!level[flag[d]]) level[flag[d]] = {};
			level = level[flag[d]];
		}
		level[flag[d]] = 'The flag '+flag.join('.')+' has not yet been described.';
		console.log('Please define flag: '+flag.join('.'))
		yml.write('./flags.yml',GLOBAL.flags,()=>{});
	};
}
User.prototype.auth = function(flag,def,ault){
	let testRule = function testRule(check) {
		if (!(check in u.roles[board].flags) && !('global@'+check in u.roles[board].flags))				
			return !!def;
		else if (!u.roles[board].flags[check] && !u.roles[board].flags['global@'+check])
			return false;
		else return testRule;
	};
	let board = this.currentBoard;
	if (typeof def == 'string')	// allow auth for multiple boards
		board = def, def = ault;
	let u = board in this.roles?this.roles[board]:{};
	if (u.role == 'owner') return true;
	if (this.flags == null || !this.reg) return !!def;
	if (typeof flag == 'string') flag = [flag];
	let i = -1;
	while (++i < flag.length) {
		let ctx = flag[i].split('!');
		flag[i] = ctx.shift();
		if (ctx.length > 1) ctx = ctx.shift();
		else ctx = 'all';
		let level, d = -1, f = flag[i].split('.');
		level = GLOBAL.flags;
		while (++d < f.length){
			if (f[d] in level){
				level = level[f[d]];
				continue;
			} else RegFlag(f);
		}
		if (typeof level == 'object'){
			let len = Object.keys(level).length,total=0;
			for (let x in level){
				let y = testRule(f+'.'+x);
				if (ctx == 'all' && total != len)
					if (y === testRule) total++;
					else return false;
				else if (ctx == 'any')
					if (y === testRule) return true;
			}
			return (total == len);
		}
		let y = testRule(flag[i]);
		if (!(y === testRule)) return y;
	}
	return true;
};
// User Cookie: res.cookie('user',req.session.id,{httpOnly:true,maxAge:1000*60*60*24*7});
_.User = User;

module.exports = _;
