import shutil

src = r"C:\Users\blank\.gemini\antigravity\brain\7ed06bcf-b867-4933-8fd6-f8b6554047ae\skill_mentor_ai_hero_1777647093822.png"
dst = r"e:\DOWNLOADS\DATA SCIENCE\PROFESSIONAL PROJECTS\Skill Mentor AI\skill_mentor_ai_hero.png"

shutil.copy2(src, dst)
print("Image successfully copied.")
