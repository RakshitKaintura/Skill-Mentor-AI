"""
Notes Service — Generates branded PDF notes for lessons and weekly report cards.
Uses ReportLab with a clean light theme for maximum readability.
"""
import io
import logging
from datetime import datetime
from typing import Dict, Any, List, cast

from reportlab.lib.pagesizes import A4  # type: ignore[import-untyped]
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle  # type: ignore[import-untyped]
from reportlab.lib.colors import HexColor, black, white  # type: ignore[import-untyped]
from reportlab.lib.units import cm  # type: ignore[import-untyped]
from reportlab.lib.enums import TA_CENTER, TA_LEFT  # type: ignore[import-untyped]
from reportlab.platypus import (  # type: ignore[import-untyped]
    SimpleDocTemplate, Paragraph, Spacer,
    Table, TableStyle, HRFlowable, KeepTogether,
)

from app.core.database import get_supabase
from app.core.config import get_settings

logger = logging.getLogger(__name__)

# --- Clean Light Theme Palette ---
C_WHITE     = HexColor("#FFFFFF")
C_PAGE_BG   = HexColor("#FFFFFF")
C_BORDER    = HexColor("#E0E0E0")   # Light divider
C_ACCENT    = HexColor("#7C3AED")   # Purple accent (brand)
C_BLUE      = HexColor("#2563EB")   # Section headers
C_GREEN     = HexColor("#16A34A")   # Strengths
C_RED       = HexColor("#DC2626")   # Weaknesses / pitfalls
C_YELLOW    = HexColor("#D97706")   # Warnings / analogies
C_TEXT_H    = HexColor("#000000")   # Black heading — fully visible
C_TEXT_B    = HexColor("#000000")   # Black body text
C_MUTED     = HexColor("#6B7280")   # Meta / timestamps
C_CODE_BG   = HexColor("#F3F4F6")   # Light grey code background
C_CODE_TEXT = HexColor("#1F2937")   # Dark code text
C_TAG_BG    = HexColor("#EDE9FE")   # Light purple tag badge
C_TAG_TEXT  = HexColor("#5B21B6")   # Dark purple tag text

# Step-specific labels
THEME_MAP = {
    "intro":     {"color": C_BLUE,   "icon": "01 — CONTEXT"},
    "analogy":   {"color": C_YELLOW, "icon": "02 — ANALOGY"},
    "code_demo": {"color": C_ACCENT, "icon": "03 — IMPLEMENTATION"},
    "try_it":    {"color": C_GREEN,  "icon": "04 — PRACTICAL"},
    "mistakes":  {"color": C_RED,    "icon": "05 — PITFALLS"},
    "summary":   {"color": C_BLUE,   "icon": "06 — REVIEW"},
}

def _get_styles():
    """Defines a clean, readable light-theme stylesheet for PDFs."""
    s = getSampleStyleSheet()

    s.add(ParagraphStyle(
        "Brand", fontSize=9, fontName="Helvetica-Bold",
        textColor=C_MUTED, spaceBefore=0, spaceAfter=4,
        letterSpacing=1.5,
    ))
    s.add(ParagraphStyle(
        "H1", fontSize=26, fontName="Helvetica-Bold",
        textColor=C_TEXT_H, leading=32, spaceAfter=4,
    ))
    s.add(ParagraphStyle(
        "Meta", fontSize=9, fontName="Helvetica",
        textColor=C_MUTED, spaceAfter=10,
    ))
    s.add(ParagraphStyle(
        "Body", fontSize=10.5, fontName="Helvetica",
        textColor=C_TEXT_B, leading=17, spaceAfter=8,
    ))
    s.add(ParagraphStyle(
        "SectionLabel", fontName="Helvetica-Bold", fontSize=8.5,
        textColor=C_MUTED, spaceBefore=14, spaceAfter=2, letterSpacing=1.2,
    ))
    s.add(ParagraphStyle(
        "SectionHdr", fontName="Helvetica-Bold", fontSize=14,
        textColor=C_TEXT_H, spaceAfter=6, spaceBefore=4,
    ))
    s.add(ParagraphStyle(
        "SubHdr", fontName="Helvetica-Bold", fontSize=11,
        textColor=C_TEXT_H, spaceAfter=4, spaceBefore=8,
    ))
    s.add(ParagraphStyle(
        "CodeBlock",
        fontSize=9,
        fontName="Courier",
        textColor=C_CODE_TEXT,
        backColor=C_CODE_BG,
        borderPadding=(10, 12, 10, 12),  # type: ignore[arg-type]
        leading=14,
        spaceBefore=6,
        spaceAfter=12,
        borderRadius=4,
    ))
    s.add(ParagraphStyle(
        "Callout",
        fontSize=10.5,
        fontName="Helvetica-BoldOblique",
        textColor=HexColor("#5B21B6"),
        backColor=HexColor("#EDE9FE"),
        borderPadding=(10, 12, 10, 12),  # type: ignore[arg-type]
        leading=16,
        spaceAfter=12,
        borderRadius=4,
    ))
    s.add(ParagraphStyle(
        "GradeLarge", fontName="Helvetica-Bold", fontSize=64,
        alignment=TA_CENTER, spaceAfter=4,
    ))

    return s


def _sanitize_xml(text: str) -> str:
    """Prevents ReportLab XML parsing errors by escaping special characters."""
    if not text: return ""
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _resolve_storage_bucket(supabase) -> str:
    """Find a usable bucket and create `user-books` if it does not exist."""
    preferred = ["user-books", "user_books"]

    try:
        buckets = supabase.storage.list_buckets() or []
        names = {getattr(b, "name", "") for b in buckets}
        for name in preferred:
            if name in names:
                return name
    except Exception as e:
        logger.warning("Could not list storage buckets: %s", e)

    # Fallback: create canonical bucket.
    try:
        supabase.storage.create_bucket("user-books", options={"public": False})
        return "user-books"
    except Exception as e:
        logger.warning("Could not create storage bucket user-books: %s", e)
        return "user-books"


def _extract_signed_url_value(signed_resp: Any) -> str | None:
    """Support multiple response shapes from storage signed URL APIs."""
    if isinstance(signed_resp, str):
        return signed_resp
    if isinstance(signed_resp, dict):
        for key in ("signedURL", "signedUrl", "signed_url"):
            val = signed_resp.get(key)
            if isinstance(val, str) and val:
                return val
    return None


def _build_download_url(supabase, bucket_name: str, storage_path: str) -> str:
    """Prefer signed URL for private buckets, fallback to public URL."""
    settings = get_settings()

    try:
        signed = supabase.storage.from_(bucket_name).create_signed_url(storage_path, 60 * 60 * 24 * 30)
        signed_url = _extract_signed_url_value(signed)
        if signed_url:
            if signed_url.startswith("http"):
                return signed_url
            return f"{settings.supabase_url.rstrip('/')}{signed_url}"
    except Exception as e:
        logger.info("Signed URL generation failed, falling back to public URL: %s", e)

    return supabase.storage.from_(bucket_name).get_public_url(storage_path)

async def generate_lesson_pdf(lesson_id: str, user_id: str) -> str:
    """Generates branded PDF notes for a specific lesson and uploads to Storage."""
    supabase = get_supabase()
    response = supabase.table("lessons").select("*").eq("id", lesson_id).single().execute()
    
    if not response.data:
        raise FileNotFoundError(f"Lesson {lesson_id} not found.")
    
    lesson = response.data
    lesson: Dict[str, Any] = cast(Dict[str, Any], lesson)
    styles = _get_styles()
    buffer = io.BytesIO()
    
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=1.5*cm, leftMargin=1.5*cm, 
        topMargin=2*cm, bottomMargin=2*cm,
    )
    
    elements: List[Any] = []
    elements.append(Paragraph("SKILLMENTOR AI • LESSON NOTES", styles["Brand"]))
    elements.append(Paragraph(_sanitize_xml(lesson.get("topic", "Unit Study")), styles["H1"]))
    elements.append(Paragraph(f"Skill: {lesson.get('skill')} | Generated: {datetime.now().strftime('%Y-%m-%d')}", styles["Meta"]))
    elements.append(HRFlowable(width="100%", thickness=1, color=C_BORDER, spaceAfter=15))

    if takeaway := lesson.get("key_takeaway"):
        elements.append(Paragraph(f"<b>💡 Key Takeaway:</b> {_sanitize_xml(takeaway)}", styles["Callout"]))
        elements.append(Spacer(1, 10))

    for step in lesson.get("steps", []):
        stype = step.get("type", "intro")
        theme = THEME_MAP.get(stype, {"color": C_TEXT_B, "icon": stype.upper()})
        
        step_group: List[Any] = []
        type_label = f"<font color='{theme['color']}'>{theme['icon']}</font>"
        step_group.append(Paragraph(type_label, styles["Meta"]))
        step_group.append(Paragraph(_sanitize_xml(step.get("title", "")), styles["Brand"]))
        
        content = step.get("content", "")
        for paragraph in content.split("\n\n"):
            if paragraph.strip():
                step_group.append(Paragraph(_sanitize_xml(paragraph.strip()), styles["Body"]))
        
        if code := step.get("code_snippet"):
            step_group.append(Paragraph(f"<code>{_sanitize_xml(code)}</code>", styles["CodeBlock"]))
        
        elements.append(KeepTogether(step_group))
        elements.append(HRFlowable(width="100%", thickness=0.5, color=C_BORDER, spaceAfter=10))

    doc.build(elements)
    
    # Upload and Update
    bucket_name = _resolve_storage_bucket(supabase)
    storage_path = f"{user_id}/lessons/{lesson_id}.pdf"
    supabase.storage.from_(bucket_name).upload(
        path=storage_path, file=buffer.getvalue(),
        file_options={"content-type": "application/pdf", "upsert": "true"}
    )

    download_url = _build_download_url(supabase, bucket_name, storage_path)
    if "?" in download_url:
        download_url += f"&t={int(datetime.now().timestamp())}"
    else:
        download_url += f"?t={int(datetime.now().timestamp())}"

    supabase.table("lessons").update({"pdf_notes_url": download_url}).eq("id", lesson_id).execute()
    return download_url

async def generate_report_pdf(
    user_id: str,
    week_number: int,
    skill: str,
    report: dict,
    stats: dict,
) -> str:
    """Generates a branded weekly report card PDF and uploads to Storage."""
    styles = _get_styles()
    buffer = io.BytesIO()

    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        rightMargin=1.5*cm, leftMargin=1.5*cm, 
        topMargin=2*cm, bottomMargin=2*cm,
    )

    elements: List[Any] = []
    elements.append(Paragraph("SKILLMENTOR AI • WEEKLY PROGRESS", styles["Brand"]))
    elements.append(Paragraph(f"Week {week_number} Report Card", styles["H1"]))
    elements.append(Paragraph(f"Skill Mastery: {skill} | {datetime.now().strftime('%B %d, %Y')}", styles["Meta"]))
    elements.append(HRFlowable(width="100%", thickness=1, color=C_BORDER, spaceAfter=12))

    # --- Grade Section ---
    grade = report.get("overall_grade", "C")
    grade_color = C_ACCENT if grade in ("A", "B") else C_YELLOW if grade == "C" else C_RED
    elements.append(Paragraph(grade, ParagraphStyle("GradeLarge", fontName="Helvetica-Bold", fontSize=64, textColor=grade_color, alignment=TA_CENTER)))
    elements.append(Paragraph(report.get("grade_reasoning", ""), ParagraphStyle("Reason", fontName="Helvetica", fontSize=11, textColor=C_MUTED, alignment=TA_CENTER, spaceAfter=16)))

    # --- Stats Table ---
    elements.append(Paragraph("Week at a Glance", styles["SectionHdr"]))
    data = [
        ["Metric", "Value"],
        ["Lessons Completed", str(stats["lessons_done"])],
        ["Quizzes Taken", str(stats["quizzes_done"])],
        ["Avg Quiz Score", f"{stats['avg_score']:.1f}%"],
        ["Challenges Passed", str(stats["challenges_done"])],
        ["Current Streak", f"{stats['streak']} days"],
        ["Total XP Earned", str(stats["xp_total"])],
    ]
    tbl = Table(data, colWidths=[6*cm, 10*cm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), C_CODE_BG),
        ("TEXTCOLOR", (0,0), (-1,0), C_ACCENT),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
        ("GRID", (0,0), (-1,-1), 0.5, C_BORDER),
        ("BACKGROUND", (0,1), (-1,-1), C_PAGE_BG),
        ("TEXTCOLOR", (0,1), (-1,-1), C_TEXT_B),
        ("FONTSIZE", (0,0), (-1,-1), 10),
        ("TOPPADDING", (0,0), (-1,-1), 8),
        ("BOTTOMPADDING", (0,0), (-1,-1), 8),
    ]))
    elements.append(tbl)

    # --- Analysis Sections ---
    elements.append(Paragraph("Performance Summary", styles["SectionHdr"]))
    elements.append(Paragraph(_sanitize_xml(report.get("summary", "")), styles["Body"]))

    # Strengths and Weaknesses
    for label, key, color in [("Strengths ✓", "strengths", C_ACCENT), ("Areas to Improve", "weaknesses", C_RED)]:
        elements.append(Paragraph(label, ParagraphStyle("H", fontName="Helvetica-Bold", fontSize=12, textColor=color, spaceBefore=10, spaceAfter=5)))
        for item in report.get(key, []):
            elements.append(Paragraph(f"• {_sanitize_xml(item)}", styles["Body"]))

    # Action Plan
    elements.append(Paragraph("Action Plan for Next Week", styles["SectionHdr"]))
    for i, rec in enumerate(report.get("recommendations", []), 1):
        elements.append(Paragraph(f"{i}. {_sanitize_xml(rec)}", styles["Body"]))

    # Footer Note
    elements.append(Spacer(1, 15))
    elements.append(HRFlowable(width="100%", thickness=1, color=C_BORDER))
    elements.append(Paragraph(report.get("motivational_message", ""), ParagraphStyle("M", fontName="Helvetica-Oblique", fontSize=10, textColor=C_MUTED, alignment=TA_CENTER, spaceBefore=10)))

    doc.build(elements)
    
    # Upload
    storage_path = f"{user_id}/reports/week_{week_number}.pdf"
    supabase = get_supabase()
    bucket_name = _resolve_storage_bucket(supabase)
    supabase.storage.from_(bucket_name).upload(
        path=storage_path, file=buffer.getvalue(),
        file_options={"content-type": "application/pdf", "upsert": "true"}
    )

    return _build_download_url(supabase, bucket_name, storage_path)