# Strive UR Intelligence Tracker

Utilization Review authorization tracking for Strive Recovery of Fort Wayne.

## Deployment

This app auto-deploys to GitHub Pages via GitHub Actions on every push to `main`.

**Live URL:** https://providentanalytics.github.io/strive-ur

## Usage

- All data is stored in browser `localStorage` under key `strive_ur_v3`
- Import authorization data via the **Sunwave CSV Import** button
- Use **Settings → Export JSON** to back up your data
- Demo/test records are prefixed with "TEST" in patient first name

## Local Development

Open `index.html` directly in any modern browser — no build step required.

## Data Backup

Regularly export JSON backups via Settings. Data lives in the browser and is not synced across devices.
