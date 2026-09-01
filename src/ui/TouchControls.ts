import type { Updatable } from '../app/Loop';
import type { TouchInput } from '../input/TouchInput';
import { h, uiRoot } from './dom';

/** 仮想スティックの DOM 描画。入力の状態を毎フレーム反映する */
export class TouchControls implements Updatable {
  private readonly el: HTMLElement;
  private readonly base: HTMLElement;
  private readonly knob: HTMLElement;
  private visible = false;

  constructor(private readonly input: TouchInput) {
    this.knob = h('div', { className: 'stick__knob' });
    this.base = h('div', { className: 'stick is-hidden' }, [this.knob]);
    this.el = h(
      'div',
      { className: 'touch-controls is-hidden', attrs: { 'aria-hidden': 'true' } },
      [
        this.base,
        h('div', { className: 'touch-controls__hint touch-controls__hint--left', text: '移動' }),
        h('div', { className: 'touch-controls__hint touch-controls__hint--right', text: '見回す' }),
      ],
    );
    uiRoot().appendChild(this.el);
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.el.classList.toggle('is-hidden', !v);
  }

  update(): void {
    if (!this.visible) return;
    const s = this.input.stick;
    if (!s.active) {
      this.base.classList.add('is-hidden');
      return;
    }
    const r = this.input.core.stickRadius;
    this.base.classList.remove('is-hidden');
    this.base.style.width = `${r * 2}px`;
    this.base.style.height = `${r * 2}px`;
    this.base.style.transform = `translate(${s.originX - r}px, ${s.originY - r}px)`;
    this.knob.style.transform = `translate(${s.knobX - s.originX}px, ${s.knobY - s.originY}px)`;
  }
}
