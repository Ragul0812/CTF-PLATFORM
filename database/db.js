const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'ctf.db');
let db;

function getDb() {
    if (!db) {
        db = new Database(dbPath);
        db.pragma('journal_mode = WAL');
    }
    return db;
}

function initialize() {
    const database = getDb();
    
    // Users table
    database.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            team_id INTEGER,
            score INTEGER DEFAULT 0,
            is_admin INTEGER DEFAULT 0,
            is_hidden INTEGER DEFAULT 0,
            is_banned INTEGER DEFAULT 0,
            is_verified INTEGER DEFAULT 0,
            verification_token TEXT,
            reset_token TEXT,
            reset_token_expires DATETIME,
            play_mode TEXT DEFAULT 'individual',
            bio TEXT DEFAULT '',
            country TEXT DEFAULT '',
            website TEXT DEFAULT '',
            github TEXT DEFAULT '',
            twitter TEXT DEFAULT '',
            last_submission DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (team_id) REFERENCES teams(id)
        )
    `);
    
    // Teams table
    database.exec(`
        CREATE TABLE IF NOT EXISTS teams (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            captain_id INTEGER,
            invite_code TEXT UNIQUE,
            score INTEGER DEFAULT 0,
            is_hidden INTEGER DEFAULT 0,
            is_banned INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Challenges table
    database.exec(`
        CREATE TABLE IF NOT EXISTS challenges (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            category TEXT NOT NULL,
            points INTEGER NOT NULL,
            flag TEXT NOT NULL,
            file_url TEXT,
            hint TEXT,
            hint_cost INTEGER DEFAULT 0,
            max_attempts INTEGER DEFAULT 0,
            is_hidden INTEGER DEFAULT 0,
            solves INTEGER DEFAULT 0,
            author TEXT DEFAULT '',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Submissions table
    database.exec(`
        CREATE TABLE IF NOT EXISTS submissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            team_id INTEGER,
            challenge_id INTEGER NOT NULL,
            flag_submitted TEXT NOT NULL,
            is_correct INTEGER NOT NULL,
            ip_address TEXT,
            submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (team_id) REFERENCES teams(id),
            FOREIGN KEY (challenge_id) REFERENCES challenges(id)
        )
    `);
    
    // Challenge attempts tracking (for rate limiting)
    database.exec(`
        CREATE TABLE IF NOT EXISTS challenge_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            challenge_id INTEGER NOT NULL,
            attempts INTEGER DEFAULT 0,
            last_attempt DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, challenge_id)
        )
    `);
    
    // Hint unlocks tracking
    database.exec(`
        CREATE TABLE IF NOT EXISTS hint_unlocks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            challenge_id INTEGER NOT NULL,
            unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, challenge_id)
        )
    `);
    
    // Config table
    database.exec(`
        CREATE TABLE IF NOT EXISTS config (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    `);
    
    // Notifications/Announcements table
    database.exec(`
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            type TEXT DEFAULT 'info',
            is_global INTEGER DEFAULT 1,
            user_id INTEGER,
            is_read INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Custom pages/code table
    database.exec(`
        CREATE TABLE IF NOT EXISTS custom_code (
            key TEXT PRIMARY KEY,
            value TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Pages table (for custom pages)
    database.exec(`
        CREATE TABLE IF NOT EXISTS pages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            is_published INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Audit log
    database.exec(`
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            action TEXT NOT NULL,
            details TEXT,
            ip_address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Challenge ratings table
    database.exec(`
        CREATE TABLE IF NOT EXISTS challenge_ratings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            challenge_id INTEGER NOT NULL,
            rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, challenge_id)
        )
    `);
    
    // Migration: add show_flag column to challenges
    try {
        database.exec('ALTER TABLE challenges ADD COLUMN show_flag INTEGER DEFAULT 0');
    } catch (e) {
        // Column already exists
    }
    
    // Migration: add link_url column to challenges
    try { database.exec('ALTER TABLE challenges ADD COLUMN link_url TEXT'); } catch(e) {}
    
    // Migration: add extra_files and extra_links JSON columns to challenges
    try { database.exec('ALTER TABLE challenges ADD COLUMN extra_files TEXT DEFAULT "[]"'); } catch(e) {}
    try { database.exec('ALTER TABLE challenges ADD COLUMN extra_links TEXT DEFAULT "[]"'); } catch(e) {}
    
    // Migration: add wave column to challenges
    try { database.exec('ALTER TABLE challenges ADD COLUMN wave INTEGER DEFAULT 0'); } catch(e) {}
    
    // Migration: add avatar_url column to users
    try { database.exec('ALTER TABLE users ADD COLUMN avatar_url TEXT'); } catch(e) {}
    
    // Migration: add avatar_url column to teams
    try { database.exec('ALTER TABLE teams ADD COLUMN avatar_url TEXT'); } catch(e) {}
    
    // Create default admin if no admin exists
    const adminExists = database.prepare('SELECT id FROM users WHERE is_admin = 1').get();
    if (!adminExists) {
        const hashedPassword = bcrypt.hashSync('admin123', 12);
        database.prepare(`
            INSERT INTO users (username, email, password, is_admin, is_verified)
            VALUES (?, ?, ?, 1, 1)
        `).run('admin', 'admin@ctf.local', hashedPassword);
        console.log('Default admin created: admin / admin123');
    }
    
    // Insert default config
    const configExists = database.prepare('SELECT value FROM config WHERE key = ?').get('ctf_name');
    if (!configExists) {
        const defaultConfigs = {
            // Basic
            'ctf_name': 'CTF Platform',
            'ctf_description': 'Welcome to our Capture The Flag competition. Test your hacking skills and compete with others!',
            'ctf_start': '',
            'ctf_end': '',
            'registration_open': '1',
            'require_login_challenges': '1',
            'require_email_verification': '0',
            'hide_scores_public': '0',
            
            // Scoring
            'score_visibility': 'public',
            'score_freeze_time': '',
            'tie_breaker': 'time',
            
            // Theme
            'theme_preset': 'midnight',
            'theme_bg_primary': '#0d1117',
            'theme_bg_secondary': '#161b22',
            'theme_bg_card': '#21262d',
            'theme_accent': '#58a6ff',
            'theme_text_primary': '#f0f6fc',
            'theme_text_secondary': '#8b949e',
            'theme_danger': '#f85149',
            
            // Branding
            'logo_text': 'CTF',
            'hero_title': 'Capture The Flag',
            'hero_subtitle': 'Test your skills. Solve challenges. Climb the leaderboard.',
            'discord_url': '',
            'website_url': '',
            'footer_text': '',
            
            // Challenges
            'categories': 'Web,Crypto,Forensics,Pwn,Reversing,Misc,OSINT',
            'flag_format': 'flag{...}',
            'default_max_attempts': '0',
            
            // Storage
            'storage_type': 'local',
            'storage_s3_endpoint': '',
            'storage_s3_bucket': '',
            'storage_s3_access_key': '',
            'storage_s3_secret_key': '',
            'storage_s3_region': 'us-east-1',
            
            // Email
            'email_enabled': '0',
            'email_provider': 'smtp',
            'email_from': 'noreply@ctf.local',
            'email_smtp_host': '',
            'email_smtp_port': '587',
            'email_smtp_secure': '0',
            'email_smtp_user': '',
            'email_smtp_password': '',
            'email_mailgun_user': '',
            'email_mailgun_password': '',
            'email_base_url': 'http://localhost:3000',
            
            // Security
            'rate_limit_enabled': '1',
            'max_flag_attempts_per_minute': '5',
            'max_login_attempts': '10',
            
            // Play mode
            'play_mode': 'both',
            'max_team_members': '4'
        };
        
        const stmt = database.prepare('INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)');
        for (const [key, value] of Object.entries(defaultConfigs)) {
            stmt.run(key, value);
        }
    }
    
    // Insert default custom code
    const customCodeExists = database.prepare('SELECT value FROM custom_code WHERE key = ?').get('custom_css');
    if (!customCodeExists) {
        database.prepare('INSERT OR IGNORE INTO custom_code (key, value) VALUES (?, ?)').run('custom_css', '/* Custom CSS */\n');
        database.prepare('INSERT OR IGNORE INTO custom_code (key, value) VALUES (?, ?)').run('custom_js', '// Custom JavaScript\n');
        database.prepare('INSERT OR IGNORE INTO custom_code (key, value) VALUES (?, ?)').run('custom_head', '');
        database.prepare('INSERT OR IGNORE INTO custom_code (key, value) VALUES (?, ?)').run('custom_footer', '');
        database.prepare('INSERT OR IGNORE INTO custom_code (key, value) VALUES (?, ?)').run('home_page_html', '');
        database.prepare('INSERT OR IGNORE INTO custom_code (key, value) VALUES (?, ?)').run('challenges_page_html', '');
    }
    
    // Insert sample challenges if none exist
    const challengeCount = database.prepare('SELECT COUNT(*) as count FROM challenges').get();
    if (challengeCount.count === 0) {
        const sampleChallenges = [
            { title: 'Welcome', description: 'Welcome to the CTF! Here\'s your first flag: `flag{welcome_to_ctf}`', category: 'Misc', points: 50, flag: 'flag{welcome_to_ctf}' },
            { title: 'Base64', description: 'Decode this string:\n\n```\nZmxhZ3tiYXNlNjRfZGVjb2Rpbmd9\n```', category: 'Crypto', points: 100, flag: 'flag{base64_decoding}' },
            { title: 'Inspector', description: 'Sometimes secrets are hidden in plain sight. Have you tried inspecting this page?', category: 'Web', points: 100, flag: 'flag{inspect_element}' },
        ];
        
        const insertChallenge = database.prepare(`
            INSERT INTO challenges (title, description, category, points, flag)
            VALUES (?, ?, ?, ?, ?)
        `);
        
        sampleChallenges.forEach(c => {
            insertChallenge.run(c.title, c.description, c.category, c.points, c.flag);
        });
        console.log('Sample challenges created');
    }
    
    console.log('Database initialized');
}

// Export/Import functions
function exportData() {
    const database = getDb();
    
    return {
        users: database.prepare('SELECT id, username, email, score, team_id, is_hidden, play_mode, bio, country, created_at FROM users WHERE is_admin = 0').all(),
        teams: database.prepare('SELECT * FROM teams').all(),
        challenges: database.prepare('SELECT * FROM challenges').all(),
        submissions: database.prepare('SELECT * FROM submissions WHERE is_correct = 1').all(),
        config: database.prepare('SELECT * FROM config').all(),
        notifications: database.prepare('SELECT * FROM notifications').all(),
        exported_at: new Date().toISOString()
    };
}

function importData(data, options = {}) {
    const database = getDb();
    
    if (options.clearExisting) {
        database.exec('DELETE FROM submissions');
        database.exec('DELETE FROM challenges');
        database.exec('DELETE FROM users WHERE is_admin = 0');
        database.exec('DELETE FROM teams');
    }
    
    // Import challenges
    if (data.challenges) {
        const stmt = database.prepare(`
            INSERT OR IGNORE INTO challenges (title, description, category, points, flag, file_url, hint, is_hidden, solves)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        data.challenges.forEach(c => {
            stmt.run(c.title, c.description, c.category, c.points, c.flag, c.file_url, c.hint, c.is_hidden || 0, c.solves || 0);
        });
    }
    
    // Import config
    if (data.config) {
        const stmt = database.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
        data.config.forEach(c => {
            stmt.run(c.key, c.value);
        });
    }
    
    return { success: true };
}

module.exports = { getDb, initialize, exportData, importData };
