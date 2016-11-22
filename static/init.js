"use strict";
window.PAGE = {init:false};
try{let x=()=>{};}
catch(e){
	alert('You are using an outdated browser. Please upgrade to a browser that supports ES6 standards.');
	throw 'You are using an outdated browser. Please upgrade to a browser that supports ES6 standards.';
}
document.documentElement.classList.add('js');
if(1){
	
let x = document.querySelector('head meta[name="PAGE"]');
if (x.dataset.board)
	window.PAGE.board = x.dataset.board;
if (x.dataset.type)
	window.PAGE.type = x.dataset.type;
if (x.dataset.current)
	window.PAGE.current = x.dataset.current;
if (x.dataset.CDN)
	window.PAGE.CDN = x.dataset.CDN;

let i=-1,loaded=[],_loaded={},load=document.querySelectorAll('head script.dependency');
window.PAGE.loaded = [];
while(++i<load.length){
	let s = load[i], v = s.dataset.src;
	_loaded[v] = null;
	s.onload = ()=>{
		let e;
		_loaded[v] = true;
		loaded.push(v);
		for (e of _loaded) if (e===null) return;
		e = new Event('init');
		e.loaded = loaded;
		document.dispatchEvent(e);
		window.PAGE.loaded = loaded;
		window.PAGE.init = true;
	};
	s.onerror = ()=>{
		let e;
		_loaded[v] = false;
		for (e of _loaded) if (e===null) return;
		e = new Event('init');
		e.loaded = loaded
		document.dispatchEvent(e);
		window.PAGE.loaded = loaded;
		window.PAGE.init = true;
	};
	s.defer = s.async = true;
	s.src = v;
	document.head.appendChild(s);
}}
