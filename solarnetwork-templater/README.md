# SolarNetwork Template

Template is simple javascript library allowing you to template [SolarNetwork](http://solarnetwork.net) datapoints in HTML and have them fill in when the page loads.

## Dependencies

The template.js is what makes the magic happen and a few libraries are required for SolarNetwork authentication.

Note - these scripts can be placed in any order and anywhere in your html, the template wont be called until the entire page is loaded.

```html
<script src="js/template.js"></script>
<!-- Required for authentication -->
<script src="js/hmac-sha1.js"></script>
<script src="js/enc-base64.js"></script>
```

## Usage

First a configuration element is required to authenticate the requests to SolarNetwork (this can also be anywhere in the HTML).

The node attribute is the SolarNetwork nodeId and the token/secret should be a [SolarNetwork data token](https://data.solarnetwork.net/solaruser/u/sec/auth-tokens).

```html
<data-config node="200" token="xxx" secret="xxx"/>
```

Datapoints are defined by the data tag and the attributes, the value will be inserted within the tag.

```html
<data source="sourceId" metric="total"></data>
<data source="sourceId" metric="actual" round="1"></data>
```

#### Data attributes
Required:
* source = SolarNetwork sourceId
* metric = SolarNetwork sourceId value (e.g. watts, humidity)

Optional:
* round = the maximum number of decimal places (default = 2, can be set to 0 for a whole number)

## Example

Bringing it all together, an html page could look like this:

```html
<!DOCTYPE html>
<html>
  <head>
    <title>SolarNetwork Template</title>
    <script src="js/template.js"></script>
    <script src="js/hmac-sha1.js"></script>
    <script src="js/enc-base64.js"></script>
    <data-config node="253" token="gh-28a;tZgC6T;^F*NL$" secret="7^BU1?xz;q6}<HRbQM+5RB}X0"/>
  </head>
  <body>
    <h1>Zero energy house</h1>
    <p>
      Fridge: <data source="/ZEHNZ/me/1/3" metric="total"></data> kWh
      <br>
      Lighting: <data source="/ZEHNZ/me/1/4" metric="total" round="0"></data> kWh
    </p>
  </body>
</html>
```

### TODO

* Add support for public data meaning no token is required.
* Add support for aggregated values (e.g. 10 minutes = `aggregate="10m"`, 1 day = `aggregate="1d"`)
* Implement HMAC-SHA1 hash and base64 encoding into template.js to remove dependencies.
* Consider adding chart tags which loads in a chart from a query based on the attributes (e.g. `<chart source="sourceId" metric="total" start="2016-11-1" end="2016-11-2" width="600" height="200"></chart>`)
