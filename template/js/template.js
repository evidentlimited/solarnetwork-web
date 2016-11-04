var Template = (function() {
  // Get elements and fill with data when the page has loaded
  window.onload = function() {
    Template.SolarNetwork.setConfig(Template.Element.getConfig());
    Template.Datapoint.initiate();
  }

  return this;
})();

// __________________________ ELEMENT __________________________

Template.Element = (function() {
  // data bindings
  this.bindings = { current: {}, aggregated: {} };

  // Get data-config from element
  this.getConfig = function() {
    // Get all config elements
    var elements = document.querySelectorAll('data-config');
    var config = {};

    // Get attributes from elements
    for(var e = 0; e < elements.length; e++) {
      if(elements[e].attributes.node) config.node = elements[e].getAttribute('node');
      if(elements[e].attributes.token) config.token = elements[e].getAttribute('token');
      if(elements[e].attributes.secret) config.secret = elements[e].getAttribute('secret');
    }

    return config;
  }

  // Get all data elements
  this.getAll = function() {
    return document.querySelectorAll('data');
  }

  // Get a list of sources
  this.getSources = function() {
    var elements = this.Element.getAll();
    var list = [];
    // Iterate elements getting source attributes
    for(var e = 0; e < elements.length; e++) {
      var source = elements[e].getAttribute('source');
      // Add source if it exists and isn't already listed
      if(source && list.indexOf(source) == -1) list.push(source);
    }
    return list;
  }

  // Fill data elements with data
  this.fill = function(data) {
    elements = this.Element.getAll();
    // Iterate elements and data, matching source and metric
    for(var e = 0; e < elements.length; e++) {
      var source = elements[e].getAttribute('source');
      var metric = elements[e].getAttribute('metric');
      var round = parseInt(elements[e].getAttribute('round'));
      for(var d = 0; d < data.length; d++) {
        if(source == data[d].sourceId) {
          // Insert data in element
          if(data[d][metric]) {
            // Round the value (default = 2)
            var value = this.Element.round(data[d][metric], round);
            elements[e].innerHTML = value;
          }
        }
      }
    }
  }

  // Get suffix
  this.getSuffix = function(value) {
    if(!value || value.length == 0) return null;
    return value[value.length - 1];
  }

  // Update data
  this.update = function(data) {

    Template.SolarNetwork.query(data, function(err, result) {
      if(err) return console.error(err);
      // Template.Element.fill(result);
    });
  }

  return this;
})();

// __________________________ SOLARNETWORK __________________________

Template.SolarNetwork = (function() {
  // Defaults
  this.host = 'https://data.solarnetwork.net';
  this.config = {};

  // Set the SolarNetwork config
  this.setConfig = function(config) {
    this.SolarNetwork.config = config;
  }

  // SolarNetwork HTTP request with authentication
  this.request = function(path, params, next) {
    // Build the path
    var fullPath = path + '?' + this.SolarNetwork.buildQueryString(params);

    // Get the current time as a UTC string
    var now = (new Date()).toUTCString();
    // Build the message to be hashed
    var msg = `GET\n\n\n${now}\n${fullPath}`;
    // Hash the message with HMAC-SHA1 and base64 encode
    var hash = CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA1(msg, this.config.secret));
    // Create the HTTP request
    var req = new XMLHttpRequest();
    req.onreadystatechange = function() {
      if (this.readyState == 4) {
        if(this.status == 200) {
          // Callback with the JSON response
          next(null, JSON.parse(this.responseText));
        } else {
          next(this.responseText);
        }
      }
    };
    req.open('GET', this.SolarNetwork.host + fullPath, true);
    // Set the headers for authorization
    req.setRequestHeader('X-SN-Date', now);
    req.setRequestHeader('Authorization', `SolarNetworkWS ${this.SolarNetwork.config.token}:${hash}`);
    req.setRequestHeader('Accept', `application/json`);
    req.send();
  }

  // Query datapoint
  this.query = function(params, type, next) {
    var path = '/solarquery/api/v1/sec/datum/' + type;

    this.SolarNetwork.request(path, params, function(err, response) {
      if(err) return next(err);
      if(!response.success) return next(response);
      next(null, response.data.results);
    });
  }

  // Build a query string from a JSON object and sort alphabetically
  this.buildQueryString = function(params) {
    var keys = [];
    for(key in params) {
      keys.push(key);
    }
    // Sort keys (SolarNetwork requires alphabetically sorted query parameters for authorization)
    var keys = keys.sort();
    var queryArray = [];
    // Build the parameters based on the sorted keys
    for(var i = 0; i < keys.length; i++) {
      queryArray.push(keys[i] + '=' + params[keys[i]]);
    }
    // Return the joined parameters
    return queryArray.join('&');
  }

  return this;
})();

// __________________________ DATAPOINT __________________________

Template.Datapoint = (function() {

  this.initiate = function() {
    var list = this.Datapoint.buildList();
    for (var l = 0; l < list.length; l++) {
      this.Datapoint.update(list[l]);
    }
  }

  this.buildList = function() {
    // Built list
    var list = [];
    // All data elements
    var elements = this.Element.getAll();

    for (var e = 0; e < elements.length; e++) {
      var source = elements[e].getAttribute('source');
      var metric = elements[e].getAttribute('metric');
      var time = Template.Time.fromElement(elements[e]);
      var period = Template.Time.periodFromString(elements[e].getAttribute('period'));
      // If null set the period to the time if it isnt current
      if(!period) period = { period: time.current ? null : time.period, value: 1 };
      // Set aggregate or calculate from period
      var aggregate = elements[e].getAttribute('aggregate') || Template.Time.aggregateFromPeriod(period.period);
      var round = parseInt(elements[e].getAttribute('round'));
      // Defalt rounding
      if(isNaN(round)) round = 2;
      var update = Template.Time.periodFromString(elements[e].getAttribute('update'));
      // if average attribute exists and isn't false, set to true
      var average = elements[e].getAttribute('average') == 'false' ? false : elements[e].hasAttribute('average');
      // Require source and metric
      if(source && source != '' && metric && metric != '') {
        list.push({
          element: elements[e],
          source: source,
          metric: metric,
          time: time, // { current: true } or { current: false, date: xxx, period: x }
          period: period, // { period: x, value: x }
          aggregate: aggregate,
          round: round,
          update: update
        });
      } else {
        console.error('Error: data elements require source and metric attributes, ignoring element...');
      }
    }

    // Round to x decimal places
    this.round = function(value, decimals) {
      if(isNaN(decimals)) decimals = 2;
      var multiplier = 1;
      for(var d = 0; d < decimals; d++) { multiplier *= 10; }
      return Math.round(value * multiplier) / multiplier;
    }

    return list;
  }

  this.update = function(datapoint) {
    var params = {
      nodeId: Template.SolarNetwork.config.node,
      sourceId: datapoint.source,
      dataPath: 'i.' + datapoint.metric
    }

    var type = '';

    if(datapoint.time.current) {
      type = 'mostRecent';
    } else {
      type = 'list';
      var endDate = new Date(datapoint.time.date.getTime() + (datapoint.period.value * Template.Time.getPeriodMultiplier(datapoint.period.period)));
      params.startDate = Template.Time.formatUrlDate(datapoint.time.date);
      params.endDate = Template.Time.formatUrlDate(endDate);
      if(datapoint.aggregate) params.aggregate = datapoint.aggregate;
    }

    Template.SolarNetwork.query(params, type, function(err, data) {
      console.log(params);
      console.log(data);
      if(err) return console.error(err);
      var total = 0;
      var count = 0;
      for (var d = 0; d < data.length; d++) {
        if(data[d][datapoint.metric]) {
          total += data[d][datapoint.metric];
          count++;
        }
      }
      datapoint.element.innerHTML = Template.Datapoint.round(datapoint.average ? total / count : total, datapoint.round);
    });

    if(datapoint.update != null) {
      var duration = datapoint.update.value * Template.Time.getPeriodMultiplier(datapoint.update.period);
      // Call next update
      setTimeout(function() { Template.Datapoint.update(datapoint); }, duration);
    }
  }

  return this;
})();

// __________________________ TIME __________________________

Template.Time = (function() {
  // period suffix
  this.periodSuffixes = ['s', 'm', 'h', 'd', 'w', 'M', 'y'];

  this.queryDates = function(element) {
    var date = new Date();
  }

  // Get Date from elements attributes
  this.fromElement = function(element) {
    var date = new Date();
    // Get date attributes
    var year = parseInt(element.getAttribute('year'));
    var month = parseInt(element.getAttribute('month'));
    var week = parseInt(element.getAttribute('week'));
    var day = parseInt(element.getAttribute('day'));
    var weekday = parseInt(element.getAttribute('weekday'));
    var hour = parseInt(element.getAttribute('hour'));
    var minute = parseInt(element.getAttribute('minute'));
    // Return current if no dates are set
    if(isNaN(year) && isNaN(month) && isNaN(week) && isNaN(day) && isNaN(weekday) && isNaN(hour) && isNaN(minute)) return { current: true };
    // Relative date
    var period = null;
    if(!isNaN(year) && year <= 0) { period = 'y'; date.setFullYear(date.getFullYear() + year); }
    if(!isNaN(month) && month <= 0) { period = 'M'; date.setMonth(date.getMonth() + month); }
    if(!isNaN(week) && week <= 0) { period = 'w'; date.setDate(date.getDate() + (week * 7)); }
    if(!isNaN(day) && day <= 0) { period = 'd'; date.setDate(date.getDate() + day); }
    if(!isNaN(weekday) && weekday <= 0) { period = 'd'; date.setDate(date.getDate() + weekday); }
    if(!isNaN(hour) && hour <= 0) { period = 'h'; date.setHours(date.getHours() + hour); }
    if(!isNaN(minute) && minute <= 0) { period = 'm'; date.setMinutes(date.getMinutes() + minute); }
    if(period) date = this.Time.roundToPeriod(date, period);
    // Offset date
    if(!isNaN(year) && year > 0) { date.setFullYear(year); }
    if(!isNaN(month) && month > 0) { date.setMonth(month - 1); }
    if(!isNaN(week) && week > 0) {
      date.setDate(date.getDate() - (date.getDay() - 1));//
      date.setDate(date.getDate() + ((week - 1) * 7));
    }
    if(!isNaN(day) && day > 0) { date.setDate(day); }
    if(!isNaN(weekday) && weekday > 0) { date.setDate((date.getDate() - date.getDay()) + weekday); }
    if(!isNaN(hour) && hour >= 0) { date.setHours(hour); }
    if(!isNaN(minute) && minute >= 0) { date.setMinutes(minute); }
    // Return time object
    return { date: date, period: period || 'd', current: false };
  }

  // Period from element
  this.periodFromString = function(period) {
    if(period == null || period.length == 0) return null;
    var suffix = period[period.length - 1];
    var value = parseFloat(period.slice(0, -1));
    // The suffix isn't an allowed period
    if(this.Time.periodSuffixes.indexOf(suffix) == -1) {
      var v = parseFloat(period);
      if(isNaN(v)) return null; // invalid period
      value = v;
      suffix = 's';
    };
    if(isNaN(value)) value = 1;
    return { value: value, period: suffix };
  }

  // Get period multiplier (milliseconds conversion)
  this.getPeriodMultiplier = function(period) {
    switch (period) {
      case 's': return 1000;// second
      case 'm': return 60000;// minute
      case 'h': return 3600000;// hour
      case 'd': return 86400000;// day
      case 'w': return 604800000;// week
      case 'M': return 2629746000;// month
      case 'y': return 31536000000;// year
      default: return 1000;// second by default
    }
  }

  // Round to peiod
  this.roundToPeriod = function(date, period) {
    var d = new Date(date);
    d.setMilliseconds(0);
    if(period == 's') return d;
    d.setSeconds(0);
    if(period == 'm') return d;
    d.setMinutes(0);
    if(period == 'h') return d;
    d.setHours(0);
    if(period == 'd') return d;
    if(period == 'w') {
      d.setDate((d.getDate() - d.getDay()) + 1);
      return d;
    }
    d.setDate(1);
    if(period == 'M') return d;
    d.setMonth(0);
    return d;
  }

  // Get aggregation from period
  this.aggregateFromPeriod = function(period) {
    switch (period) {
      case 's': return null;// second
      case 'm': return 'Minute';// minute
      case 'h': return 'Hour';// hour
      case 'd': return 'Day';// day
      case 'w': return 'Week';// week
      case 'M': return 'Month';// month
      case 'y': return 'Month';// year
      default: return null;// second by default
    }
  }

  // Format SolarNetwork date
  this.formatUrlDate = function(date) {
    var y = date.getFullYear(), M = date.getMonth() + 1, d = date.getDate(), h = date.getHours(), m = date.getMinutes();
    return `${y}-${M < 10 ? '0' + M : M}-${d < 10 ? '0' + d : d}T${h < 10 ? '0' + h : h}:${m < 10 ? '0' + m : m}`;
  }

  return this;
})();

Template.Math = (function() {
  this.calculate = function(formula, input) {
    return (function (f, i, g) {// (formular, input, global)
      for(v in g) { this[v] = g[v] };
      return eval(f);
    })(formula, i, this.globalVariables);
  }

})();
