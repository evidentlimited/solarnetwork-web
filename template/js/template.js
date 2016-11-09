var Template = (function() {
  window.onload = function() { Template.initiate(); };

  this.initiate = function() {
    this.loadScript('https://www.gstatic.com/charts/loader.js', Template.googleChartDependencyCallback);
    this.loadScript('https://s3-ap-southeast-2.amazonaws.com/evident-solarnetwork-web/template/lib/' + Template.dependencies[0], Template.dependencyCallback);
  }

  this.dependencies = [
    'moment.min.js',
    'moment-timezone-with-data.min.js',
    'hmac-sha1.js',
    'enc-base64.js'
  ];

  this.dependencyLoadCount = 0;
  this.config = {};
  this.variables = {};
  this.setVariable = function(key, value) { this.variables[key] = value; }
  this.pendingCharts = [];

  this.loadScript = function(url, next) {
    var elm = document.createElement('script');
    elm.type = 'application/javascript';
    elm.src = url;
    elm.onload = next;
    document.head.appendChild(elm);
  }

  this.dependencyCallback = function() {
    Template.dependencyLoadCount++;
    if(Template.dependencyLoadCount == Template.dependencies.length) {
      Template.SolarNetwork.setConfig();
      Template.SolarNetwork.getTimezone(function(err, timezone) {
        if(err) return console.log('Error getting timezone: ' + err);
        Template.SolarNetwork.config.timezone = timezone;
        Template.Datapoint.build();
      });
    } else {
      Template.loadScript('https://s3-ap-southeast-2.amazonaws.com/evident-solarnetwork-web/template/lib/' + Template.dependencies[dependencyLoadCount], Template.dependencyCallback);
    }
  }

  this.googleChartDependencyCallback = function() {
    google.charts.load('current', {'packages':['line']});
    google.charts.setOnLoadCallback(function() {
      this.Chart.doneLoading();
    });
  }

  return this;
})();

Template.Datapoint = (function() {
  this.all = function(tag) {
    return document.querySelectorAll(tag);
  }

  this.build = function() {
    var variable = this.Datapoint.all('var');
    var data = this.Datapoint.all('data');
    var chart = this.Datapoint.all('chart');
    for(var v = 0; v < variable.length; v++) {
      this.Datapoint.elementQuery(variable[v]);
      if(variable[v].getAttribute('key') && variable[v].getAttribute('value')) {
        this.setVariable(variable[v].getAttribute('key'), variable[v].getAttribute('value'));
      }
    }
    for(var d = 0; d < data.length; d++) this.Datapoint.elementQuery(data[d]);
    for(var c = 0; c < chart.length; c++) this.Datapoint.elementQuery(chart[c]);
  }

  this.elementQuery = function(Datapoint) {
    var query = this.Datapoint.getElementQuery(Datapoint);

    if(!query) return;

    Template.SolarNetwork.query(query.type, query.params, function(err, result) {
      if(err) return console.error(err);
      this.Datapoint.elementUpdate(Datapoint, result);
    });
  }

  this.getElementQuery = function(Datapoint) {
    function a(n) { return Datapoint.getAttribute(n); }
    var source = a('source'), metric = a('metric'), aggregate = a('aggregate'), round = parseInt(a('round')) || 2,
        time = Template.Time.fromElement(Datapoint),
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

    return { type: type, params, params };
  }

  this.elementUpdate = function(Datapoint, result) {
    if(Datapoint.tagName == 'CHART') {
      this.Chart.add(Datapoint, result);
      return;
    }

    function a(n) { return Datapoint.getAttribute(n); }
    var sources = a('source').split(','),
        metric = a('metric'),
        update = a('update'),
        key = a('key'),
        round = a('round') ? parseInt(a('round')) : 2,
        override = a('override'),
        modify = a('modify'),
        adjust = a('adjust'),
        average = ['false', 'no'].indexOf(a('average')) == -1,
        debug = { queryResult: result };

    var calculated = [];

    // override SolarNetwork response processing
    if(override) {
      calculated = this.Calculate.func(override, result);
      debug.overrideResult = calculated;
    } else {
      result.forEach(function(datum) {
        var idx = sources.indexOf(datum.sourceId);
        if(idx != -1 && datum[metric] != null) {
          if(!calculated[idx]) calculated[idx] = { total: 0, count: 0 };
          calculated[idx].total += datum[metric];
          calculated[idx].count++;
        }
      });
      for(c in calculated) { calculated[c] = average ? calculated[c].total / calculated[c].count : calculated[c].total };

      debug.autoProcessResult = calculated;

      // modify array of source values
      if(modify) {
        if(modify != 'none') calculated = this.Calculate.func(modify, calculated);
        debug.modifyResult = calculated;
      } else {
        var total = 0, count = 0;
        calculated.forEach(function(c) { total += c; count++ });
        calculated = total / count;
        debug.autoSumResult = calculated;
      }
    }
    // adjust single value
    if(adjust) {
      calculated = this.Calculate.func(adjust, calculated);
      debug.adjustResult = calculated;
    }
    // round the result
    calculated = this.Calculate.round(calculated, round);
    // set global variable
    if(key) this.setVariable(key, calculated);
    Datapoint.value = calculated;

    if(Datapoint.tagName == 'DATA') Datapoint.innerHTML = calculated;

    if(update) {
      var delay = this.Time.millisecondsFromPeriod(update);
      if(delay == null || delay < 1000) delay = 1000;

      debug.updateDelay = delay;

      setTimeout(function() {
        Template.Datapoint.elementQuery(Datapoint);
      }, delay);
    }

    return debug;
  }

  return this;
})();

Template.Chart = (function() {
  this.pending = [];
  this.loaded = false;

  this.add = function(Datapoint, result) {
    if(this.Chart.loaded) {
      this.Chart.draw(Datapoint, result);
    } else {
      this.Chart.pending.push({ Datapoint: Datapoint, result: result });
    }
  }

  this.doneLoading = function() {
    this.Chart.loaded = true;
    this.Chart.pending.forEach(function(pending) {
      this.Chart.draw(pending.Datapoint, pending.result);
    });
    this.Chart.pending = [];
  }

  this.draw = function(Datapoint, result) {
    function a(n) { return Datapoint.getAttribute(n); }
    var sources = a('source').split(','),
        labels = a('label').split(','),
        metric = a('metric'),
        width = parseInt(a('width')) || 900,
        height = parseInt(a('height')) || 400;
    var series = this.Data.chartFormat(result, sources, metric);

    var data = new google.visualization.DataTable();
    data.addColumn('date', 'time');
    labels.forEach(function(label) { data.addColumn('number', label); });

    data.addRows(series);

    var options = {
      chart: {
        title: 'Test',
        subtitle: 'Sub test...'
      },
      width: width,
      height: height
    };

    var chart = new google.charts.Line(Datapoint);

    chart.draw(data, options);
  }

  return this;
})();

Template.SolarNetwork = (function() {
  this.HOST = 'https://data.solarnetwork.net';

  this.setConfig = function() {
    var elements = this.Datapoint.all('data-config');
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

  this.getTimezone = function(next) {
    var req = new XMLHttpRequest();
    req.onreadystatechange = function() {
      if (this.readyState == 4) {
        if(this.status == 200) {
          var response = JSON.parse(this.responseText);
          if(response.success && response.data != null && response.data.timeZone != null) { // Callback with the JSON response
            next(null, response.data.timeZone);
          } else { // Callback with error
            next(response);
          }
        } else { // Callback with error
          next(this.responseText);
        }
      }
    };
    req.open('GET', this.SolarNetwork.HOST + '/solarquery/api/v1/pub/range/interval?nodeId=' + this.SolarNetwork.config.node, true);
    req.setRequestHeader('Accept', `application/json`);
    req.send();
  }

  return this;
})();

Template.Time = (function() {
  // period suffix
  this.periodSuffixes = ['s', 'm', 'h', 'd', 'w', 'M', 'y'];

  // Get Date from elements attributes
  this.fromElement = function(Datapoint) {
    var now = moment.tz(new Date(), Template.SolarNetwork.config.timezone);
    var start = this.Time.startDateFromElement(Datapoint);
    var period = this.Time.periodFromString(Datapoint.getAttribute('period'));
    var aggregate = Datapoint.getAttribute('aggregate');
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
        var endDate = this.Time.formatUrlDate(start.date.clone().add(duration, 'milliseconds'));
        return {
          start: this.Time.formatUrlDate(start.date),
          // end: this.Time.formatUrlDate(new Date(start.date.getTime() + duration)),
          end: endDate,
          aggregate: aggregate
        }
      }
    }
  }

  this.startDateFromElement = function(Datapoint) {
    var date = moment.tz(new Date(), Template.SolarNetwork.config.timezone);
    // Get date attributes
    function a(n) { return parseInt(Datapoint.getAttribute(n)); }
    var year = a('year'), month = a('month'), week = a('week'), day = a('day'), weekday = a('weekday'), hour = a('hour'), minute = a('minute');
    // Return current if no dates are set
    if(isNaN(year) && isNaN(month) && isNaN(week) && isNaN(day) && isNaN(weekday) && isNaN(hour) && isNaN(minute)) return null;
    // Relative date
    var period = null;
    if(!isNaN(year) && year <= 0) { period = 'y'; date.add(year, 'y'); }
    if(!isNaN(month) && month <= 0) { period = 'M'; date.add(month, 'M'); }
    if(!isNaN(week) && week <= 0) { period = 'w'; date.add(week, 'w'); }
    if(!isNaN(day) && day <= 0) { period = 'd'; date.add(day, 'd'); }
    if(!isNaN(weekday) && weekday <= 0) { period = 'd'; date.add(weekday, 'w'); }
    if(!isNaN(hour) && hour <= 0) { period = 'h'; date.add(hour, 'h'); }
    if(!isNaN(minute) && minute <= 0) { period = 'm'; date.add(minute, 'm'); }
    if(period) date = this.Time.roundToPeriod(date, period);
    // Offset date
    if(!isNaN(year) && year > 0) { date.year(year); }
    if(!isNaN(month) && month > 0) { date.month(month - 1); }
    if(!isNaN(week) && week > 0) {
      date.add(week, 'w');
    }
    if(!isNaN(day) && day > 0) { date.date(day); }
    if(!isNaN(weekday) && weekday > 0) { date.day(weekday); }
    if(!isNaN(hour) && hour >= 0) { date.hour(hour); }
    if(!isNaN(minute) && minute >= 0) { date.minute(minute); }
    // Return time object
    return { date: date, period: period || 'd' };
  }

  // Period from Datapoint
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
    if(duration > 2629746000) return 'Month';
    if(duration > 604800000) return 'Week';
    if(duration > 86400000) return 'Day';
    if(duration > 3600000) return 'Hour';
    if(duration > 60000) return 'Minute';
    return null;
  }

  // Round to peiod
  this.roundToPeriod = function(date, period) {
    var d = moment.tz(date, Template.SolarNetwork.config.timezone);
    d.millisecond(0);
    if(period == 's') return d;
    d.second(0);
    if(period == 'm') return d;
    d.minute(0);
    if(period == 'h') return d;
    d.hour(0);
    if(period == 'd') return d;
    if(period == 'w') {
      d.day(1);
      return d;
    }
    d.date(1);
    if(period == 'M') return d;
    d.month(0);
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
    // var y = date.getFullYear(), M = date.getMonth() + 1, d = date.getDate(), h = date.getHours(), m = date.getMinutes();
    // return `${y}-${M<10?'0'+M:M}-${d<10?'0'+d:d}T${h<10?'0'+h:h}:${m<10?'0'+m:m}`;
    return date.toISOString().substring(0,16);
  }

  return this;
})();

Template.Calculate = (function() {
  this.func = function(formula, input) {
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

Template.Data = (function() {

  this.chartFormat = function(list, sourceIds, metric) {
    var data = [];
    list.forEach(function(stamp) {
      var sourceIndex = sourceIds.indexOf(stamp.sourceId);
      if(sourceIndex == -1) return;
      var date = new Date(stamp.created);
      for (var d = 0; d < data.length; d++) {
        if(data[d][0].getTime() == date.getTime()) return data[d][sourceIndex + 1] = stamp[metric];
      }
      var row = [date];
      sourceIds.forEach(function(id) { row.push(null) });
      row[sourceIndex + 1] = stamp[metric];
      data.push(row);
    });
    console.log(data);
    return data;
  }

  return this;
})();
