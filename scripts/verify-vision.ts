import fs from 'fs';
import path from 'path';
import * as mupdf from 'mupdf';
import { extractPageText } from '../lib/ai/visionClient.js';
import dotenv from 'dotenv';

dotenv.config();

function createHaloDuniaImage(): Buffer {
  const textStream = 'BT\n/F1 28 Tf\n40 100 Td\n(HALO DUNIA 12345) Tj\nET\n';
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 200] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents 4 0 R >>\nendobj\n',
    `4 0 obj\n<< /Length ${textStream.length} >>\nstream\n${textStream}endstream\nendobj\n`,
  ];

  const body = objects.join('');
  const header = '%PDF-1.4\n';
  const offsets: number[] = [];
  let currentOffset = header.length;

  for (const obj of objects) {
    offsets.push(currentOffset);
    currentOffset += Buffer.byteLength(obj);
  }

  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += `${off.toString().padStart(10, '0')} 00000 n \n`;
  }

  const startXref = currentOffset;
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF`;

  const pdfBuf = Buffer.from(header + body + xref + trailer);
  const doc = mupdf.Document.openDocument(pdfBuf, 'application/pdf');
  const page = doc.loadPage(0);
  const pixmap = page.toPixmap(mupdf.Matrix.scale(2, 2), mupdf.ColorSpace.DeviceRGB);
  return Buffer.from(pixmap.asPNG());
}

async function runVerification() {
  console.log('=== VERIFIKASI AI VISION (Qwen2.5-VL via Ollama) ===');
  const customImagePath = process.argv[2];

  let testImageBuffer: Buffer;
  if (customImagePath && fs.existsSync(customImagePath)) {
    console.log(`Menggunakan gambar custom: ${customImagePath}`);
    testImageBuffer = fs.readFileSync(customImagePath);
  } else {
    console.log('Membuat gambar uji in-memory dengan teks "HALO DUNIA 12345"...');
    testImageBuffer = createHaloDuniaImage();
  }

  const tempImagePath = path.join(process.cwd(), 'test_halo_dunia.png');
  fs.writeFileSync(tempImagePath, testImageBuffer);
  console.log(`Gambar uji disimpan sementara di: ${tempImagePath}`);

  const endpoint =
    process.env.OLLAMA_ENDPOINT ||
    process.env.OLLAMA_BASE_URL ||
    'http://localhost:11434';
  console.log(`Menghubungi Ollama di endpoint: ${endpoint}`);
  console.log('Mengirim payload gambar base64 ke model qwen2.5vl:7b...');

  const startTime = Date.now();
  const extractedText = await extractPageText(testImageBuffer, {
    baseUrl: endpoint,
    model: 'qwen2.5vl:7b',
  });
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n--- HASIL EKSTRAKSI VISION (dalam ' + duration + 's) ---');
  console.log(extractedText ? extractedText : '[KOSONG / TIDAK ADA OUTPUT]');
  console.log('------------------------------------------------------\n');

  const normalized = extractedText.toUpperCase();
  const hasHaloDunia = normalized.includes('HALO DUNIA') || normalized.includes('HALODUNIA');
  const hasNumbers = normalized.includes('12345');

  if (hasHaloDunia || hasNumbers) {
    console.log('✅ VERIFIKASI BERHASIL: Output model benar-benar membaca teks "HALO DUNIA" / "12345" dari gambar.');
    console.log('Payload gambar terbukti berhasil dikirim dan diinterpretasikan oleh model Qwen2.5-VL.');
  } else {
    console.error('❌ VERIFIKASI GAGAL / PERINGATAN: Output model tidak memuat "HALO DUNIA" atau "12345".');
    console.error('Pastikan Ollama berjalan dan model qwen2.5vl:7b sudah ter-pull (docker compose exec ollama ollama pull qwen2.5vl:7b).');
  }
}

runVerification().catch((err) => {
  console.error('Error saat menjalankan verifikasi vision:', err);
  process.exit(1);
});
