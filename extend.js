"use strict";

//*/
const fs = require('fs');
const path = require('path');
const gm = require('gm');
/*/
import fs from 'fs';
import path from 'path';
import gm from 'gm';
//*/

console._ = (arg)=>{
	console.log(arg);
	return arg;
};
String.prototype.splice = function(i,c,a){
	return this.slice(0,i)+(a||'')+this.slice(i+c);
};
String.prototype.toCamelCase = function(delimiter){
    return this.split("_").reduce((a,b)=>{return a+(delimiter||"")+b.slice(0,1).toUpperCase()+b.slice(1).toLowerCase();},"");
};
String.prototype.toLowerCamelCase = function(delimiter){
    return this.split("_").reduce((a,b)=>{return a+(delimiter||"")+(a.length?b.slice(0,1).toUpperCase():b.slice(0,1).toLowerCase())+b.slice(1).toLowerCase();},"");
};
Object.merge = function() {
    var obj = {}, i = 0, j = arguments.length;
    for(; i < j; i++) 
		if(typeof arguments[i] === 'object') 
			for(let key in arguments[i]) 
				if(arguments[i].hasOwnProperty(key)) 
					obj[key] = arguments[i][key];
    return obj;
};
Object.forEach = function(o,fn){
    if (typeof o == 'function')
        throw "First parameter cannot be a function.";
    if (typeof o == 'number')
        o = Array(parseInt(o,10)).fill(null);
    if (typeof o == 'string')
        o = o.split('');
    if (typeof fn != 'function')
        throw "Second parameter must be a function.";
    for (let x in o){
        if (o.hasOwnProperty(x))
            fn.bind(o[x])(o[x],x,o);
    }
};
Array.prototype.rpush = function(a){ this.push(a); return this; };
Array.prototype.rpop = function(a){ this.pop(); return this; };
Array.prototype.rshift = function(a){ this.shift(a); return this; };
Array.prototype.runshift = function(a){ this.unshift(); return this; };
Array.prototype.contains = Array.prototype.contains|| function(a){ return ~this.indexOf(a); };
Error.prototype.setloc = function(str){ this.loc = str; return this; };
Error.prototype.setmsg = function(str){ this.message = str; return this; };
Error.prototype.setstatus = function(status){
	if (typeof status !== 'number') throw 'Error status must be an integer.';
	this.status = parseInt(status,10);
	return this;
};
Error.prototype.withlog = function(level){
	if (typeof level !== 'string') throw 'Error log level must be a string.';
	this.log = level;
	return this;
};
Error.prototype.withrender = function(view){
	if (typeof view !== 'string') throw 'Error view render must be a string.';
	if (!this.status) this.setstatus(409);
	this.setdata = function(data){this.data = data; delete this.setdata; return this;};
	this.render = view;
	return this;
};

fs.rmdirall = function(dirToRemove, callback) {
    var dirList = [];
    var fileList = [];

    function flattenDeleteLists(fsPath, callback) {
        fs.lstat(fsPath, function (err, stats) {
            if (err) return callback(err);

            if (stats.isDirectory()) {
            	//add to our list of dirs to delete after we're done exploring for files
                dirList.unshift(fsPath);  
                fs.readdir(fsPath, function (err, files) {
                    if (err) return callback(err);
                    
                    var currentTotal = files.length;
                    var checkCounter = function (err) {
                        if (currentTotal < 1 || err) 
                        	callback(err);
                    };

                    if (files.length > 0)
                        files.forEach(function (f) {
                            flattenDeleteLists(path.join(fsPath, f), function (err) {
                                currentTotal -= 1;
                                checkCounter(err);
                            });
                        });
                    //make sure we bubble the callbacks all the way out
                    checkCounter(); 
                });
            } else {
            	//add to our list of files to delete after we're done exploring for files
                fileList.unshift(fsPath); 
                callback();
            }
        });
    }

    function removeItemsList(list, rmMethod, callback) {
        var count = list.length;
        if (count === 0) return callback();
        
        list.forEach(function (file) {
            fs[rmMethod](file, function (err) {
                count -= 1;
                if (count < 1 || err) 
                	callback(err);
            });
        });
    }
    function onFinishedFlattening(err) {
        if (err) return callback(err);
        //done exploring folders without errors
        removeItemsList(fileList, "unlink", function (err) {
            if (err) return callback(err);
            //done deleting files without errors
            removeItemsList(dirList, "rmdir", function (err) { 
                callback(err);  //done
            });
        });
    }
    flattenDeleteLists(dirToRemove, onFinishedFlattening);
};

let m = ['write','toBuffer','size','identify','format','orientation','depth','color','res','filesize','compare'];
for (let f in m) promisify(gm.prototype,m[f]);
promisify(gm.prototype,'thumb',6);


function promisify(ctx, f, cbindex){
    var origFunc = ctx[f];
    ctx[f] = async function(...args){
        return getPromise.bind(this)(cbindex,origFunc,...args);
    };
}

function getPromise (cbindex, f, ...args) {
    if (!Array.isArray(args)) {
        if (args !== undefined) args = [args];
        else args = [];
    }
    if (typeof cbindex == 'function'){
        args.unshift(f);
        f = cbindex;
        cbindex = args.length;
    } else {
        cbindex = cbindex < args.length?cbindex:args.length;
    }
    if (args.length > f.length) throw new Error('Given function "'+(f.name||'anonymous')+'" expected a max of '+f.length+' arguments. Number of arguments given: '+args.length);
    if (typeof f != 'function') throw new Error('makePromise must have a function to call.');
    
    return new Promise((resolve,reject)=>{
        args.splice(cbindex, 0, (err, ...response)=>{
            if (err)
                return reject(err);
            if (!response.length) return resolve();
            return resolve(response.length>1?response:response[0]);
        });
        f.apply(this,args);
    });
}
