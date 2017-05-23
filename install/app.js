"use strict";
if (process.cwd().endsWith('install'))
	process.chdir('..');
const CWD = process.cwd();
//*/

const fs = require('fs');
const ReadLine = require('readline');
const Crypto = require('crypto');
const Config = require('../config');

/*/
	
import * as fs from 'fs';
import ReadLine from 'readline';
import Crypto from 'crypto';
import Config from '../config';
//*/

var cfg = Config.cfg;
const pgp = Config.pgp;
const db = Config.db;
const yml = Config.yml;
const yn = /^y(?:es)?/i;

(async()=>{
	const sql = (file) => pgp.QueryFile(path(file),{debug: true, minify: false});
	// Parse options
	var opt,CLO = {s:{},l:{}};
	do {
		let x=-1, targs = process.argv.slice(2);
		while (++x < targs.length){
			if (targs[x].indexOf('--') == 0){
				let y = targs[x].slice(2).split('=');
				CLO.l[y.shift()] = y.join('=')||true;
			} else if (targs[x].indexOf('-') == 0){
				let y = targs[x].slice(1).split();
				CLO.s[y] = targs[x+1]||true;
			}
		}
	} while(0);
	
	const ask = async function(prompt, stdinout){
		if (!stdinout)
			stdinout = ReadLine.createInterface({
				input: process.stdin,
				output: process.stdout,
				terminal: false
			});
		return new Promise((res,rej)=>{
			stdinout.question(prompt.toString(),(input)=>{res(input)});
		});
	};
		
	const prompt = async function prompt(question,validate,notempty) {
		const rl = ReadLine.createInterface({
			input: process.stdin,
			output: process.stdout,
			terminal: false
		});
		var res;
		if (validate && !validate instanceof RegExp) validate = new RegExp(validate.toString());
		do {
			if (res !== undefined) {
				if (notempty && res === '') console.log('Input cannot be empty.');
				else console.log('Invalid input.');
				res = undefined;
			}
			res = await ask(question);
		} while ((notempty && res === '') || (validate && !validate.test(res)));
		rl.close();
		if (/^\d+$/i.test(res)) return parseInt(res,10);
		if (/^\d+\.\d+$/i.test(res)) return parseFloat(res,10);
		else return res;
	};
	
	function updatable(stale,fresh) {
		stale = stale.split('.');
		fresh = fresh.split('.');
		let i = -1, maxlength = (stale.length < fresh.length ? fresh.length : stale.length);
		while (++i < maxlength) {
			if (stale[i] === undefined) stale[i] = 0;
			if (fresh[i] === undefined) fresh[i] = 0;
			if (parseInt(fresh[i],10) > parseInt(stale[i],10)) return true;
		}
		return false;
	}
	
	function exists(_path) {
		try {
			fs.statSync(path(_path));
			return true;
		} catch (e) {
			return false;
		}
	}
	function mkdir(_path){
		if (exists(_path)) return;
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
	}
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
	
	const dcfg = yml.read.sync(path('/install/default.yml'));
	  
	if (!exists('/assets/_/media')) mkdir('/assets/_/media');
	if (!exists('/cache/uploads')) mkdir('/cache/uploads');
	if (!exists('/conf')) mkdir('/conf');
	
	if (exists('/conf/config.yml')) cfg = yml.read.sync(path('/conf/config.yml'));
	else {
		console.log('Missing config. Creating file and generating new site secret value.');
		cfg = yml.read.sync(path('/install/default.yml'));
		cfg.secret = Crypto.createHash('sha256').update(Math.random().toString()).digest('hex');
		yml.write.sync(path('/conf/config.yml'),cfg);
	}
	if ((opt = CLO.s.h || CLO.l.host) instanceof String) cfg.database.host = opt;  
	if (parseInt(opt = CLO.s.p || CLO.l.port,10) instanceof Number) cfg.database.port = opt;  
	if ((opt = CLO.s.d || CLO.l.database) instanceof String) cfg.database.database = opt;  
	if ((opt = CLO.s.u || CLO.l.username) instanceof String) cfg.database.username = opt;  
	if ((opt = CLO.s.p || CLO.l.password) instanceof String) cfg.database.password = opt;  
	if ((opt = CLO.s.c || CLO.l.conn) instanceof String) {
		let x = opt.split("@");
		if (x.length > 1) {
			let y = x.shift().split(':');
			if (y.length > 1) cfg.database.password = y.pop();
			cfg.database.username = y.pop();
		}
		x = x[0].split('/');
		if (x.length > 1){
			cfg.database.database = x.pop();
		}
		x = x[0].split(':');
		if (x.length > 1){
			cfg.database.port = x.pop();
		}
		cfg.database.host = x.pop();
	}
	
	const VERSION = {stale: cfg.version, fresh: dcfg.version};
	
	if (!CLO.s.q && yn.test(await prompt('Configure the database connection? (y/n): '))) {
		let tdb = {};
		do {
			console.log('Please fill out the following information.  (Leave empty for existing value)');
			console.log('');
			tdb.host = tdb.host || cfg.database.host || 'localhost';
			tdb.host = await prompt('hostname/address ('+tdb.host+'): ') || tdb.host;
			tdb.port = tdb.port || cfg.database.port || '5433';
			tdb.port = await prompt('port number ('+tdb.port+'): ') || tdb.port;
			tdb.database = tdb.database || cfg.database.database || 'tauchan';
			tdb.database = await prompt('database name ('+tdb.database+'): ') || tdb.database;
			tdb.user = tdb.user || cfg.database.user || 'tauchan';
			tdb.user = await prompt('database user ('+tdb.user+'): ') || tdb.user;
			tdb.password = tdb.password || cfg.database.password || 'tauchan';
			tdb.password = await prompt('database user password ('+tdb.password+'): ') || tdb.password;
			console.log('Database connection reconfigured as: '+ tdb.user+':'+tdb.password+'@'+tdb.host+':'+tdb.port+'/'+tdb.database);
		} while (!yn.test(await prompt('Is this configuration correct? (y/n): ')));
		cfg.database = tdb;
		yml.write.sync(path('/conf/config.yml'),cfg);
	}
	
	if (!cfg.database) return pgp.end(),console.log('Unable to load database configuration. Please check the config file for errors. Exiting.');
	
	
	if (!exists('/conf/installed') || CLO.s.q || yn.test(await prompt('Do you want to configure the database? (y/n): '))) {
		let versions = fs.readdirSync(path('/install')).filter((cur)=>{ 
			let c = cur.split('/'), ver = /update\.(\d+\.\d+\.\d+)\.sql$/.exec(c[c.length-1]);
			if (ver !== null) console.log(VERSION.stale,ver[1],updatable(VERSION.stale,ver[1]));
			return (ver !== null && updatable(VERSION.stale,ver[1])); 
		});
		if (exists('/conf/installed') && versions.length) {
			if (CLO.s.q || yn.test(await prompt('Updates are available. Would you like to update the site database? (y/n): '))) {
				try {
					await db.tx((self)=>{
						return self.batch(versions.map((cur)=>{return self.none(sql(__dirname+'/'+cur));}));
					});
					console.log('Success');
				} catch(e){
					pgp.end();
					console.log('Database update failed. Exiting.');
					return;
				}
			}
			cfg.version = VERSION.fresh;
		}
		else if (!exists('/conf/installed') || !CLO.s.q || yn.test(await prompt('App is already installed. Do you want to factory reset the database? (y/n): '))) {
			if (!CLO.s.q && !cfg.devmode && exists('/conf/installed')) {
				console.log('These operations are destructive. Please enter the site secret from the config file to continue: ');
				if (await prompt('Secret: ',/\w+/) != cfg.secret) return pgp.end(),console.log('Secret mismatch. Exiting.');
				console.log('Secret matched. Proceeding.');
			}
			
			console.log('Checking Postgres version...');
			let dbname, pgversion = false;
			try {
				let data = await db.one('SELECT version();');
				dbname = data.version.split(' ')[0];
				pgversion = data.version.split(',')[0].split(' ')[1];
			} catch(err) {
				console.log(err);
				pgp.end();
				console.log('Postgres version check failed. Exiting.');
				return;
			}
			if (!dbname || dbname != 'PostgreSQL') 
				return pgp.end(),console.log('Connection is not a postgres database. Please make sure you have postgres 9.6.0 or greater installed and running.');
			let pgv = pgversion.split('.');
			if (parseInt(pgv[0],10) < 9 && parseInt(pgv[1],10) < 6 && parseInt(pgv[2],10) < 0) 
				return pgp.end(),console.log('Postgres version mismatch. Connection is running '+pgversion+', please upgrade to at least 9.6.0. Exiting.');
			console.log('Version check passed.');
			console.log();
			console.log('Wiping the database...');
			try {
				await db.none(sql('/install/wipe.sql'));
				console.log('Success');
			} catch(err) {
				console.log(err);
				pgp.end();
				console.log('Wipe failed. Exiting.');
				return;
			}
		
			console.log('Installing the database...');
			try {
				await db.tx((self) => {
					return self.batch([
						self.none(sql('/install/tables.sql')),
						self.none(sql('/install/functions.sql'))
					]);
				});
				console.log('Success');
			} catch(err) {
				console.log(err);
				pgp.end();
				console.log('Install failed. Exiting.');
				return;
			}
			
			console.log('Database has been installed.');
		}
		yml.write.sync(path('/conf/config.yml'),cfg);
	}
	
	// ----   Move this functionality into the global settings editor  ----
	//
	// cfg.site.name = CLO.s.q?cfg.site.name:await prompt("What do you want the site's name to be? (Leave empty for existing value '"+cfg.site.name+"'): ") || cfg.site.name;
	
	// function consolidateKeys(stale,fresh) {
	// 	for (var key in stale.options) if (fresh.options.hasOwnProperty(key)) {
	// 		if (!stale.options.hasOwnProperty(key))
	// 			stale.options[key] = fresh.options[key];
	// 		else if (typeof fresh.options[key] === 'object' && !(fresh.options[key] instanceof Array))
	// 			consolidateKeys(stale.options[key],fresh.options[key]);
	// 	}
	// }
	// consolidateKeys(cfg,dcfg);
	// if (!CLO.s.q && yn.test(await prompt('Do you want to configure the additional boolean options available for the app? (y/n): '))) {
	// 	console.log('Answer the following questions with either a yes or no. (y/n is fine as well)');
	// 	let questions = yml.read.sync(__dirname+'/options.yml'), options = dcfg.options, missed = [];
	// 	for (var key in options) { if (options.hasOwnProperty(key)) { 
	// 		if (questions.hasOwnProperty(key)) {
	// 			if (questions[key]) cfg.options[key] = yn.test(await prompt(questions[key]+': ',null,true));
	// 		} else missed.push(key);
	// 	}}
	// 	yml.write.sync(__dirname+'/../conf/config.yml',cfg);
	// 	console.log('Option configuration complete.' + (missed.length ? ' (This configuration has not covered all the available options. Please see /conf/config.yml for the full list.)':''));
	// }
	
	console.log("Application installation completed. You can start the app by running 'nodejs app.js' from the app's root directory.");
	
	pgp.end();
	
	fs.writeFileSync(path('/conf/installed'),VERSION.fresh);

})().catch(err=>{console.log(err); pgp.end();});
