const express = require('express');
const { getDb } = require('../database/db');
const { isAuthenticated } = require('../middleware/auth');
const { flagLimiter, checkCTFActive } = require('../middleware/security');
const router = express.Router();

// Check if user is banned (checks DB for real-time ban status)
function checkBanned(req, res, next) {
    if (req.session?.user) {
        const db = getDb();
        const user = db.prepare('SELECT is_banned FROM users WHERE id = ?').get(req.session.user.id);
        if (user && user.is_banned) {
            req.session.user.is_banned = 1;
            return res.status(403).json({ error: 'Your account has been banned. Contact admin.' });
        }
        // Also check if user's team is banned
        if (req.session.user.team_id) {
            const team = db.prepare('SELECT is_banned FROM teams WHERE id = ?').get(req.session.user.team_id);
            if (team && team.is_banned) {
                return res.status(403).json({ error: 'Your team has been banned. Contact admin.' });
            }
        }
    }
    next();
}

// Check if login required for challenges
function checkChallengeAccess(req, res, next) {
    const db = getDb();
    const config = db.prepare('SELECT value FROM config WHERE key = ?').get('require_login_challenges');
    
    if (config && config.value === '1') {
        if (!req.session || !req.session.user) {
            return res.status(401).json({ error: 'Login required to view challenges', require_login: true });
        }
    }
    next();
}

// Check team mode enforcement
function checkTeamMode(req, res, next) {
    const db = getDb();
    const playMode = db.prepare('SELECT value FROM config WHERE key = ?').get('play_mode');
    if (playMode && playMode.value === 'team') {
        if (req.session && req.session.user && !req.session.user.is_admin && !req.session.user.team_id) {
            return res.status(403).json({ error: 'Team mode is active. Join or create a team to access challenges.' });
        }
    }
    next();
}

// Get all challenges
router.get('/', checkBanned, checkChallengeAccess, checkTeamMode, (req, res) => {
    const db = getDb();
    let userId = null;
    let teamId = null;
    
    if (req.session && req.session.user) {
        userId = req.session.user.id;
        teamId = req.session.user.team_id;
    }
    
    let challenges = db.prepare(`
        SELECT id, title, description, category, points, file_url, hint, hint_cost, solves, max_attempts, author, link_url, extra_files, extra_links, wave
        FROM challenges
        WHERE is_hidden = 0
        ORDER BY category, points
    `).all();
    
    // Wave filtering: only apply if waves are configured
    const configuredWaves = db.prepare('SELECT value FROM config WHERE key = ?').get('configured_waves');
    const activeWaves = db.prepare('SELECT value FROM config WHERE key = ?').get('active_waves');
    let hasWaveSystem = false;
    try { hasWaveSystem = configuredWaves && JSON.parse(configuredWaves.value).length > 0; } catch(e) {}
    
    if (hasWaveSystem) {
        let waveList = [];
        try { waveList = JSON.parse(activeWaves?.value || '[]'); } catch(e) {}
        // Only show challenges whose wave number is in the active list
        // Wave 0 challenges are only visible if 0 is in active list
        challenges = challenges.filter(c => waveList.includes(c.wave));
    }
    
    // Get average ratings for all challenges
    const ratings = db.prepare('SELECT challenge_id, AVG(rating) as avg_rating, COUNT(*) as rating_count FROM challenge_ratings GROUP BY challenge_id').all();
    const ratingsMap = {};
    ratings.forEach(r => { ratingsMap[r.challenge_id] = { avg: r.avg_rating, count: r.rating_count }; });
    
    // Get user's solved challenges and attempts
    let solvedIds = [];
    let attempts = {};
    if (userId) {
        const solved = db.prepare(`
            SELECT DISTINCT challenge_id FROM submissions 
            WHERE (user_id = ? OR team_id = ?) AND is_correct = 1
        `).all(userId, teamId);
        solvedIds = solved.map(s => s.challenge_id);
        
        // Get attempt counts
        const attemptData = db.prepare(`
            SELECT challenge_id, attempts FROM challenge_attempts WHERE user_id = ?
        `).all(userId);
        attemptData.forEach(a => attempts[a.challenge_id] = a.attempts);
    }
    
    // Group by category
    const categorized = {};
    challenges.forEach(c => {
        if (!categorized[c.category]) {
            categorized[c.category] = [];
        }
        const userAttempts = attempts[c.id] || 0;
        categorized[c.category].push({
            ...c,
            solved: solvedIds.includes(c.id),
            user_attempts: userAttempts,
            attempts_remaining: c.max_attempts ? Math.max(0, c.max_attempts - userAttempts) : null,
            avg_rating: ratingsMap[c.id]?.avg || 0,
            rating_count: ratingsMap[c.id]?.count || 0
        });
    });
    
    res.json({ challenges: categorized });
});

// Get challenge by ID
router.get('/:id', checkBanned, checkChallengeAccess, checkTeamMode, (req, res) => {
    const db = getDb();
    const challenge = db.prepare(`
        SELECT id, title, description, category, points, file_url, hint, hint_cost, solves, max_attempts, author, show_flag, link_url, extra_files, extra_links
        FROM challenges
        WHERE id = ? AND is_hidden = 0
    `).get(req.params.id);
    
    if (!challenge) {
        return res.status(404).json({ error: 'Challenge not found' });
    }
    
    // Get solvers (top 10, excluding admins and banned users)
    const solvers = db.prepare(`
        SELECT u.id, u.username, s.submitted_at
        FROM submissions s
        JOIN users u ON s.user_id = u.id
        WHERE s.challenge_id = ? AND s.is_correct = 1 AND u.is_admin = 0 AND u.is_banned = 0
        ORDER BY s.submitted_at ASC
        LIMIT 10
    `).all(req.params.id);
    
    // Get all solvers (excluding admins and banned users)
    const allSolvers = db.prepare(`
        SELECT u.id, u.username, s.submitted_at
        FROM submissions s
        JOIN users u ON s.user_id = u.id
        WHERE s.challenge_id = ? AND s.is_correct = 1 AND u.is_admin = 0 AND u.is_banned = 0
        ORDER BY s.submitted_at ASC
    `).all(req.params.id);
    
    // Get average rating
    const ratingData = db.prepare('SELECT AVG(rating) as avg_rating, COUNT(*) as rating_count FROM challenge_ratings WHERE challenge_id = ?').get(req.params.id);
    
    // Get user's attempts and solve time
    let userAttempts = 0;
    let userSolveTime = null;
    let userRating = null;
    if (req.session?.user) {
        const attempt = db.prepare('SELECT attempts FROM challenge_attempts WHERE user_id = ? AND challenge_id = ?')
            .get(req.session.user.id, req.params.id);
        userAttempts = attempt?.attempts || 0;
        
        // Check if user solved this challenge and when
        const userSolve = db.prepare(`
            SELECT submitted_at FROM submissions 
            WHERE challenge_id = ? AND user_id = ? AND is_correct = 1
            ORDER BY submitted_at ASC LIMIT 1
        `).get(req.params.id, req.session.user.id);
        userSolveTime = userSolve?.submitted_at || null;
        
        // Get user's rating
        const userRatingRow = db.prepare('SELECT rating FROM challenge_ratings WHERE user_id = ? AND challenge_id = ?').get(req.session.user.id, req.params.id);
        userRating = userRatingRow?.rating || null;
    }
    
    // Get actual flag for show_flag feature
    const flagRow = db.prepare('SELECT flag FROM challenges WHERE id = ?').get(req.params.id);
    
    res.json({ 
        challenge: {
            ...challenge,
            user_attempts: userAttempts,
            attempts_remaining: challenge.max_attempts ? Math.max(0, challenge.max_attempts - userAttempts) : null,
            user_solved: !!userSolveTime,
            user_solve_time: userSolveTime,
            show_flag: !!challenge.show_flag,
            visible_flag: (challenge.show_flag && userSolveTime) ? flagRow.flag : null,
            avg_rating: ratingData?.avg_rating || 0,
            rating_count: ratingData?.rating_count || 0,
            user_rating: userRating
        }, 
        solvers,
        all_solvers: allSolvers
    });
});

// Submit flag
router.post('/:id/submit', checkBanned, isAuthenticated, flagLimiter, checkCTFActive, (req, res) => {
    const { flag } = req.body;
    const challengeId = parseInt(req.params.id);
    const db = getDb();
    
    if (!flag) {
        return res.status(400).json({ error: 'Flag is required' });
    }
    
    const challenge = db.prepare('SELECT * FROM challenges WHERE id = ? AND is_hidden = 0').get(challengeId);
    if (!challenge) {
        return res.status(404).json({ error: 'Challenge not found' });
    }
    
    const userId = req.session.user.id;
    const teamId = req.session.user.team_id;
    
    // Check if already solved
    const alreadySolved = db.prepare(`
        SELECT id FROM submissions 
        WHERE challenge_id = ? AND (user_id = ? OR team_id = ?) AND is_correct = 1
    `).get(challengeId, userId, teamId);
    
    if (alreadySolved) {
        return res.status(400).json({ error: 'Challenge already solved' });
    }
    
    // Check attempt limit
    if (challenge.max_attempts) {
        const attempts = db.prepare('SELECT attempts FROM challenge_attempts WHERE user_id = ? AND challenge_id = ?')
            .get(userId, challengeId);
        
        if (attempts && attempts.attempts >= challenge.max_attempts) {
            return res.status(429).json({ 
                error: 'Maximum attempts reached for this challenge',
                attempts_remaining: 0
            });
        }
        
        // Increment attempt counter
        db.prepare(`
            INSERT INTO challenge_attempts (user_id, challenge_id, attempts)
            VALUES (?, ?, 1)
            ON CONFLICT(user_id, challenge_id) DO UPDATE SET 
            attempts = attempts + 1, last_attempt = CURRENT_TIMESTAMP
        `).run(userId, challengeId);
    }
    
    // Check if score is frozen
    const freezeConfig = db.prepare('SELECT value FROM config WHERE key = ?').get('score_freeze_time');
    const isFrozen = freezeConfig?.value && new Date() > new Date(freezeConfig.value);
    
    const isCorrect = flag.trim() === challenge.flag;
    
    // Record submission
    db.prepare(`
        INSERT INTO submissions (user_id, team_id, challenge_id, flag_submitted, is_correct)
        VALUES (?, ?, ?, ?, ?)
    `).run(userId, teamId, challengeId, flag, isCorrect ? 1 : 0);
    
    if (isCorrect) {
        const isAdmin = req.session.user.is_admin;
        
        if (!isAdmin) {
            // Update scores (even if frozen - just don't show on scoreboard)
            db.prepare('UPDATE users SET score = score + ? WHERE id = ?').run(challenge.points, userId);
            
            if (teamId) {
                db.prepare('UPDATE teams SET score = score + ? WHERE id = ?').run(challenge.points, teamId);
            }
            
            // Update solve count
            db.prepare('UPDATE challenges SET solves = solves + 1 WHERE id = ?').run(challengeId);
            
            // Update session
            req.session.user.score = (req.session.user.score || 0) + challenge.points;
        }
        
        return res.json({ 
            success: true, 
            correct: true, 
            points: challenge.points,
            score_frozen: isFrozen,
            message: isFrozen ? 'Correct! Score recorded but scoreboard is frozen.' : 'Correct!'
        });
    }
    
    // Return remaining attempts
    let attemptsRemaining = null;
    if (challenge.max_attempts) {
        const attempts = db.prepare('SELECT attempts FROM challenge_attempts WHERE user_id = ? AND challenge_id = ?')
            .get(userId, challengeId);
        attemptsRemaining = Math.max(0, challenge.max_attempts - (attempts?.attempts || 0));
    }
    
    res.json({ 
        success: true, 
        correct: false,
        attempts_remaining: attemptsRemaining
    });
});

// Unlock hint (costs points)
router.post('/:id/hint', checkBanned, isAuthenticated, (req, res) => {
    const challengeId = parseInt(req.params.id);
    const db = getDb();
    
    const challenge = db.prepare('SELECT hint, hint_cost FROM challenges WHERE id = ?').get(challengeId);
    if (!challenge || !challenge.hint) {
        return res.status(404).json({ error: 'No hint available' });
    }
    
    const cost = challenge.hint_cost || 0;
    const userId = req.session.user.id;
    
    // Check if already unlocked
    const unlocked = db.prepare('SELECT id FROM hint_unlocks WHERE user_id = ? AND challenge_id = ?')
        .get(userId, challengeId);
    
    if (unlocked) {
        return res.json({ hint: challenge.hint, already_unlocked: true });
    }
    
    // Check if user has enough points
    const user = db.prepare('SELECT score FROM users WHERE id = ?').get(userId);
    if (cost > 0 && user.score < cost) {
        return res.status(400).json({ error: `Not enough points. Need ${cost} points.` });
    }
    
    // Deduct points and unlock hint
    if (cost > 0) {
        db.prepare('UPDATE users SET score = score - ? WHERE id = ?').run(cost, userId);
    }
    
    db.prepare('INSERT INTO hint_unlocks (user_id, challenge_id) VALUES (?, ?)').run(userId, challengeId);
    
    req.session.user.score = user.score - cost;
    
    res.json({ hint: challenge.hint, cost_deducted: cost });
});

// Rate a challenge
router.post('/:id/rate', checkBanned, isAuthenticated, (req, res) => {
    const { rating } = req.body;
    const challengeId = parseInt(req.params.id);
    const db = getDb();
    
    if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    
    // Check if user solved this challenge
    const solved = db.prepare('SELECT id FROM submissions WHERE user_id = ? AND challenge_id = ? AND is_correct = 1').get(req.session.user.id, challengeId);
    if (!solved) {
        return res.status(403).json({ error: 'You must solve the challenge before rating' });
    }
    
    db.prepare(`
        INSERT INTO challenge_ratings (user_id, challenge_id, rating)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id, challenge_id) DO UPDATE SET rating = ?
    `).run(req.session.user.id, challengeId, rating, rating);
    
    const avg = db.prepare('SELECT AVG(rating) as avg_rating, COUNT(*) as count FROM challenge_ratings WHERE challenge_id = ?').get(challengeId);
    
    res.json({ success: true, avg_rating: avg.avg_rating, count: avg.count });
});

module.exports = router;
