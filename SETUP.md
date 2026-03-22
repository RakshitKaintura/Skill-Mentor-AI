# SkillMentor AI — Week 1 Setup Guide

## Prerequisites

| Tool          | Version  | Check with          |
|---------------|----------|---------------------|
| Node.js       | 18+      | `node --version`    |
| Python        | 3.11+    | `python --version`  |
| Git           | Any      | `git --version`     |

---

## Step 1 — Get Your API Keys

### Gemini API Key (Free)
1. Go to https://aistudio.google.com
2. Click **"Get API key"** → **"Create API key"**
3. Copy the key — it starts with `AIza...`

### Supabase Keys (Free)
1. Go to https://supabase.com → Create account
2. Click **"New Project"** → Name: `skillmentor` → pick region → set password
3. Wait ~2 minutes for setup
4. Go to **Settings → API**
5. Copy:
   - **Project URL** → looks like `https://xxxx.supabase.co`
   - **anon/public key** → for frontend
   - **service_role key** → for backend (keep secret!)

---

## Step 2 — Set Up the Database

1. In Supabase Dashboard → Click **"SQL Editor"** (left sidebar)
2. Click **"New query"**
3. Open the file `backend/scripts/schema.sql`
4. Copy the **entire file** → Paste into SQL Editor → Click **"Run"**
5. You should see: `Success. No rows returned`

---

## Step 3 — Create Storage Bucket

1. In Supabase Dashboard → Click **"Storage"** (left sidebar)
2. Click **"New bucket"**
3. Settings:
   - **Name:** `user-books`
   - **Public bucket:** OFF (unchecked)
   - **File size limit:** `52428800` (50MB in bytes)
4. Click **"Create bucket"**

---

## Step 4 — Configure Environment Files

### Backend `.env`
```bash
cd backend
cp .env.example .env
```
Edit `.env`:
```env
GEMINI_API_KEY=AIza...your_key
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGci...service_role_key
FRONTEND_URL=http://localhost:3000
APP_ENV=development
```

### Frontend `.env.local`
```bash
cd frontend
cp .env.example .env.local
```
Edit `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...anon_key
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## Step 5 — Start the Backend

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (Mac/Linux)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start server
uvicorn app.main:app --reload --port 8000
```

**Test it:** Open http://localhost:8000/health

Expected response:
```json
{
  "status": "healthy",
  "gemini_connected": true,
  "supabase_connected": true,
  "version": "1.0.0",
  "environment": "development"
}
```

Also check http://localhost:8000/docs for the full API documentation.

---

## Step 6 — Start the Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open http://localhost:3000 — landing page should appear!

---

## Step 7 — Test the Full Flow

1. **Register** at http://localhost:3000/auth/register
2. **Confirm email** (check your inbox, click link)
3. Complete the **5-step onboarding**:
   - Pick a skill (e.g. JavaScript)
   - Select your level
   - Choose your goal
   - Set daily time
   - Upload a PDF (optional)
4. Watch the **AI generate your roadmap** (takes 5–15 seconds)
5. You land on **Dashboard** — roadmap is live!

---

## Complete Checklist

```
□ Gemini API key obtained
□ Supabase project created
□ schema.sql executed successfully
□ user-books storage bucket created
□ backend/.env filled in
□ frontend/.env.local filled in
□ Backend running on port 8000
□ /health returns "status": "healthy"
□ Frontend running on port 3000
□ Registered an account successfully
□ Completed onboarding
□ Roadmap generated and visible on dashboard
```

---

## Troubleshooting

### "gemini_connected: false"
- Check `GEMINI_API_KEY` in `backend/.env`
- Make sure you copied the full key from aistudio.google.com

### "supabase_connected: false"
- Check `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in `backend/.env`
- Make sure you used the `service_role` key, NOT the `anon` key

### "relation profiles does not exist"
- You didn't run schema.sql yet — go to Supabase SQL Editor and run it

### "Storage bucket not found"
- Create the `user-books` bucket manually in Supabase Dashboard → Storage

### CORS error in browser
- Make sure backend is running on port 8000
- Check `FRONTEND_URL=http://localhost:3000` in `backend/.env`

### "npm run dev" fails
- Run `npm install` first
- Make sure Node.js 18+ is installed: `node --version`

---

## What Works After Week 1

| Feature                              | Status |
|--------------------------------------|--------|
| User registration & login            | ✅     |
| Email confirmation                   | ✅     |
| 5-step onboarding quiz               | ✅     |
| PDF textbook upload                  | ✅     |
| AI roadmap generation (Agent 1)      | ✅     |
| Dashboard with roadmap preview       | ✅     |
| Supabase auth with RLS               | ✅     |
| pgvector RAG infrastructure          | ✅     |
| PDF chunking + embedding pipeline    | ✅     |
| Auth middleware (route protection)   | ✅     |
| Toast notifications                  | ✅     |
| Password strength indicator          | ✅     |
| Forgot password flow                 | ✅     |

---

## Next Step: Week 2

Week 2 builds:
- **Agent 2 — Lesson Teacher** (Gemini generates structured lessons)
- **Gemini Live API** voice lesson integration
- **Lesson viewer** page with 6-step structure
- **Auto PDF notes** generation after each lesson

Run `Week 2 code` when ready!
