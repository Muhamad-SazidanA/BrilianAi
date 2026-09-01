import fs from 'fs';
import path from 'path';
import * as mupdf from 'mupdf';
import { ChatOllama } from '@langchain/ollama';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import dotenv from 'dotenv';

dotenv.config();

const SYSTEM_VISION_PROMPT =
  'Ekstrak SELURUH konten substantif dari gambar halaman dokumen ini: judul, penjelasan, poin-poin, teks dalam diagram/tabel/kotak. Tuliskan dalam urutan baca yang logis. ABAIKAN logo, watermark kecil yang berulang di pojok/footer, nomor halaman, dan elemen dekoratif murni. Tulis sebagai teks naratif yang mengalir, BUKAN daftar mentah per elemen visual.';

function createHaloDuniaImage() {
  const textStream = 'BT\n/F1 28 Tf\n40 100 Td\n(HALO DUNIA 12345) Tj\nET\n';
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 200] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents 4 0 R >>\nendobj\n',
    `4 0 obj\n<< /Length ${textStream.length} >>\nstream\n${textStream}endstream\nendobj\n`,
  ];

  const body = objects.join('');
  const header = '%PDF-1.4\n';
  const offsets = [];
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
  console.log('========================================================');
  console.log('GATE VERIFIKASI AI VISION (Qwen2.5-VL via Ollama)');
  console.log('========================================================\n');

  const customImagePath = process.argv[2];

  let testImageBuffer;
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
  const model = 'qwen2.5vl:7b';

  console.log(`Menghubungi Ollama di endpoint: ${endpoint}`);
  console.log(`Mengirim gambar base64 ke model ${model}...`);

  const base64Image = testImageBuffer.toString('base64');
  const messages = [
    new SystemMessage(SYSTEM_VISION_PROMPT),
    new HumanMessage({
      content: [
        {
          type: 'text',
          text: 'Berikut adalah gambar halaman dokumen yang perlu diekstrak:',
        },
        {
          type: 'image_url',
          image_url: {
            url: `data:image/png;base64,${base64Image}`,
          },
        },
      ],
      additional_kwargs: {
        images: [base64Image],
      },
    }),
  ];

  const startTime = Date.now();
  try {
    const client = new ChatOllama({
      model,
      baseUrl: endpoint,
      timeout: 60000,
    });

    const response = await client.invoke(messages);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

    console.log('\n---------------- HASIL EKSTRAKSI VISION (' + duration + 's) ----------------');
    console.log(content.trim() || '[KOSONG / TIDAK ADA OUTPUT]');
    console.log('------------------------------------------------------------\n');

    const normalized = content.toUpperCase();
    const hasHaloDunia = normalized.includes('HALO DUNIA') || normalized.includes('HALODUNIA');
    const hasNumbers = normalized.includes('12345');

    if (hasHaloDunia || hasNumbers) {
      console.log('✅ VERIFIKASI GATE BERHASIL: Model benar-benar membaca teks dari gambar!');
      console.log('   Model mengembalikan teks yang sesuai dengan gambar uji ("HALO DUNIA" / "12345").');
    } else {
      console.warn('⚠️  PERINGATAN: Output model tidak memuat teks "HALO DUNIA" atau "12345".');
      console.warn('   Deskripsi model:', content);
    }
  } catch (error) {
    console.error('❌ KONEKSI OLLAMA GAGAL:', error.message || error);
    console.error('   Pastikan container ollama sedang berjalan dan model telah di-pull:');
    console.error('   `docker compose exec ollama ollama pull qwen2.5vl:7b`');
  }
}

runVerification();
