var LastFM = {
	apiKey: 'e0f4fa2ac4c4480e230c28ad3885600e',

	auth: function(username, password, callback) {

		localStorage.setItem('username', username);
		localStorage.setItem('password', window.btoa(password));

		var obj = {
			method: 'auth.getMobileSession',
			username: username,
			password: password
		};

		LastFM.sign(obj, function(response) {
			if('session' in response) localStorage.setItem('session', response.session.key);
			if(typeof callback === 'function') callback(response);
		});
		return true;
	},

	sign: function(params, callback) {

		LastFM.genSig(params, function(response) {

			params.api_key = LastFM.apiKey;
			params.api_sig = response.sig;

			var url = 'https://ws.audioscrobbler.com/2.0/';
			var xhr = new XMLHttpRequest();
			xhr.open('POST', url);
			xhr.setRequestHeader("Content-type","application/x-www-form-urlencoded");
			xhr.onreadystatechange = function() {
				if(xhr.readyState === 4) {
					var response = JSON.parse(this.responseText);
					if(typeof callback === 'function') callback(response);
				}
			};
			var send = '';
			var i=0;
			for(var key in params) {
				if(params.hasOwnProperty(key)) {
					if(i > 0) send += '&';
					send += key + '=' + params[key];
					i++;
				}
			}
			send += '&format=json';
			xhr.send(send);

		});
	},

	genSig: function(params, callback) {

		var send = '';
		var i=0;
		for(var key in params) {
			if(params.hasOwnProperty(key)) {
				if(i > 0) send += '&';
				send += key + '=' + params[key];
				i++;
			}
		}

		var xhr = new XMLHttpRequest();
		xhr.open('POST', 'https://ucollective.org/apis/lastfm/signature.php');
		xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
		xhr.onreadystatechange = function() {
			if(xhr.readyState === 4 && xhr.status === 200) {
				var response = JSON.parse(this.responseText);
				if(typeof callback === 'function') callback(response);
			}
		};
		xhr.send(send);
	},

	scrobble: function(artist, track, callback) {
		var obj = {
			method: 'track.scrobble',
			timestamp: Math.floor(Date.now()/1000),
			artist: artist,
			track: track,
			sk: localStorage.getItem('session')
		};

		LastFM.genSig(obj, function(response) {

			obj.api_key = LastFM.apiKey;
			obj.api_sig = response.sig;

			var url = 'https://ws.audioscrobbler.com/2.0/';
			var xhr = new XMLHttpRequest();
			xhr.open('POST', url);
			xhr.setRequestHeader("Content-type","application/x-www-form-urlencoded");
			xhr.onreadystatechange = function() {
				if(xhr.readyState === 4 && xhr.status === 200) {
					var response = JSON.parse(this.responseText);
					if(typeof callback === 'function') callback(response);
				}
			};
			var send = '';
			var i=0;
			for(var key in obj) {
				if(obj.hasOwnProperty(key)) {
					if(i > 0) send += '&';
					send += key + '=' + obj[key];
					i++;
				}
			}
			send += '&format=json';
			xhr.send(send);

		});
		return true;
	},

	nowPlaying: function(artist, track, duration, callback) {
		duration = Math.floor(duration);
		var obj = {
			method: 'track.updateNowPlaying',
			timestamp: Math.floor(Date.now()/1000),
			artist: artist,
			track: track,
			duration: duration,
			sk: localStorage.getItem('session')
		};

		LastFM.genSig(obj, function(response) {

			obj.api_key = LastFM.apiKey;
			obj.api_sig = response.sig;

			var url = 'https://ws.audioscrobbler.com/2.0/';
			var xhr = new XMLHttpRequest();
			xhr.open('POST', url);
			xhr.setRequestHeader("Content-type","application/x-www-form-urlencoded");
			xhr.onreadystatechange = function() {
				if(xhr.readyState === 4 && xhr.status === 200) {
					var response = JSON.parse(this.responseText);
					if(typeof callback === 'function') callback(response);
				}
			};
			var send = '';
			var i=0;
			for(var key in obj) {
				if(obj.hasOwnProperty(key)) {
					if(i > 0) send += '&';
					send += key + '=' + obj[key];
					i++;
				}
			}
			send += '&format=json';
			xhr.send(send);

		});
		return true;
	}
};