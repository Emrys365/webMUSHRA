/**
* @class GenericFormPage
* @property {string} title the page title
* @property {string} the page content
*/
function GenericFormPage(_pageManager, _pageConfig, _session, _pageTemplateRenderer) {
  this.pageManager = _pageManager;
  this.title = _pageConfig.name;
  this.content = _pageConfig.content;
  this.language = _pageConfig.language;
  this.pageTemplateRenderer = _pageTemplateRenderer;
  this.session = _session;

  this.questionnaire = _pageConfig.questionnaire;
  if (this.questionnaire === undefined) {
    this.questionnaire = new Array();
  }
}

/**
* Returns the page title.
* @memberof GenericFormPage
* @returns {string}
*/
GenericFormPage.prototype.getName = function () {
  return this.title;
};


/**
* Store the participant information.
* @memberof GenericFormPage
*/
GenericFormPage.prototype.save = function() {
	for (var i = 0; i < this.questionnaire.length; ++i) {
    var element = this.questionnaire[i];
    var index = this.session.participant.name.indexOf(element.name)
    if (index != -1) {
      this.session.participant.name.length = index;
    } else {
      index = this.session.participant.name.length;
      this.session.participant.name[index] = element.name;
    }

    if (index == -1) {
      index = this.session.participant.response.length;
    }
    if($("#" + element.name).val()){
      this.session.participant.response[index] = $("#" + element.name).val();
    } else {
      this.session.participant.response[index] = $("input[name='"+element.name + "__response']:checked").val();
    }
 	}
};

/**
* Renders the page
* @memberof GenericFormPage
*/
GenericFormPage.prototype.render = function (_parent) {
  this.pageTemplateRenderer.lockNextButton();
  _parent.append(this.content);

  var table = $("<table align='center'></table>");
  _parent.append(table);

  var i;
  for (i = 0; i < this.questionnaire.length; ++i) {
    var element = this.questionnaire[i];

    if (element.type === "password") {
      var minLength = (element.minlength == null) ? 1 : element.minlength;
      var maxLength = (element.maxlength == null) ? 10 : element.maxlength;
      var placeholder = (element.placeholder == null) ? minLength + "~" + maxLength + " chars" : element.placeholder + " (" + minLength + "~" + maxLength + " chars)";
      table.append($("<tr><td><strong>"+ element.label +"</strong></td><td><input id='"+element.name+"' type='password' minlength='" + minLength + "' maxlength='" + maxLength + "' placeholder='"+placeholder+"' data-inline='true'/></td></tr>"));
    } else if (element.type === "text") {

      if (element.default != null){
        table.append($("<tr><td><strong>"+ element.label +"</strong></td><td><input id='"+element.name+"' value='"+element.default+"' data-inline='true'/></td></tr>"));
      } else if (element.placeholder != null){
        table.append($("<tr><td><strong>"+ element.label +"</strong></td><td><input id='"+element.name+"' placeholder='"+element.placeholder+"' data-inline='true'/></td></tr>"));
      } else {
        table.append($("<tr><td><strong>"+ element.label +"</strong></td><td><input id='"+element.name+"' /></td></tr>"));
      }
    } else if (element.type === "number") {

      table.append($("<tr><td><strong>"+ element.label +"</strong></td><td><input id='"+element.name+"' min='"+element.min+"' max='"+element.max+"' value='"+element.default+"' data-inline='true'/></td></tr>"));
    } else if(element.type === "likert") {

      this.likert = new LikertScale(element.response, element.name + "_");
      var td = $("<td></td>");
      table.append($("<tr></tr>").append(
        $("<td><strong>"+ element.label +"</strong></td>"),
        td
      ));
      this.likert.render(td);
    } else if (element.type === "long_text"){

      if (element.default != null){
        table.append($("<tr><td id='labeltd' style='vertical-align:top; padding-top:"+ $('#feedback').css('margin-top') +"'><strong>"+ element.label +"</strong></td><td><textarea name='"+element.name+"' id='"+element.name+"'>"+element.default+"</textarea></td></tr>"));
      } else if (element.placeholder!= null){
        table.append($("<tr><td id='labeltd' style='vertical-align:top; padding-top:"+ $('#feedback').css('margin-top') +"'><strong>"+ element.label +"</strong></td><td><textarea name='"+element.name+"' id='"+element.name+"' placeholder='"+element.placeholder+"'></textarea></td></tr>"));
      } else {
        table.append($("<tr><td id='labeltd' style='vertical-align:top; padding-top:"+ $('#feedback').css('margin-top') +"'><strong>"+ element.label +"</strong></td><td><textarea name='"+element.name+"' id='"+element.name+"'></textarea></td></tr>"));
      }
    }

    if (this.session != null && this.session.participant != null) {
      var index = this.session.participant.name.indexOf(element.name);
      if (index != -1) {
        $("#" + element.name).val(this.session.participant.response[index]);
      }
    }
  }
  return;
};

/**
* Loads the page
* @memberof GenericFormPage
*/
GenericFormPage.prototype.load = function() {
  $('#labeltd').css('padding-top', $("#feedback").css("margin-top"));
  if (this.questionnaire.length > 0) {
    this.interval = setInterval((function(){
      var counter = 0;
      var i;
      for (i = 0; i < this.questionnaire.length; ++i) {
        var element = this.questionnaire[i];
        if (element.type === "password") {
          if ($("#" + element.name).val() || element.optional == true) {
            ++counter;
          }
        } else if (element.type === "text") {
          if ($("#" + element.name).val() || element.optional == true) {
            ++counter;
          }
        } else if (element.type === "number") {
          if ($("#" + element.name).val() || element.optional == true) {
            ++counter;
          }
        } else if (element.type === "likert") {
          if (this.likert && $("input[name='" + element.name + "__response']:checked").val() || element.optional == true) {
            ++counter;
          }
        } else if(element.type === "long_text") {
          if ($("#" + element.name).val() || element.optional == true) {
            ++counter;
          }
        }
        if (counter == this.questionnaire.length) {
          this.pageTemplateRenderer.unlockNextButton();
        } else if( i +1 == this.questionnaire.length && counter != this.questionnaire.length){
        	this.pageTemplateRenderer.lockNextButton();
        }
      }
    }).
    bind(this), 50);
  } else {
    this.pageTemplateRenderer.unlockNextButton();
  }
};
