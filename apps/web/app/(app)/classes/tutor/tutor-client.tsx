'use client';

/* ============================================================
   TutorClient — the Academic AI tutor chat island

   Lesson-scoped RAG: the student picks a lesson, asks a question, and the
   answer streams back grounded in that lesson's materials with numbered
   source citations. Owns the SSE state machine over /api/ai/academic/chat
   (session → sources → delta* → complete | error → done), lesson selection,
   session resume, and the assessment-window refusal (403 → message +
   alternatives). The chat surface itself is the shared packages/ui chat kit.
   ============================================================ */

import * as React from 'react';
import { BookOpenCheck, History, MessageCirclePlus } from 'lucide-react';

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
import { ListDetailLayout } from '@workspace/ui/custom/layouts/list-detail-layout';
import { ShellMain } from '@workspace/ui/custom/shell/app-shell';
import { PageHeader } from '@workspace/ui/custom/shell/page-header';
import { EmptyState } from '@workspace/ui/custom/states/page-states';
import { NoticeBanner } from '@workspace/ui/custom/states/notice-banner';
import { cn } from '@workspace/ui/lib/utils';
import type { ChatSender } from '@workspace/ui/types/chat.types';

import type { LessonSummary } from '@/lib/academics';
import { readSseStream } from '@/lib/sse';

/* ---- wire shapes (see apps/api academic-chat.service.ts) -------- */

export interface TutorSessionSummary {
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

interface SessionDetail {
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

interface ChatEnvelope {
  sessionId: string;
  messageId: string;
  lessonId: string;
  answer: string;
  citations: Citation[];
}

/** The assessment-window 403 body. */
interface AssessmentBlock {
  allowed: false;
  message: string;
  alternatives: string[];
}

/* ---- view model ------------------------------------------------- */

interface Message {
  id: string;
  sender: ChatSender;
  text: string;
  pending?: boolean;
  failed?: boolean;
  citations?: Citation[];
}

let nextLocalId = 0;
function localId(): string {
  nextLocalId += 1;
  return `local-${nextLocalId}`;
}

function lessonLabel(lesson: LessonSummary): string {
  const cls = lesson.class;
  const classPart = cls
    ? `${cls.name}${cls.section ? ` ${cls.section}` : ''} — `
    : '';
  return `${classPart}${lesson.title}`;
}

interface Props {
  initialLessons: LessonSummary[];
  initialSessions: TutorSessionSummary[];
}

export function TutorClient({ initialLessons, initialSessions }: Props) {
  const [sessions, setSessions] = React.useState(initialSessions);
  const [activeSessionId, setActiveSessionId] = React.useState<string | null>(
    null,
  );
  const [lessonId, setLessonId] = React.useState<string | null>(
    initialLessons[0]?.id ?? null,
  );
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [loadingSession, setLoadingSession] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [block, setBlock] = React.useState<AssessmentBlock | null>(null);
  const [showHistory, setShowHistory] = React.useState(false);

  // Once a conversation is under way the lesson is fixed to that session.
  const lessonLocked = activeSessionId !== null && messages.length > 0;
  const lessonById = React.useMemo(
    () => new Map(initialLessons.map((l) => [l.id, l])),
    [initialLessons],
  );

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
          // 403 = assessment-window block (carries alternatives).
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
            // keep the generic message
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
            setSessions((prev) =>
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
            );
          } else if (event === 'sources') {
            const { citations } = JSON.parse(data) as { citations: Citation[] };
            patchLast((m) => ({ ...m, citations }));
          } else if (event === 'delta') {
            const { text } = JSON.parse(data) as { text: string };
            patchLast((m) => ({ ...m, text: m.text + text }));
          } else if (event === 'complete') {
            const { envelope } = JSON.parse(data) as { envelope: ChatEnvelope };
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
        setError(err instanceof Error ? err.message : 'The tutor request failed.');
        patchLast((m) =>
          m.sender === 'assistant' ? { ...m, pending: false, failed: true } : m,
        );
      } finally {
        setBusy(false);
      }
    },
    [activeSessionId, busy, lessonId, lessonById, patchLast],
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
        const res = await fetch(
          `/api/ai/academic/sessions/${encodeURIComponent(sessionId)}`,
        );
        if (!res.ok) throw new Error('Could not load that conversation.');
        const detail = (await res.json()) as SessionDetail;
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

  const formatDay = React.useMemo(
    () => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }),
    [],
  );

  const hasLessons = initialLessons.length > 0;

  return (
    <ShellMain className="gap-0 pb-0">
      <PageHeader
        padded={false}
        className="pb-3"
        title="Study tutor"
        description="Ask about a lesson and get explanations grounded in its materials. It won't hand you assignment or test answers — it helps you understand."
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
                    'flex flex-col gap-0.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent',
                    s.id === activeSessionId && 'bg-accent font-medium',
                  )}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate">
                      {s.title || 'Untitled conversation'}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDay.format(new Date(s.updatedAt))}
                    </span>
                  </span>
                  {s.lessonTitle ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {s.lessonTitle}
                    </span>
                  ) : null}
                </button>
              ))
            )}
          </nav>
        }
        detail={
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex flex-col gap-1.5 border-b border-border p-3">
              <Label htmlFor="lesson-picker">Lesson</Label>
              <Select
                value={lessonId ?? undefined}
                onValueChange={setLessonId}
                disabled={!hasLessons || lessonLocked || busy}
              >
                <SelectTrigger
                  id="lesson-picker"
                  aria-label="Select a lesson"
                  className="sm:max-w-md"
                >
                  <SelectValue placeholder="Select a lesson to study" />
                </SelectTrigger>
                <SelectContent>
                  {initialLessons.map((lesson) => (
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
                    hasLessons
                      ? 'Ask about your lesson'
                      : 'No lessons available yet'
                  }
                  description={
                    hasLessons
                      ? 'Pick a lesson above, then ask a question. Answers come from that lesson\'s approved materials, with sources.'
                      : 'Once your teachers publish lessons for your classes, you can study them here.'
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

            <div className="flex flex-col gap-2 border-t border-border p-3">
              {block ? (
                <NoticeBanner
                  tone="warning"
                  role="alert"
                  title={block.message}
                  description={
                    block.alternatives?.length
                      ? `Try instead: ${block.alternatives.join(' · ')}`
                      : undefined
                  }
                  onDismiss={() => setBlock(null)}
                />
              ) : null}
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
                disabled={!hasLessons}
                placeholder="Ask about this lesson…"
                inputLabel="Ask the tutor"
                sendLabel="Send question"
                hint="Enter to send · Shift+Enter for a new line"
              />
            </div>
          </div>
        }
      />
    </ShellMain>
  );
}
