/**
 * Atomic invoice/quotation numbering.
 * Uses Firestore transactions on `counters/{key}` so concurrent issuers
 * never collide on the same sequence.
 *
 * Counter doc shape:
 *   { value: number, updatedAt: Timestamp, updatedBy: string }
 *
 * Counter key:
 *   `${docType}_${fy}` for per-FY counters (default)
 *   `${docType}` for continuous counters
 */

import { doc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { getDb } from './firebase/client';
import type { NumberingSettings } from './schemas';
import { fyFromDate } from './utils';

export type DocType = 'quotation' | 'proforma' | 'po' | 'invoice' | 'creditNote';

export interface AllocateNumberArgs {
  docType: DocType;
  date: Date;
  settings: NumberingSettings;
  /** uid of the user who issued the doc; recorded on the counter for audit. */
  issuedBy: string;
}

export interface AllocatedNumber {
  number: string;
  fy: string;
  sequence: number;
}

export function counterKey(docType: DocType, fy: string, pattern: NumberingSettings['pattern']) {
  return pattern === 'per-fy' ? `${docType}_${fy}` : docType;
}

export function formatNumber(
  prefix: string,
  fy: string,
  sequence: number,
  pad: number,
  pattern: NumberingSettings['pattern']
) {
  const seq = String(sequence).padStart(pad, '0');
  return pattern === 'per-fy' ? `${prefix}/${fy}/${seq}` : `${prefix}/${seq}`;
}

/**
 * Allocate the next number for a doc type in a transaction.
 * If the counter does not exist it starts from 1 (use `seedCounter` once
 * to set a different starting value, e.g. continuing legacy numbering).
 */
export async function allocateNumber(args: AllocateNumberArgs): Promise<AllocatedNumber> {
  const { docType, date, settings, issuedBy } = args;
  const fy = fyFromDate(date);
  const key = counterKey(docType, fy, settings.pattern);
  const ref = doc(getDb(), 'counters', key);

  const sequence = await runTransaction(getDb(), async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists() ? (snap.data().value as number) : 0;
    const next = current + 1;
    tx.set(
      ref,
      { value: next, updatedAt: serverTimestamp(), updatedBy: issuedBy },
      { merge: true }
    );
    return next;
  });

  const prefix = settings.prefix[docType];
  return {
    number: formatNumber(prefix, fy, sequence, settings.pad, settings.pattern),
    fy,
    sequence
  };
}

/**
 * Seed or reset a counter to a specific value. Used during onboarding to
 * continue from your current invoice number (e.g. 10007 for tax invoices).
 * The next allocation will return seedValue + 1.
 */
export async function seedCounter(
  docType: DocType,
  fy: string,
  seedValue: number,
  pattern: NumberingSettings['pattern'] = 'per-fy',
  issuedBy = 'system'
) {
  const key = counterKey(docType, fy, pattern);
  const ref = doc(getDb(), 'counters', key);
  await runTransaction(getDb(), async (tx) => {
    tx.set(
      ref,
      { value: seedValue, updatedAt: serverTimestamp(), updatedBy: issuedBy },
      { merge: true }
    );
  });
}
