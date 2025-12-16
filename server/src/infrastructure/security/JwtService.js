const jwt = require('jsonwebtoken');

class JwtService {
  constructor(secret) {
    this.secret = secret;
  }

  generateToken(payload, expiresIn = '4h') {
    return jwt.sign(payload, this.secret, { expiresIn });
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, this.secret);
    } catch (e) {
      return null;
    }
  }
}

module.exports = JwtService;
