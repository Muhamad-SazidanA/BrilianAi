import { DashboardData, DashboardWidget } from '@/types/dashboard';

export interface GenerateDashboardInput {
  queryText?: string;
  answerText: string;
  messageId: string;
}

const DASHBOARD_SYSTEM_PROMPT = `Kamu adalah AI generator Dashboard Interaktif untuk BrilianAi.
TUGAS: Analisis teks jawaban AI dan hasilkan struktur JSON dashboard yang informatif, menarik, dan interaktif dengan memilih widget-widget visual yang paling tepat.

ATURAN UTAMA:
1. Kembalikan HANYA format JSON valid tanpa narasi pembuka/penutup.
2. Buat minimal 2 dan maksimal 6 widget yang merefleksikan poin-poin inti dari jawaban.
3. Gunakan tipe widget yang relevan:
   - "stat_card": Untuk angka kunci/metrik/persentase penting (title, value, unit, trend: up|down|neutral, trendLabel, color: blue|green|amber|red|purple)
   - "bar_chart": Untuk perbandingan kuantitatif antar kategori/bagian (title, items: [{ label, value, color }], unit)
   - "list": Untuk daftar poin penting, fitur, atau rekomendasi dengan status badge (title, items: [{ label, description, badge, badgeColor }])
   - "table": Untuk representasi tabular terstruktur (title, columns: string[], rows: string[][])
   - "timeline": Untuk urutan tahap, prosedur, atau alur waktu (title, events: [{ date, title, description, status: done|active|pending }])
   - "comparison": Untuk membandingkan 2 atau lebih opsi/metode (title, headers: string[], items: [{ label, values: { [header]: string } }])
   - "text_summary": Untuk ringkasan eksekutif atau kesimpulan pokok (title, content, highlight)
4. Judul ("title") dashboard harus ringkas, jelas, dan profesional.

SCHEMA JSON YANG WAJIB DIIKUTI:
{
  "title": "string - Judul Dashboard",
  "subtitle": "string - Subjudul atau penjelasan singkat",
  "widgets": [
    // widget objek sesuai jenis di atas
  ]
}`;

/**
 * Sanitize & parse JSON string dari model LLM response
 */
function parseAndValidateDashboardJson(rawText: string, input: GenerateDashboardInput): DashboardData {
  if (!rawText || typeof rawText !== 'string') {
    throw new Error('Respons AI kosong.');
  }

  // Bersihkan markdown code fence jika ada
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  }

  // Cari substring JSON valid { ... }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    cleaned = match[0];
  }

  const parsed = JSON.parse(cleaned);

  const title = (parsed.title || (input.queryText ? `Dashboard: ${input.queryText.slice(0, 60)}` : 'Dashboard Analisis AI')).trim();
  const subtitle = typeof parsed.subtitle === 'string' ? parsed.subtitle.trim() : undefined;
  const rawWidgets = Array.isArray(parsed.widgets) ? parsed.widgets : [];

  const validWidgets: DashboardWidget[] = [];
  for (const w of rawWidgets) {
    if (!w || typeof w !== 'object' || !w.type || !w.title) continue;
    validWidgets.push(w as DashboardWidget);
  }

  if (validWidgets.length === 0) {
    throw new Error('Tidak ada widget valid yang dihasilkan.');
  }

  return {
    title,
    subtitle,
    sourceMessageId: input.messageId,
    sourceQuery: input.queryText || '',
    widgets: validWidgets,
  };
}

/**
 * Multi-Tier Cloud API Client untuk mengonversi jawaban AI menjadi Interactive Dashboard.
 * Urutan Fallback:
 * 1. Google Gemini Flash (gemini-2.0-flash-lite / gemini-2.5-flash) — respons JSON natif & latensi sangat cepat
 * 2. OpenAI GPT-4o-mini — strict JSON object response
 * 3. DeepSeek-V3 (deepseek-chat) — JSON object reasoning
 * 4. Local Ollama (jika container/service aktif)
 * 5. Fallback ke ringkasan teks otomatis jika seluruh API gagal
 */
export async function generateDashboardData(input: GenerateDashboardInput): Promise<DashboardData> {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const openAiApiKey = process.env.OPENAI_API_KEY;
  const deepseekApiKey = process.env.DEEPSEEK_API_KEY;

  const userPrompt = `Pertanyaan Pengguna: "${input.queryText || 'Analisis Dokumen'}"

Teks Jawaban AI yang harus diubah ke Dashboard:
---------------------------------------------
${input.answerText}
---------------------------------------------

Hasilkan JSON dashboard sekarang sesuai instruksi sistem. Kembalikan HANYA JSON.`;

  // =========================================================================
  // TIER 1: Google Gemini API (gemini-2.0-flash-lite)
  // =========================================================================
  if (geminiApiKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000); // 20 detik timeout

      const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: `${DASHBOARD_SYSTEM_PROMPT}\n\n${userPrompt}` }],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 3000,
            responseMimeType: 'application/json',
          },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return parseAndValidateDashboardJson(text, input);
        }
      } else {
        const errBody = await res.text();
        console.warn(`[DashboardClient] Gemini API HTTP ${res.status}: ${errBody}. Mencoba OpenAI...`);
      }
    } catch (err: any) {
      console.warn(`[DashboardClient] Gemini gagal (${err?.message}). Mencoba OpenAI...`);
    }
  }

  // =========================================================================
  // TIER 2: OpenAI API (gpt-4o-mini)
  // =========================================================================
  if (openAiApiKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openAiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: DASHBOARD_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content) {
          return parseAndValidateDashboardJson(content, input);
        }
      } else {
        const errBody = await res.text();
        console.warn(`[DashboardClient] OpenAI HTTP ${res.status}: ${errBody}. Mencoba DeepSeek...`);
      }
    } catch (err: any) {
      console.warn(`[DashboardClient] OpenAI gagal (${err?.message}). Mencoba DeepSeek...`);
    }
  }

  // =========================================================================
  // TIER 3: DeepSeek API (deepseek-chat)
  // =========================================================================
  if (deepseekApiKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);

      const res = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${deepseekApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
          messages: [
            { role: 'system', content: DASHBOARD_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content) {
          return parseAndValidateDashboardJson(content, input);
        }
      } else {
        const errBody = await res.text();
        console.warn(`[DashboardClient] DeepSeek HTTP ${res.status}: ${errBody}. Mencoba Ollama...`);
      }
    } catch (err: any) {
      console.warn(`[DashboardClient] DeepSeek gagal (${err?.message}). Mencoba Ollama...`);
    }
  }

  // =========================================================================
  // TIER 4: Local Ollama (Opsional jika dijalankan di localhost / container)
  // =========================================================================
  try {
    let baseUrl = process.env.OLLAMA_ENDPOINT || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    if (baseUrl.includes('//ollama:') && !process.env.DOCKER_CONTAINER) {
      baseUrl = baseUrl.replace('//ollama:', '//localhost:');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.CHAT_MODEL_NAME || 'llama3.2:3b',
        prompt: `${DASHBOARD_SYSTEM_PROMPT}\n\n${userPrompt}`,
        stream: false,
        format: 'json',
        options: { temperature: 0.1 },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const responseText = data?.response;
      if (responseText) {
        return parseAndValidateDashboardJson(responseText, input);
      }
    }
  } catch {
    // Ollama tidak menyala atau offline, lanjut ke fallback aman
  }

  // =========================================================================
  // TIER 5: Fallback Elegan Tanpa AI (Mencegah Error 500 jika seluruh API offline)
  // =========================================================================
  return {
    title: input.queryText ? `Dashboard: ${input.queryText.slice(0, 60)}` : 'Ringkasan Informasi AI',
    subtitle: 'Generated fallback view',
    sourceMessageId: input.messageId,
    sourceQuery: input.queryText || '',
    widgets: [
      {
        type: 'text_summary',
        title: 'Ringkasan Informasi',
        content: input.answerText.slice(0, 1000),
        highlight: 'Informasi disarikan langsung dari jawaban dokumen.',
      },
    ],
  };
}
