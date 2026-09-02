// 15 秒 PV ワンテイク撮影スクリプト(Docs/SHOOTING_PLAN.md 参照)
//
// 使い方:
//   1. 実機 GPU の Chrome で `?quality=high` を付けて開き、操作説明を「はじめる」で閉じる
//   2. 画面収録を開始する
//   3. DevTools のコンソールにこのファイルの中身を貼り付けて Enter
//   4. 開始姿勢(入口)で静止したまま最大 6.5 秒待ったあと、5 カットが自動で進む
//   5. 最後の俯瞰で止まったら収録を停止し、`__shootRestore()` で HUD とヒントを元に戻す
//
// 各カットの開始時刻はシーン時間で `__shootLog` に残る。カット表の設計値は
// 0.0 / 1.8 / 4.9 / 8.0 / 10.7 / 14.8 s(フレーム境界待ちで +0.1 s 程度ずれる)。
(async () => {
  const m = window.__museum;
  const P = m.player;
  const now = () => m.loop.elapsed; // シーン時間(秒)。fps に依存しない
  const until = (f) =>
    new Promise((r) => {
      const t = setInterval(() => {
        if (f()) {
          clearInterval(t);
          r();
        }
      }, 4);
    });
  const hold = (sec) => {
    const end = now() + sec;
    return until(() => now() >= end);
  };
  const pose = (x, z, yaw, pitch) => ({ position: P.position.clone().set(x, 0, z), yaw, pitch });
  // ハードカット: 演出を即座に戻し、展示の推奨視点へワープする
  const cut = (id) => {
    m.hints.hintPlayer.reset();
    if (id) m.warpTo(id);
  };
  // 種明かし(E キー相当)を開き、演出が終わるまで待つ
  const reveal = async (id) => {
    await m.hints.open(id);
    await until(() => m.hints.hintPlayer.progress >= 1);
  };
  const log = [];
  let t0 = 0;
  const mark = (label) => log.push(`${(now() - t0).toFixed(2)}s  ${label}`);

  document.getElementById('ui').style.display = 'none'; // HUD を隠す(テロップは編集で入れる)
  m.hints.hintPlayer.reset();
  P.teleport(pose(0, 5.5, 0, 0)); // 開始姿勢: 入口

  // F2 の球の位相合わせ: カット 3 の開始(4.9 s)で球が転がり始め(ballT ≈ 1.6)になるよう待つ
  const tilted = m.registry.get('tilted-room');
  await until(() => tilted.ballT >= 3.2 && tilted.ballT < 3.4);
  t0 = now();

  mark('C1 入館 ドリーイン');
  await P.moveTo(pose(0, 2.5, 0, 0), 1.8);

  mark('C2 ペンローズの三角形');
  cut('penrose-triangle');
  await reveal('penrose-triangle');

  mark('C3 傾きの間(球が登る)');
  cut('tilted-room');
  await hold(1.5);
  mark(`C3 種明かし (ballT=${tilted.ballT.toFixed(2)})`);
  await reveal('tilted-room');

  mark('C4 無限の井戸 寄り');
  cut();
  P.teleport(pose(-3.9, -22, Math.PI / 2, -0.42));
  await P.moveTo(pose(-4.5, -22, Math.PI / 2, -0.55), 0.6);
  mark('C4 種明かし');
  await reveal('infinity-well');

  mark('C5 終わらない階段');
  cut('endless-stair');
  await reveal('endless-stair');

  await hold(0.6); // 最終フレームの保持(編集で 15.0 s に切る)
  mark('END');

  console.log(log.join('\n'));
  window.__shootLog = log;
  window.__shootRestore = () => {
    m.hints.close();
    document.getElementById('ui').style.display = '';
  };
})();
