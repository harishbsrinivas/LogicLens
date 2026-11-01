<script lang="ts">
  import type { HostToWebviewMessage, PanelState } from '../../shared/messages';
  import { renderMarkdown } from './markdown';
  import { send } from './vscode';

  let panel = $state<PanelState | null>(null);
  let announcement = $state('');

  const walkthrough = $derived(panel?.kind === 'walkthrough' ? panel.walkthrough : null);
  const html = $derived(walkthrough ? renderMarkdown(walkthrough.fallbackMarkdown ?? '') : '');

  function onMessage(event: MessageEvent<HostToWebviewMessage>): void {
    const msg = event.data;
    if (msg.type === 'state') {
      const before = walkthrough;
      panel = msg.state;
      const after = msg.state.kind === 'walkthrough' ? msg.state.walkthrough : null;
      if (
        before?.status === 'streaming' &&
        after?.id === before.id &&
        after.status !== 'streaming'
      ) {
        announcement =
          after.status === 'done' ? 'Explanation finished.' : `Explanation ${after.status}.`;
      }
    } else if (msg.type === 'markdownDelta' && walkthrough && walkthrough.id === msg.wid) {
      walkthrough.fallbackMarkdown = (walkthrough.fallbackMarkdown ?? '') + msg.text;
    }
  }

  // Links in model output open through the host, which re-checks the scheme.
  function onContentClick(event: MouseEvent): void {
    const anchor = (event.target as Element | null)?.closest('a');
    if (!anchor) {
      return;
    }
    event.preventDefault();
    const href = anchor.getAttribute('href');
    if (href) {
      send({ type: 'openLink', href });
    }
  }

  function seconds(ms: number | null): string {
    return ms === null ? '' : `${(ms / 1000).toFixed(1)}s`;
  }

  function withheldLabel(lines: number[]): string {
    const noun = lines.length === 1 ? 'line' : 'lines';
    const secret = lines.length === 1 ? 'possible secret' : 'possible secrets';
    return `${lines.length} ${noun} withheld: ${secret} on`;
  }

  $effect(() => {
    window.addEventListener('message', onMessage);
    send({ type: 'ready' });
    return () => window.removeEventListener('message', onMessage);
  });
</script>

<main>
  {#if panel === null}
    <p class="muted">Loading…</p>
  {:else if panel.kind === 'noEditor'}
    <section class="empty">
      <p>Open a file to explain it.</p>
    </section>
  {:else if panel.kind === 'excluded'}
    <section class="empty">
      <h2 class="file">{panel.fileName}</h2>
      <p>Excluded by LogicLens settings. Nothing from this file is sent.</p>
    </section>
  {:else if panel.kind === 'empty'}
    <section class="empty">
      <h2 class="file">{panel.fileName}</h2>
      {#if !panel.termsAccepted}
        <p>Accept the LogicLens terms of use to continue.</p>
        <div class="actions">
          <button onclick={() => send({ type: 'explain' })}>Explain this file</button>
          <button class="secondary" onclick={() => send({ type: 'viewTerms' })}>Review Terms</button
          >
        </div>
      {:else}
        <p>Get a plain-language explanation of this file.</p>
        <div class="actions">
          <button onclick={() => send({ type: 'explain' })}>Explain this file</button>
        </div>
      {/if}
      <p class="muted">Provider: VS Code Language Models</p>
    </section>
  {:else if walkthrough}
    <header>
      <h2 class="file">{walkthrough.fileName}</h2>
      {#if walkthrough.status === 'streaming'}
        <button class="secondary" onclick={() => send({ type: 'stop' })}>Stop</button>
      {:else}
        <button class="secondary" onclick={() => send({ type: 'explain' })}>Explain again</button>
      {/if}
    </header>
    {#if walkthrough.status === 'streaming'}
      <div class="progress" role="progressbar" aria-label="Explaining"></div>
    {/if}

    {#if walkthrough.withheld.length > 0}
      <p class="notice" role="note">
        {withheldLabel(walkthrough.withheld)}
        {#each walkthrough.withheld as line, i (line)}
          {i > 0 ? ', ' : ' '}<button
            class="link"
            onclick={() => send({ type: 'revealLine', line })}>L{line}</button
          >
        {/each}
      </p>
    {/if}

    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
    <article class="content" onclick={onContentClick}>
      {@html html}
    </article>

    {#if walkthrough.status === 'stopped'}
      <p class="notice">Stopped. The explanation above is partial.</p>
    {:else if walkthrough.status === 'failed'}
      <p class="error" role="alert">{walkthrough.error}</p>
    {/if}

    <footer class="muted">
      {walkthrough.providerLabel} · {walkthrough.model}{walkthrough.durationMs !== null
        ? ` · ${seconds(walkthrough.durationMs)}`
        : ''}
    </footer>
  {/if}
  <div class="sr-only" aria-live="polite">{announcement}</div>
</main>
