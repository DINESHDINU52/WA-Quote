import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * POST /api/companies/upload-logo
 * Body: { filename, mimeType, base64, companyName }
 *
 * Saves the company logo PNG/JPG/SVG.
 * If Google Drive Apps Script is configured (APPS_SCRIPT_URL), it backs up the PNG
 * to the Google Drive folder.
 * Returns the public Drive URL (if available) and the base64 data URL for fast rendering.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { filename, mimeType, base64, companyName } = body;

    if (!base64) {
      return NextResponse.json({ ok: false, error: 'Missing base64 image data' }, { status: 400 });
    }

    const cleanBase64 = base64.replace(/^data:image\/[a-z+]+;base64,/, '');
    const dataUrl = base64.startsWith('data:')
      ? base64
      : `data:${mimeType || 'image/png'};base64,${cleanBase64}`;

    const appsScriptUrl = process.env.APPS_SCRIPT_URL;
    let driveUrl: string | null = null;
    let driveFileId: string | null = null;

    if (appsScriptUrl) {
      try {
        const driveRes = await fetch(appsScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'uploadCompanyLogo',
            secret: process.env.APPS_SCRIPT_SECRET || '',
            filename: filename || `${companyName || 'company'}_logo.png`,
            mimeType: mimeType || 'image/png',
            base64: cleanBase64,
            companyName: companyName || 'Company',
            folderId: process.env.GOOGLE_FOLDER_ID || ''
          })
        });

        const json = await driveRes.json();
        if (json?.ok && json?.url) {
          driveUrl = json.url;
          driveFileId = json.fileId || null;
        }
      } catch (err: any) {
        console.warn('[upload-logo] Apps Script upload failed, falling back to base64:', err?.message);
      }
    }

    return NextResponse.json({
      ok: true,
      logoUrl: driveUrl || dataUrl,
      logoBase64: dataUrl,
      driveFileId,
      hasDriveBackup: !!driveUrl
    });
  } catch (err: any) {
    console.error('[upload-logo] error:', err);
    return NextResponse.json(
      { ok: false, error: err?.message || 'Failed to process logo' },
      { status: 500 }
    );
  }
}
