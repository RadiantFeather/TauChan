"use strict";
document.addEventListener('init',(e)=>{
//------------------------------------------

let _ = {};

$('a.update').on('click',updateThread);
function updateThread(e){
	
}

$('.file .full').on('click',toggleFullImage);
function toggleFullImage(e){
    this.src = this.dataset.src;
    this.parentNode.parentNode.parentNode.classList.toggle('open');
    e.preventDefault();
}


//------------------------------------------
});