const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { getDb } = require('../database/db');

// Get email config
function getEmailConfig() {
    const db = getDb();
    const config = {};
    db.prepare('SELECT * FROM config WHERE key LIKE ?').all('email_%').forEach(c => {
        config[c.key] = c.value;
    });
    return config;
}

// Create transporter
function createTransporter() {
    const config = getEmailConfig();
    
    if (!config.email_enabled || config.email_enabled !== '1') {
        return null;
    }
    
    const port = parseInt(config.email_smtp_port) || 587;
    const isSSL = port === 465;
    
    const opts = {
        host: config.email_smtp_host || 'localhost',
        port: port,
        secure: isSSL,
        auth: config.email_smtp_user ? {
            user: config.email_smtp_user,
            pass: config.email_smtp_password || ''
        } : undefined,
        tls: { rejectUnauthorized: false }
    };
    
    console.log('[EMAIL] Creating transporter:', opts.host + ':' + opts.port, 'user:', opts.auth?.user || 'none');
    return nodemailer.createTransport(opts);
}

// Send email
async function sendEmail(to, subject, html, text) {
    const transporter = createTransporter();
    if (!transporter) {
        console.log('[EMAIL] Email not configured or disabled, skipping send');
        return { success: false, error: 'Email not configured or disabled' };
    }
    
    const config = getEmailConfig();
    const from = config.email_from || config.email_smtp_user || 'noreply@ctf.local';
    
    try {
        const info = await transporter.sendMail({
            from,
            to,
            subject,
            html,
            text: text || html.replace(/<[^>]*>/g, '')
        });
        console.log('[EMAIL] Sent to', to, '- messageId:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (err) {
        console.error('[EMAIL] Failed to send to', to, ':', err.message);
        return { success: false, error: err.message };
    }
}

// Generate verification token
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Get default verification HTML
function getDefaultVerificationHtml(ctfName, username, verifyUrl) {
    return `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; padding: 30px; border-radius: 12px; border: 1px solid #222;">
    <h2 style="color: #00ff88; margin-top: 0;">Welcome to ${ctfName}!</h2>
    <p style="color: #ccc;">Hi ${username},</p>
    <p style="color: #ccc;">Please verify your email address by clicking the button below:</p>
    <p style="text-align: center; margin: 30px 0;">
        <a href="${verifyUrl}" style="background: #00ff88; color: #000; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Verify Email</a>
    </p>
    <p style="color: #888;">Or copy this link: <a href="${verifyUrl}" style="color: #4aa3ff;">${verifyUrl}</a></p>
    <p style="color: #888;">This link expires in 24 hours.</p>
    <hr style="border: none; border-top: 1px solid #333; margin: 30px 0;">
    <p style="color: #666; font-size: 12px;">If you didn't create an account, please ignore this email.</p>
</div>`;
}

// Get default reset HTML
function getDefaultResetHtml(ctfName, username, resetUrl) {
    return `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; padding: 30px; border-radius: 12px; border: 1px solid #222;">
    <h2 style="color: #00ff88; margin-top: 0;">${ctfName} Password Reset</h2>
    <p style="color: #ccc;">Hi ${username},</p>
    <p style="color: #ccc;">We received a request to reset your password. Click the button below:</p>
    <p style="text-align: center; margin: 30px 0;">
        <a href="${resetUrl}" style="background: #00ff88; color: #000; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset Password</a>
    </p>
    <p style="color: #888;">Or copy this link: <a href="${resetUrl}" style="color: #4aa3ff;">${resetUrl}</a></p>
    <p style="color: #888;">This link expires in 1 hour.</p>
    <hr style="border: none; border-top: 1px solid #333; margin: 30px 0;">
    <p style="color: #666; font-size: 12px;">If you didn't request this, please ignore this email.</p>
</div>`;
}

// Apply custom template: replaces {{CTF_NAME}}, {{USERNAME}}, {{ACTION_URL}}, {{ACTION_LABEL}}
function applyTemplate(template, vars) {
    let html = template;
    for (const [key, val] of Object.entries(vars)) {
        html = html.replace(new RegExp('\\{\\{' + key + '\\}\\}', 'g'), val);
    }
    return html;
}

// Send verification email
async function sendVerificationEmail(user, token, req) {
    const config = getEmailConfig();
    const baseUrl = req ? `${req.protocol}://${req.get('host')}` : (config.email_base_url || 'http://localhost:3000');
    const ctfName = getDb().prepare('SELECT value FROM config WHERE key = ?').get('ctf_name')?.value || 'CTF';
    const verifyUrl = `${baseUrl}/verify?token=${token}`;
    
    let html;
    if (config.email_template_verification) {
        html = applyTemplate(config.email_template_verification, {
            CTF_NAME: ctfName, USERNAME: user.username, ACTION_URL: verifyUrl, ACTION_LABEL: 'Verify Email'
        });
    } else {
        html = getDefaultVerificationHtml(ctfName, user.username, verifyUrl);
    }
    
    return sendEmail(user.email, `Verify your ${ctfName} account`, html);
}

// Send password reset email
async function sendPasswordResetEmail(user, token, req) {
    const config = getEmailConfig();
    const baseUrl = req ? `${req.protocol}://${req.get('host')}` : (config.email_base_url || 'http://localhost:3000');
    const ctfName = getDb().prepare('SELECT value FROM config WHERE key = ?').get('ctf_name')?.value || 'CTF';
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;
    
    let html;
    if (config.email_template_reset) {
        html = applyTemplate(config.email_template_reset, {
            CTF_NAME: ctfName, USERNAME: user.username, ACTION_URL: resetUrl, ACTION_LABEL: 'Reset Password'
        });
    } else {
        html = getDefaultResetHtml(ctfName, user.username, resetUrl);
    }
    
    return sendEmail(user.email, `Reset your ${ctfName} password`, html);
}

// Send custom/broadcast email
async function sendCustomEmail(to, subject, html) {
    return sendEmail(to, subject, html);
}

module.exports = {
    sendEmail,
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendCustomEmail,
    generateToken,
    getEmailConfig
};
