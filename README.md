

  static-expiry provides two things:

  * A helper method `furl` for your templates in order to generate fingerprinted URLs for your static assets
  * Middleware to handle incoming requests for the fingerprinted URLs.  It handles them by rewriting the url to it's original value and setting appropriate conditional/unconditional cache headers according to your configuration.

It does not serve static assets.  It is invoked by calling it's function that returns the middleware.  It should be placed just before the middleware you use for serving static assets.

Yes, it's prudent to use a CDN in production.  But you need to generate versioned URLs of some sort in your app and you need an origin to seed the CDN properly (correct cache headers).  That's what static-expiry provides.  It's less of a hassle than configuring a seperate build and deployment to an S3 bucket, imho, and keeps everything self-contained.

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

Use the `furl` app local in your templates in order to generate the fingerprinted URL.

```html
  <link rel="stylesheet" href="{{ furl('/css/style.css') }}" />
  <!-- <link rel="stylesheet" href="/css/a6edcf683bc4df33bb82ae1cca3cf21a-style.css" /> -->
```

The function returned from the require statement takes two argument, the first being the connect/express app (so that the app local can be set) and the second an object of options.  The valid options (defaults uncommented):

```js
app.use(expiry(app, {
  // the duration in seconds for the Cache-Control header, max-age value and the Expires header
  duration: 31556900, // 1 year, default when process.env.NODE_ENV === production

  // what undconditional cache headers are set
  unconditional: 'both', // both the Cache-Control header, max-age value and the Expires header
  // 'max-age' just the Cache-Control header, max-age value
  // 'expires' just the Expires header
  // 'none' neither the Cache-Control header, max-age value or the Expires header
  // this is the default when not in prod mode (default when not in prod)

  // what conditional headers are set
  conditional: 'both', // both the Last-Modified and ETag header, 
  // 'both is the default when process.env.NODE_ENV === production
  // 'last-modified' only the last-modified header
  // 'etag' only the etag header
  // 'none' neither the Last-Modfied or the ETag headers

  // the value of the Cache-Control header preceding the max-age value
  // Cache-Control: public, max-age=31556900
  cacheControl: 'cookieless', // set to 'public' when there is no cookie present, 'private' if there is
  // 'public' or 'private' set one of these values always
  // '' or false do not set a value e.g. Cache-Control: max-age=31556900

  // the directory of the static assets
  dir: path.join(process.env.PWD, 'public'),
  /* I have no idea how reliable the presence of the PWD environment variable is
     so it's probably best to set this. */

  // a function to use to generate the fingerprint
  // it takes as it's only argument the file path to the asset and should return 
  // the fingerprint value only, not the url
  fingerprint: md5 // the default creates an md5 hash of the file contents

  // the location of the fingerprint in the URL the `furl` generates
  location: 'prefile', // prefixes the filename of the asset with the fingerprint
  // 'postfile' postfixes the filename of the asset
  // 'query' puts the fingerprint in a query string value with the name of `v`
  // 'path' prefixes the url with a directory with the name of the fingerprint value
  /*  note that 'path' could be problematic if you are using relative url references 
      in your css/js files but could work if you supply your own function for 
      generating the fingerprint value and make it static across all assets */

  // a domain host value to be used for the fingerprinted URLs.  may be an array of hosts
  // in which case one will be picked by doing a modulus on the time
  host: null
  // host: ['https://cdn.acme.com', 'cdn2.acme.com'] 
  // if you don't use a scheme a proto relative scheme will be used e.g. "//cdn2.acme.com/css/main.css"
  /*  This is what you will use if setting up your app servers as origin servers to your CDN.
      The fingerprinted URLs will properly point to the CDN host(s) but your app servers
      can still serve the files and static-expiry will ensure the proper caching headers 
      are returned to the CDN.
  */
}));
```

If both conditional and unconditional have a value of none (the default in development), static-expiry is disabled and the `furl` function will not fingerprint the url.  So, you are safe to use the furl function in all modes.  When static-expiry is enabled, the `furl` function (besides generating the fingerprinted URL) will store the asset url argument `furl`, fingerprinted URL, and the cache header data (etag and last-modified).  This is needed by the middleware in order to rewrite the request URL back to the original argument so that the next static middleware can serve the asset.

## TODO
  * Allow for option to pre cache files in the static directory as opposed to hydrating the cache asset by asset upon use of the `furl` function.
  * Handle file changes in a production mode either with a file watcher or dynamically looking at the file stats on every request.
  * More granular control of `host` option.  Allow override in individual `furl` call.
  * Allow secondary argument to `furl` that will be used in prod mode only, useful for non-minified/minified assets.

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