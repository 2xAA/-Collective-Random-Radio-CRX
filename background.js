function htmlDecode(string) {
	var d = document.createElement('div');
	d.innerHTML = string;
	return d.textContent;
}

function convertImgToBase64(url, callback) {
	var canvas = document.createElement('CANVAS'),
		ctx = canvas.getContext('2d'),
		img = new Image();

	img.crossOrigin = 'Anonymous';
	img.onload = function() {
		canvas.height = img.height;
		canvas.width = img.width;
		ctx.drawImage(img,0,0);
		var dataURL = canvas.toDataURL('image/png');
		callback(dataURL);
		canvas = null;
	};
	img.onerror = function() {
		callback("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAAA8AgMAAABHkjHhAAAACXBIWXMAAAsSAAALEgHS3X78AAAADFBMVEVmZmZ9fX2ZmZn///8LkU3MAAAAAWJLR0QDEQxM8gAAAGhJREFUKM/t07EJgEAUBNG54TS2JEuwTm3i+jGxAEET4VhjQ38w2UsWflmJq3vbGBaejHLB1CMnzD1yUOiRRqXH5JgckyPBMTkmP01+mLwZ/MLkmByTY3IkBzA5Jq//fv9+X+5XXv96A5Lmq5cFbir5AAAAHHRFWHRTb2Z0d2FyZQBBZG9iZSBGaXJld29ya3MgQ1M1cbXjNgAAABV0RVh0Q3JlYXRpb24gVGltZQAyNy8xLzEyzGyEzgAAAABJRU5ErkJggg==");
	};
	img.src = url;
}

/* Update stuff */
var updateversion = null;

function updateAvailable(version) {
	chrome.notifications.create('ucupdate',
		{
			type : "basic",
			iconUrl: 'icon.png',
			title: 'Update available',
			message: 'Current version: ' + chrome.app.getDetails().version + '\nUpdate version: ' + version,
			buttons: [
				{title: 'Update now!'},
				{title: 'Wait until later...'}
			]
		},
		function() {}
	);
}

// Fired when an update is available
chrome.runtime.onUpdateAvailable.addListener(function(version) {
	updateversion = version;
	updateAvailable(updateversion);
});

// Fired when an update has taken place
chrome.runtime.onInstalled.addListener(function(details) {
	if(details.reason === 'update') {
		chrome.notifications.create('ucupdatesuccess',
			{
				type : "basic",
				iconUrl: 'icon.png',
				title: 'You\'re up-to-date (woo!)',
				message: 'Current version: ' + chrome.app.getDetails().version + '\nLast version: ' + details.previousVersion,
				contextMessage: 'Click for more info!',
			},
			function() {}
		);
	}
});


function notify(av, title, author, desc) {
	if(!settings.notifications) return;

	if(notification) {
		chrome.notifications.clear(notification, function() {
			notification = 'ucRadio' + Date.now() + Math.random();
		});
	} else notification = 'ucRadio' + Date.now() + Math.random();

	av = av.replace('https://www.gravatar', 'http://www.gravatar');
	av = av.split("?")[0];
	av += '?d=404';

	convertImgToBase64(av, function(base64Img) {
		chrome.notifications.create(notification,
			{
				type : "basic",
				iconUrl: base64Img,
				title: htmlDecode(title),
				message: author,
				contextMessage: htmlDecode(desc),
				buttons: [
					{title: 'Next', iconUrl: 'icons/next.png'},
					{title: 'Previous', iconUrl: 'icons/prev.png'}
				]
			},

			function(notID) {
				notification = notID;
			}
		);
	});
}

Audio.prototype.isPlaying = function() {return !this.paused;};

function audioFade(el, cb) {
	if(el.volume === 0) {
		cb();
		return;
	}

	el.volume = (el.volume - 0.1).toFixed(2);
	setTimeout(function() {
		audioFade(el, cb);
	}, 1000/60);
}

var settings = JSON.parse(localStorage.getItem('settings')) || localStorage.setItem('settings', JSON.stringify({notifications: true, visuals: true, mediakeys: true, scrobbleperc: 40})), settings = JSON.parse(localStorage.getItem('settings'));
var notification;
var cIndex = -1;
var trackList = [];
var userList = {};
var timeInterval;
var booted = false;

document.addEventListener('DOMContentLoaded', function() {
	
	var audio = document.getElementsByTagName('audio')[0];

	var aCtx = new window.AudioContext();
	var sampleSize = 1024;

	var gainNode = aCtx.createGain();
	gainNode.gain.value = 1;
		
	var audioSrc = aCtx.createMediaElementSource(audio);
	audioSrc.connect(gainNode);
	
	gainNode.connect(aCtx.destination);
	
	var meyda = new Meyda(aCtx, audioSrc, sampleSize);

	/* Last.fm */
	var lfmTimer = null,
		lfmsess = localStorage.getItem('lfmsession'),
		scrobbleReady = false;

	function lfmTimerFN() {
		if(audio.currentTime > ((settings.scrobbleperc / 100) * audio.duration)) {
			scrobbleReady = true;
			clearInterval(lfmTimer);
			return;
		}
	}

	function nowPlaying(author, track, duration) {
		if(lfmsess === null) return;

		if(lfmTimer) clearInterval(lfmTimer);

		lfmTimer = setInterval(lfmTimerFN, 2000);

		LastFM.nowPlaying(author, track, duration);
	}

	var next = function(cb) {
		clearTimeout(timeInterval);

		if(scrobbleReady && lfmsess !== null) {
			LastFM.scrobble(trackList[cIndex].author, trackList[cIndex].title, function() {
				scrobbleReady = false;
			});
		}

		audioFade(audio, function() {
			audio.currentTime = 0;
			audio.paused = true;
			clearTimeout(timeInterval);
			if(cIndex < trackList.length-1 && cIndex > -1) {
				cIndex++;
				notify('http:'+trackList[cIndex].avatar, trackList[cIndex].title, trackList[cIndex].author, trackList[cIndex].description);
				audio.src = trackList[cIndex].file.replace(" ", "%20");
				audio.volume = 1;
				audio.play();
				audio.currentTime = 0;
				timeInterval = setTimeout(sendTime, 1000/60);
				audio.oncanplay = function() {
					nowPlaying(trackList[cIndex].author, trackList[cIndex].title, this.duration);
				};
				if(cb) cb(trackList[cIndex]);
			} else {
				uC.audio.rand({
					amount: 1,
					success: function(data) {
						notify('http:'+data[0].avatar, data[0].title, data[0].author, data[0].description);
						audio.oncanplay = sendTime;
						audio.src = data[0].file.replace(" ", "%20");
						audio.volume = 1;
						audio.play();
						audio.currentTime = 0;
						timeInterval = setTimeout(sendTime, 1000/60);
						audio.oncanplay = function() {
							nowPlaying(data[0].author, data[0].title, this.duration);
						};
						trackList.push(data[0]);
						cIndex++;
						if(typeof cb === "function") cb(data[0]);
					}
				});
			}
		});
	};

	var previous = function(cb) {
		if(cIndex-1 < 0) {
			audio.currentTime = 0;
			cb(false);
			return;
		}
		clearTimeout(timeInterval);

		if(scrobbleReady && lfmsess !== null) {
			LastFM.scrobble(trackList[cIndex].author, trackList[cIndex].title, function() {
				scrobbleReady = false;
			});
		}

		if(audio.currentTime < 2) {

			audioFade(audio, function() {
				audio.currentTime = 0;
				audio.paused = true;
				cIndex--;
				notify('http:'+trackList[cIndex].avatar, trackList[cIndex].title, trackList[cIndex].author, trackList[cIndex].description);
				audio.src = trackList[cIndex].file.replace(" ", "%20");
				audio.volume = 1;
				audio.play();
				audio.currentTime = 0;
				timeInterval = setTimeout(sendTime, 1000/60);
				audio.oncanplay = function() {
					nowPlaying(trackList[cIndex].author, trackList[cIndex].title, this.duration);
				};
				if(cb) cb(trackList[cIndex]);
			});
		} else {
			audio.currentTime = 0;
			timeInterval = setTimeout(sendTime, 1000/60);
			if(cb) cb(trackList[cIndex]);
		}
	};

	var playPause = function(cb) {
		if(!booted) {
			booted = true;
			nowPlaying('http:'+trackList[cIndex].author, trackList[cIndex].title, audio.duration);
			notify('http:'+trackList[cIndex].avatar, trackList[cIndex].title, trackList[cIndex].author, trackList[cIndex].description);
		}

		if(!audio.paused) {
			audio.pause();
			if(cb) cb(false);
		} else if(cIndex < 0) {
			next(cb);
		} else {
			audio.volume = 1;
			audio.play();
			sendTime();
			if(cb) cb(true);
		}
	};

	var sendMeyda = function() {
		var meyVal = meyda.get(['buffer', 'zcr', 'rms']);
		//meyVal.buffer = meyda.windowing(meyVal.buffer, "hanning");
		//meyVal.buffer = meyda.windowing(meyVal.buffer, "hamming");

		meyVal.buffer = Array.prototype.slice.call(meyVal.buffer);

		chrome.runtime.sendMessage({meyda: meyVal}, function() {});
	};

	var sendTime = function() {
		chrome.runtime.sendMessage({time: {duration: audio.duration, currentTime: audio.currentTime}}, function() {
			if(audio.paused) return;
			sendMeyda();
			timeInterval = setTimeout(sendTime, 1000/60);
		});
	};

	audio.addEventListener('ended', function() {
		next(function(data) {
			chrome.runtime.sendMessage({data: data}, function() {});
		});
	});

	var userInfo = function(author, cb) {
		if(author in userList) {
			if(cb) cb(userList[author]);
		} else {
			uC.user.info({
				user: author,
				success: function(data) {
					if(!(author in userList)) {
						userList[author] = data;
					}
					
					if(cb) cb(data);
				}
			});
		}
	};

	/* Message parser */
	/* fun fact, you've gotta add a return true to the messageParser before the sendResponse method is valid! */
	var messageParser = function(request, sender, sendResponse) {
		if('rand' in request || 'next' in request) {
			next(sendResponse);
			return true;
		}

		if('playPause' in request) {
			playPause(sendResponse);
			return true;
		}

		if('previous' in request) {
			previous(sendResponse);
			return true;
		}

		if('hasStarted' in request) {
			if(cIndex < 0) sendResponse(false);
			else sendResponse(true);

			return true;
		}

		if('getData' in request) {
			sendResponse(trackList[cIndex]);
			return true;
		}

		if('isPlaying' in request) {
			sendResponse(!audio.paused);
			return true;
		}

		if('startTimer' in request) {
			timeInterval = setTimeout(sendTime, 1000/60);
			return true;
		}

		if('timeupdate' in request) {
			clearTimeout(timeInterval); //Need to clear the timeout to stop the UI jumping
			audio.currentTime = request.timeupdate;
			sendResponse(true);
			timeInterval = setTimeout(sendTime, 1000/60);
			return true;
		}

		if('userInfo' in request) {
			userInfo(trackList[cIndex].author, function(response) {
				sendResponse(response);
			});
			return true;
		}

		if('lfm' in request) {
			if(request.lfm === 'auth') {
				LastFM.auth(request.username, request.password, function(response) {
					if('session' in response) {
						localStorage.setItem('lfmsession', response.session.key);
						lfmsess = response.session.key;

						nowPlaying(trackList[cIndex].author, trackList[cIndex].title, audio.duration);
					}
					sendResponse(response);
				});
				return true;
			}
		}

		if('settings' in request) {
			if(request.settings === 'get') {
				settings = JSON.parse(localStorage.getItem('settings'));
				sendResponse(settings);
				return true;
			}

			if(request.settings === 'set') {
				settings = request.payload;
				localStorage.setItem('settings', JSON.stringify(request.payload));
				sendResponse(settings);
				return true;
			}
		}
	};

	chrome.runtime.onMessage.addListener(messageParser);

	/* Notification button click listener */
	chrome.notifications.onButtonClicked.addListener(function(nID, bID) {
		if(nID === 'ucupdate') {
			if(bID === 0) {
				chrome.runtime.reload();
			} else {
				chrome.notifications.clear('ucupdate', function() {
					setTimeout(updateAvailable, 1800*1000, updateversion);
				});
			}
		}
		
		if(nID === notification) {
			if(bID === 0) {
				next(function(data) {
					chrome.runtime.sendMessage({data: data}, function() {});
				});
			} else {
				previous(function(data) {
					chrome.runtime.sendMessage({data: data}, function() {});
				});
			}
		}
	});

	/* Notification body click listener */
	chrome.notifications.onClicked.addListener(function(id) {
		if(id === notification) {
			//If an audio notification is clicked, take user to the song page on µC
			chrome.tabs.create({ url: trackList[cIndex].url });

		} else if(id === 'ucupdatesuccess') {
			var width = window.screen.availWidth;
			var height = window.screen.availHeight;

			width = (width/2) - 255;
			height = (height/2) - 355;

			chrome.windows.create({url: 'changelog.html', type: 'popup', left: Math.round(width), top: Math.round(height), width: 510, height: 710}, function() {});
		}
	});

	/* Media key bindings */
	chrome.commands.onCommand.addListener(function(command) {
		if(!settings.mediakeys) return;

		switch(command) {
			case 'playpause':
				playPause(function(data) {
					chrome.runtime.sendMessage({ui: 'playPause', state: data}, function() {});
				});
				break;

			case 'next':
				next(function(data) {
					chrome.runtime.sendMessage({data: data}, function() {});
				});
				break;

			case 'prev':
				previous(function(data) {
					chrome.runtime.sendMessage({data: data}, function() {});
				});
				break;
		}
	});

	/* Boot up */
	uC.audio.rand({
		amount: 1,
		success: function(data) {
			audio.src = data[0].file.replace(" ", "%20");
			audio.volume = 1;
			audio.pause();
			audio.currentTime = 0;
			timeInterval = setTimeout(sendTime, 1000/60);
			trackList.push(data[0]);
			cIndex++;
		}
	});


}, false);