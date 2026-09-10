import { NextResponse } from 'next/server';
import { listAuditLogs } from '@/../lib/db/auditLogStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { logs } = await listAuditLogs({ limit: 1000 });

    const headers = [
      'Waktu (UTC)',
      'ID Pengguna',
      'Nama Pengguna',
      'Email',
      'Departemen',
      'Topik Terdeteksi',
      'Pertanyaan Pengguna',
      'Ringkasan Jawaban AI',
      'Jumlah Sitasi',
      'Dokumen Rujukan',
    ];

    const escapeCsv = (str: string) => `"${(str || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`;

    const rows = logs.map((log) => {
      const sourcesSummary = (log.sources_used || [])
        .map((s: any) => `${s.filename || 'Doc'} (hal. ${s.pageStart || 1})`)
        .join('; ');

      return [
        escapeCsv(new Date(log.created_at).toLocaleString('id-ID')),
        escapeCsv(log.user_id || '-'),
        escapeCsv(log.user_name || 'Anonymous'),
        escapeCsv(log.user_email || '-'),
        escapeCsv(log.user_department || '-'),
        escapeCsv(log.topic || '-'),
        escapeCsv(log.query_text || ''),
        escapeCsv(log.answer_excerpt || ''),
        log.retrieved_count || 0,
        escapeCsv(sourcesSummary),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="brilian_chat_audit_logs_${Date.now()}.csv"`,
      },
    });
  } catch (err: any) {
    console.error('[API Audit Export GET] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Gagal mengekspor log percakapan' },
      { status: 500 }
    );
  }
}
