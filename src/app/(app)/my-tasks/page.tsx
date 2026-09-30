'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/page-header';
import {
  bucketize,
  BUCKET_LABELS,
  BUCKET_ORDER,
  createTask,
  deleteTask,
  setTaskDone,
  subscribeAllTasks,
  subscribeMyTasks,
  updateTask,
  type Task,
  type TaskBucket,
  type TaskPriority
} from '@/lib/tasks';
import { useTimer } from '@/lib/timer-context';
import { playTaskDone, ensureAudioReady } from '@/lib/audio';
import {
  Plus,
  Calendar,
  Trash2,
  Flag,
  Timer as TimerIcon,
  Loader2,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronRight,
  Bell,
  X,
  Eye,
  EyeOff,
  Users,
  AlertCircle
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { getDb } from '@/lib/firebase/client';
import { showNotification, requestNotificationPermission, notificationPermission } from '@/lib/notifications';
import { useToast } from '@/lib/toast-context';

interface UserOpt {
  uid: string;
  displayName: string;
  email: string;
}

export default function MyTasksPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin' || profile?.role === 'md';
  const toast = useToast();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);
  const [viewAll, setViewAll] = useState(false); // admin can toggle "all team tasks" view
  const [users, setUsers] = useState<UserOpt[]>([]);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');

  // Quick add state
  const [quickTitle, setQuickTitle] = useState('');
  const [quickDueDate, setQuickDueDate] = useState('');
  const [quickDueTime, setQuickDueTime] = useState('');
  const [quickAssignee, setQuickAssignee] = useState<string>('');
  const [quickPriority, setQuickPriority] = useState<TaskPriority>('normal');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to tasks
  useEffect(() => {
    if (!profile?.uid) return;
    setLoading(true);
    const unsub =
      isAdmin && viewAll
        ? subscribeAllTasks((list) => {
            setTasks(list);
            setLoading(false);
          })
        : subscribeMyTasks(profile.uid, (list) => {
            setTasks(list);
            setLoading(false);
          });
    return () => unsub();
  }, [profile?.uid, isAdmin, viewAll]);

  // Load users for assignee dropdown (admins only)
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const snap = await getDocs(collection(getDb(), 'users'));
        setUsers(
          snap.docs.map((d) => {
            const data = d.data() as any;
            return {
              uid: d.id,
              displayName: data.displayName || data.email || 'User',
              email: data.email || ''
            };
          })
        );
      } catch {}
    })();
  }, [isAdmin]);

  // Initialize permission state
  useEffect(() => {
    setPermission(notificationPermission());
  }, []);

  // Background due-time notifier — checks every 30 sec
  useEffect(() => {
    const fired = new Set<string>();
    const tickId = window.setInterval(() => {
      const now = Date.now();
      for (const t of tasks) {
        if (t.status !== 'open') continue;
        if (!t.dueAt) continue;
        const reminder = t.reminderMinutesBefore ?? 0;
        const fireAt = t.dueAt - reminder * 60_000;
        if (fired.has(t.id)) continue;
        if (now >= fireAt && now <= fireAt + 60_000) {
          fired.add(t.id);
          // In-app toast with action buttons
          toast.show({
            kind: 'task',
            title: '🔔 Task Reminder',
            description: t.title +
              (t.dueAt < now ? ' • OVERDUE' : ` • Due ${new Date(t.dueAt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`),
            duration: 0, // sticky
            actions: [
              {
                label: 'Mark Done',
                primary: true,
                onClick: async () => {
                  await setTaskDone(t.id, true);
                  toast.show({ kind: 'success', title: 'Marked as done', description: t.title });
                }
              },
              {
                label: 'Snooze 5m',
                onClick: async () => {
                  await updateTask(t.id, { dueAt: now + 5 * 60_000 });
                  fired.delete(t.id);
                }
              }
            ]
          });
          // Desktop push notification (when permitted)
          showNotification({
            title: '🔔 Task Reminder',
            body: t.title,
            tag: `task-${t.id}`,
            onClick: () => {
              window.location.href = '/my-tasks';
            }
          });
        }
      }
    }, 30_000);
    return () => window.clearInterval(tickId);
  }, [tasks, toast]);

  // Group tasks
  const grouped = useMemo(() => {
    const map: Record<TaskBucket, Task[]> = {
      overdue: [],
      today: [],
      tomorrow: [],
      thisWeek: [],
      later: [],
      noDate: [],
      completed: []
    };
    for (const t of tasks) {
      map[bucketize(t)].push(t);
    }
    // Sort each bucket by due (oldest first), then created
    for (const key of Object.keys(map) as TaskBucket[]) {
      map[key].sort((a, b) => {
        if (a.priority === 'high' && b.priority !== 'high') return -1;
        if (b.priority === 'high' && a.priority !== 'high') return 1;
        if (a.dueAt && b.dueAt) return a.dueAt - b.dueAt;
        if (a.dueAt) return -1;
        if (b.dueAt) return 1;
        return b.createdAt - a.createdAt;
      });
    }
    return map;
  }, [tasks]);

  async function handleQuickAdd() {
    console.log('[my-tasks] handleQuickAdd called', { quickTitle, profile });
    if (!quickTitle.trim()) {
      console.warn('[my-tasks] Empty title, skipping');
      return;
    }
    if (!profile) {
      console.error('[my-tasks] No profile loaded — cannot create task');
      setError('User profile not loaded yet. Try refreshing the page.');
      return;
    }
    setAdding(true);
    setError(null);
    ensureAudioReady();
    try {
      const dueAt = quickDueDate
        ? new Date(`${quickDueDate}T${quickDueTime || '17:00'}`).getTime()
        : undefined;
      const ownerUid = isAdmin && quickAssignee ? quickAssignee : profile.uid;
      const owner = users.find((u) => u.uid === ownerUid);
      console.log('[my-tasks] Creating task with:', {
        title: quickTitle.trim(),
        ownerUid,
        createdBy: profile.uid,
        dueAt
      });
      const id = await createTask({
        title: quickTitle.trim(),
        ownerUid,
        ownerName: owner?.displayName || profile.displayName || profile.email,
        createdBy: profile.uid,
        createdByName: profile.displayName || profile.email,
        dueAt,
        priority: quickPriority,
        reminderMinutesBefore: dueAt ? 0 : undefined
      });
      console.log('[my-tasks] Task created with ID:', id);
      toast.show({
        kind: 'success',
        title: 'Task added',
        description: dueAt
          ? `"${quickTitle.trim()}" • Due ${new Date(dueAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}`
          : `"${quickTitle.trim()}" added to your list`,
        duration: 3000
      });
      setQuickTitle('');
      setQuickDueDate('');
      setQuickDueTime('');
      setQuickPriority('normal');
    } catch (e: any) {
      console.error('[my-tasks] add task failed:', e);
      const msg = e?.code === 'permission-denied'
        ? 'Permission denied. Firestore rules for "tasks" not deployed yet — push them via "firebase deploy --only firestore:rules".'
        : e?.message || 'Failed to add task';
      setError(msg);
      toast.show({
        kind: 'error',
        title: 'Could not add task',
        description: msg,
        duration: 6000
      });
    } finally {
      setAdding(false);
    }
  }

  async function requestPerm() {
    const result = await requestNotificationPermission();
    setPermission(result);
  }

  const todayCount = grouped.overdue.length + grouped.today.length;

  return (
    <>
      <PageHeader
        title="My Tasks"
        description={
          viewAll
            ? "Team task board — view tasks across all users."
            : "Personal task board with timer, reminders, and sound alerts."
        }
        actions={
          <div className="flex items-center gap-2">
            {permission === 'default' && (
              <button onClick={requestPerm} className="btn-secondary">
                <Bell className="h-4 w-4" />
                Enable Notifications
              </button>
            )}
            {permission === 'denied' && (
              <a
                href="/settings/notifications"
                className="inline-flex items-center gap-1.5 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-700 px-3 py-2 text-xs font-medium border border-rose-200 transition-colors"
                title="Notifications blocked — see how to unblock"
              >
                <Bell className="h-3.5 w-3.5" />
                Notifications Blocked
              </a>
            )}
            {isAdmin && (
              <button
                onClick={() => setViewAll((v) => !v)}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                  viewAll
                    ? 'bg-brand-600 text-white hover:bg-brand-700'
                    : 'bg-ink-100 text-ink-700 hover:bg-ink-200'
                }`}
                title={viewAll ? 'Show only my tasks' : 'View all team tasks'}
              >
                <Users className="h-3.5 w-3.5" />
                {viewAll ? 'Team View' : 'My View'}
              </button>
            )}
          </div>
        }
      />

      {/* Stats */}
      {tasks.length > 0 && (
        <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Overdue" value={grouped.overdue.length} color="rose" />
          <Stat label="Today" value={grouped.today.length} color="amber" />
          <Stat label="This Week" value={grouped.thisWeek.length} color="indigo" />
          <Stat label="Done" value={grouped.completed.length} color="emerald" />
        </div>
      )}

      {/* Quick add */}
      <div className="card p-4 mb-6">
        {error && (
          <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-rose-500 hover:text-rose-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleQuickAdd();
          }}
          className="flex items-start gap-2"
        >
          <input
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            placeholder="Add a task..."
            className="flex-1 rounded-md border border-ink-200 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
          />
          <input
            type="date"
            value={quickDueDate}
            onChange={(e) => setQuickDueDate(e.target.value)}
            className="input w-36"
            title="Due date"
          />
          <input
            type="time"
            value={quickDueTime}
            onChange={(e) => setQuickDueTime(e.target.value)}
            className="input w-28"
            title="Due time"
            disabled={!quickDueDate}
          />
          <select
            value={quickPriority}
            onChange={(e) => setQuickPriority(e.target.value as TaskPriority)}
            className="input w-28"
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
          {isAdmin && (
            <select
              value={quickAssignee}
              onChange={(e) => setQuickAssignee(e.target.value)}
              className="input w-44"
              title="Assign to"
            >
              <option value="">Me</option>
              {users.map((u) => (
                <option key={u.uid} value={u.uid}>
                  {u.displayName}
                </option>
              ))}
            </select>
          )}
          <button
            type="submit"
            disabled={adding || !quickTitle.trim() || !profile}
            className="btn-primary"
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </button>
        </form>
      </div>

      {loading && <div className="text-ink-400">Loading tasks...</div>}

      {!loading && tasks.length === 0 && (
        <div className="card p-12 text-center text-ink-400">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <div className="text-sm">No tasks yet. Add one above to get started.</div>
        </div>
      )}

      {!loading && tasks.length > 0 && (
        <div className="space-y-4">
          {BUCKET_ORDER.map((bucket) => {
            const list = grouped[bucket];
            if (list.length === 0) return null;
            if (bucket === 'completed' && !showCompleted) {
              return (
                <button
                  key={bucket}
                  onClick={() => setShowCompleted(true)}
                  className="w-full card px-4 py-3 hover:bg-ink-50/60 flex items-center justify-between text-sm font-medium text-ink-600"
                >
                  <span className="flex items-center gap-2">
                    <ChevronRight className="h-4 w-4" />
                    {BUCKET_LABELS[bucket]} ({list.length})
                  </span>
                  <Eye className="h-3.5 w-3.5" />
                </button>
              );
            }
            return (
              <div key={bucket} className="card overflow-hidden">
                <div className="flex items-center justify-between bg-ink-50/60 px-4 py-2.5 border-b border-ink-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink-500 flex items-center gap-2">
                    {bucket === 'overdue' && <span className="h-2 w-2 rounded-full bg-rose-500" />}
                    {bucket === 'today' && <span className="h-2 w-2 rounded-full bg-amber-500" />}
                    {bucket === 'tomorrow' && (
                      <span className="h-2 w-2 rounded-full bg-indigo-500" />
                    )}
                    {BUCKET_LABELS[bucket]}
                    <span className="text-ink-400 font-normal">({list.length})</span>
                  </h3>
                  {bucket === 'completed' && (
                    <button
                      onClick={() => setShowCompleted(false)}
                      className="text-ink-400 hover:text-ink-700"
                      title="Hide completed"
                    >
                      <EyeOff className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="divide-y divide-ink-100">
                  {list.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      showOwner={viewAll}
                      onToggle={async () => {
                        ensureAudioReady();
                        const isDoneNow = task.status === 'done';
                        await setTaskDone(task.id, !isDoneNow);
                        if (!isDoneNow) {
                          playTaskDone();
                          toast.show({
                            kind: 'success',
                            title: '✓ Task completed',
                            description: task.title,
                            duration: 2500,
                            sound: false
                          });
                        }
                      }}
                      onDelete={async () => {
                        await deleteTask(task.id);
                        toast.show({
                          kind: 'info',
                          title: 'Task deleted',
                          description: task.title,
                          duration: 2500
                        });
                      }}
                      onUpdate={(patch) => updateTask(task.id, patch)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function TaskRow({
  task,
  showOwner,
  onToggle,
  onDelete,
  onUpdate
}: {
  task: Task;
  showOwner?: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onUpdate: (patch: Partial<Task>) => void;
}) {
  const t = useTimer();
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes || '');
  const isDone = task.status === 'done';
  const overdue = task.dueAt && task.dueAt < Date.now() && task.status === 'open';

  const dueLabel = task.dueAt
    ? new Date(task.dueAt).toLocaleString('en-IN', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    : '';

  const priorityColor: Record<TaskPriority, string> = {
    high: 'text-rose-500',
    normal: 'text-ink-400',
    low: 'text-ink-300'
  };

  function startTimerFor(taskTitle: string) {
    const minutes = window.prompt('Timer duration (minutes)?', '15');
    if (!minutes) return;
    const m = Math.max(1, Math.min(240, Number(minutes) || 15));
    t.start(m * 60, { label: taskTitle, taskId: task.id });
  }

  return (
    <div
      className={`group transition-colors ${
        isDone ? 'opacity-60 bg-ink-50/30' : ''
      } ${overdue ? 'border-l-2 border-l-rose-500' : ''}`}
    >
      <div className="flex items-start gap-3 px-4 py-2.5">
        <button
          type="button"
          onClick={onToggle}
          className="mt-0.5 flex-shrink-0 transition-transform hover:scale-110"
          title={isDone ? 'Mark as not done' : 'Mark as done'}
        >
          {isDone ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          ) : (
            <Circle className="h-5 w-5 text-ink-300 hover:text-emerald-500" />
          )}
        </button>

        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => setExpanded((e) => !e)}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-sm ${
                isDone ? 'line-through text-ink-400' : 'text-ink-900 font-medium'
              }`}
            >
              {task.title}
            </span>
            {task.priority === 'high' && (
              <Flag className={`h-3.5 w-3.5 ${priorityColor.high} fill-current`} />
            )}
            {task.linkedTo && (
              <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider rounded bg-brand-50 text-brand-700 px-1.5 py-0.5">
                {task.linkedTo.label}
              </span>
            )}
          </div>
          {dueLabel && (
            <div
              className={`mt-0.5 flex items-center gap-1 text-[11px] ${
                overdue ? 'text-rose-600 font-semibold' : 'text-ink-500'
              }`}
            >
              <Calendar className="h-3 w-3" />
              {dueLabel}
              {showOwner && task.ownerName && (
                <span className="ml-2 text-ink-400">· {task.ownerName}</span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isDone && (
            <button
              onClick={() => startTimerFor(task.title)}
              className="p-1.5 rounded text-ink-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
              title="Start timer for this task"
            >
              <TimerIcon className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-1.5 rounded text-ink-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            title="Delete task"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Inline editor */}
      {expanded && (
        <div className="px-4 pb-3 ml-8 space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title !== task.title && onUpdate({ title })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            className="input text-sm"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== (task.notes || '') && onUpdate({ notes })}
            placeholder="Add notes..."
            rows={2}
            className="input text-sm"
          />
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="datetime-local"
              value={task.dueAt ? new Date(task.dueAt - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}
              onChange={(e) => {
                const v = e.target.value;
                if (v) onUpdate({ dueAt: new Date(v).getTime() });
                else onUpdate({ dueAt: undefined });
              }}
              className="input w-52 text-xs"
            />
            <select
              value={task.reminderMinutesBefore ?? 0}
              onChange={(e) => onUpdate({ reminderMinutesBefore: Number(e.target.value) })}
              className="input w-44 text-xs"
            >
              <option value="0">Remind at due time</option>
              <option value="5">5 min before</option>
              <option value="15">15 min before</option>
              <option value="60">1 hour before</option>
              <option value="1440">1 day before</option>
            </select>
            <select
              value={task.priority || 'normal'}
              onChange={(e) => onUpdate({ priority: e.target.value as TaskPriority })}
              className="input w-32 text-xs"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
            <button
              onClick={() => setExpanded(false)}
              className="btn-secondary px-2.5 py-1.5 text-xs ml-auto"
            >
              <X className="h-3 w-3" />
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  color
}: {
  label: string;
  value: number;
  color: 'rose' | 'amber' | 'indigo' | 'emerald';
}) {
  const colors = {
    rose: 'border-rose-200 bg-rose-50/50 text-rose-700',
    amber: 'border-amber-200 bg-amber-50/50 text-amber-700',
    indigo: 'border-indigo-200 bg-indigo-50/50 text-indigo-700',
    emerald: 'border-emerald-200 bg-emerald-50/50 text-emerald-700'
  };
  return (
    <div className={`rounded-lg border px-4 py-3 ${colors[color]}`}>
      <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</div>
      <div className="text-2xl font-extrabold mt-1">{value}</div>
    </div>
  );
}
