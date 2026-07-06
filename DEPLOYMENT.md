# Deployment Guide

This project is split into:

- `backend`: FastAPI API deployed to Render
- `frontend`: Next.js app deployed to Vercel
- Supabase: hosted database/auth/storage used by both apps
- Redis: optional but recommended cache used by the backend

## 1. Deploy The Backend To Render

### Option A: Render Blueprint

1. Push this repository to GitHub.
2. In Render, create a new Blueprint from the repository.
3. Render will read `render.yaml` and create `skill-mentor-ai-backend`.
4. Fill every `sync: false` environment variable in the Render dashboard.

Backend environment variables:

```env
APP_ENV=production
FRONTEND_URL=https://your-vercel-app.vercel.app
GEMINI_API_KEY=your_gemini_api_key
GEMINI_API_KEYS=
GEMINI_MODEL=gemini-3.1-flash-lite
GEMINI_EMBED_MODEL=text-embedding-004
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
ADMIN_API_KEY=your_admin_api_key
ADMIN_ALLOWED_EMAILS=admin@example.com
REDIS_URL=your_render_redis_or_key_value_url
JUDGE0_API_URL=https://ce.judge0.com
JUDGE0_API_KEY=
```

### Option B: Manual Render Web Service

Use these settings:

```text
Root Directory: backend
Environment: Docker
Dockerfile Path: ./Dockerfile
Health Check Path: /health
```

The Dockerfile now uses Render's `$PORT` value automatically.

After deploy, open:

```text
https://your-render-service.onrender.com/health
```

## 2. Deploy The Frontend To Vercel

Create a Vercel project from the same GitHub repository and set:

```text
Root Directory: frontend
Framework Preset: Next.js
Install Command: npm install
Build Command: npm run build
Output Directory: leave default
```

Frontend environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_API_URL=https://your-render-service.onrender.com
BACKEND_API_URL=https://your-render-service.onrender.com
NEXT_PUBLIC_APP_URL=https://your-vercel-app.vercel.app
ADMIN_API_KEY=your_admin_api_key
ADMIN_ALLOWED_EMAILS=admin@example.com
NEXT_PUBLIC_VAPI_PUBLIC_KEY=your_vapi_public_key_if_using_voice_interviews
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

Redeploy the Vercel project after changing environment variables.

## 3. Connect Render And Vercel

After Vercel gives you the final frontend URL:

1. Go back to Render.
2. Set `FRONTEND_URL` to the Vercel production URL.
3. Redeploy the backend.

This value controls backend CORS, so it must match the actual Vercel origin without a trailing slash.

## 4. Supabase Setup

Run the SQL files in `backend/scripts` against your Supabase database before using the app. At minimum, apply the base schema and the later feature migrations in order.

Also configure Supabase Auth redirect URLs:

```text
https://your-vercel-app.vercel.app/auth/callback
http://localhost:3000/auth/callback
```

## 5. Smoke Test

Check these URLs after both deploys finish:

```text
Backend root:   https://your-render-service.onrender.com/
Backend health: https://your-render-service.onrender.com/health
Frontend:       https://your-vercel-app.vercel.app
```

If `/health` returns `degraded`, inspect the booleans in the response. Most first-deploy issues are missing Supabase tables, an invalid Gemini key, or a Redis URL that has not been added yet.
