/*************************************************************************
         (C) Copyright AudioLabs 2017

This source code is protected by copyright law and international treaties. This source code is made available to You subject to the terms and conditions of the Software License for the webMUSHRA.js Software. Said terms and conditions have been made available to You prior to Your download of this source code. By downloading this source code You agree to be bound by the above mentionend terms and conditions, which can also be found here: https://www.audiolabs-erlangen.de/resources/webMUSHRA. Any unauthorised use of this source code may result in severe civil and criminal penalties, and will be prosecuted to the maximum extent possible under law.

**************************************************************************/


function AudioFileLoader(_audioContext, _errorHandler, _loadOrigSR, _maxCacheSize = 10) {
  this.audioContext = _audioContext;
  this.errorHandler = _errorHandler;
  this.callbackSuccess = null;
  this.files = [];
  this.filesDone = [];
  this.tmpFiles = [];
  this.tmpFilesDone = [];
  this.offlineAudioContexts = {};
  this.loadOrigSR = _loadOrigSR || false;
  this.audioCaches = new Map();
  this.maxCacheSize = (typeof _maxCacheSize === 'number') ? _maxCacheSize : 10;
}

AudioFileLoader.prototype.clearCache = function() {
  this.audioCaches.clear();
};

AudioFileLoader.prototype.addToCache = function(_key, _value) {
  if (this.maxCacheSize <= 0) return;
  if (this.audioCaches.size === this.maxCacheSize) {
    const k = this.audioCaches.keys().next().value;
    // console.log("Cache is full, removing oldest entry: " + k);
    this.audioCaches.delete(k);
  }
  this.audioCaches.set(_key, _value);
}

AudioFileLoader.prototype.addFile = function(_url, _callback, _callbackArgument, _callbackOrigSR, _callbackArgumentOrigSR) {
  const tmp = {url: _url, callback: _callback, callbackArgument: _callbackArgument};
  if (_callbackOrigSR !== undefined && _callbackArgumentOrigSR !== undefined) {
    tmp['callbackOrigSR'] = _callbackOrigSR;
    tmp['callbackArgumentOrigSR'] = _callbackArgumentOrigSR;
  }
  this.files[this.files.length] = tmp;
};


AudioFileLoader.prototype.getOfflineAudioContext = function(_sampleRate) {
  if (this.offlineAudioContexts[_sampleRate] === undefined) {
    this.offlineAudioContexts[_sampleRate] = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, 2, _sampleRate);
  }
  return this.offlineAudioContexts[_sampleRate];
};


AudioFileLoader.prototype.loadOrigSRAudio = function(_filePath, _lst, _index, _response, _callbackSuccess, _callback, _callbackArgument) {
  // Currently only supports wav, flac, and mp3 formats
  if (typeof _filePath !== 'string') throw new Error("Invalid file path");
  var asset = AV.Asset.fromURL(_filePath);
  asset.get('format', (function(format) {
    // console.log("AV.Asset.format.sampleRate:", format.sampleRate);
    this.getOfflineAudioContext(format.sampleRate).decodeAudioData(_response, (function(buffer) {
      _callback(buffer, _callbackArgument);
      _lst[_index] = null;
      for (var j = 0; j < _lst.length; ++j) {
        if(_lst[j] != null) {
          return;
        }
      }
      _callbackSuccess();
    }).bind(this),
    (function(e){
      this.errorHandler.sendError("Loading audio file (original SR) failed: " + e);
      return;
    }).bind(this));
  }).bind(this));
};


AudioFileLoader.prototype.startLoading = function(_callbackSuccess) {
    this.callbackSuccess = _callbackSuccess;

    if (this.files.length === 0) {
      _callbackSuccess();
    }

    for (var i = 0; i < this.files.length; ++i) {

      if (this.audioCaches.has(this.files[i].url)) {
        // console.log("reusing cached audio data for " + this.files[i].url);
        this.getOfflineAudioContext(this.audioContext.sampleRate).decodeAudioData(this.audioCaches.get(this.files[i].url).slice(0), (function(buffer) {
          this.files[i].callback(buffer, this.files[i].callbackArgument);
          this.filesDone[i] = true;
          for (var j = 0; j < this.filesDone.length; ++j) {
            if (this.filesDone[j] !== true) return;
          }
          if (this.loadOrigSR !== true) {
            _callbackSuccess();
          } else {
            this.loadOrigSRAudio(
              this.files[i].url,
              this.files,
              i,
              this.audioCaches.get(this.files[i].url).slice(0),
              _callbackSuccess,
              this.files[i].callbackOrigSR,
              this.files[i].callbackArgumentOrigSR
            );
          }
        }).bind(this),
        (function(e){
          this.errorHandler.sendError("Loading audio file failed: " + e);
          return;
        }).bind(this));
        continue;
      }

      var req = new XMLHttpRequest();
      req.open("GET", this.files[i].url, true);
      req.responseType = "arraybuffer";
      req.onerror = (function (e) {
        this.errorHandler.sendError("Loading audio file failed: " + e);
        _callbackSuccess();
      }).bind(this);

      var param = {index: i, loader: this, request: req};
      req.onload = (function() {
        // Use offline audio context for decoding to avoid memory leaks in online audio context
        //    https://github.com/katspaugh/wavesurfer.js/issues/326
        // Use .slice(0) to get a copy of the buffer because decodeAudioData will detach it
        this.loader.addToCache(this.loader.files[this.index].url, this.request.response.slice(0));
        const response = (this.loader.loadOrigSR === true) ? this.request.response.slice(0) : this.request.response;
        this.loader.getOfflineAudioContext(this.loader.audioContext.sampleRate).decodeAudioData(response, (function(buffer) {
        // this.loader.audioContext.decodeAudioData(response, (function(buffer) {
          this.loader.files[this.index].callback(buffer, this.loader.files[this.index].callbackArgument);
          this.loader.filesDone[this.index] = true;
          for (var j = 0; j < this.loader.filesDone.length; ++j) {
            if (this.loader.filesDone[j] !== true) return;
          }
          if (this.loader.loadOrigSR !== true) {
            _callbackSuccess();
          } else {

            this.loader.loadOrigSRAudio(
              this.loader.files[this.index].url,
              this.loader.files,
              this.index,
              this.request.response,
              _callbackSuccess,
              this.loader.files[this.index].callbackOrigSR,
              this.loader.files[this.index].callbackArgumentOrigSR
            );
          }
        }).bind(this),
        (function(e){
          this.errorHandler.sendError("Loading audio file failed: " + e);
          return;
        }).bind(this));
      }).bind(param);
      req.send();
    }
};



/*
AudioFileLoader.prototype.startLoading = function(_callbackSuccess) {
    this.callbackSuccess = _callbackSuccess;
    if (this.files.length === 0) {
      _callbackSuccess();
      return;
    }

    var req = new XMLHttpRequest();
    req.open("GET", this.files[0].url, true);
    req.responseType = "arraybuffer";
    req.onerror = (function (e) {
      this.errorHandler.sendError("Loading audio file failed: " + e);
      _callbackSuccess();
    }).bind(this);

    req.onload = (function() {
      this.audioContext.decodeAudioData(req.response, (function(buffer) {
        this.files[0].callback(buffer, this.files[0].callbackArgument);
        this.files.splice(0,1);
        this.startLoading(this.callbackSuccess);
        }).bind(this),
      (function(e){
        this.errorHandler.sendError("Loading audio file failed: " + e);
        _callbackSuccess();
        return;
      }).bind(this));
    }).bind(this);


    req.send();
};*/


AudioFileLoader.prototype.loadAudioFiles = function(_urls, _callback, _callbackArgument, _callbackOrigSR, _callbackArgumentOrigSR, _callbackSuccess) {
  if (_urls.length === 0) {
    _callbackSuccess();
  }
  this.tmpFiles = _urls;
  this.tmpFilesDone = [];
  for (var i = 0; i < _urls.length; i++) this.tmpFilesDone[i] = false;

  for (var i = 0; i < _urls.length; ++i) {
    if (this.audioCaches.has(_urls[i])) {
      // console.log("reusing cached audio data for " + _urls[i]);
      this.getOfflineAudioContext(this.audioContext.sampleRate).decodeAudioData(this.audioCaches.get(_urls[i]).slice(0), (function(buffer) {
        _callback(buffer, _callbackArgument);
        this.loader.tmpFilesDone[this.index] = true;
        for (var j = 0; j < this.loader.tmpFilesDone.length; ++j) {
          if (this.loader.tmpFilesDone[j] !== true) return;
        }
        if (this.loader.loadOrigSR !== true) {
          _callbackSuccess();
        } else {
          this.loader.loadOrigSRAudio(
            this.loader.tmpFiles[this.index],
            this.loader.tmpFiles,
            this.index,
            this.loader.audioCaches.get(this.loader.tmpFiles[this.index]).slice(0),
            _callbackSuccess,
            _callbackOrigSR,
            _callbackArgumentOrigSR
          );
        }
      }).bind({index: i, loader: this}),
      (function(e){
        this.errorHandler.sendError("Loading audio file failed: " + e);
        return;
      }).bind(this));
      continue;
    }

    var req = new XMLHttpRequest();
    req.open("GET", _urls[i], true);
    req.responseType = "arraybuffer";
    req.onerror = (function (e) {
      this.errorHandler.sendError("Loading audio file failed: " + e);
      _callbackSuccess();
    }).bind(this);

    var param = {index: i, loader: this, request: req};
    req.onload = (function() {
      this.loader.addToCache(this.loader.tmpFiles[this.index], this.request.response.slice(0));
      const response = (this.loader.loadOrigSR === true) ? this.request.response.slice(0) : this.request.response;
      this.loader.getOfflineAudioContext(this.loader.audioContext.sampleRate).decodeAudioData(response, (function(buffer) {
        _callback(buffer, _callbackArgument);
        this.loader.tmpFilesDone[this.index] = true;
        for (var j = 0; j < this.loader.tmpFilesDone.length; ++j) {
          if (this.loader.tmpFilesDone[j] !== true) return;
        }
        if (this.loader.loadOrigSR !== true) {
          _callbackSuccess();
        } else {

          this.loader.loadOrigSRAudio(
            this.loader.tmpFiles[this.index],
            this.loader.tmpFiles,
            this.index,
            this.request.response,
            _callbackSuccess,
            _callbackOrigSR,
            _callbackArgumentOrigSR
          );
        }
      }).bind(this),
      (function(e){
        this.errorHandler.sendError("Loading audio file failed: " + e);
        return;
      }).bind(this));
    }).bind(param);
    req.send();
  }
};
