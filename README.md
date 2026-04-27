# SkillMentor AI

SkillMentor AI is a full-stack AI learning platform that turns a learner's goal into a guided study system. It combines personalized roadmaps, lesson generation, doubt solving, voice interaction, quizzes, project mentoring, career preparation, analytics, and admin reporting in one product.

## What This Project Does

- Generates personalized skill roadmaps based on learner level, goal, and available study time
- Creates structured lessons with explanations, analogies, code examples, and follow-up practice
- Supports doubt solving during lessons with context-aware AI responses
- Offers code playground coaching with challenge generation, hints, evaluation, and error explanation
- Delivers quizzes, progress tracking, report cards, and spaced review flows
- Includes daily challenges, notifications, and streak-style engagement loops
- Supports project mentorship, resume review, interview practice, job readiness tracking, and certificate verification
- Tracks user analytics and exposes admin dashboards for engagement insights
- Uses uploaded study material for RAG-style book/document-grounded learning

## Core Features

### Learner Experience

- AI-generated roadmap planning
- Guided lesson viewer
- Daily challenges
- Progress dashboard and leaderboard
- Review and report pages
- Mock interview and career coaching
- Resume review and certificate verification
- Voice learning experience over WebSocket

### AI Agent Layer

The backend is organized around specialized agents and services, including:

- `roadmap_agent`
- `lesson_agent`
- `doubt_agent`
- `quiz_agent`
- `code_coach_agent`
- `progress_agent`
- `daily_challenge_agent`
- `project_mentor_agent`
- `career_prep_agent`

Supporting services handle:

- RAG / document chunking
- text-to-speech
- notifications
- notes
- certificates
- analytics

## Tech Stack

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Supabase SSR/auth helpers

### Backend

- FastAPI
- Uvicorn
- Pydantic / pydantic-settings
- Google Gemini via `google-genai`
- LangGraph / LangChain Core
- Supabase Python client

### Data / Infra

- Supabase for auth + database
- SQL schema files under `backend/scripts`
- WebSocket support for voice interactions

## Project Structure

```text
Skill Mentor AI/
|- backend/
|  |- app/
|  |  |- agents/
|  |  |- api/routes/
|  |  |- core/
|  |  |- models/
|  |  |- services/
|  |- requirements.txt
|  |- scripts/
|- frontend/
|  |- public/
|  |- src/
|  |  |- app/
|  |  |- components/
|  |  |- hooks/
|  |  |- lib/
|  |  |- types/
|  |- package.json
|- help.txt
```

## Main Frontend Pages

The app includes pages for:

- landing page
- authentication and onboarding
- dashboard
- roadmap
- lessons and lesson detail/current lesson
- quiz
- playground
- daily challenge
- progress and leaderboard
- projects
- interview and career hub
- resume review
- achievements
- admin
- settings

## Backend API Areas

Most backend routes are mounted under `/api`, with health available at `/health`.

- `/api/roadmap`
- `/api/books`
- `/api/lesson`
- `/api/voice`
- `/api/quiz`
- `/api/playground`
- `/api/progress`
- `/api/daily`
- `/api/projects`
- `/api/career`
- `/api/analytics`
- `/api/admin`

## Database Coverage

The SQL schema files show support for the following major entities:

- profiles
- roadmaps
- lessons
- quizzes
- user books and book chunks
- user progress
- voice sessions
- doubts
- code challenges
- spaced repetition
- report cards
- projects
- interview sessions
- resumes
- certificates
- analytics events
- daily challenges
- study buddy sessions
- notifications

## Environment Variables

### Backend `.env`

Create `backend/.env` with values like:

```env
gemini_api_key=your_gemini_api_key
supabase_url=your_supabase_url
supabase_service_key=your_supabase_service_role_key
frontend_url=http://localhost:3000
app_env=development
allow_start_without_gemini=false
admin_api_key=your_admin_api_key
admin_allowed_emails=admin@example.com
gemini_model=gemini-3.1-flash-lite-preview
gemini_embed_model=text-embedding-004
chunk_size_tokens=512
chunk_overlap_tokens=64
rag_top_k=5
```

### Frontend `.env.local`

Create `frontend/.env.local` with:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_API_URL=http://localhost:8000
BACKEND_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_URL=http://localhost:3000
ADMIN_API_KEY=your_admin_api_key
ADMIN_ALLOWED_EMAILS=admin@example.com
```

## Local Development

### 1. Clone and enter the repo

```bash
git clone <your-repo-url>
cd "Skill Mentor AI"
```

### 2. Start the backend

Create and activate a virtual environment, then install dependencies:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Run the API:

```bash
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### 3. Start the frontend

In a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:3000` by default.

## Useful Commands

### Backend

```bash
cd backend
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
pytest
```

### Frontend

```bash
cd frontend
npm run dev
npm run build
npm run lint
```

## How It Works

1. A learner signs up and completes onboarding.
2. The platform generates a roadmap tailored to skill, level, goal, and study time.
3. Lessons, quizzes, and practice content are generated from that roadmap.
4. Progress data is stored in Supabase and surfaced in dashboards and review flows.
5. Voice, RAG, analytics, career prep, and admin features extend the core learning loop.

## Repository Highlights

- Clean separation between frontend UI and backend AI orchestration
- Multi-agent backend design instead of one monolithic prompt handler
- Supabase-backed persistence for product features and analytics
- Career-prep features beyond standard tutorial apps
- Voice and document-grounded learning support

## Status

This repository appears to be an actively developed full-stack learning platform with both product features and internal admin tooling already scaffolded across multiple modules.

## License

Add your preferred license here, for example `MIT`.


"E:\DOWNLOADS\DATA SCIENCE\PROFESSIONAL PROJECTS\Skill Mentor AI"
what new things we can do or updates on current project we can do to make this project more better 