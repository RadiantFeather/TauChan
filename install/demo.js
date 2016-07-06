"use strict";
var pgp = require('pg-promise')({promiseLib: require('bluebird')}),
	yml = {read: require('read-yaml'), write: require('write-yaml')},
	deasync = require('deasync'), crypto = require('crypto'),
	cfg = yml.read.sync('./conf/config.yml'),
	sql = (file) => pgp.QueryFile(file,{debug: true, minify: false}),
	db = pgp(cfg.database);
	
function genip(){
	if (Math.random()>=0.5) { //IP4 or IP6
		let i = -1, x = [];
		while (++i < 4) x.push(parseInt(Math.random()*255));
		return x.join('.');
	} else {
		let i = -1, x = [];
		let r = crypto.createHash('sha256').update(Math.random().toString()).digest('hex').substring(0,32);
		while (++i < 8)	x.push(r.substring(i*4,i*4+4));
		return x.join(':');
	}
}

var posts = [
	['b', 'MEMES! CAN NOT GET ENOUGH MEMES!']
	,['b', 'I drooled on my grillfriend\'s ice-cream. I wonder if she noticed...']
	,['a', 'This thread belongs to SquidGirl. The squidvasion continues!']
	,['a', 'Waifu thread.']
	,['a', 'Palm-top Tiger is best tiger.']
	,['news', 'Greece got raped again.']
	,['news', 'Can\'t stump the trump.']
	,['pol', 'Hitler did nothing wrong.']
	,['pol', 'Putin is right on the money.']
	,['pone', 'HEY ANON!']
	,['pone', 'Claim your waifu before some other faggot gets her!']
	,['isis', 'Two new recruits to the DurkaDurka division.']
];

let i = -1, ips = [], j, k, l;
while (++i < posts.length){
	posts[i].push(posts[i][posts[i].length-1])
	if (Math.random() <= 0.75 || ips.length == 0) {
		let x = genip();
		posts[i].push(x);
		ips.push(x);
	} else posts[i].push(ips[parseInt(Math.random()*ips.length)]);
	j = -1;
	while (++j < posts[i].length)
		posts[i][j] = "'"+posts[i][j].replace("'","''")+"'";
	posts[i].push("(NOW() - '"+parseInt(Math.random()*1440000)+" minutes'::INTERVAL)");
}
console.log(posts);
i = -1, j = [];
while (++i < posts.length) {
	j.push(posts[i].join(','));
}
let postsql = 'INSERT INTO post (board, markdown, markup, ip, posted) VALUES (' + j.join('),(') + ');';

console.log('Setting up the demo...');
let done = false;
db.tx((self) => {
	return self.batch([
		self.none(sql('./install/demosetup.sql')),
		self.none(postsql)
	]);
}).then(() => {
	console.log('Success');
	done = true;
}).catch((err) => {
	console.log(postsql);
	console.log(err);
	done = null;
});
while (done === false) deasync.runLoopOnce();
if (done === null) return pgp.end(),console.log('Setup failed. Exiting.');
return pgp.end(), console.log('Demo setup is complete.');
