import { bus } from '../app/events';
import { exhibitTexts } from '../content/exhibits.ja';
import type { ExhibitRoom } from '../exhibits/Exhibit';
import { h, uiRoot } from './dom';

export interface ExhibitListEntry {
  id: string;
  room: ExhibitRoom;
}

const ROOM_NAMES: Record<ExhibitRoom, string> = {
  classic: '古典の間',
  fable: 'Fable の間',
};

/** 展示一覧。選ぶと推奨視点へワープする */
export class ExhibitList {
  private readonly el: HTMLElement;
  open = false;

  constructor(entries: ExhibitListEntry[]) {
    const groups: HTMLElement[] = [];
    for (const room of ['classic', 'fable'] as const) {
      const items = entries.filter((e) => e.room === room);
      if (items.length === 0) continue;
      groups.push(
        h('h3', { className: 'list__room', text: ROOM_NAMES[room] }),
        h(
          'ul',
          { className: 'list__items' },
          items.map((e) => {
            const t = exhibitTexts[e.id];
            return h('li', {}, [
              h(
                'button',
                {
                  className: 'list__item',
                  attrs: { type: 'button', 'data-testid': `list-item-${e.id}` },
                  onClick: () => {
                    this.hide();
                    bus.emit('warp', { id: e.id });
                  },
                },
                [
                  h('span', { className: 'list__num', text: t?.number ?? '' }),
                  h('span', { className: 'list__title', text: t?.title ?? e.id }),
                  h('span', { className: 'list__sub', text: t?.subtitle ?? '' }),
                ],
              ),
            ]);
          }),
        ),
      );
    }
    this.el = h(
      'div',
      {
        className: 'overlay list is-hidden',
        attrs: { role: 'dialog', 'aria-modal': 'true', 'data-testid': 'exhibit-list' },
      },
      [
        h('div', { className: 'panel list__panel' }, [
          h('div', { className: 'list__head' }, [
            h('div', {}, [
              h('p', { className: 'panel__eyebrow', text: '展示一覧' }),
              h('h2', { className: 'panel__title', text: '見たい展示へワープ' }),
            ]),
            h('button', {
              className: 'btn btn--icon',
              text: '×',
              attrs: { type: 'button', 'aria-label': '閉じる', 'data-testid': 'list-close' },
              onClick: () => this.hide(),
            }),
          ]),
          ...groups,
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
    bus.emit('ui:modal', { open: true, id: 'list' });
  }

  hide(): void {
    if (!this.open) return;
    this.open = false;
    this.el.classList.add('is-hidden');
    bus.emit('ui:modal', { open: false, id: 'list' });
  }

  toggle(): void {
    if (this.open) this.hide();
    else this.show();
  }
}
