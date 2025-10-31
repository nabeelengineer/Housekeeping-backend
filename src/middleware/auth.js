const jwt = require('jsonwebtoken');
require('dotenv').config();

// Base authentication middleware
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'No token provided' });
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

// Role-based access control middleware
function roleCheck(roles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    // If no roles are specified, just check if user is authenticated
    if (!roles.length) return next();
    
    // Check if user has one of the required roles
    if (roles.includes(req.user.role)) {
      return next();
    }
    
    // Check for IT-Admin access to admin routes
    if (req.user.role === 'it_admin' && roles.includes('admin')) {
      return next();
    }
    
    return res.status(403).json({ message: 'Insufficient permissions' });
  };
}

// Combine auth and role check into a single middleware
const auth = (roles = []) => {
  const middlewares = [authMiddleware];
  
  if (roles && roles.length) {
    middlewares.push(roleCheck(roles));
  }
  
  return middlewares;
};

module.exports = {
  authMiddleware,
  roleCheck,
  auth
};