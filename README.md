# 🚩 CYkrypt CTF Platform

A full-featured, self-hosted Capture The Flag (CTF) competition platform built with Node.js, Express, and SQLite.

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![License](https://img.shields.io/badge/License-MIT-blue)
![Platform](https://img.shields.io/badge/Platform-Linux%20%7C%20Windows-lightgrey)

## ✨ Features

- **Challenge System** — Create challenges with categories, points, hints, files, links, and wave-based release
- **Team System** — Create/join teams with invite codes, team scoring, and configurable team size
- **Scoreboard** — Real-time leaderboard with score graphs, freeze, and CSV export
- **Admin Panel** — Full control: user/team management, branding, themes, email, timers, and more
- **Email System** — SMTP integration for verification, password reset, and bulk announcements
- **Security** — Rate limiting, DDoS protection, bcrypt hashing, Helmet.js headers, brute-force protection
- **Customization** — Themes, custom CSS/JS, page editor, opening/ending pages, logo upload
- **Wave System** — Release challenges in groups (Wave 1, Wave 2, etc.) for staged competitions
- **Timer System** — Opening countdown, running timer, and ending display with style customization
- **Data Management** — JSON import/export, CSV download, database refresh between events

> See [features.txt](features.txt) for a complete feature breakdown.

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18 or higher
- **npm** (comes with Node.js)
- **Python 3** + **build tools** (required for `better-sqlite3` compilation)

---

### 🐧 Linux Setup

```bash
# 1. Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 2. Install build tools
sudo apt install -y build-essential python3

# 3. Clone the repository
git clone https://github.com/YOUR_USERNAME/ctf-platform.git
cd ctf-platform

# 4. Install dependencies
npm install

# 5. Start the server
npm start
```

Open your browser: **http://localhost:3000**

---

### 🪟 Windows Setup

#### Option A: Direct Install

1. **Install Node.js 18+**
   - Download from [https://nodejs.org](https://nodejs.org)
   - Run the installer — check "Automatically install necessary tools" when prompted
   - This installs Node.js, npm, and build tools (Python, Visual Studio Build Tools)

2. **Clone and run**
   ```cmd
   git clone https://github.com/YOUR_USERNAME/ctf-platform.git
   cd ctf-platform
   npm install
   npm start
   ```

3. Open your browser: **http://localhost:3000**

#### Option B: Using WSL (Recommended for Windows)

1. **Enable WSL**
   ```powershell
   wsl --install
   ```
   Restart your computer.

2. **Open Ubuntu from Start Menu**, then follow the Linux setup above.

#### Troubleshooting Windows Build Errors

If `npm install` fails on `better-sqlite3`:

```cmd
# Install Windows Build Tools (run as Administrator)
npm install -g windows-build-tools

# Then retry
npm install
```

If you still have issues:
```cmd
npm install --build-from-source better-sqlite3
```

---

## 🔐 Default Admin Login

| Field    | Value       |
|----------|-------------|
| Username | `admin`     |
| Password | `admin123`  |

> ⚠️ **Change these immediately** after first login via Admin Panel > Settings > Admin Credentials.

Admin panel: **http://localhost:3000/admin**

---

## 📁 Project Structure

```
ctf-platform/
├── server.js           # Express server entry point
├── package.json        # Dependencies and scripts
├── database/
│   └── db.js           # SQLite database setup & migrations
├── middleware/
│   ├── auth.js         # Authentication middleware
│   ├── email.js        # Email sending (SMTP/Mailgun)
│   └── ddos.js         # DDoS protection middleware
├── routes/
│   ├── admin.js        # Admin API routes
│   ├── auth.js         # Auth routes (login/register/verify/reset)
│   ├── challenges.js   # Challenge & flag routes
│   ├── scoreboard.js   # Scoreboard routes
│   ├── teams.js        # Team management routes
│   └── users.js        # User profile routes
├── public/
│   ├── index.html      # SPA entry point
│   ├── js/app.js       # Frontend SPA application
│   └── css/style.css   # Styles
├── uploads/            # Uploaded files (avatars, challenge files)
└── exports/            # Data export files
```

---

## ⚙️ Configuration

All configuration is done through the **Admin Panel** (no config files to edit):

| Setting | Location |
|---------|----------|
| CTF Name & Branding | Admin > Branding |
| Theme Colors | Admin > Theme |
| Timers (start/end) | Admin > Opening/Running Timer |
| Email (SMTP) | Admin > Settings > Email |
| Challenges | Admin > Challenges |
| Waves | Admin > Waves |
| Scoreboard | Admin > Settings > Scoreboard |
| Registration | Admin > Settings |
| Custom Pages | Admin > Pages |

---

**Quick production start:**

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start server.js --name ctf-platform
pm2 save
pm2 startup
```

---

## 📧 Email Setup

1. Go to **Admin Panel > Settings > Email Configuration**
2. Enable email
3. Enter SMTP details:
   - Host: `smtp.gmail.com`
   - Port: `587`
   - Username: your full email address
   - Password: your app password (NOT regular password)
4. Save and test with the "Send Test Email" button

> For Gmail: Enable 2FA, then generate an App Password at https://myaccount.google.com/apppasswords

---

## 🛡️ Security

- **Rate Limiting**: API (200/min), flags (10/min), registration (10/hr), login (40/15min)
- **DDoS Protection**: 500 requests per 10 seconds threshold
- **Password Security**: bcrypt with 12 salt rounds
- **Headers**: Helmet.js with CSP, HSTS, X-Frame-Options
- **Sessions**: HTTPOnly, Secure, SameSite cookies
- **Database**: Prepared statements (SQL injection prevention)

---

## 📊 Data Management

**Export Data:**
- Admin Dashboard > Download buttons for CSV (users, teams, scoreboard)
- Admin Settings > Export/Import for full JSON backup

**Reset for New Event:**
- Admin Settings > Refresh Database
- Clears: users, teams, submissions, scores
- Keeps: challenges, admin account, all settings

---

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

---

## 📞 Support

- Open an issue on GitHub for bugs or feature requests
- Check the documentation files in the repository for detailed guides

---

**Built with ❤️ for the cybersecurity community**
