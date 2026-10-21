import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, hasServerPermission } from '@lib/auth/serverAuth';
import {
  AVAILABLE_FEED_PRESETS,
  testAndPreviewFeed,
  syncFeedConnector,
  FeedConnectorConfig,
} from '@lib/connectors/feedConnectorService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return NextResponse.json({
    presets: AVAILABLE_FEED_PRESETS,
  });
}

export async function POST(req: NextRequest) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json(
      { error: 'Unauthorized: Sesi autentikasi diperlukan.' },
      { status: 401 }
    );
  }

  const canUpload = await hasServerPermission(req, 'documents:upload');
  if (!canUpload) {
    return NextResponse.json(
      { error: 'Forbidden: Hak akses documents:upload diperlukan.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const action = body.action || 'sync'; // 'preview' | 'sync'
    const config: FeedConnectorConfig = {
      presetId: body.presetId || 'kurs-bi',
      sourceName: body.sourceName,
      customFeedUrl: body.customFeedUrl,
      syncSchedule: body.syncSchedule || 'daily',
      autoSupersede: body.autoSupersede !== false,
      ownerId: authUser.id,
      divisionId: body.divisionId || 'General',
      classification: body.classification || 'Internal',
      status: body.status || 'Aktif',
      version: body.version || '1.0',
      reviewDueDate: body.reviewDueDate || null,
      userGrants: body.userGrants,
    };

    if (action === 'preview') {
      const preview = await testAndPreviewFeed(config);
      return NextResponse.json({ preview });
    }

    const result = await syncFeedConnector(config);
    return NextResponse.json({
      message: `Data feed "${result.sourceName}" berhasil diindeks ke pgvector!`,
      ...result,
    });
  } catch (error: any) {
    console.error('[API /api/connectors/feeds] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Gagal memproses data feed eksternal' },
      { status: 500 }
    );
  }
}
