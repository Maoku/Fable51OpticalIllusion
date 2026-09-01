import './styles/main.css';
import { App } from './app/App';

function showFatal(message: string): void {
  const el = document.createElement('div');
  el.className = 'fatal';
  el.setAttribute('role', 'alert');
  el.textContent = message;
  document.body.appendChild(el);
}

const container = document.getElementById('app');
if (!container) {
  showFatal('#app が見つかりません');
} else {
  try {
    const app = new App(container);
    app.start().catch((err: unknown) => {
      console.error(err);
      showFatal('起動に失敗しました。');
    });
  } catch (err) {
    console.error(err);
    showFatal('WebGL を利用できないため、このミュージアムを表示できません。');
  }
}
