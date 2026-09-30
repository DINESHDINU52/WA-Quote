'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  deleteDoc,
  limit
} from 'firebase/firestore';
import { getDb } from '@/lib/firebase/client';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import {
  StickyNote as StickyIcon,
  Plus,
  X,
  Pin,
  Trash2,
  Clock,
  User,
  Search,
  Check,
  AlertCircle,
  Sparkles,
  Minimize2,
  ExternalLink,
  GripHorizontal,
  FoldVertical,
  Pencil
} from 'lucide-react';

export type StickyColor = 'yellow' | 'coral' | 'mint' | 'blue' | 'purple' | 'peach' | 'lemon';

export interface StickyNoteItem {
  id: string;
  title: string;
  content: string;
  category?: 'Stock' | 'Dispatch' | 'Urgent' | 'Follow-up' | 'General';
  color: StickyColor;
  pinned?: boolean;
  fontSize?: 'normal' | 'large';
  createdByName: string;
  createdByUid: string;
  createdAt: any;
  updatedByName: string;
  updatedByUid: string;
  updatedAt: any;
}

// Crisp synthetic water droplet sound via Web Audio API
function playWaterDrop(volume = 0.26) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Primary droplet oscillation (rising sweep & gentle ring)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(650, now);
    osc1.frequency.exponentialRampToValueAtTime(1480, now + 0.055);
    osc1.frequency.exponentialRampToValueAtTime(820, now + 0.19);

    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(volume, now + 0.012);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.23);

    // Harmonic droplet resonance
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1200, now);
    osc2.frequency.exponentialRampToValueAtTime(1850, now + 0.045);

    gain2.gain.setValueAtTime(0, now);
    gain2.gain.linearRampToValueAtTime(volume * 0.35, now + 0.01);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now);
    osc2.stop(now + 0.16);
  } catch {}
}

const COLOR_PALETTE: {
  id: StickyColor;
  name: string;
  cardBg: string;
  border: string;
  textColor: string;
  tapeColor: string;
  badgeBg: string;
}[] = [
  {
    id: 'yellow',
    name: 'Canary Yellow',
    cardBg: 'bg-[#fef9c3]',
    border: 'border-amber-300',
    textColor: 'text-amber-950',
    tapeColor: 'bg-amber-300/70',
    badgeBg: 'bg-amber-400'
  },
  {
    id: 'coral',
    name: 'Coral Pink',
    cardBg: 'bg-[#ffe4e6]',
    border: 'border-rose-300',
    textColor: 'text-rose-950',
    tapeColor: 'bg-rose-300/70',
    badgeBg: 'bg-rose-400'
  },
  {
    id: 'mint',
    name: 'Mint Green',
    cardBg: 'bg-[#dcfce7]',
    border: 'border-emerald-300',
    textColor: 'text-emerald-950',
    tapeColor: 'bg-emerald-300/70',
    badgeBg: 'bg-emerald-400'
  },
  {
    id: 'blue',
    name: 'Sky Blue',
    cardBg: 'bg-[#e0f2fe]',
    border: 'border-sky-300',
    textColor: 'text-sky-950',
    tapeColor: 'bg-sky-300/70',
    badgeBg: 'bg-sky-400'
  },
  {
    id: 'purple',
    name: 'Lavender',
    cardBg: 'bg-[#f3e8ff]',
    border: 'border-purple-300',
    textColor: 'text-purple-950',
    tapeColor: 'bg-purple-300/70',
    badgeBg: 'bg-purple-400'
  },
  {
    id: 'peach',
    name: 'Peach Orange',
    cardBg: 'bg-[#ffedd5]',
    border: 'border-orange-300',
    textColor: 'text-orange-950',
    tapeColor: 'bg-orange-300/70',
    badgeBg: 'bg-orange-400'
  },
  {
    id: 'lemon',
    name: 'Lime Lemon',
    cardBg: 'bg-[#ecfccb]',
    border: 'border-lime-300',
    textColor: 'text-lime-950',
    tapeColor: 'bg-lime-300/70',
    badgeBg: 'bg-lime-400'
  }
];

const CATEGORIES: ('Stock' | 'Dispatch' | 'Urgent' | 'Follow-up' | 'General')[] = [
  'Stock',
  'Dispatch',
  'Urgent',
  'Follow-up',
  'General'
];

const MAX_NOTES = 10;

const POSITION_KEY = 'chn-sticky-notes-pos';
const STUCK_NOTES_KEY = 'chn-stuck-notes-map';
const DRAFT_KEY = 'chn-sticky-note-draft';

interface Position {
  x: number;
  y: number;
}

interface DraftNote {
  id?: string | null;
  title: string;
  content: string;
  color: StickyColor;
  category: 'Stock' | 'Dispatch' | 'Urgent' | 'Follow-up' | 'General';
  pinned: boolean;
  timestamp: number;
}

function loadSavedPosition(): Position {
  if (typeof window === 'undefined') return { x: 276, y: 14 };
  try {
    const raw = localStorage.getItem(POSITION_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (typeof p.x === 'number' && typeof p.y === 'number') {
        return {
          x: Math.min(Math.max(10, p.x), window.innerWidth - 160),
          y: Math.min(Math.max(10, p.y), window.innerHeight - 50)
        };
      }
    }
  } catch {}
  return { x: 276, y: 14 };
}

function loadSavedStuckNotes(): Record<string, Position> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STUCK_NOTES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveStuckNotesToStorage(map: Record<string, Position>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STUCK_NOTES_KEY, JSON.stringify(map));
  } catch {}
}

export function FloatingStickyNotes() {
  const { profile } = useAuth();
  const [notes, setNotes] = useState<StickyNoteItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingNote, setEditingNote] = useState<StickyNoteItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Standalone stuck notes placed directly on screen
  const [stuckNotes, setStuckNotes] = useState<Record<string, Position>>({});

  // Draggable capsule position state
  const [pos, setPos] = useState<Position>({ x: 276, y: 14 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number; moved: boolean } | null>(null);
  const capsuleRef = useRef<HTMLDivElement>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formColor, setFormColor] = useState<StickyColor>('yellow');
  const [formCategory, setFormCategory] = useState<'Stock' | 'Dispatch' | 'Urgent' | 'Follow-up' | 'General'>('Stock');
  const [formPinned, setFormPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'saved' | 'syncing' | 'synced' | null>(null);

  // Track if current draft has unsaved changes that need to be pushed to Firebase on close
  const isDirtyRef = useRef(false);

  // Load saved positions and draft on mount
  useEffect(() => {
    setPos(loadSavedPosition());
    setStuckNotes(loadSavedStuckNotes());

    // Restore unfinished draft if available
    try {
      const savedDraft = localStorage.getItem(DRAFT_KEY);
      if (savedDraft) {
        const d: DraftNote = JSON.parse(savedDraft);
        if (d && (d.title || d.content)) {
          setFormTitle(d.title || '');
          setFormContent(d.content || '');
          setFormColor(d.color || 'yellow');
          setFormCategory(d.category || 'Stock');
          setFormPinned(!!d.pinned);
          isDirtyRef.current = true;
          setAutoSaveStatus('saved');
        }
      }
    } catch {}
  }, []);

  // Save changes locally to localStorage on every keystroke
  function updateDraft(field: Partial<DraftNote>) {
    isDirtyRef.current = true;
    setAutoSaveStatus('saved');

    const updated: DraftNote = {
      id: editingNote?.id || null,
      title: field.title !== undefined ? field.title : formTitle,
      content: field.content !== undefined ? field.content : formContent,
      color: field.color !== undefined ? field.color : formColor,
      category: field.category !== undefined ? field.category : formCategory,
      pinned: field.pinned !== undefined ? field.pinned : formPinned,
      timestamp: Date.now()
    };

    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(updated));
    } catch {}
  }

  // Push draft to Firebase (called when closing box or finishing edit)
  async function pushDraftToFirebase() {
    if (!isDirtyRef.current) return;
    const titleToSave = formTitle.trim();
    const contentToSave = formContent.trim();

    if (!titleToSave && !contentToSave) {
      // Empty note, discard draft
      isDirtyRef.current = false;
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
      return;
    }

    setAutoSaveStatus('syncing');
    const currentUserName = profile?.displayName || profile?.email || 'Staff';
    const currentUserUid = profile?.uid || 'user';

    try {
      if (editingNote) {
        // Update existing note
        await setDoc(
          doc(getDb(), 'sticky_notes', editingNote.id),
          {
            title: titleToSave || 'Untitled Note',
            content: contentToSave,
            color: formColor,
            category: formCategory,
            pinned: formPinned,
            updatedByName: currentUserName,
            updatedByUid: currentUserUid,
            updatedAt: serverTimestamp()
          },
          { merge: true }
        );
      } else {
        // Create new note
        const ref = doc(collection(getDb(), 'sticky_notes'));
        await setDoc(ref, {
          title: titleToSave || 'Stock Note',
          content: contentToSave,
          color: formColor,
          category: formCategory,
          pinned: formPinned,
          createdByName: currentUserName,
          createdByUid: currentUserUid,
          createdAt: serverTimestamp(),
          updatedByName: currentUserName,
          updatedByUid: currentUserUid,
          updatedAt: serverTimestamp()
        });
      }

      isDirtyRef.current = false;
      setAutoSaveStatus('synced');
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
    } catch (err) {
      console.error('[sticky_notes] Push to Firebase error:', err);
    }
  }

  function toggleStickOnPage(noteId: string) {
    setStuckNotes((prev) => {
      const next = { ...prev };
      if (next[noteId]) {
        delete next[noteId];
        playWaterDrop(0.16);
      } else {
        const offsetIndex = Object.keys(next).length % 6;
        next[noteId] = {
          x: Math.min(window.innerWidth - 260, 320 + offsetIndex * 35),
          y: Math.min(window.innerHeight - 240, 100 + offsetIndex * 40)
        };
        playWaterDrop(0.24);
      }
      saveStuckNotesToStorage(next);
      return next;
    });
  }

  function updateStuckNotePos(noteId: string, newPos: Position) {
    setStuckNotes((prev) => {
      const next = { ...prev, [noteId]: newPos };
      saveStuckNotesToStorage(next);
      return next;
    });
  }

  function unstickNote(noteId: string) {
    playWaterDrop(0.16);
    setStuckNotes((prev) => {
      const next = { ...prev };
      delete next[noteId];
      saveStuckNotesToStorage(next);
      return next;
    });
  }

  // Window resize bounds adjustment
  useEffect(() => {
    function handleResize() {
      setPos((current) => ({
        x: Math.min(Math.max(10, current.x), window.innerWidth - 180),
        y: Math.min(Math.max(10, current.y), window.innerHeight - 60)
      }));
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Real-time Firestore sync
  useEffect(() => {
    const q = query(
      collection(getDb(), 'sticky_notes'),
      orderBy('updatedAt', 'desc'),
      limit(MAX_NOTES)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const fetched = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<StickyNoteItem, 'id'>)
        }));
        setNotes(fetched);
      },
      (err) => {
        console.error('[sticky_notes] sync error:', err);
      }
    );
    return () => unsub();
  }, []);

  // Pointer drag handlers
  function handlePointerDown(e: React.PointerEvent) {
    if (isOpen) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: pos.x,
      baseY: pos.y,
      moved: false
    };
    setIsDragging(true);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;

    if (Math.hypot(dx, dy) > 4) {
      dragRef.current.moved = true;
    }

    const nextX = Math.min(Math.max(10, dragRef.current.baseX + dx), window.innerWidth - 180);
    const nextY = Math.min(Math.max(10, dragRef.current.baseY + dy), window.innerHeight - 60);

    setPos({ x: nextX, y: nextY });
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (dragRef.current) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}

      if (!dragRef.current.moved) {
        toggleOpen();
      } else {
        try {
          localStorage.setItem(POSITION_KEY, JSON.stringify(pos));
        } catch {}
      }
    }
    dragRef.current = null;
    setIsDragging(false);
  }

  // Filtered notes (pinned first)
  const filteredNotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = notes.filter((n) => {
      if (selectedCategory !== 'all' && n.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        (n.category || '').toLowerCase().includes(q) ||
        (n.updatedByName || '').toLowerCase().includes(q)
      );
    });

    return list.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return 0;
    });
  }, [notes, search, selectedCategory]);

  function toggleOpen() {
    playWaterDrop();
    if (isOpen) {
      // Closing box -> push draft to Firebase automatically!
      if (isCreating && isDirtyRef.current) {
        pushDraftToFirebase();
      }
      setIsOpen(false);
    } else {
      setIsOpen(true);
    }
  }

  function handleCloseBox() {
    playWaterDrop(0.18);
    // Push any active changes to Firebase when user closes/minimizes
    if (isCreating && isDirtyRef.current) {
      pushDraftToFirebase();
    }
    setIsOpen(false);
  }

  function startCreate() {
    if (notes.length >= MAX_NOTES) return;
    playWaterDrop(0.18);
    // If previous was dirty, push it first
    if (isCreating && isDirtyRef.current) {
      pushDraftToFirebase();
    }
    setEditingNote(null);
    setFormTitle('');
    setFormContent('');
    const nextColor = COLOR_PALETTE[notes.length % COLOR_PALETTE.length].id;
    setFormColor(nextColor);
    setFormCategory('Stock');
    setFormPinned(false);
    isDirtyRef.current = false;
    setAutoSaveStatus(null);
    setIsCreating(true);
  }

  function startEdit(n: StickyNoteItem) {
    playWaterDrop(0.18);
    // If previous was dirty, push it first
    if (isCreating && isDirtyRef.current) {
      pushDraftToFirebase();
    }
    setEditingNote(n);
    setFormTitle(n.title);
    setFormContent(n.content);
    setFormColor(n.color);
    setFormCategory(n.category || 'Stock');
    setFormPinned(!!n.pinned);
    isDirtyRef.current = false;
    setAutoSaveStatus(null);
    setIsCreating(true);
  }

  async function handleSave(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!formTitle.trim() && !formContent.trim()) return;

    setSaving(true);
    await pushDraftToFirebase();
    setSaving(false);
    playWaterDrop(0.24);
    setIsCreating(false);
    setEditingNote(null);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this shared sticky note?')) return;
    try {
      playWaterDrop(0.15);
      await deleteDoc(doc(getDb(), 'sticky_notes', id));
      if (editingNote?.id === id) {
        setIsCreating(false);
        setEditingNote(null);
        isDirtyRef.current = false;
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch {}
      }
      unstickNote(id);
    } catch (err) {
      console.error('[sticky_notes] Delete error:', err);
    }
  }

  async function togglePin(n: StickyNoteItem, e: React.MouseEvent) {
    e.stopPropagation();
    playWaterDrop(0.18);
    try {
      await setDoc(
        doc(getDb(), 'sticky_notes', n.id),
        { pinned: !n.pinned, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (err) {
      console.error('[sticky_notes] Pin error:', err);
    }
  }

  function formatTimeAgo(val: any): string {
    if (!val) return 'just now';
    const d = typeof val?.toDate === 'function' ? val.toDate() : new Date(val);
    if (isNaN(d.getTime())) return 'recently';
    const diffMin = Math.round((Date.now() - d.getTime()) / 60000);
    if (diffMin < 1) return 'now';
    if (diffMin < 60) return `${diffMin}m`;
    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h`;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  }

  return (
    <>
      {/* App Theme-Matching Capsule (Draggable anywhere across the screen) */}
      <div
        ref={capsuleRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          left: `${pos.x}px`,
          top: `${pos.y}px`,
          touchAction: 'none'
        }}
        className={cn(
          'fixed z-40 select-none transition-transform duration-75',
          isDragging ? 'cursor-grabbing scale-105 opacity-90' : 'cursor-grab'
        )}
      >
        <button
          type="button"
          className={cn(
            'group relative flex items-center gap-2.5 rounded-full px-3.5 py-1.5 shadow-xl backdrop-blur-xl border transition-all duration-200 select-none cursor-grab active:cursor-grabbing',
            isOpen
              ? 'bg-gradient-to-r from-brand-700 via-brand-800 to-brand-900 border-white/35 text-white shadow-brand-600/35 ring-2 ring-brand-400/40 scale-102'
              : 'bg-gradient-to-r from-brand-600 via-brand-500 to-brand-700 border-white/30 text-white shadow-brand-500/30 hover:shadow-brand-500/45 hover:scale-105 active:scale-95'
          )}
          title="Drag anywhere on page · Click to open (Water drop sound)"
        >
          {/* Status Glow Pill Icon */}
          <div className="relative flex items-center justify-center h-6 w-6 rounded-full bg-white/20 border border-white/30 shadow-inner group-hover:rotate-6 transition-transform">
            <StickyIcon className="h-3.5 w-3.5 text-white drop-shadow-xs" />
            {notes.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-400 ring-2 ring-brand-600 animate-pulse" />
            )}
          </div>

          <div className="flex items-center gap-1.5 pointer-events-none">
            <span className="text-xs font-bold tracking-tight text-white drop-shadow-xs">
              Stock Notes
            </span>
            <span className="rounded-full bg-white/25 px-2 py-0.2 text-[10px] font-extrabold text-brand-50 border border-white/20">
              {notes.length}/{MAX_NOTES}
            </span>
          </div>

          <Sparkles className="h-3 w-3 text-brand-200 opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-all pointer-events-none" />
        </button>
      </div>

      {/* Theme-Matching Popover Panel */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/25 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={handleCloseBox}
        >
          <div
            className="w-full max-w-xl max-h-[86vh] bg-white/95 backdrop-blur-2xl border border-brand-200/80 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: Theme Gradient Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-brand-600/95 via-brand-700/95 to-brand-800/95 text-white flex items-center justify-between border-b border-white/20 shadow-xs">
              <div className="flex items-center gap-2.5">
                <div className="grid h-8 w-8 place-items-center rounded-xl bg-white/20 border border-white/30 backdrop-blur-md shadow-inner">
                  <StickyIcon className="h-4 w-4 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold tracking-tight text-white drop-shadow-xs">
                      Shared Stock & Team Notes
                    </h3>
                    <span className="rounded-full bg-white/25 px-2 py-0.2 text-[10px] font-bold text-white border border-white/20">
                      {notes.length}/{MAX_NOTES} max
                    </span>
                  </div>
                  <p className="text-[10px] text-brand-100/90 font-medium">
                    Auto-saved locally · Synced to cloud on close
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={startCreate}
                  disabled={notes.length >= MAX_NOTES}
                  className={cn(
                    'flex items-center gap-1 rounded-full bg-white text-brand-700 hover:bg-brand-50 px-3 py-1 text-xs font-bold shadow-sm transition-transform active:scale-95 cursor-pointer',
                    notes.length >= MAX_NOTES && 'opacity-50 cursor-not-allowed bg-white/50 text-white'
                  )}
                  title={notes.length >= MAX_NOTES ? 'Max 10 notes reached' : 'Create a new sticky note'}
                >
                  <Plus className="h-3.5 w-3.5 stroke-[3]" />
                  <span>New</span>
                </button>
                <button
                  onClick={handleCloseBox}
                  className="grid h-7 w-7 place-items-center rounded-full bg-white/15 hover:bg-white/30 text-white transition-colors cursor-pointer"
                  title="Minimize & Save to Firebase (Water Drop)"
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="px-3.5 py-2 bg-brand-50/50 border-b border-brand-100 flex items-center justify-between gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-brand-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search stock, urgent, author..."
                  className="w-full rounded-full border border-brand-200/80 bg-white/90 pl-7 pr-6 py-1 text-xs text-ink-900 focus:border-brand-500 focus:outline-none placeholder:text-brand-300"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-400 hover:text-brand-700"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Compact Category Pills */}
              <div className="flex items-center gap-1 overflow-x-auto text-[10px]">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={cn(
                    'rounded-full px-2 py-0.5 font-bold transition-all cursor-pointer',
                    selectedCategory === 'all'
                      ? 'bg-brand-600 text-white shadow-xs'
                      : 'bg-white text-brand-800 border border-brand-200 hover:bg-brand-100/60'
                  )}
                >
                  All
                </button>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      'rounded-full px-2 py-0.5 font-semibold transition-all whitespace-nowrap cursor-pointer',
                      selectedCategory === cat
                        ? 'bg-brand-600 text-white shadow-xs'
                        : 'bg-white text-brand-800 border border-brand-200 hover:bg-brand-100/60'
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Note Editor Card when Creating / Editing */}
            {isCreating && (
              <div className="p-3.5 bg-white border-b border-brand-200 animate-in slide-in-from-top-2 duration-150 shadow-md">
                <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-ink-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-brand-900">
                      {editingNote ? 'Edit Sticky Note' : 'New Sticky Note'}
                    </span>
                    {/* Auto-save Status Indicator */}
                    {autoSaveStatus === 'saved' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.2 text-[9px] font-semibold">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Saved locally
                      </span>
                    )}
                    {autoSaveStatus === 'syncing' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.2 text-[9px] font-semibold">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Syncing to cloud...
                      </span>
                    )}
                    {autoSaveStatus === 'synced' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.2 text-[9px] font-semibold">
                        <Check className="h-2.5 w-2.5" />
                        Synced to cloud
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      playWaterDrop(0.18);
                      // On close, push any unsaved changes to Firebase!
                      pushDraftToFirebase();
                      setIsCreating(false);
                      setEditingNote(null);
                    }}
                    className="text-ink-400 hover:text-ink-700 cursor-pointer"
                    title="Done / Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form onSubmit={handleSave} className="space-y-2.5">
                  <input
                    type="text"
                    value={formTitle}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFormTitle(v);
                      updateDraft({ title: v });
                    }}
                    placeholder="Note Title (e.g. AI Mercury Stock, Cable Tray arrival...)"
                    className="w-full rounded-lg border border-ink-200 px-3 py-1.5 text-xs font-bold text-ink-900 focus:border-brand-500 focus:outline-none"
                    autoFocus
                  />
                  <textarea
                    value={formContent}
                    onChange={(e) => {
                      const v = e.target.value;
                      setFormContent(v);
                      updateDraft({ content: v });
                    }}
                    placeholder="Write details in handwritten notes style..."
                    rows={3}
                    className="w-full rounded-lg border border-ink-200 p-2.5 font-handwriting text-lg text-ink-900 leading-snug focus:border-brand-500 focus:outline-none bg-amber-50/20"
                  />

                  {/* Enhanced, Large Tactile Color Swatches */}
                  <div className="pt-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-semibold text-ink-700">Choose Note Paper Color:</span>
                      <span className="text-[10px] text-ink-400 font-medium">
                        {COLOR_PALETTE.find((c) => c.id === formColor)?.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto py-1">
                      {COLOR_PALETTE.map((c) => {
                        const isSelected = formColor === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setFormColor(c.id);
                              updateDraft({ color: c.id });
                              playWaterDrop(0.12);
                            }}
                            className={cn(
                              'relative h-8 w-8 sm:h-9 sm:w-9 rounded-xl border border-black/15 shadow-sm transition-all duration-200 flex items-center justify-center cursor-pointer',
                              c.badgeBg,
                              isSelected
                                ? 'scale-115 ring-2 ring-brand-600 ring-offset-2 shadow-md z-10'
                                : 'hover:scale-105 hover:shadow-md opacity-85 hover:opacity-100'
                            )}
                            title={c.name}
                          >
                            {isSelected && (
                              <Check className="h-4 w-4 text-ink-950 stroke-[3] drop-shadow-xs" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-ink-100">
                    {/* Tag Selector */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-ink-600 font-medium">Tag:</span>
                      <select
                        value={formCategory}
                        onChange={(e: any) => {
                          const v = e.target.value;
                          setFormCategory(v);
                          updateDraft({ category: v });
                        }}
                        className="rounded-md border border-ink-200 bg-white px-2 py-0.5 text-[11px] text-ink-800 font-medium focus:border-brand-500 focus:outline-none"
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Pin Checkbox */}
                    <label className="flex items-center gap-1 text-[11px] text-ink-700 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formPinned}
                        onChange={(e) => {
                          const v = e.target.checked;
                          setFormPinned(v);
                          updateDraft({ pinned: v });
                        }}
                        className="rounded border-ink-300 text-brand-600 focus:ring-brand-500"
                      />
                      <Pin className="h-3 w-3 text-amber-600" />
                      <span>Pin to top</span>
                    </label>

                    <div className="flex gap-1.5 ml-auto">
                      <button
                        type="button"
                        onClick={() => {
                          pushDraftToFirebase();
                          setIsCreating(false);
                          setEditingNote(null);
                        }}
                        className="rounded-full border border-ink-200 px-3 py-1 text-xs text-ink-600 hover:bg-ink-50 cursor-pointer"
                      >
                        Close & Save
                      </button>
                      <button
                        type="submit"
                        disabled={saving || (!formTitle.trim() && !formContent.trim())}
                        className="rounded-full bg-brand-600 text-white px-3.5 py-1 text-xs font-bold hover:bg-brand-700 shadow-xs cursor-pointer"
                      >
                        {saving ? 'Syncing...' : 'Sync Cloud'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}

            {/* Notes List (Compact Sticky Note Cards Grid) */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
              {notes.length >= MAX_NOTES && !isCreating && (
                <div className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-900 font-medium">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                  <span>Maximum 10 notes reached. Update or delete an existing note to add new items.</span>
                </div>
              )}

              {filteredNotes.length === 0 && !isCreating && (
                <div className="p-8 text-center text-ink-400">
                  <StickyIcon className="h-8 w-8 mx-auto text-brand-300 mb-1.5" />
                  <p className="text-xs font-semibold text-ink-700">No notes yet</p>
                  <p className="text-[11px] text-ink-500">
                    Click <strong>&quot;+ New&quot;</strong> above to create a stock note for the team!
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5 max-sm:grid-cols-1">
                {filteredNotes.map((note) => {
                  const palette = COLOR_PALETTE.find((c) => c.id === note.color) || COLOR_PALETTE[0];
                  return (
                    <div
                      key={note.id}
                      onClick={() => startEdit(note)}
                      className={cn(
                        'relative group rounded-2xl p-3 border shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[135px]',
                        palette.cardBg,
                        palette.border,
                        palette.textColor,
                        'hover:-translate-y-0.5'
                      )}
                    >
                      {/* Top Tape Sticker */}
                      <div
                        className={cn(
                          'absolute -top-1.5 left-1/2 -translate-x-1/2 h-2.5 w-14 rounded-xs shadow-2xs backdrop-blur-xs',
                          palette.tapeColor
                        )}
                      />

                      {/* Header */}
                      <div className="flex items-start justify-between gap-1.5 mb-1">
                        <div className="flex items-center gap-1 flex-wrap">
                          {stuckNotes[note.id] && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-brand-500/15 text-brand-900 px-1.5 py-0.2 text-[9px] font-bold border border-brand-300">
                              <ExternalLink className="h-2 w-2" /> On page
                            </span>
                          )}
                          {note.pinned && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-400/80 px-1.5 py-0.2 text-[9px] font-bold text-amber-950">
                              <Pin className="h-2 w-2 fill-current" />
                            </span>
                          )}
                          {note.category && (
                            <span className="rounded-full bg-black/5 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider">
                              {note.category}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* Stick / Pop out onto webpage */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleStickOnPage(note.id);
                            }}
                            className={cn(
                              'rounded p-0.5 transition-colors',
                              stuckNotes[note.id]
                                ? 'text-brand-700 bg-brand-100 font-bold'
                                : 'text-black/40 hover:text-black/80 hover:bg-black/5'
                            )}
                            title={stuckNotes[note.id] ? 'Dock back into box' : 'Stick on page (Draggable follow-up)'}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => togglePin(note, e)}
                            className="rounded p-0.5 text-black/40 hover:text-black/80 hover:bg-black/5"
                            title={note.pinned ? 'Unpin' : 'Pin to top'}
                          >
                            <Pin className={cn('h-3 w-3', note.pinned && 'fill-current text-amber-700')} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(note.id);
                            }}
                            className="rounded p-0.5 text-red-500 hover:text-red-700 hover:bg-red-50"
                            title="Delete note"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>

                      {/* Title & Handwritten Content */}
                      <div className="flex-1">
                        {note.title && (
                          <h4 className="font-bold text-xs leading-snug tracking-tight mb-0.5 line-clamp-1">
                            {note.title}
                          </h4>
                        )}
                        <p className="font-handwriting text-lg leading-tight whitespace-pre-wrap line-clamp-4">
                          {note.content}
                        </p>
                      </div>

                      {/* Footer: User & Time */}
                      <div className="mt-2 pt-1 border-t border-black/10 flex items-center justify-between text-[9px] text-black/50">
                        <span className="truncate max-w-[100px] font-medium">
                          {note.updatedByName || note.createdByName || 'Staff'}
                        </span>
                        <div className="flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          <span>{formatTimeAgo(note.updatedAt || note.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer Bar */}
            <div className="px-3.5 py-2 bg-brand-50/60 border-t border-brand-100 flex items-center justify-between text-[11px] text-brand-900/70">
              <span className="flex items-center gap-1 font-medium">
                <Sparkles className="h-3 w-3 text-brand-500" />
                Live team stock memos · Max 10
              </span>
              <button
                onClick={handleCloseBox}
                className="font-bold text-brand-700 hover:underline cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Standalone Draggable Sticky Notes Stuck Directly on Webpage */}
      {Object.entries(stuckNotes).map(([noteId, initPos]) => {
        const note = notes.find((n) => n.id === noteId);
        if (!note) return null;
        return (
          <StandaloneDraggableNote
            key={note.id}
            note={note}
            initPos={initPos}
            onUpdatePos={(newPos) => updateStuckNotePos(note.id, newPos)}
            onDockBack={() => unstickNote(note.id)}
            onEdit={() => {
              setIsOpen(true);
              startEdit(note);
            }}
            onDelete={() => handleDelete(note.id)}
          />
        );
      })}
    </>
  );
}

// Standalone real sticky note draggable anywhere across the screen
function StandaloneDraggableNote({
  note,
  initPos,
  onUpdatePos,
  onDockBack,
  onEdit,
  onDelete
}: {
  note: StickyNoteItem;
  initPos: Position;
  onUpdatePos: (pos: Position) => void;
  onDockBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [pos, setPos] = useState<Position>(initPos);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number; moved: boolean } | null>(null);
  const palette = COLOR_PALETTE.find((c) => c.id === note.color) || COLOR_PALETTE[0];

  function handlePointerDown(e: React.PointerEvent) {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: pos.x,
      baseY: pos.y,
      moved: false
    };
    setIsDragging(true);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;

    if (Math.hypot(dx, dy) > 4) {
      dragRef.current.moved = true;
    }

    const nextX = Math.min(Math.max(10, dragRef.current.baseX + dx), window.innerWidth - 250);
    const nextY = Math.min(Math.max(10, dragRef.current.baseY + dy), window.innerHeight - 180);

    setPos({ x: nextX, y: nextY });
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (dragRef.current) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}

      if (dragRef.current.moved) {
        onUpdatePos(pos);
      }
    }
    dragRef.current = null;
    setIsDragging(false);
  }

  return (
    <div
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        touchAction: 'none'
      }}
      className={cn(
        'fixed z-40 w-60 rounded-2xl p-3 border shadow-xl backdrop-blur-xs select-none transition-transform duration-75 animate-in zoom-in-95',
        palette.cardBg,
        palette.border,
        palette.textColor,
        isDragging ? 'cursor-grabbing scale-105 shadow-2xl opacity-95 rotate-1' : 'hover:-translate-y-0.5'
      )}
    >
      {/* Top Tape Drag Handle */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={cn(
          'absolute -top-2 left-1/2 -translate-x-1/2 h-4 w-20 rounded-xs shadow-2xs backdrop-blur-xs cursor-grab active:cursor-grabbing flex items-center justify-center',
          palette.tapeColor
        )}
        title="Drag note anywhere on screen"
      >
        <GripHorizontal className="h-3 w-3 text-black/40" />
      </div>

      {/* Header with Title & Action Icons */}
      <div className="flex items-start justify-between gap-1.5 mt-0.5 mb-1.5">
        <div className="flex items-center gap-1 flex-wrap">
          {note.category && (
            <span className="rounded-full bg-black/5 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider">
              {note.category}
            </span>
          )}
          {note.pinned && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-400/80 px-1.5 py-0.2 text-[9px] font-bold text-amber-950">
              <Pin className="h-2 w-2 fill-current" />
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Edit */}
          <button
            type="button"
            onClick={onEdit}
            className="rounded p-0.5 text-black/45 hover:text-black/80 hover:bg-black/5 cursor-pointer"
            title="Edit note"
          >
            <Pencil className="h-3 w-3" />
          </button>
          {/* Dock back into box */}
          <button
            type="button"
            onClick={onDockBack}
            className="rounded p-0.5 text-brand-700 hover:text-brand-900 hover:bg-black/5 cursor-pointer"
            title="Dock back into notes box"
          >
            <FoldVertical className="h-3 w-3" />
          </button>
          {/* Delete */}
          <button
            type="button"
            onClick={onDelete}
            className="rounded p-0.5 text-red-500 hover:text-red-700 hover:bg-red-50 cursor-pointer"
            title="Delete note"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Note Content */}
      <div className="mb-2">
        {note.title && (
          <h4 className="font-bold text-xs leading-snug tracking-tight mb-0.5">
            {note.title}
          </h4>
        )}
        <p className="font-handwriting text-lg leading-snug whitespace-pre-wrap">
          {note.content}
        </p>
      </div>

      {/* Footer with author & time */}
      <div className="pt-1.5 border-t border-black/10 flex items-center justify-between text-[9px] text-black/50">
        <span className="truncate max-w-[110px] font-medium">
          {note.updatedByName || note.createdByName || 'Staff'}
        </span>
        <span className="text-[9px] text-black/40">Draggable</span>
      </div>
    </div>
  );
}
