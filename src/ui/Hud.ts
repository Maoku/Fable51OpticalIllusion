import { bus } from '../app/events';
import { exhibitTexts } from '../content/exhibits.ja';
import { h, uiRoot } from './dom';

/** 画面下部の HUD。最寄り展示の名前と「ヒントを見る」ボタンを表示する */
export class Hud {
  private readonly el: HTMLElement;
  private readonly label: HTMLElement;
  private readonly button: HTMLButtonElement;
  private readonly prompt: HTMLElement;
  private nearId: string | null = null;
  private openId: string | null = null;
  private touch = false;
  private modal = false;
  private started = false;
  private looked = false;

  constructor() {
    this.label = h('div', { className: 'hud__label', attrs: { 'data-testid': 'hud-label' } });
    this.button = h('button', {
      className: 'btn btn--primary hud__hint',
      text: 'ヒントを見る',
      attrs: { type: 'button', 'data-testid': 'hint-button' },
      onClick: () => {
        if (this.nearId) bus.emit('hint:toggle', { id: this.nearId });
      },
    });
    this.prompt = h('div', {
      className: 'hud__prompt is-hidden',
      text: 'マウスの右ボタンを押しながらドラッグすると見回せます',
    });
    this.el = h('div', { className: 'hud' }, [
      this.prompt,
      h('div', { className: 'hud__near is-hidden' }, [this.label, this.button]),
    ]);
    uiRoot().appendChild(this.el);

    bus.on('exhibit:near', ({ id }) => this.setNear(id));
    bus.on('exhibit:leave', ({ id }) => {
      if (this.nearId === id) this.setNear(null);
    });
    bus.on('hint:open', ({ id }) => {
      this.openId = id;
      this.refresh();
    });
    bus.on('hint:close', ({ id }) => {
      if (this.openId === id) this.openId = null;
      this.refresh();
    });
    bus.on('input:looked', () => {
      this.looked = true;
      this.refresh();
    });
    bus.on('input:touchmode', ({ touch }) => {
      this.touch = touch;
      this.refresh();
    });
    bus.on('ui:modal', ({ open, id }) => {
      this.modal = open;
      if (!open && id === 'help') this.started = true;
      this.refresh();
    });
  }

  private setNear(id: string | null): void {
    this.nearId = id;
    this.refresh();
  }

  private refresh(): void {
    const near = this.el.querySelector('.hud__near') as HTMLElement;
    if (this.nearId && !this.modal) {
      const text = exhibitTexts[this.nearId];
      this.label.textContent = text
        ? `${text.number ? text.number + ' ' : ''}${text.title}`
        : this.nearId;
      this.button.textContent = this.openId === this.nearId ? '元に戻す' : 'ヒントを見る';
      this.button.classList.toggle('is-open', this.openId === this.nearId);
      near.classList.remove('is-hidden');
    } else {
      near.classList.add('is-hidden');
    }
    // 縦持ちではヒントパネルの見出しと同じ文言になるので、開いている間はラベルを畳む
    this.el.classList.toggle('is-hint-open', this.openId !== null && this.openId === this.nearId);

    const showPrompt = this.started && !this.touch && !this.modal && !this.looked;
    this.prompt.classList.toggle('is-hidden', !showPrompt);
  }
}
