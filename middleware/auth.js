const jwt = require('jsonwebtoken');
function readuser(req, res, next) {
    const token = req.cookies.token; 
    if(!token) {
        return null;
    }
       try {
     return jwt.verify(token, process.env.JWT_SECRET);
     
   } catch (error) {
  return null;
   }
}
function verifyToken(req, res, next) {
    const user = readuser(req, res, next);
    if (!user) {
        return res.status(401).json({ message: 'Please log in to access this resource' });
    }
    req.user = user;
    next();
}
function optionalAuth(req, res, next) {
    req.user = readuser(req, res, next);
    next();
}
function isAdmin(req, res, next) {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        return res.status(403).json({ message: 'Access denied. Admins only.' });
    }
}
module.exports = { readuser, verifyToken, optionalAuth, isAdmin };
