'use client';

/* ============================================================
   AssistantClient — the Analytics AI chat island

   Owns the conversation state machine: sends a message through the
   /api/ai/analytics/chat SSE proxy, folds the event stream
   (session → delta* → tool* → complete | error → done) into the
   message list, and lets the user resume any of their previous
   sessions (master pane). The chat surface itself is the shared
   packages/ui chat kit; this file is transport + state only.
   ============================================================ */

import * as React from 'react';
import { History, MessageCirclePlus, Sparkles } from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { ChatComposer } from '@workspace/ui/custom/chat/chat-composer';
import { ChatMessageBubble } from '@workspace/ui/custom/chat/chat-message';
import { ChatThread } from '@workspace/ui/custom/chat/chat-thread';
import { ListDetailLayout } from '@workspace/ui/custom/layouts/list-detail-layout';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { StatusBadge } from '@workspace/ui/custom/data-display/status-badge';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { NoticeBanner } from '@workspace/ui/custom/states/notice-banner';
import { cn } from '@workspace/ui/lib/utils';
import type { ChatChartSpec, ChatSender } from '@workspace/ui/types/chat.types';
import type { StateTone } from '@workspace/ui/types/states.types';

import { readSseStream } from '@/lib/sse';

/* ---- wire shapes (see apps/api analytics-chat.service.ts) ------ */

export interface SessionSummary {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SessionDetail {
  id: string;
  messages: Array<{
    id: string;
    sender: string;
    content: string;
    metadata: { visualization?: ChatChartSpec | null } | null;
    createdAt: string;
  }>;
}

interface ChatEnvelope {
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

/* ---- view model ------------------------------------------------- */

interface Message {
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

/** Humanize a tool name: get_enrollment_stats → "enrollment stats". */
function toolLabel(name: string): string {
  return name.replace(/^get_/, '').replace(/_/g, ' ');
}

const SUGGESTIONS = [
  'How many students are enrolled right now?',
  'Summarize attendance for this month.',
  'What events are coming up?',
];

let nextLocalId = 0;
function localId(): string {
  nextLocalId += 1;
  return `local-${nextLocalId}`;
}

interface Props {
  initialSessions: SessionSummary[];
}

export function AssistantClient({ initialSessions }: Props) {
  const [sessions, setSessions] = React.useState(initialSessions);
  const [activeSessionId, setActiveSessionId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [loadingSession, setLoadingSession] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Mobile pane: the chat is primary; the history list shows on demand.
  const [showHistory, setShowHistory] = React.useState(false);

  /** Patch the newest message (the streaming assistant reply). */
  const patchLast = React.useCallback((patch: (m: Message) => Message) => {
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1]!;
      return [...prev.slice(0, -1), patch(last)];
    });
  }, []);

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
            // keep the generic message
          }
          throw new Error(detail);
        }

        let sawTerminalEvent = false;
        for await (const { event, data } of readSseStream(res.body)) {
          if (event === 'session') {
            const { sessionId } = JSON.parse(data) as { sessionId: string };
            setActiveSessionId(sessionId);
            setSessions((prev) =>
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
            );
          } else if (event === 'delta') {
            const { text } = JSON.parse(data) as { text: string };
            patchLast((m) => ({ ...m, text: m.text + text }));
          } else if (event === 'tool') {
            const note = JSON.parse(data) as ToolNote;
            patchLast((m) => {
              const tools = [...(m.tools ?? [])];
              // A tool streams 'started' then its outcome: update the open
              // entry for that tool, or append a new one.
              let open = -1;
              for (let i = tools.length - 1; i >= 0; i--) {
                if (tools[i]!.name === note.name && tools[i]!.status === 'started') {
                  open = i;
                  break;
                }
              }
              if (note.status !== 'started' && open !== -1) {
                tools[open] = note;
              } else {
                tools.push(note);
              }
              return { ...m, tools };
            });
          } else if (event === 'complete') {
            const { envelope } = JSON.parse(data) as { envelope: ChatEnvelope };
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
    [activeSessionId, busy, patchLast],
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
        const res = await fetch(
          `/api/ai/analytics/sessions/${encodeURIComponent(sessionId)}`,
        );
        if (!res.ok) throw new Error('Could not load that conversation.');
        const detail = (await res.json()) as SessionDetail;
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
          err instanceof Error ? err.message : 'Could not load that conversation.',
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

  const formatDay = React.useMemo(
    () => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }),
    [],
  );

  return (
    <ShellMain className="gap-0 pb-0">
      <PageHeader
        padded={false}
        className="pb-3"
        title="Assistant"
        description="Ask questions about your school's data — answers are scoped to what you can see."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="md:hidden"
              onClick={() => setShowHistory((v) => !v)}
              aria-pressed={showHistory}
            >
              <History /> History
            </Button>
            <Button size="sm" onClick={newChat} disabled={busy}>
              <MessageCirclePlus /> New chat
            </Button>
          </>
        }
      />

      <ListDetailLayout
        className="mb-[var(--content-padding)] flex-1"
        listWidth={280}
        showDetail={!showHistory}
        list={
          <nav aria-label="Chat history" className="flex flex-col gap-1 p-2">
            {sessions.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">
                No conversations yet.
              </p>
            ) : (
              sessions.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => void openSession(s.id)}
                  aria-current={s.id === activeSessionId ? 'true' : undefined}
                  className={cn(
                    'flex items-baseline justify-between gap-2 rounded-[var(--radius-sm)] px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent',
                    s.id === activeSessionId && 'bg-accent font-medium',
                  )}
                >
                  <span className="min-w-0 truncate">
                    {s.title || 'Untitled conversation'}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDay.format(new Date(s.updatedAt))}
                  </span>
                </button>
              ))
            )}
          </nav>
        }
        detail={
          <div className="flex h-full min-h-0 flex-col">
            <ChatThread aria-label="Assistant conversation" className="p-4">
              {messages.length === 0 && !loadingSession ? (
                <EmptyState
                  compact
                  icon={<Sparkles aria-hidden />}
                  title="Ask about your school's data"
                  description="Enrollment, attendance, performance, finance, events — the assistant only sees what your role allows."
                  className="my-auto"
                  footer={
                    <div className="flex flex-wrap justify-center gap-2">
                      {SUGGESTIONS.map((q) => (
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
                          <StatusBadge key={`${t.name}-${i}`} tone={TOOL_TONE[t.status]} dot>
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

            <div className="flex flex-col gap-2 border-t border-border p-3">
              {error ? (
                <NoticeBanner
                  tone="destructive"
                  role="alert"
                  title={error}
                  onDismiss={() => setError(null)}
                />
              ) : null}
              <ChatComposer
                value={input}
                onValueChange={setInput}
                onSend={(message) => void send(message)}
                busy={busy || loadingSession}
                placeholder="Ask about enrollment, attendance, fees…"
                inputLabel="Message the assistant"
                sendLabel="Send message"
                hint="Enter to send · Shift+Enter for a new line"
              />
            </div>
          </div>
        }
      />
    </ShellMain>
  );
}
