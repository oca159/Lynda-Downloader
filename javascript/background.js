var queue = {};
var lastNotifyTab = -1;
var sendMessage = function ( message,tabId, callback ) {
	message[ 'from' ] = "lyndadownload-backgroundscript";
	chrome.tabs.sendMessage(tabId, message, callback);
};

var download = function(data, tab){
	console.log(data);
    chrome.downloads.download({
        url: data.Link,
        filename: 'lynda/' + data.courseSlug + '/' + data.chapterSlug + '/' + data.FileName,
	    saveAs:false,
	    conflictAction:'overwrite'
    }, function (downloadId) {
        if(chrome.runtime.lastError){
            console.log("Error", chrome.runtime.lastError);
	        sendMessage({action:'DOWNLOAD_STATUS', video_id:data.id}, tab.id);
        }
        else {
            queue[downloadId] = {
	            data: data,
	            tab:tab
            };
        }
    });
	if(data.isDownloadTranscript){
		chrome.downloads.download({
			url: data.transcriptUrl,
			filename: 'lynda/' + data.courseSlug + '/' + data.chapterSlug + '/' + data.FileName.replace('.mp4', '.json'),
			saveAs:false,
			conflictAction:'overwrite'
		});
	}
};
var showNotify = function(settings, callback){
	var defaultOption = {
		type: "basic",
		title: 'Lyda Downloader',
		priority: 2,
		iconUrl: "images/icon_32.png"
	};
	for(prop in defaultOption)
	{
		if(!(prop in settings))
		{
			settings[prop] = defaultOption[prop];
		}
	}
	chrome.notifications.create( "lynda_download", settings, callback);
};
chrome.notifications.onClicked.addListener(function(notificationId){
	if(notificationId =='lynda_download'){
		chrome.tabs.update(lastNotifyTab.id, {active:true, highlighted:true}, function(tab){
			if(chrome.runtime.lastError){
				console.log('error');
			}
		});
		chrome.notifications.clear('lynda_download');
	}
});
/**
 * Listen for message passing
 */
chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        if (request.from == "lyndadownload-contentscript") {
            switch (request.action){
                case 'DOWNLOAD':
	                download(request.data, sender.tab);
                    break;
	            case 'NOTIFY':
		            lastNotifyTab = sender.tab;
		            showNotify(request.data, function(){});
		            break;
            }
        }
    });

chrome.downloads.onChanged.addListener(function (downloadDelta) {
    if (queue[downloadDelta.id]) {
	    var downloadObject = queue[downloadDelta.id];
	    var state;
        if (downloadDelta.hasOwnProperty("state")) {
			state = downloadDelta.state.current;
	        if((state == 'complete') || (state == 'interrupted'))
	        {
		        delete queue[downloadDelta.id];
		        if(isEmpty(queue)){
			        showNotify({message:'Download queue is empty, Click here to download more'},function(){});
		        }
	        }
        }
	    sendMessage({action:'DOWNLOAD_STATUS', video_id:downloadObject.data.id, data:downloadDelta}, downloadObject.tab.id);
    }
});

var onHeadersReceived = function(details){
	console.log(details);
};
function isEmpty(obj) {
	for(var prop in obj) {
		if(obj.hasOwnProperty(prop))
			return false;
	}
	return true;
}
chrome.webRequest.onHeadersReceived.hasListener( onHeadersReceived ) || chrome.webRequest.onHeadersReceived.addListener( onHeadersReceived, {
	urls: [
		"http://*.lynda.com/*",
		"https://*.lynda.com/*"
	], types: "main_frame sub_frame stylesheet script image object other".split( " " )
}, [ "responseHeaders" ] );