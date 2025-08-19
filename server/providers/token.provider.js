const jwt = require('jsonwebtoken');

var secretKey = require('../config/config').secretKey;

jwt.sign({ foo: 'bar' }, secretKey, { algorithm: 'RS256' }, function (err, token) {
  console.log(token);
});
