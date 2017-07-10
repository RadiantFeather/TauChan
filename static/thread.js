"use strict";
const _ = {};

function INIT(){
    let $ = window.vQuery;
    $('a.update').on('click',updateThread);
    $('label[for]').on('keydown',labelKeypressProxy);
    $('.post .info .quote').on('click',quotePost);
    $('.post .media .file').on('click',toggleImage);
    $('.post .media .file').on('keydown',mediaItemKeypressProxy);
    $('.post .media .file iframe +.close').on('click',closeVideo);
    $('.post .media .file iframe +.close').on('keydown',closeVideoKeypressProxy);
}

// proxy keypresses on focused labels to their linked inputs
function labelKeypressProxy(e){
    if (e.keyCode == 32) {
        document.getElementById(this.getAttribute('for')).click();
        e.preventDefault();
    }
}
// proxy keypresses on focused media items 
function mediaItemKeypressProxy(e){
    if (e.keyCode == 32) {
        toggleImage.bind(this)(e);
    }
}

function closeVideoKeypressProxy(e){
    if (e.keyCode == 32){
        closeVideo.bind(this)(e);
    }
}

function updateThread(e){
	// Interface with socket.io commands for this one
}

function closeVideo(e){
    let frame = this.parentNode.querySelector('.full');
    frame.src = "";
    frame.removeAttribute('src');
}

function toggleImage(e){
    let parent = this.parentNode.parentNode;
    if (parent.classList.contains('open')){
        parent.classList.remove('open');
        if (!parent.parentNode.querySelectorAll('.item.open').length){
            parent.parentNode.classList.remove('open');
        }
    } else {
        parent.classList.add('open');
        parent.parentNode.classList.add('open');
        let full = parent.querySelector('.full');
        if (!full.hasAttribute('src')) full.src = full.dataset.src;
    }
    e.preventDefault();
}

function quotePost(e){
    if (window.PAGE.type == 'thread') {
        let postnum = parseInt(e.target.parentNode.parentNode.id.slice(1),10);
    }
}

Object.assign(_,{quotePost,toggleImage,updateThread,labelKeypressProxy});

window.Thread = _;

window.PAGE.init ? INIT() : window.addEventListener('init',INIT);