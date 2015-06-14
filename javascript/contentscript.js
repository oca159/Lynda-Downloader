(
	function ( $ ) {
		'use strict';
		/**
		 * Sen the message
		 *
		 * @param message
		 * @param callback
		 */
		var sendMessage = function ( message, callback ) {
			message[ 'from' ] = "lyndadownload-contentscript";
			chrome.runtime.sendMessage(
				message, callback
			);
		};
		/**
		 * Generate the link to fetch the video info
		 * @param courseId
		 * @param videoID
		 * @returns {string}
		 */
		var getVideoInfoURL = function ( courseId, videoID ) {
			var baseURL = 'http://www.lynda.com/ajax/player?videoId=_videoID&courseId=_courseId&type=video';
			return baseURL.replace( '_videoID', videoID ).replace( '_courseId', courseId );
		};

		var getTranscriptInfoURL = function ( courseId, videoID ) {
			var baseURL = 'http://www.lynda.com/ajax/player?videoId=_videoID&courseId=_courseId&type=transcript';
			return baseURL.replace( '_videoID', videoID ).replace( '_courseId', courseId );
		};
		/**
		 * Get chapter id from string
		 *
		 * @param idAttr
		 * @returns {number}
		 */
		var getChapterId = function(idAttr){
			var splittedAttr = idAttr.split('-');
			return +splittedAttr[splittedAttr.length - 1];
		};
		/**
		 * Generate the download tab
		 * @returns {*|HTMLElement}
		 */
		var createDownloadTab = function () {
			var $tabControl = $( '.course-tabs' );
			var $downloadTab = $( '<li><h2><a data-tab="#tab-download" href="#" data-qa="qa_tab_courseDownload">Download</a></h2></li>' );
			$downloadTab.appendTo( $tabControl );

			var $courseExtras = $('.course-extras');
			var $downloadTabContent = $('<div class="tab-content" id="tab-download">' +
			                                '<div class="course-description-box">' +
                                               '<div class="course-title">Download this course for archive</div>' +
                                                '<div class="course-description" id="download_ontainer">' +
                                                    '<div class="progress-wrap progress">' +
                                                      '<div class="progress-bar progress"></div>' +
                                                    '</div>'+
		                                            '<div id="controls"></div>'+
		                                            '<div id="log"></div>'+
		                                        '</div>' +
											'</div>' +
                                         '</div>');
			$downloadTabContent.appendTo($courseExtras);

			$downloadTab.click(function(e){
				e.preventDefault();
				$('.course-tabs h2.active' ).removeClass('active');
				$downloadTab.find('h2').addClass('active');
				$courseExtras.find('.tab-content' ).hide();
				$downloadTabContent.show();
			});
			$(document).on('click', 'dd.download_link', function(e) {
				e.preventDefault();
				$(this ).text('Requesting')
				var data = $(this ).data('video');
				sendMessage({action:'DOWNLOAD', data:data });
			});
			$downloadTab.trigger('click');
			return $downloadTabContent;
		};
		var moveProgressBar = function(percent) {
			var getProgressWrapWidth = $('.progress-wrap').width();
			var progressTotal = percent * getProgressWrapWidth;
			var animationLength = 2500;

			// on page load, animate percentage bar to data percentage length
			// .stop() used to prevent animation queueing
			$('.progress-bar').stop().animate({
				left: progressTotal
			}, animationLength);
		};
		/**
		 * Show the status
		 * @param status
		 * @returns {*|jQuery|HTMLElement}
		 */
		var showStatus = function ( status ) {
			if($.type(status) === "string")
			{
				status = $('<span>'+status+'</span>');
			}
			var $statusContainer = $( '#log' );
			var $statusLi = $( '<li></li>' );
			$statusLi.append(status);
			$statusContainer.prepend( $statusLi );
			return status;
		};
		/**
		 * Get the best resolution link
		 * @param links
		 * @returns {*}
		 */
		var getBestLink = function ( links ) {
			var resolutions = [ 1080, 720, 540, 360 ];
			for ( var index = 0; index < resolutions.length; index ++ ) {
				var res = resolutions[ index ];
				if ( res in links ) {
					return links[ res ];
				}
			}
		};
		var getParams = function(sPageURL) {
			var vars = [], hash;
			var hashes = sPageURL.slice(sPageURL.indexOf('?') + 1).split('&');
			for(var i = 0; i < hashes.length; i++)
			{
				hash = hashes[i].split('=');
				vars.push(hash[0]);
				vars[hash[0]] = hash[1];
			}
			return vars;
		};
		/**
		 * Process the single chapter
		 * @param chapter
		 * @param onFinishedCallback
		 */
		var processChapter = function ( chapter, onVideoSuccessCallback, onFinishedCallback ) {
			var proccessedChapter = {};
			proccessedChapter.title = chapter.title;
			proccessedChapter.id = chapter.id;
			proccessedChapter.videos = [];
			var videoUrls = chapter.videoUrls;
			showStatus('Fetching chapters <strong>' + chapter.title + '</string>');
			$.each( videoUrls, function ( index, url ) {
				var params = getParams(url);
				var $tocVideoDD = $('#toc-video-'+params['videoId']).find('dd');
				$.ajax( {
					url: url,
					method: 'GET',
					beforeSend: function () {
						$tocVideoDD.attr('id', 'video_' + params['videoId']);
						$tocVideoDD.attr('class', 'download_link');
						$tocVideoDD.text('Fetching');
					},
					success: function ( resp ) {
						var slug = resp.ID + '-' + generateSlug( resp.Title );
						var video = {
							id: resp.ID,
							FileName: slug+'.mp4',
							Title: resp.Title,
							Slug:slug,
							Link:getBestLink( resp.PrioritizedStreams[ 0 ] )
						};
						$tocVideoDD.text('Download');
						$tocVideoDD.css('cursor','pointer');
						onVideoSuccessCallback(video);
						proccessedChapter.videos.push( video );
						moveProgressBar( (videoUrls.length/proccessedChapter.videos.length) * 100);
						if ( proccessedChapter.videos.length == videoUrls.length ) {
							onFinishedCallback( proccessedChapter );
						}
					}
				} );
			} );
		};
		/**
		 * Generate the slug
		 * @param value
		 * @returns {string}
		 */
		var generateSlug = function ( value ) {
			return value.toLowerCase().replace( /-+/g, '' ).replace( /\s+/g, '-' ).replace( /[^a-z0-9-]/g, '' );
		};
		/**
		 * Generate the download link
		 * @param title
		 * @param href
		 * @param filename
		 * @returns {string}
		 */
		var generateDownloadLink = function ( title, href, filename ) {
			return '<a class="download_link" download="' + filename + '" target="_blank" href="' + href + '">' + title + '</a>';
		};
		/**
		 * Generate file from object
		 * @param object
		 * @returns {string}
		 */
		var generateFile = function ( object ) {
			return 'data:application/octet-stream;charset=utf-8;base64,' + btoa( JSON.stringify( object ) );
		};
		/**
		 * Listten for request from content script
		 */
		var startProcess = function(data){
			showStatus( 'Start' );
			var course = data;
			var chapters = data.chapters;
			var processedChapters = [];

			$.each( chapters, function ( index, chapter ) {
				processChapter( chapter,
					function(video){
						var data = jQuery.extend({
							isDownloadTranscript : course.isDownloadTranscript,
							courseSlug:course.slug,
							chapterSlug:generateSlug(chapter.title),
							transcriptUrl:getTranscriptInfoURL(course.id, video.id)
						}, video);
						var $status = $('#video_'+ video.id);
						$status.data('video',data);
					},function ( processedChapter ) {
						processedChapters.push( processedChapter );
						if ( processedChapters.length == chapters.length ) {
							course.chapters = processedChapters;
							var content = generateFile( course );
							showStatus( generateDownloadLink( 'Download <strong>course info</strong>', content, 'info-' + course.id + '-' + generateSlug( course.title ) + '.json' ) );
							showStatus('<strong>=========== DONE =========</strong>')
						}
					}
				);
			} );
		};
		/**
		 * Generate the downloadButton
		 * @returns {*|HTMLElement}
		 */
		var createDownloadButton = function(){
			return $( '<button class="em-button" id="download_video" > <i class="fa fa-download"></i> Fetch file list </button>' );
		};
		var createDownloadTranscriptButton = function(){
			return $( '<span><input id="download_transcript" type="checkbox">Download Transcript</span>');
		};
		var showNotify = function(message){
			sendMessage({
				action:'NOTIFY',
				data:{
					message:message
				}
			}, function(){});
		};
		/**
		 * Process the status
		 *
		 * @param id
		 * @param data
		 */
		var processDownloadStatus = function(id, data){
			var $tocVideoDD = $('#toc-video-'+id).find('dd');
			/**
			 * While downloading
			 */
			if('error' in data)
			{
				$tocVideoDD.text(data.error.current.toLowerCase().replace('_', ' '));
				return;
			}

			if('paused' in data)
			{
				if(data.paused.current == true)
				{
					$tocVideoDD.text('Paused');
				}
				else
				{
					$tocVideoDD.text('Downloading');
				}
				return;
			}
			if('danger' in data){
				switch (data.danger.current){
					case 'file':
						$tocVideoDD.text( 'filename is suspicious' );
						break;
					case 'url':
						$tocVideoDD.text( 'URL is known to be malicious' );
						break;
					case 'content':
						$tocVideoDD.text( 'file is known to be malicious' );
						break;
					case 'uncommon':
						$tocVideoDD.text( 'URL is not commonly downloaded and could be dangerous' );
						break;
					case 'host':
						$tocVideoDD.text( 'The download came from a host known to distribute malicious binaries and is likely dangerous' );
						break;
					case 'unwanted':
						$tocVideoDD.text( 'Unwanted' );
						break;
					case 'safe':
						$tocVideoDD.text( 'Safe' );
						break;
					case 'accepted':
						$tocVideoDD.text( 'Accepted' );
						break;
				}
			}
			if(!('state' in data))
			{
				$tocVideoDD.text( 'Downloading' );
			}
			else {
				switch ( data.state.current ) {
					case 'interrupted':
						$tocVideoDD.text( 'Interrupted' );
						break;
					case 'in_progress':
						$tocVideoDD.text( 'Downloading' );
						break;
					case 'complete':
						$tocVideoDD.text( 'Completed' );

						break;
				}
			}
		};
		$( document ).ready( function () {
			var $downloadTab = createDownloadTab();
			var $downloadButton = createDownloadButton();
			var $transcriptButton = createDownloadTranscriptButton();
			var $controlEl =$downloadTab.find('#controls')
			$controlEl.append($downloadButton );
			$controlEl.append($transcriptButton);
			$downloadButton.click( function ( e ) {
				e.preventDefault();
				var chapters = [];
				var courseId = $( '#currentCourseId' ).val();
				var title = $('#tab-my-notes .italics' ).text();
				var $toc = $( 'ol#course-toc-outer' );
				var $chapters = $toc.find( 'li[id*="toc-chapter"]' );
				$chapters.each( function () {
					var $chapterTitle = $( this ).find( 'a[id*="chapter-title"]' );
					var chapterTitle = $chapterTitle.text();
					var $chapterVideos = $( this ).find( 'dl[id*="toc-video"]' );
					var chapter = {};
					chapter.title = chapterTitle;

					var chapter_id = getChapterId($chapterTitle.attr('id' ));
					chapter.videoUrls = [];
					chapter.transcriptUrls = [];
					chapter.id = chapter_id;
					$chapterVideos.each( function () {
						var $videoLink = $( this ).find( 'a[id*="lnk"]' );
						var videoId = $videoLink.data( 'video-id' );
						var videoInfoUrl = getVideoInfoURL( courseId, videoId );
						chapter.videoUrls.push(videoInfoUrl);
					} );
					chapters.push(chapter);
				} );
				var exercisefileslist = [];
				var $exercisefileslist = $('#exercisefileslist');
				if($exercisefileslist.length > 0){
					$exercisefileslist.find('a' ).each(function(){
						var link = $(this ).attr('href');
						exercisefileslist.push(link);
					});
				}
				var isDownloadTranscript = $('#download_transcript' ).is(":checked");
				startProcess({
					isDownloadTranscript:isDownloadTranscript,
					chapters : chapters,
					id : courseId,
					slug:generateSlug(title),
					title:title,
					exercisefileslist:exercisefileslist
				});
			} );
			/**
			 * Listenning for background script message
			 */
			chrome.runtime.onMessage.addListener(
				function ( request, sender, sendResponse ) {
					if ( request.from == "lyndadownload-backgroundscript" ) {
						switch ( request.action ) {
							case 'DOWNLOAD_STATUS':
								processDownloadStatus(request.video_id, request.data);
								break;
						}
					}
					sendResponse( 'recived' );
				} );
		} );
	}( jQuery )
)