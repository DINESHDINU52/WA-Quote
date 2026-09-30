/**
 * Tasks collection — Microsoft To Do style task manager built on Firestore.
 */

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  type Unsubscribe
} from 'firebase/firestore';
import { getDb } from './firebase/client';

export type TaskStatus = 'open' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'normal' | 'high';

export interface TaskLink {
  type: 'quotation' | 'proforma' | 'customer';
  id: string;
  label: string;
}

export interface Task {
  id: string;
  title: string;
  notes?: string;

  ownerUid: string;
  ownerName?: string;
  createdBy: string;
  createdByName?: string;

  status: TaskStatus;
  completedAt?: number;

  dueAt?: number;
  reminderMinutesBefore?: number;
  notifiedAt?: number; // when we last fired a desktop notification

  linkedTo?: TaskLink;
  priority?: TaskPriority;

  createdAt: number;
  updatedAt: number;
}

export interface NewTaskInput {
  title: string;
  notes?: string;
  ownerUid: string;
  ownerName?: string;
  createdBy: string;
  createdByName?: string;
  dueAt?: number;
  reminderMinutesBefore?: number;
  linkedTo?: TaskLink;
  priority?: TaskPriority;
}

function tasksCol() {
  return collection(getDb(), 'tasks');
}

export async function createTask(input: NewTaskInput): Promise<string> {
  const id = doc(tasksCol()).id;
  const now = Date.now();
  const data: Omit<Task, 'id'> = stripUndefined({
    title: input.title.trim(),
    notes: input.notes?.trim() || undefined,
    ownerUid: input.ownerUid,
    ownerName: input.ownerName,
    createdBy: input.createdBy,
    createdByName: input.createdByName,
    status: 'open',
    dueAt: input.dueAt,
    reminderMinutesBefore: input.reminderMinutesBefore,
    linkedTo: input.linkedTo,
    priority: input.priority || 'normal',
    createdAt: now,
    updatedAt: now
  }) as Omit<Task, 'id'>;
  await setDoc(doc(tasksCol(), id), data);
  return id;
}

export async function updateTask(id: string, patch: Partial<Task>): Promise<void> {
  const update = stripUndefined({
    ...patch,
    updatedAt: Date.now()
  });
  await updateDoc(doc(tasksCol(), id), update as any);
}

export async function deleteTask(id: string): Promise<void> {
  await deleteDoc(doc(tasksCol(), id));
}

export async function setTaskDone(id: string, done: boolean): Promise<void> {
  await updateTask(id, {
    status: done ? 'done' : 'open',
    completedAt: done ? Date.now() : undefined
  });
}

/** Subscribe to all tasks owned by a user. Sorts client-side to avoid composite index. */
export function subscribeMyTasks(uid: string, cb: (tasks: Task[]) => void): Unsubscribe {
  const q = query(tasksCol(), where('ownerUid', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const list: Task[] = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) } as Task))
        // Newest first — sorted on the client to avoid Firestore composite index requirement
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      cb(list);
    },
    (err) => {
      console.error('[subscribeMyTasks] failed:', err);
      cb([]);
    }
  );
}

/** Subscribe to tasks created by a user (for admins viewing what they assigned). */
export function subscribeTasksByCreator(uid: string, cb: (tasks: Task[]) => void): Unsubscribe {
  const q = query(tasksCol(), where('createdBy', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const list: Task[] = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) } as Task))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      cb(list);
    },
    (err) => {
      console.error('[subscribeTasksByCreator] failed:', err);
      cb([]);
    }
  );
}

/** Subscribe to ALL tasks (admin/MD view). */
export function subscribeAllTasks(cb: (tasks: Task[]) => void): Unsubscribe {
  const q = query(tasksCol(), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as Task)));
    },
    (err) => {
      console.error('[subscribeAllTasks] failed:', err);
      cb([]);
    }
  );
}

// ---------------------------------------------------------------------------
// Grouping helpers
// ---------------------------------------------------------------------------

export type TaskBucket = 'overdue' | 'today' | 'tomorrow' | 'thisWeek' | 'later' | 'noDate' | 'completed';

export function bucketize(task: Task, now: Date = new Date()): TaskBucket {
  if (task.status === 'done') return 'completed';
  if (task.status === 'cancelled') return 'completed';
  if (!task.dueAt) return 'noDate';

  const due = new Date(task.dueAt);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const dayAfter = new Date(today);
  dayAfter.setDate(today.getDate() + 2);
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);

  if (task.dueAt < today.getTime()) return 'overdue';
  if (task.dueAt < tomorrow.getTime()) return 'today';
  if (task.dueAt < dayAfter.getTime()) return 'tomorrow';
  if (task.dueAt < weekEnd.getTime()) return 'thisWeek';
  return 'later';
}

export const BUCKET_LABELS: Record<TaskBucket, string> = {
  overdue: 'Overdue',
  today: 'Today',
  tomorrow: 'Tomorrow',
  thisWeek: 'This Week',
  later: 'Later',
  noDate: 'No Date',
  completed: 'Completed'
};

export const BUCKET_ORDER: TaskBucket[] = [
  'overdue',
  'today',
  'tomorrow',
  'thisWeek',
  'later',
  'noDate',
  'completed'
];

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    if (v !== null && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && !(v instanceof Timestamp)) {
      out[k as keyof T] = stripUndefined(v as any) as any;
    } else {
      out[k as keyof T] = v as any;
    }
  }
  return out;
}
