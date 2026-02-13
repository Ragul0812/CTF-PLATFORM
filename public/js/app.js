// Global state
let currentUser = null;
let currentPage = 'home';
let siteConfig = {};
let customCode = {};
let notifications = [];

// API Helper
async function api(endpoint, options = {}) {
    const res = await fetch(`/api${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        body: options.body ? JSON.stringify(options.body) : undefined
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
}

// Load and apply site configuration
async function loadSiteConfig() {
    try {
        siteConfig = await api('/config');
        customCode = await api('/custom-code');
        applyTheme();
        applyBranding();
        applyCustomCode();
    } catch (err) {
        console.error('Failed to load config:', err);
    }
}

// Apply custom code (CSS/JS)
function applyCustomCode() {
    // Remove old custom styles
    const oldStyle = document.getElementById('custom-css');
    if (oldStyle) oldStyle.remove();
    
    // Apply custom CSS
    if (customCode.custom_css) {
        const style = document.createElement('style');
        style.id = 'custom-css';
        style.textContent = customCode.custom_css;
        document.head.appendChild(style);
    }
    
    // Apply custom head content
    if (customCode.custom_head) {
        const headContent = document.getElementById('custom-head');
        if (headContent) headContent.remove();
        const div = document.createElement('div');
        div.id = 'custom-head';
        div.innerHTML = customCode.custom_head;
        document.head.appendChild(div);
    }
}

// Load notifications
async function loadNotifications() {
    try {
        const data = currentUser 
            ? await api('/notifications/user')
            : await api('/notifications');
        notifications = data.notifications || [];
        updateNotificationBadge();
    } catch (err) {
        console.error('Failed to load notifications:', err);
    }
}

function updateNotificationBadge() {
    const badge = document.getElementById('notif-badge');
    if (badge) {
        badge.textContent = notifications.length;
        badge.style.display = notifications.length > 0 ? 'flex' : 'none';
    }
}

// Apply theme colors
function applyTheme() {
    const root = document.documentElement;
    if (siteConfig.theme_bg_primary) root.style.setProperty('--bg-primary', siteConfig.theme_bg_primary);
    if (siteConfig.theme_bg_secondary) root.style.setProperty('--bg-secondary', siteConfig.theme_bg_secondary);
    if (siteConfig.theme_bg_card) root.style.setProperty('--bg-card', siteConfig.theme_bg_card);
    if (siteConfig.theme_accent) {
        root.style.setProperty('--accent', siteConfig.theme_accent);
        root.style.setProperty('--accent-dim', adjustColor(siteConfig.theme_accent, -20));
        root.style.setProperty('--accent-glow', siteConfig.theme_accent + '4D');
    }
    if (siteConfig.theme_text_primary) root.style.setProperty('--text-primary', siteConfig.theme_text_primary);
    if (siteConfig.theme_text_secondary) root.style.setProperty('--text-secondary', siteConfig.theme_text_secondary);
    if (siteConfig.theme_danger) root.style.setProperty('--danger', siteConfig.theme_danger);

    // Glassmorphism theme — inject/remove special CSS
    let glassStyle = document.getElementById('glassmorphism-style');
    if (siteConfig.theme_preset === 'glassmorphism') {
        if (!glassStyle) {
            glassStyle = document.createElement('style');
            glassStyle.id = 'glassmorphism-style';
            document.head.appendChild(glassStyle);
        }
        const ga = siteConfig.theme_accent || '#60a5fa';
        const gbg = siteConfig.theme_bg_primary || '#0f172a';
        // Parse accent to RGB for rgba usage
        const gar = parseInt(ga.slice(1,3),16), gag = parseInt(ga.slice(3,5),16), gab = parseInt(ga.slice(5,7),16);
        // Parse bg to RGB
        const bgr = parseInt(gbg.slice(1,3),16)||15, bgg = parseInt(gbg.slice(3,5),16)||23, bgb = parseInt(gbg.slice(5,7),16)||42;
        // Slightly lighter bg for card glass
        const cbgr = Math.min(bgr+20,255), cbgg = Math.min(bgg+20,255), cbgb = Math.min(bgb+20,255);
        glassStyle.textContent = `
            body { background: linear-gradient(135deg, ${gbg} 0%, rgb(${cbgr},${cbgg},${cbgb}) 50%, ${gbg} 100%) !important; }
            .card, .modal, .form-input, .table-container, .nav, .admin-nav {
                background: rgba(${cbgr},${cbgg},${cbgb},0.45) !important;
                backdrop-filter: blur(16px) saturate(1.4) !important;
                -webkit-backdrop-filter: blur(16px) saturate(1.4) !important;
                border: 1px solid rgba(${gar},${gag},${gab},0.15) !important;
                box-shadow: 0 4px 30px rgba(0,0,0,0.2) !important;
            }
            .form-input { background: rgba(${bgr},${bgg},${bgb},0.5) !important; border: 1px solid rgba(${gar},${gag},${gab},0.2) !important; }
            .form-input:focus { border-color: ${ga} !important; box-shadow: 0 0 0 3px rgba(${gar},${gag},${gab},0.15) !important; }
            .btn-primary { background: rgba(${gar},${gag},${gab},0.25) !important; border: 1px solid rgba(${gar},${gag},${gab},0.4) !important; backdrop-filter: blur(8px) !important; color: ${siteConfig.theme_text_primary || '#f1f5f9'} !important; }
            .btn-primary:hover { background: rgba(${gar},${gag},${gab},0.4) !important; }
            .btn-secondary { background: rgba(${gar},${gag},${gab},0.1) !important; border: 1px solid rgba(${gar},${gag},${gab},0.2) !important; backdrop-filter: blur(8px) !important; }
            .badge { backdrop-filter: blur(4px) !important; }
            .table-container table thead { background: rgba(${bgr},${bgg},${bgb},0.6) !important; }
            .table-container table tbody tr:hover { background: rgba(${gar},${gag},${gab},0.08) !important; }
            .nav { background: rgba(${bgr},${bgg},${bgb},0.7) !important; backdrop-filter: blur(20px) saturate(1.5) !important; border-bottom: 1px solid rgba(${gar},${gag},${gab},0.1) !important; }
            .challenge-card { background: rgba(${cbgr},${cbgg},${cbgb},0.4) !important; backdrop-filter: blur(12px) !important; border: 1px solid rgba(${gar},${gag},${gab},0.12) !important; }
            .challenge-card:hover { border-color: rgba(${gar},${gag},${gab},0.3) !important; box-shadow: 0 8px 32px rgba(${gar},${gag},${gab},0.1) !important; }
            .modal-overlay .modal { background: rgba(${bgr},${bgg},${bgb},0.85) !important; backdrop-filter: blur(24px) saturate(1.5) !important; border: 1px solid rgba(${gar},${gag},${gab},0.15) !important; }
        `;
    } else if (glassStyle) {
        glassStyle.remove();
    }
}

// Adjust color brightness
function adjustColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = Math.max(Math.min((num >> 16) + amt, 255), 0);
    const G = Math.max(Math.min((num >> 8 & 0x00FF) + amt, 255), 0);
    const B = Math.max(Math.min((num & 0x0000FF) + amt, 255), 0);
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

// Apply branding
function applyBranding() {
    const navBrand = document.querySelector('.nav-brand a');
    if (navBrand) {
        const logoImage = siteConfig.logo_image;
        const logoText = siteConfig.logo_text || 'CTF Platform';
        const logoPosition = siteConfig.logo_position || 'left';
        
        let html = '';
        const imgHtml = logoImage ? `<img src="${escapeHtml(logoImage)}" alt="Logo" class="brand-logo" style="height: 36px; width: auto; max-width: 50px; object-fit: contain;">` : '';
        const textHtml = `<span class="brand-text">${escapeHtml(logoText)}</span><span class="brand-underscore">_</span>`;
        
        if (logoPosition === 'right') {
            html = textHtml + imgHtml;
        } else {
            html = imgHtml + textHtml;
        }
        
        navBrand.innerHTML = html;
        navBrand.style.display = 'flex';
        navBrand.style.alignItems = 'center';
        navBrand.style.gap = '0.5rem';
    }
    
    // Update page title
    if (siteConfig.logo_text) {
        document.title = siteConfig.logo_text;
    }
}

// Toast notifications
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// Navigation
function navigate(page, params = {}) {
    currentPage = page;
    const url = page === 'home' ? '/' : `/${page}${params.id ? '/' + params.id : ''}`;
    history.pushState({ page, params }, '', url);
    renderPage(page, params);
    updateNavActive();
}

function updateNavActive() {
    document.querySelectorAll('.nav-links a').forEach(a => {
        a.classList.toggle('active', a.getAttribute('href') === '/' + currentPage);
    });
}

// Mobile nav toggle
function toggleMobileNav() {
    document.getElementById('nav-links').classList.toggle('active');
}

// Update auth UI
function updateAuthUI() {
    const authDiv = document.getElementById('nav-auth');
    if (currentUser) {
        // Hide username for admin users, show profile link for regular users
        const profileLink = currentUser.is_admin 
            ? '' 
            : `<a href="/users/${currentUser.id}" onclick="navigate('users', {id: ${currentUser.id}}); return false;" class="btn btn-ghost">${currentUser.username}</a>`;
        
        authDiv.innerHTML = `
            <button class="btn btn-ghost notif-btn" onclick="showNotifications()" title="Notifications">
                🔔 <span id="notif-badge" class="notif-badge" style="display: none;">0</span>
            </button>
            ${profileLink}
            ${currentUser.is_admin ? '<a href="/admin" onclick="navigate(\'admin\'); return false;" class="btn btn-small btn-secondary">Admin</a>' : ''}
            <button class="btn btn-small btn-ghost" onclick="logout()">Logout</button>
        `;
        loadNotifications();
    } else {
        authDiv.innerHTML = `
            <button class="btn btn-ghost notif-btn" onclick="showNotifications()" title="Announcements">
                🔔 <span id="notif-badge" class="notif-badge" style="display: none;">0</span>
            </button>
            <a href="/login" onclick="navigate('login'); return false;" class="btn btn-small btn-secondary">Login</a>
            <a href="/register" onclick="navigate('register'); return false;" class="btn btn-small btn-primary">Register</a>
        `;
        loadNotifications();
    }
    
    // Update fixed timer
    updateFixedTimer();
}

// Show notifications modal
function showNotifications() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h2 class="modal-title">📢 Announcements</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
            </div>
            <div class="modal-body" style="max-height: 400px; overflow-y: auto;">
                ${notifications.length > 0 ? notifications.map(n => `
                    <div class="notification-item ${n.type}" style="padding: 1rem; margin-bottom: 1rem; background: var(--bg-tertiary); border-radius: 8px; border-left: 4px solid ${n.type === 'warning' ? 'var(--warning)' : n.type === 'danger' ? 'var(--danger)' : 'var(--accent)'};">
                        <div style="font-weight: 600; margin-bottom: 0.5rem;">${escapeHtml(n.title)}</div>
                        <div style="color: var(--text-secondary); font-size: 0.9rem;">${escapeHtml(n.content)}</div>
                        <div style="color: var(--text-muted); font-size: 0.8rem; margin-top: 0.5rem;">${formatDate(n.created_at)}</div>
                    </div>
                `).join('') : '<p class="text-muted text-center">No announcements yet</p>'}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Auth functions
async function login(e) {
    e.preventDefault();
    const form = e.target;
    try {
        const data = await api('/auth/login', {
            method: 'POST',
            body: {
                username: form.username.value,
                password: form.password.value
            }
        });
        currentUser = data.user;
        updateAuthUI();
        showToast('Welcome back!', 'success');
        navigate('challenges');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function register(e) {
    e.preventDefault();
    const form = e.target;
    if (form.password.value !== form.confirm_password.value) {
        return showToast('Passwords do not match', 'error');
    }
    try {
        const data = await api('/auth/register', {
            method: 'POST',
            body: {
                username: form.username.value,
                email: form.email.value,
                password: form.password.value
            }
        });
        
        if (data.requires_verification) {
            showToast(data.message || 'Please check your email to verify your account', 'info');
            navigate('login');
            return;
        }
        
        currentUser = data.user;
        updateAuthUI();
        showToast('Account created successfully!', 'success');
        navigate('challenges');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function logout() {
    await api('/auth/logout', { method: 'POST' });
    currentUser = null;
    updateAuthUI();
    showToast('Logged out', 'info');
    navigate('home');
}

// Page renderers
function renderPage(page, params = {}) {
    const main = document.getElementById('main-content');
    
    switch (page) {
        case 'home': return renderHome(main);
        case 'login': return renderLogin(main);
        case 'register': return renderRegister(main);
        case 'challenges': return renderChallenges(main);
        case 'scoreboard': return renderScoreboard(main);
        case 'users': return params.id ? renderUserProfile(main, params.id) : renderUsers(main);
        case 'teams': return params.id ? renderTeamProfile(main, params.id) : renderTeams(main);
        case 'admin': return renderAdmin(main);
        case 'verify': return renderVerifyEmail(main);
        case 'reset-password': return renderResetPassword(main);
        case 'forgot-password': return renderForgotPassword(main);
        default: renderHome(main);
    }
}

function renderHome(container) {
    const ctfStart = siteConfig.ctf_start ? new Date(siteConfig.ctf_start) : null;
    const ctfEnd = siteConfig.ctf_end ? new Date(siteConfig.ctf_end) : null;
    const now = new Date();
    
    // Get timer styling (support both old and new key names for compatibility)
    const timerColor = siteConfig.opening_timer_color || siteConfig.timer_color_start || siteConfig.timer_color_countdown || '#00ff88';
    const timerBg = siteConfig.opening_timer_bg || siteConfig.timer_bg || siteConfig.timer_bg_color || '#0a0a1a';
    const timerBorder = siteConfig.opening_timer_border || (timerColor + '60');
    const timerStyle = siteConfig.opening_timer_style || siteConfig.timer_style || 'digital';
    const timerLabel = siteConfig.opening_timer_label || '🚀 CTF STARTS IN';
    const timerGlow = siteConfig.opening_timer_glow !== '0';
    const fontSize = siteConfig.opening_timer_size || siteConfig.timer_font_size || 'large';
    const fontSizeMap = { small: '2rem', medium: '3rem', large: '4rem', xlarge: '5rem' };
    const timerFontSize = fontSizeMap[fontSize] || '4rem';
    
    // Before CTF starts - show countdown page
    if (ctfStart && now < ctfStart) {
        const heroTitle = siteConfig.hero_title || 'CTF Coming Soon';
        const customOpening = customCode.page_opening || '';
        
        let timerStyleCSS = '';
        if (timerStyle === 'neon' || timerGlow) {
            timerStyleCSS = `text-shadow: 0 0 10px ${timerColor}, 0 0 20px ${timerColor}, 0 0 40px ${timerColor};`;
        }
        if (timerStyle === 'matrix') {
            timerStyleCSS = `color: #00ff00 !important; text-shadow: 0 0 10px #00ff00; font-family: 'Courier New', monospace;`;
        } else if (timerStyle === 'minimal') {
            timerStyleCSS = `font-weight: 300;`;
        } else if (timerStyle === 'retro') {
            timerStyleCSS = `font-family: 'Courier New', monospace; letter-spacing: 3px; text-shadow: 2px 2px 0 #ff0000, -2px -2px 0 #00ff00;`;
        } else if (timerStyle === 'gradient') {
            timerStyleCSS = `background: linear-gradient(135deg, ${timerColor}, #00ccff); -webkit-background-clip: text; -webkit-text-fill-color: transparent;`;
        } else if (timerStyle === 'cyber') {
            timerStyleCSS = `text-shadow: 0 0 5px ${timerColor}, 0 0 10px ${timerColor};`;
        } else if (timerStyle === 'fire') {
            timerStyleCSS = `color: #ff6600 !important; text-shadow: 0 0 10px #ff3300, 0 0 20px #ff0000;`;
        }
        
        const glowShadow = timerGlow ? `, 0 0 30px ${timerColor}40` : '';
        const timerDelayMs = (parseInt(siteConfig.opening_timer_delay) || 5) * 1000;
        
        // If custom opening page, show it as iframe with fixed timer overlay
        if (customOpening.trim()) {
            const openingTimerVisible = siteConfig.opening_timer_visible !== '0';
            const openingTimerPos = siteConfig.opening_timer_position || 'top';
            const fixedPosMap = { top: 'top:80px;left:50%;transform:translateX(-50%);', bottom: 'bottom:30px;left:50%;transform:translateX(-50%);', left: 'top:50%;left:20px;transform:translateY(-50%);', right: 'top:50%;right:20px;transform:translateY(-50%);left:auto;', center: 'top:50%;left:50%;transform:translate(-50%,-50%);' };
            const blob = new Blob([`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{margin:0;background:#0a0a1a;color:#fff;}</style></head><body>${customOpening}</body></html>`], { type: 'text/html' });
            const blobUrl = URL.createObjectURL(blob);
            container.innerHTML = `
                <div style="position: relative; width: 100%; min-height: calc(100vh - 70px);">
                    ${openingTimerVisible ? `<div id="fixed-start-timer" style="position: fixed; ${fixedPosMap[openingTimerPos] || fixedPosMap.top} z-index: 1000; background: ${timerBg}f0; padding: 1rem 2rem; border-radius: 16px; border: 2px solid ${timerBorder}; box-shadow: 0 10px 40px rgba(0,0,0,0.6)${glowShadow}; opacity: 0; transition: opacity 0.5s ease;">
                        <div style="color: ${timerStyle === 'matrix' ? '#00ff00' : (timerStyle === 'fire' ? '#ff6600' : timerColor)}; font-size: 0.85rem; text-align: center; margin-bottom: 0.5rem; font-weight: 600;">${escapeHtml(timerLabel)}</div>
                        <div id="countdown-timer" style="display: flex; gap: 1rem; justify-content: center;">
                            <div style="text-align: center;"><span id="cd-days" style="display: block; color: ${timerColor}; font-size: 2rem; font-weight: bold; ${timerStyleCSS}">00</span><span style="font-size: 0.7rem; color: #888;">Days</span></div>
                            <div style="text-align: center;"><span id="cd-hours" style="display: block; color: ${timerColor}; font-size: 2rem; font-weight: bold; ${timerStyleCSS}">00</span><span style="font-size: 0.7rem; color: #888;">Hours</span></div>
                            <div style="text-align: center;"><span id="cd-mins" style="display: block; color: ${timerColor}; font-size: 2rem; font-weight: bold; ${timerStyleCSS}">00</span><span style="font-size: 0.7rem; color: #888;">Mins</span></div>
                            <div style="text-align: center;"><span id="cd-secs" style="display: block; color: ${timerColor}; font-size: 2rem; font-weight: bold; ${timerStyleCSS}">00</span><span style="font-size: 0.7rem; color: #888;">Secs</span></div>
                        </div>
                    </div>` : ''}
                    <iframe src="${blobUrl}" style="width: 100%; height: calc(100vh - 70px); border: none; display: block;"></iframe>
                </div>
            `;
            if (openingTimerVisible) {
                startCountdown(ctfStart, true);
                setTimeout(() => { const t = document.getElementById('fixed-start-timer'); if (t) t.style.opacity = '1'; }, timerDelayMs);
            }
        } else {
            // Simple default countdown page (no custom code provided)
            const _siteName = escapeHtml(siteConfig.branding_site_name || siteConfig.hero_title || 'CTF Platform');
            const _tagline = escapeHtml(siteConfig.branding_tagline || siteConfig.hero_subtitle || 'The competition is about to begin.');
            const _timerLabelColor = timerStyle === 'matrix' ? '#00ff00' : (timerStyle === 'fire' ? '#ff6600' : timerColor);

            const openingTimerVisible = siteConfig.opening_timer_visible !== '0';
            const openingTimerPos = siteConfig.opening_timer_position || 'center';
            const posStyles = { top: 'justify-content:flex-start;padding-top:80px;', bottom: 'justify-content:flex-end;padding-bottom:80px;', left: 'align-items:flex-start;padding-left:60px;', right: 'align-items:flex-end;padding-right:60px;', center: '' };

            container.innerHTML = `
                <section class="hero" style="min-height: calc(100vh - 70px); display: flex; flex-direction: column; justify-content: center; align-items: center; ${posStyles[openingTimerPos] || ''}">
                    <h1 class="hero-title" style="margin-bottom: 1rem;">${_siteName}<span class="brand-underscore">_</span></h1>
                    <p class="hero-subtitle" style="margin-bottom: 2rem;">${_tagline}</p>
                    ${openingTimerVisible ? `
                    <div style="background: ${timerBg}f0; padding: 1.5rem 2.5rem; border-radius: 16px; border: 2px solid ${timerBorder}; box-shadow: 0 10px 40px rgba(0,0,0,0.6)${glowShadow}; text-align: center;">
                        <div style="color: ${_timerLabelColor}; font-size: 0.85rem; margin-bottom: 0.75rem; font-weight: 600;">${escapeHtml(timerLabel)}</div>
                        <div id="countdown-timer" style="display: flex; gap: 1.5rem; justify-content: center;">
                            <div style="text-align: center;"><span id="cd-days" style="display: block; color: ${timerColor}; font-size: ${timerFontSize}; font-weight: bold; ${timerStyleCSS}">00</span><span style="font-size: 0.75rem; color: #888;">Days</span></div>
                            <div style="text-align: center;"><span id="cd-hours" style="display: block; color: ${timerColor}; font-size: ${timerFontSize}; font-weight: bold; ${timerStyleCSS}">00</span><span style="font-size: 0.75rem; color: #888;">Hours</span></div>
                            <div style="text-align: center;"><span id="cd-mins" style="display: block; color: ${timerColor}; font-size: ${timerFontSize}; font-weight: bold; ${timerStyleCSS}">00</span><span style="font-size: 0.75rem; color: #888;">Mins</span></div>
                            <div style="text-align: center;"><span id="cd-secs" style="display: block; color: ${timerColor}; font-size: ${timerFontSize}; font-weight: bold; ${timerStyleCSS}">00</span><span style="font-size: 0.75rem; color: #888;">Secs</span></div>
                        </div>
                    </div>
                    ` : ''}
                </section>
            `;
            if (openingTimerVisible) startCountdown(ctfStart, false);
        }
        return;
    }
    
    // CTF has ended - show ended page
    if (ctfEnd && now > ctfEnd) {
        const heroTitle = siteConfig.hero_title || 'CTF';
        const endingColor = siteConfig.timer_color_end || siteConfig.timer_color_ending || '#ffa502';
        const customEnding = customCode.page_ending || '';
        
        // If custom ending page exists, show it as iframe
        if (customEnding.trim()) {
            const blob = new Blob([`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{margin:0;background:#0a0a1a;color:#fff;min-height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;}</style></head><body>${customEnding}</body></html>`], { type: 'text/html' });
            const blobUrl = URL.createObjectURL(blob);
            container.innerHTML = `
                <div style="width: 100%;">
                    <iframe src="${blobUrl}" style="width: 100%; height: calc(100vh - 150px); border: none; display: block;"></iframe>
                    <div style="text-align: center; padding: 1rem; background: var(--bg-primary);">
                        <a href="/scoreboard" onclick="navigate('scoreboard'); return false;" class="btn btn-primary" style="font-size: 1rem; padding: 0.75rem 1.5rem;">
                            🏆 View Final Scoreboard
                        </a>
                    </div>
                </div>
            `;
        } else {
            // Default ending page
            container.innerHTML = `
                <section class="hero" style="min-height: 80vh; display: flex; flex-direction: column; justify-content: center; background: ${timerBg};">
                    <div class="ctf-countdown-center">
                        <div class="ctf-ended-icon" style="font-size: 5rem; margin-bottom: 1.5rem;">🏁</div>
                        <h1 class="hero-title" style="margin-bottom: 1rem; color: ${endingColor};">${escapeHtml(heroTitle)} Has Ended<span class="brand-underscore">_</span></h1>
                        <p class="hero-subtitle" style="margin-bottom: 2rem; font-size: 1.3rem;">
                            Thank you for participating! The competition has concluded.
                        </p>
                        <p class="hero-subtitle" style="margin-bottom: 2rem; color: var(--text-muted);">
                            See you at the next event! 👋
                        </p>
                        <div class="ctf-ended-actions" style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                            <a href="/scoreboard" onclick="navigate('scoreboard'); return false;" class="btn btn-primary" style="font-size: 1.1rem; padding: 1rem 2rem;">
                                🏆 View Final Scoreboard
                            </a>
                            ${siteConfig.discord_url ? `<a href="${escapeHtml(siteConfig.discord_url)}" target="_blank" class="btn btn-secondary" style="font-size: 1.1rem; padding: 1rem 2rem;">Join Discord</a>` : ''}
                        </div>
                    </div>
                </section>
            `;
        }
        // Hide fixed timer since we show ended page
        const timerEl = document.getElementById('fixed-timer');
        if (timerEl) timerEl.style.display = 'none';
        return;
    }
    
    // CTF is running - show custom homepage if exists
    if (customCode.page_home && customCode.page_home.trim()) {
        const blob = new Blob([customCode.page_home], { type: 'text/html' });
        const blobUrl = URL.createObjectURL(blob);
        container.innerHTML = `
            <iframe id="custom-home-frame" style="width: 100%; height: calc(100vh - 70px); border: none; display: block;" src="${blobUrl}"></iframe>
        `;
        return;
    }
    
    // Default homepage
    const heroTitle = siteConfig.hero_title || siteConfig.logo_text || 'CTF Platform';
    const heroSubtitle = siteConfig.hero_subtitle || 'Welcome hackers! Prove the world that a computer genius with a laptop is not a nerd sitting in the corner of a untidy room but a fun loving work of brilliance! Join our CTF and expand your knowledge about computer forensics.';
    const discordUrl = siteConfig.discord_url;
    const websiteUrl = siteConfig.website_url;
    
    container.innerHTML = `
        <section class="hero">
            <h1 class="hero-title">${escapeHtml(heroTitle)}<span class="brand-underscore">_</span></h1>
            <p class="hero-subtitle">${escapeHtml(heroSubtitle)}</p>
            <div class="hero-buttons">
                ${currentUser 
                    ? '<a href="/challenges" onclick="navigate(\'challenges\'); return false;" class="btn btn-primary">View Challenges</a>'
                    : '<a href="/register" onclick="navigate(\'register\'); return false;" class="btn btn-primary">Join Now</a>'
                }
                <a href="/scoreboard" onclick="navigate('scoreboard'); return false;" class="btn btn-secondary">Scoreboard</a>
                ${discordUrl ? `<a href="${escapeHtml(discordUrl)}" target="_blank" class="btn btn-secondary">Join Discord</a>` : ''}
                ${websiteUrl ? `<a href="${escapeHtml(websiteUrl)}" target="_blank" class="btn btn-secondary">Visit Website</a>` : ''}
            </div>
        </section>
        <div class="container">
            <div class="grid grid-3 mt-4">
                <div class="card stat-card">
                    <div class="stat-value" id="stat-challenges">-</div>
                    <div class="stat-label">Challenges</div>
                </div>
                <div class="card stat-card">
                    <div class="stat-value" id="stat-users">-</div>
                    <div class="stat-label">Hackers</div>
                </div>
                <div class="card stat-card">
                    <div class="stat-value" id="stat-teams">-</div>
                    <div class="stat-label">Teams</div>
                </div>
            </div>
        </div>
        ${siteConfig.footer_text ? `<footer class="text-center text-muted mt-4" style="padding: 2rem;">${escapeHtml(siteConfig.footer_text)}</footer>` : ''}
    `;
    loadHomeStats();
}

// Fixed right side timer
function updateFixedTimer() {
    const timerEl = document.getElementById('fixed-timer');
    if (!timerEl) return;
    
    const ctfStart = siteConfig.ctf_start ? new Date(siteConfig.ctf_start) : null;
    const ctfEnd = siteConfig.ctf_end ? new Date(siteConfig.ctf_end) : null;
    const now = new Date();
    
    // Get running timer colors (support both new and old key names)
    const colorEnd = siteConfig.running_timer_color || siteConfig.timer_color_end || siteConfig.timer_color_ending || '#ffa502';
    const timerBg = siteConfig.running_timer_bg || siteConfig.timer_bg || siteConfig.timer_bg_color || '#0a0a1a';
    const timerBorder = siteConfig.running_timer_border || (colorEnd + '60');
    const timerStyle = siteConfig.running_timer_style || siteConfig.ending_timer_style || 'digital';
    const timerLabel = siteConfig.running_timer_label || '🔥 ENDS IN';
    const timerGlow = siteConfig.running_timer_glow === '1';
    const timerGlowColor = siteConfig.running_timer_glow_color || colorEnd;
    const timerSize = siteConfig.running_timer_size || 'medium';
    
    // Font size mapping
    const sizeMap = { small: '1.2rem', medium: '1.5rem', large: '1.8rem' };
    const fontSize = sizeMap[timerSize] || '1.5rem';
    
    // Style CSS based on timer style
    let styleCSS = '';
    if (timerStyle === 'neon' || timerGlow) styleCSS = `text-shadow: 0 0 15px ${timerGlowColor}, 0 0 30px ${timerGlowColor};`;
    else if (timerStyle === 'fire') styleCSS = `color: #ff6600; text-shadow: 0 0 10px #ff3300, 0 0 20px #ff0000;`;
    else if (timerStyle === 'urgent') styleCSS = `animation: pulse 0.5s infinite;`;
    else if (timerStyle === 'minimal') styleCSS = `font-weight: 400;`;
    else styleCSS = `text-shadow: 0 0 20px ${colorEnd}80;`;
    
    // Before CTF starts - don't show fixed timer (shown in main content)
    if (ctfStart && now < ctfStart) {
        timerEl.style.display = 'none';
        return;
    }
    
    // Check running timer visibility
    if (siteConfig.running_timer_visible === '0') {
        timerEl.style.display = 'none';
        return;
    }
    
    // Apply running timer position
    const runPos = siteConfig.running_timer_position || 'right';
    timerEl.style.top = ''; timerEl.style.bottom = ''; timerEl.style.left = ''; timerEl.style.right = ''; timerEl.style.transform = '';
    if (runPos === 'top') { timerEl.style.top = '80px'; timerEl.style.left = '50%'; timerEl.style.right = 'auto'; timerEl.style.transform = 'translateX(-50%)'; }
    else if (runPos === 'bottom') { timerEl.style.bottom = '20px'; timerEl.style.top = 'auto'; timerEl.style.left = '50%'; timerEl.style.right = 'auto'; timerEl.style.transform = 'translateX(-50%)'; }
    else if (runPos === 'left') { timerEl.style.top = '50%'; timerEl.style.left = '20px'; timerEl.style.right = 'auto'; timerEl.style.transform = 'translateY(-50%)'; }
    else if (runPos === 'center') { timerEl.style.top = '50%'; timerEl.style.left = '50%'; timerEl.style.right = 'auto'; timerEl.style.transform = 'translate(-50%, -50%)'; }
    else { timerEl.style.top = '50%'; timerEl.style.right = '20px'; timerEl.style.left = 'auto'; timerEl.style.transform = 'translateY(-50%)'; }
    
    // CTF running - show end timer
    if (ctfEnd && now < ctfEnd) {
        timerEl.style.display = 'block';
        timerEl.className = 'fixed-timer timer-ending';
        
        // Set CSS variables for the glow color (used by ::before pseudo-element)
        timerEl.style.setProperty('--timer-glow-color', timerGlowColor);
        timerEl.style.setProperty('--timer-glow-shadow', timerGlowColor + '50');
        timerEl.style.setProperty('--timer-glow-shadow-light', timerGlowColor + '20');
        
        timerEl.style.borderColor = timerBorder;
        timerEl.style.background = `linear-gradient(135deg, ${timerBg}f0 0%, ${timerBg}e0 100%)`;
        timerEl.style.boxShadow = timerGlow ? `0 0 40px ${timerGlowColor}50, 0 0 80px ${timerGlowColor}20` : `0 0 20px ${colorEnd}30`;
        timerEl.innerHTML = `
            <div class="timer-label" style="color: ${timerStyle === 'fire' ? '#ff6600' : colorEnd};">${escapeHtml(timerLabel)}</div>
            <div class="timer-digits">
                <div class="timer-unit"><span class="timer-value" id="ft-days" style="color: ${timerStyle === 'fire' ? '#ff6600' : colorEnd}; font-size: ${fontSize}; ${styleCSS}">00</span><span class="timer-text">Days</span></div>
                <div class="timer-unit"><span class="timer-value" id="ft-hours" style="color: ${timerStyle === 'fire' ? '#ff6600' : colorEnd}; font-size: ${fontSize}; ${styleCSS}">00</span><span class="timer-text">Hrs</span></div>
                <div class="timer-unit"><span class="timer-value" id="ft-mins" style="color: ${timerStyle === 'fire' ? '#ff6600' : colorEnd}; font-size: ${fontSize}; ${styleCSS}">00</span><span class="timer-text">Min</span></div>
                <div class="timer-unit"><span class="timer-value" id="ft-secs" style="color: ${timerStyle === 'fire' ? '#ff6600' : colorEnd}; font-size: ${fontSize}; ${styleCSS}">00</span><span class="timer-text">Sec</span></div>
            </div>
        `;
        startFixedTimer(ctfEnd);
        return;
    }
    
    // CTF ended
    if (ctfEnd && now > ctfEnd) {
        timerEl.style.display = 'block';
        timerEl.className = 'fixed-timer timer-ended';
        timerEl.innerHTML = `<div class="timer-label">🏁 ENDED</div>`;
        return;
    }
    
    // No timing set
    timerEl.style.display = 'none';
}

let fixedTimerInterval = null;
function startFixedTimer(targetDate) {
    if (fixedTimerInterval) clearInterval(fixedTimerInterval);
    
    function update() {
        const now = new Date();
        const diff = targetDate - now;
        
        if (diff <= 0) {
            location.reload();
            return;
        }
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        
        const d = document.getElementById('ft-days');
        const h = document.getElementById('ft-hours');
        const m = document.getElementById('ft-mins');
        const s = document.getElementById('ft-secs');
        
        if (d) d.textContent = String(days).padStart(2, '0');
        if (h) h.textContent = String(hours).padStart(2, '0');
        if (m) m.textContent = String(mins).padStart(2, '0');
        if (s) s.textContent = String(secs).padStart(2, '0');
    }
    
    update();
    fixedTimerInterval = setInterval(update, 1000);
}

function startCountdown(targetDate, reloadOnEnd = false) {
    function updateCountdown() {
        const now = new Date();
        const diff = targetDate - now;
        
        if (diff <= 0) {
            if (reloadOnEnd) location.reload();
            return;
        }
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        
        const daysEl = document.getElementById('cd-days');
        const hoursEl = document.getElementById('cd-hours');
        const minsEl = document.getElementById('cd-mins');
        const secsEl = document.getElementById('cd-secs');
        
        if (daysEl) daysEl.textContent = String(days).padStart(2, '0');
        if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
        if (minsEl) minsEl.textContent = String(mins).padStart(2, '0');
        if (secsEl) secsEl.textContent = String(secs).padStart(2, '0');
    }
    
    updateCountdown();
    setInterval(updateCountdown, 1000);
}

async function loadHomeStats() {
    try {
        const [challenges, users, teams] = await Promise.all([
            api('/challenges'),
            api('/users?page=1'),
            api('/teams?page=1')
        ]);
        const challengeCount = Object.values(challenges.challenges).flat().length;
        document.getElementById('stat-challenges').textContent = challengeCount;
        document.getElementById('stat-users').textContent = users.pagination.total;
        document.getElementById('stat-teams').textContent = teams.pagination.total;
    } catch (err) {}
}

function renderLogin(container) {
    container.innerHTML = `
        <div class="container container-sm">
            <div class="card mt-4">
                <h2 class="card-title mb-3">Login</h2>
                <form onsubmit="login(event)">
                    <div class="form-group">
                        <label class="form-label">Username or Email</label>
                        <input type="text" name="username" class="form-input" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Password</label>
                        <input type="password" name="password" class="form-input" required>
                    </div>
                    <button type="submit" class="btn btn-primary" style="width: 100%">Login</button>
                </form>
                <p class="text-center mt-2 text-muted">
                    <a href="#" onclick="showForgotPassword(); return false;">Forgot password?</a>
                </p>
                <p class="text-center mt-2 text-muted">
                    Don't have an account? <a href="/register" onclick="navigate('register'); return false;">Register</a>
                </p>
            </div>
        </div>
    `;
}

// Forgot password modal
function showForgotPassword() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h2 class="modal-title">Reset Password</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <form onsubmit="submitForgotPassword(event, this)">
                    <div class="form-group">
                        <label class="form-label">Email Address</label>
                        <input type="email" name="email" class="form-input" required placeholder="Enter your registered email">
                    </div>
                    <button type="submit" class="btn btn-primary" style="width: 100%">Send Reset Link</button>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

async function submitForgotPassword(e, form) {
    e.preventDefault();
    try {
        await api('/auth/forgot-password', {
            method: 'POST',
            body: { email: form.email.value }
        });
        form.closest('.modal-overlay').remove();
        showToast('If an account exists with that email, a reset link has been sent.', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function renderVerifyEmail(container) {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    
    if (!token) {
        container.innerHTML = `
            <div class="container container-sm">
                <div class="card mt-4" style="text-align: center;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">❌</div>
                    <h2 class="card-title mb-3">Invalid Link</h2>
                    <p class="text-muted">No verification token found. Please check your email link.</p>
                    <a href="/login" onclick="navigate('login'); return false;" class="btn btn-primary mt-3">Go to Login</a>
                </div>
            </div>`;
        return;
    }
    
    container.innerHTML = `
        <div class="container container-sm">
            <div class="card mt-4" style="text-align: center;">
                <div class="loading"><div class="spinner"></div></div>
                <p class="text-muted mt-2">Verifying your email...</p>
            </div>
        </div>`;
    
    try {
        const data = await api('/auth/verify?token=' + encodeURIComponent(token));
        container.innerHTML = `
            <div class="container container-sm">
                <div class="card mt-4" style="text-align: center;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">✅</div>
                    <h2 class="card-title mb-3" style="color: var(--accent);">Email Verified!</h2>
                    <p class="text-muted">${escapeHtml(data.message || 'Your email has been verified successfully.')}</p>
                    <p class="text-muted">You can now log in to your account.</p>
                    <a href="/login" onclick="navigate('login'); return false;" class="btn btn-primary mt-3">Go to Login</a>
                </div>
            </div>`;
    } catch (err) {
        container.innerHTML = `
            <div class="container container-sm">
                <div class="card mt-4" style="text-align: center;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">❌</div>
                    <h2 class="card-title mb-3" style="color: #ff4757;">Verification Failed</h2>
                    <p class="text-muted">${escapeHtml(err.message || 'Invalid or expired verification link.')}</p>
                    <a href="/login" onclick="navigate('login'); return false;" class="btn btn-primary mt-3">Go to Login</a>
                </div>
            </div>`;
    }
}

function renderResetPassword(container) {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    
    if (!token) {
        container.innerHTML = `
            <div class="container container-sm">
                <div class="card mt-4" style="text-align: center;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">❌</div>
                    <h2 class="card-title mb-3">Invalid Link</h2>
                    <p class="text-muted">No reset token found. Please request a new password reset.</p>
                    <a href="/login" onclick="navigate('login'); return false;" class="btn btn-primary mt-3">Go to Login</a>
                </div>
            </div>`;
        return;
    }
    
    container.innerHTML = `
        <div class="container container-sm">
            <div class="card mt-4">
                <h2 class="card-title mb-3">🔒 Reset Your Password</h2>
                <form onsubmit="submitResetPassword(event, '${escapeHtml(token)}')">
                    <div class="form-group">
                        <label class="form-label">New Password</label>
                        <input type="password" name="password" class="form-input" required minlength="6" placeholder="Minimum 6 characters">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Confirm New Password</label>
                        <input type="password" name="confirm_password" class="form-input" required minlength="6">
                    </div>
                    <button type="submit" class="btn btn-primary" style="width: 100%">Reset Password</button>
                </form>
                <p class="text-center mt-2 text-muted">
                    <a href="/login" onclick="navigate('login'); return false;">Back to Login</a>
                </p>
            </div>
        </div>`;
}

async function submitResetPassword(e, token) {
    e.preventDefault();
    const form = e.target;
    const password = form.password.value;
    const confirm = form.confirm_password.value;
    
    if (password !== confirm) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    try {
        const data = await api('/auth/reset-password', {
            method: 'POST',
            body: { token, password }
        });
        const main = document.getElementById('main-content');
        main.innerHTML = `
            <div class="container container-sm">
                <div class="card mt-4" style="text-align: center;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">✅</div>
                    <h2 class="card-title mb-3" style="color: var(--accent);">Password Reset Successful!</h2>
                    <p class="text-muted">${escapeHtml(data.message || 'Your password has been reset.')}</p>
                    <a href="/login" onclick="navigate('login'); return false;" class="btn btn-primary mt-3">Go to Login</a>
                </div>
            </div>`;
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function renderForgotPassword(container) {
    container.innerHTML = `
        <div class="container container-sm">
            <div class="card mt-4">
                <h2 class="card-title mb-3">🔑 Forgot Password</h2>
                <form onsubmit="submitForgotPasswordPage(event)">
                    <div class="form-group">
                        <label class="form-label">Email Address</label>
                        <input type="email" name="email" class="form-input" required placeholder="Enter your registered email">
                    </div>
                    <button type="submit" class="btn btn-primary" style="width: 100%">Send Reset Link</button>
                </form>
                <p class="text-center mt-2 text-muted">
                    <a href="/login" onclick="navigate('login'); return false;">Back to Login</a>
                </p>
            </div>
        </div>`;
}

async function submitForgotPasswordPage(e) {
    e.preventDefault();
    const form = e.target;
    try {
        await api('/auth/forgot-password', {
            method: 'POST',
            body: { email: form.email.value }
        });
        showToast('If an account exists with that email, a reset link has been sent.', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function renderRegister(container) {
    container.innerHTML = `
        <div class="container container-sm">
            <div class="card mt-4">
                <h2 class="card-title mb-3">Create Account</h2>
                <form onsubmit="register(event)">
                    <div class="form-group">
                        <label class="form-label">Username</label>
                        <input type="text" name="username" class="form-input" required minlength="3">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Email</label>
                        <input type="email" name="email" class="form-input" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Password</label>
                        <input type="password" name="password" class="form-input" required minlength="6">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Confirm Password</label>
                        <input type="password" name="confirm_password" class="form-input" required>
                    </div>
                    <button type="submit" class="btn btn-primary" style="width: 100%">Register</button>
                </form>
                <p class="text-center mt-2 text-muted">
                    Already have an account? <a href="/login" onclick="navigate('login'); return false;">Login</a>
                </p>
            </div>
        </div>
    `;
}

async function renderChallenges(container) {
    container.innerHTML = `<div class="container"><div class="loading"><div class="spinner"></div></div></div>`;
    
    const now = new Date();
    const ctfStart = siteConfig.ctf_start ? new Date(siteConfig.ctf_start) : null;
    const ctfEnd = siteConfig.ctf_end ? new Date(siteConfig.ctf_end) : null;
    const isAdmin = currentUser && currentUser.is_admin;
    
    // Check if challenges are hidden by admin toggle (non-admin users)
    if (siteConfig.challenges_visible === '0' && !isAdmin) {
        container.innerHTML = `
            <div class="container">
                <div class="empty-state">
                    <div class="empty-state-icon">🔒</div>
                    <h3>Challenges Unavailable</h3>
                    <p>Challenges are currently not accessible. Please check back later.</p>
                </div>
            </div>
        `;
        return;
    }
    
    // Check if CTF hasn't started yet (auto-hide before event)
    if (ctfStart && now < ctfStart && !isAdmin) {
        const timeUntilStart = ctfStart - now;
        const days = Math.floor(timeUntilStart / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeUntilStart % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        
        container.innerHTML = `
            <div class="container">
                <div class="empty-state">
                    <div class="empty-state-icon">⏳</div>
                    <h3>CTF Not Started Yet</h3>
                    <p>The competition hasn't begun. Challenges will be available when the CTF starts.</p>
                    <p style="color: var(--accent); font-size: 1.2rem; margin-top: 1rem;">
                        Starting in: ${days}d ${hours}h
                    </p>
                    <a href="/" onclick="navigate('home'); return false;" class="btn btn-primary mt-3">Go to Homepage</a>
                </div>
            </div>
        `;
        return;
    }
    
    // Check if CTF has ended (auto-hide after event)
    if (ctfEnd && now > ctfEnd && !isAdmin) {
        container.innerHTML = `
            <div class="container">
                <div class="empty-state">
                    <div class="empty-state-icon">🏁</div>
                    <h3>CTF Has Ended</h3>
                    <p>The competition is over. Challenges are no longer accessible.</p>
                    <a href="/scoreboard" onclick="navigate('scoreboard'); return false;" class="btn btn-primary mt-3">View Final Scoreboard</a>
                </div>
            </div>
        `;
        return;
    }
    
    // Check if team mode is active and user has no team
    if (siteConfig.play_mode === 'team' && currentUser && !currentUser.is_admin && !currentUser.team_id) {
        container.innerHTML = `
            <div class="container">
                <div class="empty-state">
                    <div class="empty-state-icon">👥</div>
                    <h3>Team Mode Active</h3>
                    <p>This event requires team participation. Join or create a team to access challenges.</p>
                    <a href="/teams" onclick="navigate('teams'); return false;" class="btn btn-primary mt-3">Go to Teams</a>
                </div>
            </div>
        `;
        return;
    }
    
    try {
        const data = await api('/challenges');
        const categories = data.challenges;
        
        if (Object.keys(categories).length === 0) {
            container.innerHTML = `
                <div class="container">
                    <div class="empty-state">
                        <div class="empty-state-icon">🚩</div>
                        <h3>No Challenges Yet</h3>
                        <p>Challenges will appear here once they are added.</p>
                    </div>
                </div>
            `;
            return;
        }
        
        let html = '<div class="container" style="position: relative; z-index: 1;"><h1 class="mb-4">Challenges</h1>';
        
        for (const [category, challenges] of Object.entries(categories)) {
            html += `
                <div class="category-section">
                    <h2 class="category-title">${category}</h2>
                    <div class="challenge-grid">
                        ${challenges.map(c => `
                            <div class="card challenge-card ${c.solved ? 'solved' : ''}" onclick="showChallenge(${c.id})">
                                <div class="challenge-category">${c.category}</div>
                                <div class="challenge-title" style="display: flex; align-items: center; gap: 0.5rem;">
                                    ${escapeHtml(c.title)}
                                    ${c.avg_rating > 0 ? `<span style="font-size: 0.75rem; color: #ffd700;">⭐ ${parseFloat(c.avg_rating).toFixed(1)}</span>` : ''}
                                </div>
                                <div class="challenge-meta">
                                    <span class="challenge-points">${c.points} pts</span>
                                    <span>${c.solves} solves</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
        container.innerHTML = html;
        
        // Inject and execute custom challenges page code if exists
        if (customCode.page_challenges && customCode.page_challenges.trim()) {
            injectCustomCode(container, customCode.page_challenges);
        }
    } catch (err) {
        if (err.message.includes('Login required')) {
            container.innerHTML = `
                <div class="container">
                    <div class="empty-state">
                        <div class="empty-state-icon">🔒</div>
                        <h3>Login Required</h3>
                        <p>You need to login to view challenges.</p>
                        <div class="mt-4">
                            <a href="/login" onclick="navigate('login'); return false;" class="btn btn-primary">Login</a>
                            <a href="/register" onclick="navigate('register'); return false;" class="btn btn-secondary">Register</a>
                        </div>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `<div class="container"><div class="empty-state">Failed to load challenges</div></div>`;
        }
    }
}

async function showChallenge(id) {
    try {
        const data = await api(`/challenges/${id}`);
        const c = data.challenge;
        const avgRating = c.avg_rating ? parseFloat(c.avg_rating).toFixed(1) : '0.0';
        const ratingCount = c.rating_count || 0;
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
        
        modal.innerHTML = `
            <div class="modal">
                <div class="modal-header" style="display: flex; align-items: flex-start; justify-content: space-between;">
                    <div>
                        <div class="challenge-category">${c.category}</div>
                        <h2 class="modal-title" style="display: flex; align-items: center; gap: 0.75rem;">
                            ${escapeHtml(c.title)}
                            ${ratingCount > 0 ? `<span style="font-size: 0.85rem; color: #ffd700; font-weight: 500;">⭐ ${avgRating}</span>` : ''}
                        </h2>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0;">
                        <button class="btn btn-secondary btn-small" onclick="showSolvesPopup(${id}, ${JSON.stringify((data.all_solvers || data.solvers || []).map(s => ({id:s.id, username:s.username, submitted_at:s.submitted_at}))).replace(/"/g, '&quot;')})" style="font-size: 0.8rem; padding: 0.4rem 0.75rem;">
                            🏆 Solves (${c.solves})
                        </button>
                        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                    </div>
                </div>
                <div class="modal-body">
                    ${c.user_solved ? `
                        <div class="solved-banner" style="background: linear-gradient(135deg, rgba(0,255,136,0.15), rgba(0,204,136,0.1)); border: 1px solid #00ff88; border-radius: 12px; padding: 1rem; margin-bottom: 1rem; text-align: center;">
                            <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">✅ Solved!</div>
                            <div style="color: #00ff88; font-size: 0.9rem;">
                                <span style="color: var(--text-muted);">Submitted on:</span> 
                                <strong>${formatDateTime(c.user_solve_time)}</strong>
                            </div>
                            <div style="color: var(--text-muted); font-size: 0.8rem; margin-top: 0.25rem;">
                                ${formatTimeAgo(c.user_solve_time)}
                            </div>
                        </div>
                        ${c.visible_flag ? `
                            <div style="background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
                                <span style="color: var(--text-muted); font-size: 0.85rem;">🏳️ Flag:</span>
                                <code class="mono" style="color: #00ff88; font-size: 0.9rem;">${escapeHtml(c.visible_flag)}</code>
                            </div>
                        ` : ''}
                    ` : ''}
                    <p class="mb-3" style="white-space: pre-line;">${escapeHtml(c.description)}</p>
                    ${c.link_url ? `<p class="mb-2"><a href="${escapeHtml(c.link_url)}" target="_blank" rel="noopener" class="btn btn-secondary btn-small">🔗 Challenge Link</a></p>` : ''}
                    ${(() => { try { const el = JSON.parse(c.extra_links || '[]'); return el.map(l => '<p class="mb-2"><a href="' + escapeHtml(l.url) + '" target="_blank" rel="noopener" class="btn btn-secondary btn-small">\uD83D\uDD17 ' + escapeHtml(l.label || 'Link') + '</a></p>').join(''); } catch(e){ return ''; } })()}
                    <div class="flex flex-between mb-3">
                        <span class="badge badge-success">${c.points} points</span>
                        <span class="text-muted">${c.solves} solves</span>
                    </div>
                    ${c.file_url ? `<p class="mb-2"><a href="${c.file_url}" target="_blank" class="btn btn-secondary btn-small">📁 Download File</a></p>` : ''}
                    ${(() => { try { const ef = JSON.parse(c.extra_files || '[]'); return ef.map(f => '<p class="mb-2"><a href="' + escapeHtml(f.url) + '" target="_blank" class="btn btn-secondary btn-small">\uD83D\uDCC1 ' + escapeHtml(f.label || 'File') + '</a></p>').join(''); } catch(e){ return ''; } })()}
                    ${c.hint ? `<p class="text-muted mb-3"><strong>Hint:</strong> ${escapeHtml(c.hint)}</p>` : ''}
                    ${currentUser && !c.user_solved ? `
                        <form onsubmit="submitFlag(event, ${id})" id="flag-form-${id}">
                            <div class="form-group">
                                <label class="form-label">Submit Flag</label>
                                <input type="text" name="flag" class="form-input mono" placeholder="flag{...}" required>
                            </div>
                            <button type="submit" class="btn btn-primary">Submit</button>
                        </form>
                    ` : (!currentUser ? '<p class="text-muted">Login to submit flags</p>' : '')}
                    ${c.user_solved && currentUser ? `
                        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border);">
                            <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;">Rate this challenge:</div>
                            <div id="rating-stars-${id}" style="display: flex; gap: 0.25rem; align-items: center;">
                                ${[1,2,3,4,5].map(star => `
                                    <span class="rating-star" data-star="${star}" onclick="rateChallenge(${id}, ${star})" style="cursor: pointer; font-size: 1.5rem; color: ${(c.user_rating || 0) >= star ? '#ffd700' : '#555'}; transition: color 0.2s;"
                                     onmouseenter="highlightStars(${id}, ${star})" onmouseleave="resetStars(${id}, ${c.user_rating || 0})">★</span>
                                `).join('')}
                                <span id="rating-text-${id}" style="margin-left: 0.5rem; font-size: 0.85rem; color: var(--text-muted);">${c.user_rating ? `Your rating: ${c.user_rating}/5` : ''}</span>
                            </div>
                        </div>
                    ` : ''}
                </div>
                <div class="modal-footer">
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    } catch (err) {
        if (err.message.includes('banned')) {
            showToast(err.message, 'error');
        } else {
            showToast('Failed to load challenge', 'error');
        }
    }
}

function showSolvesPopup(challengeId, solvers) {
    const existing = document.getElementById('solves-popup-overlay');
    if (existing) existing.remove();
    
    const overlay = document.createElement('div');
    overlay.id = 'solves-popup-overlay';
    overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 10001; display: flex; align-items: center; justify-content: center;';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    
    overlay.innerHTML = `
        <div style="background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 16px; padding: 1.5rem; max-width: 500px; width: 90%; max-height: 70vh; display: flex; flex-direction: column;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 style="margin: 0;">🏆 Solves (${solvers.length})</h3>
                <button onclick="this.closest('#solves-popup-overlay').remove()" style="background: none; border: none; color: var(--text-muted); font-size: 1.5rem; cursor: pointer;">&times;</button>
            </div>
            <div style="overflow-y: auto; flex: 1;">
                ${solvers.length > 0 ? `
                    <table style="width: 100%; font-size: 0.85rem; border-collapse: collapse;">
                        <thead>
                            <tr style="border-bottom: 2px solid var(--border); position: sticky; top: 0; background: var(--bg-secondary);">
                                <th style="text-align: left; padding: 0.6rem;">#</th>
                                <th style="text-align: left; padding: 0.6rem;">User</th>
                                <th style="text-align: right; padding: 0.6rem;">Solved At</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${solvers.map((s, i) => `
                                <tr style="border-bottom: 1px solid var(--border);">
                                    <td style="padding: 0.5rem 0.6rem; color: ${i < 3 ? '#ffd700' : 'var(--text-muted)'}; font-weight: ${i < 3 ? '700' : '400'};">${i + 1}</td>
                                    <td style="padding: 0.5rem 0.6rem;">
                                        <a href="/users/${s.id}" onclick="navigate('users', {id: ${s.id}}); document.querySelectorAll('.modal-overlay, #solves-popup-overlay').forEach(e=>e.remove()); return false;" style="color: var(--accent);">${escapeHtml(s.username)}</a>
                                    </td>
                                    <td style="padding: 0.5rem 0.6rem; text-align: right; color: var(--text-muted); font-size: 0.8rem;">${formatDateTime(s.submitted_at)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : '<p class="text-muted" style="padding: 1rem; text-align: center;">No solves yet</p>'}
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
}

function highlightStars(challengeId, upTo) {
    const container = document.getElementById(`rating-stars-${challengeId}`);
    if (!container) return;
    container.querySelectorAll('.rating-star').forEach(star => {
        star.style.color = parseInt(star.dataset.star) <= upTo ? '#ffd700' : '#555';
    });
}

function resetStars(challengeId, userRating) {
    const container = document.getElementById(`rating-stars-${challengeId}`);
    if (!container) return;
    container.querySelectorAll('.rating-star').forEach(star => {
        star.style.color = parseInt(star.dataset.star) <= userRating ? '#ffd700' : '#555';
    });
}

async function rateChallenge(challengeId, rating) {
    try {
        const data = await api(`/challenges/${challengeId}/rate`, { method: 'POST', body: { rating } });
        showToast(`Rated ${rating}/5 ⭐`, 'success');
        const textEl = document.getElementById(`rating-text-${challengeId}`);
        if (textEl) textEl.textContent = `Your rating: ${rating}/5`;
        resetStars(challengeId, rating);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function submitFlag(e, challengeId) {
    e.preventDefault();
    const form = e.target;
    const flag = form.flag.value;
    
    try {
        const data = await api(`/challenges/${challengeId}/submit`, {
            method: 'POST',
            body: { flag }
        });
        
        if (data.correct) {
            showToast(`🎉 Correct! +${data.points} points`, 'success');
            currentUser.score += data.points;
            document.querySelector('.modal-overlay').remove();
            renderChallenges(document.getElementById('main-content'));
        } else {
            showToast('Incorrect flag. Try again!', 'error');
            form.flag.value = '';
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function renderScoreboard(container) {
    container.innerHTML = `<div class="container"><div class="loading"><div class="spinner"></div></div></div>`;
    
    const type = new URLSearchParams(window.location.search).get('type') || 'teams';
    
    try {
        const [data, graphData] = await Promise.all([
            api(`/scoreboard?type=${type}`),
            api('/scoreboard/graph')
        ]);
        
        container.innerHTML = `
            <div class="container">
                <div class="scoreboard-header" style="text-align: center; margin-bottom: 2rem;">
                    <h1 class="page-title" style="font-size: 2.5rem; margin-bottom: 0.5rem;">🏆 Scoreboard</h1>
                    <p class="text-secondary">Real-time rankings and progress</p>
                </div>
                
                ${data.frozen ? `
                    <div class="frozen-indicator" style="background: linear-gradient(135deg, rgba(100,149,237,0.2), rgba(65,105,225,0.1)); border: 1px solid #6495ed; padding: 1rem; border-radius: 12px; text-align: center; margin-bottom: 1.5rem;">
                        <span style="font-size: 1.5rem;">❄️</span>
                        <span style="color: #6495ed; font-weight: 600; margin-left: 0.5rem;">Scores frozen since ${formatDate(data.freeze_time)}</span>
                    </div>
                ` : ''}
                
                <div class="scoreboard-tabs" style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; justify-content: center;">
                    <button class="scoreboard-tab ${type === 'teams' ? 'active' : ''}" style="padding: 0.75rem 2rem; border-radius: 25px; border: 2px solid ${type === 'teams' ? 'var(--accent)' : 'var(--border)'}; background: ${type === 'teams' ? 'var(--accent)' : 'transparent'}; color: ${type === 'teams' ? '#000' : 'var(--text-primary)'}; cursor: pointer; font-weight: 600; transition: all 0.3s ease;" onclick="navigate('scoreboard'); loadScoreboard('teams')">👥 Teams</button>
                    <button class="scoreboard-tab ${type === 'users' ? 'active' : ''}" style="padding: 0.75rem 2rem; border-radius: 25px; border: 2px solid ${type === 'users' ? 'var(--accent)' : 'var(--border)'}; background: ${type === 'users' ? 'var(--accent)' : 'transparent'}; color: ${type === 'users' ? '#000' : 'var(--text-primary)'}; cursor: pointer; font-weight: 600; transition: all 0.3s ease;" onclick="navigate('scoreboard'); loadScoreboard('users')">🎯 Users</button>
                </div>
                
                <!-- Top 3 Podium -->
                ${data.entries.length >= 3 ? `
                    <div class="podium-section" style="display: flex; justify-content: center; align-items: flex-end; gap: 1rem; margin-bottom: 2rem; padding: 1rem;">
                        <!-- Second Place -->
                        <div class="podium-item" style="text-align: center; width: 180px;">
                            <div class="podium-avatar" style="width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, #c0c0c0, #e8e8e8); display: flex; align-items: center; justify-content: center; margin: 0 auto 0.5rem; font-size: 1.5rem; font-weight: bold; color: #333; border: 3px solid #c0c0c0;">${(data.entries[1].name || data.entries[1].username).charAt(0).toUpperCase()}</div>
                            <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(data.entries[1].name || data.entries[1].username)}</div>
                            <div style="color: #c0c0c0; font-size: 0.9rem; font-weight: 600;">${data.entries[1].score} pts</div>
                            <div class="podium-stand" style="background: linear-gradient(180deg, #c0c0c0, #a0a0a0); height: 80px; margin-top: 0.5rem; border-radius: 8px 8px 0 0; display: flex; align-items: center; justify-content: center;">
                                <span style="font-size: 2rem; color: #fff;">🥈</span>
                            </div>
                        </div>
                        <!-- First Place -->
                        <div class="podium-item" style="text-align: center; width: 200px;">
                            <div class="podium-avatar" style="width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, #ffd700, #ffec8b); display: flex; align-items: center; justify-content: center; margin: 0 auto 0.5rem; font-size: 2rem; font-weight: bold; color: #333; border: 4px solid #ffd700; box-shadow: 0 0 20px rgba(255,215,0,0.5);">${(data.entries[0].name || data.entries[0].username).charAt(0).toUpperCase()}</div>
                            <div style="font-weight: 700; color: #ffd700; font-size: 1.1rem; margin-bottom: 0.25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(data.entries[0].name || data.entries[0].username)}</div>
                            <div style="color: #ffd700; font-size: 1rem; font-weight: 600;">${data.entries[0].score} pts</div>
                            <div class="podium-stand" style="background: linear-gradient(180deg, #ffd700, #daa520); height: 100px; margin-top: 0.5rem; border-radius: 8px 8px 0 0; display: flex; align-items: center; justify-content: center;">
                                <span style="font-size: 2.5rem;">🥇</span>
                            </div>
                        </div>
                        <!-- Third Place -->
                        <div class="podium-item" style="text-align: center; width: 180px;">
                            <div class="podium-avatar" style="width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, #cd7f32, #daa06d); display: flex; align-items: center; justify-content: center; margin: 0 auto 0.5rem; font-size: 1.5rem; font-weight: bold; color: #fff; border: 3px solid #cd7f32;">${(data.entries[2].name || data.entries[2].username).charAt(0).toUpperCase()}</div>
                            <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 0.25rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(data.entries[2].name || data.entries[2].username)}</div>
                            <div style="color: #cd7f32; font-size: 0.9rem; font-weight: 600;">${data.entries[2].score} pts</div>
                            <div class="podium-stand" style="background: linear-gradient(180deg, #cd7f32, #8b4513); height: 60px; margin-top: 0.5rem; border-radius: 8px 8px 0 0; display: flex; align-items: center; justify-content: center;">
                                <span style="font-size: 2rem; color: #fff;">🥉</span>
                            </div>
                        </div>
                    </div>
                ` : ''}
                
                <!-- Score Graph -->
                <div class="card mb-4" style="background: linear-gradient(180deg, var(--bg-secondary), var(--bg-primary)); border: 1px solid var(--border);">
                    <h3 class="card-title mb-3" style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-size: 1.5rem;">📈</span> Top 10 Progress Over Time
                    </h3>
                    <div id="score-graph" class="score-graph-container" style="background: var(--bg-tertiary); border-radius: 8px; padding: 1rem;"></div>
                </div>
                
                <!-- Search -->
                <div style="display: flex; justify-content: flex-end; margin-bottom: 1rem;">
                    <input type="text" id="scoreboard-search" class="form-input" placeholder="🔍 Search..." style="width: 280px; padding: 0.5rem 1rem; border-radius: 20px;" oninput="filterScoreboardTable(this.value)">
                </div>
                
                <!-- Rankings Table -->
                <div class="card" style="overflow: hidden;">
                    <div class="table-container" style="overflow-x: auto;">
                        <table id="scoreboard-table" style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background: linear-gradient(90deg, var(--bg-tertiary), var(--bg-secondary));">
                                    <th style="width: 80px; padding: 1rem; text-align: center; font-weight: 600; color: var(--text-secondary);">Rank</th>
                                    <th style="padding: 1rem; text-align: left; font-weight: 600; color: var(--text-secondary);">${type === 'teams' ? 'Team' : 'User'}</th>
                                    <th style="width: 150px; padding: 1rem; text-align: center; font-weight: 600; color: var(--text-secondary);">Score</th>
                                    <th style="width: 200px; padding: 1rem; text-align: right; font-weight: 600; color: var(--text-secondary);">Last Solve</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.entries.map((e, idx) => `
                                    <tr class="scoreboard-row ${currentUser?.team_id === e.id || currentUser?.id === e.id ? 'highlight-row' : ''}" style="border-bottom: 1px solid var(--border); transition: background 0.2s ease; ${idx < 3 ? 'background: rgba(255,215,0,' + (0.1 - idx * 0.03) + ');' : ''}">
                                        <td style="padding: 1rem; text-align: center;">
                                            ${e.rank === 1 ? '<span style="font-size: 1.5rem;">🥇</span>' : 
                                              e.rank === 2 ? '<span style="font-size: 1.5rem;">🥈</span>' : 
                                              e.rank === 3 ? '<span style="font-size: 1.5rem;">🥉</span>' : 
                                              `<span class="rank-badge rank-default" style="background: var(--bg-tertiary); padding: 0.25rem 0.75rem; border-radius: 20px; font-weight: 600;">${e.rank}</span>`}
                                        </td>
                                        <td style="padding: 1rem;">
                                            <a href="/${type}/${e.id}" onclick="navigate('${type}', {id: ${e.id}}); return false;" class="team-link" style="display: flex; align-items: center; gap: 0.75rem; color: var(--text-primary); text-decoration: none; font-weight: 500;">
                                                <span style="width: 36px; height: 36px; border-radius: 50%; background: ${e.rank <= 3 ? ['linear-gradient(135deg, #ffd700, #ffec8b)', 'linear-gradient(135deg, #c0c0c0, #e8e8e8)', 'linear-gradient(135deg, #cd7f32, #daa06d)'][e.rank-1] : 'var(--bg-tertiary)'}; display: flex; align-items: center; justify-content: center; font-weight: 600; color: ${e.rank <= 3 ? '#333' : 'var(--text-secondary)'};">${(e.name || e.username).charAt(0).toUpperCase()}</span>
                                                <span>${escapeHtml(e.name || e.username)}</span>
                                            </a>
                                            ${type === 'users' && e.team_name ? `<span class="text-muted" style="margin-left: 2.5rem; font-size: 0.85rem;">@ ${escapeHtml(e.team_name)}</span>` : ''}
                                            ${type === 'teams' && e.member_count ? `<span class="text-muted" style="margin-left: 0.5rem; font-size: 0.85rem;">· ${e.member_count} members</span>` : ''}
                                        </td>
                                        <td style="padding: 1rem; text-align: center;">
                                            <span style="font-weight: 700; font-size: 1.1rem; color: var(--accent);">${e.score}</span>
                                            <span style="color: var(--text-muted); font-size: 0.85rem;"> pts</span>
                                        </td>
                                        <td style="padding: 1rem; text-align: right; color: var(--text-muted); font-size: 0.9rem;" title="${e.last_solve ? formatTimeAgo(e.last_solve) : ''}">
                                            ${e.last_solve ? `<span style="color: var(--text-secondary);">${formatDateTime(e.last_solve)}</span>` : '<span style="opacity: 0.5;">No solves</span>'}
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    ${data.entries.length === 0 ? '<p class="text-center text-muted" style="padding: 2rem;">No entries yet</p>' : ''}
                </div>
                ${renderPagination(data.pagination, (page) => `loadScoreboard('${type}', ${page})`)}
            </div>
        `;
        
        // Render score graph
        renderScoreGraph(graphData.graphData);
        
    } catch (err) {
        if (err.message.includes('hidden by admin')) {
            container.innerHTML = `
                <div class="container">
                    <div class="empty-state">
                        <div class="empty-state-icon">🚫</div>
                        <h3>Scoreboard Unavailable</h3>
                        <p>The scoreboard has been hidden by the admin. Please check back later.</p>
                    </div>
                </div>`;
        } else if (err.message.includes('hidden')) {
            container.innerHTML = `<div class="container"><div class="empty-state">🔒 Scoreboard is hidden. Please login to view.</div></div>`;
        } else {
            container.innerHTML = `<div class="container"><div class="empty-state">Failed to load scoreboard</div></div>`;
        }
    }
}

function renderScoreGraph(graphData) {
    const container = document.getElementById('score-graph');
    if (!container || !graphData || graphData.length === 0) {
        if (container) container.innerHTML = '<p class="text-muted text-center">No data to display yet</p>';
        return;
    }
    
    // Simple SVG line chart
    const width = container.offsetWidth - 40;
    const height = 350;
    const padding = { top: 20, right: 120, bottom: 50, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    // Find max score for scaling
    const maxScore = Math.max(...graphData.map(t => t.currentScore || Math.max(...t.timeline.map(p => p.score))));
    const allTimes = graphData.flatMap(t => t.timeline.filter(p => p.time).map(p => new Date(p.time)));
    const minTime = allTimes.length ? Math.min(...allTimes) : Date.now();
    const maxTime = allTimes.length ? Math.max(...allTimes) : Date.now();
    const timeRange = maxTime - minTime || 1;
    
    // Color palette for teams
    const colors = ['#00ff88', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dfe6e9', '#fd79a8', '#a29bfe', '#74b9ff'];
    
    let svg = `<svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}">`;
    
    // Background grid
    svg += `<rect x="${padding.left}" y="${padding.top}" width="${chartWidth}" height="${chartHeight}" fill="var(--bg-tertiary)" rx="4"/>`;
    
    // Y-axis grid lines and score labels
    for (let i = 0; i <= 5; i++) {
        const y = padding.top + (chartHeight * i / 5);
        const score = Math.round(maxScore * (1 - i / 5));
        svg += `<line x1="${padding.left}" y1="${y}" x2="${padding.left + chartWidth}" y2="${y}" stroke="var(--border)" stroke-opacity="0.3"/>`;
        svg += `<text x="${padding.left - 10}" y="${y + 4}" fill="var(--text-muted)" font-size="11" text-anchor="end">${score}</text>`;
    }
    
    // X-axis time labels
    const xSteps = Math.min(6, allTimes.length > 1 ? 6 : 2);
    for (let i = 0; i <= xSteps; i++) {
        const t = new Date(minTime + (timeRange * i / xSteps));
        const x = padding.left + (chartWidth * i / xSteps);
        const hrs = String(t.getHours()).padStart(2, '0');
        const mins = String(t.getMinutes()).padStart(2, '0');
        const mon = t.getMonth() + 1;
        const day = t.getDate();
        svg += `<line x1="${x}" y1="${padding.top}" x2="${x}" y2="${padding.top + chartHeight}" stroke="var(--border)" stroke-opacity="0.15"/>`;
        svg += `<text x="${x}" y="${padding.top + chartHeight + 16}" fill="var(--text-muted)" font-size="10" text-anchor="middle">${hrs}:${mins}</text>`;
        svg += `<text x="${x}" y="${padding.top + chartHeight + 28}" fill="var(--text-muted)" font-size="9" text-anchor="middle">${mon}/${day}</text>`;
    }
    
    // Draw lines for each team
    graphData.forEach((team, idx) => {
        if (team.timeline.length < 2) return;
        
        const color = colors[idx % colors.length];
        let pathD = '';
        
        team.timeline.forEach((point, i) => {
            const x = point.time 
                ? padding.left + ((new Date(point.time) - minTime) / timeRange) * chartWidth
                : padding.left;
            const y = padding.top + chartHeight - (point.score / maxScore) * chartHeight;
            
            if (i === 0) pathD += `M ${x} ${y}`;
            else pathD += ` L ${x} ${y}`;
        });
        
        svg += `<path d="${pathD}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
        
        // End dot
        const lastPoint = team.timeline[team.timeline.length - 1];
        const lastX = lastPoint.time 
            ? padding.left + ((new Date(lastPoint.time) - minTime) / timeRange) * chartWidth
            : padding.left;
        const lastY = padding.top + chartHeight - (lastPoint.score / maxScore) * chartHeight;
        svg += `<circle cx="${lastX}" cy="${lastY}" r="4" fill="${color}"/>`;
    });
    
    // Legend
    graphData.forEach((team, idx) => {
        const color = colors[idx % colors.length];
        const y = padding.top + 20 + idx * 22;
        svg += `<rect x="${width - 110}" y="${y - 8}" width="12" height="12" fill="${color}" rx="2"/>`;
        svg += `<text x="${width - 92}" y="${y + 2}" fill="var(--text-secondary)" font-size="11">${escapeHtml(team.name.substring(0, 12))}</text>`;
    });
    
    svg += '</svg>';
    container.innerHTML = svg;
}

function parseUTCDate(dateStr) {
    // SQLite CURRENT_TIMESTAMP is UTC but without 'Z' indicator
    // Append 'Z' if not present to ensure correct UTC parsing
    if (!dateStr) return null;
    if (dateStr.endsWith('Z') || dateStr.includes('+') || dateStr.includes('-', 10)) {
        return new Date(dateStr);
    }
    return new Date(dateStr + 'Z');
}

function formatTimeAgo(dateStr) {
    const date = parseUTCDate(dateStr);
    if (!date || isNaN(date)) return 'Unknown';
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 0) return 'Just now';
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return formatDate(dateStr);
}

function formatDateTime(dateStr) {
    const date = parseUTCDate(dateStr);
    if (!date || isNaN(date)) return 'Unknown';
    const options = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };
    return date.toLocaleString('en-US', options);
}

async function loadScoreboard(type, page = 1) {
    // Update URL with type parameter
    const url = new URL(window.location);
    url.searchParams.set('type', type);
    window.history.replaceState({}, '', url);
    
    // Re-render scoreboard with new type
    renderScoreboard(document.getElementById('main-content'));
}

function filterScoreboardTable(query) {
    const rows = document.querySelectorAll('#scoreboard-table tbody tr');
    const q = query.toLowerCase();
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(q) ? '' : 'none';
    });
}

async function renderUsers(container) {
    container.innerHTML = `<div class="container"><div class="loading"><div class="spinner"></div></div></div>`;
    
    const page = parseInt(new URLSearchParams(window.location.search).get('page')) || 1;
    const isAdmin = currentUser && currentUser.is_admin;
    const scoreboardHidden = siteConfig.scoreboard_visible === '0' && !isAdmin;
    
    try {
        const data = await api(`/users?page=${page}`);
        
        container.innerHTML = `
            <div class="container">
                <div class="flex flex-between mb-4" style="align-items: center;">
                    <h1>Users</h1>
                    <div style="position: relative;">
                        <input type="text" id="user-search" class="form-input" placeholder="🔍 Search users..." style="width: 250px; padding: 0.5rem 1rem; border-radius: 20px;" oninput="filterUserTable(this.value)">
                    </div>
                </div>
                <div class="card">
                    <div class="table-container">
                        <table id="users-table">
                            <thead>
                                <tr>
                                    <th>S.No</th>
                                    <th>Username</th>
                                    <th>Team</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.users.map((u, i) => `
                                    <tr>
                                        <td>${(page - 1) * 20 + i + 1}</td>
                                        <td>
                                            <a href="/users/${u.id}" onclick="navigate('users', {id: ${u.id}}); return false;">
                                                ${escapeHtml(u.username)}
                                            </a>
                                        </td>
                                        <td>${u.team_name ? escapeHtml(u.team_name) : '-'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
                ${renderPagination(data.pagination, (p) => `loadUsers(${p})`)}
            </div>
        `;
    } catch (err) {
        container.innerHTML = `<div class="container"><div class="empty-state">Failed to load users</div></div>`;
    }
}

function filterUserTable(query) {
    const rows = document.querySelectorAll('#users-table tbody tr');
    const q = query.toLowerCase();
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(q) ? '' : 'none';
    });
}

async function loadUsers(page) {
    history.pushState({}, '', `/users?page=${page}`);
    renderUsers(document.getElementById('main-content'));
}

async function renderUserProfile(container, id) {
    container.innerHTML = `<div class="container"><div class="loading"><div class="spinner"></div></div></div>`;
    
    try {
        const data = await api(`/users/${id}`);
        const u = data.user;
        const isOwnProfile = currentUser && currentUser.id === parseInt(id);
        
        container.innerHTML = `
            <div class="container">
                <div class="profile-card card">
                    <div class="profile-header-main">
                        <div class="profile-avatar-large" style="overflow: hidden;">${u.avatar_url ? `<img src="${u.avatar_url}" style="width: 100%; height: 100%; object-fit: cover;">` : u.username.charAt(0).toUpperCase()}</div>
                        <div class="profile-main-info">
                            <h1 class="profile-username">${escapeHtml(u.username)}</h1>
                            <div class="profile-badges">
                                <span class="badge ${u.play_mode === 'team' ? 'badge-info' : 'badge-success'}">${u.play_mode === 'team' ? '👥 Team Player' : '🎯 Individual'}</span>
                                ${u.country ? `<span class="badge badge-secondary">${escapeHtml(u.country)}</span>` : ''}
                            </div>
                            ${u.bio ? `<p class="profile-bio">${escapeHtml(u.bio)}</p>` : ''}
                            <div class="profile-links">
                                ${u.website ? `<a href="${escapeHtml(u.website)}" target="_blank" class="profile-link">🌐 Website</a>` : ''}
                                ${u.github ? `<a href="https://github.com/${escapeHtml(u.github)}" target="_blank" class="profile-link">💻 GitHub</a>` : ''}
                                ${u.twitter ? `<a href="https://twitter.com/${escapeHtml(u.twitter)}" target="_blank" class="profile-link">🐦 Twitter</a>` : ''}
                            </div>
                        </div>
                        ${isOwnProfile ? `<button class="btn btn-secondary" onclick="showEditProfile()">Edit Profile</button>` : ''}
                    </div>
                    
                    <div class="profile-stats-grid">
                        ${siteConfig.show_rank !== '0' ? `<div class="profile-stat-box">
                            <div class="profile-stat-icon">🏆</div>
                            <div class="profile-stat-value">#${data.rank}</div>
                            <div class="profile-stat-label">Rank</div>
                        </div>` : ''}
                        <div class="profile-stat-box">
                            <div class="profile-stat-icon">⭐</div>
                            <div class="profile-stat-value">${u.score}</div>
                            <div class="profile-stat-label">Points</div>
                        </div>
                        <div class="profile-stat-box">
                            <div class="profile-stat-icon">🚩</div>
                            <div class="profile-stat-value">${data.solves.length}</div>
                            <div class="profile-stat-label">Solves</div>
                        </div>
                        <div class="profile-stat-box">
                            <div class="profile-stat-icon">📅</div>
                            <div class="profile-stat-value">${new Date(u.created_at).toLocaleDateString()}</div>
                            <div class="profile-stat-label">Joined</div>
                        </div>
                    </div>
                </div>
                
                ${u.team_name ? `
                    <div class="card mt-4">
                        <h3 class="card-title">👥 Team</h3>
                        <a href="/teams/${u.team_id}" onclick="navigate('teams', {id: ${u.team_id}}); return false;" class="team-link-card">
                            <span class="team-avatar">${u.team_name.charAt(0).toUpperCase()}</span>
                            <span class="team-name">${escapeHtml(u.team_name)}</span>
                        </a>
                    </div>
                ` : ''}
                
                ${isOwnProfile && currentUser.play_mode === 'individual' ? `
                    <div class="card mt-4">
                        <h3 class="card-title">🎮 Play Mode</h3>
                        <p class="text-secondary mb-3">You're currently playing as an individual. Want to join or create a team?</p>
                        <div class="flex gap-2">
                            <button class="btn btn-primary" onclick="switchToTeamMode()">Switch to Team Mode</button>
                        </div>
                    </div>
                ` : ''}
                
                ${isOwnProfile ? `
                    <div class="card mt-4" style="border: 1px solid rgba(255,71,87,0.3);">
                        <h3 class="card-title" style="color: #ff4757;">⚠️ Danger Zone</h3>
                        <p class="text-secondary mb-3">Permanently delete your account and all associated data. This action cannot be undone.</p>
                        <button class="btn" style="background: #ff4757; color: white;" onclick="confirmDeleteAccount()">🗑️ Delete My Account</button>
                    </div>
                ` : ''}
                
                ${data.timeline.length > 1 ? `
                    <div class="card mt-4">
                        <h3 class="card-title">📈 Score Progress</h3>
                        <div class="score-chart" id="score-chart"></div>
                    </div>
                ` : ''}
                
                <div class="card mt-4">
                    <h3 class="card-title">🚩 Solved Challenges (${data.solves.length})</h3>
                    ${data.solves.length > 0 ? `
                        <div class="solves-grid">
                            ${data.solves.map(s => `
                                <div class="solve-item">
                                    <div class="solve-category">${s.category}</div>
                                    <div class="solve-title">${escapeHtml(s.title)}</div>
                                    <div class="solve-meta">
                                        <span class="solve-points">+${s.points}</span>
                                        <span class="solve-time" title="${formatTimeAgo(s.submitted_at)}">${formatDateTime(s.submitted_at)}</span>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p class="text-muted" style="padding: 1rem;">No solves yet</p>'}
                </div>
            </div>
        `;
        
        // Render score chart if timeline exists
        if (data.timeline.length > 1) {
            renderScoreChart(data.timeline);
        }
    } catch (err) {
        container.innerHTML = `<div class="container"><div class="empty-state">User not found</div></div>`;
    }
}

async function confirmDeleteAccount() {
    if (!confirm('Are you sure you want to delete your account? This action is permanent and cannot be undone.')) return;
    
    const password = prompt('Enter your password to confirm account deletion:');
    if (!password) return;
    
    try {
        await api('/auth/delete-account', { method: 'DELETE', body: { password } });
        showToast('Account deleted successfully', 'success');
        currentUser = null;
        updateAuthUI();
        navigate('home');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function renderScoreChart(timeline) {
    const chart = document.getElementById('score-chart');
    if (!chart || timeline.length < 2) return;
    
    const maxScore = Math.max(...timeline.map(t => t.score));
    const width = chart.offsetWidth;
    const height = 180;
    const padLeft = 50, padRight = 20, padTop = 15, padBottom = 40;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;
    
    let svg = `<svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" style="overflow: visible;">`;
    
    // Y-axis labels (score)
    const ySteps = 4;
    for (let i = 0; i <= ySteps; i++) {
        const val = Math.round((maxScore / ySteps) * i);
        const y = padTop + plotH - (plotH * i / ySteps);
        svg += `<line x1="${padLeft}" y1="${y}" x2="${width - padRight}" y2="${y}" stroke="var(--border)" stroke-width="0.5" stroke-dasharray="4"/>`;
        svg += `<text x="${padLeft - 8}" y="${y + 4}" text-anchor="end" fill="var(--text-muted)" font-size="10">${val}</text>`;
    }
    
    // Draw line
    const points = timeline.map((t, i) => {
        const x = padLeft + (i / (timeline.length - 1)) * plotW;
        const y = padTop + plotH - ((t.score / maxScore) * plotH);
        return `${x},${y}`;
    }).join(' ');
    
    // Gradient fill under line
    const firstX = padLeft;
    const lastX = padLeft + plotW;
    svg += `<defs><linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--accent)" stop-opacity="0.3"/><stop offset="100%" stop-color="var(--accent)" stop-opacity="0.02"/></linearGradient></defs>`;
    svg += `<polygon fill="url(#chartGrad)" points="${firstX},${padTop + plotH} ${points} ${lastX},${padTop + plotH}"/>`;
    svg += `<polyline fill="none" stroke="var(--accent)" stroke-width="2" points="${points}"/>`;
    
    // Draw points and x-axis time labels
    const labelInterval = Math.max(1, Math.floor(timeline.length / 5));
    timeline.forEach((t, i) => {
        const x = padLeft + (i / (timeline.length - 1)) * plotW;
        const y = padTop + plotH - ((t.score / maxScore) * plotH);
        svg += `<circle cx="${x}" cy="${y}" r="4" fill="var(--accent)"/>`;
        
        // X-axis time labels at intervals
        if (i % labelInterval === 0 || i === timeline.length - 1) {
            const d = new Date(t.time || t.submitted_at);
            const label = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
            const dateLabel = `${d.getMonth()+1}/${d.getDate()}`;
            svg += `<text x="${x}" y="${padTop + plotH + 16}" text-anchor="middle" fill="var(--text-muted)" font-size="9">${label}</text>`;
            svg += `<text x="${x}" y="${padTop + plotH + 28}" text-anchor="middle" fill="var(--text-muted)" font-size="8">${dateLabel}</text>`;
        }
    });
    
    svg += '</svg>';
    chart.innerHTML = svg;
}

function showEditProfile() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h2 class="modal-title">Edit Profile</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <form onsubmit="saveProfile(event)" id="profile-form">
                    <div class="form-group" style="text-align: center; margin-bottom: 1.5rem;">
                        <label class="form-label">Profile Picture</label>
                        <div style="display: flex; flex-direction: column; align-items: center; gap: 0.75rem;">
                            <div id="avatar-preview" style="width: 80px; height: 80px; border-radius: 50%; background: var(--accent); display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: bold; color: #000; overflow: hidden;">
                                ${currentUser.username.charAt(0).toUpperCase()}
                            </div>
                            <div style="display: flex; gap: 0.5rem;">
                                <label class="btn btn-secondary btn-small" style="cursor: pointer;">
                                    📷 Upload Photo
                                    <input type="file" id="avatar-file" accept=".png,.jpg,.jpeg,.gif,.webp" style="display: none;" onchange="uploadAvatar(this)">
                                </label>
                                <button type="button" class="btn btn-small" id="remove-avatar-btn" style="background: #ff4757; color: white; display: none;" onclick="removeAvatar()">✕ Remove</button>
                            </div>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Bio</label>
                        <textarea name="bio" class="form-input" rows="3" placeholder="Tell us about yourself..."></textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Country</label>
                        <input type="text" name="country" class="form-input" placeholder="e.g., India, USA">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Website</label>
                        <input type="url" name="website" class="form-input" placeholder="https://yoursite.com">
                    </div>
                    <div class="form-group">
                        <label class="form-label">GitHub Username</label>
                        <input type="text" name="github" class="form-input" placeholder="username">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Twitter Username</label>
                        <input type="text" name="twitter" class="form-input" placeholder="username">
                    </div>
                    <button type="submit" class="btn btn-primary">Save Profile</button>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Load current profile data
    loadProfileData();
}

async function loadProfileData() {
    try {
        const data = await api(`/users/${currentUser.id}`);
        const form = document.getElementById('profile-form');
        if (form && data.user) {
            form.bio.value = data.user.bio || '';
            form.country.value = data.user.country || '';
            form.website.value = data.user.website || '';
            form.github.value = data.user.github || '';
            form.twitter.value = data.user.twitter || '';
            const preview = document.getElementById('avatar-preview');
            const removeBtn = document.getElementById('remove-avatar-btn');
            if (preview && data.user.avatar_url) {
                preview.innerHTML = `<img src="${data.user.avatar_url}" style="width: 100%; height: 100%; object-fit: cover;">`;
                if (removeBtn) removeBtn.style.display = 'inline-flex';
            }
        }
    } catch (err) {}
}

async function removeAvatar() {
    try {
        await api('/users/avatar', { method: 'DELETE' });
        const preview = document.getElementById('avatar-preview');
        if (preview) preview.innerHTML = currentUser.username.charAt(0).toUpperCase();
        const removeBtn = document.getElementById('remove-avatar-btn');
        if (removeBtn) removeBtn.style.display = 'none';
        showToast('Avatar removed!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function uploadAvatar(input) {
    if (!input.files || !input.files[0]) return;
    const formData = new FormData();
    formData.append('avatar', input.files[0]);
    
    try {
        const res = await fetch('/api/users/avatar', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        
        const preview = document.getElementById('avatar-preview');
        if (preview) preview.innerHTML = `<img src="${data.avatar_url}" style="width: 100%; height: 100%; object-fit: cover;">`;
        showToast('Avatar uploaded!', 'success');
    } catch (err) {
        showToast(err.message || 'Upload failed', 'error');
    }
}

async function uploadTeamAvatar(input, teamId) {
    if (!input.files || !input.files[0]) return;
    const formData = new FormData();
    formData.append('avatar', input.files[0]);
    
    try {
        const res = await fetch(`/api/teams/${teamId}/avatar`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        
        showToast('Team avatar uploaded!', 'success');
        renderTeamProfile(document.getElementById('main-content'), teamId);
    } catch (err) {
        showToast(err.message || 'Upload failed', 'error');
    }
}

async function removeTeamAvatar(teamId) {
    try {
        await api(`/teams/${teamId}/avatar`, { method: 'DELETE' });
        showToast('Team avatar removed!', 'success');
        renderTeamProfile(document.getElementById('main-content'), teamId);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function saveProfile(e) {
    e.preventDefault();
    const form = e.target;
    
    try {
        await api('/users/profile', {
            method: 'PUT',
            body: {
                bio: form.bio.value,
                country: form.country.value,
                website: form.website.value,
                github: form.github.value,
                twitter: form.twitter.value
            }
        });
        showToast('Profile updated!', 'success');
        document.querySelector('.modal-overlay').remove();
        renderUserProfile(document.getElementById('main-content'), currentUser.id);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function switchToTeamMode() {
    try {
        await api('/users/play-mode', {
            method: 'POST',
            body: { mode: 'team' }
        });
        currentUser.play_mode = 'team';
        showToast('Switched to team mode! You can now create or join a team.', 'success');
        navigate('teams');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function renderTeams(container) {
    container.innerHTML = `<div class="container"><div class="loading"><div class="spinner"></div></div></div>`;
    
    const page = parseInt(new URLSearchParams(window.location.search).get('page')) || 1;
    const joinCode = new URLSearchParams(window.location.search).get('join');
    
    // Handle join code in URL
    if (joinCode && currentUser && !currentUser.team_id) {
        if (currentUser.play_mode !== 'team') {
            // Auto-switch to team mode and join
            try {
                await api('/users/play-mode', { method: 'POST', body: { mode: 'team' } });
                currentUser.play_mode = 'team';
            } catch (err) {}
        }
        showJoinTeamWithCode(joinCode);
    }
    
    try {
        const data = await api(`/teams?page=${page}`);
        
        let teamActions = '';
        if (currentUser && !currentUser.team_id) {
            if (currentUser.play_mode === 'team') {
                teamActions = `
                    <div class="flex gap-2">
                        <button class="btn btn-primary" onclick="showCreateTeam()">Create Team</button>
                        <button class="btn btn-secondary" onclick="showJoinTeam()">Join Team</button>
                    </div>
                `;
            } else {
                teamActions = `
                    <div class="flex gap-2 flex-center">
                        <span class="text-muted">Playing individually</span>
                        <button class="btn btn-secondary btn-small" onclick="switchToTeamMode()">Switch to Team Mode</button>
                    </div>
                `;
            }
        } else if (currentUser && currentUser.team_id) {
            teamActions = `
                <div class="flex gap-2">
                    <a href="/teams/${currentUser.team_id}" onclick="navigate('teams', {id: ${currentUser.team_id}}); return false;" class="btn btn-primary">View My Team</a>
                    <button class="btn btn-danger btn-small" onclick="leaveTeam()">Leave Team</button>
                </div>
            `;
        }
        
        container.innerHTML = `
            <div class="container">
                <div class="flex flex-between mb-4" style="align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <h1>Teams</h1>
                    <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
                        <div style="position: relative;">
                            <input type="text" id="team-search" class="form-input" placeholder="🔍 Search teams..." style="width: 250px; padding: 0.5rem 1rem; border-radius: 20px;" oninput="filterTeamTable(this.value)">
                        </div>
                        ${teamActions}
                    </div>
                </div>
                <div class="card">
                    <div class="table-container">
                        <table id="teams-table">
                            <thead>
                                <tr>
                                    <th>S.No</th>
                                    <th>Team Name</th>
                                    <th>Members</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${data.teams.map((t, i) => `
                                    <tr class="${currentUser && currentUser.team_id === t.id ? 'highlight-row' : ''}">
                                        <td>${(page - 1) * 20 + i + 1}</td>
                                        <td>
                                            <a href="/teams/${t.id}" onclick="navigate('teams', {id: ${t.id}}); return false;">
                                                ${escapeHtml(t.name)}
                                            </a>
                                            ${currentUser && currentUser.team_id === t.id ? '<span class="badge badge-success" style="margin-left: 0.5rem;">Your Team</span>' : ''}
                                        </td>
                                        <td>${t.member_count}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                    ${data.teams.length === 0 ? '<p class="text-center text-muted" style="padding: 2rem;">No teams yet. Be the first to create one!</p>' : ''}
                </div>
                ${renderPagination(data.pagination, (p) => `loadTeams(${p})`)}
            </div>
        `;
    } catch (err) {
        container.innerHTML = `<div class="container"><div class="empty-state">Failed to load teams</div></div>`;
    }
}

async function loadTeams(page) {
    history.pushState({}, '', `/teams?page=${page}`);
    renderTeams(document.getElementById('main-content'));
}

function filterTeamTable(query) {
    const rows = document.querySelectorAll('#teams-table tbody tr');
    const q = query.toLowerCase();
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(q) ? '' : 'none';
    });
}

async function renderTeamProfile(container, id) {
    container.innerHTML = `<div class="container"><div class="loading"><div class="spinner"></div></div></div>`;
    
    try {
        const data = await api(`/teams/${id}`);
        const t = data.team;
        const isOwnTeam = currentUser && currentUser.team_id === parseInt(id);
        
        container.innerHTML = `
            <div class="container">
                <div class="profile-card card">
                    <div class="profile-header-main">
                        <div class="profile-avatar-large team-avatar-large" style="overflow: hidden;">${t.avatar_url ? `<img src="${t.avatar_url}" style="width: 100%; height: 100%; object-fit: cover;">` : t.name.charAt(0).toUpperCase()}</div>
                        <div class="profile-main-info">
                            <h1 class="profile-username">${escapeHtml(t.name)}</h1>
                            <div class="profile-badges">
                                <span class="badge badge-info">👥 ${data.members.length} Members</span>
                                <span class="badge badge-secondary">Created ${new Date(t.created_at).toLocaleDateString()}</span>
                            </div>
                            <p class="text-secondary">Captain: <strong>${escapeHtml(t.captain_name)}</strong> 👑</p>
                        </div>
                        ${isOwnTeam ? `
                            <div style="display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-end;">
                                <div class="flex gap-2">
                                    <button class="btn btn-warning btn-small" onclick="leaveTeam()">Leave Team</button>
                                    ${data.is_captain ? `<button class="btn btn-danger btn-small" onclick="deleteTeamAsCaptain(${t.id}, '${escapeHtml(t.name).replace(/'/g, "\\'")}')">Delete Team</button>` : ''}
                                </div>
                                ${data.is_captain ? `
                                    <div style="display: flex; gap: 0.5rem;">
                                        <label class="btn btn-secondary btn-small" style="cursor: pointer;">
                                            📷 Team Photo
                                            <input type="file" accept=".png,.jpg,.jpeg,.gif,.webp" style="display: none;" onchange="uploadTeamAvatar(this, ${t.id})">
                                        </label>
                                        ${t.avatar_url ? `<button class="btn btn-small" style="background: #ff4757; color: white;" onclick="removeTeamAvatar(${t.id})">✕ Remove</button>` : ''}
                                    </div>
                                ` : ''}
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="profile-stats-grid">
                        ${siteConfig.show_rank !== '0' ? `<div class="profile-stat-box">
                            <div class="profile-stat-icon">🏆</div>
                            <div class="profile-stat-value">#${data.rank}</div>
                            <div class="profile-stat-label">Rank</div>
                        </div>` : ''}
                        <div class="profile-stat-box">
                            <div class="profile-stat-icon">⭐</div>
                            <div class="profile-stat-value">${t.score}</div>
                            <div class="profile-stat-label">Points</div>
                        </div>
                        <div class="profile-stat-box">
                            <div class="profile-stat-icon">👥</div>
                            <div class="profile-stat-value">${data.members.length}</div>
                            <div class="profile-stat-label">Members</div>
                        </div>
                        <div class="profile-stat-box">
                            <div class="profile-stat-icon">🚩</div>
                            <div class="profile-stat-value">${data.solves.length}</div>
                            <div class="profile-stat-label">Solves</div>
                        </div>
                    </div>
                </div>
                
                ${data.is_member && data.invite_code ? `
                    <div class="card mt-4 invite-card">
                        <h3 class="card-title">🔗 Invite Link</h3>
                        <p class="text-secondary mb-3">Share this code with friends to invite them to your team:</p>
                        <div class="invite-code-box">
                            <code class="invite-code mono">${data.invite_code}</code>
                            <button class="btn btn-secondary btn-small" onclick="copyInviteCode('${data.invite_code}')">📋 Copy</button>
                        </div>
                        <div class="invite-link-box mt-3">
                            <input type="text" class="form-input mono" value="${window.location.origin}/teams?join=${data.invite_code}" readonly id="invite-link">
                            <button class="btn btn-secondary btn-small" onclick="copyInviteLink()">📋 Copy Link</button>
                        </div>
                        ${data.is_captain ? `
                            <button class="btn btn-ghost btn-small mt-3" onclick="regenerateInviteCode(${t.id})">🔄 Regenerate Code</button>
                        ` : ''}
                    </div>
                ` : ''}
                
                <div class="card mt-4">
                    <h3 class="card-title">👥 Team Members</h3>
                    <div class="team-members-grid">
                        ${data.members.map(m => `
                            <div class="team-member-card">
                                <div class="member-avatar">${m.username.charAt(0).toUpperCase()}</div>
                                <div class="member-info">
                                    <a href="/users/${m.id}" onclick="navigate('users', {id: ${m.id}}); return false;" class="member-name">
                                        ${escapeHtml(m.username)}
                                        ${m.id === t.captain_id ? '<span class="captain-badge">👑 Captain</span>' : ''}
                                    </a>
                                    <div class="member-score">${m.score} pts</div>
                                </div>
                                ${data.is_captain && m.id !== currentUser.id ? `
                                    <div class="member-actions">
                                        <button class="btn btn-ghost btn-small" onclick="transferCaptain(${t.id}, ${m.id}, '${escapeHtml(m.username)}')" title="Make Captain">👑</button>
                                        <button class="btn btn-ghost btn-small text-danger" onclick="kickMember(${t.id}, ${m.id}, '${escapeHtml(m.username)}')" title="Kick">✕</button>
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="card mt-4">
                    <h3 class="card-title">🚩 Team Solves (${data.solves.length})</h3>
                    ${data.solves.length > 0 ? `
                        <div class="solves-grid">
                            ${data.solves.map(s => `
                                <div class="solve-item">
                                    <div class="solve-category">${s.category}</div>
                                    <div class="solve-title">${escapeHtml(s.title)}</div>
                                    <div class="solve-meta">
                                        <span class="solve-points">+${s.points}</span>
                                        ${s.solved_by ? `<span class="solve-solver">by ${escapeHtml(s.solved_by)}</span>` : ''}
                                    </div>
                                    <div class="solve-timestamp" style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem;">
                                        ${s.submitted_at ? formatDateTime(s.submitted_at) : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p class="text-muted" style="padding: 1rem;">No solves yet. Start solving challenges!</p>'}
                </div>
            </div>
        `;
        
        // Check for join code in URL
        const urlParams = new URLSearchParams(window.location.search);
        const joinCode = urlParams.get('join');
        if (joinCode && !currentUser?.team_id) {
            showJoinTeamWithCode(joinCode);
        }
    } catch (err) {
        container.innerHTML = `<div class="container"><div class="empty-state">Team not found</div></div>`;
    }
}

function copyInviteCode(code) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(() => {
            showToast('Invite code copied!', 'success');
        }).catch(() => {
            fallbackCopy(code);
        });
    } else {
        fallbackCopy(code);
    }
}

function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        showToast('Copied!', 'success');
    } catch (err) {
        showToast('Failed to copy', 'error');
    }
    document.body.removeChild(textarea);
}

function copyInviteLink() {
    const input = document.getElementById('invite-link');
    const text = input.value;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Invite link copied!', 'success');
        }).catch(() => {
            fallbackCopy(text);
        });
    } else {
        fallbackCopy(text);
    }
}

async function regenerateInviteCode(teamId) {
    if (!confirm('Regenerate invite code? The old code will stop working.')) return;
    
    try {
        const data = await api(`/teams/${teamId}/regenerate-invite`, { method: 'POST' });
        showToast('New invite code generated!', 'success');
        navigate('teams', { id: teamId });
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function transferCaptain(teamId, userId, username) {
    if (!confirm(`Transfer captain role to ${username}? You will no longer be the captain.`)) return;
    
    try {
        await api(`/teams/${teamId}/transfer-captain`, {
            method: 'POST',
            body: { new_captain_id: userId }
        });
        showToast(`${username} is now the captain!`, 'success');
        navigate('teams', { id: teamId });
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function kickMember(teamId, userId, username) {
    if (!confirm(`Remove ${username} from the team?`)) return;
    
    try {
        await api(`/teams/${teamId}/kick`, {
            method: 'POST',
            body: { user_id: userId }
        });
        showToast(`${username} has been removed from the team`, 'success');
        navigate('teams', { id: teamId });
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function showJoinTeamWithCode(code) {
    if (!currentUser) {
        showToast('Please login to join a team', 'info');
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h2 class="modal-title">Join Team</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <p class="mb-3">You've been invited to join a team!</p>
                <form onsubmit="joinTeamFromModal(event)">
                    <div class="form-group">
                        <label class="form-label">Invite Code</label>
                        <input type="text" name="invite_code" class="form-input mono" value="${code}" required>
                    </div>
                    <button type="submit" class="btn btn-primary">Join Team</button>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

async function joinTeamFromModal(e) {
    e.preventDefault();
    const form = e.target;
    
    try {
        const data = await api('/teams/join', {
            method: 'POST',
            body: { invite_code: form.invite_code.value }
        });
        
        currentUser.team_id = data.team.id;
        showToast(`Joined ${data.team.name}!`, 'success');
        document.querySelector('.modal-overlay').remove();
        
        // Clear URL params and navigate to team
        history.replaceState({}, '', '/teams/' + data.team.id);
        navigate('teams', { id: data.team.id });
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function showCreateTeam() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h2 class="modal-title">Create Team</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <form onsubmit="createTeam(event)">
                    <div class="form-group">
                        <label class="form-label">Team Name</label>
                        <input type="text" name="name" class="form-input" required minlength="3">
                    </div>
                    <button type="submit" class="btn btn-primary">Create Team</button>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

async function createTeam(e) {
    e.preventDefault();
    const form = e.target;
    
    try {
        const data = await api('/teams', {
            method: 'POST',
            body: { name: form.name.value }
        });
        
        currentUser.team_id = data.team.id;
        showToast(`Team created! Invite code: ${data.team.invite_code}`, 'success');
        document.querySelector('.modal-overlay').remove();
        renderTeams(document.getElementById('main-content'));
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function showJoinTeam() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h2 class="modal-title">Join Team</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <form onsubmit="joinTeam(event)">
                    <div class="form-group">
                        <label class="form-label">Invite Code</label>
                        <input type="text" name="invite_code" class="form-input mono" required>
                    </div>
                    <button type="submit" class="btn btn-primary">Join Team</button>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

async function joinTeam(e) {
    e.preventDefault();
    const form = e.target;
    
    try {
        const data = await api('/teams/join', {
            method: 'POST',
            body: { invite_code: form.invite_code.value }
        });
        
        currentUser.team_id = data.team.id;
        showToast(`Joined ${data.team.name}!`, 'success');
        document.querySelector('.modal-overlay').remove();
        renderTeams(document.getElementById('main-content'));
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function leaveTeam() {
    if (!confirm('Are you sure you want to leave your team?')) return;
    
    try {
        await api('/teams/leave', { method: 'POST' });
        currentUser.team_id = null;
        showToast('Left team', 'info');
        renderTeams(document.getElementById('main-content'));
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteTeamAsCaptain(teamId, teamName) {
    if (!confirm(`⚠️ Are you sure you want to DELETE team "${teamName}"?\n\nThis will remove all members and cannot be undone!`)) return;
    
    try {
        const res = await fetch(`/api/teams/${teamId}`, { 
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        
        if (!res.ok) {
            throw new Error(data.error || 'Failed to delete team');
        }
        
        currentUser.team_id = null;
        showToast('Team deleted successfully', 'success');
        navigate('teams');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Admin Panel
async function renderAdmin(container) {
    if (!currentUser || !currentUser.is_admin) {
        container.innerHTML = `<div class="container"><div class="empty-state">Access Denied</div></div>`;
        return;
    }
    
    container.innerHTML = `
        <div class="admin-layout">
            <aside class="admin-sidebar">
                <nav class="admin-nav">
                    <a class="admin-nav-item active" onclick="loadAdminSection('dashboard')">📊 Dashboard</a>
                    <a class="admin-nav-item" onclick="loadAdminSection('challenges')">🚩 Challenges</a>
                    <a class="admin-nav-item" onclick="loadAdminSection('waves')">🌊 Waves</a>
                    <a class="admin-nav-item" onclick="loadAdminSection('users')">👥 Users</a>
                    <a class="admin-nav-item" onclick="loadAdminSection('teams')">🏆 Teams</a>
                    <a class="admin-nav-item" onclick="loadAdminSection('notifications')">📢 Notifications</a>
                    <a class="admin-nav-item" onclick="loadAdminSection('branding')">✏️ Branding</a>
                    <a class="admin-nav-item" onclick="loadAdminSection('theme')">🎨 Theme</a>
                    <a class="admin-nav-item" onclick="loadAdminSection('pages')">📄 Page Editor</a>
                    <a class="admin-nav-item" onclick="loadAdminSection('event-pages')">🎭 Event Pages</a>
                    <a class="admin-nav-item" onclick="loadAdminSection('opening-timer')">🚀 Opening Timer</a>
                    <a class="admin-nav-item" onclick="loadAdminSection('running-timer')">🔥 Running Timer</a>
                    <a class="admin-nav-item" onclick="loadAdminSection('config')">⚙️ Settings</a>
                </nav>
            </aside>
            <div class="admin-content" id="admin-content">
                <div class="loading"><div class="spinner"></div></div>
            </div>
        </div>
    `;
    
    loadAdminSection('dashboard');
}

async function loadAdminSection(section) {
    const content = document.getElementById('admin-content');
    document.querySelectorAll('.admin-nav-item').forEach(a => a.classList.remove('active'));
    event?.target?.classList.add('active');
    
    content.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    
    try {
        switch (section) {
            case 'dashboard': await renderAdminDashboard(content); break;
            case 'challenges': await renderAdminChallenges(content); break;
            case 'waves': await renderAdminWaves(content); break;
            case 'users': await renderAdminUsers(content); break;
            case 'teams': await renderAdminTeams(content); break;
            case 'notifications': await renderAdminNotifications(content); break;
            case 'branding': await renderAdminBranding(content); break;
            case 'theme': await renderAdminTheme(content); break;
            case 'pages': await renderAdminPageEditor(content); break;
            case 'event-pages': await renderAdminEventPages(content); break;
            case 'opening-timer': await renderAdminOpeningTimer(content); break;
            case 'running-timer': await renderAdminRunningTimer(content); break;
            case 'config': await renderAdminConfig(content); break;
        }
    } catch (err) {
        content.innerHTML = `<div class="empty-state">Error loading section</div>`;
    }
}

async function renderAdminDashboard(content) {
    const stats = await api('/admin/stats');
    
    content.innerHTML = `
        <h1 class="mb-4">Dashboard</h1>
        <div class="grid grid-4 mb-4">
            <div class="card stat-card">
                <div class="stat-value">${stats.users}</div>
                <div class="stat-label">Users</div>
            </div>
            <div class="card stat-card">
                <div class="stat-value">${stats.teams}</div>
                <div class="stat-label">Teams</div>
            </div>
            <div class="card stat-card">
                <div class="stat-value">${stats.challenges}</div>
                <div class="stat-label">Challenges</div>
            </div>
            <div class="card stat-card">
                <div class="stat-value">${stats.correct_submissions}</div>
                <div class="stat-label">Correct Submissions</div>
            </div>
        </div>
        
        <div class="card mb-4">
            <h3 class="card-title mb-3">📥 Export Data</h3>
            <p class="text-muted mb-3">Download live data as CSV files</p>
            <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                <a href="/api/admin/export/users" class="btn btn-secondary" download>👤 Users Data</a>
                <a href="/api/admin/export/teams" class="btn btn-secondary" download>👥 Teams Data</a>
                <a href="/api/admin/export/scoreboard" class="btn btn-secondary" download>🏆 Scoreboard Data</a>
            </div>
        </div>
        
        <div class="card" style="border: 1px solid var(--danger); background: rgba(255, 71, 87, 0.05);">
            <h3 class="card-title mb-3" style="color: var(--danger);">🔄 Refresh Database</h3>
            <p class="text-muted mb-3">Clear all users, teams, submissions and scoreboard data. Keeps admin account and challenges intact. Use this to start a fresh event.</p>
            <button class="btn btn-danger" onclick="refreshDatabase()">⚠️ Refresh Database</button>
        </div>
    `;
}

async function refreshDatabase() {
    if (!confirm('⚠️ WARNING: This will delete ALL users, teams, submissions and scoreboard data.\\n\\nOnly admin account and challenges will be preserved.\\n\\nAre you sure?')) return;
    if (!confirm('This action CANNOT be undone. Click OK to proceed.')) return;
    
    try {
        const data = await api('/admin/refresh-db', { method: 'POST' });
        showToast(data.message, 'success');
        loadAdminSection('dashboard');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function renderAdminChallenges(content) {
    const data = await api('/admin/challenges');
    
    content.innerHTML = `
        <div class="admin-header">
            <h1>Challenges</h1>
            <button class="btn btn-primary" onclick="showChallengeForm()">+ Add Challenge</button>
        </div>
        <div class="card">
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>Category</th>
                            <th>Points</th>
                            <th>Solves</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.challenges.map(c => `
                            <tr>
                                <td>${escapeHtml(c.title)}</td>
                                <td>${c.category}</td>
                                <td>${c.points}</td>
                                <td>${c.solves}</td>
                                <td>
                                    <span class="badge ${c.is_hidden ? 'badge-warning' : 'badge-success'}">
                                        ${c.is_hidden ? 'Hidden' : 'Visible'}
                                    </span>
                                </td>
                                <td>
                                    <button class="btn btn-small btn-secondary" onclick='showChallengeForm(${JSON.stringify(c).replace(/'/g, "&#39;")})'>Edit</button>
                                    <button class="btn btn-small btn-danger" onclick="deleteChallenge(${c.id})">Delete</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function showChallengeForm(challenge = null) {
    const categories = (siteConfig.categories || 'Crypto,Web,Forensics,Pwn,Reversing,Misc,OSINT').split(',').map(c => c.trim());
    
    // Parse existing extra files/links
    let extraFiles = [];
    let extraLinks = [];
    try { extraFiles = JSON.parse(challenge?.extra_files || '[]'); } catch(e) {}
    try { extraLinks = JSON.parse(challenge?.extra_links || '[]'); } catch(e) {}
    
    // Get configured waves
    let configuredWaves = [];
    try { configuredWaves = JSON.parse(siteConfig.configured_waves || '[]'); } catch(e) {}
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    
    modal.innerHTML = `
        <div class="modal modal-lg">
            <div class="modal-header">
                <h2 class="modal-title">${challenge ? 'Edit' : 'Add'} Challenge</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
            </div>
            <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
                <form id="challenge-form" onsubmit="saveChallenge(event, ${challenge ? challenge.id : 'null'})">
                    <div class="grid grid-2" style="gap: 1rem;">
                        <div class="form-group">
                            <label class="form-label">Title *</label>
                            <input type="text" name="title" class="form-input" value="${challenge ? escapeHtml(challenge.title) : ''}" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Category *</label>
                            <select name="category" class="form-input" required>
                                ${categories.map(cat => `<option value="${cat}" ${challenge?.category === cat ? 'selected' : ''}>${cat}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="grid grid-3" style="gap: 1rem;">
                        <div class="form-group">
                            <label class="form-label">Points *</label>
                            <input type="number" name="points" class="form-input" value="${challenge ? challenge.points : 100}" required min="0">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Max Attempts</label>
                            <input type="number" name="max_attempts" class="form-input" value="${challenge?.max_attempts || 0}" min="0" placeholder="0 = unlimited">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Hint Cost</label>
                            <input type="number" name="hint_cost" class="form-input" value="${challenge?.hint_cost || 0}" min="0">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Description * (Markdown supported)</label>
                        <textarea name="description" class="form-input" rows="5" required style="font-family: monospace;">${challenge ? escapeHtml(challenge.description) : ''}</textarea>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Challenge Links</label>
                        <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;">
                            <input type="url" name="link_url" class="form-input" value="${challenge?.link_url || ''}" placeholder="Primary link (https://...)">
                        </div>
                        <div id="extra-links-container">
                            ${extraLinks.map((l, i) => `
                                <div class="extra-link-row" style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;">
                                    <input type="url" class="form-input extra-link-input" value="${escapeHtml(l.url || '')}" placeholder="Additional link URL">
                                    <input type="text" class="form-input extra-link-label" value="${escapeHtml(l.label || '')}" placeholder="Label" style="max-width: 150px;">
                                    <button type="button" class="btn btn-danger btn-small" onclick="this.parentElement.remove()">✕</button>
                                </div>
                            `).join('')}
                        </div>
                        <button type="button" class="btn btn-secondary btn-small" onclick="addExtraLink()">+ Add Link</button>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Flag *</label>
                        <input type="text" name="flag" class="form-input mono" value="${challenge ? escapeHtml(challenge.flag) : ''}" required placeholder="flag{...}">
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Challenge Files</label>
                        <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;">
                            <input type="text" name="file_url" id="file_url_input" class="form-input" value="${challenge?.file_url || ''}" placeholder="Primary file URL or upload">
                            <label class="btn btn-secondary" style="cursor: pointer; white-space: nowrap;">
                                Upload
                                <input type="file" id="challenge_file" style="display: none;" onchange="uploadChallengeFile(this)">
                            </label>
                        </div>
                        <div id="extra-files-container">
                            ${extraFiles.map((f, i) => `
                                <div class="extra-file-row" style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;">
                                    <input type="text" class="form-input extra-file-input" value="${escapeHtml(f.url || '')}" placeholder="File URL or upload">
                                    <input type="text" class="form-input extra-file-label" value="${escapeHtml(f.label || '')}" placeholder="Label" style="max-width: 150px;">
                                    <label class="btn btn-secondary btn-small" style="cursor: pointer; white-space: nowrap;">
                                        📎
                                        <input type="file" style="display: none;" onchange="uploadExtraFile(this)">
                                    </label>
                                    <button type="button" class="btn btn-danger btn-small" onclick="this.parentElement.remove()">✕</button>
                                </div>
                            `).join('')}
                        </div>
                        <button type="button" class="btn btn-secondary btn-small" onclick="addExtraFile()">+ Add File</button>
                        <br><small class="text-muted">Supported: images, documents, archives, scripts, binaries & more (max 1GB each)</small>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Hint</label>
                        <input type="text" name="hint" class="form-input" value="${challenge?.hint || ''}" placeholder="Optional hint for players">
                    </div>
                    <div class="grid grid-2" style="gap: 1rem;">
                        <div class="form-group">
                            <label class="form-label">Author</label>
                            <input type="text" name="author" class="form-input" value="${challenge?.author || ''}" placeholder="Challenge author name">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Wave</label>
                            <select name="wave" class="form-input">
                                <option value="0" ${(!challenge?.wave || challenge?.wave === 0) ? 'selected' : ''}>No Wave (always visible)</option>
                                ${configuredWaves.map(w => `<option value="${w}" ${challenge?.wave === w ? 'selected' : ''}>Wave ${w}</option>`).join('')}
                            </select>
                            <small class="text-muted">Assign to a wave to control visibility via Waves tab</small>
                        </div>
                    </div>
                    <div class="form-group">
                        <label><input type="checkbox" name="is_hidden" ${challenge?.is_hidden ? 'checked' : ''}> Hidden (not visible to participants)</label>
                    </div>
                    <div class="form-group">
                        <label><input type="checkbox" name="show_flag" ${challenge?.show_flag ? 'checked' : ''}> Show flag to solvers (users who solved can see the flag)</label>
                    </div>
                    <button type="submit" class="btn btn-primary">Save Challenge</button>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function addExtraLink() {
    const container = document.getElementById('extra-links-container');
    const row = document.createElement('div');
    row.className = 'extra-link-row';
    row.style.cssText = 'display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;';
    row.innerHTML = `
        <input type="url" class="form-input extra-link-input" placeholder="Additional link URL">
        <input type="text" class="form-input extra-link-label" placeholder="Label" style="max-width: 150px;">
        <button type="button" class="btn btn-danger btn-small" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(row);
}

function addExtraFile() {
    const container = document.getElementById('extra-files-container');
    const row = document.createElement('div');
    row.className = 'extra-file-row';
    row.style.cssText = 'display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;';
    row.innerHTML = `
        <input type="text" class="form-input extra-file-input" placeholder="File URL or upload">
        <input type="text" class="form-input extra-file-label" placeholder="Label" style="max-width: 150px;">
        <label class="btn btn-secondary btn-small" style="cursor: pointer; white-space: nowrap;">
            📎
            <input type="file" style="display: none;" onchange="uploadExtraFile(this)">
        </label>
        <button type="button" class="btn btn-danger btn-small" onclick="this.parentElement.remove()">✕</button>
    `;
    container.appendChild(row);
}

async function uploadExtraFile(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    if (file.size > 1024 * 1024 * 1024) { showToast('File too large (max 1GB)', 'error'); return; }
    const formData = new FormData();
    formData.append('file', file);
    try {
        showToast('Uploading...', 'info');
        const res = await fetch('/api/admin/challenges/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        input.closest('.extra-file-row').querySelector('.extra-file-input').value = data.file_url;
        showToast('File uploaded!', 'success');
    } catch (err) { showToast(err.message, 'error'); }
}

// Upload challenge file
async function uploadChallengeFile(input) {
    if (!input.files || !input.files[0]) return;
    
    const file = input.files[0];
    if (file.size > 1024 * 1024 * 1024) {
        showToast('File too large (max 1GB)', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        showToast('Uploading file...', 'info');
        const res = await fetch('/api/admin/challenges/upload', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        
        document.getElementById('file_url_input').value = data.file_url;
        showToast('File uploaded successfully!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function saveChallenge(e, id) {
    e.preventDefault();
    const form = e.target;
    
    // Collect extra links
    const extraLinks = [];
    document.querySelectorAll('.extra-link-row').forEach(row => {
        const url = row.querySelector('.extra-link-input').value.trim();
        const label = row.querySelector('.extra-link-label').value.trim();
        if (url) extraLinks.push({ url, label: label || 'Link' });
    });
    
    // Collect extra files
    const extraFiles = [];
    document.querySelectorAll('.extra-file-row').forEach(row => {
        const url = row.querySelector('.extra-file-input').value.trim();
        const label = row.querySelector('.extra-file-label').value.trim();
        if (url) extraFiles.push({ url, label: label || 'File' });
    });
    
    const data = {
        title: form.title.value,
        category: form.category.value,
        points: parseInt(form.points.value),
        description: form.description.value,
        flag: form.flag.value,
        file_url: form.file_url.value,
        link_url: form.link_url.value,
        hint: form.hint.value,
        hint_cost: parseInt(form.hint_cost.value) || 0,
        max_attempts: parseInt(form.max_attempts.value) || 0,
        author: form.author.value,
        is_hidden: form.is_hidden.checked,
        show_flag: form.show_flag.checked,
        extra_files: extraFiles,
        extra_links: extraLinks,
        wave: parseInt(form.wave.value) || 0
    };
    
    try {
        if (id) {
            await api(`/admin/challenges/${id}`, { method: 'PUT', body: data });
        } else {
            await api('/admin/challenges', { method: 'POST', body: data });
        }
        showToast('Challenge saved!', 'success');
        document.querySelector('.modal-overlay').remove();
        loadAdminSection('challenges');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteChallenge(id) {
    if (!confirm('Are you sure? This will delete all submissions for this challenge.')) return;
    
    try {
        await api(`/admin/challenges/${id}`, { method: 'DELETE' });
        showToast('Challenge deleted', 'success');
        loadAdminSection('challenges');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function renderAdminUsers(content) {
    const data = await api('/admin/users');
    
    content.innerHTML = `
        <h1 class="mb-4">Users</h1>
        <div class="card mb-4" style="padding: 1rem;">
            <input type="text" id="admin-user-search" class="form-input" placeholder="🔍 Search users by name, email, or team..." oninput="filterAdminUsers()" style="max-width: 400px;">
        </div>
        <div class="card">
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Username</th>
                            <th>Email</th>
                            <th>Team</th>
                            <th>Score</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="admin-users-tbody">
                        ${data.users.map(u => `
                            <tr class="${u.is_banned ? 'row-banned' : ''}" data-search="${escapeHtml((u.username + ' ' + u.email + ' ' + (u.team_name || '')).toLowerCase())}">
                                <td>
                                    ${escapeHtml(u.username)}
                                    ${u.is_admin ? '<span class="badge badge-danger" style="margin-left: 0.5rem;">Admin</span>' : ''}
                                </td>
                                <td>${escapeHtml(u.email)}</td>
                                <td>${u.team_name || '-'}</td>
                                <td>${u.score}</td>
                                <td>
                                    ${u.is_banned ? '<span class="badge badge-danger">Banned</span>' : 
                                      u.is_verified ? '<span class="badge badge-success">Verified</span>' : 
                                      '<span class="badge badge-warning">Unverified</span>'}
                                </td>
                                <td>
                                    ${!u.is_admin ? `
                                        <button class="btn btn-small ${u.is_banned ? 'btn-success' : 'btn-warning'}" onclick="toggleUserBan(${u.id}, ${!u.is_banned})">
                                            ${u.is_banned ? 'Unban' : 'Ban'}
                                        </button>
                                    ` : ''}
                                    <button class="btn btn-small btn-secondary" onclick="showEditUserModal(${JSON.stringify(u).replace(/"/g, '&quot;')})">Edit</button>
                                    <button class="btn btn-small btn-danger" onclick="deleteUser(${u.id})" ${u.id === currentUser.id ? 'disabled' : ''}>Delete</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function showEditUserModal(user) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h2 class="modal-title">Edit User: ${escapeHtml(user.username)}</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <form onsubmit="saveUserEdit(event, ${user.id})">
                    <div class="form-group">
                        <label class="form-label">Score</label>
                        <input type="number" name="score" class="form-input" value="${user.score}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">New Password (leave blank to keep)</label>
                        <input type="password" name="password" class="form-input" placeholder="••••••••">
                    </div>
                    <div class="form-group">
                        <label><input type="checkbox" name="is_admin" ${user.is_admin ? 'checked' : ''}> Admin</label>
                    </div>
                    <div class="form-group">
                        <label><input type="checkbox" name="is_hidden" ${user.is_hidden ? 'checked' : ''}> Hidden from scoreboard</label>
                    </div>
                    <div class="form-group">
                        <label><input type="checkbox" name="is_banned" ${user.is_banned ? 'checked' : ''}> Banned</label>
                    </div>
                    <button type="submit" class="btn btn-primary">Save</button>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

async function saveUserEdit(e, id) {
    e.preventDefault();
    const form = e.target;
    
    const data = {
        score: parseInt(form.score.value),
        is_admin: form.is_admin.checked,
        is_hidden: form.is_hidden.checked,
        is_banned: form.is_banned.checked
    };
    
    if (form.password.value) {
        data.password = form.password.value;
    }
    
    try {
        await api(`/admin/users/${id}`, { method: 'PUT', body: data });
        showToast('User updated', 'success');
        document.querySelector('.modal-overlay').remove();
        loadAdminSection('users');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function toggleUserBan(id, ban) {
    if (!confirm(`Are you sure you want to ${ban ? 'ban' : 'unban'} this user?`)) return;
    
    try {
        await api(`/admin/users/${id}/ban`, { method: 'POST', body: { banned: ban } });
        showToast(`User ${ban ? 'banned' : 'unbanned'}`, 'success');
        loadAdminSection('users');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteUser(id) {
    if (!confirm('Are you sure? This will delete all submissions from this user.')) return;
    
    try {
        await api(`/admin/users/${id}`, { method: 'DELETE' });
        showToast('User deleted', 'success');
        loadAdminSection('users');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function renderAdminTeams(content) {
    const data = await api('/admin/teams');
    
    // Find empty teams (no members)
    const emptyTeams = data.teams.filter(t => t.member_count === 0);
    
    content.innerHTML = `
        <h1 class="mb-4">Teams</h1>
        <div class="card mb-4" style="padding: 1rem;">
            <input type="text" id="admin-team-search" class="form-input" placeholder="🔍 Search teams by name or invite code..." oninput="filterAdminTeams()" style="max-width: 400px;">
        </div>
        <div class="card">
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Members</th>
                            <th>Score</th>
                            <th>Invite Code</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="admin-teams-tbody">
                        ${data.teams.map(t => `
                            <tr class="${t.is_banned ? 'row-banned' : ''} ${t.member_count === 0 ? 'row-empty-team' : ''}" data-search="${escapeHtml((t.name + ' ' + (t.invite_code || '')).toLowerCase())}">
                                <td>
                                    <strong>${escapeHtml(t.name)}</strong>
                                    ${t.member_count === 0 ? '<span class="badge badge-warning" style="margin-left: 0.5rem; font-size: 0.7rem;">Empty</span>' : ''}
                                    <div class="text-muted" style="font-size: 0.8rem;">Created: ${formatDate(t.created_at)}</div>
                                </td>
                                <td>${t.member_count}</td>
                                <td>${t.score}</td>
                                <td>
                                    <code style="background: var(--bg-tertiary); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.85rem;">${t.invite_code || 'N/A'}</code>
                                </td>
                                <td>
                                    ${t.is_banned ? '<span class="badge badge-danger">Banned</span>' : '<span class="badge badge-success">Active</span>'}
                                </td>
                                <td>
                                    <button class="btn btn-small btn-secondary" onclick="showTeamDetails(${JSON.stringify(t).replace(/"/g, '&quot;')})">View</button>
                                    <button class="btn btn-small ${t.is_banned ? 'btn-success' : 'btn-warning'}" onclick="toggleTeamBan(${t.id}, ${!t.is_banned})">
                                        ${t.is_banned ? 'Unban' : 'Ban'}
                                    </button>
                                    <button class="btn btn-small btn-danger" onclick="deleteTeam(${t.id})">Delete</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        
        ${emptyTeams.length > 0 ? `
            <div class="card mt-4" style="border: 1px solid var(--warning); background: rgba(255, 193, 7, 0.1);">
                <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
                    <span style="font-size: 1.5rem;">⚠️</span>
                    <div>
                        <h3 style="margin: 0; color: var(--warning);">Empty Teams Detected</h3>
                        <p class="text-muted" style="margin: 0.25rem 0 0 0;">${emptyTeams.length} team${emptyTeams.length > 1 ? 's have' : ' has'} no members</p>
                    </div>
                </div>
                <div style="background: var(--bg-tertiary); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
                    <p style="margin: 0 0 0.5rem 0; font-weight: 500;">Empty teams:</p>
                    <ul style="margin: 0; padding-left: 1.5rem;">
                        ${emptyTeams.map(t => `<li><strong>${escapeHtml(t.name)}</strong> <span class="text-muted">(Score: ${t.score})</span></li>`).join('')}
                    </ul>
                </div>
                <div style="display: flex; gap: 1rem; justify-content: flex-end;">
                    <button class="btn btn-secondary" onclick="dismissEmptyTeamsAlert()">Dismiss</button>
                    <button class="btn btn-danger" onclick="deleteAllEmptyTeams([${emptyTeams.map(t => t.id).join(',')}])">
                        Delete All Empty Teams (${emptyTeams.length})
                    </button>
                </div>
            </div>
        ` : ''}
    `;
}

function dismissEmptyTeamsAlert() {
    const alertCard = document.querySelector('.card[style*="border: 1px solid var(--warning)"]');
    if (alertCard) {
        alertCard.style.transition = 'opacity 0.3s, transform 0.3s';
        alertCard.style.opacity = '0';
        alertCard.style.transform = 'translateY(-10px)';
        setTimeout(() => alertCard.remove(), 300);
    }
}

function filterAdminUsers() {
    const q = document.getElementById('admin-user-search').value.toLowerCase();
    document.querySelectorAll('#admin-users-tbody tr').forEach(row => {
        row.style.display = (row.dataset.search || '').includes(q) ? '' : 'none';
    });
}

function filterAdminTeams() {
    const q = document.getElementById('admin-team-search').value.toLowerCase();
    document.querySelectorAll('#admin-teams-tbody tr').forEach(row => {
        row.style.display = (row.dataset.search || '').includes(q) ? '' : 'none';
    });
}

async function deleteAllEmptyTeams(teamIds) {
    if (!confirm(`Are you sure you want to delete ${teamIds.length} empty team${teamIds.length > 1 ? 's' : ''}? This action cannot be undone.`)) {
        return;
    }
    
    let deleted = 0;
    let failed = 0;
    
    for (const id of teamIds) {
        try {
            await api(`/admin/teams/${id}`, { method: 'DELETE' });
            deleted++;
        } catch (err) {
            failed++;
        }
    }
    
    if (deleted > 0) {
        showToast(`Successfully deleted ${deleted} empty team${deleted > 1 ? 's' : ''}`, 'success');
    }
    if (failed > 0) {
        showToast(`Failed to delete ${failed} team${failed > 1 ? 's' : ''}`, 'error');
    }
    
    // Refresh the teams list
    const content = document.querySelector('.admin-content');
    if (content) {
        await renderAdminTeams(content);
    }
}

function showTeamDetails(team) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h2 class="modal-title">Team: ${escapeHtml(team.name)}</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="team-details-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div>
                        <label class="text-muted">Team ID</label>
                        <p><strong>${team.id}</strong></p>
                    </div>
                    <div>
                        <label class="text-muted">Score</label>
                        <p><strong>${team.score} pts</strong></p>
                    </div>
                    <div>
                        <label class="text-muted">Members</label>
                        <p><strong>${team.member_count}</strong></p>
                    </div>
                    <div>
                        <label class="text-muted">Captain ID</label>
                        <p><strong>${team.captain_id || 'None'}</strong></p>
                    </div>
                    <div style="grid-column: 1 / -1;">
                        <label class="text-muted">Invite Code</label>
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem;">
                            <code style="background: var(--bg-tertiary); padding: 0.5rem 1rem; border-radius: 6px; font-size: 1.1rem; flex: 1;">${team.invite_code}</code>
                            <button class="btn btn-secondary" onclick="copyToClipboard('${team.invite_code}')">Copy</button>
                        </div>
                    </div>
                    <div style="grid-column: 1 / -1;">
                        <label class="text-muted">Invite Link</label>
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem;">
                            <code style="background: var(--bg-tertiary); padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.9rem; flex: 1; word-break: break-all;">${window.location.origin}/teams?join=${team.invite_code}</code>
                            <button class="btn btn-secondary" onclick="copyToClipboard('${window.location.origin}/teams?join=${team.invite_code}')">Copy</button>
                        </div>
                    </div>
                    <div>
                        <label class="text-muted">Created</label>
                        <p>${formatDate(team.created_at)}</p>
                    </div>
                    <div>
                        <label class="text-muted">Status</label>
                        <p>${team.is_banned ? '<span class="badge badge-danger">Banned</span>' : '<span class="badge badge-success">Active</span>'}</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Copied to clipboard!', 'success');
        }).catch(() => {
            fallbackCopyAdmin(text);
        });
    } else {
        fallbackCopyAdmin(text);
    }
}

function fallbackCopyAdmin(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
        document.execCommand('copy');
        showToast('Copied!', 'success');
    } catch (err) {
        showToast('Failed to copy', 'error');
    }
    document.body.removeChild(textarea);
}

async function deleteTeam(id) {
    if (!confirm('Are you sure? This will remove all members from this team.')) return;
    
    try {
        await api(`/admin/teams/${id}`, { method: 'DELETE' });
        showToast('Team deleted', 'success');
        loadAdminSection('teams');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function toggleTeamBan(id, ban) {
    if (!confirm(`Are you sure you want to ${ban ? 'ban' : 'unban'} this team?`)) return;
    
    try {
        await api(`/admin/teams/${id}/ban`, { method: 'POST', body: { banned: ban } });
        showToast(`Team ${ban ? 'banned' : 'unbanned'}`, 'success');
        loadAdminSection('teams');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function renderAdminSubmissions(content) {
    const data = await api('/admin/submissions');
    
    content.innerHTML = `
        <h1 class="mb-4">Recent Submissions</h1>
        <div class="card">
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Challenge</th>
                            <th>Flag</th>
                            <th>Result</th>
                            <th>Time</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.submissions.map(s => `
                            <tr>
                                <td>${escapeHtml(s.username)}</td>
                                <td>${escapeHtml(s.challenge_title)}</td>
                                <td class="mono" style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(s.flag_submitted)}</td>
                                <td>
                                    <span class="badge ${s.is_correct ? 'badge-success' : 'badge-danger'}">
                                        ${s.is_correct ? 'Correct' : 'Wrong'}
                                    </span>
                                </td>
                                <td class="text-muted">${formatDate(s.submitted_at)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function renderAdminNotifications(content) {
    const data = await api('/admin/notifications');
    
    content.innerHTML = `
        <div class="admin-header">
            <h1>Notifications / Announcements</h1>
            <button class="btn btn-primary" onclick="showNotificationForm()">+ New Announcement</button>
        </div>
        <div class="card">
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>Content</th>
                            <th>Type</th>
                            <th>Created</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.notifications.map(n => `
                            <tr>
                                <td><strong>${escapeHtml(n.title)}</strong></td>
                                <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(n.content)}</td>
                                <td>
                                    <span class="badge ${n.type === 'warning' ? 'badge-warning' : n.type === 'danger' ? 'badge-danger' : 'badge-info'}">${n.type}</span>
                                </td>
                                <td class="text-muted">${formatDate(n.created_at)}</td>
                                <td>
                                    <button class="btn btn-small btn-danger" onclick="deleteNotification(${n.id})">Delete</button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ${data.notifications.length === 0 ? '<p class="text-center text-muted" style="padding: 2rem;">No notifications yet</p>' : ''}
        </div>
    `;
}

function showNotificationForm() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h2 class="modal-title">Create Announcement</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <form onsubmit="createNotification(event)">
                    <div class="form-group">
                        <label class="form-label">Title</label>
                        <input type="text" name="title" class="form-input" required placeholder="Announcement title">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Content</label>
                        <textarea name="content" class="form-input" rows="4" required placeholder="Announcement message..."></textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Type</label>
                        <select name="type" class="form-input">
                            <option value="info">Info (Blue)</option>
                            <option value="success">Success (Green)</option>
                            <option value="warning">Warning (Orange)</option>
                            <option value="danger">Danger (Red)</option>
                        </select>
                    </div>
                    <button type="submit" class="btn btn-primary">Create Announcement</button>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

async function createNotification(e) {
    e.preventDefault();
    const form = e.target;
    
    try {
        await api('/admin/notifications', {
            method: 'POST',
            body: {
                title: form.title.value,
                content: form.content.value,
                type: form.type.value
            }
        });
        showToast('Announcement created!', 'success');
        document.querySelector('.modal-overlay').remove();
        loadAdminSection('notifications');
        loadNotifications(); // Refresh global notifications
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteNotification(id) {
    if (!confirm('Delete this notification?')) return;
    
    try {
        await api(`/admin/notifications/${id}`, { method: 'DELETE' });
        showToast('Notification deleted', 'success');
        loadAdminSection('notifications');
        loadNotifications();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function renderAdminPageEditor(content) {
    const code = await api('/admin/custom-code');
    
    content.innerHTML = `
        <h1 class="mb-4">Page Editor</h1>
        <p class="text-secondary mb-4">Customize pages with HTML, CSS, and JavaScript. Your code will be injected into the respective pages.</p>
        
        <div class="grid grid-2" style="gap: 1.5rem;">
            <div class="card">
                <h3 class="card-title mb-3">🏠 Home Page</h3>
                <p class="text-muted mb-3">Customize the homepage content. Your HTML will replace the default hero section.</p>
                <textarea id="home-page-code" class="code-textarea mono" rows="15" placeholder="<!-- Your HTML/CSS/JS code here -->
<style>
  .custom-home { /* styles */ }
</style>

<div class='custom-home'>
  <h1>Welcome to Our CTF</h1>
  <!-- Your content -->
</div>

<script>
  // Your JavaScript
</script>">${escapeHtml(code.page_home || '')}</textarea>
                <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                    <button class="btn btn-primary" onclick="savePageCode('page_home', 'home-page-code')">Save Home Page</button>
                    <button class="btn btn-secondary" onclick="previewPageCode('home-page-code')">Preview</button>
                    <button class="btn btn-ghost" onclick="clearPageCode('home-page-code')">Clear</button>
                </div>
            </div>
            
            <div class="card">
                <h3 class="card-title mb-3">🚩 Challenges Page</h3>
                <p class="text-muted mb-3">Add custom content above the challenges grid. Good for rules or instructions.</p>
                <textarea id="challenges-page-code" class="code-textarea mono" rows="15" placeholder="<!-- Your HTML/CSS/JS code here -->
<style>
  .challenge-header { /* styles */ }
</style>

<div class='challenge-header'>
  <h2>Challenge Rules</h2>
  <p>No flag sharing. No brute forcing.</p>
</div>">${escapeHtml(code.page_challenges || '')}</textarea>
                <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                    <button class="btn btn-primary" onclick="savePageCode('page_challenges', 'challenges-page-code')">Save Challenges</button>
                    <button class="btn btn-secondary" onclick="previewPageCode('challenges-page-code')">Preview</button>
                    <button class="btn btn-ghost" onclick="clearPageCode('challenges-page-code')">Clear</button>
                </div>
            </div>
        </div>
        
        <div class="card mt-4">
            <h3 class="card-title mb-3">🎨 Global Custom CSS</h3>
            <p class="text-muted mb-3">Add CSS that applies to all pages. Use this for global styling changes.</p>
            <textarea id="global-css-code" class="code-textarea mono" rows="10" placeholder="/* Global CSS */
.card { border-radius: 16px; }
.btn-primary { background: linear-gradient(135deg, #00ff88, #00ccff); }">${escapeHtml(code.custom_css || '')}</textarea>
            <button class="btn btn-primary mt-3" onclick="savePageCode('custom_css', 'global-css-code')">Save Global CSS</button>
        </div>
        
        <div class="card mt-4">
            <h3 class="card-title">💡 Tips</h3>
            <ul class="text-secondary" style="line-height: 2;">
                <li><strong>Use &lt;style&gt; tags</strong> for CSS within your page code</li>
                <li><strong>Use &lt;script&gt; tags</strong> for JavaScript within your page code</li>
                <li><strong>Available CSS variables:</strong> --bg-primary, --bg-secondary, --accent, --text-primary, --danger</li>
                <li><strong>Test in preview</strong> before saving to avoid breaking the site</li>
                <li><strong>Leave empty</strong> to use the default page design</li>
            </ul>
        </div>
    `;
}

async function savePageCode(key, editorId) {
    const value = document.getElementById(editorId).value;
    
    try {
        await api('/admin/custom-code', {
            method: 'PUT',
            body: { key, value }
        });
        await loadSiteConfig();
        showToast('Page saved! Refresh to see changes.', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function previewPageCode(editorId) {
    const code = document.getElementById(editorId).value;
    const win = window.open('', '_blank', 'width=1200,height=800');
    win.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Page Preview</title>
            <link rel="stylesheet" href="/css/style.css">
            <style>
                body { background: var(--bg-primary); color: var(--text-primary); padding: 2rem; }
            </style>
        </head>
        <body>
            ${code}
        </body>
        </html>
    `);
    win.document.close();
}

function clearPageCode(editorId) {
    if (confirm('Clear this code? You will need to save to apply.')) {
        document.getElementById(editorId).value = '';
    }
}

async function renderAdminEventPages(content) {
    const code = await api('/admin/custom-code');
    
    content.innerHTML = `
        <h1 class="mb-4">Event Pages</h1>
        <p class="text-secondary mb-4">Customize the countdown (before CTF starts) and ended (after CTF ends) pages.</p>
        
        <div class="grid grid-2" style="gap: 1.5rem;">
            <div class="card">
                <h3 class="card-title mb-3">🚀 Opening Page (Countdown)</h3>
                <p class="text-muted mb-3">Shown before the CTF starts. The countdown timer will be displayed on top of your content.</p>
                <textarea id="opening-page-code" class="code-textarea mono" rows="15" placeholder="<!-- Countdown page customization -->
<style>
    .opening-bg {
        background: linear-gradient(135deg, #0a0a1a 0%, #1a0a2e 100%);
    }
</style>

<div class='opening-bg' style='padding: 2rem; text-align: center;'>
    <h2 style='color: #00ffff;'>Get Ready Hackers!</h2>
    <p>Prepare your tools and sharpen your skills.</p>
</div>">${escapeHtml(code.page_opening || '')}</textarea>
                <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                    <button class="btn btn-primary" onclick="savePageCode('page_opening', 'opening-page-code')">Save</button>
                    <button class="btn btn-secondary" onclick="previewPageCode('opening-page-code')">Preview</button>
                    <button class="btn btn-ghost" onclick="clearPageCode('opening-page-code')">Clear</button>
                </div>
            </div>
            
            <div class="card">
                <h3 class="card-title mb-3">🏁 Ending Page</h3>
                <p class="text-muted mb-3">Shown after the CTF ends. Thank participants and show final messages.</p>
                <textarea id="ending-page-code" class="code-textarea mono" rows="15" placeholder="<!-- Ending page customization -->
<style>
    .ending-box {
        background: rgba(0,255,136,0.1);
        border: 1px solid #00ff88;
        border-radius: 12px;
        padding: 2rem;
        text-align: center;
    }
</style>

<div class='ending-box'>
    <h2 style='color: #00ff88;'>🎉 Thanks for Participating!</h2>
    <p>We hope you enjoyed the challenges.</p>
    <p>Winners will be announced soon!</p>
</div>">${escapeHtml(code.page_ending || '')}</textarea>
                <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                    <button class="btn btn-primary" onclick="savePageCode('page_ending', 'ending-page-code')">Save</button>
                    <button class="btn btn-secondary" onclick="previewPageCode('ending-page-code')">Preview</button>
                    <button class="btn btn-ghost" onclick="clearPageCode('ending-page-code')">Clear</button>
                </div>
            </div>
        </div>
        
        <div class="card mt-4">
            <h3 class="card-title">💡 Tips</h3>
            <ul class="text-secondary" style="line-height: 2;">
                <li><strong>Opening page:</strong> Your custom code renders in full-screen iframe. Timer floats on top.</li>
                <li><strong>Ending page:</strong> Your custom code replaces the default ended message.</li>
                <li><strong>Timer settings:</strong> Configure timer colors in Settings → Timer Appearance</li>
                <li><strong>Include full HTML</strong> with &lt;style&gt; tags for best results</li>
            </ul>
        </div>
    `;
}

async function renderAdminOpeningTimer(content) {
    const config = await api('/admin/config');
    
    // Calculate time until start
    let timeUntilStart = '';
    let startStatus = '';
    if (config.ctf_start) {
        const start = new Date(config.ctf_start);
        const now = new Date();
        if (start > now) {
            const diff = start - now;
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            timeUntilStart = `Starts in ${days}d ${hours}h ${mins}m`;
            startStatus = 'pending';
        } else {
            timeUntilStart = 'Event Started';
            startStatus = 'started';
        }
    }
    
    content.innerHTML = `
        <h1 class="mb-4">🚀 Opening Timer</h1>
        <p class="text-secondary mb-4">Configure when your CTF starts and customize the countdown timer appearance.</p>
        
        <!-- Event Start Time Section -->
        <div class="card mb-4">
            <h3 class="card-title mb-3">📅 Event Start Time</h3>
            <div style="background: linear-gradient(135deg, rgba(0,255,136,0.1), rgba(0,100,255,0.1)); padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; border: 1px solid var(--border);">
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
                    <div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem;">CTF STARTS AT</div>
                        <div id="start-time-display" style="font-size: 2rem; font-weight: bold; color: var(--accent);">
                            ${config.ctf_start ? formatDateTime(config.ctf_start) : 'Not Set'}
                        </div>
                        ${timeUntilStart ? `<div style="font-size: 0.9rem; color: ${startStatus === 'started' ? '#00ff88' : '#ffa502'}; margin-top: 0.5rem;">${startStatus === 'started' ? '✓' : '⏱️'} ${timeUntilStart}</div>` : ''}
                    </div>
                </div>
            </div>
            <form id="start-time-form">
                <div class="form-group">
                    <label class="form-label">Set Start Time</label>
                    <input type="datetime-local" name="ctf_start" class="form-input" value="${config.ctf_start ? config.ctf_start.slice(0,16) : ''}" style="font-size: 1.1rem; padding: 0.75rem;">
                    <small class="text-muted">The opening page with countdown timer shows until this time.</small>
                </div>
                <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap;">
                    <button type="button" class="btn btn-ghost" onclick="setOpeningQuickTime('now')">🕐 Now</button>
                    <button type="button" class="btn btn-ghost" onclick="setOpeningQuickTime('5m')">+5 Min</button>
                    <button type="button" class="btn btn-ghost" onclick="setOpeningQuickTime('10m')">+10 Min</button>
                    <button type="button" class="btn btn-ghost" onclick="setOpeningQuickTime('1h')">+1 Hour</button>
                    <button type="button" class="btn btn-ghost" onclick="setOpeningQuickTime('1d')">+1 Day</button>
                    <button type="button" class="btn btn-ghost" onclick="setOpeningQuickTime('1w')">+1 Week</button>
                </div>
                <button type="button" class="btn btn-primary" onclick="saveOpeningStartTime()">💾 Save Start Time</button>
            </form>
        </div>
        
        <div class="grid grid-2" style="gap: 1.5rem;">
            <!-- Timer Appearance Settings -->
            <div class="card">
                <h3 class="card-title mb-3">🎨 Timer Appearance</h3>
                <form id="opening-timer-form">
                    <div class="form-group">
                        <label class="form-label">
                            <input type="checkbox" name="opening_timer_visible" ${config.opening_timer_visible !== '0' ? 'checked' : ''}> Timer Visible
                        </label>
                        <small class="text-muted">Show or hide the opening countdown timer.</small>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Timer Position</label>
                        <select name="opening_timer_position" class="form-input">
                            <option value="center" ${!config.opening_timer_position || config.opening_timer_position === 'center' ? 'selected' : ''}>Center</option>
                            <option value="top" ${config.opening_timer_position === 'top' ? 'selected' : ''}>Top</option>
                            <option value="bottom" ${config.opening_timer_position === 'bottom' ? 'selected' : ''}>Bottom</option>
                            <option value="left" ${config.opening_timer_position === 'left' ? 'selected' : ''}>Left</option>
                            <option value="right" ${config.opening_timer_position === 'right' ? 'selected' : ''}>Right</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Timer Text Color</label>
                        <div class="flex gap-1">
                            <input type="color" name="opening_timer_color" value="${config.opening_timer_color || config.timer_color_start || '#00ff88'}" style="width: 50px; height: 40px; border: none; cursor: pointer;" oninput="this.nextElementSibling.value = this.value; updateOpeningTimerPreview()">
                            <input type="text" class="form-input" value="${config.opening_timer_color || config.timer_color_start || '#00ff88'}" style="flex: 1;" oninput="this.previousElementSibling.value = this.value; updateOpeningTimerPreview()">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Timer Background</label>
                        <div class="flex gap-1">
                            <input type="color" name="opening_timer_bg" value="${config.opening_timer_bg || config.timer_bg || '#0a0a1a'}" style="width: 50px; height: 40px; border: none; cursor: pointer;" oninput="this.nextElementSibling.value = this.value; updateOpeningTimerPreview()">
                            <input type="text" class="form-input" value="${config.opening_timer_bg || config.timer_bg || '#0a0a1a'}" style="flex: 1;" oninput="this.previousElementSibling.value = this.value; updateOpeningTimerPreview()">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Border Color</label>
                        <div class="flex gap-1">
                            <input type="color" name="opening_timer_border" value="${config.opening_timer_border || '#00ff8860'}" style="width: 50px; height: 40px; border: none; cursor: pointer;" oninput="this.nextElementSibling.value = this.value; updateOpeningTimerPreview()">
                            <input type="text" class="form-input" value="${config.opening_timer_border || '#00ff8860'}" style="flex: 1;" oninput="this.previousElementSibling.value = this.value; updateOpeningTimerPreview()">
                        </div>
                    </div>
                    <div class="grid grid-2" style="gap: 1rem;">
                        <div class="form-group">
                            <label class="form-label">Font Size</label>
                            <select name="opening_timer_size" class="form-input" onchange="updateOpeningTimerPreview()">
                                <option value="small" ${config.opening_timer_size === 'small' ? 'selected' : ''}>Small</option>
                                <option value="medium" ${config.opening_timer_size === 'medium' ? 'selected' : ''}>Medium</option>
                                <option value="large" ${!config.opening_timer_size || config.opening_timer_size === 'large' ? 'selected' : ''}>Large</option>
                                <option value="xlarge" ${config.opening_timer_size === 'xlarge' ? 'selected' : ''}>Extra Large</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Timer Style</label>
                            <select name="opening_timer_style" class="form-input" onchange="updateOpeningTimerPreview()">
                                <option value="digital" ${!config.opening_timer_style || config.opening_timer_style === 'digital' ? 'selected' : ''}>Digital (Bold)</option>
                                <option value="minimal" ${config.opening_timer_style === 'minimal' ? 'selected' : ''}>Minimal</option>
                                <option value="neon" ${config.opening_timer_style === 'neon' ? 'selected' : ''}>Neon Glow</option>
                                <option value="matrix" ${config.opening_timer_style === 'matrix' ? 'selected' : ''}>Matrix</option>
                                <option value="retro" ${config.opening_timer_style === 'retro' ? 'selected' : ''}>Retro</option>
                                <option value="gradient" ${config.opening_timer_style === 'gradient' ? 'selected' : ''}>Gradient</option>
                                <option value="cyber" ${config.opening_timer_style === 'cyber' ? 'selected' : ''}>Cyber</option>
                                <option value="fire" ${config.opening_timer_style === 'fire' ? 'selected' : ''}>Fire</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Label Text</label>
                        <input type="text" name="opening_timer_label" class="form-input" value="${escapeHtml(config.opening_timer_label || '🚀 CTF STARTS IN')}" oninput="updateOpeningTimerPreview()">
                    </div>
                    <div class="form-group">
                        <label class="form-label">
                            <input type="checkbox" name="opening_timer_glow" ${config.opening_timer_glow !== '0' ? 'checked' : ''} onchange="updateOpeningTimerPreview()"> Enable Glow Effect
                        </label>
                    </div>
                    <div class="form-group">
                        <label class="form-label">⏱️ Timer Visibility Delay</label>
                        <div class="flex gap-1" style="align-items: center;">
                            <input type="number" name="opening_timer_delay" class="form-input" value="${config.opening_timer_delay || '5'}" min="0" max="60" style="width: 100px;">
                            <span class="text-secondary" style="font-size: 0.85rem;">seconds after page load</span>
                        </div>
                        <small class="text-muted">Delay before the countdown timer becomes visible to users (0 = instant, default 5s).</small>
                    </div>
                    <button type="button" class="btn btn-primary" onclick="saveOpeningTimerSettings()">💾 Save Timer Appearance</button>
                </form>
            </div>
            
            <!-- Live Preview -->
            <div class="card">
                <h3 class="card-title mb-3">👁️ Live Preview</h3>
                <div id="opening-timer-live-preview" style="background: #0a0a0a; padding: 2rem; border-radius: 12px; min-height: 280px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                    <div id="timer-preview-box" style="background: ${config.opening_timer_bg || '#0a0a1a'}f0; padding: 1.5rem 2rem; border-radius: 16px; border: 2px solid ${config.opening_timer_border || '#00ff8860'}; box-shadow: 0 10px 40px rgba(0,0,0,0.6), 0 0 20px ${config.opening_timer_color || '#00ff88'}30; text-align: center;">
                        <div id="timer-preview-label" style="color: ${config.opening_timer_color || '#00ff88'}; font-size: 0.85rem; margin-bottom: 0.75rem; font-weight: 600;">${escapeHtml(config.opening_timer_label || '🚀 CTF STARTS IN')}</div>
                        <div style="display: flex; gap: 1.5rem; justify-content: center;">
                            <div style="text-align: center;">
                                <span id="tp-days" class="timer-digit" style="display: block; color: ${config.opening_timer_color || '#00ff88'}; font-size: 2.5rem; font-weight: bold;">05</span>
                                <span style="font-size: 0.7rem; color: #888;">Days</span>
                            </div>
                            <div style="text-align: center;">
                                <span id="tp-hours" class="timer-digit" style="display: block; color: ${config.opening_timer_color || '#00ff88'}; font-size: 2.5rem; font-weight: bold;">12</span>
                                <span style="font-size: 0.7rem; color: #888;">Hours</span>
                            </div>
                            <div style="text-align: center;">
                                <span id="tp-mins" class="timer-digit" style="display: block; color: ${config.opening_timer_color || '#00ff88'}; font-size: 2.5rem; font-weight: bold;">34</span>
                                <span style="font-size: 0.7rem; color: #888;">Mins</span>
                            </div>
                            <div style="text-align: center;">
                                <span id="tp-secs" class="timer-digit" style="display: block; color: ${config.opening_timer_color || '#00ff88'}; font-size: 2.5rem; font-weight: bold;">56</span>
                                <span style="font-size: 0.7rem; color: #888;">Secs</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Quick Style Picker -->
                <div class="mt-3" style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px;">
                    <h4 style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;">Quick Styles</h4>
                    <div class="grid grid-4" style="gap: 0.5rem;">
                        <div style="background: #0a0a1a; padding: 0.5rem; border-radius: 4px; text-align: center; cursor: pointer;" onclick="document.querySelector('[name=opening_timer_style]').value='digital'; updateOpeningTimerPreview()">
                            <span style="font-size: 1rem; font-weight: bold; color: #00ff88;">12:34</span>
                            <div style="font-size: 0.6rem; color: #666;">Digital</div>
                        </div>
                        <div style="background: #0a0a1a; padding: 0.5rem; border-radius: 4px; text-align: center; cursor: pointer;" onclick="document.querySelector('[name=opening_timer_style]').value='neon'; updateOpeningTimerPreview()">
                            <span style="font-size: 1rem; font-weight: bold; color: #00ff88; text-shadow: 0 0 10px #00ff88;">12:34</span>
                            <div style="font-size: 0.6rem; color: #666;">Neon</div>
                        </div>
                        <div style="background: #0a0a1a; padding: 0.5rem; border-radius: 4px; text-align: center; cursor: pointer;" onclick="document.querySelector('[name=opening_timer_style]').value='matrix'; updateOpeningTimerPreview()">
                            <span style="font-size: 1rem; font-weight: bold; color: #00ff00; text-shadow: 0 0 10px #00ff00; font-family: monospace;">12:34</span>
                            <div style="font-size: 0.6rem; color: #666;">Matrix</div>
                        </div>
                        <div style="background: #0a0a1a; padding: 0.5rem; border-radius: 4px; text-align: center; cursor: pointer;" onclick="document.querySelector('[name=opening_timer_style]').value='fire'; updateOpeningTimerPreview()">
                            <span style="font-size: 1rem; font-weight: bold; color: #ff6600; text-shadow: 0 0 10px #ff3300;">12:34</span>
                            <div style="font-size: 0.6rem; color: #666;">Fire</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Start live preview animation
    startOpeningTimerPreviewAnimation();
}

function setOpeningQuickTime(preset) {
    const input = document.querySelector('[name="ctf_start"]');
    if (!input) return;
    
    const now = new Date();
    let target;
    
    switch(preset) {
        case 'now':
            target = now;
            break;
        case '5m':
            target = new Date(now.getTime() + 5 * 60 * 1000);
            break;
        case '10m':
            target = new Date(now.getTime() + 10 * 60 * 1000);
            break;
        case '1h':
            target = new Date(now.getTime() + 60 * 60 * 1000);
            break;
        case '1d':
            target = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            break;
        case '1w':
            target = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
            break;
    }
    
    // Format for datetime-local input (local time, not UTC)
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const day = String(target.getDate()).padStart(2, '0');
    const hours = String(target.getHours()).padStart(2, '0');
    const minutes = String(target.getMinutes()).padStart(2, '0');
    input.value = `${year}-${month}-${day}T${hours}:${minutes}`;
}

async function saveOpeningStartTime() {
    const input = document.querySelector('[name="ctf_start"]');
    if (!input) return;
    
    try {
        await api('/admin/config/bulk', {
            method: 'PUT',
            body: {
                settings: {
                    ctf_start: input.value ? new Date(input.value).toISOString() : ''
                }
            }
        });
        await loadSiteConfig();
        showToast('Event start time saved!', 'success');
        loadAdminSection('opening-timer'); // Refresh to show updated time
    } catch (err) {
        showToast(err.message, 'error');
    }
}

let openingTimerPreviewInterval = null;
function startOpeningTimerPreviewAnimation() {
    if (openingTimerPreviewInterval) clearInterval(openingTimerPreviewInterval);
    let secs = 56;
    openingTimerPreviewInterval = setInterval(() => {
        secs = (secs + 1) % 60;
        const el = document.getElementById('tp-secs');
        if (el) el.textContent = String(secs).padStart(2, '0');
    }, 1000);
}

function updateOpeningTimerPreview() {
    const form = document.getElementById('opening-timer-form');
    if (!form) return;
    
    const color = form.opening_timer_color.value;
    const bg = form.opening_timer_bg.value;
    const border = form.opening_timer_border.value;
    const size = form.opening_timer_size.value;
    const style = form.opening_timer_style.value;
    const label = form.opening_timer_label.value;
    const glow = form.opening_timer_glow.checked;
    
    const sizeMap = { small: '1.8rem', medium: '2.2rem', large: '2.5rem', xlarge: '3rem' };
    const fontSize = sizeMap[size] || '2.5rem';
    
    // Build style CSS based on timer style
    let styleCSS = `font-size: ${fontSize}; font-weight: bold; color: ${color};`;
    if (style === 'neon' || glow) styleCSS += ` text-shadow: 0 0 10px ${color}, 0 0 20px ${color};`;
    if (style === 'matrix') styleCSS = `font-size: ${fontSize}; font-weight: bold; color: #00ff00; text-shadow: 0 0 10px #00ff00; font-family: 'Courier New', monospace;`;
    if (style === 'minimal') styleCSS += ` font-weight: 300;`;
    if (style === 'retro') styleCSS += ` font-family: 'Courier New', monospace; text-shadow: 2px 2px 0 #ff0000, -2px -2px 0 #00ff00;`;
    if (style === 'gradient') styleCSS += ` background: linear-gradient(135deg, ${color}, #00ccff); -webkit-background-clip: text; -webkit-text-fill-color: transparent;`;
    if (style === 'cyber') styleCSS += ` text-shadow: 0 0 5px ${color}, 0 0 10px ${color}; animation: cyber-pulse 1s infinite;`;
    if (style === 'fire') styleCSS = `font-size: ${fontSize}; font-weight: bold; color: #ff6600; text-shadow: 0 0 10px #ff3300, 0 0 20px #ff0000;`;
    
    // Update preview box
    const box = document.getElementById('timer-preview-box');
    if (box) {
        box.style.background = bg + 'f0';
        box.style.borderColor = border;
        box.style.boxShadow = glow ? `0 10px 40px rgba(0,0,0,0.6), 0 0 30px ${color}40` : '0 10px 40px rgba(0,0,0,0.6)';
    }
    
    // Update label
    const labelEl = document.getElementById('timer-preview-label');
    if (labelEl) {
        labelEl.textContent = label;
        labelEl.style.color = style === 'matrix' ? '#00ff00' : (style === 'fire' ? '#ff6600' : color);
    }
    
    // Update digits
    document.querySelectorAll('.timer-digit').forEach(el => {
        el.style.cssText = styleCSS;
    });
}

async function saveOpeningTimerSettings() {
    const form = document.getElementById('opening-timer-form');
    if (!form) return;
    
    try {
        await api('/admin/config/bulk', {
            method: 'PUT',
            body: {
                settings: {
                    opening_timer_color: form.opening_timer_color.value,
                    opening_timer_bg: form.opening_timer_bg.value,
                    opening_timer_border: form.opening_timer_border.value,
                    opening_timer_size: form.opening_timer_size.value,
                    opening_timer_style: form.opening_timer_style.value,
                    opening_timer_label: form.opening_timer_label.value,
                    opening_timer_glow: form.opening_timer_glow.checked ? '1' : '0',
                    opening_timer_delay: form.opening_timer_delay.value,
                    opening_timer_visible: form.opening_timer_visible.checked ? '1' : '0',
                    opening_timer_position: form.opening_timer_position.value,
                    // Also update the legacy keys for compatibility
                    timer_color_start: form.opening_timer_color.value,
                    timer_bg: form.opening_timer_bg.value,
                    timer_style: form.opening_timer_style.value,
                    timer_font_size: form.opening_timer_size.value
                }
            }
        });
        await loadSiteConfig();
        showToast('Opening timer settings saved! Refresh homepage to see changes.', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Running Timer (Event End Time) Panel
async function renderAdminRunningTimer(content) {
    const config = await api('/admin/config');
    
    // Calculate time until end
    let timeUntilEnd = '';
    let endStatus = '';
    if (config.ctf_end) {
        const end = new Date(config.ctf_end);
        const now = new Date();
        if (end > now) {
            const diff = end - now;
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            timeUntilEnd = `Ends in ${days}d ${hours}h ${mins}m`;
            endStatus = 'running';
        } else {
            timeUntilEnd = 'Event Ended';
            endStatus = 'ended';
        }
    }
    
    // Calculate duration
    let duration = '';
    if (config.ctf_start && config.ctf_end) {
        const start = new Date(config.ctf_start);
        const end = new Date(config.ctf_end);
        const diff = end - start;
        if (diff > 0) {
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            duration = `${days > 0 ? days + 'd ' : ''}${hours}h duration`;
        }
    }
    
    content.innerHTML = `
        <h1 class="mb-4">🔥 Running Timer</h1>
        <p class="text-secondary mb-4">Configure when your CTF ends and customize the running timer that shows time remaining.</p>
        
        <!-- Event End Time Section -->
        <div class="card mb-4">
            <h3 class="card-title mb-3">🏁 Event End Time</h3>
            <div style="background: linear-gradient(135deg, rgba(255,107,107,0.1), rgba(255,165,2,0.1)); padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; border: 1px solid var(--border);">
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
                    <div>
                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem;">CTF ENDS AT</div>
                        <div id="end-time-display" style="font-size: 2rem; font-weight: bold; color: #ff6b6b;">
                            ${config.ctf_end ? formatDateTime(config.ctf_end) : 'Not Set'}
                        </div>
                        ${timeUntilEnd ? `<div style="font-size: 0.9rem; color: ${endStatus === 'ended' ? '#ff4757' : '#ffa502'}; margin-top: 0.5rem;">${endStatus === 'ended' ? '✓' : '⏱️'} ${timeUntilEnd}</div>` : ''}
                        ${duration ? `<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.25rem;">${duration}</div>` : ''}
                    </div>
                </div>
            </div>
            <form id="end-time-form">
                <div class="form-group">
                    <label class="form-label">Set End Time</label>
                    <input type="datetime-local" name="ctf_end" class="form-input" value="${config.ctf_end ? config.ctf_end.slice(0,16) : ''}" style="font-size: 1.1rem; padding: 0.75rem;">
                    <small class="text-muted">Challenges auto-hide when this time passes. The ending page shows after this.</small>
                </div>
                <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap;">
                    <button type="button" class="btn btn-ghost" onclick="setRunningQuickTime('now')">🕐 Now</button>
                    <button type="button" class="btn btn-ghost" onclick="setRunningQuickTime('5m')">+5 Min</button>
                    <button type="button" class="btn btn-ghost" onclick="setRunningQuickTime('10m')">+10 Min</button>
                    <button type="button" class="btn btn-ghost" onclick="setRunningQuickDuration('24h')">+24 Hours</button>
                    <button type="button" class="btn btn-ghost" onclick="setRunningQuickDuration('48h')">+48 Hours</button>
                    <button type="button" class="btn btn-ghost" onclick="setRunningQuickDuration('72h')">+72 Hours</button>
                    <button type="button" class="btn btn-ghost" onclick="setRunningQuickDuration('1w')">+1 Week</button>
                </div>
                <div class="form-group">
                    <label class="form-label">Score Freeze Time (Optional)</label>
                    <input type="datetime-local" name="score_freeze_time" class="form-input" value="${config.score_freeze_time ? config.score_freeze_time.slice(0,16) : ''}">
                    <small class="text-muted">Scoreboard freezes at this time (scores still recorded but hidden)</small>
                </div>
                <button type="button" class="btn btn-primary" onclick="saveRunningEndTime()">💾 Save End Time</button>
            </form>
        </div>
        
        <div class="grid grid-2" style="gap: 1.5rem;">
            <!-- Timer Appearance Settings -->
            <div class="card">
                <h3 class="card-title mb-3">🎨 Running Timer Appearance</h3>
                <p class="text-muted mb-3">This timer shows on the page while the CTF is running.</p>
                <form id="running-timer-form">
                    <div class="form-group">
                        <label class="form-label">
                            <input type="checkbox" name="running_timer_visible" ${config.running_timer_visible !== '0' ? 'checked' : ''}> Timer Visible
                        </label>
                        <small class="text-muted">Show or hide the running countdown timer.</small>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Timer Position</label>
                        <select name="running_timer_position" class="form-input">
                            <option value="right" ${!config.running_timer_position || config.running_timer_position === 'right' ? 'selected' : ''}>Right</option>
                            <option value="top" ${config.running_timer_position === 'top' ? 'selected' : ''}>Top</option>
                            <option value="bottom" ${config.running_timer_position === 'bottom' ? 'selected' : ''}>Bottom</option>
                            <option value="left" ${config.running_timer_position === 'left' ? 'selected' : ''}>Left</option>
                            <option value="center" ${config.running_timer_position === 'center' ? 'selected' : ''}>Center</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Timer Text Color</label>
                        <div class="flex gap-1">
                            <input type="color" name="running_timer_color" value="${config.running_timer_color || config.timer_color_end || '#ffa502'}" style="width: 50px; height: 40px; border: none; cursor: pointer;" oninput="this.nextElementSibling.value = this.value; updateRunningTimerPreview()">
                            <input type="text" class="form-input" value="${config.running_timer_color || config.timer_color_end || '#ffa502'}" style="flex: 1;" oninput="this.previousElementSibling.value = this.value; updateRunningTimerPreview()">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Timer Background</label>
                        <div class="flex gap-1">
                            <input type="color" name="running_timer_bg" value="${config.running_timer_bg || '#1a0a0a'}" style="width: 50px; height: 40px; border: none; cursor: pointer;" oninput="this.nextElementSibling.value = this.value; updateRunningTimerPreview()">
                            <input type="text" class="form-input" value="${config.running_timer_bg || '#1a0a0a'}" style="flex: 1;" oninput="this.previousElementSibling.value = this.value; updateRunningTimerPreview()">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Border Color</label>
                        <div class="flex gap-1">
                            <input type="color" name="running_timer_border" value="${config.running_timer_border || '#ffa50260'}" style="width: 50px; height: 40px; border: none; cursor: pointer;" oninput="this.nextElementSibling.value = this.value; updateRunningTimerPreview()">
                            <input type="text" class="form-input" value="${config.running_timer_border || '#ffa50260'}" style="flex: 1;" oninput="this.previousElementSibling.value = this.value; updateRunningTimerPreview()">
                        </div>
                    </div>
                    <div class="grid grid-2" style="gap: 1rem;">
                        <div class="form-group">
                            <label class="form-label">Font Size</label>
                            <select name="running_timer_size" class="form-input" onchange="updateRunningTimerPreview()">
                                <option value="small" ${config.running_timer_size === 'small' ? 'selected' : ''}>Small</option>
                                <option value="medium" ${!config.running_timer_size || config.running_timer_size === 'medium' ? 'selected' : ''}>Medium</option>
                                <option value="large" ${config.running_timer_size === 'large' ? 'selected' : ''}>Large</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label class="form-label">Timer Style</label>
                            <select name="running_timer_style" class="form-input" onchange="updateRunningTimerPreview()">
                                <option value="digital" ${!config.running_timer_style || config.running_timer_style === 'digital' ? 'selected' : ''}>Digital</option>
                                <option value="urgent" ${config.running_timer_style === 'urgent' ? 'selected' : ''}>Urgent (Pulse)</option>
                                <option value="neon" ${config.running_timer_style === 'neon' ? 'selected' : ''}>Neon Glow</option>
                                <option value="minimal" ${config.running_timer_style === 'minimal' ? 'selected' : ''}>Minimal</option>
                                <option value="fire" ${config.running_timer_style === 'fire' ? 'selected' : ''}>Fire</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Label Text</label>
                        <input type="text" name="running_timer_label" class="form-input" value="${escapeHtml(config.running_timer_label || '🔥 ENDS IN')}" oninput="updateRunningTimerPreview()">
                    </div>
                    <div class="form-group">
                        <label class="form-label">
                            <input type="checkbox" name="running_timer_glow" ${config.running_timer_glow === '1' ? 'checked' : ''} onchange="updateRunningTimerPreview()"> Enable Glow Effect
                        </label>
                    </div>
                    <div class="form-group" id="glow-color-section" style="display: ${config.running_timer_glow === '1' ? 'block' : 'none'};">
                        <label class="form-label">Glow Color</label>
                        <div class="flex gap-1">
                            <input type="color" name="running_timer_glow_color" value="${config.running_timer_glow_color || config.running_timer_color || '#ffa502'}" style="width: 50px; height: 40px; border: none; cursor: pointer;" oninput="this.nextElementSibling.value = this.value; updateRunningTimerPreview()">
                            <input type="text" class="form-input" value="${config.running_timer_glow_color || config.running_timer_color || '#ffa502'}" style="flex: 1;" oninput="this.previousElementSibling.value = this.value; updateRunningTimerPreview()">
                        </div>
                        <small class="text-muted">Color of the glow effect around the timer</small>
                    </div>
                    <button type="button" class="btn btn-primary" onclick="saveRunningTimerSettings()">💾 Save Timer Appearance</button>
                </form>
            </div>
            
            <!-- Live Preview -->
            <div class="card">
                <h3 class="card-title mb-3">👁️ Live Preview</h3>
                <p class="text-muted mb-2">This is how the timer appears on the right side of the page.</p>
                <div id="running-timer-live-preview" style="background: #0a0a0a; padding: 2rem; border-radius: 12px; min-height: 250px; display: flex; justify-content: flex-end; align-items: center;">
                    <div id="running-timer-preview-box" style="background: ${config.running_timer_bg || '#1a0a0a'}e0; padding: 1rem 1.25rem; border-radius: 12px; border: 2px solid ${config.running_timer_border || '#ffa50260'}; box-shadow: 0 5px 30px rgba(0,0,0,0.5); text-align: center; min-width: 100px;">
                        <div id="running-timer-preview-label" style="color: ${config.running_timer_color || '#ffa502'}; font-size: 0.75rem; margin-bottom: 0.5rem; font-weight: 600;">${escapeHtml(config.running_timer_label || '🔥 ENDS IN')}</div>
                        <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                            <span id="rtp-hours" class="running-timer-digit" style="color: ${config.running_timer_color || '#ffa502'}; font-size: 1.5rem; font-weight: bold;">23</span>
                            <span style="font-size: 0.6rem; color: #888;">Hours</span>
                            <span id="rtp-mins" class="running-timer-digit" style="color: ${config.running_timer_color || '#ffa502'}; font-size: 1.5rem; font-weight: bold;">45</span>
                            <span style="font-size: 0.6rem; color: #888;">Mins</span>
                            <span id="rtp-secs" class="running-timer-digit" style="color: ${config.running_timer_color || '#ffa502'}; font-size: 1.5rem; font-weight: bold;">12</span>
                            <span style="font-size: 0.6rem; color: #888;">Secs</span>
                        </div>
                    </div>
                </div>
                
                <!-- Quick Style Picker -->
                <div class="mt-3" style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px;">
                    <h4 style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 0.5rem;">Quick Colors</h4>
                    <div class="grid grid-4" style="gap: 0.5rem;">
                        <div style="background: #0a0a1a; padding: 0.5rem; border-radius: 4px; text-align: center; cursor: pointer;" onclick="setRunningTimerColor('#ffa502')">
                            <span style="font-size: 1rem; font-weight: bold; color: #ffa502;">🟠</span>
                            <div style="font-size: 0.6rem; color: #666;">Orange</div>
                        </div>
                        <div style="background: #0a0a1a; padding: 0.5rem; border-radius: 4px; text-align: center; cursor: pointer;" onclick="setRunningTimerColor('#ff4757')">
                            <span style="font-size: 1rem; font-weight: bold; color: #ff4757;">🔴</span>
                            <div style="font-size: 0.6rem; color: #666;">Red</div>
                        </div>
                        <div style="background: #0a0a1a; padding: 0.5rem; border-radius: 4px; text-align: center; cursor: pointer;" onclick="setRunningTimerColor('#00ff88')">
                            <span style="font-size: 1rem; font-weight: bold; color: #00ff88;">🟢</span>
                            <div style="font-size: 0.6rem; color: #666;">Green</div>
                        </div>
                        <div style="background: #0a0a1a; padding: 0.5rem; border-radius: 4px; text-align: center; cursor: pointer;" onclick="setRunningTimerColor('#00ccff')">
                            <span style="font-size: 1rem; font-weight: bold; color: #00ccff;">🔵</span>
                            <div style="font-size: 0.6rem; color: #666;">Cyan</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Start live preview animation
    startRunningTimerPreviewAnimation();
}

function setRunningQuickTime(preset) {
    const input = document.querySelector('[name="ctf_end"]');
    if (!input) return;
    
    const now = new Date();
    let target;
    switch(preset) {
        case 'now': target = now; break;
        case '5m': target = new Date(now.getTime() + 5 * 60 * 1000); break;
        case '10m': target = new Date(now.getTime() + 10 * 60 * 1000); break;
    }
    
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const day = String(target.getDate()).padStart(2, '0');
    const hours = String(target.getHours()).padStart(2, '0');
    const minutes = String(target.getMinutes()).padStart(2, '0');
    input.value = `${year}-${month}-${day}T${hours}:${minutes}`;
}

function setRunningQuickDuration(preset) {
    const startInput = document.querySelector('[name="ctf_start"]');
    const endInput = document.querySelector('[name="ctf_end"]');
    if (!endInput) return;
    
    // Use either the set start time or now as base
    let base;
    if (startInput && startInput.value) {
        base = new Date(startInput.value);
    } else if (siteConfig?.ctf_start) {
        base = new Date(siteConfig.ctf_start);
    } else {
        base = new Date();
    }
    
    let hours = 0;
    switch(preset) {
        case '24h': hours = 24; break;
        case '48h': hours = 48; break;
        case '72h': hours = 72; break;
        case '1w': hours = 168; break; // 7 * 24
    }
    
    const target = new Date(base.getTime() + hours * 60 * 60 * 1000);
    
    // Format for datetime-local input (local time, not UTC)
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const day = String(target.getDate()).padStart(2, '0');
    const hrs = String(target.getHours()).padStart(2, '0');
    const minutes = String(target.getMinutes()).padStart(2, '0');
    endInput.value = `${year}-${month}-${day}T${hrs}:${minutes}`;
}

async function saveRunningEndTime() {
    const endInput = document.querySelector('[name="ctf_end"]');
    const freezeInput = document.querySelector('[name="score_freeze_time"]');
    if (!endInput) return;
    
    try {
        const settings = {
            ctf_end: endInput.value ? new Date(endInput.value).toISOString() : ''
        };
        if (freezeInput && freezeInput.value) {
            settings.score_freeze_time = new Date(freezeInput.value).toISOString();
        }
        
        await api('/admin/config/bulk', {
            method: 'PUT',
            body: { settings }
        });
        await loadSiteConfig();
        showToast('Event end time saved!', 'success');
        loadAdminSection('running-timer'); // Refresh
    } catch (err) {
        showToast(err.message, 'error');
    }
}

let runningTimerPreviewInterval = null;
function startRunningTimerPreviewAnimation() {
    if (runningTimerPreviewInterval) clearInterval(runningTimerPreviewInterval);
    let secs = 12;
    runningTimerPreviewInterval = setInterval(() => {
        secs = (secs + 1) % 60;
        const el = document.getElementById('rtp-secs');
        if (el) el.textContent = String(secs).padStart(2, '0');
    }, 1000);
}

function updateRunningTimerPreview() {
    const form = document.getElementById('running-timer-form');
    if (!form) return;
    
    const color = form.running_timer_color.value;
    const bg = form.running_timer_bg.value;
    const border = form.running_timer_border.value;
    const size = form.running_timer_size.value;
    const style = form.running_timer_style.value;
    const label = form.running_timer_label.value;
    const glow = form.running_timer_glow.checked;
    const glowColor = form.running_timer_glow_color?.value || color;
    
    // Show/hide glow color section
    const glowSection = document.getElementById('glow-color-section');
    if (glowSection) {
        glowSection.style.display = glow ? 'block' : 'none';
    }
    
    const sizeMap = { small: '1.2rem', medium: '1.5rem', large: '1.8rem' };
    const fontSize = sizeMap[size] || '1.5rem';
    
    // Build style CSS based on timer style
    let styleCSS = `font-size: ${fontSize}; font-weight: bold; color: ${color};`;
    if (style === 'neon' || glow) styleCSS += ` text-shadow: 0 0 10px ${glowColor}, 0 0 20px ${glowColor};`;
    if (style === 'urgent') styleCSS += ` animation: pulse 0.5s infinite;`;
    if (style === 'minimal') styleCSS += ` font-weight: 400;`;
    if (style === 'fire') styleCSS = `font-size: ${fontSize}; font-weight: bold; color: #ff6600; text-shadow: 0 0 10px #ff3300, 0 0 20px #ff0000;`;
    
    // Update preview box
    const box = document.getElementById('running-timer-preview-box');
    if (box) {
        box.style.background = bg + 'e0';
        box.style.borderColor = border;
        box.style.boxShadow = glow ? `0 5px 30px rgba(0,0,0,0.5), 0 0 20px ${glowColor}40, 0 0 40px ${glowColor}20` : '0 5px 30px rgba(0,0,0,0.5)';
    }
    
    // Update label
    const labelEl = document.getElementById('running-timer-preview-label');
    if (labelEl) {
        labelEl.textContent = label;
        labelEl.style.color = style === 'fire' ? '#ff6600' : color;
    }
    
    // Update digits
    document.querySelectorAll('.running-timer-digit').forEach(el => {
        el.style.cssText = styleCSS;
    });
}

function setRunningTimerColor(color) {
    const colorInput = document.querySelector('[name="running_timer_color"]');
    const textInput = colorInput?.nextElementSibling;
    if (colorInput) {
        colorInput.value = color;
        if (textInput) textInput.value = color;
        updateRunningTimerPreview();
    }
}

async function saveRunningTimerSettings() {
    const form = document.getElementById('running-timer-form');
    if (!form) return;
    
    try {
        await api('/admin/config/bulk', {
            method: 'PUT',
            body: {
                settings: {
                    running_timer_color: form.running_timer_color.value,
                    running_timer_bg: form.running_timer_bg.value,
                    running_timer_border: form.running_timer_border.value,
                    running_timer_size: form.running_timer_size.value,
                    running_timer_style: form.running_timer_style.value,
                    running_timer_label: form.running_timer_label.value,
                    running_timer_glow: form.running_timer_glow.checked ? '1' : '0',
                    running_timer_glow_color: form.running_timer_glow_color?.value || form.running_timer_color.value,
                    running_timer_visible: form.running_timer_visible.checked ? '1' : '0',
                    running_timer_position: form.running_timer_position.value,
                    // Also update legacy keys
                    timer_color_end: form.running_timer_color.value,
                    timer_color_ending: form.running_timer_color.value,
                    ending_timer_bg: form.running_timer_bg.value,
                    ending_timer_style: form.running_timer_style.value,
                    ending_timer_size: form.running_timer_size.value
                }
            }
        });
        await loadSiteConfig();
        showToast('Running timer settings saved! Refresh homepage to see changes.', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function renderAdminCodeEditor(content) {
    // Redirect to new page editor
    await renderAdminPageEditor(content);
}

async function renderAdminTimerSettings(content) {
    const config = await api('/admin/config');
    
    content.innerHTML = `
        <h1 class="mb-4">⏱️ Timer Settings</h1>
        <p class="text-secondary mb-4">Customize the appearance of countdown timers for opening and ending pages.</p>
        
        <div class="grid grid-2" style="gap: 1.5rem;">
            <!-- Opening Timer (Countdown) -->
            <div class="card">
                <h3 class="card-title mb-3">🚀 Opening Timer (Countdown)</h3>
                <p class="text-muted mb-3">Timer shown before the CTF starts</p>
                <form onsubmit="saveOpeningTimerConfig(event)">
                    <div class="form-group">
                        <label class="form-label">Timer Color</label>
                        <div class="flex gap-1">
                            <input type="color" name="timer_color_countdown" value="${config.timer_color_countdown || '#00ff88'}" style="width: 50px; height: 40px; border: none; cursor: pointer;" oninput="this.nextElementSibling.value = this.value; updateOpeningPreview()">
                            <input type="text" class="form-input" value="${config.timer_color_countdown || '#00ff88'}" style="flex: 1;" oninput="this.previousElementSibling.value = this.value; updateOpeningPreview()">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Background Color</label>
                        <div class="flex gap-1">
                            <input type="color" name="timer_bg_color" value="${config.timer_bg_color || '#0a0a1a'}" style="width: 50px; height: 40px; border: none; cursor: pointer;" oninput="this.nextElementSibling.value = this.value; updateOpeningPreview()">
                            <input type="text" class="form-input" value="${config.timer_bg_color || '#0a0a1a'}" style="flex: 1;" oninput="this.previousElementSibling.value = this.value; updateOpeningPreview()">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Font Size</label>
                        <select name="timer_font_size" class="form-input" onchange="updateOpeningPreview()">
                            <option value="small" ${config.timer_font_size === 'small' ? 'selected' : ''}>Small (2rem)</option>
                            <option value="medium" ${config.timer_font_size === 'medium' ? 'selected' : ''}>Medium (3rem)</option>
                            <option value="large" ${!config.timer_font_size || config.timer_font_size === 'large' ? 'selected' : ''}>Large (4rem)</option>
                            <option value="xlarge" ${config.timer_font_size === 'xlarge' ? 'selected' : ''}>Extra Large (5rem)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Timer Style</label>
                        <select name="timer_style" class="form-input" onchange="updateOpeningPreview()">
                            <option value="digital" ${!config.timer_style || config.timer_style === 'digital' ? 'selected' : ''}>Digital (Bold)</option>
                            <option value="minimal" ${config.timer_style === 'minimal' ? 'selected' : ''}>Minimal (Light)</option>
                            <option value="neon" ${config.timer_style === 'neon' ? 'selected' : ''}>Neon Glow</option>
                            <option value="matrix" ${config.timer_style === 'matrix' ? 'selected' : ''}>Matrix (Green)</option>
                            <option value="retro" ${config.timer_style === 'retro' ? 'selected' : ''}>Retro (RGB)</option>
                            <option value="gradient" ${config.timer_style === 'gradient' ? 'selected' : ''}>Gradient</option>
                            <option value="cyber" ${config.timer_style === 'cyber' ? 'selected' : ''}>Cyber Pulse</option>
                            <option value="fire" ${config.timer_style === 'fire' ? 'selected' : ''}>Fire</option>
                        </select>
                    </div>
                    
                    <div class="form-group" style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px; margin-top: 1rem;">
                        <label style="display: block; margin-bottom: 0.5rem; color: var(--text-muted); font-size: 0.9rem;">Preview</label>
                        <div id="opening-timer-preview" style="background: ${config.timer_bg_color || '#0a0a1a'}; padding: 1rem; border-radius: 8px; text-align: center;">
                            <div style="color: ${config.timer_color_countdown || '#00ff88'}; font-size: 0.8rem; margin-bottom: 0.5rem;">🚀 STARTS IN</div>
                            <div style="display: flex; gap: 1rem; justify-content: center;">
                                <span id="opening-preview-text" style="font-size: 2rem; font-weight: bold; color: ${config.timer_color_countdown || '#00ff88'};">05:12:34:56</span>
                            </div>
                        </div>
                    </div>
                    
                    <button type="submit" class="btn btn-primary mt-3">Save Opening Timer</button>
                </form>
            </div>
            
            <!-- Ending Timer (Running) -->
            <div class="card">
                <h3 class="card-title mb-3">🔥 Ending Timer (Running)</h3>
                <p class="text-muted mb-3">Timer shown while CTF is running (time remaining)</p>
                <form onsubmit="saveEndingTimerConfig(event)">
                    <div class="form-group">
                        <label class="form-label">Timer Color</label>
                        <div class="flex gap-1">
                            <input type="color" name="timer_color_ending" value="${config.timer_color_ending || '#ffa502'}" style="width: 50px; height: 40px; border: none; cursor: pointer;" oninput="this.nextElementSibling.value = this.value; updateEndingPreview()">
                            <input type="text" class="form-input" value="${config.timer_color_ending || '#ffa502'}" style="flex: 1;" oninput="this.previousElementSibling.value = this.value; updateEndingPreview()">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Background Color</label>
                        <div class="flex gap-1">
                            <input type="color" name="ending_timer_bg" value="${config.ending_timer_bg || '#1a0a0a'}" style="width: 50px; height: 40px; border: none; cursor: pointer;" oninput="this.nextElementSibling.value = this.value; updateEndingPreview()">
                            <input type="text" class="form-input" value="${config.ending_timer_bg || '#1a0a0a'}" style="flex: 1;" oninput="this.previousElementSibling.value = this.value; updateEndingPreview()">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Font Size</label>
                        <select name="ending_timer_size" class="form-input" onchange="updateEndingPreview()">
                            <option value="small" ${config.ending_timer_size === 'small' ? 'selected' : ''}>Small</option>
                            <option value="medium" ${!config.ending_timer_size || config.ending_timer_size === 'medium' ? 'selected' : ''}>Medium</option>
                            <option value="large" ${config.ending_timer_size === 'large' ? 'selected' : ''}>Large</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Timer Style</label>
                        <select name="ending_timer_style" class="form-input" onchange="updateEndingPreview()">
                            <option value="digital" ${!config.ending_timer_style || config.ending_timer_style === 'digital' ? 'selected' : ''}>Digital</option>
                            <option value="urgent" ${config.ending_timer_style === 'urgent' ? 'selected' : ''}>Urgent (Pulsing)</option>
                            <option value="minimal" ${config.ending_timer_style === 'minimal' ? 'selected' : ''}>Minimal</option>
                            <option value="neon" ${config.ending_timer_style === 'neon' ? 'selected' : ''}>Neon</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Position</label>
                        <select name="ending_timer_position" class="form-input">
                            <option value="right" ${!config.ending_timer_position || config.ending_timer_position === 'right' ? 'selected' : ''}>Right Side (Fixed)</option>
                            <option value="top" ${config.ending_timer_position === 'top' ? 'selected' : ''}>Top Center</option>
                            <option value="bottom" ${config.ending_timer_position === 'bottom' ? 'selected' : ''}>Bottom Center</option>
                        </select>
                    </div>
                    
                    <div class="form-group" style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px; margin-top: 1rem;">
                        <label style="display: block; margin-bottom: 0.5rem; color: var(--text-muted); font-size: 0.9rem;">Preview</label>
                        <div id="ending-timer-preview" style="background: ${config.ending_timer_bg || '#1a0a0a'}; padding: 1rem; border-radius: 8px; text-align: center;">
                            <div style="color: ${config.timer_color_ending || '#ffa502'}; font-size: 0.8rem; margin-bottom: 0.5rem;">🔥 ENDS IN</div>
                            <div style="display: flex; gap: 1rem; justify-content: center;">
                                <span id="ending-preview-text" style="font-size: 1.8rem; font-weight: bold; color: ${config.timer_color_ending || '#ffa502'};">23:45:12</span>
                            </div>
                        </div>
                    </div>
                    
                    <button type="submit" class="btn btn-primary mt-3">Save Ending Timer</button>
                </form>
            </div>
        </div>
        
        <div class="card mt-4">
            <h3 class="card-title mb-3">🎨 Timer Styles Reference</h3>
            <div class="grid grid-4" style="gap: 1rem;">
                <div style="background: #0a0a1a; padding: 1rem; border-radius: 8px; text-align: center;">
                    <span style="font-size: 1.5rem; font-weight: bold; color: #00ff88;">12:34</span>
                    <p style="color: #888; font-size: 0.8rem; margin-top: 0.5rem;">Digital</p>
                </div>
                <div style="background: #0a0a1a; padding: 1rem; border-radius: 8px; text-align: center;">
                    <span style="font-size: 1.5rem; font-weight: 300; color: #00ff88;">12:34</span>
                    <p style="color: #888; font-size: 0.8rem; margin-top: 0.5rem;">Minimal</p>
                </div>
                <div style="background: #0a0a1a; padding: 1rem; border-radius: 8px; text-align: center;">
                    <span style="font-size: 1.5rem; font-weight: bold; color: #00ff88; text-shadow: 0 0 10px #00ff88, 0 0 20px #00ff88;">12:34</span>
                    <p style="color: #888; font-size: 0.8rem; margin-top: 0.5rem;">Neon</p>
                </div>
                <div style="background: #0a0a1a; padding: 1rem; border-radius: 8px; text-align: center;">
                    <span style="font-size: 1.5rem; font-weight: bold; color: #00ff00; text-shadow: 0 0 10px #00ff00; font-family: monospace;">12:34</span>
                    <p style="color: #888; font-size: 0.8rem; margin-top: 0.5rem;">Matrix</p>
                </div>
            </div>
        </div>
    `;
}

function updateOpeningPreview() {
    const form = document.querySelector('form[onsubmit*="saveOpeningTimerConfig"]');
    if (!form) return;
    
    const color = form.timer_color_countdown.value;
    const bg = form.timer_bg_color.value;
    const style = form.timer_style.value;
    const size = form.timer_font_size.value;
    
    const sizeMap = { small: '1.5rem', medium: '2rem', large: '2.5rem', xlarge: '3rem' };
    const fontSize = sizeMap[size] || '2rem';
    
    let styleCSS = `font-size: ${fontSize}; font-weight: bold; color: ${color};`;
    if (style === 'neon') styleCSS += `text-shadow: 0 0 10px ${color}, 0 0 20px ${color};`;
    else if (style === 'matrix') styleCSS += `color: #00ff00; text-shadow: 0 0 10px #00ff00; font-family: monospace;`;
    else if (style === 'minimal') styleCSS += `font-weight: 300;`;
    else if (style === 'retro') styleCSS += `font-family: monospace; text-shadow: 2px 2px 0 #ff0000, -2px -2px 0 #00ff00;`;
    else if (style === 'cyber') styleCSS += `text-shadow: 0 0 5px ${color}, 0 0 10px ${color}; animation: pulse 1s infinite;`;
    else if (style === 'fire') styleCSS += `color: #ff6600; text-shadow: 0 0 10px #ff3300, 0 0 20px #ff0000;`;
    
    const preview = document.getElementById('opening-timer-preview');
    const text = document.getElementById('opening-preview-text');
    if (preview) preview.style.background = bg;
    if (text) text.style.cssText = styleCSS;
}

function updateEndingPreview() {
    const form = document.querySelector('form[onsubmit*="saveEndingTimerConfig"]');
    if (!form) return;
    
    const color = form.timer_color_ending.value;
    const bg = form.ending_timer_bg.value;
    const style = form.ending_timer_style.value;
    const size = form.ending_timer_size.value;
    
    const sizeMap = { small: '1.2rem', medium: '1.8rem', large: '2.2rem' };
    const fontSize = sizeMap[size] || '1.8rem';
    
    let styleCSS = `font-size: ${fontSize}; font-weight: bold; color: ${color};`;
    if (style === 'urgent') styleCSS += `animation: pulse 0.5s infinite;`;
    else if (style === 'neon') styleCSS += `text-shadow: 0 0 10px ${color}, 0 0 20px ${color};`;
    else if (style === 'minimal') styleCSS += `font-weight: 400;`;
    
    const preview = document.getElementById('ending-timer-preview');
    const text = document.getElementById('ending-preview-text');
    if (preview) preview.style.background = bg;
    if (text) text.style.cssText = styleCSS;
}

async function saveOpeningTimerConfig(e) {
    e.preventDefault();
    const form = e.target;
    
    try {
        await api('/admin/config/bulk', {
            method: 'PUT',
            body: {
                settings: {
                    timer_color_countdown: form.timer_color_countdown.value,
                    timer_bg_color: form.timer_bg_color.value,
                    timer_font_size: form.timer_font_size.value,
                    timer_style: form.timer_style.value
                }
            }
        });
        await loadSiteConfig();
        showToast('Opening timer saved! Refresh to see changes.', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function saveEndingTimerConfig(e) {
    e.preventDefault();
    const form = e.target;
    
    try {
        await api('/admin/config/bulk', {
            method: 'PUT',
            body: {
                settings: {
                    timer_color_ending: form.timer_color_ending.value,
                    ending_timer_bg: form.ending_timer_bg.value,
                    ending_timer_size: form.ending_timer_size.value,
                    ending_timer_style: form.ending_timer_style.value,
                    ending_timer_position: form.ending_timer_position.value
                }
            }
        });
        await loadSiteConfig();
        showToast('Ending timer saved! Refresh to see changes.', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function renderAdminConfig(content) {
    const config = await api('/admin/config');
    
    content.innerHTML = `
        <h1 class="mb-4">Settings</h1>
        
        <div class="card mb-4">
            <h3 class="card-title mb-3">🔒 Challenge Access Control</h3>
            <div class="form-group">
                <label class="toggle-switch" style="display: flex; align-items: center; gap: 1rem; cursor: pointer;">
                    <input type="checkbox" id="challenges_visible_toggle" ${config.challenges_visible !== '0' ? 'checked' : ''} onchange="toggleChallengesVisibility(this.checked)">
                    <span class="toggle-slider"></span>
                    <span style="font-size: 1.1rem;">Challenges Visible to Participants</span>
                </label>
                <small class="text-muted" style="display: block; margin-top: 0.5rem;">
                    When OFF, participants cannot view or access challenges. Useful for blocking access after the event ends.
                </small>
            </div>
            <div id="challenges_status" class="mt-2" style="padding: 0.75rem; border-radius: 8px; ${config.challenges_visible !== '0' ? 'background: rgba(0,255,136,0.1); color: #00ff88;' : 'background: rgba(255,71,87,0.1); color: #ff4757;'}">
                ${config.challenges_visible !== '0' ? '✅ Challenges are currently VISIBLE to all participants' : '🚫 Challenges are currently HIDDEN from participants'}
            </div>
            <div class="mt-3" style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px;">
                <p class="text-muted" style="margin: 0; font-size: 0.9rem;">
                    💡 <strong>Note:</strong> Challenges are automatically hidden before the event starts and after it ends (based on timer settings).
                    This toggle is for manual override control.
                </p>
            </div>
        </div>
        
        <div class="card mb-4">
            <h3 class="card-title mb-3">📊 Scoreboard Access Control</h3>
            <div class="form-group">
                <label class="toggle-switch" style="display: flex; align-items: center; gap: 1rem; cursor: pointer;">
                    <input type="checkbox" id="scoreboard_visible_toggle" ${config.scoreboard_visible !== '0' ? 'checked' : ''} onchange="toggleScoreboardVisibility(this.checked)">
                    <span class="toggle-slider"></span>
                    <span style="font-size: 1.1rem;">Scoreboard Visible to Participants</span>
                </label>
                <small class="text-muted" style="display: block; margin-top: 0.5rem;">
                    When OFF, participants cannot view the scoreboard. Useful for hiding results during or after the event.
                </small>
            </div>
            <div id="scoreboard_status" class="mt-2" style="padding: 0.75rem; border-radius: 8px; ${config.scoreboard_visible !== '0' ? 'background: rgba(0,255,136,0.1); color: #00ff88;' : 'background: rgba(255,71,87,0.1); color: #ff4757;'}">
                ${config.scoreboard_visible !== '0' ? '✅ Scoreboard is currently VISIBLE to all participants' : '🚫 Scoreboard is currently HIDDEN from participants'}
            </div>
            <div class="mt-3" style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px;">
                <p class="text-muted" style="margin: 0; font-size: 0.9rem;">
                    💡 <strong>Note:</strong> This toggle gives admin manual control to show/hide the scoreboard whenever needed.
                    Admins can always see the scoreboard regardless of this setting.
                </p>
            </div>
        </div>
        
        <div class="card mb-4">
            <h3 class="card-title mb-3">🏅 Rank Display</h3>
            <div class="form-group">
                <label class="toggle-switch" style="display: flex; align-items: center; gap: 1rem; cursor: pointer;">
                    <input type="checkbox" id="rank_visible_toggle" ${config.show_rank !== '0' ? 'checked' : ''} onchange="toggleRankVisibility(this.checked)">
                    <span class="toggle-slider"></span>
                    <span style="font-size: 1.1rem;">Show Rank on User & Team Profiles</span>
                </label>
                <small class="text-muted" style="display: block; margin-top: 0.5rem;">
                    When ON, users and teams see their scoreboard position (e.g., #1, #2) on their profile pages.
                </small>
            </div>
        </div>
        
        <div class="card mb-4">
            <h3 class="card-title mb-3">🔐 Admin Credentials</h3>
            <p class="text-muted mb-3">Update your admin username and password</p>
            <form onsubmit="updateAdminCredentials(event)">
                <div class="form-group">
                    <label class="form-label">Current Password *</label>
                    <input type="password" name="current_password" class="form-input" required placeholder="Enter current password">
                </div>
                <div class="grid grid-2" style="gap: 1rem;">
                    <div class="form-group">
                        <label class="form-label">New Username (leave empty to keep current)</label>
                        <input type="text" name="new_username" class="form-input" placeholder="${escapeHtml(currentUser?.username || '')}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">New Password (leave empty to keep current)</label>
                        <input type="password" name="new_password" class="form-input" placeholder="Min 6 characters">
                    </div>
                </div>
                <button type="submit" class="btn btn-primary">Update Credentials</button>
            </form>
        </div>
        
        <div class="card mb-4">
            <h3 class="card-title mb-3">🎮 Event Mode</h3>
            <form onsubmit="savePlayModeConfig(event)">
                <div class="form-group">
                    <label class="form-label">Competition Mode</label>
                    <select name="play_mode" class="form-input">
                        <option value="both" ${(config.play_mode || 'both') === 'both' ? 'selected' : ''}>Both (Individual + Team)</option>
                        <option value="individual" ${config.play_mode === 'individual' ? 'selected' : ''}>Individual Only</option>
                        <option value="team" ${config.play_mode === 'team' ? 'selected' : ''}>Team Only</option>
                    </select>
                    <small class="text-muted">Controls whether users can play individually, in teams, or both</small>
                </div>
                <div class="form-group">
                    <label class="form-label">Max Team Members</label>
                    <input type="number" name="max_team_members" class="form-input" value="${config.max_team_members || 4}" min="1" max="50" style="width: 150px;">
                    <small class="text-muted">Maximum number of members allowed per team</small>
                </div>
                <button type="submit" class="btn btn-primary">Save Event Mode</button>
            </form>
        </div>
        
        <div class="card mb-4">
            <h3 class="card-title mb-3">⚙️ General Settings</h3>
            <form onsubmit="saveConfig(event)">
                <div class="form-group">
                    <label class="form-label">CTF Name</label>
                    <input type="text" name="ctf_name" class="form-input" value="${escapeHtml(config.ctf_name || '')}">
                </div>
                <div class="form-group">
                    <label class="form-label">Description</label>
                    <textarea name="ctf_description" class="form-input">${escapeHtml(config.ctf_description || '')}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Challenge Categories (comma-separated)</label>
                    <input type="text" name="categories" class="form-input" value="${escapeHtml(config.categories || 'Crypto,Web,Forensics,Pwn,Reversing,Misc,OSINT')}">
                    <small class="text-muted">These will appear in the challenge creation dropdown</small>
                </div>
                <div class="form-group">
                    <label class="form-label">
                        <input type="checkbox" name="registration_open" ${config.registration_open === '1' ? 'checked' : ''}> Registration Open
                    </label>
                </div>
                <div class="form-group">
                    <label class="form-label">
                        <input type="checkbox" name="require_login_challenges" ${config.require_login_challenges === '1' ? 'checked' : ''}> Require Login to View Challenges
                    </label>
                    <small class="text-muted" style="display: block; margin-top: 0.25rem;">If enabled, users must login to see challenges</small>
                </div>
                <div class="form-group">
                    <label class="form-label">
                        <input type="checkbox" name="hide_scores_public" ${config.hide_scores_public === '1' ? 'checked' : ''}> Hide Scoreboard from Public
                    </label>
                    <small class="text-muted" style="display: block; margin-top: 0.25rem;">Require login to view scoreboard</small>
                </div>
                <button type="submit" class="btn btn-primary">Save Settings</button>
            </form>
        </div>
        
        <div class="card mb-4">
            <h3 class="card-title mb-3">📧 Email Configuration <span class="badge badge-info" style="font-size: 0.7rem;">Optional</span></h3>
            <div class="info-box mb-3" style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px; border-left: 3px solid var(--info);">
                <strong>What is this?</strong> Email is used for password reset and account verification. If you don't need these features, leave disabled.
                <br><br>
                <strong>Gmail Setup:</strong> Use <code>smtp.gmail.com</code>, port <code>587</code>. The <strong>SMTP Username must be your full Gmail address</strong> (e.g. you@gmail.com). Use an <strong>App Password</strong> (not your Gmail password). Create one at: Google Account → Security → 2-Step Verification → App Passwords.
            </div>
            <form onsubmit="saveEmailConfig(event)">
                <div class="form-group">
                    <label class="form-label">
                        <input type="checkbox" name="email_enabled" ${config.email_enabled === '1' ? 'checked' : ''}> <strong>Enable Email Features</strong>
                    </label>
                    <small class="text-muted" style="display: block;">Turn on to enable password reset and email verification</small>
                </div>
                <div class="form-group">
                    <label class="form-label">
                        <input type="checkbox" name="require_email_verification" ${config.require_email_verification === '1' ? 'checked' : ''}> Require Email Verification for New Users
                    </label>
                </div>
                <div class="grid grid-2" style="gap: 1rem;">
                    <div class="form-group">
                        <label class="form-label">SMTP Host</label>
                        <input type="text" name="email_smtp_host" class="form-input" value="${escapeHtml(config.email_smtp_host || '')}" placeholder="smtp.gmail.com">
                    </div>
                    <div class="form-group">
                        <label class="form-label">SMTP Port</label>
                        <input type="number" name="email_smtp_port" class="form-input" value="${config.email_smtp_port || '587'}" placeholder="587 for TLS, 465 for SSL">
                    </div>
                </div>
                <div class="grid grid-2" style="gap: 1rem;">
                    <div class="form-group">
                        <label class="form-label">SMTP Username <small style="color:#ff9800;">(full email address)</small></label>
                        <input type="text" name="email_smtp_user" class="form-input" value="${escapeHtml(config.email_smtp_user || '')}" placeholder="your-email@gmail.com">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Password / App Password</label>
                        <input type="password" name="email_smtp_password" class="form-input" placeholder="Leave blank to keep current">
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">From Email Address</label>
                    <input type="text" name="email_from" class="form-input" value="${escapeHtml(config.email_from || '')}" placeholder="noreply@yourctf.com">
                    <small class="text-muted">The sender address shown in emails. Defaults to SMTP username if left blank.</small>
                </div>
                <div class="form-group">
                    <label class="form-label">Your CTF URL (for email links)</label>
                    <input type="url" name="email_base_url" class="form-input" value="${escapeHtml(config.email_base_url || 'http://localhost:3000')}" placeholder="https://ctf.yoursite.com">
                    <small class="text-muted">The URL users will click in emails. Use your actual domain in production.</small>
                </div>
                <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                    <button type="submit" class="btn btn-primary">Save Email Settings</button>
                    <button type="button" class="btn btn-secondary" onclick="testEmail()">🧪 Send Test Email</button>
                </div>
                <div id="email-test-result" class="mt-2" style="display:none;"></div>
            </form>
        </div>
        
        <div class="card mb-4">
            <h3 class="card-title mb-3">📝 Email Templates</h3>
            <div class="info-box mb-3" style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px; border-left: 3px solid var(--info);">
                <strong>Custom Templates:</strong> Upload your own HTML email templates. Use these placeholders:
                <code>{{CTF_NAME}}</code>, <code>{{USERNAME}}</code>, <code>{{ACTION_URL}}</code>, <code>{{ACTION_LABEL}}</code>.
                Leave empty to use the default template.
            </div>
            <div class="form-group">
                <label class="form-label">Template Type</label>
                <select id="email_template_type" class="form-input" onchange="loadEmailTemplate()">
                    <option value="verification">Verification Email</option>
                    <option value="reset">Password Reset Email</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">HTML Template</label>
                <textarea id="email_template_html" class="form-input" rows="10" placeholder="Paste your custom HTML here... Use {{CTF_NAME}}, {{USERNAME}}, {{ACTION_URL}}, {{ACTION_LABEL}} as placeholders." style="font-family: monospace; font-size: 0.85rem;"></textarea>
            </div>
            <div class="form-group">
                <label class="form-label">Or Upload HTML File</label>
                <input type="file" id="email_template_file" accept=".html,.htm" class="form-input" onchange="loadTemplateFile(this)">
            </div>
            <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                <button class="btn btn-primary" onclick="saveEmailTemplate()">Save Template</button>
                <button class="btn btn-secondary" onclick="previewEmailTemplate()">👁 Preview</button>
                <button class="btn btn-danger" onclick="resetEmailTemplate()">Reset to Default</button>
            </div>
            <div id="email-template-preview" class="mt-3" style="display:none; background:#111; border:1px solid #333; border-radius:8px; padding:1rem;"></div>
        </div>
        
        <div class="card mb-4">
            <h3 class="card-title mb-3">📨 Send Custom Email</h3>
            <form onsubmit="sendBroadcastEmail(event)">
                <div class="form-group">
                    <label class="form-label">Recipients</label>
                    <select name="broadcast_recipients" class="form-input">
                        <option value="all">All Users (non-banned)</option>
                        <option value="verified">Verified Users Only</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Subject</label>
                    <input type="text" name="broadcast_subject" class="form-input" required placeholder="Email subject line">
                </div>
                <div class="form-group">
                    <label class="form-label">Email Body (HTML)</label>
                    <textarea name="broadcast_html" class="form-input" rows="8" required placeholder="Write your email content here. HTML is supported." style="font-family: monospace; font-size: 0.85rem;"></textarea>
                </div>
                <div class="form-group">
                    <label class="form-label">Or Upload HTML Email</label>
                    <input type="file" accept=".html,.htm" class="form-input" onchange="loadBroadcastFile(this)">
                </div>
                <button type="submit" class="btn btn-primary">📤 Send to All</button>
                <div id="broadcast-result" class="mt-2" style="display:none;"></div>
            </form>
        </div>
        
        <div class="card mb-4">
            <h3 class="card-title mb-3">📁 File Storage <span class="badge badge-info" style="font-size: 0.7rem;">Optional</span></h3>
            <div class="info-box mb-3" style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px; border-left: 3px solid var(--info);">
                <strong>What is this?</strong> Where challenge files are stored. "Local" saves files on this server. "S3" saves to cloud storage (Amazon S3, DigitalOcean Spaces, MinIO, etc.)
                <br><br>
                <strong>Recommendation:</strong> Use "Local" unless you need cloud storage for scalability.
            </div>
            <form onsubmit="saveStorageConfig(event)">
                <div class="form-group">
                    <label class="form-label">Storage Type</label>
                    <select name="storage_type" class="form-input" onchange="document.getElementById('s3-settings').style.opacity = this.value === 's3' ? '1' : '0.5'; document.getElementById('s3-settings').style.pointerEvents = this.value === 's3' ? 'auto' : 'none';">
                        <option value="local" ${config.storage_type === 'local' ? 'selected' : ''}>Local (files saved on this server)</option>
                        <option value="s3" ${config.storage_type === 's3' ? 'selected' : ''}>S3-compatible Cloud Storage</option>
                    </select>
                </div>
                <div id="s3-settings" style="${config.storage_type !== 's3' ? 'opacity: 0.5; pointer-events: none;' : ''}">
                    <div class="grid grid-2" style="gap: 1rem;">
                        <div class="form-group">
                            <label class="form-label">S3 Endpoint URL</label>
                            <input type="url" name="storage_s3_endpoint" class="form-input" value="${escapeHtml(config.storage_s3_endpoint || '')}" placeholder="https://s3.amazonaws.com">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Bucket Name</label>
                            <input type="text" name="storage_s3_bucket" class="form-input" value="${escapeHtml(config.storage_s3_bucket || '')}" placeholder="my-ctf-files">
                        </div>
                    </div>
                    <div class="grid grid-2" style="gap: 1rem;">
                        <div class="form-group">
                            <label class="form-label">Access Key ID</label>
                            <input type="text" name="storage_s3_access_key" class="form-input" value="${escapeHtml(config.storage_s3_access_key || '')}">
                        </div>
                        <div class="form-group">
                            <label class="form-label">Secret Access Key</label>
                            <input type="password" name="storage_s3_secret_key" class="form-input" placeholder="Leave blank to keep current">
                        </div>
                    </div>
                </div>
                <button type="submit" class="btn btn-primary">Save Storage Settings</button>
            </form>
        </div>
        
        <div class="card mb-4">
            <h3 class="card-title mb-3">💾 Backup & Restore</h3>
            <p class="text-muted mb-3">Export all CTF data (challenges, users, teams, scores) for backup. Import to restore.</p>
            <div style="display: flex; gap: 1rem;">
                <a href="/api/admin/export" class="btn btn-secondary" download>📤 Download Backup</a>
                <label class="btn btn-secondary" style="cursor: pointer;">
                    📥 Restore from Backup
                    <input type="file" accept=".json" style="display: none;" onchange="importCTFData(this)">
                </label>
            </div>
        </div>
    `;
}

async function saveTimingConfig(e) {
    e.preventDefault();
    const form = e.target;
    
    try {
        await api('/admin/config/bulk', {
            method: 'PUT',
            body: {
                settings: {
                    ctf_start: form.ctf_start.value ? new Date(form.ctf_start.value).toISOString() : '',
                    ctf_end: form.ctf_end.value ? new Date(form.ctf_end.value).toISOString() : '',
                    score_freeze_time: form.score_freeze_time.value ? new Date(form.score_freeze_time.value).toISOString() : ''
                }
            }
        });
        await loadSiteConfig();
        showToast('Timing settings saved!', 'success');
        // Refresh the section to show updated display
        loadAdminSection('config');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function setQuickTime(field, offset) {
    const input = document.querySelector(`[name="ctf_${field}"]`);
    if (!input) return;
    
    let date = new Date();
    if (offset === 'now') {
        // Round to next 5 minutes
        date.setMinutes(Math.ceil(date.getMinutes() / 5) * 5, 0, 0);
    } else if (offset === '1h') {
        date.setHours(date.getHours() + 1);
        date.setMinutes(0, 0, 0);
    } else if (offset === '1d') {
        date.setDate(date.getDate() + 1);
        date.setHours(date.getHours(), 0, 0, 0);
    }
    
    // Format for datetime-local input
    const formatted = date.toISOString().slice(0, 16);
    input.value = formatted;
    updateTimingPreview();
}

function setQuickDuration(duration) {
    const startInput = document.querySelector('[name="ctf_start"]');
    const endInput = document.querySelector('[name="ctf_end"]');
    if (!startInput || !endInput) return;
    
    let startDate;
    if (startInput.value) {
        startDate = new Date(startInput.value);
    } else {
        // If no start time, use now
        startDate = new Date();
        startDate.setMinutes(Math.ceil(startDate.getMinutes() / 5) * 5, 0, 0);
        startInput.value = startDate.toISOString().slice(0, 16);
    }
    
    let endDate = new Date(startDate);
    if (duration === '24h') endDate.setHours(endDate.getHours() + 24);
    else if (duration === '48h') endDate.setHours(endDate.getHours() + 48);
    else if (duration === '72h') endDate.setHours(endDate.getHours() + 72);
    
    endInput.value = endDate.toISOString().slice(0, 16);
    updateTimingPreview();
}

function updateTimingPreview() {
    const startInput = document.querySelector('[name="ctf_start"]');
    const endInput = document.querySelector('[name="ctf_end"]');
    const startDisplay = document.getElementById('timing-start-display');
    const endDisplay = document.getElementById('timing-end-display');
    
    if (startDisplay && startInput) {
        startDisplay.textContent = startInput.value ? formatDateTime(startInput.value) : 'Not Set';
    }
    if (endDisplay && endInput) {
        endDisplay.textContent = endInput.value ? formatDateTime(endInput.value) : 'Not Set';
    }
}

async function toggleChallengesVisibility(visible) {
    try {
        await api('/admin/config', {
            method: 'PUT',
            body: { key: 'challenges_visible', value: visible ? '1' : '0' }
        });
        await loadSiteConfig();
        
        const statusEl = document.getElementById('challenges_status');
        if (statusEl) {
            if (visible) {
                statusEl.style.background = 'rgba(0,255,136,0.1)';
                statusEl.style.color = '#00ff88';
                statusEl.innerHTML = '✅ Challenges are currently VISIBLE to all participants';
            } else {
                statusEl.style.background = 'rgba(255,71,87,0.1)';
                statusEl.style.color = '#ff4757';
                statusEl.innerHTML = '🚫 Challenges are currently HIDDEN from participants';
            }
        }
        showToast(visible ? 'Challenges are now visible!' : 'Challenges are now hidden!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function toggleScoreboardVisibility(visible) {
    try {
        await api('/admin/config', {
            method: 'PUT',
            body: { key: 'scoreboard_visible', value: visible ? '1' : '0' }
        });
        await loadSiteConfig();
        
        const statusEl = document.getElementById('scoreboard_status');
        if (statusEl) {
            if (visible) {
                statusEl.style.background = 'rgba(0,255,136,0.1)';
                statusEl.style.color = '#00ff88';
                statusEl.innerHTML = '✅ Scoreboard is currently VISIBLE to all participants';
            } else {
                statusEl.style.background = 'rgba(255,71,87,0.1)';
                statusEl.style.color = '#ff4757';
                statusEl.innerHTML = '🚫 Scoreboard is currently HIDDEN from participants';
            }
        }
        showToast(visible ? 'Scoreboard is now visible!' : 'Scoreboard is now hidden!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function toggleRankVisibility(visible) {
    try {
        await api('/admin/config', { method: 'PUT', body: { key: 'show_rank', value: visible ? '1' : '0' } });
        await loadSiteConfig();
        showToast(visible ? 'Rank is now visible on profiles!' : 'Rank is now hidden from profiles!', 'success');
    } catch (err) { showToast(err.message, 'error'); }
}

async function renderAdminWaves(content) {
    const config = await api('/admin/config');
    const data = await api('/admin/challenges');
    
    let configuredWaves = [];
    let activeWaves = [];
    try { configuredWaves = JSON.parse(config.configured_waves || '[]'); } catch(e) {}
    try { activeWaves = JSON.parse(config.active_waves || '[]'); } catch(e) {}
    
    content.innerHTML = `
        <h1 class="mb-4">🌊 Wave Management</h1>
        <div class="info-box mb-3" style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px; border-left: 3px solid var(--info);">
            <strong>How Waves Work:</strong> Create waves (including Wave 0) and assign challenges to them. Toggle waves ON/OFF to reveal/hide sets of challenges simultaneously. When waves are configured, <strong>only challenges in active (toggled ON) waves are visible</strong> to participants. Challenges with "No Wave" are not visible until assigned to an active wave. Individual challenge "Hidden" toggle still takes priority.
        </div>
        
        <div class="card mb-4">
            <h3 class="card-title mb-3">Configured Waves</h3>
            <div id="wave-list" style="display: flex; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1rem;">
                ${configuredWaves.length === 0 ? '<p class="text-muted">No waves configured. Add one below.</p>' : ''}
                ${configuredWaves.map(w => `
                    <div style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; border-radius: 8px; border: 2px solid ${activeWaves.includes(w) ? '#00ff88' : 'var(--border)'}; background: ${activeWaves.includes(w) ? 'rgba(0,255,136,0.1)' : 'var(--bg-secondary)'};">
                        <label style="cursor: pointer; display: flex; align-items: center; gap: 0.5rem;">
                            <input type="checkbox" ${activeWaves.includes(w) ? 'checked' : ''} onchange="toggleWave(${w}, this.checked)">
                            <strong>Wave ${w}</strong>
                        </label>
                        <span class="text-muted" style="font-size: 0.85rem;">(${data.challenges.filter(c => c.wave === w).length} challenges)</span>
                        <button class="btn btn-danger btn-small" onclick="removeWave(${w})" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">✕</button>
                    </div>
                `).join('')}
            </div>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
                <input type="number" id="new-wave-number" class="form-input" placeholder="Wave number (0+)" min="0" style="max-width: 150px;">
                <button class="btn btn-primary btn-small" onclick="addWave()">+ Add Wave</button>
            </div>
        </div>
        
        <div class="card">
            <h3 class="card-title mb-3">Challenge Wave Assignments</h3>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Challenge</th>
                            <th>Category</th>
                            <th>Points</th>
                            <th>Wave</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.challenges.map(c => `
                            <tr>
                                <td>${escapeHtml(c.title)}</td>
                                <td>${c.category}</td>
                                <td>${c.points}</td>
                                <td>
                                    <select class="form-input" style="max-width: 130px; padding: 0.3rem;" onchange="updateChallengeWave(${c.id}, parseInt(this.value))">
                                        ${configuredWaves.includes(0) ? '' : `<option value="0" ${c.wave === 0 || !c.wave ? 'selected' : ''}>No Wave</option>`}
                                        ${configuredWaves.map(w => `<option value="${w}" ${c.wave === w ? 'selected' : ''}>Wave ${w}</option>`).join('')}
                                    </select>
                                </td>
                                <td>
                                    <span class="badge ${c.is_hidden ? 'badge-warning' : (configuredWaves.length > 0 && !activeWaves.includes(c.wave) ? 'badge-secondary' : 'badge-success')}">
                                        ${c.is_hidden ? 'Hidden' : (configuredWaves.length > 0 && !activeWaves.includes(c.wave) ? 'Wave Off' : 'Visible')}
                                    </span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function addWave() {
    const input = document.getElementById('new-wave-number');
    const num = parseInt(input.value);
    if (isNaN(num) || num < 0) { showToast('Enter a valid wave number (0 or higher)', 'error'); return; }
    
    let waves = [];
    try { waves = JSON.parse(siteConfig.configured_waves || '[]'); } catch(e) {}
    if (waves.includes(num)) { showToast('Wave ' + num + ' already exists', 'error'); return; }
    
    waves.push(num);
    waves.sort((a, b) => a - b);
    
    await api('/admin/config', { method: 'PUT', body: { key: 'configured_waves', value: JSON.stringify(waves) } });
    await loadSiteConfig();
    loadAdminSection('waves');
    showToast('Wave ' + num + ' added', 'success');
}

async function removeWave(num) {
    if (!confirm('Remove Wave ' + num + '? Challenges assigned to it will be set to No Wave.')) return;
    
    let waves = [];
    let active = [];
    try { waves = JSON.parse(siteConfig.configured_waves || '[]'); } catch(e) {}
    try { active = JSON.parse(siteConfig.active_waves || '[]'); } catch(e) {}
    
    waves = waves.filter(w => w !== num);
    active = active.filter(w => w !== num);
    
    // Reset challenges in this wave to wave 0
    const data = await api('/admin/challenges');
    for (const c of data.challenges) {
        if (c.wave === num) {
            await api('/admin/challenges/' + c.id, { method: 'PUT', body: { ...c, wave: 0 } });
        }
    }
    
    await api('/admin/config/bulk', { method: 'PUT', body: { settings: { configured_waves: JSON.stringify(waves), active_waves: JSON.stringify(active) } } });
    await loadSiteConfig();
    loadAdminSection('waves');
    showToast('Wave ' + num + ' removed', 'success');
}

async function toggleWave(num, active) {
    let waves = [];
    try { waves = JSON.parse(siteConfig.active_waves || '[]'); } catch(e) {}
    
    if (active && !waves.includes(num)) waves.push(num);
    else if (!active) waves = waves.filter(w => w !== num);
    
    waves.sort((a, b) => a - b);
    await api('/admin/config', { method: 'PUT', body: { key: 'active_waves', value: JSON.stringify(waves) } });
    await loadSiteConfig();
    loadAdminSection('waves');
    showToast('Wave ' + num + (active ? ' activated' : ' deactivated'), 'success');
}

async function updateChallengeWave(challengeId, wave) {
    try {
        const data = await api('/admin/challenges');
        const c = data.challenges.find(ch => ch.id === challengeId);
        if (c) {
            await api('/admin/challenges/' + challengeId, { method: 'PUT', body: { ...c, wave } });
            showToast('Challenge wave updated', 'success');
        }
    } catch(err) { showToast(err.message, 'error'); }
}

async function saveTimerConfig(e) {
    e.preventDefault();
    const form = e.target;
    
    try {
        await api('/admin/config/bulk', {
            method: 'PUT',
            body: {
                settings: {
                    timer_color_start: form.timer_color_start.value,
                    timer_color_end: form.timer_color_end.value,
                    timer_bg: form.timer_bg.value,
                    timer_style: form.timer_style.value,
                    timer_font_size: form.timer_font_size.value,
                    timer_show_on_all_pages: form.timer_show_on_all_pages.checked ? '1' : '0'
                }
            }
        });
        await loadSiteConfig();
        showToast('Timer settings saved! Refresh to see changes.', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function updateTimerPreview() {
    const form = document.querySelector('form[onsubmit*="saveTimerConfig"]');
    if (!form) return;
    
    const colorStart = form.timer_color_start.value;
    const colorEnd = form.timer_color_end.value;
    const bg = form.timer_bg.value;
    const style = form.timer_style.value;
    const size = form.timer_font_size.value;
    
    const sizeMap = { small: '1.2rem', medium: '1.5rem', large: '1.8rem', xlarge: '2rem' };
    const fontSize = sizeMap[size] || '1.5rem';
    
    let startStyleCSS = '';
    let endStyleCSS = '';
    
    if (style === 'neon') {
        startStyleCSS = `text-shadow: 0 0 10px ${colorStart}, 0 0 20px ${colorStart};`;
        endStyleCSS = `text-shadow: 0 0 10px ${colorEnd}, 0 0 20px ${colorEnd};`;
    } else if (style === 'matrix') {
        startStyleCSS = `color: #00ff00 !important; text-shadow: 0 0 10px #00ff00; font-family: 'Courier New', monospace;`;
        endStyleCSS = startStyleCSS;
    } else if (style === 'minimal') {
        startStyleCSS = `font-weight: 300;`;
        endStyleCSS = `font-weight: 300;`;
    } else if (style === 'retro') {
        startStyleCSS = `font-family: 'Courier New', monospace; text-shadow: 2px 2px 0 #ff0000, -2px -2px 0 #00ff00;`;
        endStyleCSS = startStyleCSS;
    } else if (style === 'gradient') {
        startStyleCSS = `background: linear-gradient(135deg, ${colorStart}, #00ccff); -webkit-background-clip: text; -webkit-text-fill-color: transparent;`;
        endStyleCSS = `background: linear-gradient(135deg, ${colorEnd}, #ff6b6b); -webkit-background-clip: text; -webkit-text-fill-color: transparent;`;
    }
    
    // Update start preview
    const startPrev = document.getElementById('timer-preview-start');
    const startText = document.getElementById('preview-start-text');
    if (startPrev) {
        startPrev.style.background = bg;
        startPrev.style.borderColor = colorStart + '40';
        startPrev.querySelector('div').style.color = colorStart;
    }
    if (startText) {
        startText.style.fontSize = fontSize;
        startText.style.color = colorStart;
        startText.style.cssText += startStyleCSS;
    }
    
    // Update end preview
    const endPrev = document.getElementById('timer-preview-end');
    const endText = document.getElementById('preview-end-text');
    if (endPrev) {
        endPrev.style.background = bg;
        endPrev.style.borderColor = colorEnd + '40';
        endPrev.querySelector('div').style.color = colorEnd;
    }
    if (endText) {
        endText.style.fontSize = fontSize;
        endText.style.color = colorEnd;
        endText.style.cssText += endStyleCSS;
    }
}

async function saveEmailConfig(e) {
    e.preventDefault();
    const form = e.target;
    
    const settings = {
        email_enabled: form.email_enabled.checked ? '1' : '0',
        require_email_verification: form.require_email_verification.checked ? '1' : '0',
        email_from: form.email_from.value,
        email_smtp_host: form.email_smtp_host.value,
        email_smtp_port: form.email_smtp_port.value,
        email_smtp_user: form.email_smtp_user.value,
        email_base_url: form.email_base_url.value
    };
    
    if (form.email_smtp_password.value) {
        settings.email_smtp_password = form.email_smtp_password.value;
    }
    
    try {
        await api('/admin/config/bulk', { method: 'PUT', body: { settings } });
        showToast('Email settings saved!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function testEmail() {
    const to = prompt('Enter recipient email address to send test email:');
    if (!to) return;
    const el = document.getElementById('email-test-result');
    el.style.display = 'block';
    el.innerHTML = '<span style="color:#ffc107;">⏳ Sending test email...</span>';
    try {
        const data = await api('/admin/email/test', { method: 'POST', body: { to } });
        el.innerHTML = '<span style="color:#00ff88;">✅ ' + escapeHtml(data.message) + '</span>';
        showToast('Test email sent!', 'success');
    } catch (err) {
        el.innerHTML = '<span style="color:#ff4757;">❌ ' + escapeHtml(err.message) + '</span>';
        showToast(err.message, 'error');
    }
}

async function loadEmailTemplate() {
    const type = document.getElementById('email_template_type').value;
    try {
        const data = await api('/admin/email/template/' + type);
        document.getElementById('email_template_html').value = data.html || '';
    } catch(e) {}
}

function loadTemplateFile(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('email_template_html').value = e.target.result;
    };
    reader.readAsText(file);
}

async function saveEmailTemplate() {
    const type = document.getElementById('email_template_type').value;
    const html = document.getElementById('email_template_html').value;
    try {
        await api('/admin/email/template', { method: 'PUT', body: { type, html } });
        showToast('Template saved!', 'success');
    } catch(err) {
        showToast(err.message, 'error');
    }
}

async function resetEmailTemplate() {
    if (!confirm('Reset this template to the default?')) return;
    const type = document.getElementById('email_template_type').value;
    try {
        await api('/admin/email/template', { method: 'PUT', body: { type, html: '' } });
        document.getElementById('email_template_html').value = '';
        showToast('Template reset to default', 'success');
    } catch(err) {
        showToast(err.message, 'error');
    }
}

function previewEmailTemplate() {
    const html = document.getElementById('email_template_html').value;
    const preview = document.getElementById('email-template-preview');
    if (!html) {
        preview.style.display = 'none';
        showToast('No template to preview. Enter HTML first.', 'info');
        return;
    }
    const rendered = html
        .replace(/\{\{CTF_NAME\}\}/g, 'MyCTF')
        .replace(/\{\{USERNAME\}\}/g, 'TestUser')
        .replace(/\{\{ACTION_URL\}\}/g, '#')
        .replace(/\{\{ACTION_LABEL\}\}/g, 'Click Here');
    preview.style.display = 'block';
    preview.innerHTML = rendered;
}

function loadBroadcastFile(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        input.closest('form').broadcast_html.value = e.target.result;
    };
    reader.readAsText(file);
}

async function sendBroadcastEmail(e) {
    e.preventDefault();
    if (!confirm('This will send an email to all selected recipients. Continue?')) return;
    const form = e.target;
    const el = document.getElementById('broadcast-result');
    el.style.display = 'block';
    el.innerHTML = '<span style="color:#ffc107;">⏳ Sending emails...</span>';
    try {
        const data = await api('/admin/email/send', { method: 'POST', body: {
            recipients: form.broadcast_recipients.value,
            subject: form.broadcast_subject.value,
            html: form.broadcast_html.value
        }});
        el.innerHTML = '<span style="color:#00ff88;">✅ ' + escapeHtml(data.message) + '</span>';
        showToast(data.message, 'success');
    } catch(err) {
        el.innerHTML = '<span style="color:#ff4757;">❌ ' + escapeHtml(err.message) + '</span>';
        showToast(err.message, 'error');
    }
}

async function saveStorageConfig(e) {
    e.preventDefault();
    const form = e.target;
    
    const settings = {
        storage_type: form.storage_type.value,
        storage_s3_endpoint: form.storage_s3_endpoint.value,
        storage_s3_bucket: form.storage_s3_bucket.value,
        storage_s3_access_key: form.storage_s3_access_key.value
    };
    
    if (form.storage_s3_secret_key.value) {
        settings.storage_s3_secret_key = form.storage_s3_secret_key.value;
    }
    
    try {
        await api('/admin/config/bulk', { method: 'PUT', body: { settings } });
        showToast('Storage settings saved!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function importCTFData(input) {
    if (!input.files || !input.files[0]) return;
    
    if (!confirm('This will import data from the selected file. Continue?')) {
        input.value = '';
        return;
    }
    
    const formData = new FormData();
    formData.append('file', input.files[0]);
    
    try {
        const res = await fetch('/api/admin/import', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error || 'Import failed');
        
        showToast('Data imported successfully!', 'success');
        input.value = '';
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function renderAdminBranding(content) {
    const config = await api('/admin/config');
    
    content.innerHTML = `
        <h1 class="mb-4">Branding</h1>
        
        <!-- Logo Section -->
        <div class="card mb-4">
            <h3 class="card-title mb-3">🖼️ Logo Image</h3>
            <div class="grid grid-2" style="gap: 2rem; align-items: start;">
                <div>
                    <div class="form-group">
                        <label class="form-label">Upload Logo</label>
                        <div style="display: flex; gap: 1rem; align-items: center;">
                            <input type="file" id="logo-upload" accept="image/*" style="display: none;" onchange="uploadLogo(this)">
                            <button type="button" class="btn btn-secondary" onclick="document.getElementById('logo-upload').click()">
                                📤 Choose Image
                            </button>
                            ${config.logo_image ? `
                                <button type="button" class="btn btn-danger btn-small" onclick="deleteLogo()">🗑️ Remove</button>
                            ` : ''}
                        </div>
                        <small class="text-muted" style="display: block; margin-top: 0.5rem;">Supported: PNG, JPEG, GIF, SVG, WebP. Recommended size: 40x40px to 60x60px</small>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Logo Position</label>
                        <div style="display: flex; gap: 1rem;">
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="radio" name="logo_position" value="left" ${config.logo_position !== 'right' ? 'checked' : ''} onchange="saveLogoPosition(this.value)">
                                <span>Left of text</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="radio" name="logo_position" value="right" ${config.logo_position === 'right' ? 'checked' : ''} onchange="saveLogoPosition(this.value)">
                                <span>Right of text</span>
                            </label>
                        </div>
                    </div>
                </div>
                <div>
                    <label class="form-label">Logo Preview</label>
                    <div id="logo-preview" style="background: var(--bg-secondary); padding: 1rem; border-radius: 8px; display: flex; align-items: center; gap: 0.75rem; ${config.logo_position === 'right' ? 'flex-direction: row-reverse;' : ''}">
                        ${config.logo_image ? `<img src="${escapeHtml(config.logo_image)}" alt="Logo" style="height: 40px; width: auto; max-width: 60px; object-fit: contain;">` : '<span style="color: var(--text-muted);">No logo uploaded</span>'}
                        <span style="font-size: 1.5rem; font-weight: bold; background: var(--gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${escapeHtml(config.logo_text || 'CTF')}<span class="brand-underscore">_</span></span>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="grid grid-2">
            <div class="card">
                <h3 class="card-title mb-3">Site Identity</h3>
                <form onsubmit="saveBranding(event)">
                    <div class="form-group">
                        <label class="form-label">Logo Text (Navbar)</label>
                        <input type="text" name="logo_text" class="form-input" value="${escapeHtml(config.logo_text || '')}" placeholder="Your CTF Name">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Hero Title</label>
                        <input type="text" name="hero_title" class="form-input" value="${escapeHtml(config.hero_title || '')}" placeholder="Main headline">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Hero Subtitle</label>
                        <textarea name="hero_subtitle" class="form-input" rows="4" placeholder="Welcome message...">${escapeHtml(config.hero_subtitle || '')}</textarea>
                    </div>
                    <button type="submit" class="btn btn-primary">Save Branding</button>
                </form>
            </div>
            <div class="card">
                <h3 class="card-title mb-3">Links & Footer</h3>
                <form onsubmit="saveLinks(event)">
                    <div class="form-group">
                        <label class="form-label">Discord URL</label>
                        <input type="url" name="discord_url" class="form-input" value="${escapeHtml(config.discord_url || '')}" placeholder="https://discord.gg/...">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Website URL</label>
                        <input type="url" name="website_url" class="form-input" value="${escapeHtml(config.website_url || '')}" placeholder="https://yoursite.com">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Footer Text</label>
                        <input type="text" name="footer_text" class="form-input" value="${escapeHtml(config.footer_text || '')}" placeholder="© 2024 Your CTF">
                    </div>
                    <button type="submit" class="btn btn-primary">Save Links</button>
                </form>
            </div>
        </div>
        <div class="card mt-4">
            <h3 class="card-title mb-3">Preview</h3>
            <div style="background: var(--bg-primary); padding: 2rem; border-radius: 8px; text-align: center;">
                <h2 style="font-size: 2rem; background: var(--gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">${escapeHtml(config.hero_title || 'Your CTF Name')}<span class="brand-underscore">_</span></h2>
                <p class="text-secondary mt-2">${escapeHtml(config.hero_subtitle || 'Your welcome message will appear here...')}</p>
            </div>
        </div>
    `;
}

async function uploadLogo(input) {
    if (!input.files || !input.files[0]) return;
    
    const formData = new FormData();
    formData.append('logo', input.files[0]);
    
    try {
        const response = await fetch('/api/admin/logo/upload', {
            method: 'POST',
            body: formData
        });
        
        // Check if response is ok
        if (!response.ok) {
            const text = await response.text();
            try {
                const data = JSON.parse(text);
                throw new Error(data.error || 'Upload failed');
            } catch (e) {
                throw new Error('Upload failed: ' + response.statusText);
            }
        }
        
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        await loadSiteConfig();
        showToast('Logo uploaded successfully!', 'success');
        renderAdminBranding(document.getElementById('admin-content'));
    } catch (err) {
        showToast(err.message || 'Failed to upload logo', 'error');
    }
}

async function deleteLogo() {
    if (!confirm('Are you sure you want to remove the logo?')) return;
    
    try {
        await api('/admin/logo', { method: 'DELETE' });
        await loadSiteConfig();
        showToast('Logo removed!', 'success');
        renderAdminBranding(document.getElementById('admin-content'));
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function saveLogoPosition(position) {
    try {
        await api('/admin/config', {
            method: 'PUT',
            body: { key: 'logo_position', value: position }
        });
        await loadSiteConfig();
        
        // Update preview
        const preview = document.getElementById('logo-preview');
        if (preview) {
            preview.style.flexDirection = position === 'right' ? 'row-reverse' : 'row';
        }
        showToast('Logo position saved!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function saveBranding(e) {
    e.preventDefault();
    const form = e.target;
    
    try {
        await api('/admin/config/bulk', {
            method: 'PUT',
            body: {
                settings: {
                    logo_text: form.logo_text.value,
                    hero_title: form.hero_title.value,
                    hero_subtitle: form.hero_subtitle.value
                }
            }
        });
        await loadSiteConfig();
        showToast('Branding saved!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function saveLinks(e) {
    e.preventDefault();
    const form = e.target;
    
    try {
        await api('/admin/config/bulk', {
            method: 'PUT',
            body: {
                settings: {
                    discord_url: form.discord_url.value,
                    website_url: form.website_url.value,
                    footer_text: form.footer_text.value
                }
            }
        });
        await loadSiteConfig();
        showToast('Links saved!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function renderAdminTheme(content) {
    const config = await api('/admin/config');
    
    const presets = {
        'cyber-green': { accent: '#00ff88', bg: '#0a0a0f', name: 'Cyber Green' },
        'hacker-blue': { accent: '#00d4ff', bg: '#0a0f14', name: 'Hacker Blue' },
        'purple-night': { accent: '#a855f7', bg: '#0f0a14', name: 'Purple Night' },
        'orange-fire': { accent: '#ff6b35', bg: '#0f0a0a', name: 'Orange Fire' },
        'blood-red': { accent: '#ff4757', bg: '#0a0a0f', name: 'Blood Red' },
        'gold-elite': { accent: '#ffd700', bg: '#0a0a0f', name: 'Gold Elite' },
        'matrix-green': { accent: '#39ff14', bg: '#000000', name: 'Matrix' },
        'synthwave': { accent: '#ff00ff', bg: '#0d0221', name: 'Synthwave' },
        'glassmorphism': { accent: '#60a5fa', bg: '#0f172a', name: 'Glassmorphism' },
        'custom': { accent: config.theme_accent || '#00ff88', bg: config.theme_bg_primary || '#0a0a0f', name: 'Custom' }
    };
    
    const currentPreset = config.theme_preset || 'cyber-green';
    
    content.innerHTML = `
        <h1 class="mb-4">Theme Customization</h1>
        
        <div class="card mb-4">
            <h3 class="card-title mb-3">Theme Presets</h3>
            <div class="theme-presets" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 1rem;">
                ${Object.entries(presets).map(([key, preset]) => `
                    <div class="theme-preset-card ${currentPreset === key ? 'active' : ''}" 
                         onclick="applyPreset('${key}')"
                         style="cursor: pointer; padding: 1rem; border-radius: 8px; border: 2px solid ${currentPreset === key ? preset.accent : 'var(--border)'}; background: ${preset.bg}; text-align: center; transition: all 0.2s;">
                        <div style="width: 40px; height: 40px; background: ${preset.accent}; border-radius: 50%; margin: 0 auto 0.5rem;"></div>
                        <div style="color: ${preset.accent}; font-weight: 600; font-size: 0.85rem;">${preset.name}</div>
                    </div>
                `).join('')}
            </div>
        </div>
        
        ${currentPreset === 'glassmorphism' ? `
        <div class="card mb-4" style="border: 1px solid rgba(96,165,250,0.3); background: rgba(30,41,59,0.3);">
            <h3 class="card-title mb-3">🔮 Glassmorphism Settings</h3>
            <p class="text-muted mb-3">Customize your glassmorphism theme colors. Changes are applied immediately.</p>
            <form onsubmit="saveGlassTheme(event)" id="glass-form">
                <div class="grid grid-3">
                    <div class="form-group">
                        <label class="form-label">Glass Accent Color</label>
                        <div class="flex gap-1">
                            <input type="color" name="glass_accent" value="${config.theme_accent || '#60a5fa'}" style="width: 50px; height: 40px; border: none; cursor: pointer;" oninput="this.nextElementSibling.value = this.value">
                            <input type="text" name="glass_accent_text" class="form-input" value="${config.theme_accent || '#60a5fa'}" style="flex: 1;" oninput="this.previousElementSibling.value = this.value">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Glass Background</label>
                        <div class="flex gap-1">
                            <input type="color" name="glass_bg" value="${config.theme_bg_primary || '#0f172a'}" style="width: 50px; height: 40px; border: none; cursor: pointer;" oninput="this.nextElementSibling.value = this.value">
                            <input type="text" name="glass_bg_text" class="form-input" value="${config.theme_bg_primary || '#0f172a'}" style="flex: 1;" oninput="this.previousElementSibling.value = this.value">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Text Color</label>
                        <div class="flex gap-1">
                            <input type="color" name="glass_text" value="${config.theme_text_primary || '#f1f5f9'}" style="width: 50px; height: 40px; border: none; cursor: pointer;" oninput="this.nextElementSibling.value = this.value">
                            <input type="text" name="glass_text_text" class="form-input" value="${config.theme_text_primary || '#f1f5f9'}" style="flex: 1;" oninput="this.previousElementSibling.value = this.value">
                        </div>
                    </div>
                </div>
                <div class="flex gap-2 mt-4">
                    <button type="submit" class="btn btn-primary">Apply Glass Colors</button>
                    <button type="button" class="btn btn-ghost" onclick="resetGlassTheme()">Reset to Default Blue</button>
                </div>
            </form>
        </div>
        ` : ''}
        
        <div class="card mb-4">
            <h3 class="card-title mb-3">Custom Colors</h3>
            <form onsubmit="saveTheme(event)" id="theme-form">
                <div class="grid grid-3">
                    <div class="form-group">
                        <label class="form-label">Accent Color</label>
                        <div class="flex gap-1">
                            <input type="color" name="theme_accent" value="${config.theme_accent || '#00ff88'}" style="width: 50px; height: 40px; border: none; cursor: pointer;" oninput="this.nextElementSibling.value = this.value">
                            <input type="text" name="theme_accent_text" class="form-input" value="${config.theme_accent || '#00ff88'}" style="flex: 1;" oninput="this.previousElementSibling.value = this.value">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Background Primary</label>
                        <div class="flex gap-1">
                            <input type="color" name="theme_bg_primary" value="${config.theme_bg_primary || '#0a0a0f'}" style="width: 50px; height: 40px; border: none; cursor: pointer;" oninput="this.nextElementSibling.value = this.value">
                            <input type="text" name="theme_bg_primary_text" class="form-input" value="${config.theme_bg_primary || '#0a0a0f'}" style="flex: 1;" oninput="this.previousElementSibling.value = this.value">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Background Secondary</label>
                        <div class="flex gap-1">
                            <input type="color" name="theme_bg_secondary" value="${config.theme_bg_secondary || '#12121a'}" style="width: 50px; height: 40px; border: none; cursor: pointer;" oninput="this.nextElementSibling.value = this.value">
                            <input type="text" name="theme_bg_secondary_text" class="form-input" value="${config.theme_bg_secondary || '#12121a'}" style="flex: 1;" oninput="this.previousElementSibling.value = this.value">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Card Background</label>
                        <div class="flex gap-1">
                            <input type="color" name="theme_bg_card" value="${config.theme_bg_card || '#15151f'}" style="width: 50px; height: 40px; border: none; cursor: pointer;" oninput="this.nextElementSibling.value = this.value">
                            <input type="text" name="theme_bg_card_text" class="form-input" value="${config.theme_bg_card || '#15151f'}" style="flex: 1;" oninput="this.previousElementSibling.value = this.value">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Text Primary</label>
                        <div class="flex gap-1">
                            <input type="color" name="theme_text_primary" value="${config.theme_text_primary || '#ffffff'}" style="width: 50px; height: 40px; border: none; cursor: pointer;" oninput="this.nextElementSibling.value = this.value">
                            <input type="text" name="theme_text_primary_text" class="form-input" value="${config.theme_text_primary || '#ffffff'}" style="flex: 1;" oninput="this.previousElementSibling.value = this.value">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Text Secondary</label>
                        <div class="flex gap-1">
                            <input type="color" name="theme_text_secondary" value="${config.theme_text_secondary || '#a0a0b0'}" style="width: 50px; height: 40px; border: none; cursor: pointer;" oninput="this.nextElementSibling.value = this.value">
                            <input type="text" name="theme_text_secondary_text" class="form-input" value="${config.theme_text_secondary || '#a0a0b0'}" style="flex: 1;" oninput="this.previousElementSibling.value = this.value">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Danger/Error Color</label>
                        <div class="flex gap-1">
                            <input type="color" name="theme_danger" value="${config.theme_danger || '#ff4757'}" style="width: 50px; height: 40px; border: none; cursor: pointer;" oninput="this.nextElementSibling.value = this.value">
                            <input type="text" name="theme_danger_text" class="form-input" value="${config.theme_danger || '#ff4757'}" style="flex: 1;" oninput="this.previousElementSibling.value = this.value">
                        </div>
                    </div>
                </div>
                <div class="flex gap-2 mt-4">
                    <button type="submit" class="btn btn-primary">Save Custom Theme</button>
                    <button type="button" class="btn btn-secondary" onclick="previewTheme()">Preview</button>
                    <button type="button" class="btn btn-ghost" onclick="resetTheme()">Reset to Default</button>
                </div>
            </form>
        </div>
        
        <div class="card">
            <h3 class="card-title mb-3">Live Preview</h3>
            <div id="theme-preview" style="padding: 1.5rem; border-radius: 8px; background: var(--bg-primary);">
                <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
                    <button class="btn btn-primary">Primary Button</button>
                    <button class="btn btn-secondary">Secondary Button</button>
                    <button class="btn btn-danger">Danger Button</button>
                </div>
                <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
                    <span class="badge badge-success">Success</span>
                    <span class="badge badge-danger">Danger</span>
                    <span class="badge badge-info">Info</span>
                </div>
                <p style="color: var(--text-primary);">Primary text looks like this.</p>
                <p style="color: var(--text-secondary);">Secondary text looks like this.</p>
                <p style="color: var(--accent);">Accent text looks like this.</p>
            </div>
        </div>
    `;
    
    // Sync color inputs
    document.querySelectorAll('input[type="color"]').forEach(input => {
        input.addEventListener('input', function() {
            const textInput = this.form[this.name + '_text'];
            if (textInput) textInput.value = this.value;
        });
    });
}

async function applyPreset(presetName) {
    const presets = {
        'cyber-green': { accent: '#00ff88', bg_primary: '#0a0a0f', bg_secondary: '#12121a', bg_card: '#15151f', text_primary: '#ffffff', text_secondary: '#a0a0b0', danger: '#ff4757' },
        'hacker-blue': { accent: '#00d4ff', bg_primary: '#0a0f14', bg_secondary: '#0f1820', bg_card: '#141f28', text_primary: '#ffffff', text_secondary: '#8899aa', danger: '#ff4757' },
        'purple-night': { accent: '#a855f7', bg_primary: '#0f0a14', bg_secondary: '#1a1225', bg_card: '#1f1730', text_primary: '#ffffff', text_secondary: '#9090a0', danger: '#ff4757' },
        'orange-fire': { accent: '#ff6b35', bg_primary: '#0f0a0a', bg_secondary: '#1a1210', bg_card: '#201815', text_primary: '#ffffff', text_secondary: '#a09090', danger: '#ff4757' },
        'blood-red': { accent: '#ff4757', bg_primary: '#0a0a0f', bg_secondary: '#12121a', bg_card: '#15151f', text_primary: '#ffffff', text_secondary: '#a0a0b0', danger: '#ff6b6b' },
        'gold-elite': { accent: '#ffd700', bg_primary: '#0a0a0f', bg_secondary: '#12121a', bg_card: '#15151f', text_primary: '#ffffff', text_secondary: '#a0a0b0', danger: '#ff4757' },
        'matrix-green': { accent: '#39ff14', bg_primary: '#000000', bg_secondary: '#0a0a0a', bg_card: '#111111', text_primary: '#ffffff', text_secondary: '#909090', danger: '#ff4757' },
        'synthwave': { accent: '#ff00ff', bg_primary: '#0d0221', bg_secondary: '#150530', bg_card: '#1a0840', text_primary: '#ffffff', text_secondary: '#b090c0', danger: '#ff4757' },
        'glassmorphism': { accent: '#60a5fa', bg_primary: '#0f172a', bg_secondary: 'rgba(30,41,59,0.7)', bg_card: 'rgba(30,41,59,0.5)', text_primary: '#f1f5f9', text_secondary: '#94a3b8', danger: '#f87171' }
    };
    
    const preset = presets[presetName];
    if (!preset) return;
    
    try {
        await api('/admin/config/bulk', {
            method: 'PUT',
            body: {
                settings: {
                    theme_preset: presetName,
                    theme_accent: preset.accent,
                    theme_bg_primary: preset.bg_primary,
                    theme_bg_secondary: preset.bg_secondary,
                    theme_bg_card: preset.bg_card,
                    theme_text_primary: preset.text_primary,
                    theme_text_secondary: preset.text_secondary,
                    theme_danger: preset.danger
                }
            }
        });
        await loadSiteConfig();
        showToast(`Applied ${presetName} theme!`, 'success');
        renderAdminTheme(document.getElementById('admin-content'));
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function saveGlassTheme(e) {
    e.preventDefault();
    const form = e.target;
    try {
        await api('/admin/config/bulk', {
            method: 'PUT',
            body: {
                settings: {
                    theme_preset: 'glassmorphism',
                    theme_accent: form.glass_accent.value,
                    theme_bg_primary: form.glass_bg.value,
                    theme_text_primary: form.glass_text.value,
                    theme_bg_secondary: form.glass_bg.value,
                    theme_bg_card: form.glass_bg.value
                }
            }
        });
        await loadSiteConfig();
        showToast('Glassmorphism colors updated!', 'success');
        renderAdminTheme(document.getElementById('admin-content'));
    } catch (err) { showToast(err.message, 'error'); }
}

async function resetGlassTheme() {
    try {
        await api('/admin/config/bulk', {
            method: 'PUT',
            body: {
                settings: {
                    theme_preset: 'glassmorphism',
                    theme_accent: '#60a5fa',
                    theme_bg_primary: '#0f172a',
                    theme_bg_secondary: '#0f172a',
                    theme_bg_card: '#0f172a',
                    theme_text_primary: '#f1f5f9',
                    theme_text_secondary: '#94a3b8',
                    theme_danger: '#f87171'
                }
            }
        });
        await loadSiteConfig();
        showToast('Glassmorphism reset to default blue!', 'success');
        renderAdminTheme(document.getElementById('admin-content'));
    } catch (err) { showToast(err.message, 'error'); }
}

function previewTheme() {
    const form = document.getElementById('theme-form');
    const root = document.documentElement;
    
    root.style.setProperty('--accent', form.theme_accent.value);
    root.style.setProperty('--bg-primary', form.theme_bg_primary.value);
    root.style.setProperty('--bg-secondary', form.theme_bg_secondary.value);
    root.style.setProperty('--bg-card', form.theme_bg_card.value);
    root.style.setProperty('--text-primary', form.theme_text_primary.value);
    root.style.setProperty('--text-secondary', form.theme_text_secondary.value);
    root.style.setProperty('--danger', form.theme_danger.value);
    
    showToast('Preview applied! Save to keep changes.', 'info');
}

async function saveTheme(e) {
    e.preventDefault();
    const form = e.target;
    
    try {
        await api('/admin/config/bulk', {
            method: 'PUT',
            body: {
                settings: {
                    theme_preset: 'custom',
                    theme_accent: form.theme_accent.value,
                    theme_bg_primary: form.theme_bg_primary.value,
                    theme_bg_secondary: form.theme_bg_secondary.value,
                    theme_bg_card: form.theme_bg_card.value,
                    theme_text_primary: form.theme_text_primary.value,
                    theme_text_secondary: form.theme_text_secondary.value,
                    theme_danger: form.theme_danger.value
                }
            }
        });
        await loadSiteConfig();
        showToast('Theme saved!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function resetTheme() {
    if (!confirm('Reset to default Cyber Green theme?')) return;
    await applyPreset('cyber-green');
}

async function saveConfig(e) {
    e.preventDefault();
    const form = e.target;
    
    try {
        await api('/admin/config/bulk', {
            method: 'PUT',
            body: {
                settings: {
                    ctf_name: form.ctf_name.value,
                    ctf_description: form.ctf_description.value,
                    categories: form.categories.value,
                    registration_open: form.registration_open.checked ? '1' : '0',
                    require_login_challenges: form.require_login_challenges.checked ? '1' : '0',
                    hide_scores_public: form.hide_scores_public.checked ? '1' : '0'
                }
            }
        });
        await loadSiteConfig();
        showToast('Settings saved!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function updateAdminCredentials(e) {
    e.preventDefault();
    const form = e.target;
    
    try {
        await api('/admin/credentials', {
            method: 'PUT',
            body: {
                current_password: form.current_password.value,
                new_username: form.new_username.value || undefined,
                new_password: form.new_password.value || undefined
            }
        });
        showToast('Credentials updated!', 'success');
        form.reset();
        if (form.new_username.value) {
            currentUser.username = form.new_username.value;
            updateAuthUI();
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function savePlayModeConfig(e) {
    e.preventDefault();
    const form = e.target;
    
    try {
        await api('/admin/config/bulk', {
            method: 'PUT',
            body: {
                settings: {
                    play_mode: form.play_mode.value,
                    max_team_members: form.max_team_members.value
                }
            }
        });
        await loadSiteConfig();
        showToast('Event mode saved!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Utility functions
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Inject custom HTML/CSS/JS code and execute scripts
function injectCustomCode(container, code) {
    // Create a wrapper div for the custom code
    const wrapper = document.createElement('div');
    wrapper.className = 'custom-code-wrapper';
    wrapper.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0;';
    
    // Parse the code
    const parser = new DOMParser();
    const doc = parser.parseFromString(code, 'text/html');
    
    // Extract and inject styles
    doc.querySelectorAll('style').forEach(style => {
        const newStyle = document.createElement('style');
        newStyle.textContent = style.textContent;
        wrapper.appendChild(newStyle);
    });
    
    // Extract and inject HTML (non-script, non-style elements)
    doc.body.childNodes.forEach(node => {
        if (node.nodeType === 1 && node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE') {
            wrapper.appendChild(node.cloneNode(true));
        }
    });
    
    // Insert at beginning of container
    container.insertBefore(wrapper, container.firstChild);
    
    // Execute scripts
    doc.querySelectorAll('script').forEach(script => {
        const newScript = document.createElement('script');
        if (script.src) {
            newScript.src = script.src;
        } else {
            newScript.textContent = script.textContent;
        }
        document.body.appendChild(newScript);
    });
}

function formatDate(date) {
    return new Date(date).toLocaleString();
}

function renderPagination(pagination, onClickFn) {
    if (pagination.pages <= 1) return '';
    
    let html = '<div class="pagination">';
    
    if (pagination.page > 1) {
        html += `<button class="pagination-btn" onclick="${onClickFn(pagination.page - 1)}">&laquo;</button>`;
    }
    
    for (let i = 1; i <= pagination.pages; i++) {
        html += `<button class="pagination-btn ${i === pagination.page ? 'active' : ''}" onclick="${onClickFn(i)}">${i}</button>`;
    }
    
    if (pagination.page < pagination.pages) {
        html += `<button class="pagination-btn" onclick="${onClickFn(pagination.page + 1)}">&raquo;</button>`;
    }
    
    html += '</div>';
    return html;
}

// Router
window.addEventListener('popstate', (e) => {
    const path = window.location.pathname;
    const parts = path.split('/').filter(Boolean);
    const page = parts[0] || 'home';
    const params = parts[1] ? { id: parts[1] } : {};
    renderPage(page, params);
    updateNavActive();
});

// Initialize
async function init() {
    // Load site config first (theme, branding)
    await loadSiteConfig();
    
    try {
        const data = await api('/auth/me');
        currentUser = data.user;
    } catch (err) {}
    
    updateAuthUI();
    
    // Parse current URL
    const path = window.location.pathname;
    const parts = path.split('/').filter(Boolean);
    currentPage = parts[0] || 'home';
    const params = parts[1] ? { id: parts[1] } : {};
    
    renderPage(currentPage, params);
    updateNavActive();
}

init();
