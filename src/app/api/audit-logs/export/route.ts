import { NextRequest, NextResponse } from 'next/server';
import { listAuditLogs } from '@/../lib/db/auditLogStore';
import { getAuthenticatedUser, hasServerPermission } from '@lib/auth/serverAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(req);
    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized: Session required.' }, { status: 401 });
    }

    const canReadAudit = await hasServerPermission(req, 'audit:read');
    if (!canReadAudit) {
      return NextResponse.json(
        { error: 'Forbidden: Hak akses audit:read diperlukan untuk mengekspor log.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || undefined;
    const status = searchParams.get('status') || undefined;
    const userId = searchParams.get('userId') || undefined;
    const search = searchParams.get('search') || undefined;

    const { logs } = await listAuditLogs({ category, status, userId, search, limit: 2000 });

    const headers = [
      'Timestamp (ISO)',
      'Event Category',
      'Action',
      'Actor Name',
      'Actor Email',
      'Department',
      'Resource Type',
      'Target Resource',
      'Status',
      'Details / Payload',
    ];

    const escapeCsv = (str: string) => `"${(str || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`;

    const rows = logs.map((log) => {
      const detailsStr = typeof log.details === 'object' ? JSON.stringify(log.details) : '';
      return [
        escapeCsv(log.created_at ? new Date(log.created_at).toISOString() : '-'),
        escapeCsv(log.event_category || 'SYSTEM'),
        escapeCsv(log.action || '-'),
        escapeCsv(log.actor_name || log.user_name || 'Anonymous'),
        escapeCsv(log.actor_email || log.user_email || '-'),
        escapeCsv(log.actor_department || log.user_department || '-'),
        escapeCsv(log.resource_type || '-'),
        escapeCsv(log.resource_name || log.topic || '-'),
        escapeCsv((log.status || 'success').toUpperCase()),
        escapeCsv(detailsStr || log.query_text || ''),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');

    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="brilian_enterprise_audit_logs_${Date.now()}.csv"`,
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
