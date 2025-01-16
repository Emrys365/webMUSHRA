function TagDataIO(_remoteService) {
  this.target = _remoteService;
}

function parseJsonString(str) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return false;
  }
}

/**
 * Represents a TaggingPage response.
 * @param {String} _tsvFile - Path to the tsv file
 */
TagDataIO.prototype.readTsv = function(_tsvFile) {
  if (_tsvFile == null || typeof _tsvFile != "string") {
    console.log("Invalid TSV file: ", _tsvFile);
    return null;
  }
  var readTsvJSON = JSON.stringify({
    "tsv": _tsvFile, "mode": "r"
  });
  var httpReq = new XMLHttpRequest();
  // console.log(readTsvJSON);
  var params = "readTsvJSON=" + readTsvJSON;
  try {
    httpReq.open("POST", this.target, false);  // synchron
    httpReq.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    httpReq.send(params);
  }
  catch (e) {
    console.log(httpReq.responseText);
    return null;
  }
  var response = parseJsonString(httpReq.responseText);
  if (response == false || httpReq.status != 200){
    console.log(httpReq.responseText);
    console.log(httpReq.status);
    return null;
  } else {
    return response;
  }
};
