const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
  const token = req.header('Authorization');

  if (!token) {
    return res.status(401).json({ status: 'ERROR', message: 'Access denied. No token provided.' });
  }

  try {
    // Verify the token using your secret key
    const verified = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET || 'my_super_secret_key');
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ status: 'ERROR', message: 'Invalid token.' });
  }
};

module.exports = verifyToken;