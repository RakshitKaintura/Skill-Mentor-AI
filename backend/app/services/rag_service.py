import re
from typing import List, Dict, Any
from docling.document_converter import DocumentConverter
from app.core.gemini import embed_content, get_ai_client
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
    file_path: str, 
    skill_tag: str
) -> Dict[str, Any]:
    """
    Advanced RAG Pipeline: Layout extraction -> Semantic Batch Embedding -> pgvector Store.
    """
    supabase = await get_supabase()
    
    try:
        # 1. High-fidelity extraction (Docling handles complex PDF layouts)
        result = converter.convert(file_path)
        full_markdown = result.document.export_to_markdown()
        
        # 2. Semantic Chunking
        chunks = chunk_text_by_sentence(full_markdown)
        
        # 3. Batch Embedding (March 2026 Performance Pattern)
        # We embed in batches of 100 to stay under Gemini API limits while maximizing speed
        all_embeddings = []
        batch_size = 100
        
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i : i + batch_size]
            # Batch call to the custom embed_content utility
            embeddings = await embed_content(batch, is_query=False)
            all_embeddings.extend(embeddings)

        # 4. Bulk Insert to Supabase (10x faster than individual inserts)
        records = [
            {
                "book_id": book_id,
                "user_id": user_id,
                "skill_tag": skill_tag,
                "content": chunk,
                "embedding": all_embeddings[idx],
                "metadata": {"chunk_index": idx, "method": "docling_batch_v2"}
            }
            for idx, chunk in enumerate(chunks)
        ]
        
        # Insert in chunks to avoid Supabase payload limits
        for i in range(0, len(records), 500):
            await supabase.table("book_chunks").insert(records[i : i + 500]).execute()
        
        # 5. Final Status Update
        await supabase.table("user_books").update({
            "processing_status": "completed",
            "total_chunks": len(chunks)
        }).eq("id", book_id).execute()
        
        return {"status": "success", "total_chunks": len(chunks)}

    except Exception as e:
        await supabase.table("user_books").update({
            "processing_status": "failed",
            "error_message": str(e)
        }).eq("id", book_id).execute()
        raise e

async def retrieve_context(query: str, user_id: str, skill: str, top_k: int = 5) -> str:
    """
    Semantic retrieval using pgvector.
    """
    supabase = await get_supabase()
    # Query embedding is a single vector
    query_vector = await embed_content(query, is_query=True)
    
    # RPC call to your Supabase pgvector function
    result = await supabase.rpc("match_book_chunks", {
        "query_embedding": query_vector,
        "filter_user_id": user_id,
        "filter_skill": skill,
        "match_count": top_k
    }).execute()
    
    if not result.data:
        return ""

    # Format findings for the LLM
    context_parts = [
        f"[Source: {item.get('skill_tag', 'Textbook')}] {item['content']}" 
        for item in result.data
    ]
    return "\n\n---\n\n".join(context_parts)