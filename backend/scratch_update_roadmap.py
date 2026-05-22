import asyncio
from app.core.database import get_supabase

async def main():
    supabase = get_supabase()
    res = supabase.table('roadmaps').select('*').order('created_at', desc=True).limit(1).execute()
    if not res.data:
        print("No roadmap found.")
        return
        
    data = res.data[0]
    print(f"Current Phase: {data.get('current_phase')}")
    print(f"Current Topic: {data.get('current_topic')}")
    phases = data.get('phases', [])
    
    topics = []
    for p in phases:
        for t in p.get('topics', []):
            topics.append(t)
            
    print("All Topics:")
    for t in topics:
        print(f" - {t}")
        
    current = data.get('current_topic')
    if current in topics:
        idx = topics.index(current)
        if idx + 1 < len(topics):
            next_topic = topics[idx + 1]
            print(f"Setting next topic to: {next_topic}")
            supabase.table('roadmaps').update({'current_topic': next_topic}).eq('id', data['id']).execute()
            print("Successfully updated!")
        else:
            print("Already at the last topic!")
    else:
        print("Current topic not in list!")

if __name__ == "__main__":
    asyncio.run(main())
