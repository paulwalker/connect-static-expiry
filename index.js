/*!
 * static-expiry - connect middleware for generating and 
 *  request handling of fingerprinted urls for static assets
 * 
 * Inspriational credit given to bminer for https://github.com/bminer/node-static-asset
 * Copyright(c) 2013 Paul Walker
 * 
 * MIT Licensed
 */

/**
 * Module dependencies.
 */
var crypto = require('crypto')
  , url = require('url')
  , path = require('path')
  , fs = require('fs')
  , util = require('util')
  , fresh = require('fresh')
  , findit = require('findit')
  , isDev = process.env.NODE_ENV === 'development'
  , defaults = {
      unconditional: isDev ? 'none' : 'both',
      duration: 31556900,
      conditional: isDev ? 'none' : 'both',
      cacheControl: 'cookieless',
      dir: process.cwd() + '/public',
      fingerprint: md5,
      location: 'prefile',
      loadCache: isDev ? 'furl' : 'startup',
      host: null,
      useSecond: !isDev,
      debug: isDev
    };

exports = module.exports = expiry;

exports.options = {};
/**
 * Set the options
 *
 * @api private
 */
exports.setOptions = function(opts) {
  for (var opt in defaults) {
    this.options[opt] = opts[opt] === undefined ? defaults[opt] : opts[opt];
  }

  this.options.enabled = 
    this.options.unconditional !== 'none' || this.options.conditional !== 'none';

  if (this.options.host) this.options.host = normalizeHost(this.options.host);
};

/**
 * lookup for fingerprinted URLS
 *
 * { '/css/main.css': '/css/ea37c65807fe8adfbaf8bc2a2cef7a54-style.css', ... }
 */
exports.urlCache = {};

/**
 * lookup for incoming asset requests
 * 
 * { '/css/ea37c65807fe8adfbaf8bc2a2cef7a54.css':
 *    { etag:         'ea37c65807fe8adfbaf8bc2a2cef7a54',
 *      lastModified: 'Thu, 07 Mar 2013 07:18:36 GMT',
 *      assetUrl:     '/css/main.css' },
 *   ... 
 * }
 */
exports.assetCache = {};

exports.clearCache = function() {
  this.urlCache = {};
  this.assetCache = {};
}
/**
 * Returns the md5 hash of a file
 *
 * @api private
 */
function md5(filePath) {
  return crypto.createHash('md5').
    update(fs.readFileSync(filePath)).
    digest('hex');
};

/**
 * Normalize host option value.
 * Uses proto relative url if no protocol is specified
 *
 * @api private
 */
function normalizeHost(host) {
  var normalize = function(s) { 
    return (~s.indexOf('://') || s.indexOf('//') === 0 ? '' : '//') + s;
  };

  if (!util.isArray(host)) return normalize(host);
  for (var i = 0; i != host.length; i++) {
    host[i] = normalizeHost(host[i]);
  }
  return host;
};


/**
 * Iterates through the files in the static directory and pre caches the fingerprints 
 * and cache data
 *
 * @api private
 */
function preCache() {
  var options = expiry.options
    , dir = Array.isArray(options.dir) ? options.dir : [options.dir]
    , callback = (typeof options.loadCache === 'object' && 
        typeof options.loadCache.callback !== 'function') ? 
        options.loadCache.callback : false;

  dir.forEach(function (dir) {
    findit.sync(dir, {}, function(file, stat) {
      if (stat.isFile() && (!callback || callback(file, stat))) {
        var urlCacheKey = file.substr(dir.length);
        if (!expiry.urlCache[urlCacheKey]) {
          expiry.urlCache[urlCacheKey] = fingerprintAssetUrl(urlCacheKey);
        }
      }
    });
  });
};

/**
 * Renders the urlCache and assetCache values
 *
 * @api private
 */
function expiryGet(req, res) {
  var json = { urlCache: expiry.urlCache, assetCache: expiry.assetCache }
    , body = JSON.stringify(json, undefined, 2);
  res.set('Content-Type', 'text/plain');
  res.send(body);
};

/**
 * Return and stores fingerprinted Asset URL in lookup hash.  
 * Also stores Asset Cache Header data and Asset URL in lookup hash for use by middleware
 *
 * @api private
 */
function fingerprintAssetUrl(assetUrl) {
  var options = expiry.options
    , parsedUrl = (typeof assetUrl === 'string') ? url.parse(assetUrl, true, true) : assetUrl
    , urlCacheKey = parsedUrl.path
    , dir = Array.isArray(options.dir) ? options.dir : [options.dir]
    , i
    , length
    , filePath
    , fingerprint
    , fingerprintedUrl;

  for (i = 0, length = dir.length; i < length; i++) {
    try {
      filePath = dir[i] + '/' + parsedUrl.pathname;
      fingerprint = options.fingerprint(filePath);
      break;
    } catch(e) {
      // file not found
      if (!e.code || e.code !== 'ENOENT') {
        throw e;
      } else if (i === length - 1) {
        return assetUrl;
      }
    }
  }

  switch (options.location) {
    case 'prefile':
      parsedUrl.pathname = path.dirname(parsedUrl.pathname).replace(/\/$/, '') + '/' +
        fingerprint + '-' + path.basename(parsedUrl.pathname);
      break;
    case 'postfile':
      var filename = path.basename(parsedUrl.pathname)
        , ext = path.extname(filename);
      parsedUrl.pathname = path.dirname(parsedUrl.pathname).replace(/\/$/, '') + '/' +
        filename.slice(0, -ext.length) + '-' + fingerprint + ext;
      break;
    case 'query':
      parsedUrl.query['v'] = fingerprint;
      break;
    case 'path':
      parsedUrl.pathname = '/' + fingerprint + parsedUrl.pathname;
      break;
  }

  if (!parsedUrl.host && options.host) {
    var host = options.host
      , parsedHost;
    if (util.isArray(host)) {
      for (var i = 0, n = 0; i !== urlCacheKey.length; n += urlCacheKey.charCodeAt(i++));
      host = host[n % host.length];
    }
    parsedHost = url.parse(host, false, true);
    parsedUrl.protocol = parsedHost.protocol;
    parsedUrl.host = parsedHost.host;
  }

  fingerprintedUrl = url.format(parsedUrl);
  assetUrl = parsedUrl.path;
  parsedUrl = url.parse(fingerprintedUrl, false, true);

  // store the header caching values in a lookup hash
  // the middleware needs this to rewrite the url
  expiry.assetCache[parsedUrl.path] = { 
    etag : fingerprint, 
    lastModified : fs.statSync(filePath).mtime.toUTCString(),
    assetUrl : assetUrl
  };

  // return Fingerprinted URL and store it in a lookup hash
  return fingerprintedUrl;
};

/**
 * Local helper method to generate fingerprinted URLs
 *
 * @api private
 */
function furl(assetUrl, prodAssetUrl) {
  if (expiry.options.useSecond && prodAssetUrl) assetUrl = prodAssetUrl;
  if (!expiry.options.enabled) return assetUrl;
  var parsedUrl = url.parse(assetUrl, true, true)
    , urlCacheKey = parsedUrl.path
    , fingerprintedUrl = expiry.urlCache[urlCacheKey];

  if (!fingerprintedUrl) {
    fingerprintedUrl = expiry.urlCache[urlCacheKey] = fingerprintAssetUrl(parsedUrl);
  }

  return fingerprintedUrl;
};

/**
 * Middleware that is returned with public expiry call.
 * Looks up incoming request url in lookup hash and, if found, 
 * sets cache headers according to settings
 *
 * @api private
 */
function middleware(req, res, next) {
  var headerInfo = expiry.assetCache[req.url]
    , options = expiry.options;

  if (headerInfo) {
    var cacheControl = (options.cacheControl === 'cookieless' && 
      (req.get('cookie') || req.get('authorization'))) ?
          'private' : options.cacheControl || '';

    if (options.unconditional === 'both' || options.unconditional === 'max-age') {
      if (cacheControl.length) cacheControl += ', ';
      cacheControl += 'max-age=' + options.duration;
    }
    if (options.unconditional === 'both' || options.unconditional === 'expires') {
      var now = new Date();
      now.setSeconds(now.getSeconds() + options.duration);
      res.set({ 'Expires' : now.toUTCString() });
    }
    if (options.conditional === 'both' || options.conditional === 'etag') {
      res.set({ 'ETag' : '"' + headerInfo.etag + '"' });
    }
    if (options.conditional === 'both' || options.conditional === 'last-modified') {
      res.set({ 'Last-Modified' : headerInfo.lastModified });
    }
    if (cacheControl.length) res.set({ 'Cache-Control' : cacheControl });

    if (fresh(req, res)) return res.send(304);

    req.originalUrl = req.url;
    req.url = headerInfo.assetUrl;
  }

  next();
};

/**
 * Initiates expiry and returns the middleware.
 * Creates a `furl` function on app.locals for use in templates 
 * @param {Object} app instance 
 * @param {Object} options for configuration
 * @return {Middleware}
 * @api public
 */
function expiry(app, options) {
  expiry.setOptions(options || {});
  options = expiry.options;

  if (options.loadCache === 'startup' || 
    (typeof options.loadCache === 'object' && options.loadCache.at === 'startup')) {
    preCache();
  }
  if (options.debug) app.get('/expiry', expiryGet);
  app.locals.furl = furl;

  return middleware;
};
