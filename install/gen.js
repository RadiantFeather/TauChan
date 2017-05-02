"use strict";
//*/
const Chance = require('./chance');
/*/
import Chance from './chance';
//*/

// Random helper functions
function initOptions(options, defaults) {
    options || (options = {});
    if (defaults)
        for (var i in defaults)
            if (typeof options[i] === 'undefined')
                options[i] = defaults[i];
    return options;
}

class Gen extends Chance {
    
    genSubject() {
        return this.capFirst(this.genNounPhrase(0));
    }
    
    genParagraph(options) {
        options = initOptions(options, {min:1,max:8} );
        
        let i=-1,w = "";
        let len = options.sentences?options.sentences:this.integer({min:options.min-1,max:options.max-1});
        while (++i < len){
            w += this.genRandomSentence();
            if (i+1 < len) w+= " ";
        }
        return w;
    }
     
    genRandomSentenceTemplate() {
        // code key:  
        //  0 = lone noun
        //  1 = noun phrase
        //  2 = transitive verb phrase (present tense, singular, third person)
        //  3 = conjunction
        //  4 = intransitive verb phrase
        //  5 = transitive verb phrase (infinitive, singular)
        //  6 = adjective
        //  7 = adverb
        var w = "";
        switch(this.natural({max:22})){
            case 1 :  w = "1 2 1, 3 1 2 1."; break;
            case 2 :  w = "When 1 4, 1 4."; break;
            case 3 :  w = "If 1 2 1, then 1 4."; break;
            case 4 :  w = "Sometimes 1 4, but 1 always 2 1!"; break;
            case 5 :  w = "Most people believe that 1 2 1, but they need to remember how 7 1 4."; break;
            case 6 : 
                if ( this.firstAmerica ) {
                    this.firstAmerica = 0;
                    w = "1, 1, and 1 are what made America great!";
                } else {
                    w = "1 2 1.";
                }
                break;
            case 7 :  w = "1 4, 3 1 2 1."; break;
            case 8 :  w = "Now and then, 1 2 1."; break;
            case 9 :  w = "1 4, and 1 4; however, 1 2 1."; break;
            case 10: 
                if ( this.firstSentence ) {
                    w = "1 2 1.";
                } else {
                    w = "Indeed, 1 2 1.";
                }
                break;
            case 11: 
                if ( this.firstSentence ) {
                    w = "1 2 1.";
                } else {
                    w = "Furthermore, 1 4, and 1 2 1.";
                }
                break;
            case 12: 
                if ( this.firstSentence ) {
                    w = "1 2 1.";
                } else {
                    w = "For example, 1 indicates that 1 2 1.";
                }
                break;
            case 13: w = "When you see 1, it means that 1 4."; break;
            case 14: w = "Any 0 can 5 1, but it takes a real 0 to 5 1."; break;
            case 15: w = "1 is 6."; break;
            case 16: w = "When 1 is 6, 1 2 1."; break;
            default: w = "1 2 1.";
        }
        this.firstSentence = 0;
        return w;
    }
     
     
    genNoun() {
        var w = "";
        switch(this.natural({max:124})){
            case 0  : w = "cocker spaniel"; break;
            case 1  : w = "roller coaster"; break;
            case 2  : w = "abstraction"; break;
            case 3  : w = "pine cone"; break;
            case 4  : w = "microscope"; break;
            case 5  : w = "bottle of beer"; break;
            case 6  : w = "bowling ball"; break;
            case 7  : w = "grain of sand"; break;
            case 8  : w = "wheelbarrow"; break;
            case 9  : w = "pork chop"; break;
            case 10 : w = "bullfrog"; break;
            case 11 : w = "squid"; break;
            case 12 : w = "tripod"; break;
            case 13 : w = "girl scout"; break;
            case 14 : w = "light bulb"; break;
            case 15 : w = "hole puncher"; break;
            case 16 : w = "carpet tack"; break;
            case 17 : w = "submarine"; break;
            case 18 : w = "diskette"; break;
            case 19 : w = "tape recorder"; break;
            case 20 : w = "anomaly"; break;
            case 21 : w = "insurance agent"; break;
            case 22 : w = "mortician"; break;
            case 23 : w = "fire hydrant"; break;
            case 24 : w = "photon"; break;
            case 25 : w = "line dancer"; break;
            case 26 : w = "paper napkin"; break;
            case 27 : w = "stovepipe"; break;
            case 28 : w = "graduated cylinder"; break;
            case 29 : w = "hydrogen atom"; break;
            case 30 : w = "garbage can"; break;
            case 31 : w = "reactor"; break;
            case 32 : w = "power drill"; break;
            case 33 : w = "scooby snack"; break;
            case 34 : w = "freight train"; break;
            case 35 : w = "ocean"; break;
            case 36 : w = "bartender"; break;
            case 37 : w = "senator"; break;
            case 38 : w = "mating ritual"; break;
            case 39 : w = "briar patch"; break;
            case 40 : w = "jersey cow"; break;
            case 41 : w = "chain saw"; break;
            case 42 : w = "prime minister"; break;
            case 43 : w = "cargo bay"; break;
            case 44 : w = "buzzard"; break;
            case 45 : w = "polar bear"; break;
            case 46 : w = "tomato"; break;
            case 47 : w = "razor blade"; break;
            case 48 : w = "ball bearing"; break;
            case 49 : w = "fighter pilot"; break;
            case 50 : w = "support group"; break;
            case 51 : w = "fundraiser"; break;
            case 52 : w = "cowboy"; break;
            case 53 : w = "football team"; break;
            case 54 : w = "cab driver"; break;
            case 55 : w = "nation"; break;
            case 56 : w = "ski lodge"; break;
            case 57 : w = "mastadon"; break;
            case 58 : w = "recliner"; break;
            case 59 : w = "minivan"; break;
            case 60 : w = "deficit"; break;
            case 61 : w = "food stamp"; break;
            case 62 : w = "wedding dress"; break;
            case 63 : w = "fairy"; break;
            case 64 : w = "globule"; break;
            case 65 : w = "movie theater"; break;
            case 66 : w = "tornado"; break;
            case 67 : w = "rattlesnake"; break;
            case 68 : w = "CEO"; break;
            case 69 : w = "corporation"; break;
            case 70 : w = "plaintiff"; break;
            case 71 : w = "class action suit"; break;
            case 72 : w = "judge"; break;
            case 73 : w = "defendant"; break;
            case 74 : w = "dust bunny"; break;
            case 75 : w = "vacuum cleaner"; break;
            case 76 : w = "lover"; break;
            case 77 : w = "sandwich"; break;
            case 78 : w = "hockey player"; break;
            case 79 : w = "avocado pit"; break;
            case 80 : w = "fruit cake"; break;
            case 81 : w = "turkey"; break;
            case 82 : w = "sheriff"; break;
            case 83 : w = "apartment building"; break;
            case 84 : w = "industrial complex"; break;
            case 85 : w = "inferiority complex"; break;
            case 86 : w = "salad dressing"; break;
            case 87 : w = "short order cook"; break;
            case 88 : w = "pig pen"; break;
            case 89 : w = "grand piano"; break;
            case 90 : w = "tuba player"; break;
            case 91 : w = "traffic light"; break;
            case 92 : w = "turn signal"; break;
            case 93 : w = "paycheck"; break;
            case 94 : w = "blood clot"; break;
            case 95 : w = "earring"; break;
            case 96 : w = "blithe spirit"; break;
            case 97 : w = "customer"; break;
            case 98 : w = "warranty"; break;
            case 99 : w = "grizzly bear"; break;
            case 100: w = "cyprus mulch"; break;
            case 101: w = "pit viper"; break;
            case 102: w = "crank case"; break;
            case 103: w = "oil filter"; break;
            case 104: w = "steam engine"; break;
            case 105: w = "chestnut"; break;
            case 106: w = "chess board"; break;
            case 107: w = "pickup truck"; break;
            case 108: w = "cheese wheel"; break;
            case 109: w = "eggplant"; break;
            case 110: w = "umbrella"; break;
            case 111: w = "skyscraper"; break;
            case 112: w = "dolphin"; break;
            case 113: w = "asteroid"; break;
            case 114: w = "parking lot"; break;
            case 115: w = "demon"; break;
            case 116: w = "tabloid"; break;
            case 117: w = "particle accelerator"; break;
            case 118: w = "cloud formation"; break;
            case 119: w = "cashier"; break;
            case 120: w = "burglar"; break;
            case 121: w = "spider"; break;
            case 122: w = "cough syrup"; break;
            case 123: w = "satellite"; break;
            case 124: w = "scythe"; break;
        }
        return w;
    }
    
    
    genPreposition() {
        var w = "";
        switch(this.natural({max:13})){
            case 0 : w = "of";
            case 1 : w = "from";
            case 2 : w = "near";
            case 3 : w = "about";
            case 4 : w = "around";
            case 5 : w = "for";
            case 6 : w = "toward";
            case 7 : w = "over";
            case 8 : w = "behind";
            case 9 : w = "beyond";
            case 10: w = "related to";
            case 11: w = "defined by";
            case 12: w = "inside";
            case 13: w = "living with";
        }
        return w;
    }
     
     
    genNounPhrase(options) {
        let depth;
        if (typeof options == 'object') {
            options = initOptions(options, {depth:undefined});
            depth = options.depth;
        } else depth = options;
        var phraseKind = this.natural({max:2});
        var s = "";
        if ( phraseKind == 0 || depth>0 ) {
            s = this.genNoun();
        } else if ( phraseKind == 1 ) {
            s = this.genAdjective() + " " + this.genNoun();
        } else if ( phraseKind == 2 ) {
            s = this.genNoun() + " " + this.genPreposition() + " " + this.genNounPhrase(depth+1);
        }
        var r = this.natural({max:100});
        if ( r < 30 ) {
            s = "the " + s;
        } else if ( r < 35 ) {
            s = "another " + s;
        } else if ( r < 40 ) {
            s = "some " + s;
        } else {
            var c = s.substring(0,1).toLowerCase();
            if ((s.substring(0,8) != "Eurasian") && 
                'aeiou'.indexOf(c)>-1) s = "an " + s;
            else s = "a " + s;
        }
        return s;
    }
    
    
    genAdverb() {
        var s = "";
        switch(this.natural({max:27})){
            case 0 : s = "knowingly"; break;
            case 1 : s = "slyly"; break;
            case 2 : s = "greedily"; break;
            case 3 : s = "hesitantly"; break;
            case 4 : s = "secretly"; break;
            case 5 : s = "carelessly"; break;
            case 6 : s = "thoroughly"; break;
            case 7 : s = "barely"; break;
            case 8 : s = "ridiculously"; break;
            case 9 : s = "non-chalantly"; break;
            case 10: s = "hardly"; break;
            case 11: s = "eagerly"; break;
            case 12: s = "feverishly"; break;
            case 13: s = "lazily"; break;
            case 14: s = "inexorably"; break;
            case 15: s = "accurately"; break;
            case 16: s = "accidentally"; break;
            case 17: s = "completely"; break;
            case 18: s = "usually"; break;
            case 19: s = "single-handledly"; break;
            case 20: s = "underhandedly"; break;
            case 21: s = "almost"; break;
            case 22: s = "wisely"; break;
            case 23: s = "ostensibly"; break;
            case 24: s = "somewhat"; break;
            case 25: s = "overwhelmingly"; break;
            case 26: s = "seldom"; break;
            case 27: s = "often"; break;
        }
        return s;
    }
    
    genAdjective() {
        var w = "";
        switch(this.natural({max:104})){
            case 0  : w = "slow"; break;
            case 1  : w = "surly"; break;
            case 2  : w = "gentle"; break;
            case 3  : w = "optimal"; break;
            case 4  : w = "treacherous"; break;
            case 5  : w = "loyal"; break;
            case 6  : w = "smelly"; break;
            case 7  : w = "ravishing"; break;
            case 8  : w = "annoying"; break;
            case 9  : w = "burly"; break;
            case 10 : w = "raspy"; break;
            case 11 : w = "moldy"; break;
            case 12 : w = "blotched"; break;
            case 13 : w = "federal"; break;
            case 14 : w = "phony"; break;
            case 15 : w = "magnificent"; break;
            case 16 : w = "alleged"; break;
            case 17 : w = "crispy"; break;
            case 18 : w = "gratifying"; break;
            case 19 : w = "elusive"; break;
            case 20 : w = "revered"; break;
            case 21 : w = "spartan"; break;
            case 22 : w = "righteous"; break;
            case 23 : w = "mysterious"; break;
            case 24 : w = "worldly"; break;
            case 25 : w = "cosmopolitan"; break;
            case 26 : w = "college-educated"; break;
            case 27 : w = "bohemian"; break;
            case 28 : w = "statesmanlike"; break;
            case 29 : w = "stoic"; break;
            case 30 : w = "hypnotic"; break;
            case 31 : w = "dirt-encrusted"; break;
            case 32 : w = "purple"; break;
            case 33 : w = "infected"; break;
            case 34 : w = "shabby"; break;
            case 35 : w = "tattered"; break;
            case 36 : w = "South American"; break;
            case 37 : w = "Alaskan"; break;
            case 38 : w = "overripe"; break;
            case 39 : w = "self-loathing"; break;
            case 40 : w = "frustrating"; break;
            case 41 : w = "rude"; break;
            case 42 : w = "pompous"; break;
            case 43 : w = "impromptu"; break;
            case 44 : w = "makeshift"; break;
            case 45 : w = "so-called"; break;
            case 46 : w = "proverbial"; break;
            case 47 : w = "molten"; break;
            case 48 : w = "wrinkled"; break;
            case 49 : w = "psychotic"; break;
            case 50 : w = "foreign"; break;
            case 51 : w = "familiar"; break;
            case 52 : w = "pathetic"; break;
            case 53 : w = "precise"; break;
            case 54 : w = "moronic"; break;
            case 55 : w = "polka-dotted"; break;
            case 56 : w = "varigated"; break;
            case 57 : w = "mean-spirited"; break;
            case 58 : w = "false"; break;
            case 59 : w = "linguistic"; break;
            case 60 : w = "temporal"; break;
            case 61 : w = "fractured"; break;
            case 62 : w = "dreamlike"; break;
            case 63 : w = "imaginative"; break;
            case 64 : w = "cantankerous"; break;
            case 65 : w = "obsequious"; break;
            case 66 : w = "twisted"; break;
            case 67 : w = "load bearing"; break;
            case 68 : w = "orbiting"; break;
            case 69 : w = "radioactive"; break;
            case 70 : w = "unstable"; break;
            case 71 : w = "outer"; break;
            case 72 : w = "nearest"; break;
            case 73 : w = "most difficult"; break;
            case 74 : w = "Eurasian"; break;
            case 75 : w = "hairy"; break;
            case 76 : w = "flabby"; break;
            case 77 : w = "soggy"; break;
            case 78 : w = "muddy"; break;
            case 79 : w = "salty"; break;
            case 80 : w = "highly paid"; break;
            case 81 : w = "greasy"; break;
            case 82 : w = "fried"; break;
            case 83 : w = "frozen"; break;
            case 84 : w = "boiled"; break;
            case 85 : w = "incinerated"; break;
            case 86 : w = "vaporized"; break;
            case 87 : w = "nuclear"; break;
            case 88 : w = "paternal"; break;
            case 89 : w = "childlike"; break;
            case 90 : w = "feline"; break;
            case 91 : w = "fat"; break;
            case 92 : w = "skinny"; break;
            case 93 : w = "green"; break;
            case 94 : w = "financial"; break;
            case 95 : w = "frightened"; break;
            case 96 : w = "fashionable"; break;
            case 97 : w = "resplendent"; break;
            case 98 : w = "flatulent"; break;
            case 99 : w = "mitochondrial"; break;
            case 100: w = "overpriced"; break;
            case 101: w = "snooty"; break;
            case 102: w = "self-actualized"; break;
            case 103: w = "miserly"; break;
            case 104: w = "geosynchronous"; break;
        }
        
        if ( this.bool({likelihood:30}) ) {
            w = this.genAdverb() + " " + w;
        }
 
        return w;
    }
     
    // 'tense' is one of the following:
    //      0 = infinitive
    //      1 = present tense, third person singular
    genTransitiveVerbPhrase(tense) {
        var s = "";
        switch(this.natural({max:55})){
            case 0 : s = "eat$"; break;
            case 1 : s = "conquer$"; break;
            case 2 : s = "figure$ out"; break;
            case 3 : s = "know$"; break;
            case 4 : s = "teach*"; break;
            case 5 : s = "require$ assistance from"; break;
            case 6 : s = "pour$ freezing cold water on"; break;
            case 7 : s = "find$ lice on"; break;
            case 8 : s = "seek$"; break;
            case 9 : s = "ignore$"; break;
            case 10: s = "dance$ with"; break;
            case 11: s = "recognize$"; break;
            case 12: s = "compete$ with"; break;
            case 13: s = "reach* an understanding with"; break;
            case 14: s = "negotiate$ a prenuptial agreement with"; break;
            case 15: s = "assimilate$"; break;
            case 16: s = "bestow$ great honor upon"; break;
            case 17: s = "derive$ perverse satisfaction from"; break;
            case 18: s = "steal$ pencils from"; break;
            case 19: s = "tr& to seduce"; break;
            case 20: s = "go* deep sea fishing with"; break;
            case 21: s = "find$ subtle faults with"; break;
            case 22: s = "laugh$ and drink$ all night with"; break;
            case 23: s = "befriend$"; break;
            case 24: s = "make$ a truce with"; break;
            case 25: s = "give$ secret financial aid to"; break;
            case 26: s = "brainwash*"; break;
            case 27: s = "trade$ baseball cards with"; break;
            case 28: s = "sell$ " + this.genNounPhrase(0) + " to"; break;
            case 29: s = "caricature$"; break;
            case 30: s = "sanitize$"; break;
            case 31: s = "satiate$"; break;
            case 32: s = "organize$"; break;
            case 33: s = "graduate$ from"; break;
            case 34: s = "give$ lectures on morality to"; break;
            case 35: s = "^ a change of heart about"; break;
            case 36: s = "play$ pinochle with"; break;
            case 37: s = "give$ a pink slip to"; break;
            case 38: s = "share$ a shower with"; break;
            case 39: s = "buy$ an expensive gift for"; break;
            case 40: s = "cook$ cheese grits for"; break;
            case 41: s = "take$ a peek at"; break;
            case 42: s = "pee$ on"; break;
            case 43: s = "write$ a love letter to"; break;
            case 44: s = "fall$ in love with"; break;
            case 45: s = "avoid$ contact with"; break;
            case 46: s = ") a big fan of"; break;
            case 47: s = "secretly admire$"; break;
            case 48: s = "borrow$ money from"; break;
            case 49: s = "operate$ a small fruit stand with"; break;
            case 50: s = "throw$ " + this.genNounPhrase(0) + " at"; break;
            case 51: s = "bur&"; break;
            case 52: s = "can be kind to"; break;
            case 53: s = "learn$ a hard lesson from"; break;
            case 54: s = "plan$ an escape from " + this.genNounPhrase(0); break;
            case 55: s = "make$ love to"; break;
        }
        let vt = "",i;
        for (i=0; i<s.length; i++ ) {
            var c = s.substring(i,i+1);
            var w = c;
            if ( c == '$' ) {
                if ( tense == 0 )       w = "";
                else if ( tense == 1 )  w = "s";
            } 
            else if ( c == '*' ) {
                if ( tense == 0 )       w = "";
                else if ( tense == 1 )  w = "es";
            }
            else if ( c == ')' ) {
                if ( tense == 0 )       w = "be";
                else if ( tense == 1 )  w = "is";
            }
            else if ( c == '^' ) {
                if ( tense == 0 )       w = "have";
                else if ( tense == 1 )  w = "has";
            }
            else if ( c == '&' ) {
                if ( tense == 0 )       w = "y";
                else if ( tense == 1 )  w = "ies";
            }
            vt += w;
        }
 
        if ( this.bool({likelihood:30}) )
            vt = this.genAdverb() + " " + vt;
        return vt;
    }
     
     
    genIntransitiveVerbPhrase() {
        var s = "";
        switch(this.natural({max:27})){
            case 0 : s = "leaves"; break;
            case 1 : s = "goes to sleep"; break;
            case 2 : s = "takes a coffee break"; break;
            case 3 : s = "hibernates"; break;
            case 4 : s = "reads a magazine"; break;
            case 5 : s = "self-flagellates"; break;
            case 6 : s = "meditates"; break;
            case 7 : s = "starts reminiscing about lost glory"; break;
            case 8 : s = "flies into a rage"; break;
            case 9 : s = "earns frequent flier miles"; break;
            case 10: s = "sweeps the floor"; break;
            case 11: s = "feels nagging remorse"; break;
            case 12: s = "returns home"; break;
            case 13: s = "rejoices"; break;
            case 14: s = "prays"; break;
            case 15: s = "procrastinates"; break;
            case 16: s = "daydreams"; break;
            case 17: s = "ceases to exist"; break;
            case 18: s = "hides"; break;
            case 19: s = "panics"; break;
            case 20: s = "beams with joy"; break;
            case 21: s = "laughs out loud"; break;
            case 22: s = "gets stinking drunk"; break;
            case 23: s = "wakes up"; break;
            case 24: s = "hesitates"; break;
            case 25: s = "trembles"; break;
            case 26: s = "ruminates"; break;
            case 27: s = "dies"; break;
        }
        return s;
    }
     
     
    genConjunction() {
        var s = "";
        switch(this.natural({max:3})){
            case 0: s = "and";
            case 1: s = "or";
            case 2: s = "but";
            case 3: s = "because";
        }
        return s;
    }
     
     
    static CapFirst(s) {
        return s.substring(0,1).toUpperCase() + s.substring(1,s.length);
    }
    capFirst(s) {
        return s.substring(0,1).toUpperCase() + s.substring(1,s.length);
    }
     
     
    genRandomSentence() {
        var stemp = this.genRandomSentenceTemplate();
        var i;
        var s = "";
        for ( i=0; i<stemp.length; i++ ) {
            var c = stemp.substring(i,i+1);
            var w = "";
            switch (c) {
                case '0': w = this.genNoun(); break;
                case '1': w = this.genNounPhrase(0); break;
                case '2': w = this.genTransitiveVerbPhrase(1); break;
                case '3': w = this.genConjunction(); break;
                case '4': w = this.genIntransitiveVerbPhrase(); break;
                case '5': w = this.genTransitiveVerbPhrase(0); break;
                case '6': w = this.genAdjective(); break;
                case '7': w = this.genAdverb(); break;
                default: w = c;
            }
            s += w;
        }
        return this.capFirst(s);
    }
}

module.exports = Gen;
// export {Gen as default};