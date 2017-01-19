"use strict";
Object.merge = function() {
    var obj = {}, i = 0, j = arguments.length;
    for(; i < j; i++) 
		if(typeof arguments[i] === 'object') 
			for(key in arguments[i]) 
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
