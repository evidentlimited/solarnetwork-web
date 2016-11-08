# Template

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

When used with dates data will be queries


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
