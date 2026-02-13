const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../database/db');
const { isAuthenticated } = require('../middleware/auth');
const router = express.Router();

const avatarStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', 'uploads', 'avatars');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `user-${req.session.user.id}-${Date.now()}${ext}`);
    }
});
const avatarUpload = multer({ 
    storage: avatarStorage, 
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, allowed.includes(ext));
    }
});

// Get all users
router.get('/', (req, res) => {
    const db = getDb();
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;
    
    const users = db.prepare(`
        SELECT u.id, u.username, u.score, u.country, u.play_mode, u.created_at, u.avatar_url, t.name as team_name
        FROM users u
        LEFT JOIN teams t ON u.team_id = t.id
        WHERE u.is_hidden = 0 AND u.is_admin = 0
        ORDER BY u.created_at ASC
        LIMIT ? OFFSET ?
    `).all(limit, offset);
    
    const total = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_hidden = 0 AND is_admin = 0').get();
    
    res.json({
        users,
        pagination: {
            page,
            limit,
            total: total.count,
            pages: Math.ceil(total.count / limit)
        }
    });
});

// Get user by ID
router.get('/:id', (req, res) => {
    const db = getDb();
    const user = db.prepare(`
        SELECT u.id, u.username, u.score, u.bio, u.country, u.website, u.github, u.twitter,
               u.play_mode, u.created_at, u.avatar_url, t.id as team_id, t.name as team_name
        FROM users u
        LEFT JOIN teams t ON u.team_id = t.id
        WHERE u.id = ? AND u.is_hidden = 0
    `).get(req.params.id);
    
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    // Get solved challenges
    const solves = db.prepare(`
        SELECT c.id, c.title, c.category, c.points, s.submitted_at
        FROM submissions s
        JOIN challenges c ON s.challenge_id = c.id
        WHERE s.user_id = ? AND s.is_correct = 1
        ORDER BY s.submitted_at DESC
    `).all(req.params.id);
    
    // Get user rank
    const rank = db.prepare(`
        SELECT COUNT(*) + 1 as rank FROM users 
        WHERE score > ? AND is_hidden = 0 AND is_admin = 0
    `).get(user.score);
    
    // Get solve timeline (for graph)
    const timeline = db.prepare(`
        SELECT DATE(s.submitted_at) as date, SUM(c.points) as points
        FROM submissions s
        JOIN challenges c ON s.challenge_id = c.id
        WHERE s.user_id = ? AND s.is_correct = 1
        GROUP BY DATE(s.submitted_at)
        ORDER BY date ASC
    `).all(req.params.id);
    
    // Calculate cumulative score for timeline
    let cumulative = 0;
    const scoreTimeline = timeline.map(t => {
        cumulative += t.points;
        return { date: t.date, score: cumulative };
    });
    
    res.json({ user, solves, rank: rank.rank, timeline: scoreTimeline });
});

// Update own profile
router.put('/profile', isAuthenticated, (req, res) => {
    const { bio, country, website, github, twitter, play_mode } = req.body;
    const db = getDb();
    
    try {
        db.prepare(`
            UPDATE users 
            SET bio = ?, country = ?, website = ?, github = ?, twitter = ?, play_mode = ?
            WHERE id = ?
        `).run(
            bio || '', 
            country || '', 
            website || '', 
            github || '', 
            twitter || '', 
            play_mode || 'individual',
            req.session.user.id
        );
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// Switch play mode
router.post('/play-mode', isAuthenticated, (req, res) => {
    const { mode } = req.body;
    const db = getDb();
    
    if (!['individual', 'team'].includes(mode)) {
        return res.status(400).json({ error: 'Invalid play mode' });
    }
    
    // If switching to individual, leave team
    if (mode === 'individual' && req.session.user.team_id) {
        db.prepare('UPDATE users SET team_id = NULL WHERE id = ?').run(req.session.user.id);
        req.session.user.team_id = null;
    }
    
    db.prepare('UPDATE users SET play_mode = ? WHERE id = ?').run(mode, req.session.user.id);
    req.session.user.play_mode = mode;
    
    res.json({ success: true, mode });
});

// Upload avatar
router.post('/avatar', isAuthenticated, avatarUpload.single('avatar'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No valid image file provided' });
    const db = getDb();
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(avatarUrl, req.session.user.id);
    res.json({ success: true, avatar_url: avatarUrl });
});

router.delete('/avatar', isAuthenticated, (req, res) => {
    const db = getDb();
    db.prepare('UPDATE users SET avatar_url = NULL WHERE id = ?').run(req.session.user.id);
    res.json({ success: true });
});

module.exports = router;
