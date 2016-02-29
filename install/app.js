"use strict";
var fs = require('fs'), readline = require('readline'), deasync = require('deasync'), crypto = require('crypto'),
	pgp = require('pg-promise')({ promiseLib: require('bluebird') }), cfg, yn = /^y(?:es)?/i,
	yml = {read: require('read-yaml').sync, write: require('write-yaml').sync};
	
	
function prompt(question,validate,notempty) {
	var res,rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		terminal: false
	});
	if (validate && !validate instanceof RegExp) validate = new RegExp(validate.toString());
	do {
		if (res !== undefined) {
			if (notempty && res === '') console.log('Input cannot be empty.');
			else console.log('Invalid input.');
			res = undefined;
		}
		rl.question(question, (input) => res = input);
		while (res === undefined) deasync.runLoopOnce();
	} while ((notempty && res === '') || (validate && !validate.test(res)));
	rl.close();
	if (/^\d+$/i.test(res)) return parseInt(res);
	if (/^\d+\.\d+$/i.test(res)) return parseFloat(res);
	else return res;
}

if (fs.existsSync('./config.yml')) cfg = yml.read('./config.yml');
else {
	console.log('Missing config. Creating file and generating new site secret value.');
	cfg = yml.read('./install/default.yml');
	let hash = crypto.createHash('sha256');
	hash.update(Math.random().toString());
	cfg.site.secret = hash.digest('hex');
	yml.write('./config.yml',cfg);
}
	
if (fs.existsSync('./install/done')) {
	console.log('App has already been installed. These actions are destructive. Please eneter the site secret from the config file to continue.');
	if (prompt('Secret: ',/\w+/) != cfg.site.secret) return pgp.end(),console.log('Secret mismatch. Exiting.');
}

if (yn.test(prompt('Configure the database connection? (y/n): '))) {
	let tdb = {};
	do {
		console.log('Please fill out the following information.  (Leave empty for existing value)');
		console.log('');
		tdb.host = prompt('hostname/address: ') || tdb.host || cfg.database.host || 'localhost';
		tdb.port = prompt('port number: ') || tdb.port || cfg.database.port || '5433';
		tdb.database = prompt('database name: ') || tdb.database || cfg.database.database || 'tauchan';
		tdb.user = prompt('database user: ') || tdb.user || cfg.database.user || 'postgres';
		tdb.password = prompt('database user password: ') || tdb.password || cfg.database.password || 'postgres';
		console.log('Database reconfigured as: '+ tdb.user+':'+tdb.password+'@'+tdb.host+':'+tdb.port+'/'+tdb.database);
	} while (!yn.test(prompt('Is this configuration correct? (y/n): ')));
	cfg.database = tdb;
	yml.write('./config.yml',cfg);
}

if (!cfg.database) return pgp.end(),console.log('Unable to load database configuration. Please check the config file for errors. Exiting.');

var sql = (file) => pgp.QueryFile(file,{debug: true, minify: false}),
	db = pgp(cfg.database);
	
if (1) {
	console.log('Checking Postgres version...');
	let done = false, dbname, version = false;
	db.one('SELECT version();').then((data) => {
		dbname = data.version.split(' ')[0];
		version = data.version.split(',')[0].split(' ')[1];
		done = true;
	}).catch((err) => {
		console.log(err);
		done = null;
	});
	while (done === false) deasync.runLoopOnce();
	if (done === null) return pgp.end(),console.log('Postgres version check failed. Exiting.');
	if (!dbname || dbname != 'PostgreSQL') 
		return pgp.end(),console.log('Connection is not a postgres database. Please make sure you have postgres 9.5.0 or greater installed.');
	let v = version.split('.');
	if (parseInt(v[0]) < 9 && parseInt(v[1]) < 5 && parseint(v[2]) < 0) 
		return pgp.end(),console.log('Postgres version mismatch. Connection is running '+version+', please upgrade to at least 9.5.0. Exiting.');
}

if (1) {
	console.log('Wiping the database...');
	let done = false;
	db.none(sql('./install/wipe.sql')).then((data) => {
		console.log('Success');
		done = true;
	}).catch((err) => {
		console.log(err);
		done = null;
	});
	while (done === false) deasync.runLoopOnce();
	if (done === null) return pgp.end(),console.log('Wipe failed. Exiting.');
}

if (1) {
	console.log('Installing the database...');
	let done = false;
	db.tx((self) => {
		return self.batch([
			self.none(sql('./install/setup.sql')),
			self.none(sql('./install/tables.sql')),
			self.none(sql('./install/functions.sql'))
		]);
	}).then(() => {
		console.log('Success');
		done = true;
	}).catch((err) => {
		console.log(err);
		done = null;
	});
	while (done === false) deasync.runLoopOnce();
	if (done === null) return pgp.end(),console.log('Install failed. Exiting.');
}

console.log('Database has been installed.');

cfg.site.name = prompt("What do you want the site's name to be? (Leave empty for existing value): ") || cfg.site.name;

if (yn.test(prompt('Do you want to configure the additional options available for the app? (y/n): '))) {
	console.log('Answer the following questions with either a yes or no. (y/n is fine as well)');
	let questions = yml.read('./install/options.yml'), missed = [];
	for (key in cfg.options) { if (cfg.options.hasOwnProperty(key)) { 
		if (questions.hasOwnProperty(key)) {
			if (questions[key]) cfg.options[key] = yn.test(prompt(questions[key],null,true));
		} else missed.push(key);
	}}
	yml.write('./config.yml',cfg);
	console.log('Option configuration complete.' + (missed.length ? ' (This configuration has not covered all the available options. Please see /config.yml for the full list.)':''));
}

console.log("Application installation completed. You can start the app by running 'node app.js' from the app's root directory.");

pgp.end();

fs.writeFileSync('./install/done',cfg.version);
