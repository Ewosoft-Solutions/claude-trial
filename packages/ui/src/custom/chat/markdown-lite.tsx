/* ============================================================
   MarkdownLite — a tiny, dependency-free markdown renderer

   Assistant replies come back as markdown (`**bold**`, `- lists`,
   `` `code` ``). This renders the small subset that shows up in
   chat without pulling a full markdown/HTML pipeline into the
   bundle — and, crucially, without dangerouslySetInnerHTML: every
   node is a real React element, so model output can never inject
   markup. Anything it doesn't recognise renders as plain text with
   line breaks preserved (the previous behaviour).

   Supported:
   - paragraphs (blank-line separated), soft line breaks within
   - unordered lists (`-`, `*`, `•`) and ordered lists (`1.`)
   - ATX headings (`#`..`######`) rendered as emphasised lines
   - inline: bold (double star / double underscore), italic (single
     star or underscore), `code`, and [label](url) links with an
     http(s)/mailto allowlist
   ============================================================ */

import * as React from 'react';

import { cn } from '@workspace/ui/lib/utils';

export interface MarkdownLiteProps {
  text: string;
  className?: string;
}

/* ---- inline formatting ------------------------------------------ */

const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/;
const CODE_RE = /`([^`]+)`/;
const BOLD_RE = /(\*\*|__)(.+?)\1/;
const ITALIC_RE = /(\*|_)(?!\s)(.+?)(?<!\s)\1/;

/** Only render links we trust; everything else falls back to the label text. */
function safeHref(url: string): string | null {
  return /^(https?:\/\/|mailto:)/i.test(url) ? url : null;
}

/**
 * Render a single line of inline markdown to React nodes. Scans for the
 * earliest special token (code → link → bold → italic), emits the text
 * before it, then recurses on the remainder; bold/italic recurse into
 * their inner content so nesting like **bold _and italic_** works.
 */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let rest = text;
  let i = 0;

  while (rest.length > 0) {
    const code = CODE_RE.exec(rest);
    const link = LINK_RE.exec(rest);
    const bold = BOLD_RE.exec(rest);
    const italic = ITALIC_RE.exec(rest);

    const candidates = [
      code && { kind: 'code' as const, m: code },
      link && { kind: 'link' as const, m: link },
      bold && { kind: 'bold' as const, m: bold },
      italic && { kind: 'italic' as const, m: italic },
    ].filter((c): c is NonNullable<typeof c> => c !== null);

    if (candidates.length === 0) {
      out.push(rest);
      break;
    }

    // Earliest match wins; ties break by the candidate order above.
    const next = candidates.reduce((a, b) =>
      b.m.index < a.m.index ? b : a,
    );
    const { m } = next;
    if (m.index > 0) out.push(rest.slice(0, m.index));

    const key = `${keyPrefix}-${i++}`;
    if (next.kind === 'code') {
      out.push(
        <code
          key={key}
          className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]"
        >
          {m[1]}
        </code>,
      );
    } else if (next.kind === 'link') {
      const href = safeHref(m[2]!);
      out.push(
        href ? (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer noopener"
            className="font-medium underline underline-offset-2"
          >
            {renderInline(m[1]!, key)}
          </a>
        ) : (
          <React.Fragment key={key}>{m[1]}</React.Fragment>
        ),
      );
    } else if (next.kind === 'bold') {
      out.push(
        <strong key={key} className="font-semibold">
          {renderInline(m[2]!, key)}
        </strong>,
      );
    } else {
      out.push(<em key={key}>{renderInline(m[2]!, key)}</em>);
    }

    rest = rest.slice(m.index + m[0].length);
  }

  return out;
}

/** Join lines within a block, inserting <br> between soft line breaks. */
function renderLines(lines: string[], keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  lines.forEach((line, idx) => {
    if (idx > 0) out.push(<br key={`${keyPrefix}-br-${idx}`} />);
    out.push(...renderInline(line, `${keyPrefix}-l${idx}`));
  });
  return out;
}

/* ---- block parsing ---------------------------------------------- */

const UL_RE = /^\s*[-*•]\s+(.*)$/;
const OL_RE = /^\s*(\d+)[.)]\s+(.*)$/;
const HEADING_RE = /^(#{1,6})\s+(.*)$/;

export function MarkdownLite({ text, className }: MarkdownLiteProps) {
  const blocks = React.useMemo(() => renderBlocks(text), [text]);
  return (
    <div className={cn('whitespace-pre-wrap break-words leading-relaxed', className)}>
      {blocks}
    </div>
  );
}

function renderBlocks(text: string): React.ReactNode[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let b = 0;

  const flushPara = () => {
    if (para.length === 0) return;
    blocks.push(
      <p key={`p-${b++}`} className="[&:not(:first-child)]:mt-2">
        {renderLines(para, `p${b}`)}
      </p>,
    );
    para = [];
  };
  const flushList = () => {
    if (!list) return;
    const { ordered, items } = list;
    const cls = cn(
      'my-1 flex flex-col gap-1 pl-5',
      ordered ? 'list-decimal' : 'list-disc',
    );
    blocks.push(
      ordered ? (
        <ol key={`l-${b++}`} className={cls}>
          {items.map((it, i) => (
            <li key={i}>{renderInline(it, `ol${b}-${i}`)}</li>
          ))}
        </ol>
      ) : (
        <ul key={`l-${b++}`} className={cls}>
          {items.map((it, i) => (
            <li key={i}>{renderInline(it, `ul${b}-${i}`)}</li>
          ))}
        </ul>
      ),
    );
    list = null;
  };

  for (const line of lines) {
    if (line.trim() === '') {
      flushPara();
      flushList();
      continue;
    }

    const heading = HEADING_RE.exec(line);
    if (heading) {
      flushPara();
      flushList();
      blocks.push(
        <p
          key={`h-${b++}`}
          className="font-semibold [&:not(:first-child)]:mt-2"
        >
          {renderInline(heading[2]!, `h${b}`)}
        </p>,
      );
      continue;
    }

    const ol = OL_RE.exec(line);
    const ul = ol ? null : UL_RE.exec(line);
    if (ol || ul) {
      flushPara();
      const ordered = Boolean(ol);
      const item = (ol ? ol[2] : ul![1])!;
      if (list && list.ordered !== ordered) flushList();
      if (!list) list = { ordered, items: [] };
      list.items.push(item);
      continue;
    }

    // Plain text line: part of a paragraph.
    flushList();
    para.push(line);
  }

  flushPara();
  flushList();
  return blocks;
}
