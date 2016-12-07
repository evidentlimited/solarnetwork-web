const datapoints = require('./models/datapoints');
const dates = require('./models/date');
const locations = require('./models/location');

function process(text) {
  var result = [];
  text = text.replace(/[^a-zA-Z ]/g, '');
  console.log(text);
  // text = text.split(' ');
  // for(t in )
  text.split(' ').forEach(function(word) {
    var dp = check(word, datapoints);
    var dt = check(word, dates);
    var lc = check(word, locations);
    if(dp) { result.push({ type: 'datapoint', value: dp }); }
    else if(dt) { result.push({ type: 'date', value: dt }); }
    else if(lc) { result.push({ type: 'location', value: lc }); }
  });
  return result;
}

function check(word, object) {
  for(o in object) {
    var index = object[o].indexOf(word.toLowerCase());
    if(index != -1) {
      return { id: object[o][0], term: object[o][index] };
    }
  }
  return null;
}

console.log(process('how hot has it been outside this week'));
