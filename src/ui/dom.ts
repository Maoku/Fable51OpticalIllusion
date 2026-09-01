export interface ElProps {
  className?: string;
  text?: string;
  html?: string;
  attrs?: Record<string, string>;
  onClick?: (e: MouseEvent) => void;
}

/** 小さな DOM ヘルパー */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElProps = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props.className) el.className = props.className;
  if (props.text !== undefined) el.textContent = props.text;
  if (props.html !== undefined) el.innerHTML = props.html;
  if (props.attrs) for (const [k, v] of Object.entries(props.attrs)) el.setAttribute(k, v);
  if (props.onClick) (el as HTMLElement).addEventListener('click', props.onClick);
  for (const c of children) el.append(c);
  return el;
}

export function uiRoot(): HTMLElement {
  let root = document.getElementById('ui');
  if (!root) {
    root = h('div', { attrs: { id: 'ui' } });
    document.body.appendChild(root);
  }
  return root;
}
