function MATH() {

  this.letters = 'abcdefghijklmnopqrstuvwxyz'
  this.numbers = '1234567890.';
  this.operators = '+-*/<>=';
  this.statementOperators = '<>=';
  this.booleans = ['true', 'false'];

  this.parse = function(equation) {
    var components = [];
    var done = false;
    var current = { type: null, value: null };
    var m = 0;
    while(true) {
      if(m >= equation.length) {
        if(current.type) components.push(this.buildComponent(current));
        break;// end
      }
      var char = equation[m];// character
      // Empty
      if(!current.type) {
        current = { type: this.getType(equation[m]), value: equation[m] };
        // operators are single characters, so move on
        if(current.type == current) {
          components.push(this.buildComponent(current));
          current.type = null;
        } else if(current.type == 'bracket') {
          var end = this.getBracketEnd(equation, m);
          if(!end) throw 'Missing closing bracket: for "(" at ' + m;
          current.value = this.parse(equation.substring(m + 1, end));
          components.push(this.buildComponent(current));
          current.type = null;
          m = end;
        }
      } else {
        if(this.isType(char, current.type)) {
          current.value += char;
        } else {
          components.push(this.buildComponent(current));
          current.type = null;
          // go back to reproccess the ignored character
          m--;
        }
      }
      m++;
    }
    return components;
  }

  this.isType = function(char, type) {
    var charType = this.getType(char);
    if((type == 'index' && charType == 'number') ||
      (type == 'number' && charType == 'number') ||
      (type == 'letter' && charType == 'letter') ||
      (type == 'operator' && charType == 'operator')) return true;
    return false;
  }

  this.getType = function(char) {
    if(char == '$') {
      return 'index';
    } else if(char == '(') {
      return 'bracket';
    } else if(char == '?') {
      return 'if';
    } else if(char == ':') {
      return 'else';
    } else if(this.numbers.indexOf(char) != -1) {
      return 'number';
    } else if(this.operators.indexOf(char) != -1) {
      return 'operator';
    } else if(this.letters.indexOf(char.toLowerCase()) != -1) {
      return 'letter';
    } else {
      return null;
    }
  }

  this.buildComponent = function(component) {
    var result = { type: component.type };
    switch (component.type) {
      case 'letter':
      case 'operator':
      case 'bracket':
      case 'if':
      case 'else':
        result.value = component.value;
        break;
      case 'number':
        result.value = parseFloat(component.value);
        break;
      case 'index':
        result.value = parseInt(component.value.substring(1));
        break;
    }
    return result;
  }

  this.formatSources = function(sources) {
    var result = [];
    sources.split(',').forEach(function(source) { result.push(source.split(':')); });
    return result;
  }

  this.getBracketEnd = function(equation, start) {
    var open = 1;
    for(var i = start + 1; open > 0; i++) {
      if(i >= equation.length) return null;
      if(equation[i] == '(') open++;
      else if(equation[i] == ')') open--;
      if(open == 0) return i;
    }
  }

  // ___________ Calculate ___________

  this.calculate = function(equation, input) {
    var components = this.parse(equation);
    return this.Calculate(components, input);
  }

  return this;
}

MATH.prototype.Calculate = function (MathComponents, input) {

  this.resolve = function(components) {
    // Resolve child brackets
    for(var c = 0; c < components.length; c++) {
      if(components[c].type == 'bracket') {
        components[c] = { type: 'number', value: this.resolve(components[c].value) };
      }
    }

    // Check for if statement
    for(var c = 0; c < components.length; c++) {
      if(components[c].type == 'if') {
        for(var cr = components.length - 1; cr > 0; cr--) {
          if(components[cr].type == 'else') {
            return this.resolveStatement(components.slice(0, c), components.slice(c + 1, cr), components.slice(cr + 1));
          }
        }
        // if there was no else statement
        throw 'Missing else statement: for "?" at ' + this.join(components);
      }
    }
    var equated = this.equate(components);
    return equated;
  }

  this.equate = function(components) {
    if(components.length == 1) return this.getComponentValue(components[0]);
    if(components.length < 3) throw 'Invalid operation: length should be greater than 3';

    var result = 0;
    var operator = null;
    var last = null;

    console.log(components);

    for(var i = components.length - 1; i >= 0; i--) {
      // First component
      if(last == null) {
        if(components[i].type == 'number' || components[i].type == 'index') {
          result = this.getComponentValue(components[i]);
        } else {
          throw 'Invalid operation: end component should be a value';
        }
        last = 'value';
      } else {
        if((last == 'value' && components[i].type != 'operator') ||
          (last == 'operator' && components[i].type != 'number' && components[i].type != 'index')) throw 'Invalid operation: value was expected';

        if(last == 'value') {
          if(components[i].type != 'operator') throw 'Invalid operation: operator was expected';
          operator = components[i].value;
          last = 'operator';
        } else if(last == 'operator') {
          console.log(components[i].type);
          if(!operator) throw 'Invalid operation: missing operator';
          if(components[i].type != 'number' && components[i].type != 'index') throw 'Invalid operation: value was expected, found (' + components[i].type + ')';
          var v = this.getComponentValue(components[i]);
          console.log(v, operator, result);
          switch (operator) {
            case '+': result = v + result; break;
            case '-': result = v - result; break;
            case '/': result = v / result; break;
            case '*': result = v * result; break;
            default:
              throw 'Invalid operator: ' + operator;
          }
          last = 'value';
        }
      }
    }
    return result;
  }

  // this.resolveStatement = function(condition, yes, no) {
  //
  // }
  //
  // this.resolveCondition = function(components) {
  //   var index = -1;
  //   for(var i = 0; i < components.length; i++) {
  //     if()
  //   }
  // }

  this.getComponentValue = function(component) {
    if(component.type == 'number') {
      return component.value;
    } else if(component.type == 'index') {
      if(!input[component.value - 1]) throw 'Missing input[' + (component.value - 1) + ']';
      return input[component.value - 1];
    }
    return null;
  }

  this.joinComponents = function(components) {
    var result = '';
    components.forEach(function(componenet) {
      result += component.value;
    });
    return result;
  }

  try {
    var res = this.resolve(MathComponents);
    return res;
  } catch(err) {
    console.error(err);
    return null;
  }
};
