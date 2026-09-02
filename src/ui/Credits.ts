import { bus } from '../app/events';
import { credits } from '../content/credits';
import { h, uiRoot } from './dom';

const KIND: Record<string, string> = {
  library: 'ライブラリ',
  font: 'フォント',
  texture: 'テクスチャ',
  model: '3D モデル',
  hdri: 'HDRI',
  other: 'その他',
};

/** 館内のクレジット画面。content/credits.ts と同じ内容を表示する */
export class Credits {
  private readonly el: HTMLElement;
  open = false;

  constructor() {
    const rows = credits.map((c) =>
      h('li', { className: 'credits__item' }, [
        h('div', { className: 'credits__head' }, [
          h('a', {
            className: 'credits__name',
            text: c.name,
            attrs: { href: c.url, target: '_blank', rel: 'noopener noreferrer' },
          }),
          h('span', { className: 'credits__kind', text: KIND[c.kind] ?? c.kind }),
        ]),
        h('div', {
          className: 'credits__meta',
          text: `${c.author} / ${c.license}${c.modified ? '(改変あり)' : ''}`,
        }),
        h('div', { className: 'credits__usage', text: c.usage }),
      ]),
    );
    this.el = h(
      'div',
      {
        className: 'overlay credits is-hidden',
        attrs: { role: 'dialog', 'aria-modal': 'true', 'data-testid': 'credits' },
      },
      [
        h('div', { className: 'panel credits__panel' }, [
          h('div', { className: 'list__head' }, [
            h('div', {}, [
              h('p', { className: 'panel__eyebrow', text: 'Credits' }),
              h('h2', { className: 'panel__title', text: 'クレジット' }),
            ]),
            h('button', {
              className: 'btn btn--icon',
              text: '×',
              attrs: { type: 'button', 'aria-label': '閉じる', 'data-testid': 'credits-close' },
              onClick: () => this.hide(),
            }),
          ]),
          h('p', {
            className: 'credits__note',
            text: '展示物・テクスチャ・建築はすべてプログラムで生成しています。外部の素材とライブラリは以下のとおりです。',
          }),
          h('ul', { className: 'credits__list' }, rows),
          h('p', {
            className: 'credits__note',
            text: 'Optical Illusion Museum — Fable オリジナル展示と古典錯視の 3D ミュージアム',
          }),
        ]),
      ],
    );
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.hide();
    });
    uiRoot().appendChild(this.el);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.open) this.hide();
    });
  }

  show(): void {
    if (this.open) return;
    this.open = true;
    this.el.classList.remove('is-hidden');
    bus.emit('ui:modal', { open: true, id: 'credits' });
  }

  hide(): void {
    if (!this.open) return;
    this.open = false;
    this.el.classList.add('is-hidden');
    bus.emit('ui:modal', { open: false, id: 'credits' });
  }

  toggle(): void {
    if (this.open) this.hide();
    else this.show();
  }
}
