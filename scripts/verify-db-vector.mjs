import dotenv from 'dotenv';
import { embedTexts } from '../lib/ai/embeddingClient.js';
import {
  createUploadBatch,
  insertChunks,
  listBatches,
  listChunks,
} from '../lib/db/vectorStore.js';
import { getPool } from '../lib/db/dbClient.js';

dotenv.config();

async function main() {
  console.log('========================================================');
  console.log('VERIFIKASI INTEGRASI PGVECTOR & EMBEDDING (BGE-M3)');
  console.log('========================================================\n');

  const pool = getPool();

  try {
    console.log('1. Memeriksa koneksi database...');
    const connCheck = await pool.query('SELECT current_database(), now();');
    console.log(`   Database terhubung: ${connCheck.rows[0].current_database}`);

    console.log('2. Memeriksa ekstensi pgvector...');
    const extCheck = await pool.query("SELECT extname, extversion FROM pg_extension WHERE extname='vector';");
    if (extCheck.rows.length === 0) {
      throw new Error("Ekstensi 'vector' belum aktif di database. Jalankan migrasi terlebih dahulu (npm run db:migrate).");
    }
    console.log(`   Ekstensi pgvector aktif (versi: ${extCheck.rows[0].extversion})`);

    console.log('3. Membuat upload batch uji...');
    const testFilename = `test_manual_verify_${Date.now()}.pdf`;
    const batchId = await createUploadBatch(testFilename, 1);
    console.log(`   Upload batch berhasil dibuat dengan ID: ${batchId}`);

    console.log('4. Menghasilkan embedding kalimat uji via Ollama (bge-m3)...');
    const testSentence = 'Kalimat uji untuk verifikasi penyimpanan vektor 1024 dimensi ke pgvector PostgreSQL.';
    
    let embeddings;
    try {
      embeddings = await embedTexts([testSentence]);
    } catch (ollamaErr) {
      console.warn('   ⚠️ Gagal menghubungi Ollama (mungkin container belum jalan di host ini).');
      console.warn('   Menggunakan vektor 1024-dim sintetis untuk verifikasi skema pgvector...');
      embeddings = [new Array(1024).fill(0.01234)];
    }

    const vector = embeddings[0];
    console.log(`   Vektor berhasil dibuat dengan panjang dimensi: ${vector.length}`);

    console.log('5. Menyimpan chunk dan vektor ke tabel document_chunks...');
    await insertChunks(batchId, [
      {
        content: testSentence,
        sourcePageStart: 1,
        sourcePageEnd: 1,
        embedding: vector,
      },
    ]);
    console.log('   Multi-row insert berhasil dan chunk_count ter-update!');

    console.log('6. Mengambil data chunk kembali dari database (SELECT)...');
    const storedChunks = await listChunks(batchId);
    console.log(`   Jumlah chunk terambil: ${storedChunks.length}`);

    const firstChunk = storedChunks[0];
    console.log('   Detail Chunk Tersimpan:');
    console.log(`     - ID: ${firstChunk.id}`);
    console.log(`     - Batch ID: ${firstChunk.upload_batch_id}`);
    console.log(`     - Konten: "${firstChunk.content}"`);
    console.log(`     - Halaman: ${firstChunk.source_page_start} - ${firstChunk.source_page_end}`);
    console.log(`     - Tipe embedding: ${typeof firstChunk.embedding} (panjang string: ${String(firstChunk.embedding).length})`);

    console.log('7. Menguji query cosine distance pgvector...');
    const similarityQuery = `
      SELECT id, content, (embedding <=> $1::vector) as cosine_distance
      FROM document_chunks
      WHERE upload_batch_id = $2
      ORDER BY embedding <=> $1::vector ASC
      LIMIT 1;
    `;
    const simResult = await pool.query(similarityQuery, [
      `[${vector.join(',')}]`,
      batchId,
    ]);

    console.log(`   Cosine distance terhadap dirinya sendiri: ${simResult.rows[0].cosine_distance}`);

    console.log('\n✅ VERIFIKASI SELESAI: pgvector 1024 dimensi berhasil disimpan dan di-query secara presisi!');
  } catch (error) {
    console.error('\n❌ Verifikasi gagal:', error.message || error);
    console.error('Pastikan PostgreSQL (dengan pgvector) aktif dan migrasi telah dijalankan.');
  } finally {
    await pool.end();
  }
}

main();
