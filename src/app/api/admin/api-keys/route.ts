import { NextRequest, NextResponse } from 'next/server';
import { createApiKey, listApiKeys, revokeApiKey, deleteApiKey } from '@/lib/api-key-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/admin/api-keys
 * Returns list of API keys for the settings page.
 */
export async function GET(req: NextRequest) {
  try {
    const keys = await listApiKeys();
    return NextResponse.json({ ok: true, keys });
  } catch (err: any) {
    console.error('[admin-api-keys] Error listing keys:', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to list API keys' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/api-keys
 * Creates a new API key and returns the full secret key once.
 * Body: { name: string, permissions?: string[], createdBy?: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = (body?.name || '').trim();
    if (!name) {
      return NextResponse.json(
        { ok: false, error: 'Please enter a name for the API key (e.g. "Zoho CRM")' },
        { status: 400 }
      );
    }

    const createdBy = body?.createdBy || 'admin';
    const permissions = body?.permissions || ['crm:read'];

    const { rawKey, keyDoc } = await createApiKey(name, createdBy, permissions);

    return NextResponse.json({
      ok: true,
      rawKey,
      keyDoc
    });
  } catch (err: any) {
    console.error('[admin-api-keys] Error creating key:', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to create API key' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/api-keys
 * Revokes or deletes an API key.
 * Body: { id: string, action?: 'revoke' | 'delete' }
 */
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const id = body?.id;
    const action = body?.action || 'revoke';

    if (!id) {
      return NextResponse.json({ ok: false, error: 'Missing key id' }, { status: 400 });
    }

    if (action === 'delete') {
      await deleteApiKey(id);
    } else {
      await revokeApiKey(id);
    }

    return NextResponse.json({ ok: true, id, action });
  } catch (err: any) {
    console.error('[admin-api-keys] Error updating key:', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to process API key' },
      { status: 500 }
    );
  }
}
