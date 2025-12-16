class AuthenticateUser {
  constructor(evaluatorRepository, jwtService, adminConfig) {
    this.evaluatorRepository = evaluatorRepository;
    this.jwtService = jwtService;
    this.adminConfig = adminConfig; // { user, pass }
  }

  execute(username, password) {
    // 1. Check Admin
    if (username === this.adminConfig.user && password === this.adminConfig.pass) {
      return {
        token: this.jwtService.generateToken({ user: username, role: 'admin', iat: Date.now() }),
        role: 'admin',
        redirect: '/admin' // Simplified path, controller will handle full path
      };
    }

    // 2. Check Evaluator
    const evaluator = this.evaluatorRepository.findByUsername(username);
    if (evaluator && evaluator.validatePassword(password)) {
      return {
        token: this.jwtService.generateToken({
          user: username,
          role: 'evaluator',
          line: evaluator.line,
          num: evaluator.num,
          iat: Date.now()
        }),
        role: 'evaluator',
        redirect: `/evaluator/${evaluator.line}/${evaluator.num}`
      };
    }

    throw new Error('Credenciais inválidas');
  }
}

module.exports = AuthenticateUser;
