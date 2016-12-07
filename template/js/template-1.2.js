var Template = (function() {
  window.onload = function() { Template.initiate(); };

  this.initiate = function() {
    this.loadScript('https://www.gstatic.com/charts/loader.js', Template.googleChartDependencyCallback);
    this.loadScript('https://s3-ap-southeast-2.amazonaws.com/data-platform-static-files/energy-chart-1.0.0.js', Template.energyChartDependencyCallback);
    this.loadScript('https://s3-ap-southeast-2.amazonaws.com/evident-solarnetwork-web/template/lib/' + Template.dependencies[0], Template.dependencyCallback);
  }

  this.dependencies = [
    'moment.min.js',
    'moment-timezone-with-data.min.js',
    'hmac-sha1.js',
    'enc-base64.js'
  ];

  this.chartTags = [
    'chart-line',
    'chart-bar',
    'chart-pie',
    'chart-energy'
  ];

  this.done = false;
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
      Template.done = true;
      Template.update();
    } else {
      Template.loadScript('https://s3-ap-southeast-2.amazonaws.com/evident-solarnetwork-web/template/lib/' + Template.dependencies[dependencyLoadCount], Template.dependencyCallback);
    }
  }

  this.googleChartDependencyCallback = function() {
    google.charts.load('current', {'packages': ['corechart', 'line', 'bar']});
    google.charts.setOnLoadCallback(function() {
      Template.Chart.doneLoading('google');
    });
  }

  this.energyChartDependencyCallback = function() {
    Template.Chart.doneLoading('energy');
  }

  this.update = function() {
    if(this.done) {
      console.log('Update');
      Template.SolarNetwork.setConfig();
      Template.SolarNetwork.getTimezone(function(err, timezone) {
        if(err) return console.log('Error getting timezone: ' + err);
        Template.SolarNetwork.config.timezone = timezone;
        Template.Datapoint.build();
      });
    }
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
    for(var v = 0; v < variable.length; v++) {
      this.Datapoint.elementQuery(variable[v]);
      if(variable[v].getAttribute('key') && variable[v].getAttribute('value')) {
        this.setVariable(variable[v].getAttribute('key'), variable[v].getAttribute('value'));
      }
    }
    for(var d = 0; d < data.length; d++) this.Datapoint.elementQuery(data[d]);
    this.chartTags.forEach(function(tag) {
      this.Datapoint.all(tag).forEach(function(chart) {
        this.Datapoint.elementQuery(chart);
      });
    });
  }

  this.elementQuery = function(element) {
    var query = this.Datapoint.getElementQuery(element);

    if(!query) return;

    Template.SolarNetwork.query(query.type, query.params, function(err, result, path) {
      if(err) return console.error(err);
      if(query.debug) { console.log(element, query, path); }
      this.Datapoint.elementUpdate(element, result);
    });
  }

  this.getElementQuery = function(element) {
    function a(n) { return element.getAttribute(n); }
    var source = a('source'),
        metric = a('metric'),
        aggregate = a('aggregate'),
        round = parseInt(a('round')) || 2,
        time = Template.DateTime.fromElement(element),
        update = Template.DateTime.periodFromString(a('update')),
        debug = a('debug');

    if(!source || !metric) return;

    var params = {};

      // [source.indexOf(',') == -1 ? 'sourceId' : 'sourceIds']: source
    // };

    // if(source.indexOf(':') == -1) {
    //   params.sourceIds = source;
    //   params.dataPath = 'i.' + metric;
    // } else {
    //   var sourceList = [];
    //   var metricList = [];
    //   source.split(',').forEach(function(s) {
    //     var split = s.split(':');
    //     if(sourceList.indexOf(split[0] != null))
    //   });
    // }

    var formatted = Template.SolarNetwork.formatSources(source);

    params.sourceId = formatted.source.join(',');
    if(formatted.metric.length == 1 && !metric) params.dataPath = 'i.' + formatted.metric[0];
    else if(formatted.metric.length == 0) params.dataPath = 'i.' + metric;

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

    return { type: type, params: params, debug: debug != null };
  }

  this.elementUpdate = function(element, result) {
    var tag = element.tagName.toLowerCase();
    if(this.chartTags.indexOf(tag) != -1) {
      this.Chart.add(element, result);
      return;
    }

    function a(n) { return element.getAttribute(n); }
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
        for(var s in sources) {
          var split = sources[s].split(':');
          if(split[0] == datum.sourceId) {
            var m = split.length > 1 ? split[1] : metric;
            if(datum[metric] != null) {
              if(!calculated[s]) calculated[s] = { total: 0, count: 0 };
              calculated[s].total += datum[metric];
              calculated[s].count++;
            }
          }
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
    element.value = calculated;

    element.innerHTML = calculated;

    if(update) {
      var delay = this.DateTime.millisecondsFromPeriod(update);
      if(delay == null || delay < 1000) delay = 1000;

      debug.updateDelay = delay;

      setTimeout(function() {
        Template.Datapoint.elementQuery(element);
      }, delay);
    }

    return debug;
  }

  return this;
})();

Template.Chart = (function() {
  this.pending = { google: [], energy: [] };
  this.loaded = { google: false, energy: false };

  this.add = function(element, result) {
    var type = this.Chart.typeFromTag(element.tagName);
    if(this.Chart.loaded[type]) {
      this.Chart.draw(element, result);
    } else {
      this.Chart.pending[type].push({ element: element, result: result });
    }
  }

  this.doneLoading = function(type) {
    this.Chart.loaded[type] = true;
    this.Chart.pending[type].forEach(function(pending) {
      this.Chart.draw(pending.element, pending.result);
    });
    this.Chart.pending[type] = [];
  }

  this.draw = function(element, result) {
    var type = this.Chart.typeFromTag(element.tagName);
    switch(type) {
      case 'google': this.Chart.drawGoogle(element, result); break;
      case 'energy': this.Chart.drawEnergy(element, result); break;
      default: console.log('Chart type "' + type + '" does not exist');
    }
  }

  this.drawEnergy = function(element, result) {
    function a(n) { return element.getAttribute(n); }
    var sources = a('source').split(','),
        metric = a('metric'),
        width = parseInt(a('width')) || 400,
        height = parseInt(a('height')) || 300,
        average = ['false', 'no'].indexOf(a('average')) == -1;

    element.innerHTML = '';
    element.setAttribute('style',`display:block;width:${width}px;height:${height}px`);

    var options = {
  		element: element,
      width: width,
      height: height,
  		text:{ titleSize: 10, valueSize: 12, margin: 1 },
  		datapoints:{ consumption: "consumption", generation: "generation" },
  		circle:{ margin: 30, padding: 4, size: 30 },
  		line:{ size: 4, gap: 2 },
  		animate: true,
  		animation:{ size: 4, rate: 3, speed: 3, scaleSpeed: 0.5, fps: 20 }
  	};

    var calculated = this.DataProcessing.datumsToSumArray(result, sources, metric, average);

    var data = { consumption: calculated[0], generation: calculated[1] };

    if(element.chart == null) {
      element.chart = new energyChart(options);
    }

    element.chart.draw(null, data);
  }

  this.drawGoogle = function(element, result) {
    function a(n) { return element.getAttribute(n); }
    var tag = element.tagName.toLowerCase(),
        sources = a('source').split(','),
        labels = a('label') ? a('label').split(',') : null,
        metric = a('metric'),
        width = parseInt(a('width')) || 900,
        height = parseInt(a('height')) || 400,
        title = a('title') || null,
        subtitle = a('subtitle') || null,
        average = ['false', 'no'].indexOf(a('average')) == -1,
        color = a('color') || 'black',
        background = a('background') || 'none',
        gridlines = a('gridlines'),
        stacked = a('stacked'),
        colors = a('colors');


    var data;

    if(tag == 'chart-pie') { // pie charts
      data = new google.visualization.arrayToDataTable(this.DataProcessing.pieChartFormat(result, sources, labels, metric, average));

      var options = {
        title: title,
        subtitle: subtitle,
        titleTextStyle: { color: color },
        width: width,
        height: height,
        backgroundColor: background,
        colors: colors,
        legend: { textStyle: { color: color } }
      };

      var chart = new google.visualization.PieChart(element);
      chart.draw(data, options);
    } else { // non pie charts (line and bar)
      var series = this.DataProcessing.chartFormat(result, sources, metric);
      data = new google.visualization.DataTable();
      data.addColumn('date', 'time');
      if(labels) {
        labels.forEach(function(label) { data.addColumn('number', label); });
      } else {
        sources.forEach(function(source) { data.addColumn('number', source); });
      }
      data.addRows(series);

      var options = {
        title: title,
        subtitle: subtitle,
        chartArea: { backgroundColor: background },
        width: width,
        height: height,
        backgroundColor: background,
        titleTextStyle: { color: color },
        textStyle: { color: color },
        vAxis: {
          viewWindowMode: 'explicit',
          viewWindow: { min: 0 },
          textStyle: { color: color },
          gridlines: { color: gridlines || color }
        },
        hAxis: {
          textStyle: { color: color },
          gridlines: { color: gridlines || color }
        },
        legend: { textStyle: { color: color } },
        colors: colors
      };

      var chart = tag == 'chart-line' ? new google.charts.AreaChart(element) : new google.charts.Bar(element);
      chart.draw(data, google.charts.Bar.convertOptions(options));
    }
  }

  this.typeFromTag = function(tag) {
    switch(tag.toLowerCase()) {
      case 'chart-line':
      case 'chart-bar':
      case 'chart-pie':
        return 'google';
      case 'chart-energy':
        return 'energy';
    }
    return null;
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
            next(null, response.data.results, path);
          } else { // Callback with error
            next(response, null, path);
          }
        } else { // Callback with error
          next(this.responseText, null, path);
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

  this.formatSources = function(source) {
    var formatted = {};
    if(source.indexOf(':') == -1) {
      formatted = { source: source.split(','), metric: [] };
    } else {
      formatted = { source: [], metric: [] };
      source.split(',').forEach(function(s) {
        var split = s.split(':');
        if(formatted.source.indexOf(split[0] == -1)) formatted.source.push(split[0]);
        if(split.length > 1 && formatted.metric.indexOf(split[1]) == -1) formatted.metric.push(split[1]);
      });
    }
    return formatted;
  }

  return this;
})();

Template.DateTime = (function() {
  // period suffix
  this.periodSuffixes = ['s', 'm', 'h', 'd', 'w', 'M', 'y'];

  // Get Date from elements attributes
  this.fromElement = function(element) {
    var now = moment.tz(new Date(), Template.SolarNetwork.config.timezone);
    var start = this.DateTime.startDateFromElement(element);
    var period = this.DateTime.periodFromString(element.getAttribute('period'));
    var aggregate = element.getAttribute('aggregate');
    if(!start) {
      if(!period) {
        return { current: true };
      } else {
        var duration = period.value * this.DateTime.getPeriodMultiplier(period.period);
        if(!aggregate) aggregate = this.DateTime.aggregateFromDuration(duration);
        return { start: this.DateTime.formatUrlDate(new Date(now.valueOf() - duration)), aggregate: aggregate };
      }
    } else {
      if(!period) {
        if(!aggregate) aggregate = this.DateTime.aggregateFromPeriod(start.period);
        return { start: this.DateTime.formatUrlDate(start.date), aggregate: aggregate };
      } else {
        var duration = period.value * this.DateTime.getPeriodMultiplier(period.period);
        if(!aggregate) aggregate = this.DateTime.aggregateFromDuration(duration);
        var endDate = this.DateTime.formatUrlDate(start.date.clone().add(duration, 'milliseconds'));
        return {
          start: this.DateTime.formatUrlDate(start.date),
          // end: this.DateTime.formatUrlDate(new Date(start.date.getTime() + duration)),
          end: endDate,
          aggregate: aggregate
        }
      }
    }
  }

  this.startDateFromElement = function(element) {
    var date = moment.tz(new Date(), Template.SolarNetwork.config.timezone);
    // Get date attributes
    function a(n) { return parseInt(element.getAttribute(n)); }
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
    if(period) date = this.DateTime.roundToPeriod(date, period);
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
    // Return DateTime object
    return { date: date, period: period || 'd' };
  }

  // Period from element
  this.periodFromString = function(period) {
    if(period == null || period.length == 0) return null;
    var suffix = period[period.length - 1];
    var value = parseFloat(period.slice(0, -1));
    // The suffix isn't an allowed period
    if(this.DateTime.periodSuffixes.indexOf(suffix) == -1) {
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
    var p = this.DateTime.periodFromString(period);
    if(!p) return null;
    return p.value * this.DateTime.getPeriodMultiplier(p.period);
  }

  // Format SolarNetwork date
  this.formatUrlDate = function(date) {
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

Template.DataProcessing = (function() {

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
    return data;
  }

  this.datumsToSumArray = function(result, sources, metric, average) {
    var calculated = [];


    result.forEach(function(datum) {
      var idx = sources.indexOf(datum.sourceId);
      if(idx != -1 && datum[metric] != null) {
        if(!calculated[idx]) calculated[idx] = { total: 0, count: 0 };
        calculated[idx].total += datum[metric];
        calculated[idx].count++;
      }
    });

    var array = [];

    for(c in calculated) {
      array.push(average ? calculated[c].total / calculated[c].count : calculated[c].total);
    }

    return array;
  }

  this.pieChartFormat = function(result, sources, labels, metric, average) {
    var table = [['Datapoint', metric]];

    // var calculated = [];
    //
    // result.forEach(function(datum) {
    //   var idx = sources.indexOf(datum.sourceId);
    //   if(idx != -1 && datum[metric] != null) {
    //     if(!calculated[idx]) calculated[idx] = { total: 0, count: 0 };
    //     calculated[idx].total += datum[metric];
    //     calculated[idx].count++;
    //   }
    // });

    // console.log(calculated);

    var calculated = this.DataProcessing.datumsToSumArray(result, sources, metric, average);

    for(c in calculated) {
      if(labels != null && labels[c] != null) {
        table.push([labels[c], calculated[c]]);
      } else {
        table.push([sources[c], calculated[c]]);
      }
    }

    return table;
  }

  return this;
})();
