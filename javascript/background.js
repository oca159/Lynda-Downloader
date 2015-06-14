var queue = {};

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
	        }
        }
	    console.log(downloadDelta, queue);
	    sendMessage({action:'DOWNLOAD_STATUS', video_id:downloadObject.data.id, data:downloadDelta}, downloadObject.tab.id);
    }
});
function log(name, data) {
    console.log(name + " : ");
    console.log(data);
}