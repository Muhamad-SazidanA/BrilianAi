import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, hasServerPermission } from '@lib/auth/serverAuth';
import {
  testEnterpriseConnection,
  syncEnterpriseConnector,
  EnterpriseConnectorConfig,
  ENTERPRISE_SAMPLE_ENTITIES,
} from '@lib/connectors/enterpriseConnectorService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const platform = (searchParams.get('platform') || 'sap') as 'sap' | 'salesforce' | 'denodo';
  const entities = ENTERPRISE_SAMPLE_ENTITIES[platform] || [];
  return NextResponse.json({ entities });
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
    const action = body.action || 'sync'; // 'test' | 'sync'

    const config: EnterpriseConnectorConfig = {
      platform: body.platform || 'sap',
      sourceName: body.sourceName,
      instanceUrl: body.instanceUrl,
      authType: body.authType || 'oauth2',
      apiToken: body.apiToken,
      username: body.username,
      password: body.password,
      entityName: body.entityName || 'PurchaseOrder',
      filterQuery: body.filterQuery,
      ownerId: authUser.id,
      divisionId: body.divisionId || 'General',
      classification: body.classification || 'Internal',
      status: body.status || 'Aktif',
      version: body.version || '1.0',
      reviewDueDate: body.reviewDueDate || null,
      userGrants: body.userGrants,
    };

    if (action === 'test') {
      const testResult = await testEnterpriseConnection(config);
      return NextResponse.json(testResult);
    }

    const result = await syncEnterpriseConnector(config);
    return NextResponse.json({
      message: `Data entitas enterprise "${result.sourceName}" berhasil diindeks (${result.recordCount} entri, ${result.chunkCount} chunks)!`,
      ...result,
    });
  } catch (error: any) {
    console.error('[API /api/connectors/enterprise] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Gagal memproses konektor enterprise' },
      { status: 500 }
    );
  }
}
