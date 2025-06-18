// middleware/adminMiddleware.js

// Hardcoded admin credentials
const ADMIN_CREDENTIALS = {
    email: 'admin@asos.com',
    password: 'admin123'
};

// Middleware to check if user is authenticated admin
const requireAdminAuth = (req, res, next) => {
    if (req.session && req.session.isAdmin) {
        return next();
    } else {
        return res.status(401).json({ 
            success: false, 
            message: 'Admin authentication required' 
        });
    }
};

// Middleware to check admin credentials
const validateAdminCredentials = (req, res, next) => {
    const { email, password } = req.body;
    
    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: 'Email and password are required'
        });
    }
    
    if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
        req.session.isAdmin = true;
        req.session.adminEmail = email;
        return next();
    } else {
        return res.status(401).json({
            success: false,
            message: 'Invalid admin credentials'
        });
    }
};

// Middleware to log admin actions
const logAdminAction = (action) => {
    return (req, res, next) => {
        console.log(`Admin Action: ${action} - ${new Date().toISOString()}`);
        console.log(`Admin Email: ${req.session.adminEmail || 'Unknown'}`);
        console.log(`Request IP: ${req.ip}`);
        next();
    };
};

module.exports = {
    requireAdminAuth,
    validateAdminCredentials,
    logAdminAction,
    ADMIN_CREDENTIALS
};