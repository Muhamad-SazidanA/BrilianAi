import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, hasServerPermission } from '@lib/auth/serverAuth';
import {
  testDbConnection,
  testAndPreviewDb,
  syncDatabaseConnector,
  DbConnectorConfig,
} from '@lib/connectors/databaseConnectorService';

export const dynamic = 'force-dynamic';

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
    const action = body.action || 'sync'; // 'test' | 'preview' | 'sync'

    const config: DbConnectorConfig = {
      dbType: body.dbType || 'postgres',
      sourceName: body.sourceName,
      host: body.host || 'localhost',
      port: Number(body.port) || (body.dbType === 'mysql' ? 3306 : 5432),
      database: body.database,
      username: body.username,
      password: body.password,
      ssl: Boolean(body.ssl),
      query: body.query || 'SELECT 1;',
      ownerId: authUser.id,
      divisionId: body.divisionId || 'General',
      classification: body.classification || 'Internal',
      status: body.status || 'Aktif',
      version: body.version || '1.0',
      reviewDueDate: body.reviewDueDate || null,
      userGrants: body.userGrants,
    };

    if (action === 'test') {
      const testResult = await testDbConnection(config);
      return NextResponse.json(testResult);
    }

    if (action === 'preview') {
      const preview = await testAndPreviewDb(config);
      return NextResponse.json({ preview });
    }

    const result = await syncDatabaseConnector(config);
    return NextResponse.json({
      message: `Query database "${result.sourceName}" berhasil diindeks (${result.rowCount} baris, ${result.chunkCount} chunks)!`,
      ...result,
    });
  } catch (error: any) {
    console.error('[API /api/connectors/database] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Gagal memproses koneksi database' },
      { status: 500 }
    );
  }
}
