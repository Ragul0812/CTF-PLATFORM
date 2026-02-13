const { getDb } = require('../database/db');

function isAuthenticated(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    }
    return res.status(401).json({ error: 'Unauthorized' });
}

function isAdmin(req, res, next) {
    if (req.session && req.session.user && req.session.user.is_admin) {
        return next();
    }
    return res.status(403).json({ error: 'Forbidden' });
}

module.exports = { isAuthenticated, isAdmin };
