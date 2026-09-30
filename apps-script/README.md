# CHN — Drive Upload Apps Script

Bridges the Next.js / Firebase backend to Google Drive. Receives signed PDF
uploads and files them into year-and-doc-type folders on Drive.

## One-time setup

1. Open https://script.google.com → **New project**.
2. Replace the default `Code.gs` with the contents of `Code.gs` in this folder.
3. Replace `appsscript.json` (Project Settings → "Show 'appsscript.json'
   manifest file in editor") with the one in this folder.
4. Project Settings → **Script Properties** → add two entries:
   - `SHARED_SECRET` — long random string. Will go in `.env.local` later.
   - `ROOT_FOLDER_ID` — the Drive folder ID where everything lives.
     Open the folder in Drive, copy the part of the URL after `/folders/`.
5. **Deploy → New deployment → Web app**:
   - Description: `CHN drive uploader v1`
   - Execute as: **Me**
   - Who has access: **Anyone with the link**
6. Authorise the requested scopes (Drive + external requests).
7. Copy the deployment URL ending in `/exec`. Add to Next.js env:
   ```
   APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec
   APPS_SCRIPT_SECRET=<same value as SHARED_SECRET>
   ```

## Health check

Open `<deployment-url>?ping=1` in a browser. Should return:
```json
{ "ok": true, "service": "chn-drive-upload", ... }
```

## Folder layout

```
<ROOT_FOLDER_ID>/
└── FY2526/
    ├── Quotations/
    ├── Proforma Invoices/
    ├── Tax Invoices/
    └── Credit Notes/
```

Folders are created lazily on first upload of each type.

## Re-issuing edits

Pass `overwriteFileId` in the request body to replace a previous version.
The web app trashes the old file and writes a new one in the same folder
to avoid Drive viewer cache issues. Update the stored `pdf.driveFileId` on
your Firestore doc with the new id.
