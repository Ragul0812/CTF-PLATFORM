const express = require('express');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../database/db');
const { isAuthenticated } = require('../middleware/auth');
const router = express.Router();

const teamAvatarStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '..', 'uploads', 'avatars');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `team-${req.params.id}-${Date.now()}${ext}`);
    }
});
const teamAvatarUpload = multer({ 
    storage: teamAvatarStorage, 
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, allowed.includes(ext));
    }
});

// Get all teams
router.get('/', (req, res) => {
    const db = getDb();
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;
    
    const teams = db.prepare(`
        SELECT t.id, t.name, t.score, t.created_at,
               (SELECT COUNT(*) FROM users WHERE team_id = t.id) as member_count
        FROM teams t
        WHERE t.is_hidden = 0
        ORDER BY t.created_at ASC
        LIMIT ? OFFSET ?
    `).all(limit, offset);
    
    const total = db.prepare('SELECT COUNT(*) as count FROM teams WHERE is_hidden = 0').get();
    
    res.json({
        teams,
        pagination: {
            page,
            limit,
            total: total.count,
            pages: Math.ceil(total.count / limit)
        }
    });
});

// Get team by ID
router.get('/:id', (req, res) => {
    const db = getDb();
    const team = db.prepare(`
        SELECT t.id, t.name, t.score, t.created_at, t.captain_id, t.avatar_url,
               (SELECT username FROM users WHERE id = t.captain_id) as captain_name
        FROM teams t
        WHERE t.id = ? AND t.is_hidden = 0
    `).get(req.params.id);
    
    if (!team) {
        return res.status(404).json({ error: 'Team not found' });
    }
    
    // Get team rank
    const teamRank = db.prepare(`
        SELECT COUNT(*) + 1 as rank FROM teams 
        WHERE score > ? AND is_hidden = 0 AND is_banned = 0
    `).get(team.score);
    
    // Get members
    const members = db.prepare(`
        SELECT id, username, score FROM users WHERE team_id = ?
    `).all(req.params.id);
    
    // Get solved challenges
    const solves = db.prepare(`
        SELECT DISTINCT c.id, c.title, c.category, c.points, MIN(s.submitted_at) as submitted_at,
               (SELECT username FROM users WHERE id = s.user_id) as solved_by
        FROM submissions s
        JOIN challenges c ON s.challenge_id = c.id
        WHERE s.team_id = ? AND s.is_correct = 1
        GROUP BY c.id
        ORDER BY submitted_at DESC
    `).all(req.params.id);
    
    // Check if current user is member or captain
    let invite_code = null;
    let is_member = false;
    let is_captain = false;
    
    if (req.session && req.session.user) {
        const userId = req.session.user.id;
        is_member = members.some(m => m.id === userId);
        is_captain = team.captain_id === userId;
        
        // Only show invite code to team members
        if (is_member) {
            const teamData = db.prepare('SELECT invite_code FROM teams WHERE id = ?').get(req.params.id);
            invite_code = teamData.invite_code;
        }
    }
    
    res.json({ 
        team, 
        members, 
        solves, 
        invite_code,
        is_member,
        is_captain,
        rank: teamRank.rank
    });
});

// Create team
router.post('/', isAuthenticated, (req, res) => {
    const { name } = req.body;
    const db = getDb();
    
    if (!name) {
        return res.status(400).json({ error: 'Team name is required' });
    }
    
    // Check if user already in team
    if (req.session.user.team_id) {
        return res.status(400).json({ error: 'You are already in a team' });
    }
    
    const existingTeam = db.prepare('SELECT id FROM teams WHERE name = ?').get(name);
    if (existingTeam) {
        return res.status(400).json({ error: 'Team name already exists' });
    }
    
    const inviteCode = crypto.randomBytes(8).toString('hex');
    
    try {
        const result = db.prepare(`
            INSERT INTO teams (name, captain_id, invite_code)
            VALUES (?, ?, ?)
        `).run(name, req.session.user.id, inviteCode);
        
        // Update user's team
        db.prepare('UPDATE users SET team_id = ? WHERE id = ?').run(result.lastInsertRowid, req.session.user.id);
        req.session.user.team_id = result.lastInsertRowid;
        
        res.json({ 
            success: true, 
            team: { id: result.lastInsertRowid, name, invite_code: inviteCode }
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create team' });
    }
});

// Join team
router.post('/join', isAuthenticated, (req, res) => {
    const { invite_code } = req.body;
    const db = getDb();
    
    if (req.session.user.team_id) {
        return res.status(400).json({ error: 'You are already in a team' });
    }
    
    const team = db.prepare('SELECT * FROM teams WHERE invite_code = ?').get(invite_code);
    if (!team) {
        return res.status(404).json({ error: 'Invalid invite code' });
    }
    
    // Check team size
    const memberCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE team_id = ?').get(team.id);
    const maxMembers = parseInt(db.prepare('SELECT value FROM config WHERE key = ?').get('max_team_members')?.value) || 4;
    if (memberCount.count >= maxMembers) {
        return res.status(400).json({ error: `Team is full (max ${maxMembers} members)` });
    }
    
    db.prepare('UPDATE users SET team_id = ? WHERE id = ?').run(team.id, req.session.user.id);
    
    // Add user's score to team score
    const user = db.prepare('SELECT score FROM users WHERE id = ?').get(req.session.user.id);
    if (user && user.score > 0) {
        db.prepare('UPDATE teams SET score = score + ? WHERE id = ?').run(user.score, team.id);
    }
    
    req.session.user.team_id = team.id;
    
    res.json({ success: true, team: { id: team.id, name: team.name } });
});

// Leave team
router.post('/leave', isAuthenticated, (req, res) => {
    const db = getDb();
    
    if (!req.session.user.team_id) {
        return res.status(400).json({ error: 'You are not in a team' });
    }
    
    try {
        const teamId = req.session.user.team_id;
        const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId);
        
        if (!team) {
            db.prepare('UPDATE users SET team_id = NULL WHERE id = ?').run(req.session.user.id);
            req.session.user.team_id = null;
            return res.json({ success: true });
        }
        
        // Check if user is captain
        if (team.captain_id === req.session.user.id) {
            // Transfer captainship to another member or delete team
            const otherMember = db.prepare('SELECT id FROM users WHERE team_id = ? AND id != ?').get(teamId, req.session.user.id);
            if (otherMember) {
                // Transfer captain to another member
                db.prepare('UPDATE teams SET captain_id = ? WHERE id = ?').run(otherMember.id, teamId);
            } else {
                // No other members - delete team completely
                // First set captain_id to NULL to avoid FK issues
                db.prepare('UPDATE teams SET captain_id = NULL WHERE id = ?').run(teamId);
                // Remove user from team
                db.prepare('UPDATE users SET team_id = NULL WHERE id = ?').run(req.session.user.id);
                req.session.user.team_id = null;
                // Delete team
                db.prepare('DELETE FROM teams WHERE id = ?').run(teamId);
                
                return res.json({ success: true, team_deleted: true });
            }
        }
        
        // Remove user from team
        db.prepare('UPDATE users SET team_id = NULL WHERE id = ?').run(req.session.user.id);
        req.session.user.team_id = null;
        
        res.json({ success: true });
    } catch (err) {
        console.error('[ERROR]', err.message);
        res.status(500).json({ error: 'Failed to leave team' });
    }
});

// Delete team (captain only)
router.delete('/:id', isAuthenticated, (req, res) => {
    const db = getDb();
    const teamId = parseInt(req.params.id);
    
    try {
        const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(teamId);
        
        if (!team) {
            return res.status(404).json({ error: 'Team not found' });
        }
        
        if (team.captain_id !== req.session.user.id && !req.session.user.is_admin) {
            return res.status(403).json({ error: 'Only captain or admin can delete the team' });
        }
        
        // Remove all members from team
        db.prepare('UPDATE users SET team_id = NULL WHERE team_id = ?').run(teamId);
        
        // Clear captain reference
        db.prepare('UPDATE teams SET captain_id = NULL WHERE id = ?').run(teamId);
        
        // Delete team
        db.prepare('DELETE FROM teams WHERE id = ?').run(teamId);
        
        // Update session if user was in this team
        if (req.session.user.team_id === teamId) {
            req.session.user.team_id = null;
        }
        
        res.json({ success: true, message: 'Team deleted successfully' });
    } catch (err) {
        console.error('[ERROR]', err.message);
        res.status(500).json({ error: 'Failed to delete team' });
    }
});

// Transfer captain role
router.post('/:id/transfer-captain', isAuthenticated, (req, res) => {
    const { new_captain_id } = req.body;
    const db = getDb();
    
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
    
    if (!team) {
        return res.status(404).json({ error: 'Team not found' });
    }
    
    if (team.captain_id !== req.session.user.id) {
        return res.status(403).json({ error: 'Only captain can transfer leadership' });
    }
    
    // Verify new captain is team member
    const newCaptain = db.prepare('SELECT id FROM users WHERE id = ? AND team_id = ?').get(new_captain_id, team.id);
    if (!newCaptain) {
        return res.status(400).json({ error: 'User is not a team member' });
    }
    
    db.prepare('UPDATE teams SET captain_id = ? WHERE id = ?').run(new_captain_id, team.id);
    
    res.json({ success: true });
});

// Regenerate invite code (captain only)
router.post('/:id/regenerate-invite', isAuthenticated, (req, res) => {
    const db = getDb();
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
    
    if (!team) {
        return res.status(404).json({ error: 'Team not found' });
    }
    
    if (team.captain_id !== req.session.user.id) {
        return res.status(403).json({ error: 'Only captain can regenerate invite code' });
    }
    
    const newCode = crypto.randomBytes(8).toString('hex');
    db.prepare('UPDATE teams SET invite_code = ? WHERE id = ?').run(newCode, team.id);
    
    res.json({ success: true, invite_code: newCode });
});

// Kick member (captain only)
router.post('/:id/kick', isAuthenticated, (req, res) => {
    const { user_id } = req.body;
    const db = getDb();
    
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
    
    if (!team) {
        return res.status(404).json({ error: 'Team not found' });
    }
    
    if (team.captain_id !== req.session.user.id) {
        return res.status(403).json({ error: 'Only captain can kick members' });
    }
    
    if (user_id === req.session.user.id) {
        return res.status(400).json({ error: 'Cannot kick yourself' });
    }
    
    db.prepare('UPDATE users SET team_id = NULL WHERE id = ? AND team_id = ?').run(user_id, team.id);
    
    res.json({ success: true });
});

// Get invite code (captain only)
router.get('/:id/invite', isAuthenticated, (req, res) => {
    const db = getDb();
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
    
    if (!team) {
        return res.status(404).json({ error: 'Team not found' });
    }
    
    if (team.captain_id !== req.session.user.id) {
        return res.status(403).json({ error: 'Only captain can view invite code' });
    }
    
    res.json({ invite_code: team.invite_code });
});

// Upload team avatar (captain only)
router.post('/:id/avatar', isAuthenticated, teamAvatarUpload.single('avatar'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No valid image file provided' });
    const db = getDb();
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.captain_id !== req.session.user.id) return res.status(403).json({ error: 'Only team captain can change avatar' });
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    db.prepare('UPDATE teams SET avatar_url = ? WHERE id = ?').run(avatarUrl, req.params.id);
    res.json({ success: true, avatar_url: avatarUrl });
});

router.delete('/:id/avatar', isAuthenticated, (req, res) => {
    const db = getDb();
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
    if (!team) return res.status(404).json({ error: 'Team not found' });
    if (team.captain_id !== req.session.user.id) return res.status(403).json({ error: 'Only team captain can remove avatar' });
    db.prepare('UPDATE teams SET avatar_url = NULL WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

module.exports = router;
