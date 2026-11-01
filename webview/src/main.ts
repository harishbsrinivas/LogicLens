import type { HostToWebviewMessage } from '../../shared/messages';

// Empty panel shell (plan S0). Replaced by the Svelte app later in S1 (ADR-0009).
window.addEventListener('message', (event: MessageEvent<HostToWebviewMessage>) => {
  const root = document.getElementById('root');
  if (root && event.data.type === 'state') {
    root.textContent = event.data.state.kind;
  }
});
