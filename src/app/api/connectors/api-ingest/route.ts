import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, hasServerPermission } from '@lib/auth/serverAuth';
import { testAndPreviewApi, syncApiConnector, ApiConnectorConfig } from '@lib/connectors/apiConnectorService';

/**
 * Validates whether the URL is safe to fetch (basic SSRF protection for cloud/internal IPs).
 */
function isSafeUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    // Block cloud metadata endpoint
    if (parsed.hostname === '169.254.169.254' || parsed.hostname === 'metadata.google.internal') {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  // 1. Authentication Check
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return NextResponse.json(
      { error: 'Unauthorized: Sesi tidak valid atau telah berakhir. Silakan login kembali.' },
      { status: 401 }
    );
  }

  // 2. Permission Check (requires documents:upload permission or admin/editor/superadmin role)
  const canUpload = await hasServerPermission(req, 'documents:upload');
  const roleId = String(authUser.role_id || '').toLowerCase();
  const roleName = String(authUser.role?.name || '').toLowerCase();
  const isAuthorized =
    canUpload ||
    roleId.includes('admin') ||
    roleId.includes('editor') ||
    roleName.includes('admin') ||
    roleName.includes('editor') ||
    Boolean(authUser.role?.permissions?.includes('documents:upload'));

  if (!isAuthorized) {
    return NextResponse.json(
      { error: 'Forbidden: Anda tidak memiliki hak akses untuk mengintegrasikan sumber API eksternal.' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const action = body.action || 'sync'; // 'preview' | 'sync'
    const {
      sourceName,
      endpointUrl,
      method = 'GET',
      headers = {},
      bodyPayload,
      authType = 'none',
      authToken,
      apiKeyHeader,
      basicUsername,
      basicPassword,
      recordPath,
      chunkSize = 800,
      chunkOverlap = 150,
      divisionId = 'General',
      classification = 'Internal',
      status = 'Aktif',
      version = '1.0',
      reviewDueDate,
      userGrants,
    } = body;

    // 3. Validation
    if (!sourceName || typeof sourceName !== 'string' || !sourceName.trim()) {
      return NextResponse.json(
        { error: 'Nama sumber data (sourceName) wajib diisi.' },
        { status: 400 }
      );
    }

    if (!endpointUrl || typeof endpointUrl !== 'string' || !isSafeUrl(endpointUrl)) {
      return NextResponse.json(
        { error: 'Endpoint URL tidak valid atau protokol tidak didukung (harus http/https).' },
        { status: 400 }
      );
    }

    const config: ApiConnectorConfig = {
      sourceName: sourceName.trim(),
      endpointUrl: endpointUrl.trim(),
      method: method === 'POST' ? 'POST' : 'GET',
      headers: typeof headers === 'object' && headers !== null ? headers : {},
      bodyPayload,
      authType,
      authToken,
      apiKeyHeader,
      basicUsername,
      basicPassword,
      recordPath: typeof recordPath === 'string' ? recordPath.trim() : undefined,
      chunkSize: Number(chunkSize) || 800,
      chunkOverlap: Number(chunkOverlap) || 150,
      ownerId: authUser.id,
      divisionId: String(divisionId || 'General'),
      classification,
      status,
      version: String(version || '1.0'),
      reviewDueDate: reviewDueDate ? new Date(reviewDueDate) : null,
      userGrants: Array.isArray(userGrants) ? userGrants : [],
    };

    // 4. Handle Action
    if (action === 'preview') {
      const preview = await testAndPreviewApi(config);
      return NextResponse.json({
        success: true,
        preview,
      });
    }

    // Default: 'sync'
    const result = await syncApiConnector(config);
    return NextResponse.json({
      success: true,
      message: `Berhasil menarik dan mengindeks ${result.recordCount} entri (${result.chunkCount} chunks) dari API "${result.sourceName}".`,
      data: result,
    });
  } catch (error: any) {
    console.error('[API Connector Route Error]:', error);
    return NextResponse.json(
      {
        error: error.message || 'Terjadi kesalahan saat memproses penarikan data API.',
      },
      { status: 500 }
    );
  }
}
