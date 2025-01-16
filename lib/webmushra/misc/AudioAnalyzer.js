// Ported from https://github.com/sukumo28/vscode-audio-preview/blob/main/src/webview/services/analyzeService.ts
const ASvalidWindowSizes = [256, 512, 1024, 2048, 4096, 8192, 16384, 32768];
const ASvalidFreqScales = ["linear", "log", "mel"];
const ASvalidSampleRates = [
  8000, 16000, 22050, 24000, 32000, 44100, 48000, 96000,
];
Object.freeze(ASvalidWindowSizes);
Object.freeze(ASvalidFreqScales);
Object.freeze(ASvalidSampleRates);

function findNearestWindowSizes(_windowSize) {
  let minDiff = Number.MAX_VALUE;
  let minDiffIndex = 0;
  for (let i = 0; i < ASvalidWindowSizes.length; i++) {
    const diff = Math.abs(ASvalidWindowSizes[i] - _windowSize);
    if (diff < minDiff) {
      minDiff = diff;
      minDiffIndex = i;
    }
  }
  return ASvalidWindowSizes[minDiffIndex];
}

function findNearestSampleRates(_sampleRate) {
  let minDiff = Number.MAX_VALUE;
  let minDiffIndex = 0;
  for (let i = 0; i < ASvalidSampleRates.length; i++) {
    const diff = Math.abs(ASvalidSampleRates[i] - _sampleRate);
    if (diff < minDiff) {
      minDiff = diff;
      minDiffIndex = i;
    }
  }
  return ASvalidSampleRates[minDiffIndex];
}

function getMinAndMaxAmplitude(_audioArray) {
  var min = Number.POSITIVE_INFINITY, max = Number.NEGATIVE_INFINITY;
  for (var i = 0; i < _audioArray.length; i++) {
    const v = _audioArray[i];
    if (v < min) min = v;
    if (max < v) max = v;
  }
  return [min, max];
}

function AudioAnalyzer(_settings, _audioLength, _minAmplitude, _maxAmplitude, _sampleRate, _canvasWidth) {
  this.defaultSettings = {
    "fixedDurationWinSize": false,  // # whether to adaptively adjust the window size according to the actual sample rate to keep the duration fixed
    "spectrogramVerticalScale": 1.0, // between 0.2 and 2.0
    "windowSize": 1024,
    "hopSize": null,
    "minFrequency": 0,
    "maxFrequency": 24000,
    "minTime": 0,
    "maxTime": Number.POSITIVE_INFINITY,
    "freqScale": "linear",
    "spectrogramAmplitudeRange": -90, // lowest amplitude in dB
    "melFilterNum": 80,
    "baseSampleRate": 48000,
    "waveformVerticalScale": 0.5, // between 0.2 and 2.0
    "minDataPointsPerPixel": 5,  // density of the waveform plot (between 0 and 100)
    "minAmplitude": -1,  // lowest waveform amplitude
    "maxAmplitude": 1,  // highest waveform amplitude
  };
  if (_settings !== null && typeof _settings === "object") {
    for (var k in _settings) {
      if (k in this.defaultSettings) this.defaultSettings[k] = _settings[k];
    }
  }
  this.settings = Object.assign({}, this.defaultSettings);
  this.settings.maxFrequency = Math.trunc(_sampleRate / 2);
  if (this.updateSettings(_sampleRate, _audioLength, _minAmplitude, _maxAmplitude, _canvasWidth) !== true) {
    throw new Error("Something went wrong when updating settings: " + JSON.stringify(this.settings));
  }
  if (this.validateSettings() === false) {
    throw new Error("Invalid settings: " + JSON.stringify(this.settings));
  }

  if (typeof _canvasWidth !== "number" || _canvasWidth <= 0) {
    throw new Error("Invalid canvas width: " + _canvasWidth);
  }
  this.canvasWidth = _canvasWidth;

  this.maxValue = Number.EPSILON;  // max value of spectrogram for normalizing visualization
}

AudioAnalyzer.prototype.validateSettings = function () {
  if (typeof this.settings.fixedDurationWinSize !== "boolean") return false;
  if (typeof this.settings.spectrogramVerticalScale !== "number" || this.settings.spectrogramVerticalScale < 0.2 || this.settings.spectrogramVerticalScale > 2.0) return false;
  if (typeof this.settings.waveformVerticalScale !== "number" || this.settings.waveformVerticalScale < 0.2 || this.settings.waveformVerticalScale > 2.0) return false;
  if (typeof this.settings.minDataPointsPerPixel !== "number" || this.settings.minDataPointsPerPixel < 0 || this.settings.minDataPointsPerPixel > 100) return false;
  if (!ASvalidWindowSizes.includes(this.settings.windowSize)) return false;
  if (this.settings.hopSize <= 0 || this.settings.hopSize > this.settings.windowSize) return false;
  if (typeof this.settings.minTime !== "number" || this.settings.minTime < 0) return false;
  if (typeof this.settings.maxTime !== "number" || this.settings.maxTime < this.settings.minTime) return false;
  if (typeof this.settings.minFrequency !== "number" || this.settings.minFrequency < 0) return false;
  if (typeof this.settings.maxFrequency !== "number" || this.settings.maxFrequency < this.settings.minFrequency) return false;
  if (typeof this.settings.minAmplitude !== "number") return false;
  if (typeof this.settings.maxAmplitude !== "number" || this.settings.maxAmplitude < this.settings.minAmplitude) return false;
  if (!ASvalidFreqScales.includes(this.settings.freqScale)) return false;
  if (typeof this.settings.spectrogramAmplitudeRange !== "number" || this.settings.spectrogramAmplitudeRange >= 0) return false;
  if (typeof this.settings.melFilterNum !== "number" || this.settings.melFilterNum < 1) return false;
  if (!ASvalidSampleRates.includes(this.settings.baseSampleRate)) return false;

  // if minFrequency = 0, logscaled minimum value is log10(Number.EPSILON). However, in this case the values are too small, making the graph less readable. So set minFrequency = 1.
  if (this.settings.freqScale == "log" && this.settings.minFrequency < 1) this.settings.minFrequency = 1;
  return true;
};

/*
Calc hopsize
This hopSize make rectWidth greater than minRectWidth for every duration of input.
Thus, spectrogram of long duration input can be drawn as faster as short duration one.

Use a minimum hopSize to prevent from becoming too small for short periods of data.
*/
AudioAnalyzer.prototype.calcHopSize = function () {
  const minRectWidth = (2 * this.settings.windowSize) / 1024;
  const enoughHopSize = Math.trunc(
    (minRectWidth * this.audioLength) / this.canvasWidth
  );
  const minHopSize = this.settings.windowSize / 32;
  const hopSize = Math.min(Math.max(enoughHopSize, minHopSize), this.settings.windowSize);
  return hopSize;
};

AudioAnalyzer.prototype.updateSettings = function (_sampleRate, _audioLength, _minAmplitude, _maxAmplitude, _canvasWidth) {
  if (_canvasWidth !== null) {
    if (typeof _canvasWidth !== "number" || _canvasWidth <= 0) return null;
    this.canvasWidth = _canvasWidth;
  }

  if (typeof _sampleRate !== "number" || _sampleRate <= 0) return null;
  if (typeof _audioLength !== "number" || _audioLength <= 0) return null;
  if (typeof _minAmplitude !== "number" || _minAmplitude < -1) return null;
  if (typeof _maxAmplitude !== "number" || _maxAmplitude > 1) return null;
  this.audioLength = _audioLength;
  this.settings.maxTime = _audioLength / _sampleRate;
  this.settings.minAmplitude = _minAmplitude;
  this.settings.maxAmplitude = _maxAmplitude;

  if (_sampleRate === this.settings.baseSampleRate) {
    if (this.settings.hopSize === null) this.settings.hopSize = this.calcHopSize();
    return true;
  }
  this.settings.baseSampleRate = findNearestSampleRates(_sampleRate);
  // Adaptively adjust the window size to ensure fixed window duration in different sample rates
  if (this.settings.fixedDurationWinSize === true) {
    this.settings.windowSize = findNearestWindowSizes(
      (this.defaultSettings.windowSize / this.defaultSettings.baseSampleRate) * this.settings.baseSampleRate
    );
    if (this.defaultSettings.hopSize !== null) {
      this.settings.hopSize = Math.trunc(
        this.defaultSettings.hopSize / this.defaultSettings.baseSampleRate * this.settings.baseSampleRate
      );
    } else {
      this.settings.hopSize = this.calcHopSize();
    }
  } else if (this.defaultSettings.hopSize === null) {
    this.settings.hopSize = this.calcHopSize();
  }
  this.settings.maxFrequency = Math.trunc(this.settings.baseSampleRate / 2);

  return true;
};

AudioAnalyzer.prototype.getSpectrogramColor = function (_amp, _range) {
  if (_amp === null) {
    return "rgb(0,0,0)";
  }
  const classNum = 6;
  const classWidth = _range / classNum;
  const ampClass = Math.floor(_amp / classWidth);
  const classMinAmp = (ampClass + 1) * classWidth;
  const value = (_amp - classMinAmp) / -classWidth;
  switch (ampClass) {
    case 0:
      return `rgb(255,255,${125 + Math.floor(value * 130)})`;
    case 1:
      return `rgb(255,${125 + Math.floor(value * 130)},125)`;
    case 2:
      return `rgb(255,${Math.floor(value * 125)},125)`;
    case 3:
      return `rgb(${125 + Math.floor(value * 130)},0,125)`;
    case 4:
      return `rgb(${Math.floor(value * 125)},0,125)`;
    case 5:
      return `rgb(0,0,${Math.floor(value * 125)})`;
    default:
      return `rgb(0,0,0)`;
  }
};

AudioAnalyzer.prototype.analyze = function (_audioArray, _sampleRate, _minTime = null, _maxTime = null, _minFrequency = null, _maxFrequency = null, _isZoomed = false) {
  if (this.settings.freqScale === "linear") {
    return this.getSpectrogram(_audioArray, _sampleRate, _minTime, _maxTime, _minFrequency, _maxFrequency, _isZoomed);
  } else if (this.settings.freqScale === "log") {
    return this.getSpectrogram(_audioArray, _sampleRate, _minTime, _maxTime, _minFrequency, _maxFrequency, _isZoomed);
  } else if (this.settings.freqScale === "mel") {
    return this.getMelSpectrogram(_audioArray, _sampleRate, _minTime, _maxTime, _minFrequency, _maxFrequency, _isZoomed);
  } else {
    return null;
  }
};

AudioAnalyzer.prototype.getSpectrogram = function (_audioArray, _sampleRate, _minTime, _maxTime, _minFrequency, _maxFrequency, _isZoomed) {
  const windowSize = this.settings.windowSize;
  const window = new Float32Array(windowSize);
  for (let i = 0; i < windowSize; i++) {
    window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / windowSize);
  }

  const minTime = (_minTime !== null) ? _minTime : this.settings.minTime;
  const maxTime = (_maxTime !== null) ? _maxTime : this.settings.maxTime;
  const minFreq = (_minFrequency !== null) ? _minFrequency : this.settings.minFrequency;
  const maxFreq = (_maxFrequency !== null) ? _maxFrequency : this.settings.maxFrequency;

  const startIndex = Math.floor(minTime * _sampleRate);
  const endIndex = Math.floor(maxTime * _sampleRate);

  const df = _sampleRate / this.settings.windowSize;
  const minFreqIndex = Math.floor(minFreq / df);
  const maxFreqIndex = Math.floor(maxFreq / df);

  const ooura = new Ooura(windowSize, { type: "real", radix: 4 });

  let maxValue = (_isZoomed === true) ? this.maxValue : Number.EPSILON;

  const spectrogram = [];
  for (let i = startIndex; i < endIndex; i += this.settings.hopSize) {
    // i is center of the window
    const s = i - windowSize / 2,
      t = i + windowSize / 2;
    const ss = s > 0 ? s : 0,
      tt = t < _audioArray.length ? t : _audioArray.length;
    const d = ooura.scalarArrayFactory();
    for (let j = 0; j < d.length; j++) {
      if (s + j < ss) {
        continue;
      }
      if (tt < s + j) {
        continue;
      }
      d[j] = _audioArray[s + j] * window[j];
    }

    const re = ooura.vectorArrayFactory();
    const im = ooura.vectorArrayFactory();
    ooura.fft(d.buffer, re.buffer, im.buffer);

    const ps = [];
    for (let j = minFreqIndex; j < maxFreqIndex; j++) {
      const v = re[j] * re[j] + im[j] * im[j];
      ps.push(v);
      if (_isZoomed !== true && maxValue < v) {
        maxValue = v;
      }
    }

    spectrogram.push(ps);
  }

  if (_isZoomed !== true) this.maxValue = maxValue;

  for (let i = 0; i < spectrogram.length; i++) {
    // const nanJ = [], infJ = [];  // For debugging
    for (let j = 0; j < spectrogram[i].length; j++) {
      spectrogram[i][j] = 10 * Math.log10(spectrogram[i][j] / maxValue);
      // if (isNaN(spectrogram[i][j])) {  // For debugging
      //   if (nanJ.length === 0 || nanJ[nanJ.length - 1][1] !== j - 1) { nanJ.push([j, j]); } else { nanJ[nanJ.length - 1][1] = j; }
      // } else if (!isFinite(spectrogram[i][j])) {
      //   if (infJ.length === 0 || infJ[infJ.length - 1][1] !== j - 1) { infJ.push([j, j]); } else { infJ[infJ.length - 1][1] = j; }
      // }
    }
    // if (infJ.length > 0) {  // For debugging
    //   var indices = infJ.map((val) => (val[0] === val[1] ? val[0].toString() : val.join("~"))).join(", ");

    //   console.log("spectrogram[" + i + "][" + indices + "]: infinite  (spectrogram[" + i + "].length = " + spectrogram[i].length + ")");
    // }
    // if (nanJ.length > 0) {  // For debugging
    //   var indices = nanJ.map((val) => (val[0] === val[1] ? val[0].toString() : val.join("~"))).join(", ");

    //   console.log("spectrogram[" + i + "][" + indices + "]: NaN  (spectrogram[" + i + "].length = " + spectrogram[i].length + ")");
    // }
  }

  return spectrogram;
};

AudioAnalyzer.prototype.getMelSpectrogram = function (_audioArray, _sampleRate, _isZoomed) {
  const windowSize = this.settings.windowSize;
  const window = new Float32Array(windowSize);
  for (let i = 0; i < windowSize; i++) {
    window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / windowSize);
  }

  const startIndex = Math.floor(this.settings.minTime * _sampleRate);
  const endIndex = Math.floor(this.settings.maxTime * _sampleRate);

  const df = _sampleRate / this.settings.windowSize;
  const minFreqIndex = Math.floor(
    this.hzToMel(this.settings.minFrequency) / df
  );
  const maxFreqIndex = Math.floor(
    this.hzToMel(this.settings.maxFrequency) / df
  );

  const ooura = new Ooura(windowSize, { type: "real", radix: 4 });

  const spectrogram = [];
  for (let i = startIndex; i < endIndex; i += this.settings.hopSize) {
    // i is center of the window
    const s = i - windowSize / 2,
      t = i + windowSize / 2;
    const ss = s > 0 ? s : 0,
      tt = t < _audioArray.length ? t : _audioArray.length;

    const d = ooura.scalarArrayFactory();
    for (let j = 0; j < d.length; j++) {
      if (s + j < ss) {
        continue;
      }
      if (tt < s + j) {
        continue;
      }
      d[j] = _audioArray[s + j] * window[j];
    }

    const re = ooura.vectorArrayFactory();
    const im = ooura.vectorArrayFactory();
    ooura.fft(d.buffer, re.buffer, im.buffer);

    const spectrum = [];
    for (let j = 0; j < re.length; j++) {
      spectrum.push(re[j] * re[j] + im[j] * im[j]);
    }

    // Apply mel filter bank to the spectrum
    const melSpectrum = this.applyMelFilterBank(
      this.settings.melFilterNum,
      spectrum,
      _sampleRate,
      minFreqIndex,
      maxFreqIndex
    );

    spectrogram.push(melSpectrum);
  }

  let maxValue;
  if (_isZoomed === true) {
    maxValue = this.maxValue;
  } else {
    maxValue = Number.EPSILON;
    for (let i = 0; i < spectrogram.length; i++) {
      for (let j = 0; j < spectrogram[i].length; j++) {
        if (maxValue < spectrogram[i][j]) {
          maxValue = spectrogram[i][j];
        }
      }
    }
    this.maxValue = maxValue;
  }

  for (let i = 0; i < spectrogram.length; i++) {
    for (let j = 0; j < spectrogram[i].length; j++) {
      const val = 10 * Math.log10(spectrogram[i][j] / maxValue);
      spectrogram[i][j] = val;
    }
  }

  return spectrogram;
};

AudioAnalyzer.prototype.applyMelFilterBank = function (
  _numFilters,
  _spectrum,
  _sampleRate,
  _minFreqIndex,
  _maxFreqIndex
) {
  const minMel = this.hzToMel((_minFreqIndex * _sampleRate) / _spectrum.length);
  const maxMel = this.hzToMel((_maxFreqIndex * _sampleRate) / _spectrum.length);
  const melStep = (maxMel - minMel) / (_numFilters + 1);

  const filterBank = [];
  for (let i = 0; i < _numFilters; i++) {
    const filter = [];
    const startMel = minMel + i * melStep;
    const centerMel = minMel + (i + 1) * melStep;
    const endMel = minMel + (i + 2) * melStep;
    const startIndex = Math.round(
      (this.melToHz(startMel) * _spectrum.length) / _sampleRate
    );
    const centerIndex = Math.round(
      (this.melToHz(centerMel) * _spectrum.length) / _sampleRate
    );
    const endIndex = Math.round(
      (this.melToHz(endMel) * _spectrum.length) / _sampleRate
    );
    for (let j = 0; j < _spectrum.length; j++) {
      if (j < startIndex || j > endIndex) {
        filter.push(0);
      } else if (j < centerIndex) {
        filter.push((j - startIndex) / Math.max(1, centerIndex - startIndex));
      } else {
        filter.push((endIndex - j) / Math.max(1, endIndex - centerIndex));
      }
    }
    filterBank.push(filter);
  }

  const melSpectrum = [];
  for (let i = 0; i < _numFilters; i++) {
    let sum = 0;
    for (let j = 0; j < _spectrum.length; j++) {
      sum += _spectrum[j] * filterBank[i][j];
    }
    if (sum <= 0) sum = Number.EPSILON;
    melSpectrum.push(sum);
  }

  return melSpectrum;
};

AudioAnalyzer.prototype.hzToMel = function (_hz) {
  return 2595 * Math.log10(1 + _hz / 700);
};

AudioAnalyzer.prototype.melToHz = function (_mel) {
  return 700 * (Math.pow(10, _mel / 2595) - 1);
};

// round input value to the nearest nice number, which has the most significant digit of 1, 2, 5
// return the number of decimal digits as well, for display purpose
AudioAnalyzer.prototype.roundToNearestNiceNumber = function (num) {
  const niceNumbers = [1.0, 2.0, 5.0, 10.0];

  if (num <= 0) {
    return [0, 0];
  } // this function only works for positive number

  // num = mantissa * 10^exponent
  const exponent = Math.floor(Math.log10(num));
  const mantissa = num / Math.pow(10, exponent);

  // find which number in niceNumbers is nearest
  const dist = niceNumbers.map((value) =>
    Math.abs(Math.log10(mantissa) - Math.log10(value))
  );
  const niceNumber = niceNumbers[dist.indexOf(Math.min(...dist))];

  const rounded = niceNumber * Math.pow(10, exponent);
  let digit = niceNumber === 10.0 ? -exponent - 1 : -exponent;
  digit = digit <= 0 ? 0 : digit; // avoid -0

  return [rounded, digit];
};

AudioAnalyzer.prototype.clampMinMax = function (_num, _min, _max) {
  return Math.min(Math.max(_num, _min), _max);
};

// Code Reference: https://stackoverflow.com/a/52453462/29099325
// Value Table: https://zschuessler.github.io/DeltaE/learn/
function deltaE(rgbA, rgbB) {
  let labA = rgb2lab(rgbA);
  let labB = rgb2lab(rgbB);
  let deltaL = labA[0] - labB[0];
  let deltaA = labA[1] - labB[1];
  let deltaB = labA[2] - labB[2];
  let c1 = Math.sqrt(labA[1] * labA[1] + labA[2] * labA[2]);
  let c2 = Math.sqrt(labB[1] * labB[1] + labB[2] * labB[2]);
  let deltaC = c1 - c2;
  let deltaH = deltaA * deltaA + deltaB * deltaB - deltaC * deltaC;
  deltaH = deltaH < 0 ? 0 : Math.sqrt(deltaH);
  let sc = 1.0 + 0.045 * c1;
  let sh = 1.0 + 0.015 * c1;
  let deltaLKlsl = deltaL / (1.0);
  let deltaCkcsc = deltaC / (sc);
  let deltaHkhsh = deltaH / (sh);
  let i = deltaLKlsl * deltaLKlsl + deltaCkcsc * deltaCkcsc + deltaHkhsh * deltaHkhsh;
  return i < 0 ? 0 : Math.sqrt(i);
}

function rgb2lab(rgb) {
  let r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255, x, y, z;
  r = (r > 0.04045) ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = (g > 0.04045) ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = (b > 0.04045) ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
  x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000;
  z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  x = (x > 0.008856) ? Math.pow(x, 1/3) : (7.787 * x) + 16/116;
  y = (y > 0.008856) ? Math.pow(y, 1/3) : (7.787 * y) + 16/116;
  z = (z > 0.008856) ? Math.pow(z, 1/3) : (7.787 * z) + 16/116;
  return [(116 * y) - 16, 500 * (x - y), 200 * (y - z)]
}
