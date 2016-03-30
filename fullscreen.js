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
var data;


/* Settings load and save */
var settings = loadSettings();

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

$.addEventListener('DOMContentLoaded', boot, false);

function boot() {
	if(!settings) {setTimeout(boot, 100); return;}

	/* Global info */
	var hasStarted = false,
		dragging = false,
		userData;

	/* Visuals */
	var canvas = $.querySelector('canvas'),
		ctx = canvas.getContext('2d'),
		meyda = [];

	window.addEventListener('resize', resize);

	function resize() {
		canvas.width = window.innerWidth * window.devicePixelRatio;
		canvas.height = window.innerHeight * window.devicePixelRatio;
		canvas.style.width = window.innerWidth + 'px';
		canvas.style.height = window.innerHeight + 'px';
	}
	resize();

	canvas.addEventListener('dblclick', function() {
		window.close();
	});

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

		if(meyda.buffer[0] != lastVal) hue = Math.floor(Math.random()*(360-1+1)+1);
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

	var updateDelta = 0;
	var updateRar;
	function updateInfo() {
		if(updateDelta < ((1000/60)*30)) updateRar = requestAnimationFrame(updateInfo);
		else cancelAnimationFrame(updateRar);

		ctx.font = '72px Arial';
		ctx.textAlign = 'center';
		ctx.globalCompositeOperation = 'xor';
		ctx.fillStyle = 'white';
		ctx.fillText(data.title, canvas.width/2, canvas.height/2 + 26);
		ctx.globalCompositeOperation = 'normal';
		updateDelta++;
	}

	/* Start up */

	chrome.runtime.sendMessage({hasStarted: true}, function(response) {
		hasStarted = response;

		if(!hasStarted) return;
	});

	chrome.runtime.sendMessage({startTimer: true}, function(response){});

	var messageParser = function(request, sender, sendResponse) {

		if('data' in request) {
			if(!request.data) return;
			data = request.data;
			cancelAnimationFrame(updateRar);
			updateDelta = 0;
			updateRar = requestAnimationFrame(updateInfo);
		}

		if('time' in request) {
			sendResponse(true);
			return true;
		}

		if('meyda' in request) {
			meyda = request.meyda;
		}

	};

	chrome.runtime.onMessage.addListener(messageParser);

	// throw canvas into fullscreen
	canvas.webkitRequestFullscreen();
}