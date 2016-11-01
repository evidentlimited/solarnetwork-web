var Template = (function() {
  // Get elements and fill with data when the page has loaded
  window.onload = function() {
    // Get the config and sources from html elements
    var config = Template.Element.getConfig();
    var sources = Template.Element.getSources();
    // Set the SolarNetwork config
    Template.SolarNetwork.setConfig(config);
    // Query SolarNetwork for the latest datums
    Template.SolarNetwork.getLatest(sources, function(err, data) {
      if(err) return console.error(err);
      Template.Element.fill(data)
    });
  }

  return this;
})();

// Element

Template.Element = (function() {
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

  // Round to x decimal places
  this.round = function(value, decimals) {
    if(isNaN(decimals)) decimals = 2;
    var multiplier = 1;
    for(var d = 0; d < decimals; d++) { multiplier *= 10; }
    return Math.round(value * multiplier) / multiplier;
  }

  return this;
})();

// SolarNetwork

Template.SolarNetwork = (function() {
  // Defaults
  this.host = 'https://data.solarnetwork.net';
  this.mostRecentPath = '/solarquery/api/v1/sec/datum/mostRecent';
  this.config = {};

  // Set the SolarNetwork config
  this.setConfig = function(config) {
    this.SolarNetwork.config = config;
  }

  // SolarNetwork HTTP request with authentication
  this.request = function(method, path, params, body, next) {
    // Build the path
    var fullPath = path + '?' + this.SolarNetwork.buildQueryString(params);

    // TODO Add support for post requests (body and md5 hash)

    // Get the current time as a UTC string
    var now = (new Date()).toUTCString();
    // Build the message to be hashed
    var msg = `${method}\n\n\n${now}\n${fullPath}`;
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
    req.open(method, this.SolarNetwork.host + fullPath, true);
    // Set the headers for authorization
    req.setRequestHeader('X-SN-Date', now);
    req.setRequestHeader('Authorization', `SolarNetworkWS ${this.SolarNetwork.config.token}:${hash}`);
    req.setRequestHeader('Accept', `application/json`);
    req.send();
  }

  // Get the latest datums of sourceIds
  this.getLatest = function(sourceIds, next) {
    // Query parameters
    var params = {
      nodeId: this.SolarNetwork.config.node,
      sourceIds: sourceIds.join(',')
    };

    // Request the data
    this.SolarNetwork.request('GET', this.SolarNetwork.mostRecentPath, params, null, function(err, response) {
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
