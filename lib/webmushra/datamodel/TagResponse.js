/**
 * Represents a TaggingPage response.
 * @constructor
 * @property {String} stimulus - Name of the stimulus that was rated.
 * @property {Array[String]} labels - Tag labels that were assigned by the participant.
 * @property {Number} time - Time that the stimulus was visible in total.
 */
function TagResponse() {
  this.stimulus = null;
  this.labels = null;
  this.time = null;
}
