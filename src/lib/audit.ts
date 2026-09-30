import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getDb } from './firebase/client';

export type AuditAction =
  | 'price_update'
  | 'product_create'
  | 'product_update'
  | 'product_delete'
  | 'bulk_import'
  | 'bulk_delete';

export interface AuditEntry {
  id?: string;
  action: AuditAction;
  entityType: 'product' | 'customer' | 'doc' | 'system';
  entityId?: string;
  entityName: string;
  serialNumber?: string;
  oldPrice?: number;
  newPrice?: number;
  details?: string;
  userUid: string;
  userName: string;
  userRole?: string;
  timestamp?: any;
}

/**
 * Log an audit activity entry to the append-only `audit` collection in Firestore.
 */
export async function logAuditActivity(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<void> {
  try {
    const col = collection(getDb(), 'audit');
    await addDoc(col, {
      ...entry,
      timestamp: serverTimestamp()
    });
  } catch (err) {
    console.error('[audit] Failed to log activity:', err);
    // Non-blocking: audit failure should not break user operations
  }
}
