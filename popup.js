function timeDivide(currentTime) {
	var timeX 		= Math.floor(currentTime);
	var minutes 	= Math.floor(timeX / 60);
	var seconds		= timeX - (minutes * 60);
	if(seconds < 10) seconds = '0' + seconds;
	if(minutes < 10) minutes = '0' + minutes;
	return {minutes: minutes, seconds: seconds};
}

function htmlDecode(string) {
	var d = document.createElement('div');
	d.innerHTML = string;
	return d.textContent;
}

var $ = document;

function loadSettings() {
	chrome.runtime.sendMessage({settings: 'get'}, function(response) {
		settings = response;
	});
}

function saveSettings() {
	chrome.runtime.sendMessage({settings: 'set', payload: settings}, function(response) {
		console.log('Settings saved', response);
	});
}

/* Settings load and save */
var settings;
loadSettings();

$.addEventListener('DOMContentLoaded', boot, false);

function boot() {
	if(!settings) {setTimeout(boot, 100); return;}

	/* Global info */
	var hasStarted = false,
		dragging = false,
		userData,
		duration;

	/* Visuals */
	var canvas = $.querySelector('canvas'),
		ctx = canvas.getContext('2d'),
		meyda = [];

	canvas.width = 216;
	canvas.height = 266;

	var lastVal;
	var hue;
	var maxPower = Number.NEGATIVE_INFINITY;
	var raf;
	function drawVisual() {
		if(!settings.visuals) {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			cancelAnimationFrame(raf);
			return;
		}
		raf = requestAnimationFrame(drawVisual);

		if(meyda.rms > maxPower) maxPower = meyda.rms;

		if(meyda.buffer[0] !== lastVal) hue = Math.floor(Math.random()*(360)+1);
		//ctx.clearRect(0,0,canvas.width,canvas.height);
		ctx.drawImage(canvas, -2, -2, canvas.width + 4, canvas.height + 4);

		ctx.beginPath();
		ctx.moveTo(0, canvas.height/2);
		for (var i = 0; i < meyda.buffer.length; i++) {
			var value = meyda.buffer[i] - 10 / 512;
			var y = canvas.height/2 - (canvas.height/2 * value);

			ctx.lineTo(i / meyda.buffer.length * canvas.width, y);
		}
		ctx.lineTo(canvas.width, canvas.height/2);
		//ctx.strokeStyle = 'hsl(' + hue + ', 100%, 80%)';
		ctx.strokeStyle = 'hsl(' + hue + ', 100%, ' + (50 + meyda.rms*50) + '%)';
		ctx.stroke();
		lastVal = meyda.buffer[0];
	}

	raf = requestAnimationFrame(drawVisual);

	/* User Interface */
	var ui = {
		info: {},
		player: {},
		settings: {
			lastfm: {},
			mediakeys: {}
		}
	};

	/* UI -> User/Song info */
	ui.info.container 			= $.querySelector('#info');
	ui.info.userInfoContainer 	= $.querySelector('#userinfo');
	ui.info.avatarCont 			= $.querySelector('#av');
	ui.info.avatarImg 			= $.querySelector('#avatar');
	ui.info.title 				= $.querySelector('#title');
	ui.info.author 				= $.querySelector('#author');
	ui.info.description 		= $.querySelector('#description');
	ui.info.authorInfoName 		= $.querySelector('#uiname');
	ui.info.authorInfoBio 		= $.querySelector('#uidesc');
	ui.info.linkButton 			= $.querySelector('.button.link');

	function updateInfo(data) {
		//if(typeof info != 'undefined') data = info;
		ui.info.title.innerHTML = htmlDecode(data.title);
		ui.info.author.textContent = data.author;
		ui.info.authorInfoName.textContent = data.author;

		if(data.avatar.indexOf('gravatar') > -1) {
			ui.info.avatarImg.src = data.avatar;
		} else {
			ui.info.avatarImg.src = data.avatar.replace('//', 'http://');
		}

		ui.info.linkButton.onclick = function() {
			chrome.tabs.create({ url: data.url });
		};

		ui.info.linkButton.title = 'Open '+ data.title + ' by ' + data.author + ' in New Tab';


		chrome.browserAction.setTitle({title: htmlDecode(data.title) + ' by ' + data.author});

		ui.info.description.innerHTML = htmlDecode(data.description);
	}

	function updateUserData() {
		ui.info.authorInfoBio.textContent = 'Loading...';

		chrome.runtime.sendMessage({userInfo: true}, function(response) {
			userData = response;
			ui.info.authorInfoName.textContent = response.username;
			ui.info.authorInfoBio.textContent = response.bio;
		});
	}

	ui.info.avatarImg.addEventListener('click', function() {
		ui.info.author.classList.toggle('unfocus');
		ui.info.title.classList.toggle('unfocus');
		ui.info.description.classList.toggle('unfocus');

		ui.info.userInfoContainer.classList.toggle('focus');
		ui.info.avatarCont.classList.toggle('focus');

		if(ui.info.avatarCont.classList.contains('focus')) updateUserData();
	});

	/* UI -> Player */
	ui.player.playButton = $.querySelector('div#playPause');
	ui.player.playButton.addEventListener('click', function() {


		if(ui.player.playButton.classList.contains('play')) {
			ui.player.playButton.classList.remove('play');

			if(!hasStarted) {
				ui.player.playButton.classList.add('stop', 'loading');
				hasStarted = !hasStarted;
			} else {
				ui.player.playButton.classList.add('stop');
			}
		} else {
			ui.player.playButton.classList.remove('stop');
			ui.player.playButton.classList.add('play');
		}

		chrome.runtime.sendMessage({playPause: true}, function(/*response*/) {
			//updateInfo(response);
			ui.player.playButton.classList.remove('loading');
		});

	});

	ui.player.previousButton = $.querySelector('.button.previous');
	ui.player.previousButton.addEventListener('click', function() {
		
		ui.player.playButton.classList.add('loading');
		
		chrome.runtime.sendMessage({previous: true}, function(response) {
			ui.player.playButton.classList.remove('loading');
			if(!response) return;
			updateInfo(response);
		});
	});

	ui.player.nextButton = $.querySelector('.button.next');
	ui.player.nextButton.addEventListener('click', function() {
		
		ui.player.playButton.classList.add('loading');

		chrome.runtime.sendMessage({next: true}, function(response) {
			updateInfo(response);
			ui.player.playButton.classList.remove('loading');
		});
	});

	/* UI -> Timer */
	ui.player.timeWrap 	= $.querySelector('#timebwrap');
	ui.player.timeBar 	= $.querySelector('#timerbar');
	ui.player.ball 		= $.querySelector('#ball');
	ui.player.timeOver 	= $.querySelector('#timeover');

	function mouseUp() {
		window.removeEventListener('mousemove', divMove, true);
		dragging = false;
	}

	function mouseDown() {
		window.addEventListener('mousemove', divMove, true);
		dragging = true;
	}

	function divMove(e) {
		var offset = parseInt(ui.player.timeBar.offsetLeft);
		var maxwidth = (ui.player.timeWrap.offsetWidth);

		if(e.clientX + offset <= maxwidth + offset * 2) {
			var perc 	= (e.clientX - offset) / (maxwidth / 100);
			var newTime = (perc * duration) / 100;

			ui.player.timeBar.style.width = perc + '%';
			chrome.runtime.sendMessage({timeupdate: newTime}, function() {});
		}
	}

	ui.player.timeBar.addEventListener('mousedown', mouseDown, false);
	window.addEventListener('mouseup', mouseUp, false);
	ui.player.timeWrap.addEventListener('click', divMove, false);

	/* UI -> Settings */
	ui.settings.menuButton 	= $.querySelector('.button.menu');
	ui.settings.container 	= $.querySelector('#settings');
	ui.settings.fieldset 	= $.querySelector('#settings fieldset');

	ui.settings.menuButton.addEventListener('click', function() {
		ui.info.container.classList.toggle('unfocus');
		ui.info.userInfoContainer.classList.toggle('settingsfocus');

		ui.settings.container.classList.toggle('focus');
		canvas.classList.toggle('unfocus');

		ui.info.avatarImg.classList.toggle('settingsfocus');
	});

	/* UI -> Settings-> Notifications */
	ui.settings.notificationsCheckbox = $.querySelector('#notifications');
	ui.settings.notificationsCheckbox.checked = settings.notifications;
	ui.settings.notificationsCheckbox.addEventListener('change', function() {
		settings.notifications = this.checked;
		saveSettings();
	});

	/* UI -> Settings-> Visuals */
	ui.settings.visualsCheckbox = $.querySelector('#visuals');
	ui.settings.fullscreenButton = $.querySelector('#fullscreen');

	ui.settings.visualsCheckbox.checked = settings.visuals;
	ui.settings.visualsCheckbox.addEventListener('change', function() {
		settings.visuals = this.checked;
		if(this.checked) raf = requestAnimationFrame(drawVisual);
		saveSettings();
	});
 
	ui.settings.fullscreenButton.addEventListener('click', function() {
		
		canvas.webkitRequestFullscreen();

		// chrome.windows.create({
		// 	url: 'fullscreen.html',
		// 	focused: true
		// }, function(info) {
		// 	chrome.windows.update(info.id, { state: "fullscreen" });
		// });

	});

	/* UI -> Settings-> Use Media Keys */
	ui.settings.mediakeys.checkbox		= $.querySelector('#useMediaKeys');

	ui.settings.mediakeys.checkbox.addEventListener('change', function() {
		settings.mediakeys = this.checked;
		saveSettings();
	});

	/* UI -> Settings-> Last.fm */
	ui.settings.lastfm.wrap				= $.querySelector('#lastfm');
	ui.settings.lastfm.scrobbleRange 	= $.querySelector('#lfm-scblperc');
	ui.settings.lastfm.scrobblePerc		= $.querySelector('#scblperc');
	ui.settings.lastfm.arrow 			= $.querySelector('#lfm-arrow');
	ui.settings.lastfm.signIn 			= $.querySelector('#lfm-signin');
	ui.settings.lastfm.username 		= $.querySelector('#lfm-user');
	ui.settings.lastfm.password 		= $.querySelector('#lfm-pass');
	ui.settings.lastfm.error 			= $.querySelector('#lfm-error');

	ui.settings.lastfm.userLabel 		= $.querySelector('label.lfm-user');
	ui.settings.lastfm.passLabel 		= $.querySelector('label.lfm-pass');
	ui.settings.lastfm.signInLabel 		= $.querySelector('label.lfm-signin');

	ui.settings.lastfm.scrobbleRange.addEventListener('input', function() {
		ui.settings.lastfm.scrobblePerc.innerHTML = this.value;
		ui.settings.lastfm.arrow.style.left = ((this.value/100) * ui.player.timeWrap.offsetWidth-5) + 'px';
	}, false);

	ui.settings.lastfm.scrobbleRange.addEventListener('mousedown', function() {
		ui.settings.lastfm.arrow.classList.add('visible');
	}, false);

	ui.settings.lastfm.scrobbleRange.addEventListener('mouseup', function() {
		ui.settings.lastfm.arrow.classList.remove('visible');
		settings.scrobbleperc = this.value;
		saveSettings();
	}, false);

	ui.settings.lastfm.scrobbleRange.value = settings.scrobbleperc;
	ui.settings.lastfm.scrobblePerc.innerHTML = settings.scrobbleperc;

	ui.settings.lastfm.signIn.addEventListener('click', function(e) {
		e.preventDefault();
		var username = ui.settings.lastfm.username.value;
		var password = ui.settings.lastfm.password.value;
		chrome.runtime.sendMessage({lfm: 'auth', username: username, password: password}, function(response) {
			if('error' in response) {
				if(response.error === 4) ui.settings.lastfm.error.innerHTML = 'Wrong user/pass';
				else ui.settings.lastfm.error.innerHTML = 'Something went wrong (code: ' + response.error + ')';
				return;
			} else if('session' in response) {
				ui.settings.lastfm.error.innerHTML = 'Signed into LastFM!';

				ui.settings.fieldset.removeChild(ui.settings.lastfm.userLabel);
				ui.settings.fieldset.removeChild(ui.settings.lastfm.passLabel);
				ui.settings.lastfm.signInLabel.removeChild(ui.settings.lastfm.signIn);
			}
		});
	}, false);

	var lfmsess = localStorage.getItem('lfmsession');

	if(lfmsess !== null) {
		ui.settings.lastfm.error.innerHTML = 'Signed into LastFM!';

		ui.settings.fieldset.removeChild(ui.settings.lastfm.userLabel);
		ui.settings.fieldset.removeChild(ui.settings.lastfm.passLabel);
		ui.settings.lastfm.signInLabel.removeChild(ui.settings.lastfm.signIn);
	}

	/* top kek */

	/* Start up */
	chrome.runtime.sendMessage({isPlaying: true}, function(response) {
		if(response) {
			ui.player.playButton.classList.remove('play');
			ui.player.playButton.classList.add('stop');
		} else {
			ui.player.playButton.classList.remove('stop');
			ui.player.playButton.classList.add('play');
		}
	});

	chrome.runtime.sendMessage({hasStarted: true}, function(response) {
		hasStarted = response;

		if(!hasStarted) return;

		chrome.runtime.sendMessage({getData: true}, function(response) {
			updateInfo(response);
		});
	});

	chrome.runtime.sendMessage({startTimer: true}, function(){});

	var messageParser = function(request, sender, sendResponse) {

		if('time' in request) {
			if(request.time.duration === null) request.time.duration = 1;

				duration 	= request.time.duration;
			var time 		= duration * 1000;
			var timeNow 	= request.time.currentTime * 1000;

			if(timeNow <= time) {
			if(!dragging) ui.player.timeBar.style.width = (timeNow/time * 100) + '%';
				var timed = timeDivide(timeNow/1000);
				ui.player.timeOver.innerHTML = timed.minutes + ':' + timed.seconds;
			}
			sendResponse(true);
			return true;
		}

		if('data' in request) {
			if(!request.data) return;
			updateInfo(request.data);
		}

		if('ui' in request) {
			if(request.ui === 'playPause') {
				if(request.state) {
					ui.player.playButton.classList.remove('play');
					ui.player.playButton.classList.add('stop');
				} else {
					ui.player.playButton.classList.remove('stop');
					ui.player.playButton.classList.add('play');
				}
			}
		}

		if('meyda' in request) {
			meyda = request.meyda;
		}

	};

	chrome.runtime.onMessage.addListener(messageParser);


}