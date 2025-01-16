function TagAudioControlInputController(_tagAudioControl, _looping){
    this.tagAudioControl = _tagAudioControl;
    this.looping = _looping;
}


TagAudioControlInputController.prototype.bind = function(){

  // var stimulus = this.tagAudioControl.getStimulus();
  Mousetrap.bind(['p'], function() { $('#buttonAudio').click(); });
  Mousetrap.bind(['backspace'], function() { $('#buttonStop').click(); });
  Mousetrap.bind(['space'], (function() {   var firstPageCall = false;
                                            if($('#buttonAudio').attr('active') == 'true'){
                                              // if(this.tagAudioControl.audioPlaying != true){
                                              //   this.tagAudioControl.setPosition(this.tagAudioControl.audioLoopStart);
                                              // }
                                              $('#buttonAudio').click();
                                              firstPageCall = false;
                                            } else {
                                              firstPageCall = true;
                                            }
                                            if(firstPageCall == true){
                                              $('#buttonAudio').click();
                                            }
  }).bind(this));

  if (this.looping) {
    Mousetrap.bind(['a'], function() { this.pageManager.getCurrentPage().setLoopStart(); });
    Mousetrap.bind(['b'], function() { this.pageManager.getCurrentPage().setLoopEnd(); });
    Mousetrap.bind(['B'], (function() { this.tagAudioControl.setLoopEnd(this.tagAudioControl.getDuration()); }).bind(this));
    Mousetrap.bind(['A'], (function() { this.tagAudioControl.setLoopStart(0); }).bind(this));
  }

  document.onkeydown = function (event) {

    if (!event) { /* This will happen in IE */
      event = window.event;
    }

    var keyCode = event.keyCode;

    if (keyCode == 8 && // prevents backspace to go back
      ((event.target || event.srcElement).tagName != "TEXTAREA") &&
      ((event.target || event.srcElement).tagName != "INPUT")) {

      if (navigator.userAgent.toLowerCase().indexOf("msie") == -1) {
        event.stopPropagation();
      } else {
        alert("prevented");
        event.returnValue = false;
      }

      return false;
    } else if (keyCode == 32 && // prevents space bar to scroll down
      ((event.target || event.srcElement).tagName != "TEXTAREA") &&
      ((event.target || event.srcElement).tagName != "INPUT")) {

        if (navigator.userAgent.toLowerCase().indexOf("msie") == -1) {
          event.stopPropagation();
        } else {
          alert("prevented");
          event.returnValue = false;
        }

        return false;
      }
  };

};


TagAudioControlInputController.prototype.unbind = function(){
  Mousetrap.unbind(['a', 'b', 'A', 'B', 'backspace', 'space', 'p']);
};
