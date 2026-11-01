// Settings page script (spec §16, ADR-0031). Runs in the webview. Builds the form with DOM
// APIs and textContent only (no innerHTML), and posts each change to the extension, which
// validates it before writing. Loaded from the extension's files under a nonce CSP.

interface Option {
  value: string;
  label: string;
}

interface Setting {
  key: string;
  section: string;
  label: string;
  type: 'boolean' | 'number' | 'string' | 'enum' | 'string[]';
  scope: string;
  options?: Option[];
  min?: number;
  help: string;
  value: unknown;
  isDefault: boolean;
  workspaceValue?: unknown;
}

interface ProviderInfo {
  id: string;
  label: string;
  state: string;
  ready: boolean;
  reason: string;
  models: { id: string; label: string }[];
}

interface PageState {
  sections: { id: string; title: string }[];
  settings: Setting[];
  providers: ProviderInfo[];
}

declare function acquireVsCodeApi(): { postMessage(message: unknown): void };

const vscode = acquireVsCodeApi();
const app = document.getElementById('app');
const errors = new Map<string, string>();
let current: PageState | undefined;

window.addEventListener('message', (event: MessageEvent<unknown>) => {
  const msg = event.data as { type?: unknown; state?: PageState; key?: unknown; message?: unknown };
  if (msg.type === 'state' && msg.state) {
    current = msg.state;
    render(msg.state);
  } else if (
    msg.type === 'error' &&
    typeof msg.key === 'string' &&
    typeof msg.message === 'string'
  ) {
    errors.set(msg.key, msg.message);
    if (current) {
      render(current);
    }
  }
});
vscode.postMessage({ type: 'ready' });

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: { className?: string; text?: string; id?: string } = {},
  ...children: (Node | undefined)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.className) {
    node.className = props.className;
  }
  if (props.text !== undefined) {
    node.textContent = props.text;
  }
  if (props.id) {
    node.id = props.id;
  }
  for (const child of children) {
    if (child) {
      node.appendChild(child);
    }
  }
  return node;
}

function set(key: string, value: unknown): void {
  errors.delete(key);
  vscode.postMessage({ type: 'set', key, value });
}

function button(text: string, action: string, secondary = true): HTMLButtonElement {
  const b = el('button', { text, className: secondary ? 'secondary' : '' });
  b.type = 'button';
  b.addEventListener('click', () => vscode.postMessage({ type: 'action', name: action }));
  return b;
}

function render(state: PageState): void {
  if (!app) {
    return;
  }
  // Keep keyboard focus on the same control across re-renders.
  const focused = document.activeElement instanceof HTMLElement ? document.activeElement.id : '';
  const header = el(
    'header',
    {},
    el('h1', { text: 'LogicLens Settings' }),
    el('p', {
      className: 'help',
      text: 'Changes are saved to your user settings at once. Workspace settings, where allowed, still apply on top.',
    }),
    button('Open settings.json', 'openSettingsJson'),
  );
  const nav = el('nav', { className: 'toc' });
  nav.setAttribute('aria-label', 'Sections');
  const list = el('ul');
  for (const s of state.sections) {
    const link = el('a', { text: s.title });
    link.href = `#section-${s.id}`;
    list.appendChild(el('li', {}, link));
  }
  nav.appendChild(list);

  const sections = state.sections.map((section) => {
    const node = el('section', { id: `section-${section.id}` });
    node.setAttribute('aria-labelledby', `heading-${section.id}`);
    node.appendChild(el('h2', { text: section.title, id: `heading-${section.id}` }));
    if (section.id === 'provider') {
      node.appendChild(providerStatus(state.providers));
    }
    for (const setting of state.settings.filter((s) => s.section === section.id)) {
      node.appendChild(control(setting, state));
    }
    const actions = sectionActions(section.id);
    if (actions) {
      node.appendChild(actions);
    }
    return node;
  });

  app.replaceChildren(header, nav, ...sections);
  if (focused) {
    document.getElementById(focused)?.focus();
  }
}

function providerStatus(providers: ProviderInfo[]): HTMLElement {
  const table = el('ul', { className: 'providers' });
  table.setAttribute('aria-label', 'Provider status');
  for (const p of providers) {
    table.appendChild(
      el(
        'li',
        {},
        el('span', { text: p.label, className: 'provider-name' }),
        el('span', { text: p.state, className: p.ready ? 'badge ready' : 'badge' }),
        p.reason ? el('span', { text: p.reason, className: 'help' }) : undefined,
      ),
    );
  }
  return el(
    'div',
    {},
    table,
    el('div', { className: 'actions' }, button('Choose with the picker…', 'selectProvider')),
  );
}

function sectionActions(section: string): HTMLElement | undefined {
  switch (section) {
    case 'privacy':
      return el(
        'div',
        { className: 'actions' },
        button('Reset data notices', 'resetDataNotices'),
        button('View terms of use', 'viewTerms'),
      );
    case 'cache':
      return el('div', { className: 'actions' }, button('Clear cache', 'clearCache'));
    case 'debug':
      return el('div', { className: 'actions' }, button('Show log', 'showLog'));
    default:
      return undefined;
  }
}

function control(setting: Setting, state: PageState): HTMLElement {
  const id = `setting-${setting.key.replace(/\./g, '-')}`;
  const row = el('div', { className: 'setting' });
  const label = el('label', { text: setting.label });
  label.htmlFor = id;
  const help = setting.help
    ? el('p', { className: 'help', text: setting.help, id: `${id}-help` })
    : undefined;
  let input: HTMLElement;

  switch (setting.type) {
    case 'boolean': {
      const box = el('input', { id });
      box.type = 'checkbox';
      box.checked = setting.value === true;
      box.addEventListener('change', () => set(setting.key, box.checked));
      row.classList.add('checkbox');
      row.append(box, label);
      input = box;
      break;
    }
    case 'enum': {
      const select = el('select', { id });
      for (const o of setting.options ?? []) {
        const option = el('option', { text: o.label });
        option.value = o.value;
        option.selected = o.value === setting.value;
        select.appendChild(option);
      }
      select.addEventListener('change', () => set(setting.key, select.value));
      row.append(label, select);
      input = select;
      break;
    }
    case 'number': {
      const box = el('input', { id });
      box.type = 'number';
      box.min = String(setting.min ?? 0);
      box.step = '1';
      box.value = String(setting.value ?? '');
      box.addEventListener('change', () => set(setting.key, Number(box.value)));
      row.append(label, box);
      input = box;
      break;
    }
    case 'string[]': {
      const area = el('textarea', { id });
      area.rows = 6;
      area.value = Array.isArray(setting.value) ? setting.value.join('\n') : '';
      area.addEventListener('change', () => set(setting.key, area.value.split('\n')));
      row.append(label, area);
      input = area;
      break;
    }
    default: {
      if (setting.key === 'model') {
        const select = modelSelect(id, setting, state);
        if (select) {
          row.append(label, select);
          input = select;
          break;
        }
      }
      const box = el('input', { id });
      box.type = 'text';
      box.value = typeof setting.value === 'string' ? setting.value : '';
      box.spellcheck = false;
      box.addEventListener('change', () => set(setting.key, box.value));
      row.append(label, box);
      input = box;
    }
  }
  if (help) {
    input.setAttribute('aria-describedby', help.id);
    row.appendChild(help);
  }
  if (setting.workspaceValue !== undefined) {
    row.appendChild(
      el('p', {
        className: 'note',
        text:
          setting.key === 'exclude'
            ? `This workspace adds: ${Array.isArray(setting.workspaceValue) ? setting.workspaceValue.join(', ') : ''}`
            : `This workspace sets ${String(setting.workspaceValue)}, which applies here instead.`,
      }),
    );
  }
  if (!setting.isDefault) {
    const reset = el('button', { text: 'Reset', className: 'link' });
    reset.type = 'button';
    reset.setAttribute('aria-label', `Reset ${setting.label} to its default`);
    reset.addEventListener('click', () => vscode.postMessage({ type: 'reset', key: setting.key }));
    row.appendChild(reset);
  }
  const error = errors.get(setting.key);
  if (error) {
    const alert = el('p', { className: 'error', text: error });
    alert.setAttribute('role', 'alert');
    row.appendChild(alert);
  }
  return row;
}

/** Models of the chosen provider (or the first ready one for auto), with Default first. */
function modelSelect(
  id: string,
  setting: Setting,
  state: PageState,
): HTMLSelectElement | undefined {
  const chosen = state.settings.find((s) => s.key === 'provider')?.value;
  const provider =
    chosen === 'auto' || chosen === undefined
      ? state.providers.find((p) => p.ready)
      : state.providers.find((p) => p.id === chosen);
  if (!provider || provider.models.length === 0) {
    return undefined;
  }
  const select = el('select', { id });
  const options = [{ id: '', label: "Provider's default" }, ...provider.models];
  if (
    typeof setting.value === 'string' &&
    setting.value &&
    !options.some((m) => m.id === setting.value)
  ) {
    options.push({ id: setting.value, label: `${setting.value} (not available)` });
  }
  for (const m of options) {
    const option = el('option', { text: m.label });
    option.value = m.id;
    option.selected = m.id === (setting.value ?? '');
    select.appendChild(option);
  }
  select.addEventListener('change', () => set(setting.key, select.value));
  return select;
}
