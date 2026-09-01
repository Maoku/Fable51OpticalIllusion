import { h, uiRoot } from './dom';

/** 起動時のローディング画面 */
export class LoadingScreen {
  private readonly el: HTMLElement;
  private readonly bar: HTMLElement;
  private readonly status: HTMLElement;

  constructor() {
    this.bar = h('div', { className: 'loading__bar' });
    this.status = h('p', { className: 'loading__status', text: '準備しています…' });
    this.el = h('div', { className: 'loading', attrs: { role: 'status', 'aria-live': 'polite' } }, [
      h('div', { className: 'loading__inner' }, [
        h('p', { className: 'loading__eyebrow', text: 'Optical Illusion Museum' }),
        h('h1', { className: 'loading__title', text: '錯視の美術館' }),
        h('div', { className: 'loading__track' }, [this.bar]),
        this.status,
      ]),
    ]);
    uiRoot().appendChild(this.el);
  }

  setProgress(ratio: number, label?: string): void {
    this.bar.style.width = `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
    if (label) this.status.textContent = label;
  }

  async hide(): Promise<void> {
    this.setProgress(1, '完了');
    this.el.classList.add('is-hidden');
    await new Promise((r) => setTimeout(r, 450));
    this.el.remove();
  }
}
