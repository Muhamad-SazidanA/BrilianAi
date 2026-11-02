import { getPool } from '../db/dbClient';
import {
  listBatches,
  updateBatchSuggestedQuestions,
} from '../db/vectorStore';
import { canUserAccessDocument } from '../auth/serverAuth';
import type { User } from '@/types/user';
import { listUserGrantedBatchIds } from '../db/documentGrantStore';
import { ChatOllama } from '@langchain/ollama';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

export const DEFAULT_SYSTEM_SUGGESTIONS: string[] = [
  'Bagaimana cara mengunggah dokumen ke Knowledge Base?',
  'Format berkas apa saja yang didukung oleh sistem?',
  'Bagaimana cara kerja kurasi wawasan otomatis AI?',
  'Apakah data dokumen saya aman dan terlindungi enkripsi?',
];

/**
 * Menghasilkan fallback heuristik berbasis judul berkas jika seluruh model AI offline.
 */
function generateHeuristicQuestions(filename: string): string[] {
  const cleanName = filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
  const lower = cleanName.toLowerCase();

  if (lower.includes('audit') || lower.includes('finan') || lower.includes('keuangan') || lower.includes('q4') || lower.includes('q1') || lower.includes('q2') || lower.includes('q3')) {
    return [
      `Berapa total ringkasan finansial pada ${cleanName}?`,
      `Apa saja temuan audit dan kepatuhan dalam dokumen ini?`,
      `Bagaimana rekomendasi efisiensi biaya yang tercatat?`,
    ];
  }

  if (lower.includes('sop') || lower.includes('kebijakan') || lower.includes('policy') || lower.includes('pedoman')) {
    return [
      `Apa saja klausul dan aturan utama dalam ${cleanName}?`,
      `Bagaimana alur prosedur operasional standar yang diatur?`,
      `Siapa pihak yang bertanggung jawab atas kepatuhan ini?`,
    ];
  }

  if (lower.includes('sla') || lower.includes('kontrak') || lower.includes('perjanjian') || lower.includes('mou')) {
    return [
      `Apa klausul utama dan batasan kewajiban dalam ${cleanName}?`,
      `Berapa target waktu layanan (SLA) yang disepakati?`,
      `Kapan masa berlaku dan ketentuan terminasi perjanjian ini?`,
    ];
  }

  return [
    `Apa poin penting yang dibahas dalam ${cleanName}?`,
    `Bagaimana rincian data dan kesimpulan utama dokumen ini?`,
    `Apa langkah tindak lanjut yang direkomendasikan dokumen?`,
  ];
}

/**
 * Menghasilkan 3 pertanyaan eksplisit berbasis isi dokumen menggunakan Gemini Flash / Ollama / Heuristic.
 * Hasilnya langsung disimpan ke kolom upload_batches.suggested_questions.
 */
export async function generateDocumentSuggestions(
  batchId: string,
  filename: string,
  sampleContent?: string
): Promise<string[]> {
  try {
    const pool = getPool();
    let contextText = sampleContent || '';

    // Jika sampleContent belum diberikan, ambil dari curated_insights atau document_chunks
    if (!contextText) {
      try {
        const insightRes = await pool.query<{ title: string; content: string }>(
          `SELECT title, content FROM curated_insights WHERE upload_batch_id = $1 ORDER BY id ASC LIMIT 3;`,
          [batchId]
        );
        if (insightRes.rows.length > 0) {
          contextText = insightRes.rows.map((r) => `[${r.title}]: ${r.content}`).join('\n\n');
        } else {
          const chunkRes = await pool.query<{ content: string }>(
            `SELECT content FROM document_chunks WHERE upload_batch_id = $1 ORDER BY chunk_index ASC LIMIT 2;`,
            [batchId]
          );
          if (chunkRes.rows.length > 0) {
            contextText = chunkRes.rows.map((r) => r.content).join('\n\n');
          }
        }
      } catch (dbErr) {
        console.warn('[SuggestionService] Context query warning:', dbErr);
      }
    }

    const excerpt = contextText ? contextText.slice(0, 3000) : filename;
    const prompt = `Anda adalah analis AI Enterprise. Berdasarkan dokumen berikut:
Nama Dokumen: "${filename}"
Konteks Dokumen:
"""
${excerpt}
"""

TUGAS:
Hasilkan 3 pertanyaan eksplisit, tajam, dan spesifik dalam Bahasa Indonesia yang dapat dijawab langsung oleh dokumen ini.

ATURAN KETAT:
1. Format harus pertanyaan eksplisit langsung (contoh: "Berapa total realisasi pendapatan pada kuartal 4?", "Apa syarat pemenuhan kepatuhan ISO di dokumen ini?").
2. Harus diawali kata tanya konkret: Berapa, Apa, Bagaimana, Kapan, Siapa, atau Apakah.
3. Hindari topik abstrak/generik seperti "Q4 Financial Audit" atau "Policies". Harus berupa kalimat tanya utuh yang siap diklik pengguna.
4. Panjang tiap pertanyaan maksimal 12 kata agar pas pada tampilan chip saran UI.
5. Kembalikan HANYA JSON valid dengan skema:
{
  "questions": ["pertanyaan 1", "pertanyaan 2", "pertanyaan 3"]
}`;

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (geminiApiKey) {
      const modelsToTry = [
        process.env.GEMINI_MODEL || 'gemini-3.8-flash',
        'gemini-3.8-flash',
        'gemini-flash-latest',
        'gemini-2.5-flash',
        'gemini-1.5-flash',
      ];

      for (const model of modelsToTry) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;

          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.2,
                maxOutputTokens: 1024,
              },
            }),
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (res.ok) {
            const data = await res.json();
            const rawOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (rawOutput) {
              const parsed = JSON.parse(rawOutput);
              if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
                const cleaned = parsed.questions
                  .map((q: any) => String(q).trim())
                  .filter((q: string) => q.length > 5);
                if (cleaned.length >= 2) {
                  await updateBatchSuggestedQuestions(batchId, cleaned);
                  return cleaned;
                }
              }
            }
          }
        } catch {
          // Lanjutkan ke model fallback berikutnya
        }
      }
    }

    // 2. Secondary: Ollama Local Model
    try {
      const ollamaModel = process.env.OLLAMA_MODEL || 'llama3.2:3b';
      let baseUrl = process.env.OLLAMA_ENDPOINT || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
      if (baseUrl.includes('//ollama:') && !process.env.DOCKER_CONTAINER) {
        baseUrl = baseUrl.replace('//ollama:', '//localhost:');
      }

      const client = new ChatOllama({
        model: ollamaModel,
        baseUrl,
        temperature: 0.2,
      });

      const response = await client.invoke([
        new SystemMessage('Anda adalah asisten AI yang hanya mengembalikan format JSON valid {"questions": []}.'),
        new HumanMessage(prompt),
      ], { signal: AbortSignal.timeout(12000) });

      const text = typeof response.content === 'string' ? response.content : '';
      const jsonMatch = text.match(/\{[\s\S]*"questions"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
          const cleaned = parsed.questions
            .map((q: any) => String(q).trim())
            .filter((q: string) => q.length > 5);
          if (cleaned.length >= 2) {
            await updateBatchSuggestedQuestions(batchId, cleaned);
            return cleaned;
          }
        }
      }
    } catch {
      // Ollama offline atau timeout, gunakan heuristic
    }

    // 3. Fallback Heuristik Cerdas (Zero-Token)
    const heuristic = generateHeuristicQuestions(filename);
    await updateBatchSuggestedQuestions(batchId, heuristic);
    return heuristic;
  } catch (err) {
    console.error('[SuggestionService] Error generating suggestions:', err);
    const fallback = generateHeuristicQuestions(filename);
    return fallback;
  }
}

/**
 * Mengambil daftar saran pertanyaan untuk pengguna berdasarkan dokumen yang dimilikinya / dapat diaksesnya.
 * Mengikuti arsitektur Hybrid & Cache (Instan saat dibuka).
 */
export async function getSuggestedQuestionsForUser(
  user?: User | null
): Promise<string[]> {
  try {
    const allBatches = await listBatches();

    const grantedBatchList = user?.id ? await listUserGrantedBatchIds(user.id) : [];
    const grantedBatchSet = new Set(grantedBatchList);

    // Ambil dokumen aktif yang memiliki izin akses oleh pengguna saat ini
    const accessibleActiveBatches = allBatches.filter(
      (b) => Boolean(b.is_active_knowledge) && canUserAccessDocument(user, b, grantedBatchSet)
    );

    // Jika pengguna belum memiliki dokumen aktif, tampilkan saran bantuan umum seputar sistem
    if (accessibleActiveBatches.length === 0) {
      return DEFAULT_SYSTEM_SUGGESTIONS;
    }

    const collectedQuestions: string[] = [];

    // Periksa batch aktif yang sudah memiliki cache saran pertanyaan
    for (const batch of accessibleActiveBatches) {
      if (Array.isArray(batch.suggested_questions) && batch.suggested_questions.length > 0) {
        for (const q of batch.suggested_questions) {
          if (!collectedQuestions.includes(q)) {
            collectedQuestions.push(q);
          }
        }
      }
    }

    // Jika belum ada saran ter-cache sama sekali di batch aktif pertama, picu generasi instan
    if (collectedQuestions.length === 0 && accessibleActiveBatches.length > 0) {
      const topBatch = accessibleActiveBatches[0];
      const generated = await generateDocumentSuggestions(topBatch.id, topBatch.original_filename);
      collectedQuestions.push(...generated);
    }

    // Ambil maksimal 4 pertanyaan terbaik
    if (collectedQuestions.length > 0) {
      return collectedQuestions.slice(0, 4);
    }

    return DEFAULT_SYSTEM_SUGGESTIONS;
  } catch (err) {
    console.error('[SuggestionService] Error fetching user suggestions:', err);
    return DEFAULT_SYSTEM_SUGGESTIONS;
  }
}
