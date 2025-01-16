// Reference: https://github.com/sukumo28/vscode-audio-preview/tree/main/src/webview/components
function WaveformSpecVisualizer(_variableName, _parent, _stimulus, _showWaveform, _showSpectrogram, _showCursor, _staticWaveform, _colors, _spectrogramOptions, _enableLooping, _mushraAudioControl) {
  this.variableName = _variableName;
  this.parent = _parent;
  this.showWaveform = _showWaveform || false;
  this.showCursor = _showCursor || false;
  this.staticWaveform = _staticWaveform || true;
  this.enableLooping = _enableLooping || false;
  this.mushraAudioControl = _mushraAudioControl;
  this.colors = {};
  for (var c in _colors) this.colors[c] = _colors[c];

  this.table = $('<table id="waveTable"></table>');
  this.slider = $('<div id="slider"></div');
  this.parentWavesurfer = $('<div id="parentWavesurfer"></div');
  this.playerCursor = document.createElement("div");
  this.playerCursor.className = "playerCursor";
  this.parentWavesurfer.append(this.playerCursor);
  this.userInputDiv = $('<div class="userInputDiv" id="userInputDiv" tabindex="0"></div>');
  this.parentWavesurfer.append(this.userInputDiv);
  this.selectionDiv = null;
  this.parentSlider = $('<div></div>');
  // For drawing the waveform
  this.canvas = document.createElement("canvas");
  this.canvas.className = "waveformSpecCanvas";
  this.context = this.canvas.getContext("2d");

  // For zooming in and out the spectrogram and waveform
  this.isZoomed = false;
  this.userInputSettings = {"isDragging": false, "isTimeAxisOnly": false, "isValueAxisOnly": false, "mouseDownX": 0, "mouseDownY": 0, "currentX": 0, "currentY": 0};
  this.drawSettings = {"minTime": null, "maxTime": null, "minAmplitude": null, "maxAmplitude": null, "minFrequency": null, "maxFrequency": null};

  this.spectrogramOptions = _spectrogramOptions;
  this.showSpectrogram = _showSpectrogram || false;
  if (this.showSpectrogram) {
    // For drawing the spectrogram
    this.canvasSpec = document.createElement("canvas");
    this.canvasSpec.className = "waveformSpecCanvas";
    this.contextSpec = this.canvasSpec.getContext("2d");
    this.parentSpectrogram = $('<div id="parentSpectrogram"></div');
    this.specPlayerCursor = document.createElement("div");
    this.specPlayerCursor.className = "playerCursor";
    this.parentSpectrogram.append(this.specPlayerCursor);
    this.specUserInputDiv = $('<div class="userInputDiv" id="specUserInputDiv" tabindex="0"></div>');
    this.parentSpectrogram.append(this.specUserInputDiv);
    this.specSelectionDiv = null;
    this.specUserInputSettings = {"isDragging": false, "isTimeAxisOnly": false, "isValueAxisOnly": false, "mouseDownX": 0, "mouseDownY": 0, "currentX": 0, "currentY": 0};
  }

  if (this.enableLooping) {
    this.parent.append(this.table);
  } else {

    this.parent.append(this.parentWavesurfer);
    if (this.showSpectrogram) {
      this.parent.append(this.parentSpectrogram);
    }
  }

  this.stimulus = _stimulus;
  var audioBuffer = _stimulus.getAudioBuffer();
  var numberOfChannels = audioBuffer.numberOfChannels;
  this.avgOriginalSamples = new Float32Array(audioBuffer.length);

  for (var i = 0; i < audioBuffer.length; ++i) {
    var sum = 0;
    for (var j = 0; j < numberOfChannels; j++) {
      sum += audioBuffer.getChannelData(j)[i];
    }
    var avg = sum * (1.0/numberOfChannels);
    this.avgOriginalSamples[i] = avg;
  }

  this.resampledSamples = [];

  // Load audioBuffer of original sampling rate if available
  if (this.showSpectrogram) {
    var audioBufferOrigSR = _stimulus.getOrigAudioBuffer();
    if (audioBufferOrigSR !== null) {
      this.avgOriginalSamplesOrigSR = new Float32Array(audioBufferOrigSR.length);
      for (var i = 0; i < audioBufferOrigSR.length; ++i) {
        var sum = 0;
        for (var j = 0; j < audioBufferOrigSR.numberOfChannels; j++) {
          sum += audioBufferOrigSR.getChannelData(j)[i];
        }
        var avg = sum * (1.0/audioBufferOrigSR.numberOfChannels);
        this.avgOriginalSamplesOrigSR[i] = avg;
      }

    } else {
      this.avgOriginalSamplesOrigSR = this.avgOriginalSamples;
    }
  } else {
    this.avgOriginalSamplesOrigSR = this.avgOriginalSamples;
  }

  this.currentPosition = 0; // samples
  this.leftRegionPosition = 0; // samples
  this.rightRegionPosition = this.canvas.width; // samples

  this.numberEventListener = this.mushraAudioControl.addEventListener((function (_event) {
    if (_event.name == 'processUpdate') {
      this.setCurrentPosition(_event.currentSample);
    }

    if (this.enableLooping) {

      if (_event.name == "loopStartChanged" || _event.name == "loopChanged") {
        var startSamples = _event.start;
        if (parseFloat(this.slider.get(0).noUiSlider.get()[0]) != _event.start) {
          this.slider.get(0).noUiSlider.set([startSamples, this.slider.get(0).noUiSlider.get()[1]]);
        }
        var startRegionSamples = this.leftRegionPosition;
        this.setLeftRegionPosition(startSamples);
        if (startRegionSamples != this.leftRegionPosition) {
          this.refresh();
          if (this.showCursor === true) this.updatePlayerCursor(this.leftRegionPosition);
        }
      }

      if (_event.name == "loopEndChanged" || _event.name == "loopChanged") {
        var endSamples = _event.end;
        if (parseFloat(this.slider.get(0).noUiSlider.get()[1]) != _event.end) {
          this.slider.get(0).noUiSlider.set([this.slider.get(0).noUiSlider.get()[0], endSamples]);
        }


        var endRegionSamples = this.rightRegionPosition;
        this.setRightRegionPosition(endSamples);
        if (endRegionSamples != this.rightRegionPosition) {
          this.refresh();
          if (this.showCursor === true) this.updatePlayerCursor(this.rightRegionPosition);
        }
      }
    }
  }).bind(this));
};

WaveformSpecVisualizer.prototype.updateAudio = function(_stimulus) {
  // Used for switching between stimuli assuming that the visualizer is already initialized.
  if (_stimulus === this.stimulus) {
    return;
  }
  this.stimulus = _stimulus;
  var audioBuffer = _stimulus.getAudioBuffer();
  var numberOfChannels = audioBuffer.numberOfChannels;
  this.avgOriginalSamples = new Float32Array(audioBuffer.length);

  for (var i = 0; i < audioBuffer.length; ++i) {
    var sum = 0;
    for (var j = 0; j < numberOfChannels; j++) {
      sum += audioBuffer.getChannelData(j)[i];
    }
    var avg = sum * (1.0/numberOfChannels);
    this.avgOriginalSamples[i] = avg;
  }

  // Load audioBuffer of original sampling rate if available
  if (this.showSpectrogram) {
    var audioBufferOrigSR = _stimulus.getOrigAudioBuffer();
    if (audioBufferOrigSR !== null) {
      this.avgOriginalSamplesOrigSR = new Float32Array(audioBufferOrigSR.length);
      for (var i = 0; i < audioBufferOrigSR.length; ++i) {
        var sum = 0;
        for (var j = 0; j < audioBufferOrigSR.numberOfChannels; j++) {
          sum += audioBufferOrigSR.getChannelData(j)[i];
        }
        var avg = sum * (1.0/audioBufferOrigSR.numberOfChannels);
        this.avgOriginalSamplesOrigSR[i] = avg;
      }
    } else {
      this.avgOriginalSamplesOrigSR = this.avgOriginalSamples;
    }
  }

  if (this.enableLooping) {
    this.slider.get(0).noUiSlider.updateOptions({
      range: {
        'min': 0,
        'max': this.stimulus.audioBuffer.length
        },
        start: [0, this.stimulus.audioBuffer.length],
    });
  }

  this.currentPosition = 0; // samples
  this.leftRegionPosition = 0; // samples
  this.rightRegionPosition = this.canvas.width; // samples

  this.updateCanvas();
  this.resample();
  this.refresh();
};

WaveformSpecVisualizer.prototype.updateCanvas = function(_resetRange = true) {
  const sampleRate = (this.stimulus.getOrigAudioBuffer() == null ? this.stimulus.audioBuffer.sampleRate : this.stimulus.getOrigAudioBuffer().sampleRate);
  const width = (this.showSpectrogram === true) ? this.parentSpectrogram.width() : this.parentWavesurfer.width();
  [minAmplitude, maxAmplitude] = getMinAndMaxAmplitude(this.avgOriginalSamples);
  if (this.audioAnalyzer.updateSettings(sampleRate, this.avgOriginalSamplesOrigSR.length, minAmplitude, maxAmplitude, width) !== true) {
    throw new Error("Failed to update AudioAnalyzer settings");
  };
  if (this.audioAnalyzer.validateSettings() === false) {
    throw new Error("Invalid AudioAnalyzer settings: " + JSON.stringify(this.audioAnalyzer.settings));
  }
  if (_resetRange === true) {
    this.isZoomed = false;
    this.resetDrawTimeRange(); this.resetDrawFreqRange(); this.resetDrawAmpRange();
  }
  if (this.showSpectrogram === true) this.drawSpectrogram();
};

WaveformSpecVisualizer.prototype.resetDrawTimeRange = function() {
  // minTime and maxTime are used only for setting xlim when drawing the waveform/spectrogram.
  this.drawSettings.minTime = this.audioAnalyzer.settings.minTime;
  this.drawSettings.maxTime = this.audioAnalyzer.settings.maxTime;
};

WaveformSpecVisualizer.prototype.resetDrawFreqRange = function() {
  // minFrequency and maxFrequency are used only for setting ylim when drawing the spectrogram.
  this.drawSettings.minFrequency = this.audioAnalyzer.settings.minFrequency;
  this.drawSettings.maxFrequency = this.audioAnalyzer.settings.maxFrequency;
};

WaveformSpecVisualizer.prototype.resetDrawAmpRange = function() {
  // minAmplitude and maxAmplitude are used only for setting ylim when drawing the waveform.
  this.drawSettings.minAmplitude = this.audioAnalyzer.settings.minAmplitude;
  this.drawSettings.maxAmplitude = this.audioAnalyzer.settings.maxAmplitude;
};

WaveformSpecVisualizer.prototype.translateOrigToResampled = function(_i) {
  return Number.parseInt((this.canvas.width / this.stimulus.audioBuffer.length) * _i);
};

WaveformSpecVisualizer.prototype.resample = function(_resetRegion = true) {
  // subsample the audio data for fast waveform drawing
  const startIndex = Math.floor(this.drawSettings.minTime * this.stimulus.audioBuffer.sampleRate);
  const endIndex = Math.floor(this.drawSettings.maxTime * this.stimulus.audioBuffer.sampleRate);
  const wholeSamples = endIndex - startIndex;
  const step = Math.ceil(wholeSamples / 200000);
  const data = this.avgOriginalSamples.slice(startIndex, endIndex).filter((_, i) => i % step === 0);

  this.resampledSamples = [];
  if (this.showWaveform == false) {
    for (var i = 0; i < data.length; l++) this.resampledSamples[i] = 1.0;
  } else {
    for (let i = 0; i < data.length; i++) {
      this.resampledSamples[i] = (data[i] - this.drawSettings.minAmplitude) / (this.drawSettings.maxAmplitude - this.drawSettings.minAmplitude);
    }
  }
  if (_resetRegion === true) {
    this.currentPosition = 0; // samples
    this.leftRegionPosition = 0; // samples
    this.rightRegionPosition = this.canvas.width; // samples
  }
};

WaveformSpecVisualizer.prototype.applySelectedRange = function (mouseUpX, mouseUpY, mouseDownX, mouseDownY, rect, onWaveformCanvas, isValueAxisOnly, isTimeAxisOnly) {
  document.body.style.cursor = "default";
  const minX = Math.max(0, Math.min(mouseUpX, mouseDownX) - rect.left);
  const maxX = Math.min(rect.width, Math.max(mouseUpX, mouseDownX) - rect.left);
  const minY = Math.max(0, Math.min(mouseUpY, mouseDownY) - rect.top);
  const maxY = Math.min(rect.height, Math.max(mouseUpY, mouseDownY) - rect.top);
  if (minX === maxX || minY === maxY) return;

  this.isZoomed = true;
  const settings = this.drawSettings;

  if (!isValueAxisOnly) {
    const timeRange = settings.maxTime - settings.minTime;
    const minTime = (minX / rect.width) * timeRange + settings.minTime;
    const maxTime = (maxX / rect.width) * timeRange + settings.minTime;
    this.drawSettings.minTime = minTime;
    this.drawSettings.maxTime = maxTime;
    this.updatePlayerCursor();
  }

  // note: direction of y-axis is top to bottom
  if (!isTimeAxisOnly) {
    if (onWaveformCanvas === true) {
      // WaveformCanvas
      const amplitudeRange = settings.maxAmplitude - settings.minAmplitude;
      const minAmplitude = (1 - maxY / rect.height) * amplitudeRange + settings.minAmplitude;
      const maxAmplitude = (1 - minY / rect.height) * amplitudeRange + settings.minAmplitude;
      this.drawSettings.minAmplitude = minAmplitude;
      this.drawSettings.maxAmplitude = maxAmplitude;
    } else {
      // SpectrogramCanvas
      let minFrequency, maxFrequency, frequencyRange;
      switch (this.audioAnalyzer.settings.freqScale) {
        case "linear":
          frequencyRange = settings.maxFrequency - settings.minFrequency;
          minFrequency = (1 - maxY / rect.height) * frequencyRange + settings.minFrequency;
          maxFrequency = (1 - minY / rect.height) * frequencyRange + settings.minFrequency;
          break;
        case "log":
          frequencyRange = Math.log10(settings.maxFrequency) - Math.log10(settings.minFrequency);
          minFrequency = Math.pow(10, (1 - maxY / rect.height) * frequencyRange) + settings.minFrequency;
          maxFrequency = Math.pow(10, (1 - minY / rect.height) * frequencyRange) + settings.minFrequency;
          break;
        case "mel":
          frequencyRange = this.audioAnalyzer.hzToMel(settings.maxFrequency) - this.audioAnalyzer.hzToMel(settings.minFrequency);
          minFrequency = this.audioAnalyzer.melToHz((1 - maxY / rect.height) * frequencyRange) + settings.minFrequency;
          maxFrequency = this.audioAnalyzer.melToHz((1 - minY / rect.height) * frequencyRange) + settings.minFrequency;
          break;
      }
      this.drawSettings.minFrequency = minFrequency;
      this.drawSettings.maxFrequency = maxFrequency;
    }
  }

  this.resample(false);
  this.refresh();
  if (this.showSpectrogram) this.drawSpectrogram();
};

WaveformSpecVisualizer.prototype.renderSlider = function() {

  this.parentSlider.append(this.slider);
  $.mobile.activePage.trigger('create');

  noUiSlider.create(this.slider.get(0), {
    connect : true,
    range: {
      'min': 0,
      'max': this.stimulus.audioBuffer.length
    },
    start: [0, this.stimulus.audioBuffer.length],
    step: 1,
    margin: 25000
  });

  if (this.colors['sliderColor'] !== null) {
    this.slider.children().children('.noUi-connect').css('background-color', this.colors['sliderColor']);
  }

  this.slider.get(0).noUiSlider.on('update', (function(values, handle) {

    var startSliderSeconds = Math.floor(values[0]/this.stimulus.audioBuffer.sampleRate * 100) / 100;
    var endSliderSeconds = Math.floor(values[1]/this.stimulus.audioBuffer.sampleRate * 100) / 100;

    $('#lowerLim').val(startSliderSeconds.toFixed(2));
    $('#upperLim').val(endSliderSeconds.toFixed(2));

    var startSliderSamples = parseInt(values[0]);
    var endSliderSamples = parseInt(values[1]);
    this.mushraAudioControl.setLoop(startSliderSamples, endSliderSamples);

    if (endSliderSamples < this.currentPosition / this.canvas.width * this.stimulus.audioBuffer.length) {
      this.mushraAudioControl.setPosition(parseInt(this.rightRegionPosition));
      this.mushraAudioControl.stop();
    } else if (startSliderSamples > this.currentPosition / this.canvas.width * this.stimulus.audioBuffer.length) {
      this.mushraAudioControl.setPosition(parseInt(this.leftRegionPosition));
    }
  }).bind(this)
  );
};

WaveformSpecVisualizer.prototype.renderTable = function() {

  var tr1_ = $("<tr valign='bottom'></tr>");
  this.table.append(tr1_);
  var td11_ = $("<td id='sliderLim'></td>");
  var td12_ = $("<td></td>");
  var td13_ = $("<td id='sliderLim'></td>");
  tr1_.append(td11_);
  tr1_.append(td12_);
  tr1_.append(td13_);

  var tdLoop2 = $("<td width='100%'></td>"); // TODO mschoeff variable size
  if (this.showSpectrogram) {
    tdLoop2.append(this.parentSpectrogram);
  }
  tdLoop2.append(this.parentWavesurfer);
  tdLoop2.append(this.parentSlider);

  td12_.append(tdLoop2);
  tdLoop2.css("width",td12_.width().toString());
  var lowerLim = $("<div id='div_lower_limit'><input type=\"text\" name=\"name\" id=\"lowerLim\" class=\"limits\" data-inline=\"true\" data-mini=\"true\"disabled=\"disabled\"></input></div>");
  var upperLim = $("<div id='div_upper_limit'><input type=\"text\" name=\"name\" id=\"upperLim\" class=\"limits\" data-inline=\"true\" data-mini=\"true\"disabled=\"disabled\"></input></div>");
  td11_.append(lowerLim);
  td13_.append(upperLim);
};

WaveformSpecVisualizer.prototype.create = function() {

  if (this.enableLooping) {
    this.renderTable();
    this.renderSlider();
  }
  const sampleRate = (this.stimulus.getOrigAudioBuffer() == null ? this.stimulus.audioBuffer.sampleRate : this.stimulus.getOrigAudioBuffer().sampleRate);
  [minAmplitude, maxAmplitude] = getMinAndMaxAmplitude(this.avgOriginalSamples);
  this.audioAnalyzer = new AudioAnalyzer(this.spectrogramOptions, this.avgOriginalSamplesOrigSR.length, minAmplitude, maxAmplitude, sampleRate, this.parentWavesurfer.width());
  this.resetDrawTimeRange(); this.resetDrawFreqRange(); this.resetDrawAmpRange();

  this.canvas.style.left = this.parent.get(0).style.left;
  this.canvas.style.top = this.parent.get(0).style.top;
  this.canvas.style.position = "relative";
  this.canvas.style.zIndex = 0;
  this.canvas.setAttribute("id","canvas");
  this.parentWavesurfer.append(this.canvas);
  this.canvas.height = this.parentWavesurfer.height();
  this.canvas.width = this.parentWavesurfer.width();
  this.parentWavesurfer.children(".playerCursor").css({"maxHeight": this.canvas.height});
  this.userInputDiv.css({"maxHeight": this.canvas.height});
  this.userInputDiv.css({"maxWidth": this.canvas.width});
  this.resample();

  if (this.showSpectrogram) {
    this.canvasSpec.style.left = this.parent.get(0).style.left;
    this.canvasSpec.style.top = this.parent.get(0).style.top;
    this.canvasSpec.style.position = "relative";
    this.canvasSpec.style.zIndex = 0;
    this.canvasSpec.setAttribute("id","canvasSpec");
    this.parentSpectrogram.append(this.canvasSpec);
    this.parentSpectrogram.height(this.parentWavesurfer.height() * 2);
    this.canvasSpec.height = this.parentSpectrogram.height();
    this.canvasSpec.width = this.parentSpectrogram.width();
    this.parentSpectrogram.children(".playerCursor").css({"maxHeight": this.canvasSpec.height});
    this.specUserInputDiv.css({"maxHeight": this.canvasSpec.height});
    this.specUserInputDiv.css({"maxWidth": this.canvasSpec.width});
  }

  this.regionStart = 0; // pixel
  this.regionWidth = this.canvas.offsetWidth; // pixel

  this.userInputDiv.on('contextmenu', function(event){event.preventDefault();});  // prevent right click menu
  this.userInputDiv.on('mousedown', ((e) => {
    this.onUserInputMousedown(e, true);
  }).bind(this));
  this.userInputDiv.on('mousemove', ((e) => {
    this.onUserInputMousemove(e, true);
  }).bind(this));
  this.userInputDiv.on('mouseup', ((e) => {
    this.onUserInputMouseup(e, true);
  }).bind(this));
  this.userInputDiv.on('mouseout', ((e) => {
    this.onUserInputMouseup(e, true);  // automatically apply selection when mouse moves outside the canvas
  }).bind(this));
  this.userInputDiv.on('keydown', ((e) => {
    this.onUserInputKeydown(e, true);
  }).bind(this));
  this.userInputDiv.on('keyup', ((e) => {
    this.onUserInputKeyup(e, true);
  }).bind(this));

  this.specUserInputDiv.on('contextmenu', function(event){event.preventDefault();});  // prevent right click menu
  this.specUserInputDiv.on('mousedown', ((e) => {
    this.onUserInputMousedown(e, false);
  }).bind(this));
  this.specUserInputDiv.on('mousemove', ((e) => {
    this.onUserInputMousemove(e, false);
  }).bind(this));
  this.specUserInputDiv.on('mouseup', ((e) => {
    this.onUserInputMouseup(e, false);
  }).bind(this));
  this.specUserInputDiv.on('mouseout', ((e) => {
    this.onUserInputMouseup(e, false);  // automatically apply selection when mouse moves outside the canvas
  }).bind(this));
  this.specUserInputDiv.on('keydown', ((e) => {
    this.onUserInputKeydown(e, false);
  }).bind(this));
  this.specUserInputDiv.on('keyup', ((e) => {
    this.onUserInputKeyup(e, false);
  }).bind(this));

  this.refresh();
  if (this.showSpectrogram) this.drawSpectrogram();
};

WaveformSpecVisualizer.prototype.onUserInputMousedown = function(event, onWaveformCanvas) {
  /*
  apply selected range if isDrugging is already true.
  this condition occurs if user start dragging, move the mouse outside the figure,
  release the mouse there, and then move the cursor over the figure again.
  */
  var _userInputSettings = (onWaveformCanvas === true) ? this.userInputSettings : this.specUserInputSettings;
  if (_userInputSettings.isDragging) {
    _userInputSettings.isDragging = false;
    if (onWaveformCanvas === true) {
      if (this.selectionDiv !== null) {
        this.selectionDiv.remove();
        this.selectionDiv = null;
      }
    } else {
      if (this.specSelectionDiv !== null) {
        this.specSelectionDiv.remove();
        this.specSelectionDiv = null;
      }
    }
    const rect = (onWaveformCanvas === true) ? this.userInputDiv.get(0).getBoundingClientRect() : this.specUserInputDiv.get(0).getBoundingClientRect();
    this.applySelectedRange(
      _userInputSettings.mouseDownX, _userInputSettings.mouseDownY, event.clientX, event.clientY, rect, onWaveformCanvas, _userInputSettings.isValueAxisOnly, _userInputSettings.isTimeAxisOnly
    );
    return true;
  }

  _userInputSettings.mouseDownX = event.clientX;
  _userInputSettings.mouseDownY = event.clientY;

  // left click
  if (event.button === 0) {
    document.body.style.cursor = "crosshair";
    _userInputSettings.isDragging = true;
    // create a new div for the selection
    if (onWaveformCanvas === true) {
      this.selectionDiv = document.createElement("div");
      this.selectionDiv.className = "userSelectionRect";
      this.parentWavesurfer.append(this.selectionDiv);
    } else {
      this.specSelectionDiv = document.createElement("div");
      this.specSelectionDiv.className = "userSelectionRect";
      this.parentSpectrogram.append(this.specSelectionDiv);
    }
    return true;
  }

  // right click
  if (event.button === 2) {
    // reset the range to the default range
    document.body.style.cursor = "default";
    if (this.isZoomed === false) return true;  // no need to redraw
    this.isZoomed = false;
    if (event.ctrlKey) {
      // reset time axis only
      this.resetDrawTimeRange();
    } else if (event.shiftKey) {
      // reset value axis only
      this.resetDrawAmpRange();
      this.resetDrawFreqRange();
    } else {
      // reset both axes
      this.resetDrawTimeRange();
      this.resetDrawAmpRange();
      this.resetDrawFreqRange();
    }
    this.resample(false);
    this.refresh();
    if (this.showCursor === true) this.updatePlayerCursor();
    if (this.showSpectrogram === true) this.drawSpectrogram();
  }
  return true;
};

WaveformSpecVisualizer.prototype.onUserInputMousemove = function(event, onWaveformCanvas) {
  var _userInputSettings = (onWaveformCanvas === true) ? this.userInputSettings : this.specUserInputSettings;
  var _selectionDiv = (onWaveformCanvas === true) ? this.selectionDiv : this.specSelectionDiv;
  var _userInputDiv = (onWaveformCanvas === true) ? this.userInputDiv : this.specUserInputDiv;
  if (!_userInputSettings.isDragging || !_selectionDiv) return true;
    _userInputSettings.currentX = event.clientX;
    _userInputSettings.currentY = event.clientY;
    this.drawSelectionDiv(_userInputDiv, _selectionDiv, _userInputSettings);
    return true;
};

WaveformSpecVisualizer.prototype.drawSelectionDiv = function(_userInputDiv, _selectionDiv, _settings) {
  const rect = _userInputDiv.get(0).getBoundingClientRect();

  // draw selection range
  // note: direction of y-axis is top to bottom
  if (_settings.isTimeAxisOnly) {
    // select time axis only
    _selectionDiv.style.left = Math.min(_settings.mouseDownX, _settings.currentX) - rect.left + "px";
    _selectionDiv.style.top = "0%";
    _selectionDiv.style.width = Math.abs(_settings.mouseDownX - _settings.currentX) + "px";
    _selectionDiv.style.height = parseInt(_userInputDiv.height()) - 2 * parseInt($(".userSelectionRect").css("border-left-width")) + "px";
  } else if (_settings.isValueAxisOnly) {
    // select value axis only
    _selectionDiv.style.left = "0%";
    _selectionDiv.style.top = Math.min(_settings.mouseDownY, _settings.currentY) - rect.top + "px";
    _selectionDiv.style.width = parseInt(_userInputDiv.width()) - 2 * parseInt($(".userSelectionRect").css("border-left-width")) + "px";
    _selectionDiv.style.height = Math.abs(_settings.mouseDownY - _settings.currentY) + "px";
  } else {
    // select both axes
    _selectionDiv.style.left = Math.min(_settings.mouseDownX, _settings.currentX) - rect.left + "px";
    _selectionDiv.style.top = Math.min(_settings.mouseDownY, _settings.currentY) - rect.top + "px";
    _selectionDiv.style.width = Math.abs(_settings.mouseDownX - _settings.currentX) - 2 * parseInt($(".userSelectionRect").css("border-left-width")) + "px";
    _selectionDiv.style.height = Math.abs(_settings.mouseDownY - _settings.currentY) - parseInt($(".userSelectionRect").css("border-left-width")) + "px";
  }
};


WaveformSpecVisualizer.prototype.onUserInputMouseup = function(event, onWaveformCanvas) {
  var _userInputSettings = (onWaveformCanvas === true) ? this.userInputSettings : this.specUserInputSettings;
  var _selectionDiv = (onWaveformCanvas === true) ? this.selectionDiv : this.specSelectionDiv;
  var _userInputDiv = (onWaveformCanvas === true) ? this.userInputDiv : this.specUserInputDiv;
  if (!_userInputSettings.isDragging || !_selectionDiv) return true;
  _userInputSettings.isDragging = false;
  document.body.style.cursor = "default";

  // Remove the selection div
  if (onWaveformCanvas === true) {
    if (this.selectionDiv) {
      this.selectionDiv.remove();
      this.selectionDiv = null;
    }
  } else {
    if (this.specSelectionDiv) {
      this.specSelectionDiv.remove();
      this.specSelectionDiv = null;
    }
  }

  // calculate the position of the mouse up event
  const rect = _userInputDiv.get(0).getBoundingClientRect();
  const mouseUpX = event.clientX;
  const mouseUpY = event.clientY;

  // treat as click if mouse moved less than threshold
  if (
    Math.abs(_userInputSettings.mouseDownX - mouseUpX) < 3 &&
    Math.abs(_userInputSettings.mouseDownY - mouseUpY) < 3
  ) {
    // start playing from the clicked position
    const xPercentInFigureRange = Math.min(1, ((mouseUpX - rect.left) / rect.width));
    const sec = xPercentInFigureRange * (this.drawSettings.maxTime - this.drawSettings.minTime) + this.drawSettings.minTime;
    this.mushraAudioControl.setPosition(parseInt(sec * this.stimulus.audioBuffer.sampleRate));
    this.mushraAudioControl.audioCurrentPosition = this.mushraAudioControl.audioCurrentPositionRequest;
    return true;
  }

  // treat as drag
  this.applySelectedRange(
    mouseUpX, mouseUpY, _userInputSettings.mouseDownX, _userInputSettings.mouseDownY, rect, onWaveformCanvas, _userInputSettings.isValueAxisOnly, _userInputSettings.isTimeAxisOnly
  );
  return true;
};

WaveformSpecVisualizer.prototype.onUserInputKeydown = function(event, onWaveformCanvas) {
  // When the control key or shift key is pressed, even if the mouse is not moving,
  // if the selectuionDiv already exists, update the selection range.
  // ignore if pressed keys are not ctrl or shift
  if (!event.ctrlKey && !event.shiftKey) return;

  var _userInputSettings = (onWaveformCanvas === true) ? this.userInputSettings : this.specUserInputSettings;
  var _selectionDiv = (onWaveformCanvas === true) ? this.selectionDiv : this.specSelectionDiv;
  var _userInputDiv = (onWaveformCanvas === true) ? this.userInputDiv : this.specUserInputDiv;
  if (!_userInputSettings.isDragging || !_selectionDiv) return true;
  if (event.ctrlKey) {
    _userInputSettings.isTimeAxisOnly = true;
    _userInputSettings.isValueAxisOnly = false;
  }
  if (event.shiftKey) {
    _userInputSettings.isTimeAxisOnly = false;
    _userInputSettings.isValueAxisOnly = true;
  }
  this.drawSelectionDiv(_userInputDiv, _selectionDiv, _userInputSettings);
  return true;
};

WaveformSpecVisualizer.prototype.onUserInputKeyup = function(event, onWaveformCanvas) {
  // When the control key or shift key is released, update flags about selection range.
  // ignore if released keys are not ctrl or shift or escape
  if (event.key !== "Shift" && event.key !== "Control" && event.key !== "Escape") return;

    if (event.key === "Escape") {
      document.body.style.cursor = "default";
      // Remove the selection div
      if (onWaveformCanvas === true) {
        this.userInputSettings.isDragging = false;
        if (this.selectionDiv) {
          this.selectionDiv.remove();
          this.selectionDiv = null;
        }
      } else {
        this.specUserInputSettings.isDragging = false;
        if (this.specSelectionDiv) {
          this.specSelectionDiv.remove();
          this.specSelectionDiv = null;
        }
      }
    }

  var _userInputSettings = (onWaveformCanvas === true) ? this.userInputSettings : this.specUserInputSettings;
  var _selectionDiv = (onWaveformCanvas === true) ? this.selectionDiv : this.specSelectionDiv;
  var _userInputDiv = (onWaveformCanvas === true) ? this.userInputDiv : this.specUserInputDiv;
  _userInputSettings.isTimeAxisOnly = false;
  _userInputSettings.isValueAxisOnly = false;

  if (!_userInputSettings.isDragging || !_selectionDiv) return true;
  this.drawSelectionDiv(_userInputDiv, _selectionDiv, _userInputSettings);
  return true;
};

WaveformSpecVisualizer.prototype.getPositionInFigureRange = function(_pos, _minTime, _maxTime) {
  const posSec = _pos / this.canvas.width * this.stimulus.audioBuffer.duration;
  return parseInt(
    this.canvas.width *
    this.audioAnalyzer.clampMinMax((posSec - _minTime) / (_maxTime - _minTime), 0, 1)
  );
};

WaveformSpecVisualizer.prototype.draw = function() {
  this.context.clearRect (0 , 0 , this.canvas.width, this.canvas.height);

  var leftRegionPosition = this.leftRegionPosition;
  var rightRegionPosition = this.rightRegionPosition;
  var currentPosition = this.currentPosition;
  if (this.drawSettings.minTime !== this.audioAnalyzer.settings.minTime || this.drawSettings.maxTime !== this.audioAnalyzer.settings.maxTime) {
    currentPosition = this.getPositionInFigureRange(currentPosition, this.drawSettings.minTime, this.drawSettings.maxTime);
    leftRegionPosition = this.getPositionInFigureRange(leftRegionPosition, this.drawSettings.minTime, this.drawSettings.maxTime);
    rightRegionPosition = this.getPositionInFigureRange(rightRegionPosition, this.drawSettings.minTime, this.drawSettings.maxTime);
  }
  this.context.fillStyle= 'rgba(0, 0, 0, 0.1)';
  this.context.fillRect(leftRegionPosition, -1 * this.canvas.height/2, (rightRegionPosition - leftRegionPosition), 2 * this.canvas.height);

  // Whether the user has manually adjusted the slider's left and right positions
  var selected = leftRegionPosition > 0 || rightRegionPosition < this.canvas.width;

  var state = 0;
  if (selected) {
    this.context.fillStyle = this.colors['unselectedColor'] || '#808080';
    this.context.strokeStyle = this.colors['unselectedColor'] || '#808080';
  } else if (currentPosition === 0) {
    if (this.staticWaveform !== true) {
      this.context.fillStyle = this.colors['notPlayedColor'] || '#F8DEBD';
      this.context.strokeStyle = this.colors['notPlayedColor'] || '#F8DEBD';
    } else {
      this.context.fillStyle = this.colors['playedColor'] || '#ED8C01';
      this.context.strokeStyle = this.colors['playedColor'] || '#ED8C01';
    }
    state = 1;
  }
  // Draw waveform
  this.context.beginPath();
  const dataLength = this.resampledSamples.length;
  for (let i = 0; i < dataLength; i++) {
    const x = (i / dataLength) * this.canvas.width;
    const y = this.canvas.height * (1 - this.resampledSamples[i]);

    if (state === 0 && x >= leftRegionPosition) {
      // state 1 before current position
      this.context.stroke();
      this.context.fillStyle = this.colors['playedColor'] || '#ED8C01';
      this.context.strokeStyle = this.colors['playedColor'] || '#ED8C01';
      state = 1;
    } else if (state === 1 && x > currentPosition) {
      // after current position
      this.context.stroke();
      if (this.staticWaveform !== true) {
        this.context.fillStyle = this.colors['notPlayedColor'] || '#F8DEBD';
        this.context.strokeStyle = this.colors['notPlayedColor'] || '#F8DEBD';
      } else {
        this.context.fillStyle = this.colors['playedColor'] || '#ED8C01';
        this.context.strokeStyle = this.colors['playedColor'] || '#ED8C01';
      }
      state = 2;
    } else if (state === 2 && x > rightRegionPosition) {
      this.context.stroke();
      this.context.fillStyle = this.colors['unselectedColor'] || '#808080';
      this.context.strokeStyle = this.colors['unselectedColor'] || '#808080';
      state = 3;
    }

    if (dataLength > this.canvas.width * this.audioAnalyzer.settings.minDataPointsPerPixel) {
      this.context.fillRect(x, y, 1, 1);  // only draw a single data point to avoid too dense plots
    } else {
      if (i === 0) {
        this.context.beginPath();
        this.context.moveTo(x, y);
      } else if (i === dataLength - 1) {
        this.context.lineTo(x, y);
        this.context.stroke();
      } else {
        this.context.lineTo(x, y);
      }
    }
  }

  // Draw the time axis (horizontal)
  const [niceT, digitT] = this.audioAnalyzer.roundToNearestNiceNumber(
    (this.drawSettings.maxTime - this.drawSettings.minTime) / 10,
  );
  const dx = this.canvas.width / (this.drawSettings.maxTime - this.drawSettings.minTime);
  const t0 = Math.ceil(this.drawSettings.minTime / niceT) * niceT;
  const numTAxis = Math.floor((this.drawSettings.maxTime - this.drawSettings.minTime) / niceT);
  for (let i = 0; i <= numTAxis; i++) {
    const t = t0 + niceT * i;
    const x = (t - this.drawSettings.minTime) * dx;

    this.context.fillStyle = "rgb(245,130,32)";
    if (this.canvas.width * (2 / 100) < x && x < this.canvas.width * (98 / 100)) {
      this.context.fillText(`${t.toFixed(digitT)}s`, x + 2, 12);
    } // don't draw near the edge

    this.context.fillStyle = "rgb(180,120,20)";
    for (let j = 0; j < this.canvas.height; j++) {
      this.context.fillRect(x, j, 1, 1);
    }
  }

  // Draw the amplitude axis (vertical)
  const [niceA, digitA] = this.audioAnalyzer.roundToNearestNiceNumber(
    (this.drawSettings.maxAmplitude - this.drawSettings.minAmplitude) /
      (10 * this.audioAnalyzer.settings.waveformVerticalScale),
  );
  const dy = this.canvas.height / (this.drawSettings.maxAmplitude - this.drawSettings.minAmplitude);
  const a0 = Math.ceil(this.drawSettings.minAmplitude / niceA) * niceA;
  const numAAxis = Math.floor(
    (this.drawSettings.maxAmplitude - this.drawSettings.minAmplitude) / niceA,
  );
  for (let i = 0; i <= numAAxis; i++) {
    const a = a0 + niceA * i;
    const y = this.canvas.height - (a - this.drawSettings.minAmplitude) * dy;

    this.context.fillStyle = "rgb(245,130,32)";
    if (12 < y && y < this.canvas.height) {
      this.context.fillText(`${a.toFixed(digitA)}`, 4, y - 2);
    } // don't draw near the edge

    this.context.fillStyle = "rgb(180,120,20)";
    if (12 < y && y < this.canvas.height) {
      // don't draw on the horizontal axis
      for (let j = 0; j < this.canvas.width; j++) {
        this.context.fillRect(j, y, 1, 1);
      }
    }
  }
};


// Reference: https://stackoverflow.com/a/44557266/29099325
WaveformSpecVisualizer.prototype.getAverageColorInRectangle = function(_imageData, _alphaWeighted = true) {
  const pixelsPerChannel = _imageData.length / 4;
  var R = 0, G = 0, B = 0, A = 0, wR = 0, wG = 0, wB = 0, wTotal = 0;
  for (let i = 0; i < _imageData.length; i += 4) {
    // A single pixel (R, G, B, A) will take 4 positions in the array:
    const r = _imageData[i], g = _imageData[i + 1], b = _imageData[i + 2], a = _imageData[i + 3];
    if (_alphaWeighted === true) {
      // Update components for alpha-weighted average:
      const w = a / 255;
      wR += r * w; wG += g * w; wB += b * w; wTotal += w;
    } else {
      // Update components for solid color and alpha averages:
      R += r; G += g; B += b; A += a;
    }
  }

  // The | operator is used here to perform an integer division:
  if (_alphaWeighted === true) {
    wR = wR / wTotal | 0;
    wG = wG / wTotal | 0;
    wB = wB / wTotal | 0;
    return [wR, wG, wB, 1]
  } else {
    R = R / pixelsPerChannel | 0;
    G = G / pixelsPerChannel | 0;
    B = B / pixelsPerChannel | 0;
    // The alpha channel need to be in the [0, 1] range:
    A = A / pixelsPerChannel / 255;
    return [R, G, B, A]
  }
};


WaveformSpecVisualizer.prototype.drawSpectrogram = function() {
  const sampleRate = (this.stimulus.getOrigAudioBuffer() == null ? this.stimulus.audioBuffer.sampleRate : this.stimulus.getOrigAudioBuffer().sampleRate);
  const cfg = this.drawSettings;
  this.spectrogram = this.audioAnalyzer.analyze(
    this.avgOriginalSamplesOrigSR, sampleRate, cfg.minTime, cfg.maxTime, cfg.minFrequency, cfg.maxFrequency, this.isZoomed
  );

  this.contextSpec.clearRect ( 0 , 0 , this.canvasSpec.width, this.canvasSpec.height );
  const origFont = this.contextSpec.font;

  var minFreq = this.drawSettings.minFrequency;
  const maxFreq = this.drawSettings.maxFrequency;
  const wholeSampleNum = (this.drawSettings.maxTime - this.drawSettings.minTime) * sampleRate;
  const rectWidth = (this.canvasSpec.width * this.audioAnalyzer.settings.hopSize) / wholeSampleNum;
  var rectHeight = this.canvasSpec.height / this.spectrogram[0].length;
  var df, logMin, logMax, scale;
  if (this.audioAnalyzer.settings.freqScale == 'log') {
    if (minFreq < 1) minFreq = 1;
    df = sampleRate / this.audioAnalyzer.settings.windowSize;
    // calculate the height of each frequency band in the logarithmic scale
    logMin = Math.log10(minFreq + Number.EPSILON);
    logMax = Math.log10(maxFreq + Number.EPSILON);
    scale = (logMax - logMin) / this.canvasSpec.height;
  }

  // for preventing canvas aliasing due to non-integer rectWidth and rectHeight
  var prevEndX = 0, prevStartY = this.canvasSpec.height;
  for (let i = 0; i < this.spectrogram.length; i++) {
    var x = i * rectWidth;
    if (prevEndX < Math.ceil(x)) {
      prevEndX = Math.round(x + rectWidth);
      x = Math.floor(x);
    } else {
      prevEndX = Math.round(x + rectWidth);
      x = Math.ceil(x);
    }
    var y, yStart;
    for (let j = 0; j < this.spectrogram[i].length; j++) {
      if (this.audioAnalyzer.settings.freqScale == 'linear' || this.audioAnalyzer.settings.freqScale == 'mel') {
        yStart = this.canvasSpec.height - j * rectHeight;
        y = Math.round(yStart - rectHeight);
        if (prevStartY > Math.floor(yStart)) {
          yStart = Math.ceil(yStart);
        } else {
          yStart = Math.floor(yStart);
        }
        prevStartY = y;
      } else if (this.audioAnalyzer.settings.freqScale == 'log') {
        const freq = j * df;
        const logFreq = Math.log10(freq + Number.EPSILON);
        const logPrevFreq = Math.log10((j - 1) * df + Number.EPSILON);
        y = this.canvasSpec.height - (logFreq - logMin) / scale;
        rectHeight = (logFreq - logPrevFreq) / scale;
        yStart = y + rectHeight;
        y = Math.round(y);
        if (prevStartY > Math.floor(yStart)) {
          yStart = Math.ceil(yStart);
        } else {
          yStart = Math.floor(yStart);
        }
        prevStartY = y;
      }

      if (prevEndX - x === 0 || yStart - y === 0) continue;
      const value = this.spectrogram[i][j];
      this.contextSpec.fillStyle = this.audioAnalyzer.getSpectrogramColor(
        value, this.audioAnalyzer.settings.spectrogramAmplitudeRange,
      );
      this.contextSpec.fillRect(x, y, prevEndX - x, yStart - y);
    }
  }

  // Draw the time axis (horizontal)
  this.contextSpec.font = "10px Arial";
  this.contextSpec.beginPath();
  const fullDuration = this.drawSettings.maxTime - this.drawSettings.minTime;
  const [niceT, digit] = this.audioAnalyzer.roundToNearestNiceNumber(fullDuration / 10);
  const dx = this.canvasSpec.width / fullDuration;
  const t0 = Math.ceil(this.drawSettings.minTime / niceT) * niceT;
  const numAxis = Math.floor(fullDuration / niceT);
  for (let i = 0; i <= numAxis; i++) {
    const t = t0 + niceT * i;
    const xx = (t - this.drawSettings.minTime) * dx;

    const measure = this.contextSpec.measureText(`${t.toFixed(digit)}s`);
    const imageData = this.contextSpec.getImageData(xx + 2, 12, measure.width, 10).data;
    const color = this.getAverageColorInRectangle(imageData);
    const whiteColorDeltaE = deltaE(color, [255, 255, 255, 1]);
    const blackColorDeltaE = deltaE(color, [0, 0, 0, 1]);
    if (whiteColorDeltaE < blackColorDeltaE) { // color is more similar to white than black
      this.contextSpec.fillStyle = "black";
    } else {
      this.contextSpec.fillStyle = "white";
    }
    // this.contextSpec.fillStyle = "white"; // "rgb(245,130,32)";
    if (this.canvasSpec.width * (2 / 100) < xx && xx < this.canvasSpec.width * (98 / 100)) {
      this.contextSpec.fillText(`${t.toFixed(digit)}s`, xx + 2, 12);
    } // don't draw near the edge

    this.contextSpec.fillStyle = "rgb(180,120,20)";
    for (let j = 0; j < this.canvasSpec.height; j++) {
      this.contextSpec.fillRect(xx, j, 1, 1);
    }
  }

  // Draw the frequency axis (vertical)
  this.contextSpec.beginPath();
  var maxMel, minMel;
  if (this.audioAnalyzer.settings.freqScale == 'linear') {
    scale = (maxFreq - minFreq) / this.canvasSpec.height;
  } else if (this.audioAnalyzer.settings.freqScale == 'log') {
    scale = (logMax - logMin) / this.canvasSpec.height;
  } else if (this.audioAnalyzer.settings.freqScale == 'mel') {
    maxMel = this.audioAnalyzer.hzToMel(this.drawSettings.maxFrequency);
    minMel = this.audioAnalyzer.hzToMel(this.drawSettings.minFrequency);
  }
  const numAxes = Math.round(10 * this.audioAnalyzer.settings.spectrogramVerticalScale);
  for (let i = 0; i < numAxes; i++) {
    var freq, y;
    if (this.audioAnalyzer.settings.freqScale == 'linear') {
      freq = minFreq + (i * (maxFreq - minFreq)) / numAxes;
      y = this.canvasSpec.height - (freq - minFreq) / scale;
    } else if (this.audioAnalyzer.settings.freqScale == 'log') {
      const logFreq = logMin + (i * (logMax - logMin)) / numAxes;
      freq = Math.pow(10, logFreq);
      y = this.canvasSpec.height - (logFreq - logMin) / scale;
    } else if (this.audioAnalyzer.settings.freqScale == 'mel') {
      y = Math.round((i * (this.canvasSpec.height)) / numAxes);
      const mel = ((numAxes - i) * (maxMel - minMel)) / numAxes + minMel;
      freq = this.audioAnalyzer.melToHz(mel);
    }

    const measure = this.contextSpec.measureText(`${Math.trunc(freq)}`);
    const imageData = this.contextSpec.getImageData(4, y - 4, measure.width, 10).data;
    const color = this.getAverageColorInRectangle(imageData);
    const whiteColorDeltaE = deltaE(color, [255, 255, 255, 1]);
    const blackColorDeltaE = deltaE(color, [0, 0, 0, 1]);
    if (whiteColorDeltaE < blackColorDeltaE) {
      this.contextSpec.fillStyle = "black";
    } else {
      this.contextSpec.fillStyle = "white";
    }
    // this.contextSpec.fillStyle = "white"; // "rgb(245,130,32)";

    this.contextSpec.fillText(`${Math.trunc(freq)}`, 4, y - 4);

    this.contextSpec.fillStyle = "rgb(180,120,20)";
    for (let j = 0; j < this.canvasSpec.width; j++) {
      this.contextSpec.fillRect(j, y, 1, 1);
    }
  }
  this.contextSpec.font = origFont;
};


WaveformSpecVisualizer.prototype.refresh = function() {
  this.draw();
};

WaveformSpecVisualizer.prototype.setWidth = function(width) {

  this.canvas.width = width;
  this.resample();
  this.refresh();
};

WaveformSpecVisualizer.prototype.setHeight = function(height) {

  this.canvas.height = height;
  this.resample();
  this.refresh();
};


WaveformSpecVisualizer.prototype.calculateRegion = function(changingPoint) {
  var region = {left: this.leftRegionPosition, right: this.rightRegionPosition};
  var offset = changingPoint - (this.canvas.offsetLeft + this.canvas.offsetParent.offsetLeft);
  var center = this.leftRegionPosition + (this.rightRegionPosition - this.leftRegionPosition)/2

  if (offset < center) {
    region.left = offset;
    region.right = this.rightRegionPosition - this.leftRegionPosition;
  } else {
    region.left = this.leftRegionPosition;
    region.right = offset - this.leftRegionPosition;
  }

  return region;
};

WaveformSpecVisualizer.prototype.setLeftRegionPosition = function(_leftRegionPosition) {
  this.leftRegionPosition = this.translateOrigToResampled(_leftRegionPosition);
};

WaveformSpecVisualizer.prototype.setRightRegionPosition = function(_rightRegionPosition) {
  this.rightRegionPosition = this.translateOrigToResampled(_rightRegionPosition);
};


WaveformSpecVisualizer.prototype.setCurrentPosition = function(_currentPosition) {
  const newPosition = this.translateOrigToResampled(_currentPosition);
  if (newPosition == this.currentPosition) return;
  this.currentPosition = this.translateOrigToResampled(_currentPosition);
  if (this.currentPosition < this.leftRegionPosition) {
    this.currentPosition = this.leftRegionPosition;
  }
  if (this.currentPosition > this.rightRegionPosition) {
    this.currentPosition = this.rightRegionPosition;
  }

  if (this.staticWaveform !== true) this.draw();
  this.updatePlayerCursor();
};

WaveformSpecVisualizer.prototype.updatePlayerCursor = function(_currentPosition = null) {
  currentPosition = (_currentPosition === null) ? this.currentPosition : _currentPosition;
  if (this.showCursor === false) return;
  const posInFigureRange = this.getPositionInFigureRange(currentPosition, this.drawSettings.minTime, this.drawSettings.maxTime);
  this.playerCursor.style.width = `${posInFigureRange}px`;

  if (this.showSpectrogram === true) {
    this.specPlayerCursor.style.width = `${posInFigureRange}px`;
  }
};

WaveformSpecVisualizer.prototype.load = function() {
  $('#upperLim').parent().css('opacity', '1');
  $('#lowerLim').parent().css('opacity', '1');

  $('#div_lower_limit').css('opacity', '1');
  $('#div_upper_limit').css('opacity', '1');
};
