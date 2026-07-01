export function basicAuth(req, res, next) {
  const header = req.headers['authorization'] || '';
  const b64 = header.replace('Basic ', '');
  const [user, pass] = Buffer.from(b64, 'base64').toString().split(':');
  if (user === process.env.ADMIN_USER && pass === process.env.ADMIN_PASS) {
    return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="drone-ops"');
  res.status(401).json({ error: 'Unauthorized' });
}
