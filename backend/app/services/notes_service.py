import io
from datetime import datetime
from typing import List, Dict, Any

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer,
    Table, TableStyle, HRFlowable, KeepTogether,
)

from app.core.database import get_supabase

# --- Modern Dark Theme Palette (2026 Brand Standards) ---
C_BG      = HexColor("#080B14")  # Deep Midnight
C_SURF    = HexColor("#0E1420")  # Surface Blue
C_BORDER  = HexColor("#1E2A42")  # Subtle Divider
C_ACCENT  = HexColor("#4FFFA0")  # SkillMentor Neon Green
C_TEXT_H  = HexColor("#E8EDF8")  # High Emphasis Text
C_TEXT_B  = HexColor("#C4CFEA")  # Body Text
C_CODE_BG = HexColor("#0A1020")  # Console Background

# Step-specific accent colors for visual hierarchy
THEME_MAP = {
    "intro":     {"color": C_ACCENT, "icon": "01 — CONTEXT"},
    "analogy":   {"color": HexColor("#FFD166"), "icon": "02 — ANALOGY"},
    "code_demo": {"color": HexColor("#5B8EFF"), "icon": "03 — IMPLEMENTATION"},
    "try_it":    {"color": HexColor("#C77DFF"), "icon": "04 — PRACTICAL"},
    "mistakes":  {"color": HexColor("#FF8C42"), "icon": "05 — PITFALLS"},
    "summary":   {"color": C_ACCENT, "icon": "06 — REVIEW"},
}

def _get_styles():
    """Defines a reusable stylesheet for the branded PDF."""
    s = getSampleStyleSheet()
    
    # Custom Brand Styles
    s.add(ParagraphStyle("Brand", fontSize=10, fontName="Helvetica-Bold", textColor=C_ACCENT))
    s.add(ParagraphStyle("H1", fontSize=24, fontName="Helvetica-Bold", textColor=C_TEXT_H, leading=28))
    s.add(ParagraphStyle("Meta", fontSize=9, fontName="Helvetica", textColor=HexColor("#6B7A99"), spaceAfter=12))
    s.add(ParagraphStyle("Body", fontSize=10, fontName="Helvetica", textColor=C_TEXT_B, leading=16, spaceAfter=8))
    
    # Technical Blocks
    s.add(ParagraphStyle(
        "CodeBlock", 
        fontSize=8.5, 
        fontName="Courier", 
        textColor=HexColor("#A8FF78"),
        backColor=C_CODE_BG, 
        borderPadding=(10, 10, 10, 10), 
        leading=12, 
        spaceBefore=6, 
        spaceAfter=12
    ))
    
    # Highlight Box
    s.add(ParagraphStyle(
        "Callout", 
        fontSize=10, 
        fontName="Helvetica-BoldOblique", 
        textColor=C_ACCENT,
        backColor=HexColor("#061A10"), 
        borderPadding=12, 
        leading=15, 
        borderRadius=4
    ))
    
    return s

def _sanitize_xml(text: str) -> str:
    """Prevents ReportLab XML parsing errors by escaping special characters."""
    if not text: return ""
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

async def generate_lesson_pdf(lesson_id: str, user_id: str) -> str:
    """
    Generates a branded PDF for a specific lesson and persists it to Supabase Storage.
    Returns the public signed URL for the student to download.
    """
    supabase = get_supabase()
    
    # 1. Data Fetching
    response = supabase.table("lessons").select("*").eq("id", lesson_id).single().execute()
    if not response.data:
        raise FileNotFoundError(f"Lesson metadata for ID {lesson_id} could not be retrieved.")
    
    lesson = response.data
    styles = _get_styles()
    buffer = io.BytesIO()
    
    # 2. Document Setup
    doc = SimpleDocTemplate(
        buffer, 
        pagesize=A4,
        rightMargin=1.5*cm, leftMargin=1.5*cm, 
        topMargin=2*cm, bottomMargin=2*cm,
        title=f"SkillMentor - {lesson.get('topic')}"
    )
    
    elements = []

    # --- Header Section ---
    elements.append(Paragraph("SKILLMENTOR AI • PERSONALIZED LEARNING", styles["Brand"]))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(_sanitize_xml(lesson.get("topic", "Unit Study")), styles["H1"]))
    
    meta_info = f"Skill: {lesson.get('skill', 'General')} | Generated: {datetime.now().strftime('%Y-%m-%d')}"
    elements.append(Paragraph(meta_info, styles["Meta"]))
    elements.append(HRFlowable(width="100%", thickness=1, color=C_BORDER, spaceAfter=15))

    # --- Core Content ---
    if takeaway := lesson.get("key_takeaway"):
        elements.append(Paragraph(f"<b>Key Learning Objective:</b> {_sanitize_xml(takeaway)}", styles["Callout"]))
        elements.append(Spacer(1, 10))

    for step in lesson.get("steps", []):
        stype = step.get("type", "intro")
        theme = THEME_MAP.get(stype, {"color": C_TEXT_B, "icon": stype.upper()})
        
        # Group components to prevent awkward page breaks in the middle of a step
        step_group = []
        
        # Step Header (Type + Title)
        type_label = f"<font color='{theme['color']}'>{theme['icon']}</font>"
        step_group.append(Paragraph(type_label, styles["Meta"]))
        step_group.append(Paragraph(_sanitize_xml(step.get("title", "")), styles["Brand"]))
        
        # Step Content
        content = step.get("content", "")
        for paragraph in content.split("\n\n"):
            if paragraph.strip():
                step_group.append(Paragraph(_sanitize_xml(paragraph.strip()), styles["Body"]))
        
        # Code Snippets (if present)
        if code := step.get("code_snippet"):
            step_group.append(Paragraph(f"<code>{_sanitize_xml(code)}</code>", styles["CodeBlock"]))
        
        elements.append(KeepTogether(step_group))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=C_BORDER, spaceAfter=10))

    # --- Footer ---
    elements.append(Spacer(1, 20))
    elements.append(Paragraph("End of Lesson Notes. Keep building.", styles["Meta"]))

    # 3. Build & Upload
    doc.build(elements)
    pdf_payload = buffer.getvalue()
    buffer.close()

    storage_path = f"{user_id}/lessons/{lesson_id}.pdf"
    
    try:
        # Standardize storage interactions with MIME types
        supabase.storage.from_("user-books").upload(
            path=storage_path,
            file=pdf_payload,
            file_options={"content-type": "application/pdf", "upsert": "true"}
        )
        
        public_url = supabase.storage.from_("user-books").get_public_url(storage_path)
        
        # Update the database record with the new asset link
        supabase.table("lessons").update({"pdf_notes_url": public_url}).eq("id", lesson_id).execute()
        
        return public_url
    except Exception as e:
        # Crucial for resume projects: demonstrate you think about failure states
        print(f"Cloud Storage Error: {str(e)}")
        raise RuntimeError("Could not persist generated PDF to cloud storage.")