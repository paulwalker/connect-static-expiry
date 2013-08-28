

  static-expiry provides two things:

  * A helper method `furl` for your templates in order to generate fingerprinted URLs for your static assets
  * Middleware to handle incoming requests for the fingerprinted URLs.  It handles them by rewriting the url to it's original value and setting appropriate conditional/unconditional cache headers according to your configuration.

*static-expiry* does not serve static assets.  It is invoked by calling it's function that returns the middleware.  It should be placed just before the middleware you use for serving static assets.

**static-expiry** is meant to be everything you need to set up your app servers as origin servers to your CDN.  The two things it provides are key to this: versioned urls and handling the versioned urls.  Of course, you don't have to use a CDN and with **static-expiry** you are still serving static assets using best practices for caching.

## static-expiry's cache
*static-expiry* uses two lookup cache objects.  One that maps asset urls to the fingerprinted version, so that the function that generates fingerprinted urls only calculates once per asset.  And another that maps the incoming fingerprinted URL to an object that contains the unfingerprinted asset URL, the fingerprint (used for the etag header) and the file stat mtime (used for the last-modified header).  The latter is used by the middleware to rewrite the URL in the `req` object and set the appropriate cache headers.

## Installation

    $ npm install static-expiry

## Quick Start

```js
var express = require('express');
var app = express() // or just plain connect, there are no dependencies on express
  , expiry = require('static-expiry');
// ...
app.use(expiry(app, { dir: path.join(__dirname, 'public') }));
app.use(express.static(staticDir));
// ...
app.listen(3000);
```

The function returned from the require statement takes two arguments, the first being the connect/express app (so that the app local can be set) and the second an object of options.

## furl helper
Use the `furl` app local in your templates in order to generate the fingerprinted URL.

```html
  <link rel="stylesheet" href="{{ furl('/css/style.css') }}" />
  <!-- <link rel="stylesheet" href="/css/a6edcf683bc4df33bb82ae1cca3cf21a-style.css" /> -->

  <link rel="stylesheet" href="{{ furl('/css/style.css', '/css/style.min.css') }}" />
  <!-- <link rel="stylesheet" href="/css/a6edcf683bc4df33bb82ae1cca3cf21a-style.min.css" /> -->
```
The second argument will be used when the NODE_ENV is not development.

## Options
There are a number of options to control the fingerprinting and middleware.

```js
app.use(expiry(app, {
```
options are passed in as the second argument

### duration
the duration in seconds for the Cache-Control header, max-age value and the Expires header

```js
duration: 31556900, // defaults to 1 year
```
### unconditional
what unconditional cache headers to set

```js
    unconditional: 'both' // default when process.env.NODE_ENV !== 'development'
    /* 
    unconditional: 'max-age' // just set the Cache-Control header, max-age value
    unconditional: 'expires' // just set Expires header
    unconditional: 'none' // do not set either unconditional headers, default when in dev mode */
```
### conditional
what conditional cache headers to set

```js
  conditional: 'both', // default when process.env.NODE_ENV !== 'development'
  /*
  conditional: 'last-modified' // only the Last-Modified header
  conditional: 'etag' // only the ETag header
  conditional: 'none' // neither the Last-Modfied or the ETag headers, default when in dev mode */
```
### cacheControl
the value of the Cache-Control header preceding the max-age value

```js
  cacheControl: 'cookieless', 
  // set to 'public' when there is no cookie present, 'private' if there is
```
any other string value is what will be used always, typically 'public' or 'private'.  use zero length, false, or null to not have a value.  the conditional option may still mean the Cache-Control header will be present however, e.g. `Cache-Control: max-age=31556900`

### dir
the directory of the static assets

```js
  dir: path.join(process.env.PWD, 'public'),
```
I have no idea how reliable the presence of the PWD environment variable is, so it's probably best to set this

### fingerprint
a function to use to generate the fingerprint

```js
  fingerprint: md5, // the default creates an md5 hash of the file contents
```
the function takes the file path as it's only argument and should return the fingerprint value only (not the fingerprinted url)

### location
the location of the fingerprint in the URL the `furl` function generates

```js
  location: 'prefile', // prefixes the filename of the asset with the fingerprint
  /*
  location: 'postfile' // postfixes the filename
  location: 'query' // puts the fingerprint in a query string value with the name of 'v'
  location: 'path' // prefixes the url with a directory with the name of the fingerprint value */
```
the 'path' option could be problematic if you are using relative url references in your css/js files but could work if you supply your own function for generating the fingerprint value and make it static across all assets

### host
a domain host value to be used for the fingerprinted URLs.

```js  
  host: null,
  /* 
    host: 'cdn.acme.com'
    // if you don't use a scheme a proto relative scheme will be used e.g. `"//cdn2.acme.com/css/main.css"`.
    host: ['cd1.acme.com', 'https://cdn2.acme.com']
  */
```
If you use multiple hosts, the one selected is based upon a modulus of the sum of the character codes in the asset URL so that the same host is generated consistently across app servers.

This option is what you will use if setting up your app servers as origin servers to your CDN.  The fingerprinted URLs will then properly point to the CDN host(s) but your app servers can still serve the files with the caching strategy you have configured or defaulting to.

### loadCache
when to load the urlCache and assetCache

```js
  loadCache: 'startup' // loads the cache upon startup, the default in prod mode
  // loadCache: 'furl' // loads the cache on an asset by asset basis when furl is invoked
  // the default when not in prod mode
  /* 
    loadCache: { at: 'startup', callback: function(file, stat) { /foo/.test(file); } }
    you can pass an object in with a callback function in order to filter files
    by name (file) or fs.Stats (stat).  this only works with the 'startup' mode.
  */
```
the 'startup' value is necessary in a multiple server environment as it is possible for a fingerprinted request to come into a particular server before it has generated a fingerprinted URL for that asset itself.  
(i may work a way around this in the future, not too hard to reverse engineer the asset from the fingerprinted url)

### debug
create a GET /expiry route that outputs the json of the urlCache and assetCache

```js
  debug: process.env.NODE_ENV === 'development'
}));
```

## Enabled vs Disabled (!development vs development)
If both conditional and unconditional have a value of none (the default in development), static-expiry is disabled and the `furl` function will not fingerprint the url.

## TODO
  * Handle file changes in a production mode either with a file watcher or dynamically looking at the file stats on every request.

## Credits
 The inspiration for this project goes to bminer for https://github.com/bminer/node-static-asset

## License

(The MIT License)

Copyright (c) 2013 Paul Walker &lt;github@paulwalker.tv&gt;

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.