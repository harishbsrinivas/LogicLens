// Evaluation runner (spec §10, arch §9). Measures recorded responses against the corpus with
// the same parser and anchoring as the extension: parse rate, anchor rate, coverage.
//
//   pnpm eval [provider] [--min-parse 0.9] [--min-anchor 0.85]
//
// Responses live in test/eval/responses/<provider>/<corpus file name>.txt (see README.md).
import * as fs from 'node:fs';
import * as path from 'node:path';
import { anchorRanges, measure, type WalkthroughMetrics } from '../../src/explain/anchor';
import { ProtocolParser } from '../../src/explain/protocol';

const root = path.resolve(__dirname, '../../test/eval');

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(name);
  const value = i === -1 ? NaN : Number(process.argv[i + 1]);
  return Number.isFinite(value) ? value : fallback;
}

export function evaluate(response: string, source: string): WalkthroughMetrics {
  const lines = source.split(/\r?\n/);
  const parser = new ProtocolParser();
  const events = [...parser.push(response), ...parser.finish()];
  const target = { start: 1, end: lines.length };
  const steps = events.flatMap((e) =>
    e.type === 'stepStart' ? [anchorRanges(e.ranges, target)] : [],
  );
  return measure({ parsed: parser.structured, complete: parser.ended, steps }, lines);
}

function main(): void {
  const provider = process.argv
    .slice(2)
    .find((a, i, all) => !a.startsWith('--') && !all[i - 1]?.startsWith('--'));
  const providers = provider
    ? [provider]
    : fs.existsSync(path.join(root, 'responses'))
      ? fs
          .readdirSync(path.join(root, 'responses'), { withFileTypes: true })
          .filter((d) => d.isDirectory())
          .map((d) => d.name)
      : [];
  if (providers.length === 0) {
    console.log('No recorded responses. See test/eval/README.md.');
    return;
  }
  const minParse = arg('--min-parse', 0.9);
  const minAnchor = arg('--min-anchor', 0.85);
  const corpus = fs.readdirSync(path.join(root, 'corpus')).sort();
  let failed = false;

  for (const name of providers) {
    const rows: { file: string; m: WalkthroughMetrics }[] = [];
    for (const file of corpus) {
      const responsePath = path.join(root, 'responses', name, `${file}.txt`);
      if (!fs.existsSync(responsePath)) {
        continue;
      }
      const source = fs.readFileSync(path.join(root, 'corpus', file), 'utf8');
      rows.push({ file, m: evaluate(fs.readFileSync(responsePath, 'utf8'), source) });
    }
    console.log(`\n${name}: ${rows.length} of ${corpus.length} corpus files have responses`);
    for (const { file, m } of rows) {
      console.log(
        `  ${file.padEnd(22)} parsed ${m.parsed ? 'yes' : 'no '}  complete ${m.complete ? 'yes' : 'no '}  steps ${String(m.steps).padStart(2)}  anchor ${pct(m.anchorRate)}  coverage ${pct(m.coverage)}`,
      );
    }
    if (rows.length === 0) {
      continue;
    }
    const parseRate = rows.filter((r) => r.m.parsed && r.m.complete).length / rows.length;
    const steps = rows.reduce((n, r) => n + r.m.steps, 0);
    const anchored = rows.reduce((n, r) => n + r.m.anchorRate * r.m.steps, 0);
    const anchorRate = steps ? anchored / steps : 0;
    const coverage = rows.reduce((n, r) => n + r.m.coverage, 0) / rows.length;
    console.log(
      `  overall: parse ${pct(parseRate)} (min ${pct(minParse)})  anchor ${pct(anchorRate)} (min ${pct(minAnchor)})  coverage ${pct(coverage)}`,
    );
    if (parseRate < minParse || anchorRate < minAnchor) {
      failed = true;
    }
  }
  process.exitCode = failed ? 1 : 0;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(0).padStart(3)}%`;
}

if (require.main === module) {
  main();
}
