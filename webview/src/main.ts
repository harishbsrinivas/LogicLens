import type { HostToWebviewMessage } from '../../shared/messages';

// Empty panel shell (plan S0). The real UI arrives in S1 (ADR-0009).
window.addEventListener('message', (event: MessageEvent<HostToWebviewMessage>) => {
  const root = document.getElementById('root');
  if (root && event.data.type === 'hello') {
    root.textContent = event.data.text;
  }
});
