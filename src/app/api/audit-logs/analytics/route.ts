import { NextResponse } from 'next/server';
import { getAuditAnalytics } from '@/../lib/db/auditLogStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const summary = await getAuditAnalytics();
    return NextResponse.json(summary);
  } catch (err: any) {
    console.error('[API Audit Analytics GET] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Gagal memuat analitik percakapan pengguna' },
      { status: 500 }
    );
  }
}
