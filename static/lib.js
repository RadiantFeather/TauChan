"use strict";
let _ = {};
_.setDownloadByDrag = function(){
    var files = [];
    files.forEach((node,i,arr)=>{
        node.addEventListener("dragstart",function(e){
            
            if(typeof files[0].dataset === "undefined")
    		    e.dataTransfer.setData("DownloadURL",node.getAttribute("data-downloadurl"));
            else 
                e.dataTransfer.setData("DownloadURL",node.dataset.downloadurl);
    	},false);
    });
};