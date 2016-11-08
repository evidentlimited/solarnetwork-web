# Template 1.1

Template is a JavaScript package for templating [SolarNetwork](http://solarnetwork.net/) data onto into a HTML document without having to write any JavaScript.

The idea is to make the process of displaying data as simple and flexible as possible.

This is accomplished through custom HTML elements, for example to show the current temperature could look something like this:

```html
The temperature is currently <data source="temperature" metric="degreesCelcius">...</data>°C
```

When the page is loaded, the template script will retrieve the data replace the "..." inside the element with the actual value resulting in something like this:

```html
The temperature is currently 24°C
```

There is a lot more you can do with the data tag so lets get into it...

## Prerequisites

First you will need to include the script in the document:

```html
<script src="https://s3-ap-southeast-2.amazonaws.com/evident-solarnetwork-web/template/template-1.1.js" charset="utf-8"></script>
```

There are a number of dependencies that are loaded through the template script which you don't need to worry about, these include hmac-sha1 and enc-base64 for [SolarNetwork authentication](https://github.com/SolarNetwork/solarnetwork/wiki/SolarNet-API-authentication-scheme), then [moment](http://momentjs.com/) and [moment-timezone](http://momentjs.com/timezone/) for working with dates and times.

Next you will need to include you SolarNetwork node details, this is done in the form of a data-config element.

```html
<data-config node="254" token="xxxxx" secret="xxxxx"/>
```

The token and secret are that of a [data token](https://data.solarnetwork.net/solaruser/u/sec/auth-tokens) associated with you user account, these should be used with care as this is the internet.

Note - The order of any of these elements are irrelevant, they can be placed anywhere within the html document.

Once you have the script and configuration in the document you are ready to start adding data.

## Data

The data tag defines a source and metric within SolarNetwork with a number of attributes to define how the data is queried, modified and displayed.

The simplest use case would be getting the current value, all this requires is a source and metric.

```html
Current energy consumption <data source="energyMeter" metric="watts">...</data> W
```

In SolarNetwork the source is refering to sourceId and the metric is the property of that sourceId.

#### Round

Numbers are automatically rounded to 2 decimal places, otherwise it can be set as an attribute, for example to get 5 decimal places you would include round="5":

```html
Current energy consumption <data source="energyMeter" metric="watts" round="5">...</data> W
```

To make a whole number you can round to 0 (round="0").

#### Updates

Updates are a way of making the data "realtime" it will update the data every x using the [time period syntax](#time-period-syntax).

For example to update every minute look like:

```html
<data source="temperature" metric="degreesCelcius" update="1m">...</data>
```

Every 10 seconds would be:

```html
<data source="temperature" metric="degreesCelcius" update="10s">...</data>
```

Note - if the update attribute only contains a number, it will default to seconds, e.g. update="20" will update every 20 seconds.

#### Dates

[Date attributes](#date-attributes) are a way of displaying historical, date specific and aggregated data. A full list of date attributes can be found [here](#date-attributes).

The attributes can be used in a few ways, the first being relative dates which are defined by negative numbers, essentially moving the current date back by the defined amount.

For example yesterday would be:

#### Relative (negative)

```html
<data source="energyMeter" metric="watts" day="-1">...</data>
```

6 months ago would look like:

```html
<data source="energyMeter" metric="watts" month="-6">...</data>
```

An hour and a half ago:

```html
<data source="energyMeter" metric="watts" hour="-1" minute="-30">...</data>
```

#### Representative (positive)

The next way you can use dates are positive numbers which are not relative, they define the date reference.

For example to get the first day of this month you would use:

```html
<data source="energyMeter" metric="watts" day="1">...</data>
```

2:30pm yesterday would be:

```html
<data source="energyMeter" metric="watts" day="-1" hour="14" minute="30">...</data>
```

February last year would look like:

```html
<data source="energyMeter" metric="watts" year="-1" month="2">...</data>
```

#### Rounding

The date is rounded to the smallest defined negative attribute (e.g. day is used over year, minute is used over hour) note positive numbers don't affect rounding as they are calculated afterwards.

In this example the hour, minute and second values would be set to 0. Making the date something like 2016-11-08 00:00:00

```html
<data source="energyMeter" metric="watts" day="-1">...</data>
```

This case would look something like 2015-01-01 00:00:00

```html
<data source="energyMeter" metric="watts" year="-1">...</data>
```

Positive/representative dates are calculated after rounding meaning you can use combinations of positive and negative numbers to get a broad range of dates.

For example the 1st of last month would look like:

```html
<data source="energyMeter" metric="watts" month="-1" day="1">...</data>
```

March 2 years ago:

```html
<data source="energyMeter" metric="watts" year="-2" month="3">...</data>
```

#### Rounding without adjusting (zero)

If rounding is desired but you don't want to adjust the date, 0 can be used which will be interpreted as a negative number but wont actually change the date.

For example to get this month last year:

```html
<data source="energyMeter" metric="watts" year="-1" month="0">...</data>
```

This day 3 months ago:

```html
<data source="energyMeter" metric="watts" month="-3" day="0">...</data>
```

## Time periods

[Time periods](#time-period-syntax) can be used in combination with date attributes or on their own. For a description of period syntax look [here](#time-period-syntax).

When used with dates can get a value over a period of time from the defined date.

For example the last 10 days would be:

```html
<data source="energyMeter" metric="watts" day="-10" period="10d">...</data>
```

The second half of last month:

```html
<data source="energyMeter" metric="watts" month="-1" day="15" period="15d">...</data>
```

The first 3 months of this year:

```html
<data source="energyMeter" metric="watts" year="0" period="3M">...</data>
```

When periods are used without any date attributes, the period is relative.

Note - no date rounding will be performed without date attributes so a period of 10 days will be the current time 10 days ago to the current time.

For example the last 10 days:

```html
<data source="energyMeter" metric="watts" period="10d">...</data>
```

The last year:

```html
<data source="energyMeter" metric="watts" period="1y">...</data>
```

## Data modifications

There are 3 attributes which can be used to modify data before displaying it, but before explaining these you will need an understanding of how the query response is processed because the data comes back in an array of datum objects, for an understanding of [SolarQuery](https://github.com/SolarNetwork/solarnetwork/wiki/SolarQuery-API) and the responses look [here](https://github.com/SolarNetwork/solarnetwork/wiki/SolarQuery-API).

#### Query response processing

SolarQuery returns a list of datum objects which contain things like the date, sourceId, nodeId and the defined metric or all metrics if none is defined.

Query response where watts is the metric:

```json
[
  {
    "created": "2016-11-08 18:45:12.341Z",
    "nodeId": 254,
    "sourceId": "energyMeter",
    "localDate": "2016-11-08",
    "localTime": "18:45:12",
    "watts": 1065.228
  },
  {
    "created": "..."
  }
]
```

The response is iterated and the metric values are summed/averaged into an array, this array is represents the source attribute.

For example where source has 2 sourceIds:

```html
<data source="energyMeter1,energyMeter2" metric="watts">...</data>
```

The array would look like [1065.228, 713.23] a value for energyMeter1 and energyMeter2 referenced as i[0] and i[1] ordered by the source attribute.

So for example `i[0] + i[1]` stands for `energyMeter1 + energyMeter2`.

Then these values are automatically summed/averaged into a single value, rounded and displayed.

There are 3 points in which you can change how this data is handled override, modify and adjust.

#### Adjust

The adjust attribute is the simplest of the 3, it is calculated after all of the auto summing so you are only dealing with a single value. This value is referenced as `i`

For example to get watts from kilowatts would look like this:

```html
<data source="energyMeter1" metric="kilowatts" adjust="i * 1000">...</data>
```

Or degrees celcius to degrees fahrenheit:

```html
<data source="temperature" metric="degreesCelcius" adjust="i * 9 / 5 + 32">...</data>
```

This can be useful for simple conversions such as the examples.

#### Modify

Modify is calculated after the values have been summed into an array, so this is generally used is combination with multiple sources.

The array can be referenced as `i` followed by the index of the source.

For example this is how you would structure `energyMeter1 + energyMeter2` where `i[0] = energyMeter1` and `i[1] = energyMeter2`:

```html
<data source="energyMeter1,energyMeter2" metric="watts" modify="i[0] + i[1]">...</data>
```

To get energyMeter1's percentage of energyMeter2 you can use:

```html
<data source="energyMeter1,energyMeter2" metric="watts" modify="(i[1] / i[0]) * 100">...</data>
```

Now if you want to make sure that percentage does not exceed 100 you can use an if statement:

```html
<data source="energyMeter1,energyMeter2" metric="watts" modify="(i[1] / i[0]) * 100 < 100 ? (i[1] / i[0]) * 100 : 100">...</data>
```

This can be simplified by defining the value as a variable:

```html
<data source="energyMeter1,energyMeter2" metric="watts" modify="var p = (i[1] / i[0]) * 100; p < 100 ? p : 100">...</data>
```

Or you can use the JavaScript math function min:

```html
<data source="energyMeter1,energyMeter2" metric="watts" modify="Math.min(100, (i[1] / i[0]) * 100)">...</data>
```

Note - The modify function is expected to return a number and adjust can be used which will be calculated after modify.

#### Override

Override is the most complicated since you are handing the query response, in this can `i` is the query response it's self, an array of datums.

Note - override is expected to return a number, if override is set modify will not be executed (although adjust will be).

An example of how you could modify the query response would be to running a loop on it and calculating on the fly:

```html
<data source="energyMeter1" metric="watts" override="var x = 0; for(d in i){ if(i[d].watts != null) x += i[d].watts; } x">...</data>
```

Note - the value needs to be checked if it exists as some datums don't contain the value.

Note - at the end of the override attribute `x` is required to return the value.

## Date Attributes

The date attributes are what you would expect, for a description of how they are used check out the [dates section](#dates).

A full list of date attributes:

* minute
* hour
* day
* weekday (e.g. 0 = Sunday, 1 = Monday, 6 = Saturday)
* week
* month
* year

## Time period syntax

Time periods start with a number and end in a letter representing a time period for example "5s" is 5 seconds, "1d" is a day.

A full list of time periods:

* s - Second
* m - Minute
* h - Hour
* d - Day
* w - Week
* M - Month
* y - Year

Some examples:

```html
<data period="5s" period="10d" period="1M" period="2y">
```
