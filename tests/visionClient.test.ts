import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractPageText, SYSTEM_VISION_PROMPT, isAiBlankNotice } from '../lib/ai/visionClient';
import { ChatOllama } from '@langchain/ollama';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';

// Mock the @langchain/ollama module
vi.mock('@langchain/ollama', () => {
  const MockChatOllama = vi.fn();
  MockChatOllama.prototype.invoke = vi.fn();
  return {
    ChatOllama: MockChatOllama,
  };
});

describe('extractPageText (AI Vision Client)', () => {
  const dummyPngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]);
  const expectedBase64 = dummyPngBuffer.toString('base64');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. should return extracted text matching the successful Ollama response', async () => {
    const mockExtractedText = 'Laporan Keuangan Kuartal 1: Pertumbuhan pendapatan meningkat 15%.';

    vi.mocked(ChatOllama.prototype.invoke).mockResolvedValueOnce(
      new AIMessage({ content: mockExtractedText }) as any
    );

    const result = await extractPageText(dummyPngBuffer, {
      initialBackoffMs: 10,
    });

    expect(result).toBe(mockExtractedText);
    expect(ChatOllama.prototype.invoke).toHaveBeenCalledTimes(1);
  });

  it('2. should return an empty string and NOT throw when Ollama encounters errors/timeouts 3 times', async () => {
    vi.mocked(ChatOllama.prototype.invoke).mockRejectedValue(
      new Error('Connection timed out after 60000ms')
    );

    // Call extractPageText with small backoff so unit test runs swiftly
    const result = await extractPageText(dummyPngBuffer, {
      maxRetries: 3,
      initialBackoffMs: 10,
    });

    expect(result).toBe('');
    // Initial attempt + 3 retries = 4 total invocations
    expect(ChatOllama.prototype.invoke).toHaveBeenCalledTimes(4);
  });

  it('3. should ensure the request payload sent to Ollama includes images array with the correct base64 data', async () => {
    vi.mocked(ChatOllama.prototype.invoke).mockResolvedValueOnce(
      new AIMessage({ content: 'Teks terdeteksi: HALO DUNIA 12345' }) as any
    );

    await extractPageText(dummyPngBuffer, { initialBackoffMs: 10 });

    expect(ChatOllama.prototype.invoke).toHaveBeenCalledTimes(1);

    const callArgs = vi.mocked(ChatOllama.prototype.invoke).mock.calls[0][0] as any[];
    expect(Array.isArray(callArgs)).toBe(true);

    // 1. System prompt check
    const systemMsg = callArgs.find((m: any) => m instanceof SystemMessage || m._getType?.() === 'system');
    expect(systemMsg).toBeDefined();
    expect(systemMsg.content).toBe(SYSTEM_VISION_PROMPT);

    // 2. Human message with image base64 check
    const humanMsg = callArgs.find((m: any) => m instanceof HumanMessage || m._getType?.() === 'human');
    expect(humanMsg).toBeDefined();

    // Check additional_kwargs.images
    expect(humanMsg.additional_kwargs?.images).toContain(expectedBase64);

    // Check multimodal content items
    const imageContent = (humanMsg.content as any[]).find(
      (c: any) => c.type === 'image_url'
    );
    expect(imageContent).toBeDefined();
    expect(imageContent.image_url?.url).toContain(expectedBase64);
  });

  it('4. should detect polite AI blank page disclaimers via isAiBlankNotice', () => {
    const politeAiResponse =
      'Gambar yang Anda berikan adalah halaman kosong (putih polos) dan tidak memiliki teks, tabel, diagram, atau konten substantif apa pun untuk diekstrak.';
    expect(isAiBlankNotice(politeAiResponse)).toBe(true);
    expect(isAiBlankNotice('Halaman ini kosong.')).toBe(true);
    expect(isAiBlankNotice('Halaman kosong tanpa teks')).toBe(true);
    expect(isAiBlankNotice('Tidak ada teks yang dapat diekstrak.')).toBe(true);
    expect(isAiBlankNotice('Blank page')).toBe(true);
    expect(isAiBlankNotice('   ')).toBe(true);
    expect(isAiBlankNotice(null)).toBe(true);

    // Legit document texts should NOT be marked as blank notice
    expect(isAiBlankNotice('Pendahuluan dan Latar Belakang Perusahaan PT ABC')).toBe(false);
    expect(isAiBlankNotice('| No | Nama | Nilai |\n|---|---|---|\n| 1 | Budi | 100 |')).toBe(false);
  });

  it('5. should sanitize and return empty string when Vision model returns polite blank page notice', async () => {
    const politeAiResponse =
      'Gambar yang Anda berikan adalah halaman kosong (putih polos) dan tidak memiliki teks, tabel, diagram, atau konten substantif apa pun untuk diekstrak.';

    vi.mocked(ChatOllama.prototype.invoke).mockResolvedValueOnce(
      new AIMessage({ content: politeAiResponse }) as any
    );

    const result = await extractPageText(dummyPngBuffer, { initialBackoffMs: 10 });
    // Must return empty string so it is ignored from chunks
    expect(result).toBe('');
  });
});
