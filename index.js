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
  , isProd = process.env.NODE_ENV === 'production'
  , defaults = {
      // max-age, expires, both, none
      unconditional: isProd ? 'both' : 'none',
      duration: 31556900,
      // last-modified, etag, both, none
      conditional: isProd ? 'both' : 'none',
      cacheControl: 'cookieless',
      dir: path.join(process.env.PWD, 'public'),
      fingerprint: md5,
      location: 'prefile',
      loadCache: isProd ? 'startup' : 'furl',
      debug: true
    };

exports = module.exports = expiry;

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
 * Parse out the options
 *
 * @api private
 */
function parseOpts(opts) {
  [ 'unconditional',
    'duration',
    'conditional',
    'cacheControl',
    'dir',
    'fingerprint',
    'location',
    'loadCache',
    'debug'
    ].forEach(function(i) {
    if (!opts[i]) opts[i] = defaults[i];
  });
  opts.enabled = opts.unconditional !== 'none' || opts.conditional !== 'none';

  if (opts.host) opts.host = normalizeHost(opts.host)

  return opts;
};

/**
 * Iterates through the files in the static directory and pre caches the fingerprints 
 * and cache data
 *
 * @api private
 */
function preCache() {
  var options = expiry.options
    , files = [];

  findit.sync(options.dir, {}, function(file, stat) {
    if (stat.blocks !== 0) files.push(file);
  });

  for (var i = 0; i !== files.length; i ++) {
    fingerprintAssetUrl(files[i].substr(options.dir.length));
  }
};

/**
 * Return and stores fingerprinted Asset URL in lookup hash.  
 * Also stores Asset Cache Header data and Asset URL in lookup hash for use by middleware
 *
 * @api private
 */
function fingerprintAssetUrl(assetUrl) {
  var options = expiry.options
    , parsed = (typeof assetUrl === 'string') ? url.parse(assetUrl, true, true) : assetUrl
    , urlCacheKey = parsed.pathname
    , filePath = path.join(options.dir, parsed.pathname)
    , fingerprint;

  try {
    fingerprint = options.fingerprint(filePath);
  } catch(e) {
    // file not found
    if (e.code && e.code === 'ENOENT') return assetUrl;
    throw e;
  }

  switch (options.location) {
    case 'prefile':
      parsed.pathname = path.join(path.dirname(parsed.pathname),
        fingerprint + '-' + path.basename(parsed.pathname));
      break;
    case 'postfile':
      var filename = path.basename(parsed.pathname)
        , ext = path.extname(filename);
      parsed.pathname = path.join(path.dirname(parsed.pathname),
        filename.slice(0, -ext.length) + '-' + fingerprint + ext);
      break;
    case 'query':
      parsed.query['v'] = fingerprint;
      break;
    case 'path':
      parsed.pathname = path.join('/', fingerprint, parsed.pathname);
      break;
  }

  fingerprintedUrl = url.format(parsed);
  assetUrl = parsed.path;
  parsed = url.parse(fingerprintedUrl, false, true);

  // store the header caching values in a lookup hash
  // the middleware needs this to rewrite the url
  expiry.assetCache[parsed.path] = { 
    etag : fingerprint, 
    lastModified : fs.statSync(filePath).mtime.toUTCString(),
    assetUrl : assetUrl
  };

  // return Fingerprinted URL and store it in a lookup hash
  return expiry.urlCache[urlCacheKey] = fingerprintedUrl;
};

/**
 * Middleware that is returned with public expiry call.
 * Looks up incoming request url in lookup hash and, if found, 
 * sets cache headers accoroding to settings
 *
 * @api private
 */
function middleware(req, res, next) {
  var headerInfo = expiry.assetCache[req.url]
    , options = expiry.options;

  if (headerInfo) {
    var cacheControl = (options.cacheControl === 'cookieless' && req.get('cookie')) ?
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
  var options = expiry.options = parseOpts(options || {});

  if (options.loadCache === 'startup') {
    preCache();
  }

  if (options.debug) {
    app.get('/expiry', function(req, res) {
      res.json({ urlCache: expiry.urlCache, assetCache: expiry.assetCache });
    });
  }
  // certain logic only needs to be checked once, 
  // so let's dynamically create the `furl` function
  app.locals.furl = (function() {
    var f;
    if (options.host) {
      f = util.isArray(options.host) ?
        function(assetUrl) {
          // use the assetUrl to determine the value to mod so that we get 
          // consistent host selection for a particular asset across app servers
          var n = 0;
          for (var i = 0; i !== assetUrl.length; n += assetUrl.charCodeAt(i++));
          
          return options.host[n % options.host.length] + assetUrl;
        } : function(assetUrl) { return options.host + assetUrl; };
    } else {
      f = function(assetUrl) { return assetUrl; };
    }

    if (!options.enabled) return f;

    return function(assetUrl) {
      assetUrl = f(assetUrl);
      var parsed = url.parse(assetUrl, true, true);

      return expiry.urlCache[parsed.pathname] || fingerprintAssetUrl(parsed);
    };
  })();

  return middleware;
};
