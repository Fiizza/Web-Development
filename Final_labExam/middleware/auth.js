// middleware/auth.js

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/auth/login');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || !req.session.user.isAdmin) {
    return res.status(403).send('Access denied. Admins only.');
  }
  next();
}

module.exports = {
  requireAuth,
  requireAdmin
};
