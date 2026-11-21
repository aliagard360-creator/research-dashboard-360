# RESEARCH DASHBOARD 360

A Smart Digital Research Governance, Monitoring, Analytics, and Knowledge Management System
for the Schools District of Aliaga, SDO Nueva Ecija, DepEd Region III.

*One Platform. One Dashboard. One Research Ecosystem.*

## Going live

To connect the free Supabase database and publish on GitHub Pages, follow **[SETUP.md](SETUP.md)**.
Without a database (empty `config.js`), the site runs in preview mode and keeps data only in the browser.

## First use (preview mode)

The site starts empty. The first visit shows **First-time setup**, where you create the
Super Administrator (for example username `RD360ADMIN`). Then, from the Admin Portal:

1. **School Management:** add the district's schools.
2. **User and Role Management:** create administrator and evaluator accounts (temporary passwords that must be changed at first sign-in), and approve teacher registrations.
3. **Home Page Editor:** add carousel slides, news, achievements, events, resources, Facebook posts and contact details, preview on desktop/tablet/mobile, then **Publish**.

## Local mode

While `assets/js/config.js` has no Supabase URL and key, everything is stored **only in the browser
that's being used**. Passwords are hashed (PBKDF2), but local mode is for trying the system, not for
real district data. Connecting Supabase (next step) gives one shared, secure database for everyone.

The Super Administrator can wipe everything under **System Settings → Erase all data**.

## Run locally

```bash
npx http-server research-dashboard-360 -p 5360 -c-1
```

Then open http://localhost:5360.

## Files

| Path | Purpose |
|---|---|
| `index.html` | Page shell and branded loading screen |
| `assets/img/` | Aliaga District logo and seal |
| `assets/css/app.css` | Design system (green/gold, pastel cards, responsive layout) |
| `assets/js/config.js` | Database connection settings |
| `assets/js/store.js` | Data layer, accounts, workflow rules, home page content |
| `assets/js/app.js` | Router, setup, sign-in, registration, password change |
| `assets/js/home.js` | Public home page (carousel, news, events, Facebook, contact) |
| `assets/js/cms.js` | Home Page Editor |
| `assets/js/shell.js` | Sidebar, top bar, phone bottom navigation, notifications |
| `assets/js/pages.js` | Pages shared by both portals |
| `assets/js/teacher.js` | Teacher dashboard and submission wizard |
| `assets/js/admin.js` | Administrator pages |

## Security measures

- Content Security Policy: only the site's own scripts can run (no inline scripts); fonts from Google Fonts, Facebook embeds and Supabase are the only outside sources allowed.
- The site refuses to display inside another website's frame (clickjacking protection).
- Passwords: at least 8 characters with letters and numbers; common passwords and passwords containing the person's name, username or email are refused; live strength meter.
- Sign-in pauses for 10 minutes after 5 wrong passwords, with the same message for real and unknown accounts.
- Sessions end after inactivity (15, 30, 60 or 120 minutes, set by the Super Administrator), with a one-minute warning.
- `.gitignore` blocks spreadsheets, backups, exports, keys and data folders from ever being uploaded to GitHub.
