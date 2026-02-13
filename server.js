const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
const db = require('./database/db');
const { apiLimiter, ddosProtection } = require('./middleware/security');
const { uploadDir } = require('./middleware/upload');

const app = express();
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all network interfaces

// Trust proxy (for rate limiting behind reverse proxy)
app.set('trust proxy', 1);

// Enable gzip compression for better performance
app.use(compression());

// Security headers
app.use(helmet({
    contentSecurityPolicy: false, // Disable for custom scripts
    crossOriginEmbedderPolicy: false
}));

// DDoS protection
app.use(ddosProtection);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Static files with caching for better performance
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1h',
    etag: true
}));
app.use('/uploads', express.static(uploadDir, {
    maxAge: '1d',
    etag: true
}));

// Session
app.use(session({
    secret: process.env.SESSION_SECRET || 'ctf-secret-key-change-in-production-' + Math.random(),
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: 'lax'
    }
}));

// Rate limiting for API
app.use('/api', apiLimiter);

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/teams', require('./routes/teams'));
app.use('/api/challenges', require('./routes/challenges'));
app.use('/api/scoreboard', require('./routes/scoreboard'));
app.use('/api/admin', require('./routes/admin'));

// Public config endpoint (for theme/branding) - hide sensitive data
app.get('/api/config', (req, res) => {
    const database = db.getDb();
    const configs = database.prepare('SELECT * FROM config').all();
    const config = {};
    
    // Keys to hide from public
    const sensitiveKeys = [
        'email_smtp_password', 'email_mailgun_password',
        'storage_s3_access_key', 'storage_s3_secret_key',
        'email_smtp_user', 'email_mailgun_user'
    ];
    
    configs.forEach(c => {
        if (!sensitiveKeys.includes(c.key) && !c.key.includes('password') && !c.key.includes('secret')) {
            config[c.key] = c.value;
        }
    });
    
    // Hide admin-only settings from non-admins
    if (!req.session?.user?.is_admin) {
        delete config.storage_s3_endpoint;
        delete config.storage_s3_bucket;
        delete config.email_smtp_host;
    }
    
    res.json(config);
});

// Custom code endpoint
app.get('/api/custom-code', (req, res) => {
    const database = db.getDb();
    const codes = database.prepare('SELECT * FROM custom_code').all();
    const result = {};
    codes.forEach(c => result[c.key] = c.value);
    res.json(result);
});

// Notifications endpoints
app.get('/api/notifications', (req, res) => {
    const database = db.getDb();
    const notifications = database.prepare(`
        SELECT id, title, content, type, created_at FROM notifications 
        WHERE is_global = 1 
        ORDER BY created_at DESC 
        LIMIT 20
    `).all();
    res.json({ notifications });
});

app.get('/api/notifications/user', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.json({ notifications: [] });
    }
    const database = db.getDb();
    const notifications = database.prepare(`
        SELECT id, title, content, type, created_at FROM notifications 
        WHERE is_global = 1 OR user_id = ?
        ORDER BY created_at DESC 
        LIMIT 20
    `).all(req.session.user.id);
    res.json({ notifications });
});

// CTF status endpoint
app.get('/api/status', (req, res) => {
    const database = db.getDb();
    const config = {};
    database.prepare('SELECT * FROM config WHERE key IN (?, ?, ?)').all('ctf_start', 'ctf_end', 'score_freeze_time').forEach(c => {
        config[c.key] = c.value;
    });
    
    const now = new Date();
    const start = config.ctf_start ? new Date(config.ctf_start) : null;
    const end = config.ctf_end ? new Date(config.ctf_end) : null;
    const freeze = config.score_freeze_time ? new Date(config.score_freeze_time) : null;
    
    let status = 'running';
    if (start && now < start) status = 'upcoming';
    if (end && now > end) status = 'ended';
    
    res.json({
        status,
        starts_at: config.ctf_start || null,
        ends_at: config.ctf_end || null,
        scores_frozen: freeze ? now > freeze : false,
        freeze_time: config.score_freeze_time || null,
        server_time: now.toISOString()
    });
});

// Serve frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
    console.error('[ERROR]', err.message);
    
    // Handle multer errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 1GB.' });
    }
    if (err.message === 'File type not allowed') {
        return res.status(400).json({ error: 'File type not allowed. Please upload a supported file format.' });
    }
    
    res.status(500).json({ error: err.message || 'Internal server error' });
});

// Initialize database and start server
db.initialize();

app.listen(PORT, HOST, () => {
    console.log(`🚩 CTF Platform running on http://${HOST}:${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Local access: http://localhost:${PORT}`);
    
    // Get local IP for network access
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();
    for (const name of Object.keys(networkInterfaces)) {
        for (const net of networkInterfaces[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                console.log(`   Network access: http://${net.address}:${PORT}`);
            }
        }
    }
});

