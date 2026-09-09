import { NextResponse } from 'next/server';
import { getPool } from '@/../lib/db/dbClient';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const pool = getPool();

    // 1. Fetch Aggregated Metrics
    const statsQuery = `
      SELECT 
        COUNT(*)::int AS total_documents,
        COALESCE(SUM(chunk_count), 0)::int AS total_chunks,
        COALESCE(SUM(page_count), 0)::int AS total_pages,
        COUNT(CASE WHEN is_active_knowledge = TRUE THEN 1 END)::int AS active_knowledge_count
      FROM upload_batches;
    `;
    const statsResult = await pool.query(statsQuery);
    const row = statsResult.rows[0] || {
      total_documents: 0,
      total_chunks: 0,
      total_pages: 0,
      active_knowledge_count: 0,
    };

    // 2. Fetch Recent Batches (up to 5)
    const recentQuery = `
      SELECT 
        id, 
        original_filename, 
        chunk_count, 
        page_count, 
        uploaded_at, 
        is_active_knowledge
      FROM upload_batches
      ORDER BY uploaded_at DESC
      LIMIT 5;
    `;
    const recentResult = await pool.query(recentQuery);

    // 3. Check Ollama connectivity
    let ollamaUrl = process.env.OLLAMA_BASE_URL || process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';
    if (ollamaUrl.includes('://ollama:') && !process.env.DOCKER_CONTAINER) {
      ollamaUrl = ollamaUrl.replace('://ollama:', '://localhost:');
    }
    let ollamaOnline = false;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const ollamaRes = await fetch(`${ollamaUrl}/api/version`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      ollamaOnline = ollamaRes.ok;
    } catch {
      ollamaOnline = false;
    }

    return NextResponse.json({
      totalDocuments: row.total_documents,
      totalChunks: row.total_chunks,
      totalPages: row.total_pages,
      activeKnowledgeCount: row.active_knowledge_count,
      systemHealth: {
        postgres: true,
        ollama: ollamaOnline,
        visionModel: process.env.VISION_MODEL_NAME || 'qwen2.5vl:3b',
        embeddingModel: process.env.EMBEDDING_MODEL_NAME || 'bge-m3',
      },
      recentBatches: recentResult.rows,
    });
  } catch (error: any) {
    console.error('[API /api/stats] Error fetching stats:', error);
    return NextResponse.json(
      {
        totalDocuments: 0,
        totalChunks: 0,
        totalPages: 0,
        activeKnowledgeCount: 0,
        systemHealth: {
          postgres: false,
          ollama: false,
          visionModel: process.env.VISION_MODEL_NAME || 'qwen2.5vl:3b',
          embeddingModel: process.env.EMBEDDING_MODEL_NAME || 'bge-m3',
        },
        recentBatches: [],
        error: error.message || 'Database error',
      },
      { status: 500 }
    );
  }
}
