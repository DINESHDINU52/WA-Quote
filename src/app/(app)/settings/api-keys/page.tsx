'use client';

import { useState, useEffect } from 'react';
import { PageHeader } from '@/components/page-header';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { getDb } from '@/lib/firebase/client';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  query
} from 'firebase/firestore';
import type { ApiKeyDoc } from '@/lib/api-key-auth';
import {
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  Ban,
  Activity,
  Code2,
  Terminal,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Sparkles,
  Play,
  FileText,
  DollarSign
} from 'lucide-react';

async function sha256Hex(str: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(str));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateRandomKey(): string {
  const array = new Uint8Array(24);
  window.crypto.getRandomValues(array);
  const hex = Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `ed_live_${hex}`;
}

export default function ApiKeysPage() {
  const { profile } = useAuth();
  const { show: pushToast } = useToast();

  const [keys, setKeys] = useState<ApiKeyDoc[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newKeyResult, setNewKeyResult] = useState<{ rawKey: string; keyDoc: ApiKeyDoc } | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Playground / testing state
  const [playgroundTab, setPlaygroundTab] = useState<'docs' | 'tester'>('docs');
  const [snippetLang, setSnippetLang] = useState<'curl' | 'js' | 'python'>('curl');
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>('/api/v1/crm/summary');
  const [manualKey, setManualKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResponse, setTestResponse] = useState<any>(null);
  const [testStatusCode, setTestStatusCode] = useState<number | null>(null);
  const [testDuration, setTestDuration] = useState<number | null>(null);

  // Real-time listener for API keys via settings/api_keys with API route fallback
  const fetchKeys = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/api-keys');
      const data = await res.json();
      if (data.ok && Array.isArray(data.keys)) {
        setKeys(data.keys.filter((k: ApiKeyDoc) => k && k.keyPrefix));
      }
    } catch (e) {
      console.error('Failed to fetch keys:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let unsub: (() => void) | null = null;

    try {
      unsub = onSnapshot(
        doc(getDb(), 'settings', 'api_keys'),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            if (Array.isArray(data?.keys)) {
              setKeys(data.keys.filter((k: ApiKeyDoc) => k && k.keyPrefix));
            }
          }
          setLoading(false);
        },
        (err) => {
          console.warn('Firestore onSnapshot error, falling back to API:', err);
          fetchKeys();
        }
      );
    } catch {
      fetchKeys();
    }

    return () => {
      if (unsub) unsub();
    };
  }, []);

  // Handle Create API Key via admin endpoint
  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim()) return;

    try {
      setCreating(true);
      const res = await fetch('/api/admin/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: keyName.trim(),
          createdBy: profile?.email || 'admin'
        })
      });
      const data = await res.json();
      if (data.ok && data.rawKey) {
        setNewKeyResult({ rawKey: data.rawKey, keyDoc: data.keyDoc });
        setManualKey(data.rawKey);
        // Refresh local list
        setKeys((prev) => [data.keyDoc, ...prev.filter((k) => k.id !== data.keyDoc.id)]);
        pushToast({
          kind: 'success',
          title: 'API Key Created',
          description: 'Copy the secret key now before closing.'
        });
      } else {
        throw new Error(data.error || 'Server error creating key');
      }
    } catch (err: any) {
      pushToast({
        kind: 'error',
        title: 'Error',
        description: err?.message || 'Failed to create API key'
      });
    } finally {
      setCreating(false);
    }
  };

  // Handle Revoke Key
  const handleRevokeKey = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to revoke "${name}"? External CRMs using this key will immediately lose access.`)) {
      return;
    }
    try {
      const res = await fetch('/api/admin/api-keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'revoke' })
      });
      const data = await res.json();
      if (data.ok) {
        setKeys((prev) =>
          prev.map((k) => (k.id === id ? { ...k, status: 'revoked', revokedAt: Date.now() } : k))
        );
        pushToast({
          kind: 'warn',
          title: 'API Key Revoked',
          description: `Key "${name}" has been disabled.`
        });
      }
    } catch (err: any) {
      pushToast({
        kind: 'error',
        title: 'Error',
        description: err?.message || 'Failed to revoke API key'
      });
    }
  };

  // Handle Delete Key
  const handleDeleteKey = async (id: string, name: string) => {
    if (!confirm(`Permanently delete "${name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch('/api/admin/api-keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'delete' })
      });
      const data = await res.json();
      if (data.ok) {
        setKeys((prev) => prev.filter((k) => k.id !== id));
        pushToast({
          kind: 'success',
          title: 'API Key Deleted',
          description: `Key "${name}" has been removed.`
        });
      }
    } catch (err: any) {
      pushToast({
        kind: 'error',
        title: 'Error',
        description: err?.message || 'Failed to delete API key'
      });
    }
  };

  // Copy Key to Clipboard
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    pushToast({
      kind: 'success',
      title: 'Copied to Clipboard!',
      description: 'API Key has been copied.'
    });
    setTimeout(() => setCopiedKey(false), 2500);
  };

  // Run Test Query in Playground
  const handleRunTest = async () => {
    if (!manualKey.trim()) {
      pushToast({
        kind: 'warn',
        title: 'API Key Required',
        description: 'Please paste an API key or generate one above to test.'
      });
      return;
    }

    try {
      setTesting(true);
      setTestResponse(null);
      setTestStatusCode(null);
      const start = performance.now();

      const res = await fetch(selectedEndpoint, {
        headers: {
          Authorization: `Bearer ${manualKey.trim()}`
        }
      });
      const duration = Math.round(performance.now() - start);
      setTestDuration(duration);
      setTestStatusCode(res.status);

      const json = await res.json();
      setTestResponse(json);

      if (res.ok) {
        pushToast({
          kind: 'success',
          title: `200 OK (${duration}ms)`,
          description: 'Data successfully retrieved from CRM API!'
        });
      } else {
        pushToast({
          kind: 'error',
          title: `${res.status} Error`,
          description: json.error || 'Request failed'
        });
      }
    } catch (err: any) {
      setTestResponse({ error: err?.message || 'Network error' });
      setTestStatusCode(500);
    } finally {
      setTesting(false);
    }
  };

  const getDomain = () => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return 'https://app.extradesk.in';
  };

  // Code snippets
  const getCurlSnippet = (endpoint: string) => {
    const key = manualKey || 'YOUR_API_KEY';
    return `curl -X GET "${getDomain()}${endpoint}" \\
  -H "Authorization: Bearer ${key}" \\
  -H "Accept: application/json"`;
  };

  const getJsSnippet = (endpoint: string) => {
    const key = manualKey || 'YOUR_API_KEY';
    return `// JavaScript / Node.js
const response = await fetch("${getDomain()}${endpoint}", {
  headers: {
    "Authorization": "Bearer ${key}",
    "Accept": "application/json"
  }
});
const data = await response.json();
console.log(data);`;
  };

  const getPythonSnippet = (endpoint: string) => {
    const key = manualKey || 'YOUR_API_KEY';
    return `# Python (requests)
import requests

url = "${getDomain()}${endpoint}"
headers = {
    "Authorization": "Bearer ${key}",
    "Accept": "application/json"
}

response = requests.get(url, headers=headers)
print(response.json())`;
  };

  return (
    <>
      <PageHeader
        title="API & CRM Integrations"
        description="Generate secure API keys to integrate billing data, paid/unpaid statuses, and customer documents with your CRM dashboard."
        actions={
          <button
            onClick={() => {
              setKeyName('');
              setNewKeyResult(null);
              setIsCreateOpen(true);
            }}
            className="btn btn-primary flex items-center gap-2 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Generate New API Key
          </button>
        }
      />

      {/* Main Content Layout */}
      <div className="space-y-8">
        {/* Active Keys Table Card */}
        <div className="card overflow-hidden border border-slate-200/80 shadow-sm bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
            <div className="flex items-center gap-2.5">
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-600">
                <Key className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold text-ink-900 text-sm">Active API Keys</h3>
                <p className="text-xs text-ink-500">Share these keys with your CRM to authenticate and pull live data.</p>
              </div>
            </div>
            <button
              onClick={fetchKeys}
              title="Refresh Keys"
              className="text-ink-400 hover:text-ink-700 p-1.5 rounded-md hover:bg-slate-100 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-ink-400">
              <Loader2 className="h-6 w-6 animate-spin mb-2" />
              <p className="text-xs">Loading integration keys...</p>
            </div>
          ) : keys.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-600">
                <Key className="h-6 w-6" />
              </div>
              <h4 className="text-sm font-semibold text-ink-900">No API Keys Generated</h4>
              <p className="mt-1 text-xs text-ink-500 max-w-sm mx-auto">
                Generate an API key to securely connect Zoho CRM, Salesforce, HubSpot, or any custom dashboard.
              </p>
              <button
                onClick={() => {
                  setKeyName('');
                  setNewKeyResult(null);
                  setIsCreateOpen(true);
                }}
                className="mt-4 btn btn-primary text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Generate First Key
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-100 text-ink-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3">Key Name</th>
                    <th className="px-6 py-3">Key Prefix</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Created</th>
                    <th className="px-6 py-3">Last Used</th>
                    <th className="px-6 py-3">Requests</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {keys.map((k) => (
                    <tr key={k.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-3.5 font-medium text-ink-900 flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        {k.name}
                      </td>
                      <td className="px-6 py-3.5 font-mono text-ink-700 bg-slate-50/50 rounded inline-block my-2">
                        {k.keyPrefix}
                      </td>
                      <td className="px-6 py-3.5">
                        {k.status === 'active' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200/50">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 border border-rose-200/50">
                            Revoked
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-ink-500">
                        {new Date(k.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="px-6 py-3.5 text-ink-500">
                        {k.lastUsedAt
                          ? new Date(k.lastUsedAt).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'Never'}
                      </td>
                      <td className="px-6 py-3.5 text-ink-600 font-mono">
                        {k.usageCount || 0}
                      </td>
                      <td className="px-6 py-3.5 text-right space-x-2">
                        {k.status === 'active' && (
                          <button
                            onClick={() => handleRevokeKey(k.id, k.name)}
                            title="Revoke key"
                            className="inline-flex items-center gap-1 text-[11px] text-amber-600 hover:text-amber-800 font-medium px-2 py-1 rounded hover:bg-amber-50"
                          >
                            <Ban className="h-3 w-3" /> Revoke
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteKey(k.id, k.name)}
                          title="Delete key"
                          className="inline-flex items-center gap-1 text-[11px] text-rose-600 hover:text-rose-800 font-medium px-2 py-1 rounded hover:bg-rose-50"
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Integration Guide & Interactive Tester Tabs */}
        <div className="card overflow-hidden border border-slate-200/80 shadow-sm bg-white">
          <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-brand-600" />
              <h3 className="font-semibold text-ink-900 text-sm">CRM Integration Endpoints & Playground</h3>
            </div>
            <div className="flex items-center bg-slate-200/60 p-0.5 rounded-lg text-xs">
              <button
                onClick={() => setPlaygroundTab('docs')}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  playgroundTab === 'docs'
                    ? 'bg-white text-ink-900 shadow-xs'
                    : 'text-ink-600 hover:text-ink-900'
                }`}
              >
                API Documentation
              </button>
              <button
                onClick={() => setPlaygroundTab('tester')}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  playgroundTab === 'tester'
                    ? 'bg-white text-ink-900 shadow-xs'
                    : 'text-ink-600 hover:text-ink-900'
                }`}
              >
                Live API Playground
              </button>
            </div>
          </div>

          {playgroundTab === 'docs' ? (
            <div className="p-6 space-y-6">
              {/* How it works banner */}
              <div className="rounded-xl border border-brand-100 bg-brand-50/40 p-4 flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-brand-600 shrink-0 mt-0.5" />
                <div className="text-xs text-ink-700 space-y-1">
                  <div className="font-semibold text-ink-900 text-sm">Authenticating Requests</div>
                  <p>
                    Pass your secret key in the request header using either{' '}
                    <code className="bg-brand-100/60 text-brand-800 px-1.5 py-0.5 rounded font-mono font-bold">
                      Authorization: Bearer ed_live_...
                    </code>{' '}
                    or{' '}
                    <code className="bg-brand-100/60 text-brand-800 px-1.5 py-0.5 rounded font-mono font-bold">
                      x-api-key: ed_live_...
                    </code>
                    . All endpoints return standard JSON formatted for CRM dashboard consumption.
                  </p>
                </div>
              </div>

              {/* Endpoints Table */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-ink-900 uppercase tracking-wider">Available CRM Endpoints</h4>
                <div className="grid grid-cols-1 gap-3">
                  {/* Endpoint 1 */}
                  <div className="border border-slate-200/80 rounded-lg p-3.5 hover:border-brand-200 transition-colors bg-white">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 uppercase tracking-wide">
                        GET
                      </span>
                      <span className="font-mono text-xs font-semibold text-ink-900">
                        /api/v1/crm/summary
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-ink-600">
                      Returns high-level financial metrics for CRM cards: total revenue, total collected, outstanding balance, collection rate %, and proformas/invoices breakdown (paid count, unpaid count, partial count).
                    </p>
                  </div>

                  {/* Endpoint 2 */}
                  <div className="border border-slate-200/80 rounded-lg p-3.5 hover:border-brand-200 transition-colors bg-white">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 uppercase tracking-wide">
                        GET
                      </span>
                      <span className="font-mono text-xs font-semibold text-ink-900">
                        /api/v1/crm/documents
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-ink-600">
                      Returns a filtered list of documents with payment status.
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-mono text-ink-600">
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded">?paymentStatus=unpaid</span>
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded">?paymentStatus=paid</span>
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded">?paymentStatus=partial</span>
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded">?docType=proforma|invoice|quotation|po</span>
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded">?search=acme</span>
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded">?limit=50&page=1</span>
                    </div>
                  </div>

                  {/* Endpoint 3 */}
                  <div className="border border-slate-200/80 rounded-lg p-3.5 hover:border-brand-200 transition-colors bg-white">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 uppercase tracking-wide">
                        GET
                      </span>
                      <span className="font-mono text-xs font-semibold text-ink-900">
                        /api/v1/crm/documents/[id_or_number]
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-ink-600">
                      Fetches single document details, complete itemized line items, full payment installment history, customer address, and Google Drive PDF link.
                    </p>
                  </div>
                </div>
              </div>

              {/* Code Samples */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-ink-900 uppercase tracking-wider">Integration Code Snippet</h4>
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded text-[11px]">
                    <button
                      onClick={() => setSnippetLang('curl')}
                      className={`px-2 py-0.5 rounded font-medium ${
                        snippetLang === 'curl' ? 'bg-white shadow-xs text-ink-900' : 'text-ink-600'
                      }`}
                    >
                      cURL
                    </button>
                    <button
                      onClick={() => setSnippetLang('js')}
                      className={`px-2 py-0.5 rounded font-medium ${
                        snippetLang === 'js' ? 'bg-white shadow-xs text-ink-900' : 'text-ink-600'
                      }`}
                    >
                      Node / JS
                    </button>
                    <button
                      onClick={() => setSnippetLang('python')}
                      className={`px-2 py-0.5 rounded font-medium ${
                        snippetLang === 'python' ? 'bg-white shadow-xs text-ink-900' : 'text-ink-600'
                      }`}
                    >
                      Python
                    </button>
                  </div>
                </div>

                <div className="relative rounded-lg bg-slate-950 p-4 font-mono text-xs text-slate-200 overflow-x-auto shadow-inner">
                  <button
                    onClick={() => {
                      const code =
                        snippetLang === 'curl'
                          ? getCurlSnippet('/api/v1/crm/summary')
                          : snippetLang === 'js'
                          ? getJsSnippet('/api/v1/crm/summary')
                          : getPythonSnippet('/api/v1/crm/summary');
                      handleCopy(code);
                    }}
                    className="absolute top-3 right-3 text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors"
                    title="Copy code"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  <pre className="pr-12">
                    {snippetLang === 'curl' && getCurlSnippet('/api/v1/crm/summary')}
                    {snippetLang === 'js' && getJsSnippet('/api/v1/crm/summary')}
                    {snippetLang === 'python' && getPythonSnippet('/api/v1/crm/summary')}
                  </pre>
                </div>
              </div>
            </div>
          ) : (
            /* Live Tester Tab */
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-ink-800 mb-1">
                    Select Endpoint to Test
                  </label>
                  <select
                    value={selectedEndpoint}
                    onChange={(e) => setSelectedEndpoint(e.target.value)}
                    className="w-full text-xs font-mono rounded-lg border border-slate-200 px-3 py-2 bg-white focus:outline-brand-600"
                  >
                    <option value="/api/v1/crm/summary">GET /api/v1/crm/summary (Overview metrics)</option>
                    <option value="/api/v1/crm/documents?paymentStatus=unpaid">GET /api/v1/crm/documents?paymentStatus=unpaid (Pending payments)</option>
                    <option value="/api/v1/crm/documents?paymentStatus=paid">GET /api/v1/crm/documents?paymentStatus=paid (Collected payments)</option>
                    <option value="/api/v1/crm/documents?docType=proforma">GET /api/v1/crm/documents?docType=proforma (All Proformas)</option>
                    <option value="/api/v1/crm/documents?docType=invoice">GET /api/v1/crm/documents?docType=invoice (All Tax Invoices)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-800 mb-1">
                    API Key for Testing
                  </label>
                  <input
                    type="password"
                    placeholder="Paste your ed_live_... key here"
                    value={manualKey}
                    onChange={(e) => setManualKey(e.target.value)}
                    className="w-full text-xs font-mono rounded-lg border border-slate-200 px-3 py-2 bg-white focus:outline-brand-600"
                  />
                  <p className="text-[10px] text-ink-500 mt-1">
                    {manualKey ? '✓ Key entered' : 'Generate or paste a key to send requests.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={handleRunTest}
                  disabled={testing || !manualKey.trim()}
                  className="btn btn-primary flex items-center gap-2 text-xs"
                >
                  {testing ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending Request...
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5" /> Send Test Request
                    </>
                  )}
                </button>

                {testStatusCode && (
                  <div className="flex items-center gap-3 text-xs">
                    <span
                      className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                        testStatusCode === 200
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      Status: {testStatusCode}
                    </span>
                    {testDuration !== null && (
                      <span className="text-ink-500 font-mono">{testDuration}ms</span>
                    )}
                  </div>
                )}
              </div>

              {/* Output Viewer */}
              {testResponse && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink-700">Response Payload (JSON):</span>
                    <button
                      onClick={() => handleCopy(JSON.stringify(testResponse, null, 2))}
                      className="text-xs text-brand-600 hover:text-brand-800 font-medium inline-flex items-center gap-1"
                    >
                      <Copy className="h-3 w-3" /> Copy JSON
                    </button>
                  </div>
                  <pre className="rounded-lg bg-slate-950 p-4 font-mono text-xs text-emerald-400 overflow-x-auto max-h-96 shadow-inner border border-slate-800">
                    {JSON.stringify(testResponse, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Generate API Key Modal Dialog */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in">
          <div className="card w-full max-w-lg border border-slate-200 bg-white p-6 shadow-xl rounded-2xl space-y-5">
            {!newKeyResult ? (
              <form onSubmit={handleCreateKey} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
                    <Key className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-ink-900 text-base">Generate New API Key</h3>
                    <p className="text-xs text-ink-500">Create a secret key to share with your CRM system.</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-800 mb-1">
                    Key Name / Identifier <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Zoho CRM, Salesforce, Mobile App Dashboard"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    className="w-full text-sm rounded-lg border border-slate-200 px-3.5 py-2.5 bg-white focus:outline-brand-600 focus:border-brand-600"
                    autoFocus
                  />
                  <p className="mt-1 text-[11px] text-ink-500">
                    Give this key a descriptive name so you remember where it is being used.
                  </p>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-900">
                    This key grants read access to proformas, invoices, payment status, and customer snapshots for your CRM dashboard.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="btn btn-secondary text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating || !keyName.trim()}
                    className="btn btn-primary text-xs flex items-center gap-1.5"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Creating...
                      </>
                    ) : (
                      'Generate Key'
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* Success & Reveal Key View */
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-ink-900 text-base">API Key Generated!</h3>
                    <p className="text-xs text-ink-500">Name: {newKeyResult.keyDoc.name}</p>
                  </div>
                </div>

                <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-rose-900">
                    <span className="font-bold">Important:</span> Copy this API key now. For your security, you will not be able to view this full secret key again.
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-ink-700">Secret API Key</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={newKeyResult.rawKey}
                      className="w-full text-xs font-mono rounded-lg border border-slate-200 px-3.5 py-2.5 bg-slate-50 text-ink-900 select-all"
                    />
                    <button
                      onClick={() => handleCopy(newKeyResult.rawKey)}
                      className={`btn ${
                        copiedKey ? 'btn-success bg-emerald-600 text-white' : 'btn-primary'
                      } text-xs shrink-0 flex items-center gap-1`}
                    >
                      {copiedKey ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedKey ? 'Copied' : 'Copy Key'}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-3">
                  <button
                    onClick={() => setIsCreateOpen(false)}
                    className="btn btn-primary text-xs"
                  >
                    I have copied my key — Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
