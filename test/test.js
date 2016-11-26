var connect = require("connect")
  , request = require("supertest")
  , expiry = require('../')
  , path = require('path')
  , util = require('util')
  , options = { dir: path.join(__dirname, 'fixtures'), loadCache: 'startup' }
  , getHash = function(filePath) {
      return require('crypto').createHash('md5').
        update(require('fs').readFileSync(filePath)).digest('hex')
    }
  , stylesPath = path.join(__dirname, 'fixtures', 'styles.css')
  , stylesHash = getHash(stylesPath)
  , imagePath = path.join(__dirname, 'fixtures', 'image.jpeg');

describe('furl', function() {
  var app;

  beforeEach(function() {
    app = { get: function() {},
            locals: {} };
    expiry(app, options);
    expiry.clearCache();
  });

  afterEach(function() {
    expiry.clearCache();
    expiry.setOptions(options);
  });

  it('fingerprint in the file prefix by default', function() {
    var result = app.locals.furl('/styles.css');
    result.should.equal(util.format('/%s-styles.css', stylesHash));
  });

  it('fingerprint in the file postfix', function() {
    expiry.options.location = 'postfile';
    var result = app.locals.furl('/styles.css');
    result.should.equal(util.format('/styles-%s.css', stylesHash));
  });

  it('fingerprint in the query parameter', function() {
    expiry.options.location = 'query';

    var result = app.locals.furl('/styles.css');
    result.should.equal(util.format('/styles.css?v=%s', stylesHash));
  });

  it('fingerprint in the path', function() {
    expiry.options.location = 'path';

    var result = app.locals.furl('/styles.css');
    result.should.equal(util.format('/%s/styles.css', stylesHash));
  });

  it('uses the second argument when in prod mode', function() {
    expiry.options.useSecond = true;
    var result = app.locals.furl('/styles.css', '/styles.min.css');
    result.should.containEql('styles.min.css');
  });

  it('uses a host', function() {
    expiry.options.host = '//cdn.acme.com';

    var result = app.locals.furl('/styles.css');
    result.should.equal(util.format('//cdn.acme.com/%s-styles.css', stylesHash));
  });

  it('allows a host in the argument', function() {
    var result = app.locals.furl('http://cdn2.acme.com/styles.css');
    result.should.equal(util.format('http://cdn2.acme.com/%s-styles.css', stylesHash));
  });
});

describe("middleware", function() {
  var app;
  var headerExists = function(res, header) {
    return res.headers[header] !== undefined;
  };

  beforeEach(function() {
    app = connect();
    app.use(expiry(app, options));
    app.use(function(req, res, next) {
      res.end("pretending to serve file: " + req.url);
    });
  });

  afterEach(function() {
    expiry.clearCache();
    expiry.setOptions(options);
  });

  describe("cache headers", function() {
    it("sets an expires and cache-control header for unconditional: both", function() {
      expiry.options.unconditional = "both";

      return request(app)
        .get(util.format('/%s-styles.css', stylesHash))
        .expect(function(res) {
          if(!headerExists(res, "expires"))
            throw new Error("Expires header expected");
        })
        .expect("Cache-Control", new RegExp("max-age=" + expiry.options.duration));
    });

    it("doesn't set an expires or max-age for unconditional: none", function() {
      expiry.options.unconditional = "none";

      return request(app)
        .get(util.format('/%s-styles.css', stylesHash))
        .expect(function(res) {
          var unexpectedExpires = headerExists(res, "expires");
          var unexpectedMaxAge = res.headers["cache-control"] &&
            res.headers["cache-control"].indexOf("max-age") > -1;

          if(unexpectedExpires || unexpectedMaxAge)
            throw new Error("Unexpected caching header");
        });
    });

    it("sets cache-control to public or private dynamically when cacheControl: cookieless", function() {
      return Promise.all([
        // The no-cookie version returns cache-control public.
        request(app)
        .get(util.format('/%s-styles.css', stylesHash))
        .expect("Cache-Control", /^public\,/),

        // The cookie version returns cache-control private
        request(app)
        .get(util.format('/%s-styles.css', stylesHash))
        .set('Cookie', 'dummy-cookie')
        .expect("Cache-Control", /^private\,/)
      ]);
    });
  });
});
