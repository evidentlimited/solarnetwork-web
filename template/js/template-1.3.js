var SolarTemplate = (function() {
  window.onload = function() { SolarTemplate.initiate(); };

  var initiate = function() {
    SolarTemplate.loadScript('https://www.gstatic.com/charts/loader.js', SolarTemplate.googleChartDependencyCallback);
    SolarTemplate.loadScript('https://s3-ap-southeast-2.amazonaws.com/data-platform-static-files/energy-chart-1.0.0.js', SolarTemplate.energyChartDependencyCallback);
    SolarTemplate.loadScript('https://s3-ap-southeast-2.amazonaws.com/evident-solarnetwork-web/template/lib/' + SolarTemplate.dependencies[0], SolarTemplate.dependencyCallback);
  }

  var dependencies = [
    'moment.min.js',
    'moment-timezone-with-data.min.js',
    'hmac-sha1.js',
    'enc-base64.js'
  ];

  var chartTags = [
    'chart-line',
    'chart-bar',
    'chart-area',
    'chart-pie',
    'chart-energy'
  ];

  var setVariable = function(key, value) {
    SolarTemplate.variables[key] = value;
  }

  var loadScript = function(url, next) {
    var elm = document.createElement('script');
    elm.type = 'application/javascript';
    elm.src = url;
    elm.onload = next;
    document.head.appendChild(elm);
  }

  var dependencyCallback = function() {
    SolarTemplate.dependencyLoadCount++;
    if(SolarTemplate.dependencyLoadCount == SolarTemplate.dependencies.length) {
      SolarTemplate.done = true;
      SolarTemplate.update();
    } else {
      SolarTemplate.loadScript('https://s3-ap-southeast-2.amazonaws.com/evident-solarnetwork-web/template/lib/' + SolarTemplate.dependencies[SolarTemplate.dependencyLoadCount], SolarTemplate.dependencyCallback);
    }
  }

  var googleChartDependencyCallback = function() {
    google.charts.load('current', {'packages': ['corechart', 'line', 'bar']});
    google.charts.setOnLoadCallback(function() {
      SolarTemplate.Chart.doneLoading('google');
    });
  }

  var energyChartDependencyCallback = function() {
    SolarTemplate.Chart.doneLoading('energy');
  }

  var update = function() {
    if(SolarTemplate.done) {
      console.log('Update');
      SolarTemplate.SolarNetwork.setConfig();
      SolarTemplate.SolarNetwork.getTimezone(function(err, timezone) {
        if(err) return console.log('Error getting timezone', err);
        SolarTemplate.SolarNetwork.config.timezone = timezone;
        SolarTemplate.Datapoint.build();
      });
    }
  }

  var Datapoint = (function() {
    var all = function(tag) {
      return document.querySelectorAll(tag);
    }

    var build = function() {
      var variable = SolarTemplate.Datapoint.all('var');
      var data = SolarTemplate.Datapoint.all('data');
      for(var v = 0; v < variable.length; v++) {
        SolarTemplate.Datapoint.elementQuery(variable[v]);
        if(variable[v].getAttribute('key') && variable[v].getAttribute('value')) {
          SolarTemplate.setVariable(variable[v].getAttribute('key'), variable[v].getAttribute('value'));
        }
      }
      for(var d = 0; d < data.length; d++) SolarTemplate.Datapoint.elementQuery(data[d]);
      SolarTemplate.chartTags.forEach(function(tag) {
        SolarTemplate.Datapoint.all(tag).forEach(function(chart) {
          SolarTemplate.Datapoint.elementQuery(chart);
        });
      });
    }

    var elementQuery = function(element) {
      var query = SolarTemplate.Datapoint.getElementQuery(element);

      if(!query) return;

      SolarTemplate.SolarNetwork.query(query.type, query.params, function(err, result, path) {
        if(query.debug) { console.log(element, query, path, result); }
        if(err) return console.error(err);
        SolarTemplate.Datapoint.elementUpdate(element, result);
      });
    }

    var getElementQuery = function(element) {
      function a(n) { return element.getAttribute(n); }
      var source = a('source'),
          metric = a('metric'),
          aggregate = a('aggregate'),
          round = parseInt(a('round')) || 2,
          time = SolarTemplate.DateTime.fromElement(element),
          update = SolarTemplate.DateTime.periodFromString(a('update')),
          debug = a('debug');

      if(!source) return;

      var params = {};

      var formatted = SolarTemplate.SolarNetwork.formatSources(source);

      params.sourceIds = formatted.source.join(',');
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

    var elementUpdate = function(element, result) {
      var tag = element.tagName.toLowerCase();
      if(SolarTemplate.chartTags.indexOf(tag) != -1) {
        SolarTemplate.Chart.add(element, result);
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
        calculated = SolarTemplate.Calculate.func(override, result);
        debug.overrideResult = calculated;
      } else {
        result.forEach(function(datum) {
          for(var s = 0; s < sources.length; s++) {
            var split = sources[s].split(':');
            if(split[0] == datum.sourceId) {
              var m = split.length > 1 ? split[1] : metric;
              if(datum[m] != null) {
                if(!calculated[s]) calculated[s] = { total: 0, count: 0 };
                calculated[s].total += datum[m];
                calculated[s].count++;
              }
            }
          }
        });
        for(c in calculated) { calculated[c] = average ? calculated[c].total / calculated[c].count : calculated[c].total };

        debug.autoProcessResult = calculated;

        // modify array of source values
        if(modify) {
          if(modify != 'none') calculated = SolarTemplate.Calculate.func(modify, calculated);
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
        calculated = SolarTemplate.Calculate.func(adjust, calculated);
        debug.adjustResult = calculated;
      }
      // round the result
      calculated = SolarTemplate.Calculate.round(calculated, round);
      // set global variable
      if(key) SolarTemplate.setVariable(key, calculated);
      element.value = calculated;

      element.innerHTML = calculated;

      if(update) {
        var delay = SolarTemplate.DateTime.millisecondsFromPeriod(update);
        if(delay == null || delay < 1000) delay = 1000;

        debug.updateDelay = delay;

        setTimeout(function() {
          SolarTemplate.Datapoint.elementQuery(element);
        }, delay);
      }

      return debug;
    }

    return {
      all: all,
      build: build,
      elementQuery: elementQuery,
      getElementQuery: getElementQuery,
      elementUpdate: elementUpdate
    };
  })();

  var Chart = (function() {
    var pending = { google: [], energy: [] };
    var loaded = { google: false, energy: false };

    var add = function(element, result) {
      var type = SolarTemplate.Chart.typeFromTag(element.tagName);
      if(SolarTemplate.Chart.loaded[type]) {
        SolarTemplate.Chart.draw(element, result);
      } else {
        SolarTemplate.Chart.pending[type].push({ element: element, result: result });
      }
    }

    var doneLoading = function(type) {
      SolarTemplate.Chart.loaded[type] = true;
      SolarTemplate.Chart.pending[type].forEach(function(pending) {
        SolarTemplate.Chart.draw(pending.element, pending.result);
      });
      SolarTemplate.Chart.pending[type] = [];
    }

    var draw = function(element, result) {
      var type = SolarTemplate.Chart.typeFromTag(element.tagName);
      switch(type) {
        case 'google': SolarTemplate.Chart.drawGoogle(element, result); break;
        case 'energy': SolarTemplate.Chart.drawEnergy(element, result); break;
        default: console.log('Chart type "' + type + '" does not exist');
      }
    }

    var drawEnergy = function(element, result) {
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

      var calculated = SolarTemplate.DataProcessing.datumsToSumArray(result, sources, metric, average);

      var data = { consumption: calculated[0], generation: calculated[1] };

      if(element.chart == null) {
        element.chart = new energyChart(options);
      }

      element.chart.draw(null, data);
    }

    var drawGoogle = function(element, result) {
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
          colors = a('colors') ? a('colors').split(',') : null,
          legendPosition = a('legend-position') || 'right',
          stack = !!a('stack'),
          timeFormat = a('time-format'),
          pieHole = parseFloat(a('pie-hole')) || null,
          pieSliceBorder = a('pie-border');

      if(tag == 'chart-pie') { // pie charts
        var data = new google.visualization.arrayToDataTable(SolarTemplate.DataProcessing.pieChartFormat(result, sources, labels, metric, average));

        console.log(data);

        var options = {
          title: title,
          subtitle: subtitle,
          titleTextStyle: { color: color },
          width: width,
          height: height,
          backgroundColor: background,
          colors: colors,
          legend: { position: legendPosition, textStyle: { color: color } },
          pieHole: pieHole,
          pieSliceBorderColor: pieSliceBorder
        };

        var chart = new google.visualization.PieChart(element);
        chart.draw(data, options);
      } else { // non pie charts (line, bar and area)
        var series = SolarTemplate.DataProcessing.chartFormat(result, sources, metric);
        var data = new google.visualization.DataTable();
        data.addColumn('date', 'time');
        if(labels) {
          for(var s = 0; s < sources.length; s++) { data.addColumn('number', s < labels.length ? labels[s] : sources[s]); }
        } else {
          sources.forEach(function(source) { data.addColumn('number', source); });
        }
        data.addRows(series);

        if(timeFormat) {
          var dateFormatter = new google.visualization.DateFormat({ pattern: timeFormat });
          dateFormatter.format(data, 0);
        }

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
            format: timeFormat,
            textStyle: { color: color },
            gridlines: {
              color: gridlines || color,
              count: -1
            }
          },
          legend: { position: legendPosition, textStyle: { color: color } },
          colors: colors,
          isStacked: stack
        };

        switch (tag) {
          case 'chart-line':
            var chart = new google.charts.Line(element);
            chart.draw(data, google.charts.Bar.convertOptions(options));
            break;
          case 'chart-bar':
            var chart = new google.charts.Bar(element);
            chart.draw(data, google.charts.Bar.convertOptions(options));
            break;
          case 'chart-area':
            var chart = new google.visualization.AreaChart(element);
            chart.draw(data, options);
            break;
        }
      }
    }

    var typeFromTag = function(tag) {
      switch(tag.toLowerCase()) {
        case 'chart-line':
        case 'chart-bar':
        case 'chart-area':
        case 'chart-pie':
          return 'google';
        case 'chart-energy':
          return 'energy';
      }
      return null;
    }

    return {
      pending: pending,
      loaded: loaded,
      add: add,
      doneLoading: doneLoading,
      draw: draw,
      drawEnergy: drawEnergy,
      drawGoogle: drawGoogle,
      typeFromTag: typeFromTag
    };
  })();

  var SolarNetwork = (function() {
    var setConfig = function() {
      var elements = SolarTemplate.Datapoint.all('data-config');
      SolarTemplate.SolarNetwork.config = {};
      for(var e = 0; e < elements.length; e++) {
        if(elements[e].getAttribute('node')) SolarTemplate.SolarNetwork.config.node = elements[e].getAttribute('node');
        if(elements[e].getAttribute('token')) SolarTemplate.SolarNetwork.config.token = elements[e].getAttribute('token');
        if(elements[e].getAttribute('secret')) SolarTemplate.SolarNetwork.config.secret = elements[e].getAttribute('secret');
      }
    }

    // make an authenticated request
    var query = function(type, params, next) {
      params.nodeId = SolarTemplate.SolarNetwork.config.node;
      var path = `/solarquery/api/v1/sec/datum/${type}?${SolarTemplate.SolarNetwork.buildQuery(params)}`,
          now = (new Date()).toUTCString(),
          msg = `GET\n\n\n${now}\n${path}`;
      // hash the message with hmac-sha1 and base64 encode
      var hash = CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA1(msg, SolarTemplate.SolarNetwork.config.secret));

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
      req.open('GET', SolarTemplate.SolarNetwork.HOST + path, true);
      req.setRequestHeader('X-SN-Date', now);
      req.setRequestHeader('Authorization', `SolarNetworkWS ${SolarTemplate.SolarNetwork.config.token}:${hash}`);
      req.setRequestHeader('Accept', `application/json`);
      req.send();
    }

    // build a sorted query string from an object (SolarNetwork requires alphabetically sorted query parameters for authorization)
    var buildQuery = function(params) {
      var keys = [], paramArray = [];
      for(key in params) { keys.push(key); }
      keys = keys.sort();
      for(var i = 0; i < keys.length; i++) {
        paramArray.push(keys[i] + '=' + params[keys[i]]);
      }
      return paramArray.join('&');
    }

    var getTimezone = function(next) {
      var path = '/solarquery/api/v1/sec/range/interval?nodeId=' + SolarTemplate.SolarNetwork.config.node,
          now = (new Date()).toUTCString(),
          msg = `GET\n\n\n${now}\n${path}`;
      // hash the message with hmac-sha1 and base64 encode
      var hash = CryptoJS.enc.Base64.stringify(CryptoJS.HmacSHA1(msg, SolarTemplate.SolarNetwork.config.secret));

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
      req.open('GET', SolarTemplate.SolarNetwork.HOST + path, true);
      req.setRequestHeader('X-SN-Date', now);
      req.setRequestHeader('Authorization', `SolarNetworkWS ${SolarTemplate.SolarNetwork.config.token}:${hash}`);
      req.setRequestHeader('Accept', `application/json`);
      req.send();
    }

    var formatSources = function(source) {
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

    return {
      HOST: 'https://data.solarnetwork.net',
      setConfig: setConfig,
      query: query,
      buildQuery: buildQuery,
      getTimezone: getTimezone,
      formatSources: formatSources
    };
  })();

  var DateTime = (function() {
    // Get Date from elements attributes
    var fromElement = function(element) {
      var now = moment.tz(new Date(), SolarTemplate.SolarNetwork.config.timezone);
      var start = SolarTemplate.DateTime.startDateFromElement(element);
      var period = SolarTemplate.DateTime.periodFromString(element.getAttribute('period'));
      var aggregate = element.getAttribute('aggregate');
      if(!start) {
        if(!period) {
          return { current: true };
        } else {
          var duration = period.value * SolarTemplate.DateTime.getPeriodMultiplier(period.period);
          if(!aggregate) aggregate = SolarTemplate.DateTime.aggregateFromDuration(duration);
          return { start: SolarTemplate.DateTime.formatUrlDate(new Date(now.valueOf() - duration)), aggregate: aggregate };
        }
      } else {
        if(!period) {
          if(!aggregate) aggregate = SolarTemplate.DateTime.aggregateFromPeriod(start.period);
          return { start: SolarTemplate.DateTime.formatUrlDate(start.date), aggregate: aggregate };
        } else {
          var duration = period.value * SolarTemplate.DateTime.getPeriodMultiplier(period.period);
          if(!aggregate) aggregate = SolarTemplate.DateTime.aggregateFromDuration(duration);
          var endDate = SolarTemplate.DateTime.formatUrlDate(start.date.clone().add(duration, 'milliseconds'));
          return {
            start: SolarTemplate.DateTime.formatUrlDate(start.date),
            // end: SolarTemplate.DateTime.formatUrlDate(new Date(start.date.getTime() + duration)),
            end: endDate,
            aggregate: aggregate
          }
        }
      }
    }

    var startDateFromElement = function(element) {
      var date = moment.tz(new Date(), SolarTemplate.SolarNetwork.config.timezone);
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
      if(period) date = SolarTemplate.DateTime.roundToPeriod(date, period);
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
    var periodFromString = function(period) {
      if(period == null || period.length == 0) return null;
      var suffix = period[period.length - 1];
      var value = parseFloat(period.slice(0, -1));
      // The suffix isn't an allowed period
      if(SolarTemplate.DateTime.periodSuffixes.indexOf(suffix) == -1) {
        var v = parseFloat(period);
        if(isNaN(v)) return null; // invalid period
        value = v;
        suffix = 's';
      };
      if(isNaN(value)) value = 1;
      return { value: value, period: suffix };
    }

    // Get period multiplier (milliseconds conversion)
    var getPeriodMultiplier = function(period) {
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

    var aggregateFromDuration = function(duration) {
      if(duration > 2629746000) return 'Month';
      if(duration > 604800000) return 'Week';
      if(duration > 86400000) return 'Day';
      if(duration > 3600000) return 'Hour';
      if(duration > 60000) return 'Minute';
      return null;
    }

    // Round to peiod
    var roundToPeriod = function(date, period) {
      var d = moment.tz(date, SolarTemplate.SolarNetwork.config.timezone);
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
    var aggregateFromPeriod = function(period) {
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

    var millisecondsFromPeriod = function(period) {
      var p = SolarTemplate.DateTime.periodFromString(period);
      if(!p) return null;
      return p.value * SolarTemplate.DateTime.getPeriodMultiplier(p.period);
    }

    // Format SolarNetwork date
    var formatUrlDate = function(date) {
      return date.toISOString().substring(0,16);
    }

    return {
      periodSuffixes: ['s', 'm', 'h', 'd', 'w', 'M', 'y'],
      fromElement: fromElement,
      startDateFromElement: startDateFromElement,
      periodFromString: periodFromString,
      getPeriodMultiplier: getPeriodMultiplier,
      aggregateFromDuration: aggregateFromDuration,
      roundToPeriod: roundToPeriod,
      aggregateFromPeriod: aggregateFromPeriod,
      millisecondsFromPeriod: millisecondsFromPeriod,
      formatUrlDate: formatUrlDate
    };
  })();

  var Calculate = (function() {
    var func = function(formula, input) {
      return (function (f, i, g) {// (formular, input, global)
        for(v in g) { this[v] = g[v] };// set global variables
        return eval(f);
      })(formula, input, SolarTemplate.variables);
    }

    var round = function(value, decimals) {// Round to x decimal places
      if(isNaN(decimals)) decimals = 2;
      var multiplier = 1;
      for(var d = 0; d < decimals; d++) { multiplier *= 10; }
      return Math.round(value * multiplier) / multiplier;
    }

    return {
      func: func,
      round: round
    };
  })();

  var DataProcessing = (function() {
    var chartFormat = function(list, sourceIds, metric) {
      var data = [];
      list.forEach(function(stamp) {
        for(var s = 0; s < sourceIds.length; s++) {
          var split = sourceIds[s].split(':');
          var m = split.length > 1 ? split[1] : metric;
          if(split[0] == stamp.sourceId && stamp[m] != null) {
            var date = new Date(stamp.created);
            for (var d = 0; d < data.length; d++) {
              if(data[d][0].getTime() == date.getTime()) return data[d][s + 1] = stamp[m];
            }
            var row = [date];
            sourceIds.forEach(function(id) { row.push(null) });
            row[s + 1] = stamp[m];
            data.push(row);
          }
        }
      });
      return data;
    }

    var datumsToSumArray = function(result, sources, metric, average) {
      var calculated = [];

      result.forEach(function(datum) {
        for(var s = 0; s < sources.length; s++) {
          var split = sources[s].split(':');
          if(split[0] == datum.sourceId) {
            var m = split.length > 1 ? split[1] : metric;
            if(datum[m] != null) {
              if(!calculated[s]) calculated[s] = { total: 0, count: 0 };
              calculated[s].total += datum[m];
              calculated[s].count++;
            }
          }
        }
      });

      var array = [];

      for(c in calculated) {
        array.push(average ? calculated[c].total / calculated[c].count : calculated[c].total);
      }

      return array;
    }

    var pieChartFormat = function(result, sources, labels, metric, average) {
      var table = [['Datapoint', metric]];

      var calculated = SolarTemplate.DataProcessing.datumsToSumArray(result, sources, metric, average);

      for(c in calculated) {
        if(labels != null && labels[c] != null) {
          table.push([labels[c], calculated[c]]);
        } else {
          table.push([sources[c], calculated[c]]);
        }
      }

      return table;
    }

    return {
      chartFormat: chartFormat,
      datumsToSumArray: datumsToSumArray,
      pieChartFormat: pieChartFormat
    };
  })();

  return {
    done: false,
    dependencyLoadCount: 0,
    config: {},
    variables: {},
    setVariable: setVariable,
    pendingCharts: [],
    initiate: initiate,
    dependencies: dependencies,
    chartTags: chartTags,
    loadScript: loadScript,
    dependencyCallback: dependencyCallback,
    googleChartDependencyCallback: googleChartDependencyCallback,
    energyChartDependencyCallback: energyChartDependencyCallback,
    update: update,
    Datapoint: Datapoint,
    Chart: Chart,
    SolarNetwork: SolarNetwork,
    DateTime: DateTime,
    Calculate: Calculate,
    DataProcessing: DataProcessing
  };
})();
