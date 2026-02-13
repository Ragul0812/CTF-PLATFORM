const express = require('express');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { getDb, exportData, importData } = require('../database/db');
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const { upload, uploadFile, deleteFile, uploadDir } = require('../middleware/upload');
const { sendEmail, sendCustomEmail, getEmailConfig } = require('../middleware/email');
const router = express.Router();

// All admin routes require authentication and admin privileges
router.use(isAuthenticated, isAdmin);

// Dashboard stats
router.get('/stats', (req, res) => {
    const db = getDb();
    
    const stats = {
        users: db.prepare('SELECT COUNT(*) as count FROM users WHERE is_admin = 0').get().count,
        teams: db.prepare('SELECT COUNT(*) as count FROM teams').get().count,
        challenges: db.prepare('SELECT COUNT(*) as count FROM challenges').get().count,
        submissions: db.prepare('SELECT COUNT(*) as count FROM submissions').get().count,
        correct_submissions: db.prepare('SELECT COUNT(*) as count FROM submissions WHERE is_correct = 1').get().count,
        banned_users: db.prepare('SELECT COUNT(*) as count FROM users WHERE is_banned = 1').get()?.count || 0,
        banned_teams: db.prepare('SELECT COUNT(*) as count FROM teams WHERE is_banned = 1').get()?.count || 0
    };
    
    res.json(stats);
});

// Get config
router.get('/config', (req, res) => {
    const db = getDb();
    const configs = db.prepare('SELECT * FROM config').all();
    const config = {};
    configs.forEach(c => config[c.key] = c.value);
    res.json(config);
});

// Update config
router.put('/config', (req, res) => {
    const db = getDb();
    const { key, value } = req.body;
    
    db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(key, value);
    res.json({ success: true });
});

// Bulk update config
router.put('/config/bulk', (req, res) => {
    const db = getDb();
    const { settings } = req.body;
    
    try {
        const stmt = db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
        for (const [key, value] of Object.entries(settings)) {
            stmt.run(key, value);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save settings' });
    }
});

// ============ CHALLENGES ============

// Get all challenges (including hidden)
router.get('/challenges', (req, res) => {
    const db = getDb();
    const challenges = db.prepare('SELECT * FROM challenges ORDER BY category, points').all();
    res.json({ challenges });
});

// Create challenge
router.post('/challenges', (req, res) => {
    const { title, description, category, points, flag, file_url, hint, hint_cost, is_hidden, max_attempts, author, show_flag, link_url, extra_files, extra_links, wave } = req.body;
    const db = getDb();
    
    if (!title || !description || !category || !points || !flag) {
        return res.status(400).json({ error: 'Required fields missing' });
    }
    
    try {
        const result = db.prepare(`
            INSERT INTO challenges (title, description, category, points, flag, file_url, hint, hint_cost, is_hidden, max_attempts, author, show_flag, link_url, extra_files, extra_links, wave)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(title, description, category, points, flag, file_url || null, hint || null, hint_cost || 0, is_hidden ? 1 : 0, max_attempts || null, author || null, show_flag ? 1 : 0, link_url || null, JSON.stringify(extra_files || []), JSON.stringify(extra_links || []), wave || 0);
        
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create challenge' });
    }
});

// Upload challenge file
router.post('/challenges/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    try {
        const fileUrl = await uploadFile(req.file);
        res.json({ success: true, file_url: fileUrl });
    } catch (err) {
        console.error('[UPLOAD]', err);
        res.status(500).json({ error: 'Failed to upload file' });
    }
});

// Upload logo
router.post('/logo/upload', upload.single('logo'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Validate image type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/svg+xml', 'image/webp'];
    if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({ error: 'Invalid file type. Please upload an image (PNG, JPEG, GIF, SVG, WebP)' });
    }
    
    try {
        const fileUrl = await uploadFile(req.file);
        
        // Save to config
        const db = getDb();
        db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run('logo_image', fileUrl);
        
        res.json({ success: true, logo_url: fileUrl });
    } catch (err) {
        console.error('[LOGO UPLOAD]', err);
        res.status(500).json({ error: 'Failed to upload logo' });
    }
});

// Delete logo
router.delete('/logo', (req, res) => {
    const db = getDb();
    
    try {
        const logoConfig = db.prepare('SELECT value FROM config WHERE key = ?').get('logo_image');
        if (logoConfig?.value && logoConfig.value.startsWith('/uploads/')) {
            const filePath = path.join(uploadDir, path.basename(logoConfig.value));
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        
        db.prepare('DELETE FROM config WHERE key = ?').run('logo_image');
        res.json({ success: true });
    } catch (err) {
        console.error('[LOGO DELETE]', err);
        res.status(500).json({ error: 'Failed to delete logo' });
    }
});

// Update challenge
router.put('/challenges/:id', (req, res) => {
    const { title, description, category, points, flag, file_url, hint, hint_cost, is_hidden, max_attempts, author, show_flag, link_url, extra_files, extra_links, wave } = req.body;
    const db = getDb();
    
    try {
        db.prepare(`
            UPDATE challenges 
            SET title = ?, description = ?, category = ?, points = ?, flag = ?, 
                file_url = ?, hint = ?, hint_cost = ?, is_hidden = ?, max_attempts = ?, author = ?, show_flag = ?, link_url = ?,
                extra_files = ?, extra_links = ?, wave = ?
            WHERE id = ?
        `).run(title, description, category, points, flag, file_url, hint, hint_cost || 0, is_hidden ? 1 : 0, max_attempts || null, author || null, show_flag ? 1 : 0, link_url || null, JSON.stringify(extra_files || []), JSON.stringify(extra_links || []), wave || 0, req.params.id);
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update challenge' });
    }
});

// Delete challenge
router.delete('/challenges/:id', (req, res) => {
    const db = getDb();
    
    try {
        // Get challenge to delete associated file
        const challenge = db.prepare('SELECT file_url FROM challenges WHERE id = ?').get(req.params.id);
        
        db.prepare('DELETE FROM submissions WHERE challenge_id = ?').run(req.params.id);
        db.prepare('DELETE FROM challenge_attempts WHERE challenge_id = ?').run(req.params.id);
        db.prepare('DELETE FROM challenges WHERE id = ?').run(req.params.id);
        
        // Delete file if local
        if (challenge?.file_url && challenge.file_url.startsWith('/uploads/')) {
            const filePath = path.join(uploadDir, path.basename(challenge.file_url));
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete challenge' });
    }
});

// ============ USERS ============

// Get all users
router.get('/users', (req, res) => {
    const db = getDb();
    const users = db.prepare(`
        SELECT u.id, u.username, u.email, u.score, u.is_admin, u.is_hidden, u.is_banned, u.is_verified, u.created_at,
               t.name as team_name
        FROM users u
        LEFT JOIN teams t ON u.team_id = t.id
        ORDER BY u.created_at DESC
    `).all();
    res.json({ users });
});

// Update user
router.put('/users/:id', (req, res) => {
    const { is_admin, is_hidden, is_banned, score, password } = req.body;
    const db = getDb();
    
    try {
        if (password) {
            const hashedPassword = bcrypt.hashSync(password, 12);
            db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, req.params.id);
        }
        
        db.prepare(`
            UPDATE users SET is_admin = ?, is_hidden = ?, is_banned = ?, score = ? WHERE id = ?
        `).run(is_admin ? 1 : 0, is_hidden ? 1 : 0, is_banned ? 1 : 0, score || 0, req.params.id);
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Ban/unban user
router.post('/users/:id/ban', (req, res) => {
    const db = getDb();
    const { banned } = req.body;
    
    if (parseInt(req.params.id) === req.session.user.id) {
        return res.status(400).json({ error: 'Cannot ban yourself' });
    }
    
    try {
        db.prepare('UPDATE users SET is_banned = ? WHERE id = ?').run(banned ? 1 : 0, req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Delete user
router.delete('/users/:id', (req, res) => {
    const db = getDb();
    
    if (parseInt(req.params.id) === req.session.user.id) {
        return res.status(400).json({ error: 'Cannot delete yourself' });
    }
    
    try {
        db.prepare('DELETE FROM submissions WHERE user_id = ?').run(req.params.id);
        db.prepare('DELETE FROM challenge_attempts WHERE user_id = ?').run(req.params.id);
        db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// ============ TEAMS ============

// Get all teams
router.get('/teams', (req, res) => {
    const db = getDb();
    const teams = db.prepare(`
        SELECT t.*, 
               (SELECT COUNT(*) FROM users WHERE team_id = t.id) as member_count
        FROM teams t
        ORDER BY t.created_at DESC
    `).all();
    res.json({ teams });
});

// Update team
router.put('/teams/:id', (req, res) => {
    const { is_hidden, is_banned, score } = req.body;
    const db = getDb();
    
    try {
        db.prepare(`
            UPDATE teams SET is_hidden = ?, is_banned = ?, score = ? WHERE id = ?
        `).run(is_hidden ? 1 : 0, is_banned ? 1 : 0, score || 0, req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update team' });
    }
});

// Ban/unban team
router.post('/teams/:id/ban', (req, res) => {
    const db = getDb();
    const { banned } = req.body;
    const teamId = parseInt(req.params.id);
    
    try {
        db.prepare('UPDATE teams SET is_banned = ? WHERE id = ?').run(banned ? 1 : 0, teamId);
        // Also ban/unban all team members
        if (banned) {
            db.prepare('UPDATE users SET is_banned = 1 WHERE team_id = ?').run(teamId);
        } else {
            db.prepare('UPDATE users SET is_banned = 0 WHERE team_id = ?').run(teamId);
        }
        // Update session if requesting user is in that team
        if (req.session?.user?.team_id === teamId) {
            req.session.user.is_banned = banned ? 1 : 0;
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update team' });
    }
});

// Delete team
router.delete('/teams/:id', (req, res) => {
    const db = getDb();
    
    try {
        db.prepare('UPDATE users SET team_id = NULL WHERE team_id = ?').run(req.params.id);
        db.prepare('DELETE FROM submissions WHERE team_id = ?').run(req.params.id);
        db.prepare('DELETE FROM teams WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete team' });
    }
});

// ============ SUBMISSIONS ============

// Get recent submissions
router.get('/submissions', (req, res) => {
    const db = getDb();
    const submissions = db.prepare(`
        SELECT s.*, u.username, c.title as challenge_title
        FROM submissions s
        JOIN users u ON s.user_id = u.id
        JOIN challenges c ON s.challenge_id = c.id
        ORDER BY s.submitted_at DESC
        LIMIT 100
    `).all();
    res.json({ submissions });
});

// ============ NOTIFICATIONS ============

// Get all notifications
router.get('/notifications', (req, res) => {
    const db = getDb();
    const notifications = db.prepare(`
        SELECT n.*, u.username 
        FROM notifications n
        LEFT JOIN users u ON n.user_id = u.id
        ORDER BY n.created_at DESC
    `).all();
    res.json({ notifications });
});

// Create notification
router.post('/notifications', (req, res) => {
    const { title, content, type } = req.body;
    const db = getDb();
    
    if (!title || !content) {
        return res.status(400).json({ error: 'Title and content required' });
    }
    
    try {
        const result = db.prepare(`
            INSERT INTO notifications (title, content, type, is_global)
            VALUES (?, ?, ?, 1)
        `).run(title, content, type || 'info');
        
        res.json({ success: true, id: result.lastInsertRowid });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create notification' });
    }
});

// Delete notification
router.delete('/notifications/:id', (req, res) => {
    const db = getDb();
    
    try {
        db.prepare('DELETE FROM notifications WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete notification' });
    }
});

// ============ CUSTOM CODE ============

// Get custom code
router.get('/custom-code', (req, res) => {
    const db = getDb();
    const codes = db.prepare('SELECT * FROM custom_code').all();
    const result = {};
    codes.forEach(c => result[c.key] = c.value);
    res.json(result);
});

// Update custom code
router.put('/custom-code', (req, res) => {
    const { key, value } = req.body;
    const db = getDb();
    
    const validKeys = ['custom_css', 'custom_js', 'custom_head', 'custom_footer', 'page_challenges', 'page_scoreboard', 'page_teams', 'page_home', 'page_opening', 'page_ending'];
    if (!validKeys.includes(key)) {
        return res.status(400).json({ error: 'Invalid key' });
    }
    
    try {
        db.prepare(`
            INSERT OR REPLACE INTO custom_code (key, value, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        `).run(key, value);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save code' });
    }
});

// ============ PAGES (Markdown CMS) ============

// Get all pages
router.get('/pages', (req, res) => {
    const db = getDb();
    const pages = db.prepare('SELECT * FROM pages ORDER BY title').all();
    res.json({ pages });
});

// Create/update page
router.post('/pages', (req, res) => {
    const { slug, title, content, is_published } = req.body;
    const db = getDb();
    
    if (!slug || !title || !content) {
        return res.status(400).json({ error: 'Slug, title and content required' });
    }
    
    try {
        db.prepare(`
            INSERT OR REPLACE INTO pages (slug, title, content, is_published, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(slug, title, content, is_published ? 1 : 0);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save page' });
    }
});

// Delete page
router.delete('/pages/:slug', (req, res) => {
    const db = getDb();
    
    try {
        db.prepare('DELETE FROM pages WHERE slug = ?').run(req.params.slug);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete page' });
    }
});

// ============ IMPORT/EXPORT ============

// Export all data
router.get('/export', (req, res) => {
    try {
        const data = exportData();
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=ctf-export-${Date.now()}.json`);
        res.json(data);
    } catch (err) {
        console.error('[EXPORT]', err);
        res.status(500).json({ error: 'Failed to export data' });
    }
});

// Import data
router.post('/import', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    try {
        const data = JSON.parse(req.file.buffer.toString());
        importData(data);
        res.json({ success: true, message: 'Data imported successfully' });
    } catch (err) {
        console.error('[IMPORT]', err);
        res.status(500).json({ error: 'Failed to import data: ' + err.message });
    }
});

// ============ SCORE GRAPH DATA ============

router.get('/scoregraph', (req, res) => {
    const db = getDb();
    
    // Get top 10 teams
    const topTeams = db.prepare(`
        SELECT t.id, t.name, t.score
        FROM teams t
        WHERE t.is_hidden = 0 AND t.is_banned = 0
        ORDER BY t.score DESC, t.id ASC
        LIMIT 10
    `).all();
    
    // Get solve timeline for each team
    const graphData = topTeams.map(team => {
        const solves = db.prepare(`
            SELECT s.submitted_at, c.points
            FROM submissions s
            JOIN challenges c ON s.challenge_id = c.id
            WHERE s.team_id = ? AND s.is_correct = 1
            ORDER BY s.submitted_at ASC
        `).all(team.id);
        
        let runningScore = 0;
        const timeline = solves.map(s => {
            runningScore += s.points;
            return { time: s.submitted_at, score: runningScore };
        });
        
        return { name: team.name, timeline };
    });
    
    res.json({ graphData });
});

// ============ AUDIT LOG ============

router.get('/audit', (req, res) => {
    const db = getDb();
    const logs = db.prepare(`
        SELECT a.*, u.username
        FROM audit_log a
        LEFT JOIN users u ON a.user_id = u.id
        ORDER BY a.created_at DESC
        LIMIT 200
    `).all();
    res.json({ logs });
});

// ============ REFRESH DB ============

// Refresh DB - clear event data but keep admin and challenges
router.post('/refresh-db', (req, res) => {
    const db = getDb();
    try {
        db.exec('DELETE FROM submissions');
        db.exec('DELETE FROM challenge_attempts');
        db.exec('DELETE FROM hint_unlocks');
        db.exec('DELETE FROM challenge_ratings');
        db.exec('DELETE FROM notifications');
        db.exec('UPDATE challenges SET solves = 0');
        db.exec('UPDATE users SET team_id = NULL, score = 0 WHERE is_admin = 0');
        db.exec('DELETE FROM teams');
        db.exec('DELETE FROM users WHERE is_admin = 0');
        db.exec('DELETE FROM audit_log');
        
        // Reset auto-increment sequences
        db.exec("DELETE FROM sqlite_sequence WHERE name IN ('teams', 'submissions', 'challenge_attempts', 'hint_unlocks', 'challenge_ratings', 'notifications', 'audit_log')");
        // Reset users sequence to admin's current ID so next user gets admin_id+1
        const admin = db.prepare('SELECT id FROM users WHERE is_admin = 1').get();
        if (admin) {
            db.prepare("UPDATE sqlite_sequence SET seq = ? WHERE name = 'users'").run(admin.id);
        }
        
        res.json({ success: true, message: 'Database refreshed. All event data cleared.' });
    } catch (err) {
        console.error('[ERROR]', err.message);
        res.status(500).json({ error: 'Failed to refresh database' });
    }
});

// ============ DATA EXPORTS ============

// Export users CSV
router.get('/export/users', (req, res) => {
    const db = getDb();
    const users = db.prepare(`
        SELECT u.id, u.username, u.email, u.score, t.name as team_name, u.is_banned, u.created_at
        FROM users u LEFT JOIN teams t ON u.team_id = t.id
        WHERE u.is_admin = 0
        ORDER BY u.score DESC
    `).all();
    
    let csv = 'S.No,Username,Email,Score,Team,Banned,Registered\n';
    users.forEach((u, i) => {
        csv += `${i + 1},"${u.username}","${u.email}",${u.score},"${u.team_name || ''}",${u.is_banned ? 'Yes' : 'No'},"${u.created_at}"\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=users_export.csv');
    res.send(csv);
});

// Export teams CSV
router.get('/export/teams', (req, res) => {
    const db = getDb();
    const teams = db.prepare(`
        SELECT t.*, COUNT(u.id) as member_count
        FROM teams t LEFT JOIN users u ON u.team_id = t.id
        GROUP BY t.id ORDER BY t.score DESC
    `).all();
    
    let csv = 'S.No,Team Name,Score,Members,Captain,Banned,Created\n';
    teams.forEach((t, i) => {
        csv += `${i + 1},"${t.name}",${t.score},${t.member_count},"${t.captain_id || ''}",${t.is_banned ? 'Yes' : 'No'},"${t.created_at}"\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=teams_export.csv');
    res.send(csv);
});

// Export scoreboard CSV
router.get('/export/scoreboard', (req, res) => {
    const db = getDb();
    const entries = db.prepare(`
        SELECT t.id, t.name, t.score, COUNT(u.id) as members,
            (SELECT MAX(s.submitted_at) FROM submissions s JOIN users u2 ON s.user_id = u2.id WHERE u2.team_id = t.id AND s.is_correct = 1) as last_solve
        FROM teams t LEFT JOIN users u ON u.team_id = t.id
        WHERE t.is_banned = 0 AND t.is_hidden = 0
        GROUP BY t.id ORDER BY t.score DESC
    `).all();
    
    let csv = 'Rank,Team,Score,Members,Last Solve\n';
    entries.forEach((e, i) => {
        csv += `${i + 1},"${e.name}",${e.score},${e.members},"${e.last_solve || 'N/A'}"\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=scoreboard_export.csv');
    res.send(csv);
});

// ============ ADMIN CREDENTIALS ============

// Update admin credentials
router.put('/credentials', (req, res) => {
    const { current_password, new_username, new_password } = req.body;
    const db = getDb();

    const admin = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.user.id);
    
    if (!bcrypt.compareSync(current_password, admin.password)) {
        return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    if (new_username) {
        const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(new_username, admin.id);
        if (existing) return res.status(400).json({ error: 'Username already taken' });
        db.prepare('UPDATE users SET username = ? WHERE id = ?').run(new_username, admin.id);
        req.session.user.username = new_username;
    }
    
    if (new_password) {
        if (new_password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
        const hashed = bcrypt.hashSync(new_password, 12);
        db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashed, admin.id);
    }
    
    res.json({ success: true, message: 'Credentials updated successfully' });
});

// ============ EMAIL ============

// Test email connection
router.post('/email/test', async (req, res) => {
    const { to } = req.body;
    if (!to) return res.status(400).json({ error: 'Recipient email required' });
    
    const config = getEmailConfig();
    if (config.email_enabled !== '1') {
        return res.status(400).json({ error: 'Email is not enabled. Enable it first in settings.' });
    }
    
    const ctfName = getDb().prepare('SELECT value FROM config WHERE key = ?').get('ctf_name')?.value || 'CTF';
    const html = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; padding: 30px; border-radius: 12px; border: 1px solid #222;">
        <h2 style="color: #00ff88; margin-top: 0;">${ctfName} - Test Email</h2>
        <p style="color: #ccc;">This is a test email from your CTF platform.</p>
        <p style="color: #ccc;">If you received this, your email configuration is working correctly! ✅</p>
        <hr style="border: none; border-top: 1px solid #333; margin: 20px 0;">
        <p style="color: #666; font-size: 12px;">SMTP Host: ${config.email_smtp_host} | Port: ${config.email_smtp_port} | User: ${config.email_smtp_user}</p>
    </div>`;
    
    const result = await sendEmail(to, `[${ctfName}] Test Email`, html);
    if (result.success) {
        res.json({ success: true, message: 'Test email sent successfully to ' + to });
    } else {
        res.status(400).json({ error: 'Failed to send: ' + result.error });
    }
});

// Send custom email to selected users
router.post('/email/send', async (req, res) => {
    const { subject, html, recipients } = req.body;
    // recipients: 'all' | 'verified' | array of emails
    
    if (!subject || !html) {
        return res.status(400).json({ error: 'Subject and HTML content are required' });
    }
    
    const config = getEmailConfig();
    if (config.email_enabled !== '1') {
        return res.status(400).json({ error: 'Email is not enabled' });
    }
    
    const db = getDb();
    let users;
    if (recipients === 'all') {
        users = db.prepare('SELECT email FROM users WHERE is_admin = 0 AND is_banned = 0').all();
    } else if (recipients === 'verified') {
        users = db.prepare('SELECT email FROM users WHERE is_admin = 0 AND is_banned = 0 AND is_verified = 1').all();
    } else if (Array.isArray(recipients)) {
        users = recipients.map(e => ({ email: e }));
    } else {
        return res.status(400).json({ error: 'Invalid recipients. Use "all", "verified", or an array of emails.' });
    }
    
    let sent = 0, failed = 0;
    for (const u of users) {
        const result = await sendCustomEmail(u.email, subject, html);
        if (result.success) sent++;
        else failed++;
    }
    
    res.json({ success: true, message: `Sent: ${sent}, Failed: ${failed}, Total: ${users.length}` });
});

// Save email templates
router.put('/email/template', (req, res) => {
    const { type, html } = req.body;
    // type: 'verification' | 'reset' | 'custom'
    if (!type) return res.status(400).json({ error: 'Template type required' });
    
    const db = getDb();
    const key = 'email_template_' + type;
    
    if (html === null || html === '') {
        db.prepare('DELETE FROM config WHERE key = ?').run(key);
        return res.json({ success: true, message: 'Template reset to default' });
    }
    
    db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(key, html);
    res.json({ success: true, message: 'Template saved' });
});

// Get email template
router.get('/email/template/:type', (req, res) => {
    const db = getDb();
    const key = 'email_template_' + req.params.type;
    const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key);
    res.json({ html: row?.value || '' });
});

module.exports = router;
