import { bus } from '../app/events';
import { exhibitTexts } from '../content/exhibits.ja';
import { h, uiRoot } from './dom';

/** ヒントのテキストを表示するパネル。演出の進行度と同期する */
export class HintPanel {
  private readonly el: HTMLElement;
  private readonly body: HTMLElement;
  private readonly title: HTMLElement;
  private readonly look: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly bar: HTMLElement;
  private currentId: string | null = null;

  constructor() {
    this.title = h('h2', { className: 'panel__title hint-panel__title' });
    this.look = h('p', { className: 'hint-panel__look' });
    this.hint = h('p', { className: 'hint-panel__text' });
    this.bar = h('div', { className: 'hint-panel__bar' });
    // 本文だけをスクロールさせる。展示名と進行度のバーはスクロールしても残す
    this.body = h('div', { className: 'hint-panel__body' }, [
      h('h3', { className: 'hint-panel__sub', text: 'どう見えるか' }),
      this.look,
      h('h3', { className: 'hint-panel__sub', text: 'なぜそう見えるか' }),
      this.hint,
    ]);
    this.el = h(
      'aside',
      {
        className: 'hint-panel is-hidden',
        attrs: { 'data-testid': 'hint-panel', 'aria-live': 'polite' },
      },
      [
        h('div', { className: 'hint-panel__head' }, [
          h('div', { className: 'hint-panel__heading' }, [
            h('p', { className: 'panel__eyebrow', text: '種明かし' }),
            this.title,
          ]),
          h('button', {
            className: 'btn btn--icon hint-panel__close',
            text: '×',
            attrs: { type: 'button', 'aria-label': '閉じる', 'data-testid': 'hint-close' },
            onClick: () => {
              if (this.currentId) bus.emit('hint:toggle', { id: this.currentId });
            },
          }),
        ]),
        this.body,
        h('div', { className: 'hint-panel__track' }, [this.bar]),
      ],
    );
    uiRoot().appendChild(this.el);
    this.body.addEventListener('scroll', () => this.updateScrollHint());
    bus.on('app:resize', () => this.updateScrollHint());

    bus.on('hint:open', ({ id }) => this.show(id));
    bus.on('hint:progress', ({ id, t }) => {
      if (id === this.currentId) this.bar.style.width = `${Math.round(t * 100)}%`;
    });
    bus.on('hint:close', ({ id }) => {
      if (id === this.currentId) this.hide();
    });
  }

  private show(id: string): void {
    const text = exhibitTexts[id];
    this.currentId = id;
    this.title.textContent = text?.title ?? id;
    this.look.textContent = text?.look ?? '';
    this.hint.textContent = text?.hint ?? '';
    this.bar.style.width = '0%';
    this.el.classList.remove('is-hidden');
    this.body.scrollTop = 0;
    this.updateScrollHint();
  }

  /** 本文に続きがあるときだけ下端をぼかして、スクロールできることを示す */
  private updateScrollHint(): void {
    const rest = this.body.scrollHeight - this.body.clientHeight - this.body.scrollTop;
    this.el.classList.toggle('has-more', rest > 8);
  }

  private hide(): void {
    this.currentId = null;
    this.el.classList.add('is-hidden');
  }
}
