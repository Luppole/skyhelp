# SkyHelper

SkyHelper is a production-ready Hypixel SkyBlock analytics suite with a React frontend and FastAPI backend. It provides real time market intel (Bazaar flips, Auction House search, sniper), player analytics, and toolkits for profits, skills, and planning.

## Features
- Bazaar flip finder with price history and watchlist
- Auction House search across a full in-memory index
- AH BIN sniper with configurable thresholds
- Player stats, skills, slayers, and dungeons
- Net worth estimator
- Mayor and event tracker
- Responsive UI with mobile navigation and error boundary

## Architecture
- Frontend: React 19 + Vite + Recharts
- Backend: FastAPI + httpx + slowapi caching and rate limits
- Data: Hypixel API, playerdb for UUID lookup

## Requirements
- Node.js 18+
- Python 3.11+
- Hypixel API key (server side)

## Environment
Copy `.env.example` to `.env` and fill in your values.

```
HYPIXEL_API_KEY=your_key_here
ALLOWED_ORIGINS=http://localhost:5173
VITE_API_BASE=/api
REDIS_URL=redis://localhost:6379/0
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_ITEM_ICON_BASE=https://your-cdn.com/item/{id}
```

## Local development

Backend:
```
python -m venv .venv
.\.venv\Scripts\activate
pip install -r backend\requirements.txt
uvicorn backend.main:app --reload
```

Frontend:
```
npm install
npm run dev
```

## Production build
```
npm run build
npm run preview
```

## Health checks
```
GET /healthz
GET /api/status
```

## Supabase setup
Run the SQL in `supabase/schema.sql` inside the Supabase SQL editor. This creates:
- `events` for page view analytics
- `user_data` for saved presets/searches/alerts
- `user_portfolios` for portfolio sync

RLS policies are included to restrict access to the authenticated user.

### Storage for item images
Run `supabase/storage.sql` to create the `item-icons` bucket and policies.
Then set:
```
VITE_ITEM_ICON_BASE=https://YOUR_PROJECT.supabase.co/storage/v1/object/public/item-icons/{id}.png
```

### Optional: Icon importer (requires your licensed icon source)
If you have a licensed CDN with item icons, set:
```
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ICON_SOURCE_BASE=https://your-cdn.com/items/{id}.png
ICON_BUCKET=item-icons
```
Then run:
```
python -m backend.tools.icon_importer 200
```
This uploads icons into Supabase Storage for the UI to display.
