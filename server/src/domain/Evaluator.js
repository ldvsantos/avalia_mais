class Evaluator {
  constructor(username, password, line, num) {
    this.username = username;
    this.password = password;
    this.line = line;
    this.num = num;
  }

  validatePassword(inputPassword) {
    return this.password === inputPassword;
  }
}

module.exports = Evaluator;
