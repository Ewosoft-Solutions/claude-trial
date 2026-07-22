'use client';

/* ============================================================
   /platform/analytics/assistant — platform AI assistant (3.2)

   Cross-tenant, aggregate-only, facet-gated. Every tool the AI can
   call is checked against the operator's own facets at execution, and
   the tools read only aggregate services — so the assistant cannot
   surface any individual record. See docs/platform-scope-plan.md §7.1.
   ============================================================ */

import { useState } from 'react';
import { Sparkles, Send } from 'lucide-react';
import { Button } from '@workspace/ui/components/button';
import { Textarea } from '@workspace/ui/components/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@workspace/ui/components/card';

interface ToolTrace { tool: string; allowed: boolean; error?: string }
interface ChatResult { answer: string; toolCalls: ToolTrace[] }

const SUGGESTIONS = [
  'How many schools and students are on the platform in total?',
  'Which schools are at risk, and why?',
  'Break down schools by institution type.',
];

export default function PlatformAssistantPage() {
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<ChatResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(q: string) {
    if (q.trim().length < 3) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/platform/ai/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || body?.message || 'The AI request failed.');
      }
      setResult(body as ChatResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 py-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Sparkles className="size-5" /> Platform assistant
        </h1>
        <p className="text-sm text-muted-foreground">
          Ask about the estate across all schools. Aggregate data only — the
          assistant has no access to individual pupil, parent, or staff records.
        </p>
      </div>

      <Card className="shadow-card">
        <CardContent className="flex flex-col gap-3 py-4">
          <Textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. Which schools are at risk, and how many students in total?"
            rows={3}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) ask(question);
            }}
          />
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setQuestion(s);
                    void ask(s);
                  }}
                  className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-ring/60 hover:bg-accent/40"
                >
                  {s}
                </button>
              ))}
            </div>
            <Button size="sm" disabled={loading} onClick={() => ask(question)}>
              <Send className="size-4" /> {loading ? 'Thinking…' : 'Ask'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      ) : null}

      {result ? (
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="text-base">Answer</CardTitle>
            {result.toolCalls.length > 0 ? (
              <CardDescription>
                Data sources:{' '}
                {result.toolCalls.map((t, i) => (
                  <span key={`${t.tool}-${i}`}>
                    {i > 0 ? ', ' : ''}
                    <span className={t.allowed ? '' : 'text-warning'}>
                      {t.tool}
                      {t.allowed ? '' : ' (no access)'}
                    </span>
                  </span>
                ))}
              </CardDescription>
            ) : null}
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{result.answer}</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
