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
    <meta charset="utf-8">
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

## Date queries

```html
negative numbers and 0 are relative to the current date:
<!-- yesterday -->
<data day="-1">
<!-- this week -->
<data week="0">
<!-- six months ago -->
<data month="-6">

positive numbers represent the date:
<!-- 2015 -->
<data year="2015">
<!-- the 2nd of last month -->
<data month="-1" day="2">
<!-- the first Saturday of January -->
<data month="1" weekday="6">
<!-- this day last year -->
<data year="-1" day="0">

date attributes:
<data year month week weekday day hour minute>

dates can be used in combination with the period attribute:
<!-- the last 3 year -->
<data year="-3" period="3y">
<!-- Monday to Friday last week -->
<data week="-1" period="5d">

period suffixes:
<period year="1y" month="1M" week="1w" day="1d" hour="1h" minute="1m">

the aggregate attribute will override the aggregate when querying SolarNet:
<data aggregate="Day">
<data month="-1" aggregate="Month">
```

A full list of aggregates can be found [here](https://github.com/SolarNetwork/solarnetwork/wiki/SolarQuery-API-enumerated-types#aggregation-types)

## Update

You can make data "live" by adding the update attribute:
```html
<!-- updates default to seconds otherwise the syntax is identical to the period attribute -->
<!-- update every 5 seconds -->
<data update="5">
<!-- update every 1 minute -->
<data update="1m">
<!-- update every 5 seconds -->
<data update="5">
```

```html
<!-- Energy use yesterday -->
<data source="/ZEHNZ/me/1" metric="total" day="-1" aggregate="Day"></data>
<!-- Energy use on this day last year (NOTE day is required otherwise it will round to the start of the year)-->
<data source="/ZEHNZ/me/1" metric="total" year="-1" day="0" aggregate="Day"></data>
<!-- Energy use Last week -->
<data source="/ZEHNZ/me/1" metric="total" week="-1" aggregate="Week"></data>
```

All date attributes
```html
<data year="-1" month="-1" week="-1" weekday="1" day="-1" hour="-1" minute="-1"></data>
```

### TODO

* Add support for public data meaning no token is required.
* Add defined periods (e.g. today, yesterday, week, month, year).
* Add support for aggregated values (e.g. `aggregate="Minute"`) [Aggregation list](https://github.com/SolarNetwork/solarnetwork/wiki/SolarQuery-API-enumerated-types).
* Add poll updates (e.g. update every 5 seconds = `update="5s"`).
* Implement HMAC-SHA1 hash and base64 encoding into template.js to remove dependencies.
* Consider adding chart tags which loads in a chart from a query based on the attributes (e.g. `<chart source="sourceId" metric="total" start="2016-11-1" end="2016-11-2" width="600" height="200"></chart>`).
