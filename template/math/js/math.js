function Calculate(formula, input) {
  var result = formula;
  var keys = [];
  var inputs = {};
  for (var i = 0; i < input.length; i++) {
    var key = '$' + (i + 1);
    keys.push(key);
    inputs[key] = input[i];
  }
  keys.sort(function(a, b){ return b.length - a.length; });
  for(i in inputs) {
    result = result.split(i).join(inputs[i]);
  }
  return new Function('return ' + result)();
}
