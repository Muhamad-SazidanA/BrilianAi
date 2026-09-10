import { NextRequest, NextResponse } from 'next/server';
import { listAuditLogs } from '@/../lib/db/auditLogStore';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || undefined;
    const search = searchParams.get('search') || undefined;
    const topic = searchParams.get('topic') || undefined;
    const dateRange = (searchParams.get('dateRange') as any) || 'all';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const result = await listAuditLogs({
      userId,
      search,
      topic,
      dateRange,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[API Audit Logs GET] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Gagal memuat log percakapan' },
      { status: 500 }
    );
  }
}
