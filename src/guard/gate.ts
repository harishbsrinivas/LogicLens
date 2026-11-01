// RequestGate: the single path to a provider (ADR-0014, ADR-0024, ADR-0020; arch §5.2, §8).
// Checks run in order and fail closed. No vscode imports so every refusal is unit tested.
import type { CancelToken, Provider, ProviderRequest, StreamChunk } from '../providers/types';
import type { Logger } from '../util/log';
import type { PathInfo } from './exclude';
import { ensureNotice } from './notice';
import type { KeyValueStore, Prompter } from './prompter';
import { scan, WITHHELD_MARKER } from './secretScan';
import { looksGenerated, sizeProblem } from './size';
import { ensureTerms } from './terms';

export type SecretsAction = 'skip-lines' | 'refuse-file';

/** Above this share of non-blank target lines withheld, the file is refused (spec §8). */
export const WITHHELD_REFUSE_RATIO = 0.25;

export interface GateTarget extends PathInfo {
  fileName: string;
  languageId: string;
  lines: readonly string[];
  byteLength: number;
  /** 1-based number of `lines[0]` in the document, when the target is a window (questions). */
  firstLine?: number;
}

export interface PreparedTarget {
  /** Target lines with flagged ones replaced by the withheld marker. */
  lines: string[];
  /** 1-based document line numbers withheld. */
  withheld: number[];
}

export interface GateRequest {
  target: GateTarget;
  /** One-request override, from "Skip those lines instead". */
  secretsAction?: SecretsAction;
  build(prepared: PreparedTarget): ProviderRequest;
}

export type RefusalReason =
  | 'terms'
  | 'untrusted'
  | 'excluded'
  | 'too-large'
  | 'provider-unavailable'
  | 'secrets'
  | 'secrets-file'
  | 'cancelled';

export type GateOutcome =
  | {
      kind: 'sent';
      providerLabel: string;
      model: string;
      withheld: number[];
      stream: AsyncIterable<StreamChunk>;
    }
  | { kind: 'refused'; reason: RefusalReason; message: string; lines?: number[] };

export interface GateDeps {
  state: KeyValueStore;
  prompter: Prompter;
  isTrusted(): boolean;
  isExcluded(path: PathInfo): boolean | PromiseLike<boolean>;
  settings(): { maxLines: number; secretsAction: SecretsAction };
  provider(): Provider;
  log: Logger;
}

export class RequestGate {
  constructor(private readonly deps: GateDeps) {}

  async send(req: GateRequest, token: CancelToken): Promise<GateOutcome> {
    const { deps } = this;
    const { target } = req;
    const refuse = (reason: RefusalReason, message: string, lines?: number[]): GateOutcome => {
      deps.log.info(`gate: refused (${reason})${lines ? ` lines ${lines.join(',')}` : ''}`);
      return { kind: 'refused', reason, message, lines };
    };

    if (!(await ensureTerms(deps.state, deps.prompter))) {
      return refuse('terms', 'Accept the LogicLens terms of use to continue.');
    }
    if (!deps.isTrusted()) {
      return refuse(
        'untrusted',
        'LogicLens does not send code from a restricted workspace. Trust this workspace to use it.',
      );
    }
    if (await deps.isExcluded(target)) {
      return refuse('excluded', `${target.fileName} is excluded by LogicLens settings.`);
    }
    const settings = deps.settings();
    const tooLarge = sizeProblem(target.lines, target.byteLength, settings.maxLines);
    if (tooLarge) {
      return refuse('too-large', tooLarge);
    }
    if (
      looksGenerated(target.lines) &&
      !(await deps.prompter.confirm(
        `${target.fileName} looks minified or generated. Explanations of generated code are rarely useful. Send it anyway?`,
        'Send',
      ))
    ) {
      return refuse('cancelled', 'Cancelled.');
    }

    const provider = deps.provider();
    const state = await provider.detect();
    if (state.kind !== 'ready') {
      return refuse('provider-unavailable', state.reason);
    }
    const model = state.models[0];
    if (!model) {
      return refuse('provider-unavailable', 'No model is available.');
    }
    if (!(await ensureNotice(deps.state, deps.prompter, provider))) {
      return refuse('cancelled', 'Cancelled.');
    }

    // Secret scan (ADR-0020): withhold or refuse; there is no send-anyway.
    const firstLine = target.firstLine ?? 1;
    const { flagged } = scan(target.lines, firstLine);
    const withheld = [...new Set(flagged.map((f) => f.line))];
    if (withheld.length > 0) {
      deps.log.info(
        `gate: secret scan flagged ${flagged.map((f) => `L${f.line} ${f.pattern}`).join(', ')}`,
      );
      const nonBlank = target.lines.filter((l) => l.trim() !== '').length;
      if (withheld.length > nonBlank * WITHHELD_REFUSE_RATIO) {
        return refuse(
          'secrets-file',
          `${target.fileName} looks like a secrets file (${withheld.length} lines with possible secrets). Nothing was sent.`,
          withheld,
        );
      }
      if ((req.secretsAction ?? settings.secretsAction) === 'refuse-file') {
        return refuse(
          'secrets',
          `Possible secrets on ${withheld.map((l) => `L${l}`).join(', ')}. Nothing was sent.`,
          withheld,
        );
      }
    }
    const withheldSet = new Set(withheld);
    const prepared: PreparedTarget = {
      lines: target.lines.map((l, i) => (withheldSet.has(i + firstLine) ? WITHHELD_MARKER : l)),
      withheld,
    };

    const request = { ...req.build(prepared), model: model.id };
    // Scan the exact outgoing text as well, so nothing added by prompt building slips through.
    const outgoing = [request.system, ...request.messages.map((m) => m.text)].join('\n');
    if (scan(outgoing.split('\n')).flagged.length > 0) {
      return refuse('secrets', 'The request still contained a possible secret. Nothing was sent.');
    }
    if (token.isCancellationRequested) {
      return refuse('cancelled', 'Cancelled.');
    }

    deps.log.info(
      `gate: sending ${target.languageId} file (${target.lines.length} lines, ${withheld.length} withheld) to ${provider.id}/${model.id}`,
    );
    deps.log.debugContent('request', outgoing);
    return {
      kind: 'sent',
      providerLabel: provider.label,
      model: model.label,
      withheld,
      stream: provider.stream(request, token),
    };
  }
}
