"use strict";
/* Prototype definitions */
console._ = function (data,level){
	if (typeof level === undefined) level = 'log';
	if (level in console) console[level](data);
	return data;
};
Function.prototype.clone = function(propless) {
	let func;
	eval('func = '+ this.toString());
	for (let key in this)
		if(!propless && this.hasOwnProperty(key))
			func[key] = this[key];
	return func;
};
Object.prototype.cut = function(key){ 
	if(this.hasOwnProperty(key)){
		var val = this[key];
		delete this[key];
		return val;
	}
};
Object.prototype.isEmpty = function(){
	for (var key in this)
		if(this.hasOwnProperty(key))
			return false;
	return true;
};
Object.prototype.matches = function(obj,vals){
	for (var key in this)
		if(obj.hasOwnProperty(key))
			if(!this.hasOwnProperty(key) || (vals && this[key] !== obj[key])) 
				return false;
	return true; 
};
Object.prototype.each = function(func,_this){
	var key, bindeach = (_this === undefined);
	for (key in this)
		if(this.hasOwnProperty(key))
			func.bind(bindeach?this[key]:_this)(this[key], key, this);
};
Object.prototype.filter = function(func,_this){
	var obj = {},key, bindeach = (_this === undefined);
	if (this instanceof Node){
		return false;
	} else if (this instanceof Function)
		obj = this.clone(true);
	for (key in this)
		if(this.hasOwnProperty(key))
			if (func.bind(bindeach?this[key]:_this)(this[key], key, this) !== false)
				obj[key] = this[key];
	return obj;
};
Object.prototype.all = function(func,_this){ 
	var key, bindeach = (_this === undefined);
	for (key in this)
		if(this.hasOwnProperty(key))
			if(!func.bind(bindeach?this[key]:_this)(this[key], key, this)) 
				return false;
	return true; 
};
Object.prototype.any = function(func,_this){
	var key, bindeach = (_this === undefined);
	for (key in this)
		if(this.hasOwnProperty(key))
			if(func.bind(bindeach?this[key]:_this)(this[key], key, this)) 
				return true;
	return false;
};
HTMLCollection.prototype.each = Array.prototype.each = NodeList.prototype.each = function(func,_this){
	var i = -1, bindeach = (_this === undefined); 
	while(++i < this.length)
		func.bind(bindeach?this[i]:_this)(this[i], i, this);
};
HTMLCollection.prototype.filter = Array.prototype.filter = NodeList.prototype.filter = function(func,_this){
	var i = -1, bindeach = (_this === undefined), out = []; 
	while(++i < this.length)
		if(func.bind(bindeach?this[i]:_this)(this[i], i, this) === true) 
			out.push(this[i]);
	return out;
};
HTMLCollection.prototype.all = Array.prototype.all = NodeList.prototype.all = function(func,_this){
	var i = -1, bindeach = (_this === undefined); 
	while(++i < this.length)
		if(func.bind(bindeach?this[i]:_this)(this[i], i, this) === false) 
			return false;
	return true;
}; 
HTMLCollection.prototype.any = Array.prototype.any = NodeList.prototype.any = function(func,_this){
	var i = -1, bindeach = (_this === undefined); 
	while(++i < this.length)
		if (func.bind(bindeach?this[i]:_this)(this[i], i, this) === true) 
			return true;
	return false;
};
Array.prototype.random = function(){
	return this[parseInt(Math.random(0,this.length),10)];
};
Array.prototype.lcut = function(val, occurance){
	if (typeof occurance !== 'number' || occurance < 1) occurance = 1;
	var a = [], i = this.indexOf(val), limit = this.length;
	while (i != -1) {
		if (!limit--) break;
		a.push(i);
		i = this.indexOf(val, i++);
	}
	if (a.length) return this.splice(a[occurance-1],1);
	else return this;
};
Array.prototype.rcut = function(val, occurance){
	if (typeof occurance !== 'number' || occurance < 1) occurance = 1;
	var a = [], i = this.lastIndexOf(val), limit = this.length;
	while (i != -1) {
		if (!limit--) break;
		a.push(i);
		i = this.lastIndexOf(val, i++); // verify this works.
	}
	if (a.length) return this.splice(a[occurance-1],1);
	else return this;
};
Array.prototype.cut = function(val, occurance, r){
	if (r) return this.rcut(val,occurance);
	else return this.lcut(val,occurance);
};
Array.prototype.ltrim = function(vals){
	var b=false,i=-1;
	while (++i < this.length) {
		if (vals === undefined)
			if (!this[i]) this.splice(i,1);
			else b = true;
		else
			if (vals instanceof Array)
				vals.each((item)=>{
					if (this === item) this.splice(i,1);
					else b = true;
				});
			else b = true;
		if (b) break;
	}
	return this;
};
Array.prototype.rtrim = function(vals){
	var b=false,i=this.length;
	while (--i >= 0) {
		if (vals === undefined)
			if (!this[i]) this.splice(i,1);
			else b = true;
		else
			if (vals instanceof Array)
				vals.each((item)=>{
					if (this === item) this.splice(i,1);
					else b = true;
				});
			else b = true;
		if (b) break;
	}
	return this;
};
Array.prototype.trim = function(vals){ return this.rtrim(vals).ltrim(vals); };
Array.prototype.merge = function(...args){
	var i = -1;
	while(++i < args.length) {
		if (args[i] instanceof Array)
			args[i].forEach((data)=>{ this.push(data); },this);
		else this.push(args[i]);
	}
	return this;
};
(()=>{
	function eventMatch(a,b){
		for (var key in b)
			if (b.hasOwnProperty(key))
				if (!a.hasOwnProperty(key) || 
					(typeof a[key] == 'function' && a[key].hasOwnProperty('_func') && a[key]._func !== b[key]._func) || 
					(a[key] !== b[key])
				) return false;
		return true;
	}
	function parseArgs(...args){
		var o = {};
		// event, selector, data, function, capture, namespace
		o.e = o.s = o.d = o.f = o.c = o.n = undefined;
		if (args.length > 5) args.splice(0,5); // only use the first 5 arguments.
		switch (args.length){
			case 5: 
				switch(typeof args[4]){
					case 'boolean': o.c = args[3]; break;
					default: throw new Error('Invalid 5th argument: ('+ (typeof args[4]) +') '+args[4].toString());
				}
			case 4:
				switch(typeof args[3]){
					case !(o.c===undefined)||'boolean': o.c = args[2]; break;
					case 'function': o.f = args[2]; break;
					default: throw new Error('Invalid 4th argument: ('+ (typeof args[3]) +') '+args[3].toString());
				}
			case 3:
				switch(typeof args[2]){
					case !(o.c===undefined)||'boolean': o.c = args[2]; break;
					case !(o.f===undefined)||'function': o.f = args[2]; break;
					default: o.d = args[2];
				}
			case 2:
				switch(typeof args[1]){
					case !(o.c===undefined)||'boolean': o.c = args[1]; break;
					case !(o.f===undefined)||'function': o.f = args[1]; break;
					case 'string': o.s = args[1].replace(/ *, */g,',').replace(/ {2,}/g,' ').trim(); break;
					default: o.d = args[1];
				}
			case 1:
				switch(typeof args[0]){
					case 'string':
						if (args[0].indexOf(',') != -1){
							var x = args[0].replace(' ','').split(',');
							o.e = []; o.n = [];
							x.each((item)=>{
								var e,n,i = this.indexOf('.');
								if (i != -1){
									e = item.substring(0,i) || undefined;
									n = item.substring(i+1) || undefined;
								} else e = item;
								o.e.push(e); o.n.push(n);
							},this);
						} else {
							var i;
							if ((i = args[0].indexOf('.')) != -1){
								o.e = args[0].substring(0,i) || undefined;
								o.n = args[0].substring(i+1) || undefined;
							} else o.e = args[0];
						}
						break;
					default: throw new Error('Invalid 1st argument: ('+ (typeof args[0]) +') '+args[0].toString());
				}
		}
		return o;
	}
	function listeners(arg,remove){
		if (this._eventFunctions === undefined) this._eventFunctions = [];
		if (typeof arg.e === 'object') {
			arg.e.each(function(e, i){
				listeners.bind(this)({e,n:arg.n[i],s:arg.s,f:arg.f,c:arg.c,d:arg.d},remove);
			},this);
		} else if (remove){
			arg.filter(()=>{ if (this === undefined) return false; });
			var t = [];
			this._eventFunctions.each((that, i)=>{
				delete arg.d;
				if (eventMatch(that,arg)) {
					this.removeEventListener(arg.e,arg.f,arg.c);
					t.unshift(i);
				}
			},this);
			t.each((x, i)=>{
				this._eventFunctions.splice(i,1);
			},this);
		} else {
			if (!arg.e) throw new Error('Event type must be provided.');
			if (!arg.f) throw new Error('Event handler must be provided.');
			if (arg.s === undefined) arg.s = '';
			if (arg.c === undefined) arg.c = false;
			if (arg.s) try{ this.querySelectorAll(arg.s); }catch(e){ throw new Error('"'+arg.s+'" is not a valid selector.'); }	// Make sure selector is valid
			if (!this._eventFunctions.any(()=>{if (eventMatch(this,arg)) return true;})){
				this.addEventListener(arg.e,arg.f,arg.c);
				this._eventFunctions.push(arg);
			}
		}
	}
	Element.prototype.one = function(...args /* 'event[.namespace][, event[.namespace]]...', ['selector',] [data,] function, [useCapture] */){
		let arg = parseArgs(...args);
		if (!arg.e || !arg.f) throw new Error('An event type and handler must be provided.');
		if (arg.s === undefined) arg.s = '';
		if (arg.c === undefined) arg.c = false;
		if (arg.s) this.querySelectorAll(arg.s);	// Make sure selector is valid
		let func = function func(data,e){
			if (e.namespace && e.namespace != data.n) return; // Only execute if namespaces match
			let nodes,target = e.target;
			if (data.s && this.children.length > 0 && (nodes = this.querySelectorAll(data.s)).length > 0){
				while (!(target in nodes) || target != this)
					target = target.parentNode;
			}
			else target = this;
			e.namespace = data.n;
			e.data = data.d;
			data.f._func.apply(target,[].merge(e,e.cut('toApply')));
			listeners.bind(this)(data,true);
		};
		func = func.bind(this,arg);
		func._func = arg.f;
		arg.f = func;
		listeners.bind(this)(arg);
		return this;
	};
	Element.prototype.on = function(...args /* 'event[.namespace][, event[.namespace]]...', ['selector',] [data,] function, [useCapture] */){
		var arg = parseArgs(...args);
		if (!arg.e || !arg.f) throw new Error('An event type and handler must be provided.');
		if (arg.s) this.querySelectorAll(arg.s);	// Make sure selector is valid
		var func = function(data,e){
			if (e.namespace && e.namespace != data.n) return;	// Only execute if namespaces match
			var nodes,target = e.target;
			if (data.s && this.children.length > 0 && (nodes = this.querySelectorAll(data.s)).length > 0)
				while (!(target in nodes) || target != this) 
					target = target.parentNode;
			else target = this;
			e.namespace = data.n;
			e.data = data.d;
			data.f._func.apply(target,[].merge(e,e.cut('toApply')));
		};
		func = func.bind(this,arg);
		func._func = arg.f;
		arg.f = func;
		listeners.bind(this)(arg);
		return this; 
	};
	Element.prototype.off = function(...args /* ['[event][.namespace][,[event][.namespace]]...',] ['selector',] [function,] [useCapture] */){
		var arg = parseArgs(...args);
		if (arg.f) arg.f._func = arg.f;
		listeners.bind(this)(arg,true);
		return this;
	};
	Element.prototype.trigger = function(e, data, ex={}){
		let n;
		if (typeof data === 'object' && !Array.isArray(data)) {
			ex = data;
			data = null;
		}
		if (typeof e === 'string') {
			let i;
			if ((i = e.indexOf('.')) != -1){	// Extract namespace if given
				e = e.substring(0,i);
				n = e.substring(i+1) || undefined;
			}
			e = new Event(e, ex); 
		}
		if(!(e instanceof Event)) throw new Error('Trigger must be a string or Event() instance.');
		e.namespace = n;
		e.toApply = data; 
		this.dispatchEvent(e);
		return this;
	};
	HTMLCollection.prototype.one = NodeList.prototype.one = function(...args){ var i = -1; while(++i < this.length) this[i].one(...args); return this; };
	HTMLCollection.prototype.on = NodeList.prototype.on = function(...args){ var i = -1; while(++i < this.length) this[i].on(...args); return this; };
	HTMLCollection.prototype.off = NodeList.prototype.off = function(...args){ var i = -1; while(++i < this.length) this[i].off(...args); return this; };
	HTMLCollection.prototype.trigger = NodeList.prototype.trigger = function(e,data,ex){ var i = -1; while(++i < this.length) if(this[i].nodeType != 3) this[i].trigger(e,data,ex); return this; };
})();
Element.prototype.val = function(val,index){ if (typeof val === undefined) return this.value; this.value = (typeof val === 'function')?val.bind(this)(index,this.value):val; return this; };
Element.prototype.prop = function(prop,val){ if (typeof val === undefined) return this.getAttribute(prop); this.setAttribute(prop,val); return this; };
Element.prototype.data = function(data,val){ if (typeof val === undefined) return this.dataset[data]; this.dataset[data] = val; return this; };
Element.prototype.find = Element.prototype.querySelectorAll;
Element.prototype.get = Element.prototype.querySelector;
Element.prototype.copy = Element.prototype.cloneNode;
Element.prototype.area = Element.prototype.getBoundingClientRect;

Element.prototype.beforeNode = function(node){ node.before(this); return this; };
Element.prototype.before = function(node){ 
	if (node instanceof Node) {
		if (this.parentNode)
			this.insertAdjacentElement('beforeBegin', node);
		else throw new Error('Cannot put a Node before an element with no containing parentNode.');
	} else {
		if (typeof node === 'string' && node.substring(0,1) == '<') this.insertAdjacentHTML('beforeBegin', node);
		else this.insertAdjacentText('beforeBegin', node.toString());
	}
	return this;
};
Element.prototype.prependNode = function(node){ node.prepend(this); return this; };
Element.prototype.prepend = function(node){
	if (node instanceof Node)
		this.insertAdjacentElement('afterBegin', node);
	else {
		if (typeof node === 'string' && node.substring(0,1) == '<') this.insertAdjacentHTML('afterBegin', node);
		else this.insertAdjacentText('afterBegin', node.toString());
	}
	return this;
};
Element.prototype.appendNode = function(node){ node.append(this); return this; };
Element.prototype.append = function(node){
	if (node instanceof Node)
		this.insertAdjacentElement('beforeEnd', node);
	else {
		if (typeof node === 'string' && node.substring(0,1) == '<') this.insertAdjacentHTML('beforeEnd', node);
		else this.insertAdjacentText('beforeEnd', node.toString());
	}
	return this;
};
Element.prototype.afterNode = function(node){ node.after(this); return this; };
Element.prototype.after = function(node){
	if (node instanceof Node) {
		if (this.parentNode)
			this.insertAdjacentElement('afterEnd', node);
		else throw new Error('Cannot put a Node after an element with no containing parentNode.');
	} else {
		if (typeof node === 'string' && node.substring(0,1) == '<') this.insertAdjacentHTML('afterEnd', node);
		else this.insertAdjacentText('afterEnd', node.toString());
	}
	return this;
};
Element.prototype.prev = function(s) { 
	if (!s) return this.prevElementSibling;
	let a = Array.from(this.parentElement.querySelectorAll(s));
	if (!a.length) return null;
	let c = this;
	let out = [];
	while ((c = c.prevElementSibling))
		if (~a.indexOf(c)) out.push(c);
	return c.length?c:null;
};
Element.prototype.next = function(s) { 
	if (!s) return this.nextElementSibling;
	let a = Array.from(this.parentElement.querySelectorAll(s));
	if (!a.length) return null;
	let c = this;
	let out = [];
	while ((c = c.nextElementSibling))
		if (~a.indexOf(c)) out.push(c);
	return c.length?c:null;
};
Element.prototype.up = function(s){
	if (!s) return this.parentElement;
	let a = Array.from(document.querySelectorAll(s));
	if (!a.length) return null;
	let c = this;
	let out = [];
	while ((c = c.parentElement))
		if (~a.indexOf(c)) out.push(c);
	return c.length?c:null;
};
Element.prototype.down = function(s){
	if (!s) return this.children;
	let a = Array.from(this.querySelectorAll(s));
	if (!a.length) return null;
	let c = this.children[0];
	let out = [];
	while ((c = c.nextElementSibling))
		if (~a.indexOf(c)) out.push(c);
	return c.length?c:null;
};
Element.prototype.nearestPrev = function(s){
	if (!s) return this.prevElementSibling;
	let a = Array.from(this.parentElement.querySelectorAll(s));
	if (!a.length) return null;
	let c = this;
	while ((c = c.prevElementSibling))
		if (~a.indexOf(c)) return c;
	return null;
};
Element.prototype.nearestNext = function(s){
	if (!s) return this.nextElementSibling;
	let a = Array.from(this.parentElement.querySelectorAll(s));
	if (!a.length) return null;
	let c = this;
	while ((c = c.nextElementSibling))
		if (~a.indexOf(c)) return c;
	return null;
};
Element.prototype.nearestUp = function(s){
	if (!s) return this.parentElement;
	let a = Array.from(document.querySelectorAll(s));
	if (!a.length) return null;
	let c = this;
	while ((c = c.parentElement))
		if (~a.indexOf(c)) return c;
	return null;
};
Element.prototype.nearestDown = function(s){
	if (!s) return this.children;
	let a = Array.from(this.querySelectorAll(s));
	if (!a.length) return null;
	let c = this.children[0];
	while ((c = c.nextElementSibling))
		if (~a.indexOf(c)) return c;
	return null;
};
Element.prototype.text = function(text){ if(text === undefined) return this.innerText; this.innerText = text; return this; };
Element.prototype.html = function(html){ if(html === undefined) return this.innerHTML; this.innerHTML = html; return this; };
Element.prototype.empty = function(){ this.innerHTML = ''; return this; };
Element.prototype.addClass = function(c){ this.classList.add(c); return this; };
Element.prototype.removeClass = function(c){ this.classList.remove(c); return this; };
Element.prototype.toggleClass = function(c){ this.classList.toggle(c); return this; };
Element.prototype.hasClass = function(c){ return this.classList.contains(c); };
Element.prototype.hide = function(){ this.hidden = true; return this; };
Element.prototype.show = function(){ this.hidden = false; return this; };
Element.prototype.ready = function(func){ this.one('DOMContentLoaded',func); return this; };
Text.prototype.text = function(text){ if (text === undefined) return this.textContent; this.textContent = text; return this; };
Text.prototype.empty = function(){ this.textContent = ''; return this; };
HTMLCollection.prototype.val = NodeList.prototype.val = function(data){ if (this.length && typeof data === undefined) return this[0].value; var i = -1; while(++i < this.length) this[i].val(data,i); return this; };
HTMLCollection.prototype.remove = NodeList.prototype.remove = function(){ var i = -1; while(++i < this.length) this[i].remove(); return this; };
HTMLCollection.prototype.empty = NodeList.prototype.empty = function(){ var i = -1; while(++i < this.length){ if(this[i].nodeType == 3) this[i].textContent = ''; else this[i].innerHTML = ''; } return this; };
HTMLCollection.prototype.addClass = NodeList.prototype.addClass = function(c){ var i = -1; while(++i < this.length) if(this[i].nodeType != 3) this[i].classList.add(c); return this; };
HTMLCollection.prototype.removeClass = NodeList.prototype.removeClass = function(c){ var i = -1; while(++i < this.length) if(this[i].nodeType != 3) this[i].classList.remove(c); return this; };
HTMLCollection.prototype.toggleClass = NodeList.prototype.toggleClass = function(c){ var i = -1; while(++i < this.length) if(this[i].nodeType != 3) this[i].classList.toggle(c); return this; };
HTMLCollection.prototype.hide = NodeList.prototype.hide = function(){ var i = -1; while(++i < this.length) if(this[i].nodeType != 3) this[i].hidden = true; return this; };
HTMLCollection.prototype.show = NodeList.prototype.show = function(){ var i = -1; while(++i < this.length) if(this[i].nodeType != 3) this[i].hidden = false; return this; };

/* vQuery definition */
var vQuery = window.vQuery = function(arg){
	if (typeof arg === 'function')
		return document.ready(arg);
	else if (arg instanceof Node)	// Is already a node, return given object
		return arg;
	else if (typeof arg === 'string' && arg.match(/^<(?:(?!\/>).)*\/>$/)) 		// Create an element from HTML string
		return (new DOMParser()).parseFromString(arg, "text/html").body.children[0];
	else return document.querySelectorAll(arg);								// Dom element selection (default funtionality)
};
window.vQuery;
(()=>{
class Ajax {
	constructor (options){
		this.xhr = new XMLHttpRequest();
		this.options = options;
		if (typeof this.options.context !== 'object') this.options.context = this.xhr;
		if (options.dataType) this.xhr.responseType = options.dataType;
		this.has = { loaded:false,failed:false,completed:false,canceled:false };
		this.callbacks = { done:[],fail:[],always:[],cancel:[] };
		this.xhr.open(options.method, options.url, options.async);
		this.xhr.setRequestHeader('X-Requested-With','XMLHttpRequest');
		// if (typeof options.upload === 'function') this.xhr.addEventListener('upload', options.upload.bind(options.context), false);
		if (typeof options.progress === 'function') this.xhr.addEventListener('progress', options.progress.bind(options.context), false);
		if (options.promise == true)
		var self = this, filtered = false;
		this.xhr.addEventListener('error', ()=>{
			if (typeof self.options.error === 'function') self.options.error.bind(self.options.context)(self.xhr.status,self.xhr.statusText);
			while(self.callbacks.fail.length > 0) self.callbacks.fail.shift().bind(self.xhr)(self.xhr.status, self.xhr.statusText);
			self.has.failed = true;
		}, false);
		this.xhr.addEventListener('abort', ()=>{
			if (typeof self.options.cancel === 'function') self.options.cancel.bind(self.options.context)(self.xhr, self.options);
			while(self.callbacks.cancel.length > 0) self.callbacks.cancel.shift().bind(self.options.context)(self.xhr, self.options);
			self.has.canceled = true;
		}, false);
		this.xhr.addEventListener('load', ()=>{
			if (!filtered) {
				if (typeof options.dataFilter === 'function' && self.xhr.response) filtered = options.dataFilter.bind(self.xhr)(self.xhr.response);
				else if (typeof options.dataFilter === 'string' && self.xhr.response) {
					try{
						if (options.dataFilter == 'json') filtered = JSON.parse(self.xhr.response);
						else if (options.dataFilter == 'html' || options.dataFilter == 'xml')
							filtered = (new DOMParser()).parseFromString(self.xhr.response, 'text/'+options.dataFilter);
					} catch (e) {
						console.warn('Error occured while attempted to parse ajax response as '+options.dataFilter+' during load event. Proceeding with original response.');
					}
				}
			}
			if (typeof options.success === 'function') 
				self.options.success.bind(self.options.context)(self.xhr, filtered||self.xhr.response||self.xhr.status, self.xhr.statusText);
			while(self.callbacks.done.length > 0) 
				self.callbacks.done.shift().bind(self.options.context)(self.xhr, filtered||self.xhr.response||self.xhr.status, self.xhr.statusText);
			self.has.loaded = true;
		}, false);
		this.xhr.addEventListener('loadend', ()=>{
			if (!filtered) {
				if (typeof options.dataFilter === 'function' && self.xhr.response) filtered = options.dataFilter.bind(self.xhr)(self.xhr.response);
				else if (typeof options.dataFilter === 'string' && self.xhr.response) {
					try{
						if (options.dataFilter == 'html' || options.dataFilter == 'xml')
							filtered = (new DOMParser()).parseFromString(self.xhr.response, 'text/'+options.dataFilter);
						else if (options.dataFilter == 'json') filtered = JSON.parse(self.xhr.response);
					} catch (e) {
						console.warn('Error occured while attempted to parse ajax response as '+options.dataFilter+' during loadend event. Proceeding with original response.');
					}
				}
			}
			while(self.callbacks.always.length > 0) 
				self.callbacks.always.shift().bind(self.options.context)(self.xhr, filtered||self.xhr.response||self.xhr.status, self.xhr.statusText);
			self.has.completed = true;
			if (typeof options.complete	=== 'function') 
				self.options.complete.bind(self.options.context)(self.xhr, filtered||self.xhr.response||self.xhr.status, self.xhr.statusText);
		});
		if (typeof this.options.beforeSend === 'function') 
			if(this.options.beforeSend.bind(this.options.context)(this.xhr, this.options) !== false) 
				options.manual ? this.xhr.send = this.xhr.send.bind(this.xhr,this.options.data) : this.xhr.send(this.options.data);
			else console.warn('Ajax send canceled due to the beforeSend function returning false.');
		else options.manual ? this.xhr.send = this.xhr.send.bind(this.xhr,this.options.data) : this.xhr.send(this.options.data);
	}
	done (func){ 
		if (this.has.loaded) func.bind(this.options.context)(this.xhr, this.xhr.statusText, this.xhr.response);
		else this.callbacks.done.push(func);
		return this;
	}
	fail (func){ 
		if (this.has.failed) func.bind(this.options.context)(this.xhr, this.xhr.statusText, this.xhr.status);
		else this.callbacks.fail.push(func);
		return this;
	}
	always (func){ 
		if (this.has.completed) func.bind(this.options.context)(this.xhr, this.xhr.statusText, this.xhr.response||this.xhr.status);
		else this.callbacks.always.push(func);
		return this;
	}
	cancel (func){ 
		if (this.has.canceled) func.bind(this.options.context)(this.xhr, this.options);
		else this.callbacks.cancel.push(func);
		return this;
	}
	abort() { return this.xhr.abort(); }
}
vQuery.ajax = function(options) {
	let defaults = {
		method:'get',
		url:false,
		type:'',
		data:{},
		contentType:'application/x-www-form-urlencoded',
		dataType:'',
		context:null,
		async:true,
		statusCode:{},
		upload:false,
		progress:false,
		beforeSend:false,
		error:false,
		dataFilter:false,
		success:false,
		cancel:false,
		complete:false,
		manual:false,
		promise:false
	};
	if (options.cut('promise')){
		defaults.manual = true;
		let ajax = new Ajax(Object.assign(defaults,options));
		let p = new Promise((res,rej)=>{
			ajax.done(function (xhr,statusText,response){
				res.bind(xhr)(response);
			});
			ajax.fail(function (xhr,statusText,status){
				let e = new Error(statusText);
				e.status = status;
				rej.bind(xhr)(e);
			});
			ajax.xhr.send();
		});
		p.ajax = ajax;
		return p;
	} else return new Ajax(Object.assign(defaults,options));
};
})();
vQuery.get = function(url, data, success, dataType) {
	let options;
	if (typeof url === 'object') options = url;
	else {
		options = {};
		if (typeof url === 'string') options.url = url;
		if (typeof data === 'function') options.success = data;
		else if (typeof data === 'object') options.data = data;
		if (typeof success === 'function' && !options.success) options.success = success;
		// dataType:dataType
	}
	return this.ajax(this.merge(options,{method:'get'}));
};
vQuery.post = function(url, data, success, dataType) {
	let options;
	if (typeof url === 'object') options = url;
	else {
		options = {};
		if (typeof url === 'string') options.url = url;
		if (typeof data === 'function') options.success = data;
		else if (typeof data === 'object') options.data = data;
		if (typeof success === 'function' && !options.success) options.success = success;
		// dataType:dataType
	}
	return this.ajax(this.merge(options,{method:'post'}));
};
vQuery.Event = function(e,ex){ return new Event(e,ex); };
vQuery.trigger = function(e,data){ return document.trigger(e,data); };
Event.prototype.triggerOn = function(nodes){
	if (typeof nodes === 'string') nodes = document.querySelectorAll(nodes);
	if (nodes instanceof HTMLCollection || nodes instanceof NodeList) {
		let i = -1;
		while(++i < nodes.length)
			if(nodes[i].dispatchEvent)
				nodes[i].dispatchEvent(this);
	} else if (nodes.dispatchEvent)
		nodes.dispatchEvent(this);
};

vQuery.verifyES = function(){
	try {
		let b,c,d; // let assignment
		const a = ([a,b]=[2,1],...c)=>{c.push(a+b); return c;}; // const assignment with default function values and rest assignment
		[b,c=7,...d] = [1,undefined,3,4]; // destructure with default values and rest assignment
		a(3,undefined,5,4);
		let f = async function(){ return await Promise.resolve(true);}; // Async/Await definition
		return true;
	} catch(e) {
		return false;
	}
	
};

window.$ = window.vQuery;
