// Incremental parser for the line-tagged walkthrough protocol (arch §5.5–5.6, ADR-0007). Pure:
// no VS Code imports. Text that cannot start a tag streams out at once; a line that may be a
// tag is held until it ends.
import type { LineRange } from '../state/types';

export type ProtocolEvent =
  | { type: 'overviewDelta'; text: string }
  | { type: 'stepStart'; index: number; ranges: LineRange[]; title: string }
  | { type: 'stepDelta'; index: number; text: string }
  | { type: 'concepts'; index: number; concepts: string[] }
  | { type: 'summaryDelta'; text: string }
  | { type: 'watchDelta'; text: string }
  | { type: 'end' };

type Section = 'preamble' | 'overview' | 'step' | 'summary' | 'watch' | 'ignored' | 'ended';

export class ProtocolParser {
  private buffer = '';
  /** The current line already streamed out as text, so it cannot be a tag. */
  private lineIsText = false;
  private section: Section;
  private preamble = '';
  private steps = 0;
  private tags = 0;
  private events: ProtocolEvent[] = [];

  /**
   * `continuation`: parsing the rest of an earlier response (Continue). Text before the first
   * tag is dropped instead of becoming the overview, and step indexes start at 0 again.
   */
  constructor(mode: 'response' | 'continuation' = 'response') {
    this.section = mode === 'response' ? 'preamble' : 'ignored';
  }

  /** True once any known tag was seen; without one the response is shown as plain Markdown. */
  get structured(): boolean {
    return this.tags > 0;
  }

  get ended(): boolean {
    return this.section === 'ended';
  }

  get stepCount(): number {
    return this.steps;
  }

  push(chunk: string): ProtocolEvent[] {
    this.buffer += chunk;
    for (;;) {
      const nl = this.buffer.indexOf('\n');
      if (nl === -1) {
        this.streamPartial();
        break;
      }
      const line = this.buffer.slice(0, nl).replace(/\r$/, '');
      this.buffer = this.buffer.slice(nl + 1);
      if (this.lineIsText) {
        this.text(`${line}\n`);
        this.lineIsText = false;
      } else {
        this.line(line);
      }
    }
    return this.take();
  }

  /** Flushes a final line without a newline. Call once at the end of the stream. */
  finish(): ProtocolEvent[] {
    const rest = this.buffer.replace(/\r$/, '');
    this.buffer = '';
    if (this.lineIsText) {
      this.text(rest);
    } else if (rest) {
      this.line(rest);
    }
    this.lineIsText = false;
    return this.take();
  }

  private streamPartial(): void {
    const b = this.buffer;
    if (!this.lineIsText && (b === '' || b === '@' || b.startsWith('@@'))) {
      return;
    }
    // Hold a trailing \r: it may be the first half of \r\n.
    const out = b.endsWith('\r') ? b.slice(0, -1) : b;
    this.lineIsText = true;
    this.text(out);
    this.buffer = b.slice(out.length);
  }

  private line(line: string): void {
    if (line.startsWith('@@')) {
      this.tag(line.slice(2));
    } else {
      this.text(`${line}\n`);
    }
  }

  private tag(body: string): void {
    const name = /^[a-z]+/i.exec(body)?.[0].toLowerCase() ?? '';
    const rest = body.slice(name.length);
    const known = ['overview', 'step', 'concepts', 'summary', 'watch', 'end'].includes(name);
    if (known && this.section === 'preamble') {
      // Text before the first tag is the overview only when no @@overview follows (arch §5.5).
      if (name !== 'overview' && this.preamble.trim()) {
        this.events.push({ type: 'overviewDelta', text: this.preamble });
      }
      this.preamble = '';
    }
    if (this.section === 'ended') {
      return;
    }
    if (known) {
      this.tags++;
    }
    switch (name) {
      case 'overview':
      case 'summary':
      case 'watch':
        this.section = name;
        return;
      case 'step': {
        const parts = rest.split('|');
        const title = cleanTitle(parts.slice(2).join('|'));
        this.events.push({
          type: 'stepStart',
          index: this.steps,
          ranges: parseRanges(parts[1] ?? ''),
          title,
        });
        this.steps++;
        this.section = 'step';
        return;
      }
      case 'concepts':
        if (this.section === 'step' && this.steps > 0) {
          const concepts = rest
            .split(/[;,]/)
            .map((c) => c.trim())
            .filter(Boolean);
          this.events.push({ type: 'concepts', index: this.steps - 1, concepts });
        }
        return;
      case 'end':
        this.section = 'ended';
        this.events.push({ type: 'end' });
        return;
      default:
        this.section = 'ignored';
    }
  }

  private text(text: string): void {
    if (!text) {
      return;
    }
    switch (this.section) {
      case 'preamble':
        this.preamble += text;
        return;
      case 'overview':
        this.events.push({ type: 'overviewDelta', text });
        return;
      case 'step':
        this.events.push({ type: 'stepDelta', index: this.steps - 1, text });
        return;
      case 'summary':
        this.events.push({ type: 'summaryDelta', text });
        return;
      case 'watch':
        this.events.push({ type: 'watchDelta', text });
        return;
      default:
        return;
    }
  }

  private take(): ProtocolEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }
}

/** Parses `L12-L20,L31` (also `12-20`, en dashes, spaces). Unparseable parts are skipped. */
export function parseRanges(text: string): LineRange[] {
  const ranges: LineRange[] = [];
  for (const part of text.split(',')) {
    const m = /^\s*L?(\d+)\s*(?:[-–—]\s*L?(\d+))?\s*$/i.exec(part);
    if (!m?.[1]) {
      continue;
    }
    const a = Number(m[1]);
    const b = m[2] === undefined ? a : Number(m[2]);
    if (a >= 1 && b >= 1) {
      ranges.push({ start: Math.min(a, b), end: Math.max(a, b) });
    }
  }
  return ranges;
}

// Titles show in CodeLens, where `$(name)` renders an icon; model text never picks icons.
function cleanTitle(title: string): string {
  return title.replace(/\$\(/g, '(').trim();
}
