"use strict";

const ALPHA_POOL = 
    'abcdefghijklmnopqrstuvwxyz'+
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const NUM_POOL = '1234567890';
const SYMBOLS_POOL = '.,:;_+-*/=!|~`@#$%^&?()[]{}<>';
const NBSP = " \t";
const WHITESPACE = NBSP+"\n";
const WORD_POOL = ALPHA_POOL + NUM_POOL + '-_';
const FULL_POOL = ALPHA_POOL + NUM_POOL + SYMBOLS_POOL;
const URLSAFE_POOL = ALPHA_POOL + NUM_POOL + '.,:;_+-*/=!~@#$&?()%';
const URLUNSFE_POOL = '|^()[]{}<>'+WHITESPACE;

class Lexer {
    constructor(str){
        this.text = str;
        this.cursor = 0;
        this.layers = [];
        this.consume = new Consume(this);
        this.expect = new Expect(this);
    }
    
    splice (from,length=0,insert=''){
    	return this.text.slice(0,from)+insert+this.text.slice(from+length);
    }
    
    get ALPHA_POOL(){ return ALPHA_POOL; }
    get NUM_POOL(){ return NUM_POOL; }
    get SYMBOLS_POOL(){ return SYMBOLS_POOL; }
    get NBSP(){ return NBSP; }
    get WHITESPACE(){ return WHITESPACE; }
    get WORD_POOL(){ return WORD_POOL; }
    get FULL_POOL(){ return FULL_POOL; }
    get URLSAFE_POOL(){ return URLSAFE_POOL; }
    get URLUNSFE_POOL(){ return URLUNSFE_POOL; }
}

/*
 * Class that discovers presence of certain text or text types.
 * Does not consume the text, only detects that it is there.
 *
 */

class Expect {
    constructor(lex){
        this.lex = lex;
    }
    
    SOF() { return this.lex.cursor == 0; }
    SOL() { return this.lex.text.substr(this.lex.cursor-1,1) == "\n"; }
    EOL() { return this.lex.text.substr(this.lex.cursor,1) == "\n"; }
    EOF() { return this.lex.cursor == this.lex.text.length; }
    
    string(str) { return this.lex.text.substr(this.lex.cursor,str.length) == str; }
    
    laterString(str) {}
    
    either(...arr) { 
        for (let i in arr) {
            if (typeof arr[i] == 'string' && this.lex.text.substr(this.lex.cursor,arr[i].length) == arr[i]) 
                return true;
        } return false; 
    }
    
    whitespace() {
        return this.any(WHITESPACE);
    }
    
    /*
     * Returns length of string that was found using the pool given.
     */
    any(pool=WORD_POOL) {
        let pos = this.lex.cursor-1;
        while (pool.includes(this.lex.text.substr(++pos,1))) {}
        return pos - this.lex.cursor;
    }
    
}

/*
 * Class that consumes certain text or text types that are present.
 * Returns true if something was consumed or false if not.
 *
 */

class Consume {
    constructor(lex){
        this.lex = lex;
    }
    
    until(str) {
        let pos = this.lex.cursor -1;
        while (this.lex.text.substr(++pos,str.length) != str){
			if (pos >= this.lex.text.length)
		        return false;
        }
        this.lex.cursor = pos;
        return true;
    }
    
    string(str) {
        if (this.lex.text.substr(this.lex.cursor,str.length) == str){
            this.lex.cursor += str.length;
            return true;
        }
        return false;
    }
    
    len(num) { this.lex.cursor += (typeof num == 'number'? num: num.length); }
    
    whitespace() {
        let nbsp = [' ',"\t"], pos = this.lex.cursor-1;
        while (nbsp.contains(this.lex.text.substr(++pos,1))) {}
        if (this.lex.cursor == pos)
            return false;
        this.lex.cursor = pos;
        return true;
    }
    
    /*
     * Consumes length of string that was found using the pool given.
     */
    any(pool=WORD_POOL) {
        let pos = this.lex.cursor-1;
        while (pool.includes(this.lex.text.substr(++pos,1))) {}
        if (this.lex.cursor == pos)
            return false;
        this.lex.cursor = pos;
        return true;
    }
    
}

//*/
module.exports = function(){
    const lex = new Lexer();
    let {expect,consume} = lex;
    return {expect,consume};
};
/*/
export default function(){
    const lex = new Lexer();
    let {expect,consume} = lex;
    return {expect,consume};
}
//*/
