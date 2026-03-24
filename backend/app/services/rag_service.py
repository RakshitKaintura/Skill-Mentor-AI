import os
import re
import tempfile
from typing import List, Dict, Any
from docling.document_converter import DocumentConverter
from app.core.gemini import embed_content
from app.core.database import get_supabase

# Initialize Docling once for the service lifecycle
converter = DocumentConverter()

def chunk_text_by_sentence(text: str, chunk_size: int = 1000, overlap: int = 100) -> List[str]:
    """
    Groups sentences into semantic chunks. 
    Optimized for Gemini's 2048 token limit (approx 1k characters for safety).
    """
    # Split by sentence boundaries but keep the delimiter
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks = []
    current_chunk = ""
    
    for sentence in sentences:
        if len(current_chunk) + len(sentence) > chunk_size and current_chunk:
            chunks.append(current_chunk.strip())
            # Maintain context overlap
            current_chunk = current_chunk[-overlap:] + " " + sentence
        else:
            current_chunk += " " + sentence
            
    if current_chunk:
        chunks.append(current_chunk.strip())
    return chunks

async def process_uploaded_book(
    book_id: str, 
    user_id: str, 
    file_bytes: bytes,
    file_name: str,
    skill_tag: str
) -> Dict[str, Any]:
    """
    Advanced RAG Pipeline: Layout extraction -> Semantic Batch Embedding -> pgvector Store.
    """
    supabase = get_supabase()
    temp_path = ""
    
    try:
        suffix = os.path.splitext(file_name or "upload.pdf")[1] or ".pdf"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(file_bytes)
            temp_path = tmp.name

        # 1. High-fidelity extraction (Docling handles complex PDF layouts)
        result = converter.convert(temp_path)
        full_markdown = result.document.export_to_markdown()
        
        # 2. Semantic Chunking
        chunks = chunk_text_by_sentence(full_markdown)
        
        # 3. Batch Embedding (March 2026 Performance Pattern)
        # We embed in batches of 100 to stay under Gemini API limits while maximizing speed
        all_embeddings: List[List[float]] = []
        batch_size = 100
        
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i : i + batch_size]
            embeddings = [await embed_content(chunk, is_query=False) for chunk in batch]
            all_embeddings.extend(embeddings)

        # 4. Bulk Insert to Supabase (10x faster than individual inserts)
        records = [
            {
                "book_id": book_id,
                "user_id": user_id,
                "skill_tag": skill_tag,
                "chunk_index": idx,
                "content": chunk,
                "embedding": all_embeddings[idx],
                "source_label": f"{file_name} · chunk {idx + 1}",
            }
            for idx, chunk in enumerate(chunks)
        ]
        
        # Insert in chunks to avoid Supabase payload limits
        for i in range(0, len(records), 500):
            supabase.table("book_chunks").insert(records[i : i + 500]).execute()
        
        # 5. Final Status Update
        supabase.table("user_books").update({
            "processing_status": "completed",
            "total_chunks": len(chunks)
        }).eq("id", book_id).execute()
        
        return {"status": "success", "total_chunks": len(chunks)}

    except Exception as e:
        supabase.table("user_books").update({
            "processing_status": "failed",
            "error_message": str(e)
        }).eq("id", book_id).execute()
        raise e
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


def _search_book_chunks_rpc(
    supabase,
    query_vector: List[float],
    user_id: str,
    skill: str,
    top_k: int,
    include_curated: bool,
):
    """Call whichever search RPC exists in the target schema."""
    try:
        return supabase.rpc("search_book_chunks", {
            "query_embedding": query_vector,
            "target_user_id": user_id,
            "target_skill": skill,
            "include_curated": include_curated,
            "match_count": top_k,
        }).execute()
    except Exception as exc:
        message = str(exc)
        if "search_book_chunks" not in message and "not found" not in message:
            raise
        return supabase.rpc("match_book_chunks", {
            "query_embedding": query_vector,
            "filter_user_id": user_id,
            "filter_skill": skill,
            "match_count": top_k,
        }).execute()

async def retrieve_context(query: str, user_id: str, skill: str, top_k: int = 5) -> str:
    """
    Semantic retrieval using pgvector.
    """
    supabase = get_supabase()
    # Query embedding is a single vector
    query_vector = await embed_content(query, is_query=True)
    
    result = _search_book_chunks_rpc(
        supabase=supabase,
        query_vector=query_vector,
        user_id=user_id,
        skill=skill,
        top_k=top_k,
        include_curated=True,
    )
    
    if not result.data:
        return ""

    # Format findings for the LLM
    context_parts = [
        f"[Source: {item.get('skill_tag', 'Textbook')}] {item['content']}" 
        for item in result.data
    ]
    return "\n\n---\n\n".join(context_parts)


async def retrieve_chunks(
    query: str,
    user_id: str,
    skill_tag: str,
    top_k: int = 5,
    include_curated: bool = True,
) -> List[Dict[str, Any]]:
    """Compatibility helper that returns retrieved chunks in the legacy shape."""
    supabase = get_supabase()
    query_vector = await embed_content(query, is_query=True)

    result = _search_book_chunks_rpc(
        supabase=supabase,
        query_vector=query_vector,
        user_id=user_id,
        skill=skill_tag,
        top_k=top_k,
        include_curated=include_curated,
    )

    rows = result.data or []
    return [
        {
            "content": row.get("content", ""),
            "source_label": row.get("source_label") or row.get("skill_tag") or "Textbook",
            "skill_tag": row.get("skill_tag"),
            "metadata": {},
        }
        for row in rows
    ]


def format_rag_context(chunks: List[Dict[str, Any]]) -> str:
    """Formats chunk results into a readable context block for prompting."""
    if not chunks:
        return ""

    parts = []
    for idx, chunk in enumerate(chunks, start=1):
        label = chunk.get("source_label") or "Textbook"
        content = chunk.get("content", "")
        parts.append(f"[Source {idx}: {label}]\n{content}")

    return "\n\n---\n\n".join(parts)