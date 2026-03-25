from fastapi.testclient import TestClient
from app.main import app
from app.core.database import get_supabase

c = TestClient(app)
s = get_supabase()
profile = s.table('profiles').select('id,current_skill').limit(1).execute().data[0]
user_id = profile['id']
lesson = s.table('lessons').select('*').eq('user_id', user_id).order('created_at', desc=True).limit(1).execute().data[0]
lesson_id = lesson['id']
roadmap_id = lesson.get('roadmap_id')
topic = lesson.get('topic') or 'JavaScript Fundamentals'
week = int(lesson.get('week_number') or 1)
skill = profile.get('current_skill') or 'JavaScript'

print('USING', {'user_id': user_id, 'lesson_id': lesson_id, 'roadmap_id': roadmap_id, 'topic': topic, 'skill': skill, 'week': week})

def show(name, r):
    try:
        body = r.json()
    except Exception:
        body = r.text[:200]
    keys = list(body.keys()) if isinstance(body, dict) else []
    print(f"{name}: {r.status_code} keys={keys}")
    if r.status_code >= 400:
        print('  detail=', body)
    return body

r = c.post('/api/quiz/generate', json={'user_id': user_id,'roadmap_id': roadmap_id,'lesson_id': lesson_id,'topic': topic,'skill': skill,'week_number': week,'difficulty': 'beginner','num_questions': 3})
quiz_body = show('POST /api/quiz/generate', r)
quiz_id = None
answers = []
if r.status_code == 200 and isinstance(quiz_body, dict) and quiz_body.get('success'):
    quiz = quiz_body.get('quiz', {})
    quiz_id = quiz.get('quiz_id')
    for q in (quiz.get('questions') or []):
        opts = q.get('options') or []
        answers.append({'question_id': q.get('id'), 'answer': (opts[0] if opts else '')})

if quiz_id:
    r = c.post('/api/quiz/submit', json={'quiz_id': quiz_id, 'user_id': user_id, 'user_answers': answers, 'time_taken': 42})
    show('POST /api/quiz/submit', r)
else:
    print('POST /api/quiz/submit: SKIPPED (no quiz_id)')

r = c.post('/api/playground/challenge/generate', json={'user_id': user_id,'roadmap_id': roadmap_id,'lesson_id': lesson_id,'topic': topic,'skill': skill,'difficulty': 'beginner','language': 'javascript'})
ch_body = show('POST /api/playground/challenge/generate', r)
challenge_id = None
starter = ''
if r.status_code == 200 and isinstance(ch_body, dict) and ch_body.get('success'):
    challenge = ch_body.get('challenge', {})
    challenge_id = challenge.get('challenge_id')
    starter = challenge.get('starter_code', '')

if challenge_id:
    r = c.post('/api/playground/hint', json={'challenge_id': challenge_id,'user_id': user_id,'user_code': starter,'hint_level': 1,'error_message': None})
    show('POST /api/playground/hint', r)

    r = c.post('/api/playground/evaluate', json={'challenge_id': challenge_id,'user_id': user_id,'user_code': starter,'hints_used': 1})
    show('POST /api/playground/evaluate', r)
else:
    print('POST /api/playground/hint: SKIPPED (no challenge_id)')
    print('POST /api/playground/evaluate: SKIPPED (no challenge_id)')

r = c.post('/api/playground/explain-error', json={'error_message': 'TypeError: Cannot read properties of undefined','code': 'const x = obj.value;\nconsole.log(x);','language': 'javascript','topic': topic})
show('POST /api/playground/explain-error', r)

r = c.post('/api/progress/report-card', json={'user_id': user_id,'roadmap_id': roadmap_id,'week_number': week})
show('POST /api/progress/report-card', r)

r = c.get('/api/progress/leaderboard')
show('GET /api/progress/leaderboard', r)

r = c.get(f'/api/progress/due-reviews/{user_id}')
show('GET /api/progress/due-reviews/{user_id}', r)
