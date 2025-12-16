function painelTokenMiddleware(req, res, next) {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ error: 'Token não informado' });
  }

  const token = header.replace('Bearer ', '').trim();

  if (token !== process.env.PAINEL_API_TOKEN) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  next();
}

module.exports = { painelTokenMiddleware };
