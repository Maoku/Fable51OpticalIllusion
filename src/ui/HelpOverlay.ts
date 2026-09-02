import { bus } from '../app/events';
import { h, uiRoot } from './dom';

export interface HelpOverlayOptions {
  touch: boolean;
  onCredits?: () => void;
}

/** 操作説明。PC / モバイルで文言を切り替える */
export class HelpOverlay {
  private readonly el: HTMLElement;
  private readonly startBtn: HTMLButtonElement;
  private readonly rows: HTMLElement;
  open = false;

  constructor(private readonly opts: HelpOverlayOptions) {
    this.rows = h('dl', { className: 'help__rows' });
    this.startBtn = h('button', {
      className: 'btn btn--primary',
      text: 'はじめる',
      attrs: { type: 'button', 'data-testid': 'help-start' },
      onClick: () => this.hide(),
    });
    this.el = h(
      'div',
      { className: 'overlay help is-hidden', attrs: { role: 'dialog', 'aria-modal': 'true' } },
      [
        h('div', { className: 'panel help__panel' }, [
          h('p', { className: 'panel__eyebrow', text: '操作方法' }),
          h('h2', { className: 'panel__title', text: '館内の歩き方' }),
          this.rows,
          h('p', {
            className: 'help__note',
            text: '展示に近づくと「ヒントを見る」ボタンが現れます。押すと種明かし、もう一度押すと元に戻ります。',
          }),
          this.startBtn,
          h('div', { className: 'help__links' }, [
            h('button', {
              className: 'link',
              text: 'クレジット',
              attrs: { type: 'button', 'data-testid': 'credits-button' },
              onClick: () => {
                this.hide();
                opts.onCredits?.();
              },
            }),
          ]),
        ]),
      ],
    );
    this.setTouch(opts.touch);
    uiRoot().appendChild(this.el);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && this.open) this.hide();
    });
  }

  setTouch(touch: boolean): void {
    const rows: [string, string][] = touch
      ? [
          ['移動', '画面の左半分に触れてスティックを傾ける'],
          ['見回す', '画面の右半分をドラッグ'],
          ['ヒント', '展示に近づくと出る「ヒントを見る」ボタン'],
          ['展示一覧', '右上のメニューから任意の展示へワープ'],
        ]
      : [
          ['移動', 'W A S D / 矢印キー(Shift で早歩き)'],
          ['見回す', 'マウスの右ボタン(左ボタンでも可)を押しながらドラッグ'],
          ['ヒント', 'E キー、または「ヒントを見る」ボタン'],
          ['展示一覧', 'Tab キー、または右上のメニュー'],
        ];
    this.rows.replaceChildren(
      ...rows.flatMap(([k, v]) => [h('dt', { text: k }), h('dd', { text: v })]),
    );
  }

  show(): void {
    this.open = true;
    this.el.classList.remove('is-hidden');
    bus.emit('ui:modal', { open: true, id: 'help' });
    this.startBtn.focus();
  }

  hide(): void {
    if (!this.open) return;
    this.open = false;
    this.el.classList.add('is-hidden');
    bus.emit('ui:modal', { open: false, id: 'help' });
  }

  toggle(): void {
    if (this.open) this.hide();
    else this.show();
  }
}
