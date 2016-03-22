"use strict";
var fs = require('fs'),
	deasync = require('deasync'),
	// cache = require('redis'),
	// socket = require('socekt.io'),
	crypto = require('crypto'),
	qs = require('querystring'),
	ffmpeg = require('fluent-ffmpeg'),
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
	try { fs.statSync(path); } 
	catch (e) { fs.mkdirSync(path); }
};
	
_.toHumanTime = function(seconds){
	let s = seconds%60;
	let m = (seconds>=60?seconds/60%60:null);
	let h = (m&&m>=60?seconds/60/60%24:null);
	return (h!==null?h+'h':'')+(m!==null?m+'m':'')+s+'s';
};
	
function parseExternalMedia(url,req,res,next) {
	var m={},done,key,r={meta:{}};
	for(key in reeeee)if((m=reeeee[key].exec(url))!==null)break; 
	if (m === null) return next(new Error(url+' did not match any supported embeds.'));
	r.processed = true; // External media do not need to generate thumbnails
	switch (key) { // meta: title size duration dims
		case 'imgur':
			r.mediatype = 'img';
			r.loc = m[0];
			r.thumb = 'https://i.imgur.com/'+m[2]+'s.jpg';
			r.hash = crypto.createHash('md5').update(key+':'+m[2]).digest('hex');
			r.meta.title = m[1];
			r.processed = true;
			break;
		case 'youtube':
			r.mediatype = 'you';
			r.loc = 'https://www.youtube.com/embed/'+m[1];
			if (m[2]) r.loc += '?t='+m[2];
			else {
				if (m[3]) r.loc += '?start='+m[3];
				if (m[4]) r.loc += (m[3]?'&':'?')+'end='+m[4];
			}
			r.thumb = 'https://img.youtube.com/vi/'+m[1]+'/mqdefault.jpg'
			r.hash = crypto.createHash('md5').update(key+':'+m[1]).digest('hex');
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
			})
			while (!done) deasync.runLoopOnce();
			break;
	}
	return r;
	
};

function parseInternalMedia(file,req,res,next) { // loc hash thumb meta mediatype nsfw
	let r={meta:{}};
	switch (file.mimetype) { // meta: title size duration dims
		case 'image/jpg':
		case 'image/png':
			try {
				r.mediatype = 'img';
				r.meta.title = file.originalname;
				file.path = file.path.replace('\\','/');
				let filename = file.path.split('/')[file.path.split('/').length-1];
				r.src = '/assets/'+req.params.board+'/media/'+filename;
				r.thumb = '/assets/'+req.params.board+'/media/thumb.'+filename.split('.')[1]+'.jpg';
				fs.renameSync(__dirname+'/'+file.path,__dirname+r.src);
				r.hash = crypto.createHash('md5').update(fs.readFileSync(__dirname+r.src, 'utf8')).digest('hex');
				let done = false;
				easyimg.info(__dirname+r.src).then((file)=>{
					console.log('large',file);
					r.meta.dims = file.width+'x'+file.height;
					easyimg.resize({src:__dirname+r.src, dst:__dirname+r.thumb, quality:50, width:300, height:300}).then((file)=>{
						console.log('thumb',file);
						done = true;
					}).catch((err)=>{
						console.log(err);
						next(err);
						done = true;
					});
				}).catch((err)=>{
					console.log(err);
					next(err);
					done = true;
				});
				while (!done) deasync.runLoopOnce();
			} catch(err) {
				console.log(err);
				res.status(500);
				return next(err);
			}
			
			break;
		case 'image/gif':
			r.mediatype = 'img';
			
			break;
		case 'video/webm':
			r.mediatype = 'vid';
			
			break;
		case 'video/mp4':
			r.mediatype = 'vid';
			
			break;
	}
	return r;
};
	
_.processPostMedia = function(req,res,next) {
	_.mkdir('./assets/'+req.params.board+'/media');
	let i = -1, media = [], f;
	while ((++i||1) && i < res.locals.board.mediauploadlimit) {
		console.log(i, media.length);
		if (req.body['media'+i]) {
			let m = parseExternalMedia(req.body['media'+i],req,res,next);
			m.nsfw = !!req.body['spoiler_media'+i];
			media.push(m);
			console.log(m);
		} else if ((f = req.files.filter((cur)=>{return cur.fieldname == 'media'+i;})).length) {
			let m = parseInternalMedia(f[0],req,res,next);
			m.nsfw = !!req.body['spoiler_media'+i];
			media.push(m);
			console.log(m);
		}
	}
	return media;
}

module.exports = _;
