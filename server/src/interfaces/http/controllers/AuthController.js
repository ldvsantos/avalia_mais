class AuthController {
  constructor(authenticateUserUseCase, adminSecret) {
    this.authenticateUserUseCase = authenticateUserUseCase;
    this.adminSecret = adminSecret;
  }

  async login(req, res) {
    try {
      const { username, password } = req.body;
      const result = this.authenticateUserUseCase.execute(username, password);
      
      req.session.token = result.token;
      
      // Prepend the secret path to the redirect
      const fullRedirect = `/secret/${this.adminSecret}${result.redirect}`;
      
      return res.json({
        success: true,
        token: result.token,
        redirect: fullRedirect
      });
    } catch (error) {
      return res.status(401).json({ success: false, error: error.message });
    }
  }

  logout(req, res) {
    req.session.destroy((err) => {
      res.redirect(`/secret/${this.adminSecret}/`);
    });
  }
}

module.exports = AuthController;
