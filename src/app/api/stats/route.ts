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

    // 3. Multi-Agent Cloud status
    const geminiActive = Boolean(process.env.GEMINI_API_KEY);
    const openAiActive = Boolean(process.env.OPENAI_API_KEY);
    const deepseekActive = Boolean(process.env.DEEPSEEK_API_KEY);
    const allAiOnline = geminiActive && openAiActive && deepseekActive;

    return NextResponse.json({
      totalDocuments: row.total_documents,
      totalChunks: row.total_chunks,
      totalPages: row.total_pages,
      activeKnowledgeCount: row.active_knowledge_count,
      systemHealth: {
        postgres: true,
        ollama: allAiOnline,
        visionModel: 'Brilian Vision OCR Engine',
        embeddingModel: 'Dense Vector Embedding (1024-dim)',
        multiAgent: {
          geminiVision: geminiActive,
          openAiEmbedding: openAiActive,
          deepseekSynthesizer: deepseekActive,
        },
      },
      recentBatches: recentResult.rows,
    });
  } catch (error: any) {
    console.warn('[API /api/stats] Database offline/not ready:', error?.message);

    const geminiActive = Boolean(process.env.GEMINI_API_KEY);
    const openAiActive = Boolean(process.env.OPENAI_API_KEY);
    const deepseekActive = Boolean(process.env.DEEPSEEK_API_KEY);
    const allAiOnline = geminiActive && openAiActive && deepseekActive;

    // Graceful response so dashboard UI remains fully functional even before DB migration
    return NextResponse.json({
      totalDocuments: 0,
      totalChunks: 0,
      totalPages: 0,
      activeKnowledgeCount: 0,
      systemHealth: {
        postgres: false,
        ollama: allAiOnline,
        visionModel: 'Brilian Vision OCR Engine',
        embeddingModel: 'Dense Vector Embedding (1024-dim)',
        multiAgent: {
          geminiVision: geminiActive,
          openAiEmbedding: openAiActive,
          deepseekSynthesizer: deepseekActive,
        },
      },
      recentBatches: [],
      error: error.message || 'Database error',
    });
  }
}
