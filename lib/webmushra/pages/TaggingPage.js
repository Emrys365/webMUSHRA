function TaggingPage(_pageManager, _pageTemplateRenderer, _audioContext, _bufferSize, _audioFileLoader, _session, _tagDataSender, _pageConfig, _mushraValidator, _errorHandler, _language, _pageCount) {
  this.pageManager = _pageManager;
  this.pageTemplateRenderer = _pageTemplateRenderer;
  this.audioContext = _audioContext;
  this.bufferSize = _bufferSize;
  this.audioFileLoader = _audioFileLoader;
  this.session = _session;
  this.tagDataSender = _tagDataSender;
  this.pageConfig = _pageConfig;
  this.mushraValidator = _mushraValidator;
  this.errorHandler = _errorHandler;
  this.language = _language;
  this.tagAudioControl = null;
  this.div = null;
  this.waveformSpecVisualizer = null;
  this.tacic = null;
  this.pageCount = _pageCount;

  this.tagDataIO = new TagDataIO(this.pageConfig.remoteService);
  if (this.pageConfig.showMetaInfo || false) this.metaInfo = [];

  this.labelCache = this.pageConfig.labelCache || false;
  this.isFirstRender = true;  // the label cache is only loaded for the first time

  this.tags = this.pageConfig.tags;
  this.validTags = new Set();
  for (var i = 0; i < this.tags.length; ++i) {
    for (var j = 0; j < this.tags[i].names.length; ++j) {
      this.validTags.add(this.tags[i].names[j]);
    }
  }
  this.labels = {};

  this.audios = [];
  this.loadAudiosFromTsv(this.pageConfig.audioList);

  this.normalizeVolume = this.pageConfig.normalizeVolume || false;
  this.shuffleAudio = this.pageConfig.shuffleAudio || false;
  if (this.shuffleAudio !== false) { // default is true
    shuffle(this.audios);
  }

  this.lastIndex = this.audios.length - 1;
  this.currentIndex = 0;
  this.lastShownSpectrogramIndex = 0;
  this.lastShownSpectrogramRange = null;
  this.audioFileLoader.addFile(
    this.audios[this.currentIndex].getFilepath(),
    (function (_buffer, _stimulus) { _stimulus.setAudioBuffer(_buffer); }),
    this.audios[this.currentIndex],
    (function (_buffer, _stimulus) { _stimulus.setOrigAudioBuffer(_buffer); }),
    this.audios[this.currentIndex]
  );

  // If mustViewAllAudios === true, unlock the [Next] button until all audios are viewed
  this.allAudiosViewed = ! (this.pageConfig.mustViewAllAudios || false);
  this.isViewed = [];
  this.time = [];
  for (var i = 0; i < this.audios.length; ++i) {
    this.isViewed[this.isViewed.length] = this.allAudiosViewed;
    this.time[this.time.length] = 0;
  }

  // data
  this.ratings = [];
  this.loop = {start: null, end: null};
  this.slider = {start: null, end: null};
  this.startTimeOnPage = null;
  this.disableShortcuts = false;
}

TaggingPage.prototype.getName = function () {
  return this.pageConfig.name;
};

TaggingPage.prototype.loadAudiosFromTsv = function (_file) {
  var data = this.tagDataIO.readTsv(_file);
  if (data == null) {
    this.showError("Invalid TSV file format.");
    return;
  }
  var header = data["header"], data = data["data"];
  if (header == null || data == null || header.length !== data[0].length) {
    this.showError("Invalid TSV file content.");
    return;
  }
  const uidIndex = header.indexOf("UID"), pathIndex = header.indexOf("Audio_path");
  if (uidIndex == -1 || pathIndex == -1) {
    this.showError("Invalid TSV file header. Expected to contain 'UID' and 'Audio_path', but got " + header.join("\t"));
    return;
  }
  for (var i = 0; i < data.length; i++) {
    const uid = data[i][uidIndex], path = data[i][pathIndex];
    this.audios[this.audios.length] = new Stimulus(uid, path);

    if ((this.pageConfig.showMetaInfo || false) && header.length > 2) {
      const info = {};
      for (var j = 0; j < header.length; ++j) {
        if (j !== uidIndex && j !== pathIndex) info[header[j]] = data[i][j];
      }
      this.metaInfo[this.metaInfo.length] = info;
    }
  }
  console.log("Audios loaded from TSV file: " + _file);
};

TaggingPage.prototype.init = function () {
  this.mushraValidator.checkNumChannels(this.audioContext, this.audios[this.currentIndex]);
  this.mushraValidator.checkSamplerate(this.audioContext.sampleRate, this.audios[this.currentIndex]);

  this.tagAudioControl = new TagAudioControl(this.audioContext, this.bufferSize, this.audios[this.currentIndex], this.errorHandler, this.normalizeVolume, this.pageConfig.autoLooping);
  this.tagAudioControl.addEventListener((function (_event) {
    if (_event.name == 'stopTriggered') {
      $("#buttonAudio").text(this.pageManager.getLocalizer().getFragment(this.language, 'playButton'));

      if($('#buttonAudio').attr("active") == "true") {
        $.mobile.activePage.find('#buttonAudio')  // remove color
          .removeClass('ui-btn-b')
          .addClass('ui-btn-a').attr('data-theme', 'a');
        $('#buttonAudio').attr("active", "false");
      }

      $.mobile.activePage.find('#buttonStop')    //add color to stop
        .removeClass('ui-btn-a')
        .addClass('ui-btn-b').attr('data-theme', 'b');
      $.mobile.activePage.find('#buttonStop').focus();
      $('#buttonStop').attr("active", "true");

    } else if (_event.name == 'playAudioTriggered') {
      if($('#buttonStop').attr("active") == "true") {
        $.mobile.activePage.find('#buttonStop')  //remove color from Stop
          .removeClass('ui-btn-b')
          .addClass('ui-btn-a').attr('data-theme', 'a');
        $('#buttonStop').attr("active", "false");
      }

      $.mobile.activePage.find('#buttonAudio')		//add color to reference
        .removeClass('ui-btn-a')
        .addClass('ui-btn-b').attr('data-theme', 'b');
      $.mobile.activePage.find('#buttonAudio').focus();
      $('#buttonAudio').attr("active", "true");
    }

  }).bind(this));

};

TaggingPage.prototype.render = function (_parent) {
  if (this.isFirstRender === true) {
    this.loadLabelCache(true);
  }
  this.isFirstRender = false;

  var div = $("<div></div>");
  _parent.append(div);

  var tabs = $("<div class='tab'></div>");
  div.append(tabs);

  var prevTab = $("<div class='tabNavigation' id='tabPrev' title='Previous Audio'>&lt;</div>");
  prevTab[0].onclick = this.prevAudio.bind(this);
  tabs.append(prevTab);

  var tabIndicator = $("<div id='div_tab_navigation'><input type='number' name='name' id='input_tab_navigation' class='input_tab_navigation' data-inline='true' data-mini='true' min='1' step='1' max='" + this.audios.length + "'></input></div>");
  tabs.append(tabIndicator);
  $("#input_tab_navigation").val(this.currentIndex + 1);
  $("#input_tab_navigation").focus(function() { $(this).select(); });
  $("#input_tab_navigation").focusin(function() { $(this).select(); });
  $("#input_tab_navigation").on('keypress', (function (_event) {
    if (_event.key === "Enter") {
      $("#input_tab_navigation").attr("disabled", "disabled");
      _event.preventDefault();  // Cancel the default action, if needed
      var index = parseInt($("#input_tab_navigation").val());
      if (index < 1 || index > this.audios.length || isNaN(index) || index == Infinity) {
        this.showToast("Input index must be an integer between 1 and " + this.audios.length + ", but got " + index, null, false, "./design/images/warning.svg");
        $("#input_tab_navigation").val(this.currentIndex + 1);
      } else {
        this.jumpTo(index - 1);
      }
      $("#input_tab_navigation").removeAttr("disabled");
    }
  }).bind(this));

  var nextTab = $("<div class='tabNavigation' id='tabNext' title='Next Audio'>&gt;</div>");
  nextTab[0].onclick = this.nextAudio.bind(this);
  tabs.append(nextTab);

  // Bind keys '[' and ']' for navigating between tabs
  Mousetrap.bind(['[', '【'], function() {
    if (this.disableShortcuts === true) return false;
    if ($("#tabPrev").hasClass("ui-disabled") || $("#tabPrev").hasClass("noClick")) return false;
    $("#tabPrev").click();
    $("#tabPrev").addClass("noClick");
    setTimeout(function() { $("#tabPrev").removeClass("noClick"); }, 1000);
    return false;
  });
  Mousetrap.bind([']', '】'], function() {
    if (this.disableShortcuts === true) return false;
    if ($("#tabNext").hasClass("ui-disabled") || $("#tabNext").hasClass("noClick")) return false;
    $("#tabNext").click();
    $("#tabNext").addClass("noClick");
    setTimeout(function() { $("#tabNext").removeClass("noClick"); }, 1000);
    return false;
  });
  if (this.currentIndex == 0) {
    $("#tabPrev").addClass("ui-disabled");
  } else if (this.currentIndex == this.lastIndex) {
    $("#tabNext").addClass("ui-disabled");
  }

  if (this.pageConfig.showMetaInfo || false) {
    var noteParent = $("<div style='display:inline-flex; overflow-x: auto; height: 50px'></div>");
    var note = $("<p id='pageMetaHeader' style='font-weight: bold;'>" + this.audios[this.currentIndex].id + "</p>");
    noteParent.append(note);
    div.append(noteParent);
  } else {
    var note = $("<div style='display:inline-flex; overflow-x: auto; height: 50px;'><p><font color='gray'>(" + this.pageManager.getLocalizer().getFragment(this.language, 'shortcutCheatsheet') + ")</font></p></div>");
    div.append(note);
  }

  var pageSettingBtn = $("<div class='pageSettingButton' title='Page Settings'><img draggable='false' (dragstart)='false;' class='unselectable shadow' src='./design/images/settings.svg' border='0'></img></div>");
  pageSettingBtn.on("click", (function () {
    this.page.popupSettings();
  }).bind({ page : this }));
  div.append(pageSettingBtn);

  if (this.pageConfig.localMode === true && this.pageConfig.localRootPath !== null) {
    var vscodeBtn = $("<div class='pageSettingButton' title='Open audio in Visual Studio Code'><img draggable='false' (dragstart)='false;' class='unselectable shadow' src='./design/images/vscode.svg' border='0'></img></div>");
    vscodeBtn.on("click", (function (e) {
      e.preventDefault();
      const path = this.pageConfig.localRootPath + "/" + this.audios[this.currentIndex].getFilepath();
      window.open("vscode://file/" + path);
    }).bind(this));
    div.append(vscodeBtn);
  }

  var content;
  if(this.pageConfig.content === null){
	  content ="";
  } else {
	  content = this.pageConfig.content;
  }
  var p = $("<div class='tabcontent' style='display: block'><p>" + content + "</p></div>");
  div.append(p);

  var tableUp = $("<table id='mainUp'></table>");
  var tableDown = $("<table id='mainDown' align = 'center'></table>");
  div.append(tableUp);
  div.append(tableDown);

  if ((this.pageConfig.showMetaInfo || false) && this.metaInfo.length > 0) {
    var trMeta = $("<tr></tr>");
    tableUp.append(trMeta);
    var tdMeta = $("<td colspan='2'></td>");
    trMeta.append(tdMeta);

    var tableMeta = this.renderMetaInfo();
    tdMeta.append(tableMeta);
  }

  var trLoop = $("<tr id='trWs'></tr>");
  tableUp.append(trLoop);

  // Play/Pause and Stop buttons on the left side
  var tdLoop1 = $(" \
    <td class='stopButton'> \
      <button data-role='button' data-inline='true' id='buttonStop' onclick='"+ this.pageManager.getPageVariableName(this) + ".tagAudioControl.stop();'>" + this.pageManager.getLocalizer().getFragment(this.language, 'stopButton') + "</button> \
      <button data-theme='a' id='buttonAudio' data-role='button' class='audioControlElement' onclick='" + this.pageManager.getPageVariableName(this) + ".btnCallback()' style='margin : 0 auto;'>" + this.pageManager.getLocalizer().getFragment(this.language, 'playButton') + "</button> \
    </td> \
  ");
  trLoop.append(tdLoop1);

  // Audio and spectrogram on the right side
  var tdRight = $("<td></td>");
  trLoop.append(tdRight);


  var trTagging = $("<tr></tr>");
  tableDown.append(trTagging);
  var tdTagging = $("<td id='td_Tagging' colspan='2'></td>");
  trTagging.append(tdTagging);

  var tableTagging = this.renderTags();
  tdTagging.append(tableTagging);

  this.tacic = new TagAudioControlInputController(this.tagAudioControl, this.pageConfig.enableLooping);
  this.tacic.bind();

  this.waveformSpecVisualizer = new WaveformSpecVisualizer(this.pageManager.getPageVariableName(this) + ".waveformSpecVisualizer", tdRight, this.audios[this.currentIndex], this.pageConfig.showWaveform, this.pageConfig.showSpectrogram, this.pageConfig.showCursor, this.pageConfig.staticWaveform, this.pageConfig.waveformColors, this.pageConfig.spectrogramOptions, this.pageConfig.enableLooping, this.tagAudioControl);
  this.waveformSpecVisualizer.create();
  this.waveformSpecVisualizer.load();

  $.mobile.activePage.find('#buttonAudio').focus();
  this.checkButtonLockStatus();
};

TaggingPage.prototype.renderMetaInfo = function () {
  var tableMeta;
  if ($("#tagging_items").length > 0) {
    tableMeta = $("#metaInfoTable");
    tableMeta.empty();
  } else {
    tableMeta = $("<table id='metaInfoTable' class='ghTable' align='center' style='overflow-x: auto;'></table>");
  }
  var trMetaHeader = $("<tr></tr>");
  tableMeta.append(trMetaHeader);
  var trMetaValue = $("<tr></tr>");
  tableMeta.append(trMetaValue);
  for (var name in this.metaInfo[this.currentIndex]) {
    var tdMeta = $("<th><span class='metaHeader'>" + name + "</span></th>");
    trMetaHeader.append(tdMeta);
    var tdMetaInfo = $("<td><span class='metaInfo'>" + escapeHtml(this.metaInfo[this.currentIndex][name]) + "</span></td>");
    trMetaValue.append(tdMetaInfo);
  }
  return tableMeta;
};

TaggingPage.prototype.renderTags = function () {
  const uid = this.audios[this.currentIndex].id;
  var tableTagging;
  if ($("#tagging_items").length > 0) {
    tableTagging = $("#tagging_items");
    tableTagging.empty();
  } else {
    tableTagging = $("<table id='tagging_items' style='overflow-x: auto;'></table>");
  }

  for (var i = 0; i < this.tags.length; i++) {
    var trTag = $("<tr></tr>");
    tableTagging.append(trTag);

    var tdHeader = $("<td><span class='tagHeader'>" + this.tags[i].group + "</span></td>");
    trTag.append(tdHeader);

    for (var j = 0; j < this.tags[i].names.length; j++) {
      const name = this.tags[i].names[j];
      const btnID = "tag-button-" + i + "_" + j;
      var tdTagBtn = $("<td><button class='tag-button ui-btn ui-shadow ui-corner-all' id='" + btnID + "' title='" + this.tags[i].descriptions[j] + "'>" + name + "</button></td>");
      tdTagBtn.on("click", ".tag-button", (function () {
        var element = $("#" + this.btnID);
        element.toggleClass("active");  // toggle active status
        // set background and font colors
        if (element.hasClass("active")) {
          element.css("background-color", this.color);
          this.page.updateLabel(this.uid);
        } else {
          element.removeAttr("style");
          this.page.updateLabel(this.uid);
        }
      }).bind({
        btnID: btnID,
        page : this,
        color : this.tags[i].colors[j],
        uid: uid
      }));
      if (this.labels[uid] != null && this.labels[uid].has(name)) {
        tdTagBtn.children().addClass("active");
        tdTagBtn.children().css("background-color", this.tags[i].colors[j]);
      }
      trTag.append(tdTagBtn);
    }
  }
  return tableTagging;
};

TaggingPage.prototype.updateLabel = function (_uid) {
  const labels = this.labels[_uid] ?? new Set();
  var tagButtons = $("#tagging_items").find(".tag-button");
  for (var i = 0; i < tagButtons.length; i++) {
    if (tagButtons.eq(i).hasClass("active")) {
      labels.add(tagButtons.eq(i).text());
    } else {
      labels.delete(tagButtons.eq(i).text());
    }
  }
  this.labels[_uid] = labels;
  if (labels.size > 0) {
    this.isViewed[this.currentIndex] = true;
  } else {
    this.isViewed[this.currentIndex] = false;
  }

  this.checkButtonLockStatus();
};

TaggingPage.prototype.checkButtonLockStatus = function () {
  // For unlocking the Next button
  if (this.allAudiosViewed == false) {
    var allAudiosViewed = true;
    for (i = 0; i < this.isViewed.length; i++) {
      if (this.isViewed[i] == false) {
        allAudiosViewed = false;
        break;
      }
    }
    if (allAudiosViewed == true) {
      this.allAudiosViewed = true;
      this.pageTemplateRenderer.unlockNextButton();
    }
  }
};

TaggingPage.prototype.prevAudio = function (event) {
  if (this.currentIndex > 0) this.jumpTo(this.currentIndex - 1);
};

TaggingPage.prototype.nextAudio = function (event) {
  if (this.currentIndex < this.lastIndex) this.jumpTo(this.currentIndex + 1);
};

TaggingPage.prototype.jumpTo = function (_index) {
  if (_index < 0 || _index > this.lastIndex) return;
  if (_index == this.currentIndex) {
    $("#input_tab_navigation").val(this.currentIndex + 1);
    return;
  }

  this.tagAudioControl.stop();
  this.time[this.currentIndex] += (new Date() - this.startTimeOnPage);
  if (this.labelCache === true && this.labels[this.audios[this.currentIndex].id] !== undefined && this.labels[this.audios[this.currentIndex].id].size > 0) {
    this.saveLabelCache(this.audios[this.currentIndex].id);
  }
  this.currentIndex = _index;
  $("#page_header")[0].textContent = $("#page_header")[0].textContent.replace(
    /\((\d+)\/(\d+)\)/, "(" + (this.currentIndex + 1) + "/" + this.audios.length + ")"
  );
  this.loadAudioFiles(this.currentIndex);
  $("#input_tab_navigation").val(this.currentIndex + 1);

  if (this.currentIndex == 0) {
    $("#tabPrev").addClass("ui-disabled");
  } else {
    $("#tabPrev").removeClass("ui-disabled");
  }
  if (this.currentIndex == this.lastIndex) {
    $("#tabNext").addClass("ui-disabled");
  } else {
    $("#tabNext").removeClass("ui-disabled");
  }
};

TaggingPage.prototype.pause = function() {
    this.tagAudioControl.pause();
};

TaggingPage.prototype.setLoopStart = function() {
  var slider = document.getElementById('slider');
  var startSliderSamples = this.tagAudioControl.audioCurrentPosition;

  var endSliderSamples = parseFloat(slider.noUiSlider.get()[1]);

  this.tagAudioControl.setLoop(startSliderSamples, endSliderSamples);
};

TaggingPage.prototype.setLoopEnd = function() {
  var slider = document.getElementById('slider');
  var startSliderSamples = parseFloat(slider.noUiSlider.get()[0]);

  var endSliderSamples = this.tagAudioControl.audioCurrentPosition;

  this.tagAudioControl.setLoop(startSliderSamples, endSliderSamples);
};

TaggingPage.prototype.btnCallback = function() {
  var label = $("#buttonAudio").text();
  if (label == this.pageManager.getLocalizer().getFragment(this.language, 'pauseButton')) {
    this.tagAudioControl.pause();
    $("#buttonAudio").text(this.pageManager.getLocalizer().getFragment(this.language, 'playButton'));
  } else if (label == this.pageManager.getLocalizer().getFragment(this.language, 'playButton')) {
    $(".audioControlElement").text(this.pageManager.getLocalizer().getFragment(this.language, 'playButton'));
    this.tagAudioControl.playAudio();
    $("#buttonAudio").text(this.pageManager.getLocalizer().getFragment(this.language, 'pauseButton'));
  }
};


function showLoading() {
  for (var i = 0; i < $("body").children().length; i++) {
    if ($("body").children().eq(i).attr('id') != "popupErrors" && $("body").children().eq(i).attr('id') != "popupDialog") {
      $("body").children().eq(i).addClass('ui-disabled');
    }
  }
  $.mobile.loading("show", {
    text : "Loading...",
    textVisible : true,
    theme : "a",
    html : ""
  });
}

function hideLoading() {
  $.mobile.loading("hide");
  for (var i = 0; i < $("body").children().length; i++) {
    $("body").children().eq(i).removeClass('ui-disabled');
  }
}


function callbackAudioFilesLoaded() {
  if (!this.errorHandler.errorOccurred()) {
    this.audioFilesLoaded = true;
    hideLoading();

    this.tagAudioControl.updateAudio(this.audios[this.currentIndex]);

    this.waveformSpecVisualizer.updateAudio(this.audios[this.currentIndex]);
    this.renderTags();
    this.startTimeOnPage = new Date();
    if (this.pageConfig.showMetaInfo || false) {
      $("#pageMetaHeader")[0].textContent = this.audios[this.currentIndex].id;
      this.renderMetaInfo();
    }
  } else {
    var errors = this.errorHandler.getErrors();
    var ul = $("<ul style='text-align:left;'></ul>");
    $('#popupErrorsContent').append(ul);
    for (var i = 0; i < errors.length; ++i) {
      ul.append($('<li>' + errors[i] + '</li>'));
    }
    $("#popupErrors").popup("open");
    $.mobile.loading("hide");
  }
};


TaggingPage.prototype.loadAudioFiles = function (_index) {
  this.audioFilesLoaded = false;
  var interval = setInterval((function() {
    showLoading();
    clearInterval(interval);
  }).bind(this), 1);
  this.audioFileLoader.loadAudioFiles(
    [this.audios[_index].getFilepath()],
    (function (_buffer, _stimulus) { _stimulus.setAudioBuffer(_buffer); }),
    this.audios[_index],
    (function (_buffer, _stimulus) { _stimulus.setOrigAudioBuffer(_buffer); }),
    this.audios[_index],
    callbackAudioFilesLoaded.bind(this)
  );
};


TaggingPage.prototype.load = function () {

  this.startTimeOnPage = new Date();

  // Replace the page number in the page title with the correct one,
  // because the page order might be randomized
	$("#page_header")[0].textContent = $("#page_header")[0].textContent.replace(
    /\((\d+)\/(\d+)\)/, "(" + (this.currentIndex + 1) + "/" + this.audios.length + ")"
  );

  if (this.allAudiosViewed == false) {
  	this.pageTemplateRenderer.lockNextButton();
  }


  this.tagAudioControl.initAudio();

  if (this.loop.start !== null && this.loop.end !== null) {
    this.tagAudioControl.setLoop(this.loop.start, this.loop.end);
    this.tagAudioControl.setPosition(this.loop.start);
  }

  Mousetrap.bind(['/'], (function() {
    if (this.disableShortcuts === true) return false;
    if ($("#settingsPopupCard-popup").hasClass("ui-popup-active")) {
      this.popupSettings();
      const interval = setInterval(() => {
        if ($("#shortcutsPopupCard-screen").hasClass("ui-screen-hidden")) {
          this.popupShortcuts();
        } else {
          clearInterval(interval);
        }
      }, 200);
    } else {
      this.popupShortcuts();
    }

  }).bind(this));
};

TaggingPage.prototype.popupShortcuts = function () {
  if ($("#shortcutsPopupCard-popup").hasClass("ui-popup-active")) {
    $("#shortcutsPopupCard").popup("close");
    $("#shortcutsPopupCard").addClass("ui-disabled");
  } else {
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

    var trT;
    var shortcuts = [
      "shortcut_p_Key",
      "shortcut_Space_Key",
      "shortcut_Backspace_Key",
      "shortcut_[_audio_Key",
      "shortcut_]_audio_Key",
    ];
    if (this.pageConfig.enableLooping) {
      shortcuts.push("shortcut_a_A_Key");
      shortcuts.push("shortcut_b_B_Key");
    }
    for (var i = 0; i < shortcuts.length; i++) {
      trT = document.createElement("tr");
      $(trT).append($("<td style='text-align: left; font-family: Menlo; color: blue;'>" + this.pageManager.getLocalizer().getFragment(this.language, shortcuts[i]) + "</td>"));
      $(trT).append($("<td style='text-align: left'>" + this.pageManager.getLocalizer().getFragment(this.language, shortcuts[i] + "Doc") + "</td>"));
      $(table).append(trT);
      // Empty row
      $(table).append($("<tr height='8px'></tr>"));
    }

    $("#popupShortcuts").append(table);
    $("#shortcutsPopupCard").popup("open");
  }
};

TaggingPage.prototype.popupSettings = function () {
  if ($("#settingsPopupCard-popup").hasClass("ui-popup-active")) {
    $("#settingsPopupCard").popup("close");
    $("#settingsPopupCard").addClass("ui-disabled");
  } else {
    $("#settingsPopupCard").removeClass("ui-disabled");

    $("#settingsPopHeader").text(this.pageManager.getLocalizer().getFragment(this.language, 'settingsPopupTitle'));
    $("#popupSettings").empty();

    var table = $("<table align='center' style='border-spacing: 50px 0;'> </table>");
    $(table).append($("<th colspan='2' height='16px'><i>Click buttons to trigger the corresponding functions.</i></th>"));
    $(table).append($("<tr height='16px'></tr>"));  // Empty row
    var trHeader = document.createElement("tr");
    $(table).append(trHeader);
    $(trHeader).append($("<th style='text-align: left'>" + this.pageManager.getLocalizer().getFragment(this.language, 'settingsPopupHeader') + "</th>"));
    $(trHeader).append($("<th style='text-align: left'>" + this.pageManager.getLocalizer().getFragment(this.language, 'settingsPopupHeaderDoc') + "</th>"));
    $(table).append($("<tr height='16px'></tr>"));  // Empty row

    var trT;
    var btn;
    var btnColumn;

    // For toggling the playback looping
    trT = document.createElement("tr");
    btn = $("<label class='switch'></label>");
    btn.append($("<input type='checkbox' id='settingsPopupBtnCheckboxAutoLoop' class='mousetrap'></input>"));
    btn.append($("<span class='switchSlider round'></span>"));
    btn.find("input").prop("checked", this.tagAudioControl.isLoopingActive());
    btn.find("input").on("change", (function () {
      if ($("#settingsPopupBtnCheckboxAutoLoop").prop("checked") === true) {
        $("#settingsPopupBtnToggleAutoLoop").text(this.page.pageManager.getLocalizer().getFragment(this.page.language, "settingsPopupBtnToggleAutoLoopOff"));
        this.page.tagAudioControl.setLoopingActive(true);
      } else {
        $("#settingsPopupBtnToggleAutoLoop").text(this.page.pageManager.getLocalizer().getFragment(this.page.language, "settingsPopupBtnToggleAutoLoopOn"));
        this.page.tagAudioControl.setLoopingActive(false);
      }
    }).bind({ page : this }));
    btnColumn = $("<td style='text-align: left; font-family: Menlo; color: blue;'></td>");
    btnColumn.append(btn);
    $(trT).append(btnColumn);
    $(trT).append($("<td id='settingsPopupBtnToggleAutoLoop' style='text-align: left'>" + this.pageManager.getLocalizer().getFragment(this.language, "settingsPopupBtnToggleAutoLoopOff") + "</td>"));
    $(table).append(trT);
    $(table).append($("<tr height='8px'></tr>"));  // Empty row

    // For toggling the spectrogram display
    if (this.pageConfig.showSpectrogram || false) {
      trT = document.createElement("tr");
      btn = $("<label class='switch'></label>");
      btn.append($("<input type='checkbox' id='settingsPopupBtnCheckboxSpectrum' class='mousetrap'></input>"));
      btn.append($("<span class='switchSlider round'></span>"));
      btn.find("input").prop("checked", this.waveformSpecVisualizer.showSpectrogram);
      btn.find("input").on("change", (function () {
        if ($("#settingsPopupBtnCheckboxSpectrum").prop("checked") === true) {
          $("#settingsPopupBtnToggleSpectrum").text(this.page.pageManager.getLocalizer().getFragment(this.page.language, "settingsPopupBtnToggleSpectrumOff"));
          this.page.waveformSpecVisualizer.showSpectrogram = true;
          $("#parentSpectrogram").show();
          const _cfg = this.page.waveformSpecVisualizer.drawSettings;
          _range = [_cfg.minTime, _cfg.maxTime, _cfg.minFrequency, _cfg.maxFrequency].join(",");
          if (this.lastShownSpectrogramRange === null) this.lastShownSpectrogramRange = _range.slice();
          if (this.page.lastShownSpectrogramIndex != this.page.currentIndex || this.page.lastShownSpectrogramRange !== _range) {
            this.page.lastShownSpectrogramIndex = this.page.currentIndex;
            this.page.waveformSpecVisualizer.updateCanvas(false);
            this.page.lastShownSpectrogramRange = _range;
          }
        } else {
          $("#settingsPopupBtnToggleSpectrum").text(this.page.pageManager.getLocalizer().getFragment(this.page.language, "settingsPopupBtnToggleSpectrumOn"));
          this.page.waveformSpecVisualizer.showSpectrogram = false;
          this.page.lastShownSpectrogramIndex = this.page.currentIndex;
          const _cfg = this.page.waveformSpecVisualizer.drawSettings;
          this.page.lastShownSpectrogramRange = [_cfg.minTime, _cfg.maxTime, _cfg.minFrequency, _cfg.maxFrequency].join(",");
          $("#parentSpectrogram").hide();
        }
      }).bind({ page : this }));
      btnColumn = $("<td style='text-align: left; font-family: Menlo; color: blue;'></td>");
      btnColumn.append(btn);
      $(trT).append(btnColumn);
      $(trT).append($("<td id='settingsPopupBtnToggleSpectrum' style='text-align: left'>" + this.pageManager.getLocalizer().getFragment(this.language, "settingsPopupBtnToggleSpectrumOff") + "</td>"));
      $(table).append(trT);
      $(table).append($("<tr height='8px'></tr>"));  // Empty row
    }

    // For toggling the Moustrap shortcuts
    trT = document.createElement("tr");
    btn = $("<label class='switch'></label>");
    btn.append($("<input type='checkbox' id='settingsPopupBtnCheckboxShortcuts' class='mousetrap'></input>"));
    btn.append($("<span class='switchSlider round'></span>"));
    btn.find("input").prop("checked", !this.disableShortcuts);
    btn.find("input").on("change", (function () {
      if ($("#settingsPopupBtnCheckboxShortcuts").prop("checked") === true) {
        $("#settingsPopupBtnToggleShortcuts").text(this.page.pageManager.getLocalizer().getFragment(this.page.language, "settingsPopupBtnToggleShortcutsOff"));
        this.page.tacic.bind();
        this.page.disableShortcuts = false;
      } else {
        $("#settingsPopupBtnToggleShortcuts").text(this.page.pageManager.getLocalizer().getFragment(this.page.language, "settingsPopupBtnToggleShortcutsOn"));
        this.page.tacic.unbind();
        this.page.disableShortcuts = true;
      }
    }).bind({ page : this }));
    btnColumn = $("<td style='text-align: left; font-family: Menlo; color: blue;'></td>");
    btnColumn.append(btn);
    $(trT).append(btnColumn);
    $(trT).append($("<td id='settingsPopupBtnToggleShortcuts' style='text-align: left'>" + this.pageManager.getLocalizer().getFragment(this.language, "settingsPopupBtnToggleShortcutsOff") + "</td>"));
    $(table).append(trT);
    $(table).append($("<tr height='8px'></tr>"));  // Empty row

    // For exporting label cache to TSV for download
    trT = document.createElement("tr");
    btn = $("<div class='pageSettingButton' id='btnExportLabelCacheToTsv' title='Export label cache to TSV'><img draggable='false' (dragstart)='false;' class='unselectable shadow' src='./design/images/download.svg' border='0'></img></div>");
    btn.on("click", (function () { this.page.exportLabelCacheToTsv(); }).bind({ page : this }));
    btnColumn = $("<td style='text-align: left; font-family: Menlo; color: blue;'></td>");
    $(btnColumn).append(btn);
    $(trT).append(btnColumn);
    $(trT).append($("<td style='text-align: left'>" + this.pageManager.getLocalizer().getFragment(this.language, "settingsPopupBtnExportLabelCacheToTsv") + "</td>"));
    $(table).append(trT);
    $(table).append($("<tr height='8px'></tr>"));  // Empty row

    // For clearing local label cache
    trT = document.createElement("tr");
    btn = $("<div class='pageSettingButton' id='btnClearLabelCache' title='Delete local label cache'><img draggable='false' (dragstart)='false;' class='unselectable shadow' src='./design/images/delete.svg' border='0'></img></div>");
    btn.on("click", (function () { this.page.clearLabelCache(); }).bind({ page : this }));
    btnColumn = $("<td style='text-align: left; font-family: Menlo; color: blue;'></td>")
    btnColumn.append(btn);
    $(trT).append(btnColumn);
    $(trT).append($("<td style='text-align: left'>" + this.pageManager.getLocalizer().getFragment(this.language, "settingsPopupBtnClearLabelCache") + "</td>"));
    $(table).append(trT);
    $(table).append($("<tr height='8px'></tr>"));  // Empty row


    $("#popupSettings").append(table);
    $("#settingsPopupCard").popup("open");
  }
};

TaggingPage.prototype.showToast = function (_msg, _duration, _close, _avatar) {
  if (_msg == null || typeof _msg !== "string") return false;
  Toastify({
    avatar: _avatar || null,
    text: _msg,
    duration: _duration || 3000,  // -1 for permanent toast
    // destination: "https://github.com/apvarun/toastify-js",
    destination: null,
    newWindow: true,
    close: _close || false,  // whether to display a close button
    gravity: "bottom", // `top` or `bottom`
    position: "center", // `left`, `center` or `right`
    stopOnFocus: true, // Prevents dismissing of toast on hover
    style: {
      // background: "linear-gradient(to right, #00b09b, #96c93d)",
      background: "#262626",
    },
    onClick: function(){} // Callback after click
  }).showToast();
  return true;
};

TaggingPage.prototype.showError = function (_msg) {
  $("#popErrorHeader").text(this.pageManager.getLocalizer().getFragment(this.language, 'popupErrorTitle'));

  var ul = $("<ul style='text-align:left;'><li>" + _msg + "</li></ul>");
  $('#popupErrorsContent').append(ul);
  $("#popupErrors").popup("open");
  var elements;
  if ($("body").children() != null && $("body").children().children() != null) {
    elements = $("body").children().children();
  } else {
    elements = $("body").children();
  }
  for (var i = 0; i < elements.length; i++) {
    if (elements.eq(i).attr('id') != "popupErrors-popup" && elements.eq(i).attr('id') != "popupErrors" && elements.eq(i).attr('id') != "popupDialog") {
      elements.eq(i).addClass('ui-disabled');
    }
  }
};


/**
 * Validate whether the set of labels matches the current tag buttons.
 * @param {Set} _labels - Set of labels to be validated.
 */
TaggingPage.prototype.validateLabels = function (_labels) {
  if (_labels == null || _labels.size === 0) {
    return false;
  }
  for (var label of _labels) {
    if (typeof label !== "string" || this.validTags.has(label) === false) {
      return false;
    }
  }
  return true;
};

TaggingPage.prototype.loadLabelCache = function (_overwrite) {
  if (_overwrite == null) _overwrite = false;
  if (this.labelCache === true) {
    const cacheID = "session=" + this.session.testId + ",trial=" + this.pageConfig.id;
    var labelcache;
    var count = 0;
    for (var i = 0; i < this.audios.length; i++) {
      const uid = this.audios[i].id;
      // Read label cache from localStorage
      labelcache = localStorage.getItem(cacheID + ",uid=" + uid);
      if (labelcache == null) continue;
      try {
        labelcache = new Set(JSON.parse(labelcache));
        if (! this.validateLabels(labelcache)) {
          this.showError("Invalid value found in label cache for " + uid + ": " + Array.from(labelcache).join(";"));
        }
        count++;
        if (_overwrite != true && this.labels[uid] != null && this.labels[uid].size > 0) {
          this.labels[uid] = new Set([...this.labels[uid], ...labelcache]);
        } else {
          this.labels[uid] = new Set(labelcache);
        }
        this.isViewed[i] = true;
      } catch (e) {
        this.showError("Error loading label cache for " + uid + ": " + e.message);
      }
    }
    if (count > 0) {
      this.showToast("Label cache of " + count + " audio(s) loaded from previous sessions. If you haven't participated in this session before, please clear the cache (by clicking the [Settings] -> [Delete] button on the upper-right corner) and then refresh the page.", -1, true, "./design/images/warning.svg");
    }
  }
};

TaggingPage.prototype.saveLabelCache = function (_uid) {
  // Make sure this.labels[_uid] is not empty
  const cacheID = "session=" + this.session.testId + ",trial=" + this.pageConfig.id + ",uid=" + _uid;
  localStorage.setItem(cacheID, JSON.stringify(Array.from(this.labels[_uid])));
};

TaggingPage.prototype.clearLabelCache = function () {
  const regex = /^session=.*,trial=.*,uid=.*$/;
  var arr = [];
  for (var i = 0; i < localStorage.length; i++){
    if (localStorage.key(i).match(regex)) {
      arr.push(localStorage.key(i));
    }
  }
  var cleared = false, count = 0;
  for (var i = 0; i < arr.length; i++) {
    localStorage.removeItem(arr[i]);
    cleared = true;
    count += 1;
  }
  if (cleared === true) {
    this.showToast("All label cache (totally " + count + ") cleared.");
  } else {
    this.showToast("No label cache to clear.");
  }
};

TaggingPage.prototype.exportLabelCacheToTsv = function (_fname) {
  if (this.labelCache === true) {
    const cacheID = "session=" + this.session.testId + ",trial=" + this.pageConfig.id;
    var labelcache;
    var tsv = "UID\tTags\n";
    for (var i = 0; i < this.audios.length; i++) {
      const uid = this.audios[i].id;
      labelcache = localStorage.getItem(cacheID + ",uid=" + uid);
      if (labelcache == null) continue;
      if (i == this.currentIndex && this.labels[this.audios[this.currentIndex].id] !== undefined && this.labels[this.audios[this.currentIndex].id].size > 0) {
        // Overwrite the label of current audio in localStorage with currently selected labels
        this.saveLabelCache(this.audios[this.currentIndex].id);
      }
      try {
        labelcache = JSON.parse(labelcache);
        tsv += uid + "\t" + labelcache.join(";") + "\n";
      } catch (e) {
        this.showError("An error occured when loading label cache for " + uid + ": " + e.message);
        return;
      }
    }
    if (tsv.length <= 9) {
      this.showToast("No label cache to export.");
      return;
    }
    var blob = new Blob([tsv], {type: "text/plain;charset=utf-8"});
    // saveAs(blob, _fname + ".tsv");
    var dlink = document.createElement('a');
      dlink.download = _fname || "unnamed.tsv";
      dlink.href = window.URL.createObjectURL(blob);
      dlink.onclick = function(e) {
          // revokeObjectURL needs a delay to work properly
          var that = this;
          setTimeout(function() {
              window.URL.revokeObjectURL(that.href);
          }, 1500);
      };

      dlink.click();
      dlink.remove();
  }
};

TaggingPage.prototype.importLabelCacheFromTsv = function (_file, _overwrite) {
  if (this.labelCache === true) {
    var data = this.tagDataIO.readTsv(_file);
    if (data == null) {
      this.showError("Invalid TSV file format.");
      return;
    }
    var header = data["header"];
    var data = data["data"];
    if (header == null || data == null) {
      this.showError("Invalid TSV file content.");
      return;
    }
    if (header.length != 2 || header[0] != "UID" || header[1] != "Tags") {
      this.showError("Invalid TSV file header. Expected 'UID\tTags', but got " + header.join("\t"));
      return;
    }
    const cacheID = "session=" + this.session.testId + ",trial=" + this.pageConfig.id;
    for (var i = 0; i < data.length; i++) {
      const uid = data[i][0];
      var tags = data[i][1];
      if (tags != null && tags.length > 0) {
        tags = tags.split(";");
        if (!this.validateLabels(new Set(tags))) {
          this.showError("Invalid label found in TSV (" + _file + ") for " + uid + ": " + data[i][1]);
          return;
        }
        localStorage.setItem(cacheID + ",uid=" + uid, JSON.stringify(tags));
      }
    }
    console.log("Label cache loaded from TSV file: " + _file);
    this.loadLabelCache(_overwrite);
    this.renderTags();

    this.checkButtonLockStatus();
  }
};

TaggingPage.prototype.save = function () {
  this.tacic.unbind();
  Mousetrap.unbind(['[', '【', ']', '】', '/']);
  this.time[this.currentIndex] += (new Date() - this.startTimeOnPage);
  this.tagAudioControl.freeAudio();
  this.tagAudioControl.removeEventListener(this.waveformSpecVisualizer.numberEventListener);

  this.loop.start = parseInt(this.waveformSpecVisualizer.mushraAudioControl.audioLoopStart);
  this.loop.end = parseInt(this.waveformSpecVisualizer.mushraAudioControl.audioLoopEnd);

  // Write results to participant cache
  if (this.labelCache === true && this.labels[this.audios[this.currentIndex].id] !== undefined && this.labels[this.audios[this.currentIndex].id].size > 0) {
    this.saveLabelCache(this.audios[this.currentIndex].id);
  }
};

TaggingPage.prototype.store = function () {

  var trial = new Trial();
  trial.type = this.pageConfig.type;
  trial.id = this.pageConfig.id;
  for (var i = 0; i  < this.audios.length; ++i) {
    const uid = this.audios[i].id;
    if (this.labels[uid].size == 0) {
      if (this.mustViewAllAudios == true) {
        this.showError("Error: " + uid + "is not tagged");
      }
      // Skip unlabled audios
      continue;
    }

    var tagObj = new TagResponse();
    tagObj.stimulus = uid;
    tagObj.labels = Array.from(this.labels[uid]).join(";");
    tagObj.time = this.time[i];

    trial.responses[trial.responses.length] = tagObj;
  }
  this.session.trials[this.session.trials.length] = trial;
};


function escapeHtml(unsafe)
{
  return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
 }
