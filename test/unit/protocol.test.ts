import { describe, expect, it } from 'vitest';
import { parseRanges, ProtocolParser, type ProtocolEvent } from '../../src/explain/protocol';

const SAMPLE = [
  '@@overview',
  'Loads config and serves requests.',
  '@@step 1 | L1-L4,L9 | Load configuration',
  'Reads `config.json`.',
  '@@concepts environment variables; default parameters',
  '@@step 2 | L5-L8 | Start the server',
  'Listens on the port.',
  '@@summary',
  '- takeaway',
  '@@watch',
  '- risk',
  '@@end',
  '',
].join('\n');

/** Folds events into a readable shape so tests compare results, not chunking. */
function fold(events: ProtocolEvent[]) {
  const out = {
    overview: '',
    steps: [] as { title: string; ranges: string; text: string; concepts: string[] }[],
    summary: '',
    watch: '',
    end: false,
  };
  for (const e of events) {
    switch (e.type) {
      case 'overviewDelta':
        out.overview += e.text;
        break;
      case 'stepStart':
        out.steps[e.index] = {
          title: e.title,
          ranges: e.ranges.map((r) => `${r.start}-${r.end}`).join(','),
          text: '',
          concepts: [],
        };
        break;
      case 'stepDelta': {
        const step = out.steps[e.index];
        if (step) step.text += e.text;
        break;
      }
      case 'concepts': {
        const step = out.steps[e.index];
        if (step) step.concepts = e.concepts;
        break;
      }
      case 'summaryDelta':
        out.summary += e.text;
        break;
      case 'watchDelta':
        out.watch += e.text;
        break;
      case 'end':
        out.end = true;
        break;
    }
  }
  return out;
}

function parse(chunks: string[]) {
  const p = new ProtocolParser();
  const events = chunks.flatMap((c) => p.push(c));
  events.push(...p.finish());
  return { p, result: fold(events), events };
}

const EXPECTED = {
  overview: 'Loads config and serves requests.\n',
  steps: [
    {
      title: 'Load configuration',
      ranges: '1-4,9-9',
      text: 'Reads `config.json`.\n',
      concepts: ['environment variables', 'default parameters'],
    },
    { title: 'Start the server', ranges: '5-8', text: 'Listens on the port.\n', concepts: [] },
  ],
  summary: '- takeaway\n',
  watch: '- risk\n',
  end: true,
};

describe('protocol parser', () => {
  it('parses a complete response', () => {
    const { p, result } = parse([SAMPLE]);
    expect(result).toEqual(EXPECTED);
    expect(p.structured).toBe(true);
    expect(p.ended).toBe(true);
    expect(p.stepCount).toBe(2);
  });

  it('gives the same result for every split point, including mid-tag', () => {
    for (let i = 1; i < SAMPLE.length; i++) {
      expect(parse([SAMPLE.slice(0, i), SAMPLE.slice(i)]).result).toEqual(EXPECTED);
    }
  });

  it('gives the same result one character at a time', () => {
    expect(parse([...SAMPLE]).result).toEqual(EXPECTED);
  });

  it('streams body text before the line ends', () => {
    const p = new ProtocolParser();
    p.push('@@step 1 | L1 | A\nReads con');
    expect(p.push('fig')).toEqual([{ type: 'stepDelta', index: 0, text: 'fig' }]);
  });

  it('holds a partial line that could still be a tag', () => {
    const p = new ProtocolParser();
    p.push('@@overview\nText\n');
    expect(p.push('@')).toEqual([]);
    expect(p.push('@st')).toEqual([]);
    expect(p.push('ep 1 | L2 | B\n')).toEqual([
      { type: 'stepStart', index: 0, ranges: [{ start: 2, end: 2 }], title: 'B' },
    ]);
  });

  it('handles Windows line endings, including \\r\\n split across chunks', () => {
    const crlf = SAMPLE.replace(/\n/g, '\r\n');
    expect(parse([crlf]).result).toEqual(EXPECTED);
    for (let i = 1; i < crlf.length; i += 7) {
      expect(parse([crlf.slice(0, i), crlf.slice(i)]).result).toEqual(EXPECTED);
    }
  });

  it('treats text before the first tag as the overview when @@overview is missing', () => {
    const { result } = parse(['Intro paragraph.\n@@step 1 | L1 | A\nBody\n@@end\n']);
    expect(result.overview).toBe('Intro paragraph.\n');
    expect(result.steps).toHaveLength(1);
  });

  it('drops a preamble when @@overview follows', () => {
    const { result } = parse(["Here's the walkthrough:\n```\n@@overview\nReal.\n@@end\n"]);
    expect(result.overview).toBe('Real.\n');
  });

  it('reports a missing @@end as not ended', () => {
    const { p, result } = parse(['@@overview\nA\n@@step 1 | L1 | B\nhalf']);
    expect(p.ended).toBe(false);
    expect(result.steps[0]?.text).toBe('half');
  });

  it('ignores unknown tags and their text', () => {
    const { result } = parse(['@@overview\nA\n@@mood\nhappy\n@@step 1 | L1 | B\nC\n@@end\n']);
    expect(result.overview).toBe('A\n');
    expect(result.steps[0]?.text).toBe('C\n');
  });

  it('ignores everything after @@end', () => {
    const { result } = parse(['@@overview\nA\n@@end\n@@step 1 | L1 | B\nC\n']);
    expect(result.steps).toEqual([]);
  });

  it('keeps steps with malformed ranges, with no ranges', () => {
    const { result } = parse(['@@step 1 | lines ten to twelve | A\nB\n']);
    expect(result.steps[0]).toMatchObject({ title: 'A', ranges: '' });
  });

  it('reports plain Markdown as unstructured', () => {
    const { p, events } = parse(['# Title\n\nJust prose.\n']);
    expect(p.structured).toBe(false);
    expect(events).toEqual([]);
  });

  it('keeps `|` inside titles and neutralizes icon syntax', () => {
    const { result } = parse(['@@step 1 | L1 | a | b $(alert)\n']);
    expect(result.steps[0]?.title).toBe('a | b (alert)');
  });
});

describe('range parsing', () => {
  it.each([
    ['L12-L20', [{ start: 12, end: 20 }]],
    ['L12', [{ start: 12, end: 12 }]],
    ['12-20', [{ start: 12, end: 20 }]],
    [
      ' L12 – L20 , L31-L33 ',
      [
        { start: 12, end: 20 },
        { start: 31, end: 33 },
      ],
    ],
    ['L20-L12', [{ start: 12, end: 20 }]],
    ['L0-L3', []],
    ['lines 3 to 4', []],
    ['', []],
  ])('parses %j', (input, expected) => {
    expect(parseRanges(input)).toEqual(expected);
  });
});

describe('continuation parsing', () => {
  it('drops text before the first tag and restarts step indexes', () => {
    const p = new ProtocolParser('continuation');
    const events = [
      ...p.push('the rest of a sentence\n@@step 4 | L9 | D\nBody\n@@end\n'),
      ...p.finish(),
    ];
    const result = fold(events);
    expect(result.overview).toBe('');
    expect(result.steps).toEqual([{ title: 'D', ranges: '9-9', text: 'Body\n', concepts: [] }]);
    expect(p.ended).toBe(true);
  });
});
