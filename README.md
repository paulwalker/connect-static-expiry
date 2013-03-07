

  static-expiry provides two things:

  * A helper method `furl` for your templates in order to generate fingerprinted URLs for your static assets
  * Middleware to handle incoming requests for the fingerprinted URLs.  It handles them by rewriting the url to it's original value and setting appropriate conditional/unconditional cache headers according to your configuration.

It does not serve static assets.  It is invoked by calling it's function that returns the middleware.

Yes, it's prudent to use a CDN in production.  But you need an origin for the CDN and app servers are a good choice, imo.  Less hassle than using an S3 bucket for example.

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

The function returned takes two argument, the first being the connect/express app (so that the app local can be set) and the second an object of options.  The valid options and their defaults are:
  * __unconditional__ What unconditional cache headers are set.  Valid values are:
    * ___'max-age'___ Set the max-age value of the Cache-Control header to 1 year in the future.  Do not set the expire header.
    * ___'expires'___ Set the Expires header to 1 year in the future.  Do not set the max-age value in the Cache-Control header.
    * ___'both'___ Set both of the above.  This is the default when `process.env.NODE_ENV === production`
    * ___'none'___ Do not set either headers.  This is the default when `process.env.NODE_ENV !== production`
  * __duration__ The duration in seconds of the Cache-Control header max-age value and the Expires header.  Defaults to 31556900 (1 year)
  * __conditional__ What conditional cache headers are set.  Valid values are:
    * ___'last-modified'___ Set the Last-Modified header to the mtime value of the asset.  Do not set the ETag header.
    * ___'etag'___ Set the ETag header to a hash of the asset.  Do not set the ETag header.
    * ___'both'___ Set both of the above.  This is the default when `process.env.NODE_ENV === production`
    * ___'none'___ Do not set either headers.  This is the default when `process.env.NODE_ENV !== production`
  * __cacheControl__ The value of the Cache-Control header (does not control the max-age value).  Valid values are:
    * ___'public|private'___ A string value to be used for the Cache-Control header
    * ___'cookieless'___ Sets the Cache-Control header to "public" if there is no cookie, otherwise sets it to private.  This is the default value.
    * ___''___ Empty string or false if you don't want it set.  Note, that the max-age may still be present.  e.g. `Cache-Control: max-age=31556900`
  * __dir__ The directory where static assets are stored.  The default value is `path.join(process.env.PWD, 'public')`.
    I have no idea how reliable the presence of the PWD environment variable is, so it's probably best to set it.
  * __fingerprint__: The fingerprint function to use.  The first and only argument is the file path to the asset and it should return the fingerprint value.  It defaults to an md5 hash function, pass in your own function here to do something else.
  * __location__ The location of the fingerprint in the URL.  Valid values are:
    * ___'prefile'___ Prefixes the filename of the asset with the fingerprint.  This is the default.
    * ___'postfile'___ Postfixes the filename of the asset with the fingerprint.
    * ___'query'___ Puts the fingerprint in the query string of the url with the name of `v`
    * ___'path'___ Prefixes the url with a directory with the name being the value of the fingerprint.  Note that this will be problematic if you are using relative URL references in your CSS files.
  * __host__ A domain host value to be used for the fingerprinted URL generation.  You can use an array of hosts here and one will be picked by doing a modulus on the time.  If you don't specifiy a scheme, a proto relative scheme will be used.  You will want to use this option if your app servers act as the origin servers for your CDN (like EC2 to Cloudfront).  I find this much easier than using an S3 bucket as the origin.

If both conditional and unconditional have a value of none (the default in development), expiry is disabled and the furl function will not fingerprint the url.  So, you are safe to use the furl function in all modes.  When expiry is enabled, the furl function (besides generating the fingerprinted URL) will store the asset url argument furl, fingerprinted URL, and the cache header data (etag and last-modified).  This is needed by the middleware in order to rewrite the request URL back to the original argument so that the subsequent static middleware can serve the asset.

## TODO
  * Allow for option to pre cache files in the static directory as opposed to hydrating the cache asset by asset upon use of the furl function.
  * Handle file changes in a production mode either with a file watcher or dynamically looking at the file stats on every request.
  * More granular control of __host__ option.  Allow override in individual `furl` call.
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