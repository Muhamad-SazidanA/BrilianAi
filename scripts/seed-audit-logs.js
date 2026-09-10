const { Client } = require('pg');
require('dotenv').config();

async function seedAuditLogs() {
  let connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/brilian_ai';
  if (connectionString.includes('@postgres:') && !process.env.DOCKER_CONTAINER) {
    connectionString = connectionString.replace('@postgres:', '@localhost:');
  }

  const client = new Client({ connectionString });
  await client.connect();

  try {
    const check = await client.query('SELECT COUNT(*) FROM chat_audit_logs');
    if (parseInt(check.rows[0].count, 10) === 0) {
      console.log('Seeding initial audit logs...');
      await client.query(`
        INSERT INTO chat_audit_logs (
          session_id, user_id, user_name, user_email, user_department,
          query_text, topic, answer_excerpt, sources_used, retrieved_count, created_at
        ) VALUES 
        (
          'sess-001', 'a0000000-0000-0000-0000-000000000003', 'Siti Rahmawati', 'siti.member@brilian.ai', 'Medical Staff',
          'Jelaskan apa itu fisioterapi dan bagaimana evolusi profesinya?',
          'Sejarah & Evolusi Fisioterapi',
          'Fisioterapi adalah profesi kesehatan yang berfokus pada gerak dan fungsi tubuh. Dimulai sejak Hippocrates (2500 SM) dengan massage dan hidroterapi...',
          '[{"filename":"TM 1. Sejarah FT.pdf","pageStart":1,"pageEnd":2}]'::jsonb,
          1, now() - INTERVAL '3 hours'
        ),
        (
          'sess-001', 'a0000000-0000-0000-0000-000000000003', 'Siti Rahmawati', 'siti.member@brilian.ai', 'Medical Staff',
          'Apa dasar hukum fisioterapi menurut Permenkes RI No. 80/2013?',
          'Regulasi & Permenkes Fisioterapi',
          'Permenkes RI No. 80/2013 menekankan penggunaan teknik tangan manual, peningkatan gerakan, alat elektrik mekanik, dan latihan fungsi...',
          '[{"filename":"TM 1. Sejarah FT.pdf","pageStart":3,"pageEnd":4}]'::jsonb,
          1, now() - INTERVAL '2 hours 45 minutes'
        ),
        (
          'sess-001', 'a0000000-0000-0000-0000-000000000003', 'Siti Rahmawati', 'siti.member@brilian.ai', 'Medical Staff',
          'Sebutkan 4 filosofi utama profesi fisioterapis!',
          'Filosofi & Ruang Lingkup FT',
          'Empat filosofi utama fisioterapi meliputi pendekatan holistik, optimasi gerak fungsional, patient-centered care, dan evidence-based practice...',
          '[{"filename":"TM 1. Sejarah FT.pdf","pageStart":2,"pageEnd":2}]'::jsonb,
          1, now() - INTERVAL '2 hours 30 minutes'
        ),
        (
          'sess-002', 'a0000000-0000-0000-0000-000000000002', 'Budi Pratama', 'budi.editor@brilian.ai', 'Clinical & Research',
          'Bagaimana prosedur validasi intisari kurasi untuk materi neuromuscular?',
          'Metode & Intervensi Fisioterapi',
          'Validasi kurasi materi neuromuscular dilakukan dengan mencocokkan raw chunk halaman dengan data sintesis kurator...',
          '[]'::jsonb,
          0, now() - INTERVAL '1 hour 20 minutes'
        ),
        (
          'sess-002', 'a0000000-0000-0000-0000-000000000002', 'Budi Pratama', 'budi.editor@brilian.ai', 'Clinical & Research',
          'Apa perbedaan visi global WCPT dengan regulasi nasional?',
          'Filosofi & Ruang Lingkup FT',
          'Global vision WCPT berfokus pada mobilitas sepanjang rentang hidup, sedangkan nasional menitikberatkan pada standar kompetensi dan teknik terapeutik...',
          '[{"filename":"TM 1. Sejarah FT.pdf","pageStart":1,"pageEnd":3}]'::jsonb,
          2, now() - INTERVAL '50 minutes'
        ),
        (
          'sess-003', 'a0000000-0000-0000-0000-000000000004', 'Ahmad Fauzi', 'ahmad.fauzi@brilian.ai', 'Compliance & Audit',
          'Apakah ada ketentuan audit berkala dalam dokumen pedoman SOP?',
          'Audit Operasional & Keuangan',
          'Pedoman audit operasional mewajibkan pemeriksaan sistem secara berkala per kuartal...',
          '[]'::jsonb,
          0, now() - INTERVAL '1 day'
        )
      `);
      console.log('Audit logs successfully seeded!');
    } else {
      console.log('Audit logs already populated, total rows:', check.rows[0].count);
    }
  } finally {
    await client.end();
  }
}

seedAuditLogs().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
