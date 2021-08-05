/*************************************************************************
         (C) Copyright AudioLabs 2017 

This source code is protected by copyright law and international treaties. This source code is made available to You subject to the terms and conditions of the Software License for the webMUSHRA.js Software. Said terms and conditions have been made available to You prior to Your download of this source code. By downloading this source code You agree to be bound by the above mentionend terms and conditions, which can also be found here: https://www.audiolabs-erlangen.de/resources/webMUSHRA. Any unauthorised use of this source code may result in severe civil and criminal penalties, and will be prosecuted to the maximum extent possible under law. 

**************************************************************************/

function MultiMetricMushraAudioControl(_audioContext, _bufferSize, _reference, _conditions, _errorHandler, _createAnchor35, _createAnchor70, _randomize) {
  this.audioContext = _audioContext;
  this.bufferSize = parseInt(_bufferSize);
  this.reference = _reference;
  this.conditions = _conditions;    
  this.errorHandler = _errorHandler;
  this.createAnchor35 = _createAnchor35;
  this.createAnchor70 = _createAnchor70;
  this.lowAnchor = null;
  this.midAnchor = null;
  
  this.audioPlaying = false;
  this.audioCurrentPosition = 0;
  this.audioSampleRate = null;
  this.audioLoopStart = 0;
  this.audioLoopEnd = null;  
  this.audioMaxPosition = null;
  this.audioStimulus = null;
  this.audioLoopingActive = true;   
  
  this.audioFadingActive = 0; // 0 = no, 1 = fade_out, 2 = fade_in
  this.audioFadingIn = null;
  this.audioFadingCurrentPosition = 0;
  this.audioFadingMaxPosition = parseInt(audioContext.sampleRate * 0.005);    
  this.audioMinimumLoopDuration = parseInt(audioContext.sampleRate * 0.5);    
  this.audioVolume = 1.0;
  this.audioIsReferencePlaying = null;
  
  // requests
  this.audioCurrentPositionRequest = null; 
  this.audioFadingActiveRequest = null;
  
  //listeners
  this.eventListeners = [];

  /*
  this.conditions[this.conditions.length] = this.reference;  
  
  // add anchors
  if (this.createAnchor35) {
    this.conditions[this.conditions.length] = this.createLowerAnchor35(this.reference.getAudioBuffer());
  }
  if (this.createAnchor70) {
    this.conditions[this.conditions.length] = this.createLowerAnchor70(this.reference.getAudioBuffer());
  }
  */

  if (_randomize !== false) { // default is true
    shuffle(this.conditions);
  }
  var conditionsMinLength = Math.min.apply(null, this.conditions.map(function(item) { return item.getAudioBuffer().length; }));
  var safeAudioLength = Math.min(conditionsMinLength, this.reference.getAudioBuffer().length);

  this.audioLoopEnd = safeAudioLength;
  this.audioMaxPosition = safeAudioLength;
  this.audioSampleRate = this.reference.getAudioBuffer().sampleRate;
}


MultiMetricMushraAudioControl.prototype.removeEventListener = function(_index) {
  this.eventListeners[_index] = null;  
};


MultiMetricMushraAudioControl.prototype.addEventListener = function(_listenerFunction) {
  this.eventListeners[this.eventListeners.length] = _listenerFunction;
  return this.eventListeners.length-1;
};

MultiMetricMushraAudioControl.prototype.sendEvent = function(_event) {
  for (var i = 0; i < this.eventListeners.length; ++i) {
  	if (this.eventListeners[i] === null) {
  		continue;
  	}
    this.eventListeners[i](_event);
  }
};

MultiMetricMushraAudioControl.prototype.getPosition = function() {
  return this.audioCurrentPosition;
};

MultiMetricMushraAudioControl.prototype.getDuration = function() {
  return this.audioMaxPosition;
};

MultiMetricMushraAudioControl.prototype.initAudio = function() {
  this.dummyBufferSource = this.audioContext.createBufferSource(); // nothing to do
  this.dummyBufferSource.loop = true;
  this.dummyBufferSource.buffer = this.audioContext.createBuffer(1, this.bufferSize, this.audioContext.sampleRate);

  var channelCount = (this.reference.getAudioBuffer().numberOfChannels > 2) ?  this.audioContext.destination.channelCount : this.reference.getAudioBuffer().numberOfChannels;   
  this.scriptNode = this.audioContext.createScriptProcessor(this.bufferSize, 1, channelCount);
  this.scriptNode.onaudioprocess = (function(audioProcessingEvent) { this.process(audioProcessingEvent); }).bind(this);
  
  this.dummyBufferSource.connect(this.scriptNode);
  this.scriptNode.connect(this.audioContext.destination);
  this.dummyBufferSource.start();
};

MultiMetricMushraAudioControl.prototype.freeAudio = function() {
  this.stop();

  this.dummyBufferSource.disconnect(); // TODO mschoeff hard stop
  this.scriptNode.disconnect();

  this.scriptNode.onaudioprocess = null;
  this.dummyBufferSource = null; // nothing to do
  this.scriptNode = null;
};

MultiMetricMushraAudioControl.prototype.setLoopingActive = function(_loopingActive) {
  this.audioLoopingActive = _loopingActive;
};

MultiMetricMushraAudioControl.prototype.isLoopingActive = function() {
  return this.audioLoopingActive;
};


MultiMetricMushraAudioControl.prototype.process = function(audioProcessingEvent) {

  var outputBuffer = audioProcessingEvent.outputBuffer;
  var inputBuffer = audioProcessingEvent.inputBuffer;
  
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
  
  for (channel = 0; channel < this.reference.getAudioBuffer().numberOfChannels; ++channel) {
    outputData = outputBuffer.getChannelData(channel);
    inputData = audioBuffer.getChannelData(channel);
    currentPosition = this.audioCurrentPosition; 
    fadingCurrentPosition = this.audioFadingCurrentPosition;      
    fadingActive = this.audioFadingActive;
    
    var a =[];
    var b = [];
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
            inputData = stimulus.getAudioBuffer().getChannelData(channel);
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

MultiMetricMushraAudioControl.prototype.setLoopStart = function(_start) {
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

MultiMetricMushraAudioControl.prototype.setLoopEnd = function(_end) {
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

MultiMetricMushraAudioControl.prototype.setLoop = function(_start, _end) {
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


MultiMetricMushraAudioControl.prototype.setPosition = function(_position, _setStartEnd) {
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

MultiMetricMushraAudioControl.prototype.getNumSamples = function() {
  return this.audioMaxPosition;
};



MultiMetricMushraAudioControl.prototype.play = function(_stimulus, _isReference) {
  if (_stimulus === null) {
    _stimulus = this.audioStimulus;
  }

  if ((this.audioStimulus !== _stimulus || _isReference !== this.audioIsReferencePlaying) 	&& this.audioStimulus !== null && this.audioPlaying !== false) {
    this.fadeOut(_stimulus);
  } else {
    this.audioStimulus = _stimulus;
    if (this.audioPlaying === false) {      
      this.fadeIn(_stimulus);
    }          
  }    
  this.audioPlaying = true;  
};

MultiMetricMushraAudioControl.prototype.getActiveStimulus = function() {
  return this.audioStimulus;
};

MultiMetricMushraAudioControl.prototype.playReference = function() {
  this.play(this.reference, true);
  this.audioIsReferencePlaying = true;

  
  var event = {
  	name: 'playReferenceTriggered',
  	conditionLength : this.conditions.length
  };  
  this.sendEvent(event);

  return;
};

MultiMetricMushraAudioControl.prototype.playCondition = function(_index) {
  this.play(this.conditions[_index], false);  
  this.audioIsReferencePlaying = false;
  var event = {
  	name: 'playConditionTriggered',
  	index : _index,
  	length : this.conditions.length
  };  
  this.sendEvent(event);

  return;
};


MultiMetricMushraAudioControl.prototype.fadeOut = function(_stimulusFadeIn) {
  this.audioFadingIn = _stimulusFadeIn;
  this.audioFadingCurrentPositionRequest = 0;
  this.audioFadingActiveRequest = 1;
};

MultiMetricMushraAudioControl.prototype.fadeIn = function(_stimulusFadeIn) {
  this.audioFadingIn = _stimulusFadeIn;
  this.audioFadingCurrentPositionRequest = 0;
  this.audioFadingActiveRequest = 2;
};



MultiMetricMushraAudioControl.prototype.pause = function() {
  if (this.audioPlaying === true) {
    this.fadeOut(null);
  }
  var event = {
    name: 'pauseTriggered',
    conditionLength : this.conditions.length
  };  
  this.sendEvent(event);
  return;
};


MultiMetricMushraAudioControl.prototype.stop = function() {
  this.audioCurrentPositionRequest = this.audioLoopStart;
  if (this.audioPlaying === true) {
    this.fadeOut(null);
  }
  var event = {
    name: 'stopTriggered',
    conditionLength : this.conditions.length
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


MultiMetricMushraAudioControl.prototype.getConditions = function() {
  return this.conditions;
};

MultiMetricMushraAudioControl.prototype.getReferenceIndexOfConditions = function() {
  for (var i = 0; i < this.conditions.length; ++i) {
    if (this.conditions[i] === this.reference) {
      return i;
    }
    return null;
  }
};

