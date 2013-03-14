var expiry = require('../')
  , path = require('path')
  , util = require('util')
  , options = { dir: path.join(__dirname, 'fixtures'), loadCache: 'furl' }
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
    result.should.include('styles.min.css');
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
