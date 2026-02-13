const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { getDb } = require('../database/db');
const { isAuthenticated } = require('../middleware/auth');
const { authLimiter, registerLimiter, bruteforceProtection } = require('../middleware/security');
const { sendVerificationEmail, sendPasswordResetEmail, generateToken } = require('../middleware/email');
const router = express.Router();

// Register
router.post('/register', registerLimiter, (req, res) => {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    // Validate username
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
        return res.status(400).json({ error: 'Username must be 3-20 characters, alphanumeric and underscore only' });
    }
    
    // Validate email
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Invalid email address' });
    }
    
    // Validate password
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    const db = getDb();
    
    // Check registration status
    const regOpen = db.prepare('SELECT value FROM config WHERE key = ?').get('registration_open');
    if (regOpen && regOpen.value !== '1') {
        return res.status(403).json({ error: 'Registration is closed' });
    }
    
    // Check if user exists
    const existingUser = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)').get(username, email);
    if (existingUser) {
        return res.status(400).json({ error: 'Username or email already exists' });
    }
    
    const hashedPassword = bcrypt.hashSync(password, 12);
    const requireVerification = db.prepare('SELECT value FROM config WHERE key = ?').get('require_email_verification');
    const verificationToken = requireVerification?.value === '1' ? generateToken() : null;
    
    try {
        const result = db.prepare(`
            INSERT INTO users (username, email, password, verification_token, is_verified)
            VALUES (?, ?, ?, ?, ?)
        `).run(username, email, hashedPassword, verificationToken, verificationToken ? 0 : 1);
        
        // Send verification email if required
        if (verificationToken) {
            sendVerificationEmail({ username, email }, verificationToken, req);
            return res.json({ 
                success: true, 
                message: 'Registration successful! Please check your email to verify your account.',
                requires_verification: true
            });
        }
        
        const user = db.prepare('SELECT id, username, email, is_admin, team_id, score, play_mode FROM users WHERE id = ?').get(result.lastInsertRowid);
        req.session.user = user;
        
        res.json({ success: true, user });
    } catch (err) {
        console.error('[REGISTER]', err);
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Verify email
router.get('/verify', (req, res) => {
    const { token } = req.query;
    
    if (!token) {
        return res.status(400).json({ error: 'Token required' });
    }
    
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE verification_token = ?').get(token);
    
    if (!user) {
        return res.status(400).json({ error: 'Invalid or expired token' });
    }
    
    db.prepare('UPDATE users SET is_verified = 1, verification_token = NULL WHERE id = ?').run(user.id);
    
    res.json({ success: true, message: 'Email verified successfully! You can now login.' });
});

// Login
router.post('/login', authLimiter, bruteforceProtection, (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }
    
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, username);
    
    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check if banned
    if (user.is_banned) {
        return res.status(403).json({ error: 'Your account has been banned' });
    }
    
    // Check if verified
    const requireVerification = db.prepare('SELECT value FROM config WHERE key = ?').get('require_email_verification');
    if (requireVerification?.value === '1' && !user.is_verified) {
        return res.status(403).json({ error: 'Please verify your email before logging in' });
    }
    
    req.session.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        is_admin: user.is_admin,
        team_id: user.team_id,
        score: user.score,
        play_mode: user.play_mode || 'individual'
    };
    
    res.json({ success: true, user: req.session.user });
});

// Admin login (separate endpoint, hidden)
router.post('/admin-login', authLimiter, bruteforceProtection, (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Credentials required' });
    }
    
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE (username = ? OR email = ?) AND is_admin = 1').get(username, username);
    
    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    req.session.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        is_admin: user.is_admin,
        team_id: user.team_id,
        score: user.score,
        play_mode: user.play_mode || 'individual'
    };
    
    res.json({ success: true, user: req.session.user });
});

// Forgot password
router.post('/forgot-password', authLimiter, async (req, res) => {
    const { email } = req.body;
    
    if (!email) {
        return res.status(400).json({ error: 'Email required' });
    }
    
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    
    // Always return success to prevent email enumeration
    if (!user) {
        return res.json({ success: true, message: 'If an account exists with that email, a reset link has been sent.' });
    }
    
    const token = generateToken();
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
    
    db.prepare('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?').run(token, expires, user.id);
    
    await sendPasswordResetEmail(user, token, req);
    
    res.json({ success: true, message: 'If an account exists with that email, a reset link has been sent.' });
});

// Reset password
router.post('/reset-password', (req, res) => {
    const { token, password } = req.body;
    
    if (!token || !password) {
        return res.status(400).json({ error: 'Token and password required' });
    }
    
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > ?').get(token, new Date().toISOString());
    
    if (!user) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    
    const hashedPassword = bcrypt.hashSync(password, 12);
    db.prepare('UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?').run(hashedPassword, user.id);
    
    res.json({ success: true, message: 'Password reset successfully! You can now login.' });
});

// Delete account
router.delete('/delete-account', isAuthenticated, (req, res) => {
    const { password } = req.body;
    const db = getDb();
    const userId = req.session.user.id;

    if (!password) {
        return res.status(400).json({ error: 'Password is required to confirm account deletion' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    if (user.is_admin) {
        return res.status(403).json({ error: 'Admin accounts cannot be deleted' });
    }

    if (!bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: 'Incorrect password' });
    }

    try {
        // Handle team captaincy
        if (user.team_id) {
            const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(user.team_id);
            if (team && team.captain_id === userId) {
                const otherMember = db.prepare('SELECT id FROM users WHERE team_id = ? AND id != ?').get(user.team_id, userId);
                if (otherMember) {
                    db.prepare('UPDATE teams SET captain_id = ? WHERE id = ?').run(otherMember.id, user.team_id);
                } else {
                    db.prepare('UPDATE teams SET captain_id = NULL WHERE id = ?').run(user.team_id);
                    db.prepare('DELETE FROM teams WHERE id = ?').run(user.team_id);
                }
            }

            // Subtract user score from team score
            if (user.score > 0) {
                db.prepare('UPDATE teams SET score = MAX(0, score - ?) WHERE id = ?').run(user.score, user.team_id);
            }
        }

        // Delete user-related data
        db.prepare('DELETE FROM submissions WHERE user_id = ?').run(userId);
        db.prepare('DELETE FROM challenge_attempts WHERE user_id = ?').run(userId);
        db.prepare('DELETE FROM hint_unlocks WHERE user_id = ?').run(userId);
        db.prepare('DELETE FROM challenge_ratings WHERE user_id = ?').run(userId);
        db.prepare('DELETE FROM users WHERE id = ?').run(userId);

        req.session.destroy();
        res.json({ success: true });
    } catch (err) {
        console.error('[DELETE-ACCOUNT]', err);
        res.status(500).json({ error: 'Failed to delete account' });
    }
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// Get current user
router.get('/me', (req, res) => {
    if (req.session && req.session.user) {
        const db = getDb();
        const user = db.prepare('SELECT id, username, email, is_admin, team_id, score, play_mode FROM users WHERE id = ?').get(req.session.user.id);
        if (user) {
            req.session.user = user;
            return res.json({ user });
        }
    }
    res.json({ user: null });
});

module.exports = router;

