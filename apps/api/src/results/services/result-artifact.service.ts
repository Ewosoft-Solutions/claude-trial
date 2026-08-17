/**
 * WB4 · ResultArtifactService — render the checksum-addressed report-card and
 * broadsheet artifacts (ADR-04/ADR-08). Each is a self-contained, print-ready
 * HTML document stored through the F4 DocumentService (ownerType
 * 'ResultPublication'); the stored DocumentVersion carries the sha256 checksum,
 * so the artifact is content-addressed and anchor-ready (ADR-13). A real
 * PDF-binary render is a thin fast-follow on the same seam.
 */
import { Injectable } from '@nestjs/common';
import { DocumentService } from '../../documents/services/document.service';
import { TRANSCRIPT_SOURCE_SYSTEM } from './result-transcript';
import type {
  SubjectSummary,
  TranscriptSummary,
  TranscriptTerm,
} from './result-transcript';

export interface ArtifactComponent {
  key: string;
  label: string;
  score: number | null;
  max: number;
  isAbsent: boolean;
  isExempt: boolean;
}
export interface ArtifactSubject {
  subjectLabel: string;
  components: ArtifactComponent[];
  total: number | null;
  maxTotal: number | null;
  percentage: number | null;
  letterGrade: string | null;
  remark: string | null;
}
export interface ArtifactTrait {
  domain: string;
  key: string;
  label: string;
  rating: number;
  maxRating: number;
}
export interface ArtifactStudent {
  studentNumber: string | null;
  studentName: string | null;
  sectionLabel: string | null;
  subjects: ArtifactSubject[];
  /** Rated behavioural traits (WB4-3); absent on a cycle with no rubric. */
  traits?: ArtifactTrait[];
  average: number | null;
  overallGrade: string | null;
  position: number | null;
  promotionRecommendation: string | null;
  promotionReason: string | null;
  principalRemark: string | null;
}
/** What the transcript renderer needs (a subset of the service's Transcript). */
export interface TranscriptArtifact {
  student: {
    studentNumber: string | null;
    studentName: string | null;
  };
  schoolName: string;
  terms: TranscriptTerm[];
  summary: TranscriptSummary;
  generatedAt: string;
}

export interface ArtifactCycleMeta {
  schoolName: string;
  cycleName: string;
  academicYearName: string;
  termName: string | null;
  version: number;
  publishedAt: string;
}

@Injectable()
export class ResultArtifactService {
  constructor(private readonly documents: DocumentService) {}

  async storeReportCard(
    tenantId: string,
    actorId: string | undefined,
    publicationId: string,
    meta: ArtifactCycleMeta,
    student: ArtifactStudent,
  ): Promise<{ documentId: string; checksum: string }> {
    const html = renderReportCardHtml(meta, student);
    const doc = await this.documents.upload(tenantId, actorId, {
      ownerType: 'ResultPublication',
      ownerId: publicationId,
      typeKey: 'report_card',
      title: `Report card — ${student.studentName ?? student.studentNumber} (${meta.cycleName})`,
      visibility: 'restricted',
      mime: 'text/html',
      filename: `report-card-${student.studentNumber ?? 'student'}.html`,
      content: Buffer.from(html, 'utf8'),
    });
    return { documentId: doc.id, checksum: doc.checksum };
  }

  /**
   * The cumulative transcript (WB4-4). Owned by the STUDENT rather than one
   * publication, because it spans every published term — each row carries the
   * publication version + checksum it was copied from, so the document is
   * self-auditing.
   */
  async storeTranscript(
    tenantId: string,
    actorId: string | undefined,
    studentId: string,
    transcript: TranscriptArtifact,
  ): Promise<{ documentId: string; checksum: string }> {
    const html = renderTranscriptHtml(transcript);
    const doc = await this.documents.upload(tenantId, actorId, {
      ownerType: 'Student',
      ownerId: studentId,
      typeKey: 'transcript',
      // Machine provenance: a student may own other documents a human titled
      // "Transcript …" (a prior-school record, say), so the tag — not the title
      // — is what identifies one this system issued.
      sourceSystem: TRANSCRIPT_SOURCE_SYSTEM,
      sourceId: studentId,
      title: `Transcript — ${transcript.student.studentName ?? transcript.student.studentNumber} (as at ${transcript.generatedAt})`,
      visibility: 'restricted',
      sensitive: true,
      mime: 'text/html',
      filename: `transcript-${transcript.student.studentNumber ?? 'student'}.html`,
      content: Buffer.from(html, 'utf8'),
    });
    return { documentId: doc.id, checksum: doc.checksum };
  }

  async storeBroadsheet(
    tenantId: string,
    actorId: string | undefined,
    publicationId: string,
    meta: ArtifactCycleMeta,
    sectionLabel: string,
    students: ArtifactStudent[],
  ): Promise<{ documentId: string; checksum: string }> {
    const html = renderBroadsheetHtml(meta, sectionLabel, students);
    const doc = await this.documents.upload(tenantId, actorId, {
      ownerType: 'ResultPublication',
      ownerId: publicationId,
      typeKey: 'broadsheet',
      title: `Broadsheet — ${sectionLabel} (${meta.cycleName})`,
      visibility: 'restricted',
      mime: 'text/html',
      filename: `broadsheet-${sectionLabel}.html`,
      content: Buffer.from(html, 'utf8'),
    });
    return { documentId: doc.id, checksum: doc.checksum };
  }
}

/** Minimal HTML escaper — every interpolated value passes through this. */
export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmt(n: number | null): string {
  return n === null ? '—' : String(n);
}

function subjectScoreCell(s: ArtifactSubject): string {
  if (s.percentage === null) {
    // Distinguish an absent/exempt subject from a genuine zero (ADR-04).
    const allExempt = s.components.every((c) => c.isExempt);
    return allExempt ? 'EXM' : 'ABS';
  }
  return `${fmt(s.total)} / ${fmt(s.maxTotal)} (${s.percentage}%)`;
}

const DOMAIN_LABELS: Record<string, string> = {
  affective: 'Affective traits',
  psychomotor: 'Psychomotor skills',
};

/**
 * The behavioural block (WB4-3). Rendered per domain, as a rating out of the
 * trait's own scale — a trait the teacher never rated is simply not in the
 * snapshot, so it never appears as a zero.
 */
function traitsSection(traits: ArtifactTrait[] | undefined): string {
  if (!traits || traits.length === 0) return '';
  const domains: string[] = [];
  for (const t of traits) {
    if (!domains.includes(t.domain)) domains.push(t.domain);
  }
  return domains
    .map((domain) => {
      const rows = traits
        .filter((t) => t.domain === domain)
        .map(
          (t) =>
            `<tr><td>${esc(t.label)}</td><td class="num">${t.rating} / ${t.maxRating}</td></tr>`,
        )
        .join('');
      return `<table>
    <thead><tr><th>${esc(DOMAIN_LABELS[domain] ?? domain)}</th><th class="num">Rating</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
    })
    .join('');
}

const BASE_STYLE = `
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #111; margin: 0; padding: 24px; }
  .doc { max-width: 900px; margin: 0 auto; }
  h1 { font-size: 20px; margin: 0 0 2px; }
  .muted { color: #555; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
  th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
  th { background: #f3f4f6; text-transform: uppercase; font-size: 10px; letter-spacing: .04em; }
  td.num, th.num { text-align: right; }
  .summary { margin-top: 16px; display: flex; gap: 24px; flex-wrap: wrap; font-size: 13px; }
  .summary div b { display: block; font-size: 11px; color: #555; text-transform: uppercase; }
  .footer { margin-top: 24px; font-size: 10px; color: #777; border-top: 1px solid #eee; padding-top: 8px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }
  .promote { background: #dcfce7; color: #166534; }
  .repeat { background: #fee2e2; color: #991b1b; }
  .review { background: #fef9c3; color: #854d0e; }
`;

export function renderReportCardHtml(
  meta: ArtifactCycleMeta,
  student: ArtifactStudent,
): string {
  const rows = student.subjects
    .map(
      (s) => `
      <tr>
        <td>${esc(s.subjectLabel)}</td>
        ${s.components
          .map(
            (c) =>
              `<td class="num">${c.isExempt ? 'EXM' : c.isAbsent ? 'ABS' : fmt(c.score)}</td>`,
          )
          .join('')}
        <td class="num">${subjectScoreCell(s)}</td>
        <td>${esc(s.letterGrade ?? '—')}</td>
        <td>${esc(s.remark ?? '')}</td>
      </tr>`,
    )
    .join('');
  const componentHeaders = (student.subjects[0]?.components ?? [])
    .map((c) => `<th class="num">${esc(c.label)}</th>`)
    .join('');
  const rec = student.promotionRecommendation ?? 'review';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>Report card — ${esc(student.studentName ?? student.studentNumber)}</title>
<style>${BASE_STYLE}</style></head>
<body><div class="doc">
  <h1>${esc(meta.schoolName)}</h1>
  <div class="muted">${esc(meta.cycleName)} · ${esc(meta.academicYearName)}${
    meta.termName ? ` · ${esc(meta.termName)}` : ''
  } · v${meta.version}</div>
  <div class="summary">
    <div><b>Student</b>${esc(student.studentName ?? '—')}</div>
    <div><b>Number</b>${esc(student.studentNumber ?? '—')}</div>
    <div><b>Class</b>${esc(student.sectionLabel ?? '—')}</div>
  </div>
  <table>
    <thead><tr><th>Subject</th>${componentHeaders}<th class="num">Total</th><th>Grade</th><th>Remark</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="9">No subjects</td></tr>'}</tbody>
  </table>
  <div class="summary">
    <div><b>Average</b>${student.average === null ? '—' : `${student.average}%`}</div>
    <div><b>Overall grade</b>${esc(student.overallGrade ?? '—')}</div>
    ${student.position !== null ? `<div><b>Position</b>${student.position}</div>` : ''}
    <div><b>Promotion</b><span class="badge ${esc(rec)}">${esc(rec)}</span></div>
  </div>
  ${
    student.promotionReason
      ? `<div class="muted" style="margin-top:8px">${esc(student.promotionReason)}</div>`
      : ''
  }
  ${traitsSection(student.traits)}
  ${
    student.principalRemark
      ? `<div style="margin-top:12px"><b>Principal's remark:</b> ${esc(student.principalRemark)}</div>`
      : ''
  }
  <div class="footer">
    Published ${esc(meta.publishedAt)}. This is an immutable snapshot; corrections are issued as an amendment (a new version).
  </div>
</div></body></html>`;
}

/**
 * The cumulative transcript. Every term row shows the publication version +
 * checksum it was copied from, so a reader can verify the document against the
 * snapshot it claims to summarise. A term the student was absent for shows ABS,
 * never 0 — the same rule as the report card.
 */
export function renderTranscriptHtml(t: TranscriptArtifact): string {
  const termBlocks = t.terms
    .map((term) => {
      const rows = term.subjects
        .map(
          (s) => `<tr>
        <td>${esc(s.subjectLabel)}</td>
        <td class="num">${
          s.percentage === null ? 'ABS' : `${fmt(s.total)} / ${fmt(s.maxTotal)}`
        }</td>
        <td class="num">${s.percentage === null ? '—' : `${s.percentage}%`}</td>
        <td>${esc(s.letterGrade ?? '—')}</td>
      </tr>`,
        )
        .join('');
      return `<h2 style="font-size:14px;margin:20px 0 0">${esc(term.academicYearName)}${
        term.termName ? ` · ${esc(term.termName)}` : ''
      }</h2>
  <div class="muted">${esc(term.cycleName)}${
    term.sectionLabel ? ` · ${esc(term.sectionLabel)}` : ''
  } · published ${esc(term.publishedAt)} · v${term.version} · snapshot ${esc(
    term.checksum.slice(0, 12),
  )}…</div>
  <table>
    <thead><tr><th>Subject</th><th class="num">Score</th><th class="num">%</th><th>Grade</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="4">No subjects</td></tr>'}</tbody>
  </table>
  <div class="summary">
    <div><b>Term average</b>${term.average === null ? '—' : `${term.average}%`}</div>
    <div><b>Grade</b>${esc(term.overallGrade ?? '—')}</div>
    ${term.position !== null ? `<div><b>Position</b>${term.position}</div>` : ''}
    ${
      term.promotionRecommendation
        ? `<div><b>Promotion</b><span class="badge ${esc(
            term.promotionRecommendation,
          )}">${esc(term.promotionRecommendation)}</span></div>`
        : ''
    }
  </div>`;
    })
    .join('');

  const subjectRows = t.summary.subjects
    .map(
      (s: SubjectSummary) => `<tr>
      <td>${esc(s.subjectLabel)}</td>
      <td class="num">${s.terms}</td>
      <td class="num">${s.average === null ? '—' : `${s.average}%`}</td>
      <td class="num">${s.best === null ? '—' : `${s.best}%`}</td>
      <td class="num">${s.worst === null ? '—' : `${s.worst}%`}</td>
    </tr>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>Transcript — ${esc(t.student.studentName ?? t.student.studentNumber)}</title>
<style>${BASE_STYLE}</style></head>
<body><div class="doc">
  <h1>${esc(t.schoolName)}</h1>
  <div class="muted">Academic transcript · generated ${esc(t.generatedAt)}</div>
  <div class="summary">
    <div><b>Student</b>${esc(t.student.studentName ?? '—')}</div>
    <div><b>Number</b>${esc(t.student.studentNumber ?? '—')}</div>
    <div><b>Published terms</b>${t.summary.termCount}</div>
    <div><b>Cumulative average</b>${
      t.summary.cumulativeAverage === null
        ? '—'
        : `${t.summary.cumulativeAverage}%`
    }</div>
  </div>
  ${termBlocks}
  <h2 style="font-size:14px;margin:24px 0 0">Subject summary</h2>
  <table>
    <thead><tr><th>Subject</th><th class="num">Terms</th><th class="num">Average</th><th class="num">Best</th><th class="num">Worst</th></tr></thead>
    <tbody>${subjectRows || '<tr><td colspan="5">No graded subjects</td></tr>'}</tbody>
  </table>
  <div class="footer">
    Assembled from published result snapshots only; each term above cites the publication version + snapshot checksum it was copied from. Absent or exempt subjects are shown as such and are excluded from every average — they are never counted as zero.
  </div>
</div></body></html>`;
}

export function renderBroadsheetHtml(
  meta: ArtifactCycleMeta,
  sectionLabel: string,
  students: ArtifactStudent[],
): string {
  // Union of subject labels across the section, in first-seen order.
  const subjectLabels: string[] = [];
  for (const st of students) {
    for (const s of st.subjects) {
      if (!subjectLabels.includes(s.subjectLabel))
        subjectLabels.push(s.subjectLabel);
    }
  }
  const head = `<tr><th>#</th><th>Student</th>${subjectLabels
    .map((l) => `<th class="num">${esc(l)}</th>`)
    .join('')}<th class="num">Avg</th><th>Grade</th></tr>`;
  const body = students
    .map((st, i) => {
      const byLabel = new Map(st.subjects.map((s) => [s.subjectLabel, s]));
      const cells = subjectLabels
        .map((l) => {
          const s = byLabel.get(l);
          if (!s) return '<td class="num">—</td>';
          if (s.percentage === null) {
            const allExempt = s.components.every((c) => c.isExempt);
            return `<td class="num">${allExempt ? 'EXM' : 'ABS'}</td>`;
          }
          return `<td class="num">${s.percentage}</td>`;
        })
        .join('');
      return `<tr><td>${st.position ?? i + 1}</td><td>${esc(
        st.studentName ?? st.studentNumber,
      )}</td>${cells}<td class="num">${
        st.average === null ? '—' : st.average
      }</td><td>${esc(st.overallGrade ?? '—')}</td></tr>`;
    })
    .join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>Broadsheet — ${esc(sectionLabel)}</title>
<style>${BASE_STYLE}</style></head>
<body><div class="doc">
  <h1>${esc(meta.schoolName)}</h1>
  <div class="muted">Broadsheet · ${esc(sectionLabel)} · ${esc(meta.cycleName)} · ${esc(
    meta.academicYearName,
  )}${meta.termName ? ` · ${esc(meta.termName)}` : ''} · v${meta.version}</div>
  <table>
    <thead>${head}</thead>
    <tbody>${body || '<tr><td colspan="99">No students</td></tr>'}</tbody>
  </table>
  <div class="footer">Published ${esc(meta.publishedAt)}. Immutable snapshot.</div>
</div></body></html>`;
}
