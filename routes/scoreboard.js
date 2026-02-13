const express = require('express');
const { getDb } = require('../database/db');
const router = express.Router();

// Check if scores are hidden (public setting - requires login)
function checkScoreVisibility(req, res, next) {
    const db = getDb();
    const hideScores = db.prepare('SELECT value FROM config WHERE key = ?').get('hide_scores_public');
    
    if (hideScores?.value === '1' && !req.session?.user) {
        return res.status(403).json({ error: 'Scoreboard is hidden. Please login to view.', hidden: true });
    }
    
    next();
}

// Check if scoreboard is enabled by admin (can be turned off for everyone except admin)
function checkScoreboardEnabled(req, res, next) {
    const db = getDb();
    const scoreboardVisible = db.prepare('SELECT value FROM config WHERE key = ?').get('scoreboard_visible');
    
    // If scoreboard_visible is set to '0', block non-admin users
    if (scoreboardVisible?.value === '0') {
        // Allow admin to still see it
        if (req.session?.user?.is_admin) {
            return next();
        }
        return res.status(403).json({ error: 'Scoreboard is currently hidden by admin.', admin_hidden: true });
    }
    
    next();
}

// Get frozen score time
function getScoreFreezeData(db) {
    const freezeConfig = db.prepare('SELECT value FROM config WHERE key = ?').get('score_freeze_time');
    const isFrozen = freezeConfig?.value && new Date() > new Date(freezeConfig.value);
    return { isFrozen, freezeTime: freezeConfig?.value || null };
}

// Get scoreboard
router.get('/', checkScoreboardEnabled, checkScoreVisibility, (req, res) => {
    const db = getDb();
    const type = req.query.type || 'teams';
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const offset = (page - 1) * limit;
    
    const { isFrozen, freezeTime } = getScoreFreezeData(db);
    
    // If scores are frozen, show scores as of freeze time
    const scoreClause = isFrozen 
        ? `(SELECT COALESCE(SUM(c.points), 0) FROM submissions s 
            JOIN challenges c ON s.challenge_id = c.id 
            WHERE s.user_id = u.id AND s.is_correct = 1 AND s.submitted_at < ?)` 
        : 'u.score';
    
    const teamScoreClause = isFrozen
        ? `(SELECT COALESCE(SUM(c.points), 0) FROM submissions s 
            JOIN challenges c ON s.challenge_id = c.id 
            WHERE s.team_id = t.id AND s.is_correct = 1 AND s.submitted_at < ?)`
        : 't.score';
    
    if (type === 'users') {
        const query = isFrozen 
            ? `SELECT u.id, u.username, 
                      ${scoreClause} as score, 
                      t.name as team_name,
                      (SELECT MAX(submitted_at) FROM submissions WHERE user_id = u.id AND is_correct = 1 AND submitted_at < ?) as last_solve
               FROM users u
               LEFT JOIN teams t ON u.team_id = t.id
               WHERE u.is_hidden = 0 AND u.is_admin = 0 AND u.is_banned = 0
               ORDER BY score DESC, last_solve ASC NULLS LAST
               LIMIT ? OFFSET ?`
            : `SELECT u.id, u.username, u.score, t.name as team_name,
                      (SELECT MAX(submitted_at) FROM submissions WHERE user_id = u.id AND is_correct = 1) as last_solve
               FROM users u
               LEFT JOIN teams t ON u.team_id = t.id
               WHERE u.is_hidden = 0 AND u.is_admin = 0 AND u.is_banned = 0
               ORDER BY u.score DESC, last_solve ASC NULLS LAST
               LIMIT ? OFFSET ?`;
        
        const users = isFrozen 
            ? db.prepare(query).all(freezeTime, freezeTime, limit, offset)
            : db.prepare(query).all(limit, offset);
        
        const total = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_hidden = 0 AND is_admin = 0 AND is_banned = 0').get();
        
        return res.json({
            type: 'users',
            entries: users.map((u, i) => ({ ...u, rank: offset + i + 1 })),
            pagination: {
                page,
                limit,
                total: total.count,
                pages: Math.ceil(total.count / limit)
            },
            frozen: isFrozen,
            freeze_time: freezeTime
        });
    }
    
    // Teams scoreboard with tie resolution (earlier last_solve wins)
    // Use computed score that excludes banned members' contributions
    const teamQuery = isFrozen
        ? `SELECT t.id, t.name, 
                  (SELECT COALESCE(SUM(c.points), 0) FROM submissions s 
                   JOIN challenges c ON s.challenge_id = c.id 
                   JOIN users u ON s.user_id = u.id
                   WHERE s.team_id = t.id AND s.is_correct = 1 AND u.is_banned = 0 AND s.submitted_at < ?) as score,
                  (SELECT COUNT(*) FROM users WHERE team_id = t.id) as member_count,
                  (SELECT MAX(submitted_at) FROM submissions WHERE team_id = t.id AND is_correct = 1 AND submitted_at < ?) as last_solve
           FROM teams t
           WHERE t.is_hidden = 0 AND t.is_banned = 0
           ORDER BY score DESC, last_solve ASC NULLS LAST
           LIMIT ? OFFSET ?`
        : `SELECT t.id, t.name,
                  (SELECT COALESCE(SUM(c.points), 0) FROM submissions s 
                   JOIN challenges c ON s.challenge_id = c.id 
                   JOIN users u ON s.user_id = u.id
                   WHERE s.team_id = t.id AND s.is_correct = 1 AND u.is_banned = 0) as score,
                  (SELECT COUNT(*) FROM users WHERE team_id = t.id) as member_count,
                  (SELECT MAX(submitted_at) FROM submissions WHERE team_id = t.id AND is_correct = 1) as last_solve
           FROM teams t
           WHERE t.is_hidden = 0 AND t.is_banned = 0
           ORDER BY score DESC, last_solve ASC NULLS LAST
           LIMIT ? OFFSET ?`;
    
    const teams = isFrozen
        ? db.prepare(teamQuery).all(freezeTime, freezeTime, limit, offset)
        : db.prepare(teamQuery).all(limit, offset);
    
    const total = db.prepare('SELECT COUNT(*) as count FROM teams WHERE is_hidden = 0 AND is_banned = 0').get();
    
    res.json({
        type: 'teams',
        entries: teams.map((t, i) => ({ ...t, rank: offset + i + 1 })),
        pagination: {
            page,
            limit,
            total: total.count,
            pages: Math.ceil(total.count / limit)
        },
        frozen: isFrozen,
        freeze_time: freezeTime
    });
});

// Get top 10 for graph
router.get('/top', checkScoreboardEnabled, checkScoreVisibility, (req, res) => {
    const db = getDb();
    const type = req.query.type || 'teams';
    
    const { isFrozen, freezeTime } = getScoreFreezeData(db);
    
    if (type === 'users') {
        const users = db.prepare(`
            SELECT u.id, u.username, u.score
            FROM users u
            WHERE u.is_hidden = 0 AND u.is_admin = 0 AND u.is_banned = 0 AND u.score > 0
            ORDER BY u.score DESC, u.id ASC
            LIMIT 10
        `).all();
        
        return res.json({ entries: users, frozen: isFrozen });
    }
    
    const teams = db.prepare(`
        SELECT t.id, t.name,
               (SELECT COALESCE(SUM(c.points), 0) FROM submissions s 
                JOIN challenges c ON s.challenge_id = c.id 
                JOIN users u ON s.user_id = u.id
                WHERE s.team_id = t.id AND s.is_correct = 1 AND u.is_banned = 0) as score
        FROM teams t
        WHERE t.is_hidden = 0 AND t.is_banned = 0
        ORDER BY score DESC, t.id ASC
        LIMIT 10
    `).all().filter(t => t.score > 0);
    
    res.json({ entries: teams, frozen: isFrozen });
});

// Score graph data for top teams
router.get('/graph', checkScoreboardEnabled, checkScoreVisibility, (req, res) => {
    const db = getDb();
    
    const { isFrozen, freezeTime } = getScoreFreezeData(db);
    
    // Get top 10 teams (computed score excluding banned members)
    const topTeams = db.prepare(`
        SELECT t.id, t.name,
               (SELECT COALESCE(SUM(c.points), 0) FROM submissions s 
                JOIN challenges c ON s.challenge_id = c.id 
                JOIN users u ON s.user_id = u.id
                WHERE s.team_id = t.id AND s.is_correct = 1 AND u.is_banned = 0) as score
        FROM teams t
        WHERE t.is_hidden = 0 AND t.is_banned = 0
        ORDER BY score DESC, t.id ASC
        LIMIT 10
    `).all();
    
    // Get solve timeline for each team
    const graphData = topTeams.map(team => {
        const whereClause = isFrozen 
            ? 'WHERE s.team_id = ? AND s.is_correct = 1 AND u.is_banned = 0 AND s.submitted_at < ?'
            : 'WHERE s.team_id = ? AND s.is_correct = 1 AND u.is_banned = 0';
        
        const solves = isFrozen
            ? db.prepare(`
                SELECT s.submitted_at, c.points
                FROM submissions s
                JOIN challenges c ON s.challenge_id = c.id
                JOIN users u ON s.user_id = u.id
                ${whereClause}
                ORDER BY s.submitted_at ASC
              `).all(team.id, freezeTime)
            : db.prepare(`
                SELECT s.submitted_at, c.points
                FROM submissions s
                JOIN challenges c ON s.challenge_id = c.id
                JOIN users u ON s.user_id = u.id
                ${whereClause}
                ORDER BY s.submitted_at ASC
              `).all(team.id);
        
        let runningScore = 0;
        const timeline = [{ time: null, score: 0 }]; // Start at 0
        
        solves.forEach(s => {
            runningScore += s.points;
            timeline.push({ time: s.submitted_at, score: runningScore });
        });
        
        return { 
            id: team.id,
            name: team.name, 
            currentScore: team.score,
            timeline 
        };
    });
    
    res.json({ graphData, frozen: isFrozen, freeze_time: freezeTime });
});

module.exports = router;
