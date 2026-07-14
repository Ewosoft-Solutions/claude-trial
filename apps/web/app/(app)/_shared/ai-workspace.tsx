'use client';

/* ============================================================
   AiWorkspaceLauncher

   One shell-level AI entry point:
   - fixed FAB
   - full-screen in-app workspace
   - no URL/query state
   - modes derived from the viewer's permissions

   The tutor and analytics assistants keep separate transports and state.
   ============================================================ */

import * as React from 'react';
import useSWR from 'swr';
import {
  AlertTriangle,
  BookOpenCheck,
  Bot,
  CheckCircle2,
  History,
  MessageCirclePlus,
  ShieldAlert,
  Sparkles,
  X,
  XCircle,
} from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { Label } from '@workspace/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import { ChatComposer } from '@workspace/ui/custom/chat/chat-composer';
import { ChatMessageBubble } from '@workspace/ui/custom/chat/chat-message';
import { ChatThread } from '@workspace/ui/custom/chat/chat-thread';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { ListDetailLayout } from '@workspace/ui/custom/layouts/list-detail-layout';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { NoticeBanner } from '@workspace/ui/custom/states/notice-banner';
import { cn } from '@workspace/ui/lib/utils';
import type { ChatChartSpec, ChatSender } from '@workspace/ui/types/chat.types';
import type { StateTone } from '@workspace/ui/types/states.types';

import { useViewer } from '@/app/providers/viewer-provider';
import type { LessonSummary } from '@/lib/academics';
import { readSseStream } from '@/lib/sse';

type AiMode = 'assistant' | 'tutor' | 'integrity';

interface ModeMeta {
  key: AiMode;
  label: string;
  description: string;
  accent: string;
}

const MODE_META: Record<AiMode, ModeMeta> = {
  assistant: {
    key: 'assistant',
    label: 'Assistant',
    description: 'Role-scoped school data',
    accent: '#7c3aed',
  },
  tutor: {
    key: 'tutor',
    label: 'Study tutor',
    description: 'Lesson-grounded learning',
    accent: '#4f6df5',
  },
  integrity: {
    key: 'integrity',
    label: 'Integrity monitor',
    description: 'Assessment oversight',
    accent: '#d6452f',
  },
};

function ModeIcon({ mode, className }: { mode: AiMode; className?: string }) {
  if (mode === 'tutor') return <BookOpenCheck className={className} />;
  if (mode === 'integrity') return <ShieldAlert className={className} />;
  return <Sparkles className={className} />;
}

function modeStyle(mode: AiMode): React.CSSProperties {
  return {
    '--ai-accent': MODE_META[mode].accent,
  } as React.CSSProperties;
}

async function fetchJson<T>(url: string, fallback: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    let detail = fallback;
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      detail = body.error ?? body.message ?? detail;
    } catch {
      // keep fallback
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

let nextLocalId = 0;
function localId(): string {
  nextLocalId += 1;
  return `ai-local-${nextLocalId}`;
}

function formatDay(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

function hasAnyPermission(
  permissions: ReadonlySet<string>,
  keys: readonly string[],
): boolean {
  return keys.some((key) => permissions.has(key));
}

/* ============================================================
   Launcher
   ============================================================ */

export function AiWorkspaceLauncher() {
  const { viewer } = useViewer();
  const [open, setOpen] = React.useState(false);
  const [activeMode, setActiveMode] = React.useState<AiMode>('assistant');

  const modes = React.useMemo(() => {
    const allowed: ModeMeta[] = [];
    if (viewer.permissions.has('ai.analytics.query')) {
      allowed.push(MODE_META.assistant);
    }
    if (viewer.permissions.has('ai.chat.use')) {
      allowed.push(MODE_META.tutor);
    }
    if (
      viewer.permissions.has('ai.integrity.monitor') &&
      hasAnyPermission(viewer.permissions, [
        'assessments.view',
        'assessments.create',
        'grades.view',
        'lessons.view',
        'lessons.approve',
      ])
    ) {
      allowed.push(MODE_META.integrity);
    }
    return allowed;
  }, [viewer.permissions]);

  React.useEffect(() => {
    if (modes.length === 0) return;
    if (!modes.some((mode) => mode.key === activeMode)) {
      setActiveMode(modes[0]!.key);
    }
  }, [activeMode, modes]);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (modes.length === 0) return null;

  const active = modes.find((mode) => mode.key === activeMode) ?? modes[0]!;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'fixed bottom-[calc(var(--shell-mobile-bottom-inset,0rem)+1rem)] right-4 z-40 inline-flex h-14 items-center gap-2 rounded-full border border-primary/25 bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-[3px] focus-visible:ring-ring/50 md:bottom-5 md:right-5',
        )}
        aria-label="Open AI assistant"
      >
        <span className="grid size-8 place-items-center rounded-full bg-white/20">
          <Bot className="size-4" aria-hidden />
        </span>
        <span>AI</span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="AI workspace"
          className="fixed inset-0 z-50 flex bg-background text-foreground"
        >
          <div className="flex min-h-0 w-full flex-col">
            <header className="flex min-h-16 items-center gap-3 border-b border-border bg-card px-4 md:px-5">
              <span
                className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-sm)] text-white"
                style={{ background: active.accent }}
              >
                <ModeIcon mode={active.key} className="size-5" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-base font-bold md:text-lg">
                  AI workspace
                </h1>
                <p className="truncate text-xs text-muted-foreground md:text-sm">
                  {active.label} - {active.description}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="ml-auto"
                onClick={() => setOpen(false)}
                aria-label="Close AI workspace"
              >
                <X />
              </Button>
            </header>

            <div className="flex min-h-0 flex-1 flex-col md:flex-row">
              <aside className="hidden w-64 shrink-0 border-r border-border bg-sidebar p-3 md:block">
                <nav aria-label="AI modes" className="flex flex-col gap-1">
                  {modes.map((mode) => (
                    <ModeButton
                      key={mode.key}
                      mode={mode}
                      active={mode.key === activeMode}
                      onClick={() => setActiveMode(mode.key)}
                    />
                  ))}
                </nav>
              </aside>

              <div className="border-b border-border bg-sidebar p-2 md:hidden">
                <div className="flex gap-1 overflow-x-auto">
                  {modes.map((mode) => (
                    <ModeButton
                      key={mode.key}
                      mode={mode}
                      active={mode.key === activeMode}
                      onClick={() => setActiveMode(mode.key)}
                      compact
                    />
                  ))}
                </div>
              </div>

              <main
                className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background p-3 md:p-4"
                style={modeStyle(active.key)}
              >
                {activeMode === 'assistant' ? (
                  <AssistantPane active={open && activeMode === 'assistant'} />
                ) : null}
                {activeMode === 'tutor' ? (
                  <TutorPane active={open && activeMode === 'tutor'} />
                ) : null}
                {activeMode === 'integrity' ? <IntegrityMonitorPane /> : null}
              </main>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ModeButton({
  mode,
  active,
  compact = false,
  onClick,
}: {
  mode: ModeMeta;
  active: boolean;
  compact?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-w-0 items-center gap-2 rounded-[var(--radius-sm)] border px-2.5 py-2 text-left outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50',
        active
          ? 'border-[var(--ai-accent)] bg-[color-mix(in_oklab,var(--ai-accent)_13%,transparent)] text-foreground'
          : 'border-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
        compact && 'min-w-36 shrink-0',
      )}
      style={modeStyle(mode.key)}
      aria-pressed={active}
    >
      <span
        className={cn(
          'grid size-8 shrink-0 place-items-center rounded-[var(--radius-sm)]',
          active ? 'text-white' : 'bg-muted text-muted-foreground',
        )}
        style={active ? { background: mode.accent } : undefined}
      >
        <ModeIcon mode={mode.key} className="size-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">
          {mode.label}
        </span>
        {!compact ? (
          <span className="block truncate text-xs text-muted-foreground">
            {mode.description}
          </span>
        ) : null}
      </span>
    </button>
  );
}

/* ============================================================
   Assistant mode
   ============================================================ */

export interface AssistantSessionSummary {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AssistantSessionDetail {
  id: string;
  messages: Array<{
    id: string;
    sender: string;
    content: string;
    metadata: { visualization?: ChatChartSpec | null } | null;
    createdAt: string;
  }>;
}

interface AssistantEnvelope {
  sessionId: string;
  messageId: string;
  visualization: ChatChartSpec | null;
  insights: string;
}

type ToolStatus = 'started' | 'completed' | 'denied' | 'error';

interface ToolNote {
  name: string;
  status: ToolStatus;
}

interface AssistantMessage {
  id: string;
  sender: ChatSender;
  text: string;
  chart?: ChatChartSpec | null;
  pending?: boolean;
  failed?: boolean;
  tools?: ToolNote[];
}

const TOOL_TONE: Record<ToolStatus, StateTone> = {
  started: 'info',
  completed: 'success',
  denied: 'warning',
  error: 'destructive',
};

const ASSISTANT_SUGGESTIONS = [
  'How many students are enrolled right now?',
  'Summarize attendance for this month.',
  'What events are coming up?',
];

function toolLabel(name: string): string {
  return name.replace(/^get_/, '').replace(/_/g, ' ');
}

function AssistantPane({ active }: { active: boolean }) {
  // Lazy: only fetch once the pane is active. SWR revalidates the history on
  // refocus; new sessions are inserted optimistically via `mutateSessions`.
  const {
    data: sessions = [],
    isLoading: loading,
    error: sessionsError,
    mutate: mutateSessions,
  } = useSWR<AssistantSessionSummary[]>(
    active ? '/api/ai/analytics/sessions' : null,
  );
  const [activeSessionId, setActiveSessionId] = React.useState<string | null>(
    null,
  );
  const [messages, setMessages] = React.useState<AssistantMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [loadingSession, setLoadingSession] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showHistory, setShowHistory] = React.useState(false);

  const displayError =
    error ??
    (sessionsError instanceof Error
      ? sessionsError.message
      : sessionsError
        ? 'Could not load assistant history.'
        : null);

  const patchLast = React.useCallback(
    (patch: (m: AssistantMessage) => AssistantMessage) => {
      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1]!;
        return [...prev.slice(0, -1), patch(last)];
      });
    },
    [],
  );

  const send = React.useCallback(
    async (message: string) => {
      if (busy) return;
      setBusy(true);
      setError(null);
      setInput('');
      setShowHistory(false);
      setMessages((prev) => [
        ...prev,
        { id: localId(), sender: 'user', text: message },
        { id: localId(), sender: 'assistant', text: '', pending: true },
      ]);

      try {
        const res = await fetch('/api/ai/analytics/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            ...(activeSessionId ? { sessionId: activeSessionId } : {}),
          }),
        });

        if (!res.ok || !res.body) {
          let detail = 'The assistant is unavailable right now.';
          try {
            const body = (await res.json()) as { error?: string };
            detail = body.error ?? detail;
          } catch {
            // keep generic message
          }
          throw new Error(detail);
        }

        let sawTerminalEvent = false;
        for await (const { event, data } of readSseStream(res.body)) {
          if (event === 'session') {
            const { sessionId } = JSON.parse(data) as { sessionId: string };
            setActiveSessionId(sessionId);
            void mutateSessions(
              (prev = []) =>
                prev.some((s) => s.id === sessionId)
                  ? prev
                  : [
                      {
                        id: sessionId,
                        title: message.slice(0, 80),
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                      },
                      ...prev,
                    ],
              { revalidate: false },
            );
          } else if (event === 'delta') {
            const { text } = JSON.parse(data) as { text: string };
            patchLast((m) => ({ ...m, text: m.text + text }));
          } else if (event === 'tool') {
            const note = JSON.parse(data) as ToolNote;
            patchLast((m) => {
              const tools = [...(m.tools ?? [])];
              let openTool = -1;
              for (let i = tools.length - 1; i >= 0; i -= 1) {
                const tool = tools[i]!;
                if (tool.name === note.name && tool.status === 'started') {
                  openTool = i;
                  break;
                }
              }
              if (note.status !== 'started' && openTool !== -1) {
                tools[openTool] = note;
              } else {
                tools.push(note);
              }
              return { ...m, tools };
            });
          } else if (event === 'complete') {
            const { envelope } = JSON.parse(data) as {
              envelope: AssistantEnvelope;
            };
            sawTerminalEvent = true;
            patchLast((m) => ({
              ...m,
              text: envelope.insights,
              chart: envelope.visualization,
              pending: false,
            }));
          } else if (event === 'error') {
            const { message: detail } = JSON.parse(data) as { message: string };
            sawTerminalEvent = true;
            setError(detail);
            patchLast((m) => ({ ...m, pending: false, failed: true }));
          }
        }

        if (!sawTerminalEvent) {
          throw new Error('The connection dropped before the reply finished.');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'The AI request failed.');
        patchLast((m) =>
          m.sender === 'assistant' ? { ...m, pending: false, failed: true } : m,
        );
      } finally {
        setBusy(false);
      }
    },
    [activeSessionId, busy, mutateSessions, patchLast],
  );

  const openSession = React.useCallback(
    async (sessionId: string) => {
      if (busy || sessionId === activeSessionId) {
        setShowHistory(false);
        return;
      }
      setLoadingSession(true);
      setError(null);
      try {
        const detail = await fetchJson<AssistantSessionDetail>(
          `/api/ai/analytics/sessions/${encodeURIComponent(sessionId)}`,
          'Could not load that conversation.',
        );
        setActiveSessionId(detail.id);
        setMessages(
          detail.messages.map((m) => ({
            id: m.id,
            sender: m.sender === 'assistant' ? 'assistant' : 'user',
            text: m.content,
            chart: m.metadata?.visualization ?? null,
          })),
        );
        setShowHistory(false);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Could not load that conversation.',
        );
      } finally {
        setLoadingSession(false);
      }
    },
    [activeSessionId, busy],
  );

  const newChat = React.useCallback(() => {
    if (busy) return;
    setActiveSessionId(null);
    setMessages([]);
    setError(null);
    setShowHistory(false);
  }, [busy]);

  return (
    <ModePaneShell
      title="Assistant"
      description="Ask about school data. Answers stay inside what your role can see."
      mode="assistant"
      historyButton={
        <Button
          variant="outline"
          size="sm"
          className="md:hidden"
          onClick={() => setShowHistory((v) => !v)}
          aria-pressed={showHistory}
        >
          <History /> History
        </Button>
      }
      actionButton={
        <Button size="sm" onClick={newChat} disabled={busy}>
          <MessageCirclePlus /> New chat
        </Button>
      }
    >
      <ListDetailLayout
        className="min-h-0 flex-1"
        listWidth={280}
        showDetail={!showHistory}
        list={
          <HistoryList
            loading={loading}
            emptyText="No conversations yet."
            sessions={sessions}
            activeSessionId={activeSessionId}
            onOpen={(id) => void openSession(id)}
          />
        }
        detail={
          <div className="flex h-full min-h-0 flex-col">
            <ChatThread aria-label="Assistant conversation" className="p-4">
              {messages.length === 0 && !loadingSession ? (
                <EmptyState
                  compact
                  icon={<Sparkles aria-hidden />}
                  title="Ask about your school's data"
                  description="Enrollment, attendance, performance, finance, events."
                  className="my-auto"
                  footer={
                    <div className="flex flex-wrap justify-center gap-2">
                      {ASSISTANT_SUGGESTIONS.map((q) => (
                        <Button
                          key={q}
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => void send(q)}
                        >
                          {q}
                        </Button>
                      ))}
                    </div>
                  }
                />
              ) : (
                messages.map((m) => (
                  <ChatMessageBubble
                    key={m.id}
                    sender={m.sender}
                    chart={m.chart}
                    pending={m.pending}
                    pendingLabel="The assistant is thinking"
                    footer={
                      m.failed ? (
                        <span className="text-destructive">Failed</span>
                      ) : m.tools?.length ? (
                        m.tools.map((t, i) => (
                          <StatusBadge
                            key={`${t.name}-${i}`}
                            tone={TOOL_TONE[t.status]}
                            dot
                          >
                            {toolLabel(t.name)}
                          </StatusBadge>
                        ))
                      ) : undefined
                    }
                  >
                    {m.text || undefined}
                  </ChatMessageBubble>
                ))
              )}
            </ChatThread>

            <ComposerFrame mode="assistant">
              {displayError ? (
                <NoticeBanner
                  tone="destructive"
                  role="alert"
                  title={displayError}
                  onDismiss={() => setError(null)}
                />
              ) : null}
              <ChatComposer
                value={input}
                onValueChange={setInput}
                onSend={(message) => void send(message)}
                busy={busy || loadingSession}
                placeholder="Ask about enrollment, attendance, fees..."
                inputLabel="Message the assistant"
                sendLabel="Send message"
                hint="Enter to send, Shift+Enter for a new line"
              />
            </ComposerFrame>
          </div>
        }
      />
    </ModePaneShell>
  );
}

/* ============================================================
   Tutor mode
   ============================================================ */

interface TutorSessionSummary {
  id: string;
  title: string | null;
  lessonId: string | null;
  lessonTitle: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Citation {
  index: number;
  materialId: string;
  materialTitle: string;
  chunkIndex: number;
  similarity: number;
  snippet: string;
}

interface TutorSessionDetail {
  id: string;
  lessonId: string | null;
  messages: Array<{
    id: string;
    sender: string;
    content: string;
    metadata: { citations?: Citation[] } | null;
    createdAt: string;
  }>;
}

interface TutorEnvelope {
  sessionId: string;
  messageId: string;
  lessonId: string;
  answer: string;
  citations: Citation[];
}

interface AssessmentBlock {
  allowed: false;
  message: string;
  alternatives: string[];
}

interface TutorMessage {
  id: string;
  sender: ChatSender;
  text: string;
  pending?: boolean;
  failed?: boolean;
  citations?: Citation[];
}

function lessonLabel(lesson: LessonSummary): string {
  const cls = lesson.class;
  const classPart = cls
    ? `${cls.name}${cls.section ? ` ${cls.section}` : ''} - `
    : '';
  return `${classPart}${lesson.title}`;
}

function TutorPane({ active }: { active: boolean }) {
  // Lazy: fetch lessons + history only when the pane is active. SWR revalidates
  // on refocus; new sessions are inserted optimistically via `mutateSessions`.
  const { data: lessons = [], error: lessonsError } = useSWR<LessonSummary[]>(
    active ? '/api/learning/lessons' : null,
  );
  const {
    data: sessions = [],
    isLoading: loading,
    error: sessionsError,
    mutate: mutateSessions,
  } = useSWR<TutorSessionSummary[]>(
    active ? '/api/ai/academic/sessions' : null,
  );
  const [activeSessionId, setActiveSessionId] = React.useState<string | null>(
    null,
  );
  const [lessonId, setLessonId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<TutorMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [loadingSession, setLoadingSession] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [block, setBlock] = React.useState<AssessmentBlock | null>(null);
  const [showHistory, setShowHistory] = React.useState(false);

  // Default the lesson picker to the first lesson once lessons load.
  React.useEffect(() => {
    if (lessonId == null && lessons.length > 0) {
      setLessonId(lessons[0]!.id);
    }
  }, [lessonId, lessons]);

  const displayError =
    error ??
    (lessonsError instanceof Error
      ? lessonsError.message
      : sessionsError instanceof Error
        ? sessionsError.message
        : lessonsError || sessionsError
          ? 'Could not load tutor data.'
          : null);

  const lessonLocked = activeSessionId !== null && messages.length > 0;
  const lessonById = React.useMemo(
    () => new Map(lessons.map((lesson) => [lesson.id, lesson])),
    [lessons],
  );

  const patchLast = React.useCallback(
    (patch: (m: TutorMessage) => TutorMessage) => {
      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1]!;
        return [...prev.slice(0, -1), patch(last)];
      });
    },
    [],
  );

  const send = React.useCallback(
    async (message: string) => {
      if (busy) return;
      if (!lessonId) {
        setError('Pick a lesson to study first.');
        return;
      }
      setBusy(true);
      setError(null);
      setBlock(null);
      setInput('');
      setShowHistory(false);
      setMessages((prev) => [
        ...prev,
        { id: localId(), sender: 'user', text: message },
        { id: localId(), sender: 'assistant', text: '', pending: true },
      ]);

      try {
        const res = await fetch('/api/ai/academic/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            lessonId,
            ...(activeSessionId ? { sessionId: activeSessionId } : {}),
          }),
        });

        if (!res.ok || !res.body) {
          if (res.status === 403) {
            const body = (await res.json()) as AssessmentBlock;
            setBlock(body);
            patchLast((m) => ({ ...m, pending: false, failed: true }));
            return;
          }
          let detail = 'The tutor is unavailable right now.';
          try {
            const body = (await res.json()) as { error?: string };
            detail = body.error ?? detail;
          } catch {
            // keep generic message
          }
          throw new Error(detail);
        }

        let sawTerminalEvent = false;
        for await (const { event, data } of readSseStream(res.body)) {
          if (event === 'session') {
            const parsed = JSON.parse(data) as {
              sessionId: string;
              lessonId: string;
            };
            setActiveSessionId(parsed.sessionId);
            setLessonId(parsed.lessonId);
            void mutateSessions(
              (prev = []) =>
                prev.some((s) => s.id === parsed.sessionId)
                  ? prev
                  : [
                      {
                        id: parsed.sessionId,
                        title: message.slice(0, 80),
                        lessonId: parsed.lessonId,
                        lessonTitle:
                          lessonById.get(parsed.lessonId)?.title ?? null,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                      },
                      ...prev,
                    ],
              { revalidate: false },
            );
          } else if (event === 'sources') {
            const { citations } = JSON.parse(data) as { citations: Citation[] };
            patchLast((m) => ({ ...m, citations }));
          } else if (event === 'delta') {
            const { text } = JSON.parse(data) as { text: string };
            patchLast((m) => ({ ...m, text: m.text + text }));
          } else if (event === 'complete') {
            const { envelope } = JSON.parse(data) as {
              envelope: TutorEnvelope;
            };
            sawTerminalEvent = true;
            patchLast((m) => ({
              ...m,
              text: envelope.answer,
              citations: envelope.citations,
              pending: false,
            }));
          } else if (event === 'error') {
            const { message: detail } = JSON.parse(data) as { message: string };
            sawTerminalEvent = true;
            setError(detail);
            patchLast((m) => ({ ...m, pending: false, failed: true }));
          }
        }

        if (!sawTerminalEvent) {
          throw new Error('The connection dropped before the reply finished.');
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'The tutor request failed.',
        );
        patchLast((m) =>
          m.sender === 'assistant' ? { ...m, pending: false, failed: true } : m,
        );
      } finally {
        setBusy(false);
      }
    },
    [activeSessionId, busy, lessonById, lessonId, mutateSessions, patchLast],
  );

  const openSession = React.useCallback(
    async (sessionId: string) => {
      if (busy || sessionId === activeSessionId) {
        setShowHistory(false);
        return;
      }
      setLoadingSession(true);
      setError(null);
      setBlock(null);
      try {
        const detail = await fetchJson<TutorSessionDetail>(
          `/api/ai/academic/sessions/${encodeURIComponent(sessionId)}`,
          'Could not load that conversation.',
        );
        setActiveSessionId(detail.id);
        if (detail.lessonId) setLessonId(detail.lessonId);
        setMessages(
          detail.messages.map((m) => ({
            id: m.id,
            sender: m.sender === 'assistant' ? 'assistant' : 'user',
            text: m.content,
            citations: m.metadata?.citations ?? undefined,
          })),
        );
        setShowHistory(false);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Could not load that conversation.',
        );
      } finally {
        setLoadingSession(false);
      }
    },
    [activeSessionId, busy],
  );

  const newChat = React.useCallback(() => {
    if (busy) return;
    setActiveSessionId(null);
    setMessages([]);
    setError(null);
    setBlock(null);
    setShowHistory(false);
  }, [busy]);

  return (
    <ModePaneShell
      title="Study tutor"
      description="Ask about lessons and get source-linked explanations."
      mode="tutor"
      historyButton={
        <Button
          variant="outline"
          size="sm"
          className="md:hidden"
          onClick={() => setShowHistory((v) => !v)}
          aria-pressed={showHistory}
        >
          <History /> History
        </Button>
      }
      actionButton={
        <Button size="sm" onClick={newChat} disabled={busy}>
          <MessageCirclePlus /> New chat
        </Button>
      }
    >
      <ListDetailLayout
        className="min-h-0 flex-1"
        listWidth={280}
        showDetail={!showHistory}
        list={
          <HistoryList
            loading={loading}
            emptyText="No conversations yet."
            sessions={sessions}
            activeSessionId={activeSessionId}
            onOpen={(id) => void openSession(id)}
            renderSubtitle={(session) => session.lessonTitle}
          />
        }
        detail={
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex flex-col gap-1.5 border-b border-border p-3">
              <Label htmlFor="ai-lesson-picker">Lesson</Label>
              <Select
                value={lessonId ?? undefined}
                onValueChange={setLessonId}
                disabled={lessons.length === 0 || lessonLocked || busy}
              >
                <SelectTrigger
                  id="ai-lesson-picker"
                  aria-label="Select a lesson"
                  className="sm:max-w-md"
                >
                  <SelectValue placeholder="Select a lesson to study" />
                </SelectTrigger>
                <SelectContent>
                  {lessons.map((lesson) => (
                    <SelectItem key={lesson.id} value={lesson.id}>
                      {lessonLabel(lesson)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {lessonLocked ? (
                <p className="text-xs text-muted-foreground">
                  This conversation is tied to its lesson. Start a new chat to
                  switch lessons.
                </p>
              ) : null}
            </div>

            <ChatThread aria-label="Tutor conversation" className="p-4">
              {messages.length === 0 && !loadingSession ? (
                <EmptyState
                  compact
                  icon={<BookOpenCheck aria-hidden />}
                  title={
                    lessons.length > 0
                      ? 'Ask about your lesson'
                      : 'No lessons available yet'
                  }
                  description={
                    lessons.length > 0
                      ? 'Pick a lesson, then ask a question. Answers come from approved materials.'
                      : 'Published lessons for your classes will appear here.'
                  }
                  className="my-auto"
                />
              ) : (
                messages.map((m) => (
                  <ChatMessageBubble
                    key={m.id}
                    sender={m.sender}
                    pending={m.pending}
                    pendingLabel="The tutor is thinking"
                    footer={
                      m.failed ? (
                        <span className="text-destructive">Failed</span>
                      ) : m.sender === 'assistant' && m.citations?.length ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-medium text-muted-foreground">
                            Sources
                          </span>
                          <ul className="flex flex-col gap-1">
                            {m.citations.map((c) => (
                              <li
                                key={`${c.materialId}-${c.chunkIndex}`}
                                className="text-xs text-muted-foreground"
                              >
                                <span className="font-medium text-foreground">
                                  [{c.index}] {c.materialTitle}
                                </span>{' '}
                                <span className="opacity-80">
                                  ({Math.round(c.similarity * 100)}% match)
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : undefined
                    }
                  >
                    {m.text || undefined}
                  </ChatMessageBubble>
                ))
              )}
            </ChatThread>

            <ComposerFrame mode="tutor">
              {block ? (
                <NoticeBanner
                  tone="warning"
                  role="alert"
                  title={block.message}
                  description={
                    block.alternatives?.length
                      ? `Try instead: ${block.alternatives.join(' - ')}`
                      : undefined
                  }
                  onDismiss={() => setBlock(null)}
                />
              ) : null}
              {displayError ? (
                <NoticeBanner
                  tone="destructive"
                  role="alert"
                  title={displayError}
                  onDismiss={() => setError(null)}
                />
              ) : null}
              <ChatComposer
                value={input}
                onValueChange={setInput}
                onSend={(message) => void send(message)}
                busy={busy || loadingSession}
                disabled={lessons.length === 0}
                placeholder="Ask about this lesson..."
                inputLabel="Ask the tutor"
                sendLabel="Send question"
                hint="Enter to send, Shift+Enter for a new line"
              />
            </ComposerFrame>
          </div>
        }
      />
    </ModePaneShell>
  );
}

/* ============================================================
   Integrity mode
   ============================================================ */

interface IntegrityFlag {
  id: string;
  title: string;
  sub: string;
  severity: 'High' | 'Review' | 'Info';
  hot?: boolean;
  meta: Array<[string, string]>;
  detail: string;
}

const INTEGRITY_FLAGS: IntegrityFlag[] = [
  {
    id: 'tab-switch',
    title: 'S. Kemi left the exam tab again',
    sub: 'Moments ago - 4th time',
    severity: 'High',
    hot: true,
    meta: [
      ['Who', 'S. Kemi'],
      ['Window', '10:42-10:46'],
      ['Signal', 'Tab blur x4'],
    ],
    detail:
      'A fresh tab-switch signal landed during the active assessment. An in-room check now is more useful than a review after the paper.',
  },
  {
    id: 'group-switch',
    title: '2 students left the exam tab',
    sub: '3+ times each - last 4 min',
    severity: 'High',
    hot: true,
    meta: [
      ['Who', 'S. Kemi, T. Peters'],
      ['Window', '10:42-10:46'],
      ['Signal', 'Tab blur x7'],
    ],
    detail:
      'Both students repeatedly switched away from the exam window. The platform logged each blur event; no AI prompts were served.',
  },
  {
    id: 'paste',
    title: '1 long answer pasted in',
    sub: 'Flagged for style mismatch',
    severity: 'Review',
    meta: [
      ['Who', 'L. Carter'],
      ['Question', 'Q4'],
      ['Match', 'Style mismatch'],
    ],
    detail:
      'A long answer was pasted rather than typed, and its phrasing differs from the student previous submissions. Confirm whether notes were permitted before escalating.',
  },
  {
    id: 'blocked-tutor',
    title: 'AI Tutor blocked 9 prompts',
    sub: 'All denied during exam window',
    severity: 'Info',
    meta: [
      ['Attempts', '9'],
      ['Outcome', '100% denied'],
      ['Window', 'Exam open'],
    ],
    detail:
      'Students tried to open the Study tutor during the protected window. Every request was refused automatically.',
  },
];

function IntegrityMonitorPane() {
  const [selectedId, setSelectedId] = React.useState(INTEGRITY_FLAGS[0]!.id);
  const [feedback, setFeedback] = React.useState<Record<string, string>>({});
  const selected =
    INTEGRITY_FLAGS.find((flag) => flag.id === selectedId) ??
    INTEGRITY_FLAGS[0]!;

  return (
    <ModePaneShell
      title="Integrity monitor"
      description="Live assessment signals for staff oversight."
      mode="integrity"
    >
      <ListDetailLayout
        className="min-h-0 flex-1"
        listWidth={340}
        showDetail
        list={
          <div className="flex min-h-full flex-col">
            <div className="border-b border-border p-3">
              <div className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--ai-accent)] bg-[color-mix(in_oklab,var(--ai-accent)_10%,transparent)] p-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-[var(--ai-accent)] text-white">
                  <ShieldAlert className="size-4" />
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    Student Tutor locked for 28 students
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    Biology 11B mid-term
                  </div>
                </div>
              </div>
            </div>
            <nav
              aria-label="Integrity flags"
              className="flex flex-col gap-1 p-2"
            >
              {INTEGRITY_FLAGS.map((flag) => (
                <button
                  key={flag.id}
                  type="button"
                  onClick={() => setSelectedId(flag.id)}
                  aria-current={selectedId === flag.id ? 'true' : undefined}
                  className={cn(
                    'flex items-center gap-2 rounded-[var(--radius-sm)] px-2.5 py-2 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    selectedId === flag.id && 'bg-accent',
                  )}
                >
                  <span
                    className={cn(
                      'grid size-8 shrink-0 place-items-center rounded-[var(--radius-sm)] border',
                      flag.hot
                        ? 'border-[var(--ai-accent)] text-[var(--ai-accent)]'
                        : 'border-border text-muted-foreground',
                    )}
                  >
                    {flag.hot ? (
                      <AlertTriangle className="size-4" />
                    ) : (
                      <ShieldAlert className="size-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {flag.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {flag.sub}
                    </span>
                  </span>
                  <SeverityBadge severity={flag.severity} />
                </button>
              ))}
            </nav>
            <div className="mt-auto border-t border-border px-3 py-2 text-xs text-muted-foreground">
              Auto-monitoring 28 students
            </div>
          </div>
        }
        detail={
          <div className="flex h-full min-h-0 flex-col overflow-y-auto p-4">
            <div className="flex items-start gap-3 border-b border-border pb-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-[var(--radius-sm)] bg-[var(--ai-accent)] text-white">
                <ShieldAlert className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold">{selected.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selected.sub}
                </p>
              </div>
              <SeverityBadge severity={selected.severity} />
            </div>

            <div className="grid gap-2 py-4 sm:grid-cols-3">
              {selected.meta.map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-[var(--radius-sm)] border border-border bg-card p-3"
                >
                  <div className="text-xs text-muted-foreground">{label}</div>
                  <div className="mt-1 text-sm font-semibold">{value}</div>
                </div>
              ))}
            </div>

            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
              {selected.detail}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-sm font-medium">Review outcome</span>
              <Button
                variant={
                  feedback[selected.id] === 'confirm' ? 'default' : 'outline'
                }
                size="sm"
                onClick={() =>
                  setFeedback((prev) => ({ ...prev, [selected.id]: 'confirm' }))
                }
              >
                <CheckCircle2 /> Confirm
              </Button>
              <Button
                variant={
                  feedback[selected.id] === 'false-positive'
                    ? 'default'
                    : 'outline'
                }
                size="sm"
                onClick={() =>
                  setFeedback((prev) => ({
                    ...prev,
                    [selected.id]: 'false-positive',
                  }))
                }
              >
                <XCircle /> False positive
              </Button>
            </div>

            {feedback[selected.id] ? (
              <NoticeBanner
                className="mt-4"
                tone="success"
                title="Review recorded"
                description="The flag remains available for audit and follow-up."
              />
            ) : null}
          </div>
        }
      />
    </ModePaneShell>
  );
}

function SeverityBadge({ severity }: { severity: IntegrityFlag['severity'] }) {
  const tone: StateTone =
    severity === 'High'
      ? 'destructive'
      : severity === 'Review'
        ? 'warning'
        : 'info';
  return <StatusBadge tone={tone}>{severity}</StatusBadge>;
}

/* ============================================================
   Shared surfaces
   ============================================================ */

function ModePaneShell({
  title,
  description,
  mode,
  historyButton,
  actionButton,
  children,
}: {
  title: string;
  description: string;
  mode: AiMode;
  historyButton?: React.ReactNode;
  actionButton?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className="flex min-h-0 flex-1 flex-col gap-3"
      style={modeStyle(mode)}
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-[var(--radius-sm)] bg-[var(--ai-accent)] text-white">
              <ModeIcon mode={mode} className="size-4" />
            </span>
            <h2 className="truncate text-xl font-bold">{title}</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          {historyButton}
          {actionButton}
        </div>
      </div>
      {children}
    </section>
  );
}

function ComposerFrame({
  mode,
  children,
}: {
  mode: AiMode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-col gap-2 border-t border-border bg-card p-3 [&_button[type=submit]]:bg-[var(--ai-accent)] [&_button[type=submit]]:text-white [&_textarea:focus-visible]:ring-[var(--ai-accent)]"
      style={modeStyle(mode)}
    >
      {children}
    </div>
  );
}

function HistoryList<
  T extends { id: string; title: string | null; updatedAt: string },
>({
  loading,
  emptyText,
  sessions,
  activeSessionId,
  onOpen,
  renderSubtitle,
}: {
  loading: boolean;
  emptyText: string;
  sessions: T[];
  activeSessionId: string | null;
  onOpen: (id: string) => void;
  renderSubtitle?: (session: T) => string | null | undefined;
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-2 p-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-10 rounded-[var(--radius-sm)] bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <nav aria-label="Chat history" className="flex flex-col gap-1 p-2">
      {sessions.length === 0 ? (
        <p className="px-2 py-3 text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        sessions.map((session) => (
          <button
            key={session.id}
            type="button"
            onClick={() => onOpen(session.id)}
            aria-current={session.id === activeSessionId ? 'true' : undefined}
            className={cn(
              'flex flex-col gap-0.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
              session.id === activeSessionId && 'bg-accent font-medium',
            )}
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate">
                {session.title || 'Untitled conversation'}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatDay(session.updatedAt)}
              </span>
            </span>
            {renderSubtitle?.(session) ? (
              <span className="truncate text-xs text-muted-foreground">
                {renderSubtitle(session)}
              </span>
            ) : null}
          </button>
        ))
      )}
    </nav>
  );
}
