const rateLimit = require('express-rate-limit');
const { getDb } = require('../database/db');

// General API rate limiter
const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 200, // 200 requests per minute
    message: { error: 'Too many requests, please slow down' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip for admins
        return req.session?.user?.is_admin;
    }
});

// Strict limiter for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts
    message: { error: 'Too many login attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false
});

// Flag submission limiter (per user, per challenge)
const flagLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 attempts per minute
    message: { error: 'Too many flag submissions, please wait before trying again' },
    keyGenerator: (req) => {
        return `${req.session?.user?.id || req.ip}-${req.params.id}`;
    }
});

// Registration limiter
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // 10 registrations per hour per IP
    message: { error: 'Too many accounts created, please try again later' }
});

// Bruteforce protection - track failed attempts
const failedAttempts = new Map();

function bruteforceProtection(req, res, next) {
    const key = req.ip;
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes
    const maxAttempts = 40;
    
    // Clean old entries
    const attempts = failedAttempts.get(key) || [];
    const recentAttempts = attempts.filter(t => now - t < windowMs);
    
    if (recentAttempts.length >= maxAttempts) {
        return res.status(429).json({ 
            error: 'Too many failed attempts. Please wait 15 minutes.' 
        });
    }
    
    // Store original json method
    const originalJson = res.json.bind(res);
    res.json = function(data) {
        // Track failed auth attempts
        if (res.statusCode === 401 || (data && data.error && data.error.includes('Invalid'))) {
            recentAttempts.push(now);
            failedAttempts.set(key, recentAttempts);
        } else if (res.statusCode === 200 && data && data.success) {
            // Clear on success
            failedAttempts.delete(key);
        }
        return originalJson(data);
    };
    
    next();
}

// DDoS protection middleware
const requestCounts = new Map();
const DDOS_WINDOW = 10000; // 10 seconds
const DDOS_MAX_REQUESTS = 500; // Max 500 requests per 10 seconds (increased for development)
const blockedIPs = new Set();
const blockDuration = 5 * 60 * 1000; // 5 minutes

// Whitelist localhost
const whitelistedIPs = ['::1', '127.0.0.1', '::ffff:127.0.0.1', 'localhost'];

function ddosProtection(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    
    // Skip for localhost/development
    if (whitelistedIPs.includes(ip) || ip?.includes('127.0.0.1') || ip === '::1') {
        return next();
    }
    
    // Check if IP is blocked
    if (blockedIPs.has(ip)) {
        return res.status(429).json({ error: 'Access temporarily blocked' });
    }
    
    const now = Date.now();
    const counts = requestCounts.get(ip) || [];
    const recentCounts = counts.filter(t => now - t < DDOS_WINDOW);
    recentCounts.push(now);
    requestCounts.set(ip, recentCounts);
    
    if (recentCounts.length > DDOS_MAX_REQUESTS) {
        blockedIPs.add(ip);
        setTimeout(() => blockedIPs.delete(ip), blockDuration);
        console.log(`[SECURITY] Blocked IP for potential DDoS: ${ip}`);
        return res.status(429).json({ error: 'Access temporarily blocked due to suspicious activity' });
    }
    
    next();
}

// Clean up old entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, attempts] of failedAttempts.entries()) {
        const recent = attempts.filter(t => now - t < 15 * 60 * 1000);
        if (recent.length === 0) {
            failedAttempts.delete(key);
        } else {
            failedAttempts.set(key, recent);
        }
    }
    for (const [key, counts] of requestCounts.entries()) {
        const recent = counts.filter(t => now - t < DDOS_WINDOW);
        if (recent.length === 0) {
            requestCounts.delete(key);
        }
    }
}, 60000);

// Check if CTF is active
function checkCTFActive(req, res, next) {
    const db = getDb();
    const config = {};
    db.prepare('SELECT * FROM config').all().forEach(c => config[c.key] = c.value);
    
    const now = new Date();
    const start = config.ctf_start ? new Date(config.ctf_start) : null;
    const end = config.ctf_end ? new Date(config.ctf_end) : null;
    
    // Skip check for admins
    if (req.session?.user?.is_admin) {
        return next();
    }
    
    if (start && now < start) {
        return res.status(403).json({ 
            error: 'CTF has not started yet',
            starts_at: config.ctf_start 
        });
    }
    
    if (end && now > end) {
        return res.status(403).json({ 
            error: 'CTF has ended',
            ended_at: config.ctf_end 
        });
    }
    
    next();
}

// Check if scores are frozen
function checkScoreFrozen(req, res, next) {
    const db = getDb();
    const freezeTime = db.prepare('SELECT value FROM config WHERE key = ?').get('score_freeze_time');
    
    if (freezeTime && freezeTime.value) {
        const frozen = new Date(freezeTime.value);
        if (new Date() > frozen && !req.session?.user?.is_admin) {
            req.scoresFrozen = true;
            req.freezeTime = freezeTime.value;
        }
    }
    
    next();
}

module.exports = {
    apiLimiter,
    authLimiter,
    flagLimiter,
    registerLimiter,
    bruteforceProtection,
    ddosProtection,
    checkCTFActive,
    checkScoreFrozen
};
