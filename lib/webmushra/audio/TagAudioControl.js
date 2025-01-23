function TagAudioControl(_audioContext, _bufferSize, _stimulus, _errorHandler, _normalizeVolume, _autoLooping) {
  this.audioContext = _audioContext;
  this.bufferSize = parseInt(_bufferSize);
  this.stimulus = _stimulus;
  this.errorHandler = _errorHandler;
  this.lowAnchor = null;
  this.midAnchor = null;

  this.audioPlaying = false;
  this.audioCurrentPosition = 0;
  this.audioSampleRate = null;
  this.audioLoopStart = 0;
  this.audioLoopEnd = null;
  this.audioMaxPosition = null;
  this.audioStimulus = null;
  this.audioLoopingActive = _autoLooping || false;

  this.audioFadingActive = 0; // 0 = no, 1 = fade_out, 2 = fade_in
  this.audioFadingIn = null;
  this.audioFadingCurrentPosition = 0;
  this.audioFadingMaxPosition = parseInt(audioContext.sampleRate * 0.005);
  this.audioMinimumLoopDuration = parseInt(audioContext.sampleRate * 0.5);
  this.audioVolume = 1.0;
  if (_normalizeVolume != null && typeof _normalizeVolume !== "number") {
    _normalizeVolume = null;
  }
  this.normalizeVolume = _normalizeVolume;  // whether to automatically rescale the entire audio's max abs value to the specified value

  // requests
  this.audioCurrentPositionRequest = null;
  this.audioFadingActiveRequest = null;

  // listeners
  this.eventListeners = [];

  this.audioLoopEnd = this.stimulus.getAudioBuffer().length;
  this.audioMaxPosition = this.audioLoopEnd;
  this.audioSampleRate = this.stimulus.getAudioBuffer().sampleRate;

  this.dummyBufferSource = null; // nothing to do
  this.scriptNode = null;
}

TagAudioControl.prototype.updateAudio = function(_stimulus) {
  this.stimulus = _stimulus;
  this.audioLoopEnd = this.stimulus.getAudioBuffer().length;
  this.audioMaxPosition = this.audioLoopEnd;
  this.audioSampleRate = this.stimulus.getAudioBuffer().sampleRate;

  this.freeAudio();
  this.initAudio();
};

TagAudioControl.prototype.removeEventListener = function(_index) {
  this.eventListeners[_index] = null;
};


TagAudioControl.prototype.addEventListener = function(_listenerFunction) {
  this.eventListeners[this.eventListeners.length] = _listenerFunction;
  return this.eventListeners.length-1;
};

TagAudioControl.prototype.sendEvent = function(_event) {
  for (var i = 0; i < this.eventListeners.length; ++i) {
  	if (this.eventListeners[i] === null) {
  		continue;
  	}
    this.eventListeners[i](_event);
  }
};

TagAudioControl.prototype.getPosition = function() {
  return this.audioCurrentPosition;
};

TagAudioControl.prototype.getDuration = function() {
  return this.audioMaxPosition;
};

function getMax(arr) {
  return arr.reduce((max, v) => max >= v ? max : v, -Infinity);
}

TagAudioControl.prototype.initAudio = function() {
  this.dummyBufferSource = this.audioContext.createBufferSource(); // nothing to do
  this.dummyBufferSource.loop = true;
  this.dummyBufferSource.buffer = this.audioContext.createBuffer(1, this.bufferSize, this.audioContext.sampleRate);

  const audioBuffer = this.stimulus.getAudioBuffer();
  if (this.normalizeVolume != null) {
    var maxAbsVolume;
    for (channel = 0; channel < audioBuffer.numberOfChannels; ++channel) {
      outputData = audioBuffer.getChannelData(channel);
      maxAbsVolume = getMax(outputData.map(Math.abs));
      for (sample = 0; sample < audioBuffer.length; ++sample) {
        outputData[sample] = outputData[sample] / maxAbsVolume * this.normalizeVolume;
      }
    }
  }

  var channelCount = (audioBuffer.numberOfChannels > 2) ?  this.audioContext.destination.channelCount : audioBuffer.numberOfChannels;
  channelCount = Math.max(channelCount, this.audioContext.destination.channelCount);
  this.scriptNode = this.audioContext.createScriptProcessor(this.bufferSize, 1, channelCount);
  this.scriptNode.onaudioprocess = (function(audioProcessingEvent) { this.process(audioProcessingEvent); }).bind(this);

  this.dummyBufferSource.connect(this.scriptNode);
  this.scriptNode.connect(this.audioContext.destination);
  this.dummyBufferSource.start();
};

TagAudioControl.prototype.freeAudio = function() {
  this.stop();

  if (this.dummyBufferSource !== null) {
    this.dummyBufferSource.disconnect(); // TODO mschoeff hard stop
  }
  if (this.scriptNode !== null) {
    this.scriptNode.disconnect();
  }

  this.scriptNode.onaudioprocess = null;
  this.dummyBufferSource = null; // nothing to do
  this.scriptNode = null;
};

TagAudioControl.prototype.setLoopingActive = function(_loopingActive) {
  this.audioLoopingActive = _loopingActive;
};

TagAudioControl.prototype.isLoopingActive = function() {
  return this.audioLoopingActive;
};


TagAudioControl.prototype.process = function(audioProcessingEvent) {

  var outputBuffer = audioProcessingEvent.outputBuffer;
  // var inputBuffer = audioProcessingEvent.inputBuffer;

  var stimulus = this.audioStimulus;
  var sample;
  var ramp;
  var outputData;
  var channel;

  if (stimulus === null || this.audioPlaying === false) {
    // set to zero
    for (channel = 0; channel < outputBuffer.numberOfChannels; ++channel) {
      outputData = outputBuffer.getChannelData(channel);
      for (sample = 0; sample < outputBuffer.length; ++sample) {
        outputData[sample] = 0;
      }
    }
    return;
  }

  var audioBuffer = stimulus.getAudioBuffer();

  if (this.audioCurrentPosition < this.audioLoopStart) {
    this.audioCurrentPosition = this.audioLoopStart;
  }


  if (this.audioCurrentPositionRequest !== null) {
    this.audioCurrentPosition = this.audioCurrentPositionRequest;
    this.audioCurrentPositionRequest = null;
  }
  if (this.audioFadingActiveRequest !== null) {
    this.audioFadingActive = this.audioFadingActiveRequest;
    this.audioFadingActiveRequest = null;
  }
  var currentPosition = null;
  var fadingCurrentPosition = null;
  var fadingActive = null;
  var loopingActive = this.audioLoopingActive;

  for (channel = 0; channel < outputBuffer.numberOfChannels; ++channel) {
    outputData = outputBuffer.getChannelData(channel);
    // convert mono channel input to stereo channel output if necessary
    inputData = audioBuffer.getChannelData(Math.min(channel, audioBuffer.numberOfChannels - 1));
    currentPosition = this.audioCurrentPosition;
    fadingCurrentPosition = this.audioFadingCurrentPosition;
    fadingActive = this.audioFadingActive;

    for (sample = 0; sample < outputBuffer.length; ++sample) {

      if (loopingActive && (currentPosition == (this.audioLoopEnd - this.audioFadingMaxPosition))) { // loop almost at end => fading is triggered
        fadingActive = 1;
        this.audioFadingIn = this.audioStimulus;
        fadingCurrentPosition = 0;
      }

      if (fadingActive == 1) { // fade out
        ramp = 0.5 * (1 + Math.cos(Math.PI*(fadingCurrentPosition++)/(this.audioFadingMaxPosition-1)));
        outputData[sample] = inputData[currentPosition++] * ramp;
        if (fadingCurrentPosition >= this.audioFadingMaxPosition) {
          fadingActive = 2;
          fadingCurrentPosition = 0;
          if (this.audioFadingIn === null) {
            this.audioPlaying = false;
            fadingCurrentPosition = 0;
            fadingActive = 0;
            for (; sample < outputBuffer.length; ++sample) {
              outputData[sample] = 0;
            }
            break;
          } else {
            stimulus = this.audioStimulus = this.audioFadingIn;
            inputData = stimulus.getAudioBuffer().getChannelData(Math.min(channel, audioBuffer.numberOfChannels - 1));
          }

        }
      } else if (fadingActive == 2) { // fade in
        ramp = 0.5 * (1 - Math.cos(Math.PI*(fadingCurrentPosition++)/(this.audioFadingMaxPosition-1)));
        outputData[sample] = inputData[currentPosition++] * ramp;
        if (fadingCurrentPosition >= this.audioFadingMaxPosition) {
          fadingCurrentPosition = 0;
          fadingActive = 0;
        }
      } else {
        outputData[sample] = inputData[currentPosition++];
      }
      if (currentPosition >= this.audioLoopEnd) {
        currentPosition = this.audioLoopStart;
        if (loopingActive === false) {
          this.audioPlaying = false;
          this.sendEvent({name: 'stopTriggered'});
          break;
        }
      }
    }
  }

  // volume
  for (channel = 0; channel < outputBuffer.numberOfChannels; ++channel) {
    outputData = outputBuffer.getChannelData(channel);
    for (sample = 0; sample < outputBuffer.length; ++sample) {
      outputData[sample] = outputData[sample] * this.audioContext.volume;
    }
  }


  // volume

  this.audioCurrentPosition = currentPosition;
  this.audioFadingCurrentPosition = fadingCurrentPosition;
  this.audioFadingActive = fadingActive;

  var event = {
  	name: 'processUpdate',
  	currentSample:  this.audioCurrentPosition,
  	sampleRate: this.audioSampleRate
  };
  this.sendEvent(event);

};

TagAudioControl.prototype.setLoopStart = function(_start) {
  if (_start >= 0 && _start < this.audioLoopEnd && (this.audioLoopEnd-_start) >= this.audioMinimumLoopDuration) {
    this.audioLoopStart = _start;
    if (this.audioCurrentPosition < this.audioLoopStart) {
      this.audioCurrentPositionRequest = this.audioLoopStart;
    }
    var event = {
      name: 'loopStartChanged',
      start : this.audioLoopStart,
      end : this.audioLoopEnd
    };
    this.sendEvent(event);
  }
};

TagAudioControl.prototype.setLoopEnd = function(_end) {
  if (_end <= this.audioMaxPosition && _end > this.audioLoopStart && (_end-this.audioLoopStart) >= this.audioMinimumLoopDuration) {
    this.audioLoopEnd = _end;
    if (this.audioCurrentPosition > this.audioLoopEnd) {
      this.audioCurrentPositionRequest = this.audioLoopEnd;
    }
    var event = {
      name: 'loopEndChanged',
      start : this.audioLoopStart,
      end : this.audioLoopEnd
    };
    this.sendEvent(event);
  }
};

TagAudioControl.prototype.setLoop = function(_start, _end) {
  var changed = false;
  if (_start >= 0 && _start < this.audioLoopEnd && (_end-_start) >= this.audioMinimumLoopDuration
    && _start != this.audioLoopStart) {
    this.audioLoopStart = _start;
    if (this.audioCurrentPosition < this.audioLoopStart) {
      this.audioCurrentPositionRequest = this.audioLoopStart;
    }
    changed = true;
  }
  if (_end <= this.audioMaxPosition && _end > this.audioLoopStart && (_end-_start) >= this.audioMinimumLoopDuration
    && _end != this.audioLoopEnd) {
    this.audioLoopEnd = _end;
    if (this.audioCurrentPosition > this.audioLoopEnd) {
      this.audioCurrentPositionRequest = this.audioLoopEnd;
    }
    changed = true;
  }

  if (changed == true) {
    var event = {
      name: 'loopChanged',
      start : this.audioLoopStart,
      end : this.audioLoopEnd
    };
    this.sendEvent(event);
  }
};


TagAudioControl.prototype.setPosition = function(_position, _setStartEnd) {
  this.audioCurrentPositionRequest = _position;
  if(_setStartEnd){
	  if (_position < this.audioLoopStart || _position <= parseInt((this.audioLoopEnd + this.audioLoopStart)/2)) {
	    this.setLoopStart(_position);
	  }else if (_position > this.audioLoopEnd || _position > parseInt((this.audioLoopEnd + this.audioLoopStart)/2)) {
	    this.setLoopEnd(_position);
	  }
  }
  var eventUpdate = {
    name: 'processUpdate',
    currentSample:  this.audioCurrentPositionRequest,
    sampleRate: this.audioSampleRate
  };
  this.sendEvent(eventUpdate);
};

TagAudioControl.prototype.getNumSamples = function() {
  return this.audioMaxPosition;
};



TagAudioControl.prototype.play = function(_stimulus) {
  if (_stimulus === null) {
    _stimulus = this.audioStimulus;
  }

  if (this.audioStimulus !== _stimulus && this.audioStimulus !== null && this.audioPlaying !== false) {
    this.fadeOut(_stimulus);
  } else {
    this.audioStimulus = _stimulus;
    if (this.audioPlaying === false) {
      this.fadeIn(_stimulus);
    }
  }
  this.audioPlaying = true;
};

TagAudioControl.prototype.getActiveStimulus = function() {
  return this.audioStimulus;
};

TagAudioControl.prototype.playAudio = function() {
  this.play(this.stimulus);

  var event = {
  	name: 'playAudioTriggered'
  };
  this.sendEvent(event);

  return;
};


TagAudioControl.prototype.fadeOut = function(_stimulusFadeIn) {
  this.audioFadingIn = _stimulusFadeIn;
  this.audioFadingCurrentPositionRequest = 0;
  this.audioFadingActiveRequest = 1;
};

TagAudioControl.prototype.fadeIn = function(_stimulusFadeIn) {
  this.audioFadingIn = _stimulusFadeIn;
  this.audioFadingCurrentPositionRequest = 0;
  this.audioFadingActiveRequest = 2;
};



TagAudioControl.prototype.pause = function() {
  if (this.audioPlaying === true) {
    this.fadeOut(null);
  }
  var event = {
    name: 'pauseTriggered'
  };
  this.sendEvent(event);
  return;
};


TagAudioControl.prototype.stop = function() {
  this.audioCurrentPositionRequest = this.audioLoopStart;
  if (this.audioPlaying === true) {
    this.fadeOut(null);
  }
  var event = {
    name: 'stopTriggered',
  };
  this.sendEvent(event);

  var eventUpdate = {
    name: 'processUpdate',
    currentSample:  this.audioCurrentPositionRequest,
    sampleRate: this.audioSampleRate
  };
  this.sendEvent(eventUpdate);

  return;
};


TagAudioControl.prototype.getStimulus = function() {
  return this.stimulus;
};

