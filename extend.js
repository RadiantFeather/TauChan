"use strict";
console._ = (arg)=>{
	console.log(arg);
	return arg;
};
String.prototype.splice = function(i,c,a){
	return this.slice(0,i)+(a||'')+this.slice(i+c);
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
Array.prototype.rpush = function(a){ this.push(a); return this; };
Array.prototype.rpop = function(a){ this.pop(); return this; };
Array.prototype.rshift = function(a){ this.shift(a); return this; };
Array.prototype.runshift = function(a){ this.unshift(); return this; };
Error.prototype.setloc = function(str){ this.loc = str; return this; };
Error.prototype.setmsg = function(str){ this.message = str; return this; };
Error.prototype.setstatus = function(status){
	if (typeof status !== 'number') throw 'Error status must be an integer.';
	this.status = parseInt(status);
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

var fs = require('fs'), path = require('path');
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
