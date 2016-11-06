var Template = (function() {
  window.onload = function() { Template.initiate(); };

  this.initiate = function() {
    Template.SolarNetwork.setConfig();
    Template.Element.build();
  }

  this.config = {};
  this.variables = {};
  this.setVariable = function(key, value) { this.variables[key] = value; }

  return this;
})();

Template.Element = (function() {
  this.all = function(tag) {
    return document.querySelectorAll(tag);
  }

  this.build = function() {
    var variable = this.Element.all('var');
    var data = this.Element.all('data');
    for(var v = 0; v < variable.length; v++) {
      this.Element.elementQuery(variable[v]);
      if(variable[v].getAttribute('key') && variable[v].getAttribute('value')) {
        this.setVariable(variable[v].getAttribute('key'), variable[v].getAttribute('value'));
      }
    }
    for(var d = 0; d < data.length; d++) this.Element.elementQuery(data[d]);
  }

  this.elementQuery = function(element) {
    function a(n) { return element.getAttribute(n); }
    var source = a('source'), metric = a('metric'), aggregate = a('aggregate'), round = parseInt(a('round')) || 2,
        time = Template.Time.fromElement(element),
        update = Template.Time.periodFromString(a('update'));
    if(!source || !metric) return;

    var params = {
      [source.indexOf(',') == -1 ? 'sourceId' : 'sourceIds']: source,
      dataPath: 'i.' + metric
    };

    var type = '';

    if(time.current) {
      type = 'mostRecent';
    } else {
      type = 'list';
      params.startDate = time.start;
      params.aggregate = time.aggregate;
      if(time.end) {
        params.endDate = time.end;
      } else {
        params['sort[0].sortKey'] = 'created';
        params.max = 1;
      }
    }

    Template.SolarNetwork.query(type, params, function(err, result) {
      if(err) return console.error(err);
      this.Element.elementUpdate(element, result);
    });
  }

  this.elementUpdate = function(element, result) {
    function a(n) { return element.getAttribute(n); }
    var sources = a('source').split(','),
        metric = a('metric'),
        update = a('update'),
        key = a('key'),
        round = parseInt(a('round')) || 2,
        override = a('override'),
        modify = a('modify'),
        adjust = a('adjust'),
        average = a('average') == 'false' ? false : element.hasAttribute('average');

    var calculated = [];

    // override SolarNetwork response processing
    if(override) {
      calculated = this.Calculate.func(override, result);
    } else {
      result.forEach(function(datum) {
        var idx = sources.indexOf(datum.sourceId);
        if(idx != -1 && datum[metric]) {
          if(!calculated[idx]) calculated[idx] = { total: 0, count: 0 };
          calculated[idx].total += datum[metric];
          calculated[idx].count++;
        }
      });
      for(c in calculated) { calculated[c] = average ? calculated[c].total / calculated[c].count : calculated[c].total };
      
      // modify array of source values
      if(modify) {
        if(modify != 'none') calculated = this.Calculate.func(modify, calculated);
      } else {
        var total = 0, count = 0;
        calculated.forEach(function(c) { total += c; count++ });
        calculated = total / count;
      }
    }
    // adjust single value
    if(adjust) { calculated = this.Calculate.func(adjust, calculated); }
    // round the result
    calculated = this.Calculate.round(calculated, round);
    // set global variable
    if(key) this.setVariable(key, calculated);
    element.value = calculated;

    if(element.tagName == 'DATA') element.innerHTML = calculated;

    if(update) {
      var duration = this.Time.millisecondsFromPeriod(update);
      if(!duration) return;
      setTimeout(function() {
        Template.Element.elementQuery(element);
      }, duration);
    }
  }

  return this;
})();

Template.SolarNetwork = (function() {
  this.HOST = 'https://data.solarnetwork.net';

  this.setConfig = function() {
    var elements = this.Element.all('data-config');
    this.SolarNetwork.config = {};
    for(var e = 0; e < elements.length; e++) {
      if(elements[e].getAttribute('node')) this.SolarNetwork.config.node = elements[e].getAttribute('node');
      if(elements[e].getAttribute('token')) this.SolarNetwork.config.token = elements[e].getAttribute('token');
      if(elements[e].getAttribute('secret')) this.SolarNetwork.config.secret = elements[e].getAttribute('secret');
    }
  }

  // make an authenticated request
  this.query = function(type, params, next) {
    params.nodeId = this.SolarNetwork.config.node;
    var path = `/solarquery/api/v1/sec/datum/${type}?${this.SolarNetwork.buildQuery(params)}`,
        now = (new Date()).toUTCString(),
        msg = `GET\n\n\n${now}\n${path}`;
    // hash the message with hmac-sha1 and base64 encode
    var hash = CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA1(msg, this.SolarNetwork.config.secret));

    var req = new XMLHttpRequest();
    req.onreadystatechange = function() {
      if (this.readyState == 4) {
        if(this.status == 200) {
          var response = JSON.parse(this.responseText);
          if(response.success) { // Callback with the JSON response
            next(null, response.data.results);
          } else { // Callback with error
            next(response);
          }
        } else { // Callback with error
          next(this.responseText);
        }
      }
    };
    req.open('GET', this.SolarNetwork.HOST + path, true);
    req.setRequestHeader('X-SN-Date', now);
    req.setRequestHeader('Authorization', `SolarNetworkWS ${this.SolarNetwork.config.token}:${hash}`);
    req.setRequestHeader('Accept', `application/json`);
    req.send();
  }

  // build a sorted query string from an object (SolarNetwork requires alphabetically sorted query parameters for authorization)
  this.buildQuery = function(params) {
    var keys = [], paramArray = [];
    for(key in params) { keys.push(key); }
    keys = keys.sort();
    for(var i = 0; i < keys.length; i++) {
      paramArray.push(keys[i] + '=' + params[keys[i]]);
    }
    return paramArray.join('&');
  }

  return this;
})();

Template.Time = (function() {
  // period suffix
  this.periodSuffixes = ['s', 'm', 'h', 'd', 'w', 'M', 'y'];

  this.queryDates = function(element) {
    var date = new Date();
  }

  // Get Date from elements attributes
  this.fromElement = function(element) {
    var now = new Date();
    var start = this.Time.startDateFromElement(element);
    var period = this.Time.periodFromString(element.getAttribute('period'));
    var aggregate = element.getAttribute('aggregate');
    if(!start) {
      if(!period) {
        return { current: true };
      } else {
        var duration = period.value * this.Time.getPeriodMultiplier(period.period);
        if(!aggregate) aggregate = this.Time.aggregateFromDuration(duration);
        return { start: this.Time.formatUrlDate(now.getTime() - duration), aggregate: aggregate };
      }
    } else {
      if(!period) {
        if(!aggregate) aggregate = this.Time.aggregateFromPeriod(start.period);
        return { start: this.Time.formatUrlDate(start.date), aggregate: aggregate };
      } else {
        var duration = period.value * this.Time.getPeriodMultiplier(period.period);
        if(!aggregate) aggregate = this.Time.aggregateFromDuration(duration);
        return {
          start: this.Time.formatUrlDate(start.date),
          end: this.Time.formatUrlDate(new Date(start.date.getTime() + duration)),
          aggregate: aggregate
        }
      }
    }
  }

  this.startDateFromElement = function(element) {
    var date = new Date();
    // Get date attributes
    function a(n) { return parseInt(element.getAttribute(n)); }
    var year = a('year'), month = a('month'), week = a('week'), day = a('day'), weekday = a('weekday'), hour = a('hour'), minute = a('minute');
    // Return current if no dates are set
    if(isNaN(year) && isNaN(month) && isNaN(week) && isNaN(day) && isNaN(weekday) && isNaN(hour) && isNaN(minute)) return null;
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
    return { date: date, period: period || 'd' };
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

  this.aggregateFromDuration = function(duration) {
    if(duration > 60000) return 'Minute';
    if(duration > 3600000) return 'Hour';
    if(duration > 86400000) return 'Day';
    if(duration > 604800000) return 'Week';
    if(duration > 2629746000) return 'Month';
    if(duration > 31536000000) return 'Year';
    return null;
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

  this.millisecondsFromPeriod = function(period) {
    var p = this.Time.periodFromString(period);
    if(!p) return null;
    return p.value * this.Time.getPeriodMultiplier(p.period);
  }

  // Format SolarNetwork date
  this.formatUrlDate = function(date) {
    var y = date.getFullYear(), M = date.getMonth() + 1, d = date.getDate(), h = date.getHours(), m = date.getMinutes();
    return `${y}-${M<10?'0'+M:M}-${d<10?'0'+d:d}T${h<10?'0'+h:h}:${m<10?'0'+m:m}`;
  }

  return this;
})();

Template.Calculate = (function() {
  this.func = function(formula, input) {
    console.log('calculate ' + formula, input);
    return (function (f, i, g) {// (formular, input, global)
      for(v in g) { this[v] = g[v] };// set global variables
      return eval(f);
    })(formula, input, this.variables);
  }

  this.round = function(value, decimals) {// Round to x decimal places
    if(isNaN(decimals)) decimals = 2;
    var multiplier = 1;
    for(var d = 0; d < decimals; d++) { multiplier *= 10; }
    return Math.round(value * multiplier) / multiplier;
  }

  return this;
})();
