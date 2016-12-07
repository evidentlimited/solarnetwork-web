class Intent {

  constructor(input) {
    this.input = input;
  }

  get isValid() {
    return this.intent != null;
  }

  get responseFallback() {
    var responses = [
      'Sorry, I couldn\'t find what you were looking for',
      'Sorry, I didn\'t understand your request',
      'I was unable to find what you wanted, please try something else'
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  get query() {
    this.intent = (new Interpret(this.input)).intent;
    if(this.intent) {
      switch (this.intent.action) {
        case 'data.current': return this.queryCurrent;
        case 'data.query': return this.querySeries;
      }
    }
    return null;
  }

  get queryCurrent() {
    var sources = this.querySources;
    if(sources) {
      return { path: 'datum/mostRecent', parameters: { sourceIds: sources } }
    }
    return null;
  }

  get querySeries() {
    var sources = this.querySources;
    if(sources) {
      var time = this.queryTime;
      if(time) {
        var query = { path: 'datum/query', parameters: { sourceIds: sources, startDate: time.start, aggregate: time.aggregate }};
        if(time.end) {
          query.parameters.endDate = time.end;
        }
        return query;
      }
    }
    return null;
  }

  get datapoint() {
    return this.getEntity('datapoint');
  }

  get time() {
    return this.getEntity('time');
  }

  get location() {
    return this.getEntity('location');
  }

  getEntity(entity) {
    for(var e in this.intent.entities) {
      if(this.intent.entities[e].entity == entity) {
        return this.intent.entities[e];
      }
    }
    return null;
  }

  get querySources() {
    var datapoint = this.datapoint;
    var location = this.location;
    if(datapoint) {
      if(location) {
        return this.getSourceByLocation(datapoint.value, location.value);
      } else {
        var sources = this.getSources(datapoint.value);
        if(sources) {
          return sources.join(',');
        }
      }
    }
    return null;
  }

  get queryTime() {
    var time = this.time;
    if(time) {
      var t = new Date();
      t.setMilliseconds(0);
      t.setSeconds(0);
      t.setMinutes(0);
      t.setHours(0);
      switch (time.value) {
        case 'today':
          return { start: t.toISOString(), aggregate: 'Minute' };
        case 'yesterday':
          var start = new Date(t.getTime() - 86400000);
          return { start: start.toISOString(), end: t.toISOString(), aggregate: 'Minute' };
        case 'this week':
          t.setDate(t.getDate() - (t.getDay() - 1));
          return { start: t.toISOString(), aggregate: 'Hour' };
        case 'last week':
          t.setDate(t.getDate() - (t.getDay() - 1));
          var start = new Date(t.getTime() - 604800000);
          return { start: start.toISOString(), end: t.toISOString(), aggregate: 'Hour' };
        case 'this month':
          t.setDate(1);
          return { start: t.toISOString(), aggregate: 'Day' };
        case 'last month':
          t.setDate(1);
          var start = new Date(t.getTime());
          start.setMonth(start.getMonth() - 1);
          return { start: start.toISOString(), end: t.toISOString(), aggregate: 'Day' };
        case 'this year':
          t.setDate(1);
          t.setMonth(0);
          return { start: t.toISOString(), aggregate: 'Month' };
        case 'last year':
          t.setDate(1);
          t.setMonth(0);
          var start = new Date(t.getTime());
          start.setYear(start.getYear() - 1);
          return { start: start.toISOString(), end: t.toISOString(), aggregate: 'Month' };
      }
    }
    return null;
  }

  getSources(datapoint) {
    var sources = this.sources;
    if(sources) {
      var list = [];
      for(var s in sources[datapoint]) {
        list.push(sources[datapoint][s]);
      }
      return list;
    }
    return null;
  }

  getSourceByLocation(datapoint, location) {
    var sources = this.sources;
    console.log(sources[datapoint]);
    if(sources[datapoint] != null && sources[datapoint][location] != null) {
      return sources[datapoint][location];
    }
    return null;
  }

  get sources() {
    return {
      temperature: {
        dining: '/ZEHNZ/sth/1',
        bathroom: '/ZEHNZ/str/2',
        lounge: '/ZEHNZ/str/3',
        garage: '/ZEHNZ/str/4',
        outside: '/ZEHNZ/TEMP_GND_OUTDOORTemperatu'
      },
      humidity: {
        kitchen: '/ZEHNZ/sth/3',
        bathroom: '/ZEHNZ/sth/2',
        laundry: '/ZEHNZ/sth/1'
      }
    };
  };

  get units() {
    return {
      temperature: '°C',
      humidity: '%'
    };
  };

  get rounding() {
    return {
      temperature: 0,
      humidity: 0
    };
  };

}
