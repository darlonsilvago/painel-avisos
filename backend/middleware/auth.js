// backend/middleware/auth.js
const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const header = req.headers['authorization'];

  if (!header) {
    return res.status(401).json({ error: 'Token não informado' });
  }

  const [type, token] = header.split(' ');

  if (type !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // decoded vai ser algo como { id, name, email, role, iat, exp }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

// 🔹 novo middleware: só deixa passar se for admin
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res
      .status(403)
      .json({ error: 'Apenas administradores podem realizar esta ação' });
  }
  next();
}

module.exports = { authMiddleware, requireAdmin };
