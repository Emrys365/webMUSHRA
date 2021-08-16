/*************************************************************************
         (C) Copyright AudioLabs 2017 

This source code is protected by copyright law and international treaties. This source code is made available to You subject to the terms and conditions of the Software License for the webMUSHRA.js Software. Said terms and conditions have been made available to You prior to Your download of this source code. By downloading this source code You agree to be bound by the above mentionend terms and conditions, which can also be found here: https://www.audiolabs-erlangen.de/resources/webMUSHRA. Any unauthorised use of this source code may result in severe civil and criminal penalties, and will be prosecuted to the maximum extent possible under law. 

**************************************************************************/

function MultiMetricMushraPage(_pageManager, _pageTemplateRenderer, _audioContext, _bufferSize, _audioFileLoader, _session, _pageConfig, _mushraValidator, _errorHandler, _language, _pageCount) {
	this.isMushra = true; 
  this.pageManager = _pageManager;
  this.pageTemplateRenderer = _pageTemplateRenderer;
  this.audioContext = _audioContext;
  this.bufferSize = _bufferSize;
  this.audioFileLoader = _audioFileLoader;
  this.session = _session;
  this.pageConfig = _pageConfig;
  this.mushraValidator = _mushraValidator;
  this.errorHandler = _errorHandler;
  this.language = _language
  this.mushraAudioControl = null;
  this.div = null;
  this.waveformVisualizer = null;
  this.macic = null; 
  
  this.currentItem = null;
  
  this.tdLoop2 = null; 

  this.metrics = this.pageConfig.metrics;
  this.contents = {};
  this.metricColors = {};
  this.responses = {};
  for (var i = 0; i < this.metrics.length; ++i) {
    this.contents[this.metrics[i]] = this.pageConfig.content[i];
    this.metricColors[this.metrics[i]] = this.pageConfig.colors[i];
    this.responses[this.metrics[i]] = this.pageConfig.response[i];
  }
  this.metricColors["__inactive_color__"] = "#F1F1F1";
  // for storing the rendered response text positions
  this.responseYPos = [];
  for (var i = 0; i < this.responses[this.metrics[0]].length; ++i) {
    this.responseYPos[this.responseYPos.length] = 0;
  }
  this.lastMetric = this.metrics[0];

  this.conditions = [];
  for (var key in this.pageConfig.stimuli) {
    this.conditions[this.conditions.length] = new Stimulus(key, this.pageConfig.stimuli[key]);
  }
  this.reference = new Stimulus("reference", this.pageConfig.reference);
  this.audioFileLoader.addFile(this.reference.getFilepath(), (function (_buffer, _stimulus) { _stimulus.setAudioBuffer(_buffer); }), this.reference);
  for (var i = 0; i < this.conditions.length; ++i) {
    this.audioFileLoader.addFile(this.conditions[i].getFilepath(), (function (_buffer, _stimulus) { _stimulus.setAudioBuffer(_buffer); }), this.conditions[i]);
  }

  // for unlocking the Next button when this.pageConfig.mustPlayAll == true or this.pageConfig.mustViewAllTabs == true
  this.isFirstLoad = true;
  this.isAllPlayed = ! this.pageConfig.mustPlayAll;
  this.isPlayed = [];
  for (var i = 0; i < this.conditions.length; ++i) {
    this.isPlayed[this.isPlayed.length] = ! this.pageConfig.mustPlayAll;
  }
  this.allTabsViewed = ! this.pageConfig.mustViewAllTabs;
  this.isViewed = [];
  for (var i = 0; i < this.metrics.length; ++i) {
    this.isViewed[this.isViewed.length] = ! this.pageConfig.mustViewAllTabs;
  }

  // data
  this.ratings = [];
  this.loop = {start: null, end: null};
  this.slider = {start: null, end: null};
  
  this.time = 0;
  this.startTimeOnPage = null;

  this.pageCount = _pageCount;
}



MultiMetricMushraPage.prototype.getName = function () {
  return this.pageConfig.name;
};

MultiMetricMushraPage.prototype.init = function () {
   var toDisable;
  var td;
  var active; 
  
  if (this.pageConfig.strict !== false) {
    this.mushraValidator.checkNumConditions(this.conditions);
    this.mushraValidator.checkStimulusDuration(this.reference);
  }
  
  this.mushraValidator.checkNumChannels(this.audioContext, this.reference);
	var i;
  for (i = 0; i < this.conditions.length; ++i) {
    this.mushraValidator.checkSamplerate(this.audioContext.sampleRate, this.conditions[i]);
  }
  this.mushraValidator.checkConditionConsistency(this.reference, this.conditions);


  this.mushraAudioControl = new MultiMetricMushraAudioControl(this.audioContext, this.bufferSize, this.reference, this.conditions, this.errorHandler, this.pageConfig.createAnchor35, this.pageConfig.createAnchor70, this.pageConfig.randomize);
  this.mushraAudioControl.addEventListener((function (_event) {
    // var tabs = $(".tablinks");
    // var metricIndex = 0;
    // for (var idx = 0; idx < tabs.length; idx++) {
    //   if ($(tabs[idx]).hasClass("active")) {
    //     metricIndex = idx;
    //     break;
    //   }
    // }
  if (_event.name == 'stopTriggered') {
    $(".audioControlElement").text(this.pageManager.getLocalizer().getFragment(this.language, 'playButton'));

    if($('#buttonReference').attr("active") == "true") {
      $.mobile.activePage.find('#buttonReference')  //remove color from Reference
        .removeClass('ui-btn-b')
        .addClass('ui-btn-a').attr('data-theme', 'a');
      $('#buttonReference').attr("active", "false");
    }

    for(i = 0; i < _event.conditionLength; i++) {
      active = '#buttonConditions' + i;
      if($(active).attr("active") == "true") {
        $.mobile.activePage.find(active)      // remove color from conditions
        .removeClass('ui-btn-b')
        .addClass('ui-btn-a').attr('data-theme', 'a');
        for (var idx = 0; idx < this.metrics.length; idx++) {
          toDisable = $(".scales").get(i * this.metrics.length + idx);
          $(toDisable).slider('disable');
          $(toDisable).attr("active", "false");
          $(active).attr("active", "false");
        }
        break;
      }
    }

    $.mobile.activePage.find('#buttonStop')    //add color to stop
      .removeClass('ui-btn-a')
      .addClass('ui-btn-b').attr('data-theme', 'b');
    $.mobile.activePage.find('#buttonStop').focus();
    $('#buttonStop').attr("active", "true");

  } else if (_event.name == 'playReferenceTriggered') {

    if($('#buttonStop').attr("active") == "true") {
      $.mobile.activePage.find('#buttonStop')  //remove color from Stop
        .removeClass('ui-btn-b')
        .addClass('ui-btn-a').attr('data-theme', 'a');
      $('#buttonStop').attr("active", "false");
    }

	var j;
    for(j = 0; j < _event.conditionLength; j++) {
  	  active = '#buttonConditions' + j;
  		if($(active).attr("active") == "true") {
  			$.mobile.activePage.find(active)			// remove color from conditions
  			  .removeClass('ui-btn-b')
  			  .addClass('ui-btn-a').attr('data-theme', 'a'); 
  			$(active).attr("active", "false");
        for (var idx = 0; idx < this.metrics.length; idx++) {
          toDisable = $(".scales").get(j * this.metrics.length + idx);
          $(toDisable).slider('disable');
          $(toDisable).attr("active", "false");
        }
  			break;
  		}
  	}

    $.mobile.activePage.find('#buttonReference')		//add color to reference
  	  .removeClass('ui-btn-a')
  	  .addClass('ui-btn-b').attr('data-theme', 'b');
    $.mobile.activePage.find('#buttonReference').focus();
  	$('#buttonReference').attr("active", "true");
  } else if(_event.name == 'playConditionTriggered') {

    var index = _event.index;
    var selector = '#buttonConditions' + index;

    // For unlocking the Next button
    if (this.isAllPlayed == false) {
      this.isPlayed[index] = true;
      var isAllPlayed = true;
      for (var j = 0; j < this.conditions.length; ++j) {
        if (this.isPlayed[j] == false) {
          isAllPlayed = false;
          break;
        }
      }
      if (isAllPlayed == true) {
        this.isAllPlayed = true;
        if (this.allTabsViewed == true) {
          this.pageTemplateRenderer.unlockNextButton();
        }
      }
    }
    
    if($('#buttonStop').attr("active") == "true") {
      $.mobile.activePage.find('#buttonStop')  //remove color from Stop
      .removeClass('ui-btn-b')
      .addClass('ui-btn-a').attr('data-theme', 'a'); 
	    $('#buttonStop').attr("active", "false");
    }
    
    if($('#buttonReference').attr("active") == "true") {
      $.mobile.activePage.find('#buttonReference')	//remove color from Reference
      .removeClass('ui-btn-b')
      .addClass('ui-btn-a').attr('data-theme', 'a');
	    $('#buttonReference').attr("active", "false");
    }
    var k;
    for(k = 0; k < _event.length; k++) {
      active = '#buttonConditions' + k;
      if($(active).attr("active") == "true") {
        $.mobile.activePage.find(active)    // remove color from conditions
        .removeClass('ui-btn-b')
        .addClass('ui-btn-a').attr('data-theme', 'a');
        for (var idx = 0; idx < this.metrics.length; idx++) {
          toDisable = $(".scales").get(k * this.metrics.length + idx); 
          $(toDisable).slider('disable');
          $(active).attr("active", "false");
          $(toDisable).attr("active", "false");
        }
  	    break;
      }
    }
    
    for (var idx = 0; idx < this.metrics.length; idx++) {
      var activeSlider = $(".scales").get(index * this.metrics.length + idx);
      $(activeSlider).slider('enable');
      $(activeSlider).attr("active", "true");
    }
    $.mobile.activePage.find(selector)    //add color to conditions
      .removeClass('ui-btn-a')
      .addClass('ui-btn-b').attr('data-theme', 'b');
    $.mobile.activePage.find(selector).focus();
    $(selector).attr("active", "true");
  }

}).bind(this));

};

MultiMetricMushraPage.prototype.render = function (_parent) {
  var div = $("<div></div>");
  _parent.append(div);

  var tabs = $("<div class='tab'></div>");
  div.append(tabs);
  
  var p;
  for (var key in this.contents) {
    p = $("<div class='tablinks'>" + key + "</div>");
    p[0].onclick = this.switchTab.bind(this);
    tabs.append(p);
  }
  // Bind keys '[' and ']' for navigating between tabs
  Mousetrap.bind(['[', '【'], function() {
    var tabs = $(".tablinks");
    for (var idx = 0; idx < tabs.length; idx++) {
      if ($(tabs[idx]).hasClass("active")) {
        break;
      }
    }
    // mod(idx - 1, tabs.length)
    next_idx = (idx - 1) - tabs.length * Math.floor((idx - 1)/tabs.length);
    tabs[next_idx].click();
  });
  Mousetrap.bind([']', '】'], function() {
    var tabs = $(".tablinks");
    for (var idx = 0; idx < tabs.length; idx++) {
      if ($(tabs[idx]).hasClass("active")) {
        break;
      }
    }
    // mod(idx - 1, tabs.length)
    next_idx = (idx + 1) - tabs.length * Math.floor((idx + 1)/tabs.length);
    tabs[next_idx].click();
  });

  
  var note = $("<div style='display:inline-flex; overflow-x: auto; height: 50px;'><p>" + this.pageManager.getLocalizer().getFragment(this.language, 'selectTab') + " <font color='gray'>(" + this.pageManager.getLocalizer().getFragment(this.language, 'shortcutCheatsheet') + ")</font></p></div>");
  div.append(note);
  
  var content;
  var disp = "block";
  for (var key in this.contents) {
    if(this.contents[key] === null){
      content ="";
    } else {
      content = this.contents[key];
    }
    p = $("<div id='" + key +"' class='tabcontent' style='display: " + disp + "'><p>" + content + "</p></div>");
    div.append(p);
    disp = "none";
  }

  var tableUp = $("<table id='mainUp'></table>");
  var tableDown = $("<table id='mainDown' align = 'center'></table>"); 
  div.append(tableUp);
  div.append(tableDown);

  var trLoop = $("<tr id='trWs'></tr>");
  tableUp.append(trLoop);

  var tdLoop1 = $(" \
    <td class='stopButton'> \
      <button data-role='button' data-inline='true' id='buttonStop' onclick='"+ this.pageManager.getPageVariableName(this) + ".mushraAudioControl.stop();'>" + this.pageManager.getLocalizer().getFragment(this.language, 'stopButton') + "</button> \
    </td> \
  ");
  trLoop.append(tdLoop1);


  
  var tdRight = $("<td></td>");
  trLoop.append(tdRight);
  

  var trMushra = $("<tr></tr>");
  tableDown.append(trMushra);
  var tdMushra = $("<td id='td_Mushra' colspan='2'></td>");
  trMushra.append(tdMushra);

  var tableMushra = $("<table id='mushra_items'></table>");
  tdMushra.append(tableMushra);

  var trConditionNames = $("<tr></tr>");
  tableMushra.append(trConditionNames);

  var tdConditionNamesReference = $("<td>" + this.pageManager.getLocalizer().getFragment(this.language, 'reference') + "</td>");
  trConditionNames.append(tdConditionNamesReference);

  var tdConditionNamesScale = $("<td id='conditionNameScale'></td>");
  trConditionNames.append(tdConditionNamesScale);

  var conditions = this.mushraAudioControl.getConditions();
  var i;
  for (i = 0; i < conditions.length; ++i) {
    var str = "";
    if (this.pageConfig.showConditionNames === true) {
      if(this.language == 'en'){
        str = "<br/>" + conditions[i].id;
      }else{
        if(conditions[i].id == 'reference'){
          str = "<br/>" + this.pageManager.getLocalizer().getFragment(this.language, 'reference');
        }else if(conditions[i].id == 'anchor35'){
          str = "<br/>" + this.pageManager.getLocalizer().getFragment(this.language, '35');
        }else if(conditions[i].id == 'anchor70'){
          str = "<br/>" + this.pageManager.getLocalizer().getFragment(this.language, '70');
        }else{
          str = "<br/>" + conditions[i].id;
        }
      }
    }
    td = $("<td>" + this.pageManager.getLocalizer().getFragment(this.language, 'cond') + (i + 1) + str + "</td>");
    trConditionNames.append(td);
  }

  var trConditionPlay = $("<tr></tr>");
  tableMushra.append(trConditionPlay);

  var tdConditionPlayReference = $("<td></td>");
  trConditionPlay.append(tdConditionPlayReference);

  var buttonPlayReference = $("<button data-theme='a' id='buttonReference' data-role='button' class='audioControlElement' onclick='" + this.pageManager.getPageVariableName(this) + ".btnCallbackReference()' style='margin : 0 auto;'>" + this.pageManager.getLocalizer().getFragment(this.language, 'playButton') + "</button>");
  tdConditionPlayReference.append(buttonPlayReference);

  var tdConditionPlayScale = $("<td></td>");
  trConditionPlay.append(tdConditionPlayScale);

  for (i = 0; i < conditions.length; ++i) {
    td = $("<td></td>"); 
    var buttonPlay = $("<button data-role='button' class='center audioControlElement' onclick='" + this.pageManager.getPageVariableName(this) + ".btnCallbackCondition(" + i + ");'>" + this.pageManager.getLocalizer().getFragment(this.language, 'playButton') + "</button>");
    buttonPlay.attr("id", "buttonConditions" + i);
    td.append(buttonPlay);
    trConditionPlay.append(td);
    // (function(i) {
        // Mousetrap.bind(String(i + 1), function() { this.pageManager.getCurrentPage().btnCallbackCondition(i); });
    // })(i);
  }

    // ratings
  var trConditionRatings = $("<tr id='tr_ConditionRatings'></tr>");
  tableMushra.append(trConditionRatings);

  var tdConditionRatingsReference = $("<td id='refCanvas'></td>");
  trConditionRatings.append(tdConditionRatingsReference);

  var tdConditionRatingsScale = $("<td id='spaceForScale'></td>");
  trConditionRatings.append(tdConditionRatingsScale);


  var sliderName;
  for (i = 0; i < conditions.length; ++i) {
    disp = "inline-block";
    td = $("<td class='spaceForSlider'></td>");
    sp = $("<span></span>");
    td.append(sp);
    for (var key in this.contents) {
      sliderName = key + "-" + conditions[i].getId();
      inputSlider = $("<input type='range' name='" + sliderName + "' class='scales' value='100' min='0' max='100' data-vertical='true' data-highlight='true' style='display : " + disp + "; float : none;'/>");
      sp.append(inputSlider);
      disp = "none";
    }
    $(".ui-slider-handle").unbind('keydown');
    trConditionRatings.append(td);
  }


  this.macic = new MultiMetricMushraAudioControlInputController(this.mushraAudioControl, this.pageConfig.enableLooping);
  this.macic.bind(); 

this.waveformVisualizer = new WaveformVisualizer(this.pageManager.getPageVariableName(this) + ".waveformVisualizer", tdRight, this.reference, this.pageConfig.showWaveform, this.pageConfig.enableLooping, this.mushraAudioControl);
  this.waveformVisualizer.create();
  this.waveformVisualizer.load();
};

MultiMetricMushraPage.prototype.pause = function() {
    this.mushraAudioControl.pause();
};

MultiMetricMushraPage.prototype.setLoopStart = function() {
  var slider = document.getElementById('slider');
  var startSliderSamples = this.mushraAudioControl.audioCurrentPosition;

  var endSliderSamples = parseFloat(slider.noUiSlider.get()[1]);

  this.mushraAudioControl.setLoop(startSliderSamples, endSliderSamples);
};

MultiMetricMushraPage.prototype.setLoopEnd = function() {
  var slider = document.getElementById('slider'); 
  var startSliderSamples = parseFloat(slider.noUiSlider.get()[0]);

  var endSliderSamples = this.mushraAudioControl.audioCurrentPosition;

  this.mushraAudioControl.setLoop(startSliderSamples, endSliderSamples);
};

MultiMetricMushraPage.prototype.btnCallbackReference = function() {
  this.currentItem = "ref";
  var label = $("#buttonReference").text();
  if (label == this.pageManager.getLocalizer().getFragment(this.language, 'pauseButton')) {
    this.mushraAudioControl.pause();
    $("#buttonReference").text(this.pageManager.getLocalizer().getFragment(this.language, 'playButton'));
  } else if (label == this.pageManager.getLocalizer().getFragment(this.language, 'playButton')) {
    $(".audioControlElement").text(this.pageManager.getLocalizer().getFragment(this.language, 'playButton'));
    this.mushraAudioControl.playReference();
    $("#buttonReference").text(this.pageManager.getLocalizer().getFragment(this.language, 'pauseButton'));
  }
}; 

MultiMetricMushraPage.prototype.btnCallbackCondition = function(_index) {
	this.currentItem = _index;	
	
  var label = $("#buttonConditions" + _index).text();
  if (label == this.pageManager.getLocalizer().getFragment(this.language, 'pauseButton')) {
    this.mushraAudioControl.pause();
    $("#buttonConditions" + _index).text(this.pageManager.getLocalizer().getFragment(this.language, 'playButton'));
  } else if (label == this.pageManager.getLocalizer().getFragment(this.language, 'playButton')) {
    $(".audioControlElement").text(this.pageManager.getLocalizer().getFragment(this.language, 'playButton'));
    this.mushraAudioControl.playCondition(_index);
    $("#buttonConditions" + _index).text(this.pageManager.getLocalizer().getFragment(this.language, 'pauseButton'));
  }
};

MultiMetricMushraPage.prototype.renderCanvas = function(_parentId) {
	$('#mushra_canvas').remove(); 
  parent = $('#' + _parentId);
  var canvas = document.createElement("canvas");
  canvas.style.position = "absolute";
  canvas.style.left = 0;
  canvas.style.top = 0;
  canvas.style.zIndex = 0;
  canvas.setAttribute("id","mushra_canvas");
  parent.get(0).appendChild(canvas);
  $('#mushra_canvas').offset({top: $('#refCanvas').offset().top, left : $('#refCanvas').offset().left});
  canvas.height = parent.get(0).offsetHeight - (parent.get(0).offsetHeight - $('#tr_ConditionRatings').height());
  canvas.width = parent.get(0).offsetWidth;

  $(".scales").siblings().css("zIndex", "1");
  $(".scales").slider("disable");

  var canvasContext = canvas.getContext('2d');

  var YfreeCanvasSpace = $(".scales").prev().offset().top - $(".scales").parent().offset().top;
  var YfirstLine = $(".scales").parent().get(0).offsetTop + parseInt($(".scales").css("borderTopWidth"), 10) + YfreeCanvasSpace;
  var prevScalesHeight = $(".scales").prev().height();
  var xDrawingStart = $('#spaceForScale').offset().left - $('#spaceForScale').parent().offset().left + canvasContext.measureText("100 ").width * 1.5;
  var xAbsTableOffset = -$('#mushra_items').offset().left - ($('#mushra_canvas').offset().left - $('#mushra_items').offset().left);
  var xDrawingBeforeScales = $('.scales').first().prev().children().eq(0).offset().left + xAbsTableOffset;

  var sliders = $(".scales");
  var lastSlider = sliders[0];
  for (i = sliders.length - 1; i >= 0; i--) {
    if (sliders[i].style.display !== "none") {
      lastSlider = sliders[i];
      break;
    }
  }
  var xDrawingEnd = $(lastSlider).offset().left - $('#mushra_items').offset().left + $('.scales').last().width()/2;

  canvasContext.beginPath();
  canvasContext.moveTo(xDrawingStart, YfirstLine);
  canvasContext.lineTo(xDrawingEnd, YfirstLine);
  canvasContext.stroke();

  var scaleSegments = [0.2, 0.4, 0.6, 0.8];
  var i;
  for (i = 0; i < scaleSegments.length; ++i) {
    canvasContext.beginPath();
    canvasContext.moveTo(xDrawingStart, prevScalesHeight * scaleSegments[i] +  YfirstLine);
    canvasContext.lineTo(xDrawingBeforeScales, prevScalesHeight * scaleSegments[i] +  YfirstLine);
    canvasContext.stroke();

    var predecessorXEnd = null;
    $('.scales').each(function( index ) {
      var sliderElement = $(this).prev().first();
      if (this.style.display === "none") {
        $(this).parent().hide();
      } else {
        $(this).parent().show();
        if (index > 0) {
          canvasContext.beginPath();
          canvasContext.moveTo(predecessorXEnd, prevScalesHeight * scaleSegments[i] +  YfirstLine);
          canvasContext.lineTo(sliderElement.offset().left + xAbsTableOffset, prevScalesHeight * scaleSegments[i] +  YfirstLine);
          canvasContext.stroke();
        }
        predecessorXEnd = sliderElement.offset().left + sliderElement.width() + xAbsTableOffset + 1;
      }
    });
  }


  canvasContext.beginPath();
  canvasContext.moveTo(xDrawingStart, prevScalesHeight +  YfirstLine);
  canvasContext.lineTo(xDrawingEnd, prevScalesHeight + YfirstLine);
  canvasContext.stroke();

  canvasContext.font = "1.25em Calibri";
  canvasContext.textBaseline = "middle";
  canvasContext.textAlign = "center";
  var xLetters = $("#refCanvas").width() + ($("#spaceForScale").width() + canvasContext.measureText("1 ").width) / 2.0;

  this.responseYPos[0] = prevScalesHeight * 0.1 + YfirstLine;
  this.responseYPos[1] = prevScalesHeight * 0.3 + YfirstLine;
  this.responseYPos[2] = prevScalesHeight * 0.5 + YfirstLine;
  this.responseYPos[3] = prevScalesHeight * 0.7 + YfirstLine;
  this.responseYPos[4] = prevScalesHeight * 0.9 + YfirstLine;
  for (var i = 0; i < this.responses[this.metrics[0]].length; i++) {
    canvasContext.fillText(this.responses[this.metrics[0]][i], xLetters, this.responseYPos[i]);
  }

  canvasContext.font = "1em Calibri";
  canvasContext.textAlign = "right";
  var xTextScoreRanges =  xDrawingStart - canvasContext.measureText("100 ").width * 0.25; // $("#refCanvas").width()
  canvasContext.fillText("100", xTextScoreRanges, YfirstLine);
  canvasContext.fillText("80", xTextScoreRanges, prevScalesHeight * 0.2 + YfirstLine);
  canvasContext.fillText("60", xTextScoreRanges, prevScalesHeight * 0.4 + YfirstLine);
  canvasContext.fillText("40", xTextScoreRanges, prevScalesHeight * 0.6 + YfirstLine);
  canvasContext.fillText("20", xTextScoreRanges, prevScalesHeight * 0.8 + YfirstLine);
  canvasContext.fillText("0", xTextScoreRanges, prevScalesHeight + YfirstLine);

};


MultiMetricMushraPage.prototype.load = function () {
  // Replace the page number in the page title with the correct one,
  // because the page order might be randomized
  this.startTimeOnPage = new Date();
	$("#page_header")[0].textContent = $("#page_header")[0].textContent.replace(
    /\((\d+)\/(\d+)\)/, "(" + this.pageCount + "/$2)"
  );

  if (this.isFirstLoad && (this.pageConfig.mustPlayAll == true || this.mustViewAllTabs == true)) {
  	this.pageTemplateRenderer.lockNextButton();
  }
	
  this.renderCanvas('mushra_items');
  this.metricColors["__inactive_color__"] = $(".tablinks")[0].style.backgroundColor;
  $(".tablinks")[0].click();
 
 
  this.mushraAudioControl.initAudio();
 
  if (this.ratings.length !== 0) {
    var scales = $(".scales");
    var i;
    for (i = 0; i  < scales.length; ++i) {
      $(".scales").eq(i).val(this.ratings[i].value).slider("refresh");
    }
  }
  if (this.loop.start !== null && this.loop.end !== null) {
    this.mushraAudioControl.setLoop(0, 0, this.mushraAudioControl.getDuration(), this.mushraAudioControl.getDuration() /this.waveformVisualizer.stimulus.audioBuffer.sampleRate);
    this.mushraAudioControl.setPosition(0);
  }

  Mousetrap.bind(['/'], this.popupShortcuts.bind(this));
};

MultiMetricMushraPage.prototype.save = function () {
  this.isFirstLoad = false;
  this.macic.unbind(); 
  this.time += 	(new Date() - this.startTimeOnPage);
  this.mushraAudioControl.freeAudio();
  this.mushraAudioControl.removeEventListener(this.waveformVisualizer.numberEventListener);  
  var scales = $(".scales");
  this.ratings = [];
  var i;
  for (i = 0; i  < scales.length; ++i) {
    this.ratings[i] = {name: scales[i].name, value: scales[i].value};
  }
  
  this.loop.start = parseInt(this.waveformVisualizer.mushraAudioControl.audioLoopStart);
  this.loop.end = parseInt(this.waveformVisualizer.mushraAudioControl.audioLoopEnd);
};

MultiMetricMushraPage.prototype.store = function () {
  this.isFirstLoad = false;
	
  var trial = new Trial();
  trial.type = this.pageConfig.type;
  trial.id = this.pageConfig.id;
  var i;
  for (i = 0; i  < this.ratings.length; ++i) {
    var rating = this.ratings[i];
    var ratingObj = new MUSHRARating();
    ratingObj.stimulus = rating.name;
    ratingObj.score = rating.value;
    ratingObj.time = this.time;
    trial.responses[trial.responses.length] = ratingObj;
  }
  this.session.trials[this.session.trials.length] = trial;
};


MultiMetricMushraPage.prototype.switchTab = function (event) {
  var metricName = event.target.textContent;
  var active_color = this.metricColors[metricName];
  var inactive_color = this.metricColors["__inactive_color__"];
  var i, tabcontent;
  var tablinks = $(".tablinks");
  for (i = 0; i < tablinks.length; i++) {
    if (tablinks[i].textContent === metricName) {
      $(tablinks[i]).addClass("active");
      this.isViewed[i] = true;
      tablinks[i].style.backgroundColor = active_color;
    } else {
      $(tablinks[i]).removeClass("active");
      tablinks[i].style.backgroundColor = inactive_color;
    }
  }

  tabcontent = $(".tabcontent");
  for (i = 0; i < tabcontent.length; i++) {
    if (tabcontent[i].id === metricName) {
      tabcontent[i].style.display = "block";
    } else {
      tabcontent[i].style.display = "none";
    }
  }

  sliders = $(".scales");
  for (i = 0; i < sliders.length; i++) {
    if (sliders[i].getAttribute("name").startsWith(metricName) === true) {
      sliders[i].style.display = "inline-block";
      $(sliders[i]).parent().find(".ui-slider-bg")[0].style.backgroundColor = active_color;
      $(sliders[i]).parent().show();
      // $(sliders[i]).slider("enable");
    } else {
      sliders[i].style.display = "none";
      $(sliders[i]).parent().hide();
      // $(sliders[i]).slider("disable");
    }
  }

  // Changing rating text on canvas
  var canvasContext = $("#mushra_canvas")[0].getContext('2d');
  var YfreeCanvasSpace = $(".scales").prev().offset().top - $(".scales").parent().offset().top;
  var YfirstLine = $(".scales").parent().get(0).offsetTop + parseInt($(".scales").css("borderTopWidth"), 10) + YfreeCanvasSpace;
  var prevScalesHeight = $(".scales").prev().height();
  var xDrawingStart = $('#spaceForScale').offset().left - $('#spaceForScale').parent().offset().left + canvasContext.measureText("100 ").width * 1.5;
  canvasContext.moveTo(xDrawingStart, prevScalesHeight +  YfirstLine);
  canvasContext.font = "1.25em Calibri";
  canvasContext.textBaseline = "middle";
  canvasContext.textAlign = "center";
  var xLetters = $("#refCanvas").width() + ($("#spaceForScale").width() + canvasContext.measureText("1 ").width) / 2.0;

  var measureText, height;
  for (var i = 0; i < this.responses[this.lastMetric].length; i++) {
    measureText = canvasContext.measureText(this.responses[this.lastMetric][i]);
    height = measureText.fontBoundingBoxAscent + measureText.fontBoundingBoxDescent;
    // clear previously rendered response text
    canvasContext.clearRect(xLetters - measureText.width / 2.0, this.responseYPos[i] - height / 2.0, measureText.width, height);
    // re-render the response text
    canvasContext.fillText(this.responses[metricName][i], xLetters, this.responseYPos[i]);
  }
  this.lastMetric = metricName;
  

  // For unlocking the Next button
  if (this.allTabsViewed == false) {
    var allTabsViewed = true;
    for (i = 0; i < tablinks.length; i++) {
      if (this.isViewed[i] == false) {
        allTabsViewed = false;
        break;
      }
    }
    if (allTabsViewed == true) {
      this.allTabsViewed = true;
      if (this.isAllPlayed == true) {
        this.pageTemplateRenderer.unlockNextButton();
      }
    }
  }
}


MultiMetricMushraPage.prototype.popupShortcuts = function () {
  if ($("#shortcutsPopupCard-popup").hasClass("ui-popup-active")) {
    $("#shortcutsPopupCard").popup("close");
    $("#shortcutsPopupCard").addClass("ui-disabled");
  } else {
    $("#shortcutsPopupCard").popup("open");
    $("#shortcutsPopupCard").removeClass("ui-disabled");
    
    $("#shortcutsPopHeader").text(this.pageManager.getLocalizer().getFragment(this.language, 'shortcutPopupTitle'));
    $("#popupShortcuts").empty();

    var table = $("<table align='center' style='border-spacing: 50px 0;'> </table>");
    var trHeader = document.createElement("tr");
    $(table).append(trHeader);
    $(trHeader).append($("<th style='text-align: left'>" + this.pageManager.getLocalizer().getFragment(this.language, 'shortcutPopupHeader') + "</th>"));
    $(trHeader).append($("<th style='text-align: left'>" + this.pageManager.getLocalizer().getFragment(this.language, 'shortcutPopupHeaderDoc') + "</th>"));
    // Empty row
    $(table).append($("<tr height='16px'></tr>"));
    
    var tabs = $(".tablinks");
    var prevMetricIndex = 0;
    var nextMetricIndex = 1;
    for (var idx = 0; idx < tabs.length; idx++) {
      if ($(tabs[idx]).hasClass("active")) {
        prevMetricIndex = (idx - 1) - tabs.length * Math.floor((idx - 1)/tabs.length);
        nextMetricIndex = (idx + 1) - tabs.length * Math.floor((idx + 1)/tabs.length);
        break;
      }
    }

    var trT;
    var shortcuts = [
      "shortcut_Num_Key",
      "shortcut_r_0_Key",
      "shortcut_Space_Key",
      "shortcut_Enter_Key",
      "shortcut_Backspace_Key",
      "shortcut_h_Key",
      "shortcut_l_Key",
      "shortcut_[_Key",
      "shortcut_]_Key",
      "shortcut_up_j_Key",
      "shortcut_shift+up_shift+j_Key",
      "shortcut_down_k_Key",
      "shortcut_shift+down_shift+k_Key",
      "shortcut_a_A_Key",
      "shortcut_b_B_Key",
    ];
    for (var i = 0; i < shortcuts.length; i++) {
      trT = document.createElement("tr");        
      $(trT).append($("<td style='text-align: left; font-family: Menlo; color: blue;'>" + this.pageManager.getLocalizer().getFragment(this.language, shortcuts[i]) + "</td>"));
      if (shortcuts[i] === "shortcut_[_Key") {
        $(trT).append($("<td style='text-align: left'>" + this.pageManager.getLocalizer().getFragment(this.language, shortcuts[i] + "Doc") + " (" + tabs[prevMetricIndex].textContent + ")</td>"));
      } else if (shortcuts[i] === "shortcut_]_Key") {
        $(trT).append($("<td style='text-align: left'>" + this.pageManager.getLocalizer().getFragment(this.language, shortcuts[i] + "Doc") + " (" + tabs[nextMetricIndex].textContent + ")</td>"));
      } else { 
        $(trT).append($("<td style='text-align: left'>" + this.pageManager.getLocalizer().getFragment(this.language, shortcuts[i] + "Doc") + "</td>"));
      }
      $(table).append(trT);
      // Empty row
      $(table).append($("<tr height='8px'></tr>"));
    }

    $("#popupShortcuts").append(table);
  }
}
