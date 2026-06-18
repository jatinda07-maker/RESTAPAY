# RESTAPAY

Clean production project package.

## Files included

- `index.html` - RESTAPAY front-end
- `app.js` - application logic, dashboard calculations, Supabase persistence
- `styles.css` - UI styling
- `server.js` - Node server and Gemini invoice reader API
- `package.json` / `package-lock.json` - Node dependencies
- `.npmrc` - public npm registry for Render deploy
- `.env.example` - environment variable example
- `SUPABASE_APP_DATA_SETUP.sql` - Supabase app_data table setup
- `supabase_tables.sql` - supporting Supabase tables
- `assets/` - RESTAPAY logo and favicon

## Local start

```bash
npm install
npm start
```

Open:

```text
http://localhost:4173
```

## Render deploy

Build command:

```bash
npm install
```

Start command:

```bash
npm start
```

## Required environment variable

```text
GEMINI_API_KEY=your_key_here
```

## Supabase setup

Run `SUPABASE_APP_DATA_SETUP.sql` once in Supabase SQL Editor if cloud save/load is not working.

## Notes

This clean project excludes:
- `node_modules`
- old README package notes
- old ZIP packages
- backups
- temporary test files
- Git internals
