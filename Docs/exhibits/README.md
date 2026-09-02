# Fable の間 展示仕様メモ

各作品の概念・実装・種明かしの要点。実装は `src/exhibits/fable/` を参照。

| # | 作品 | ファイル | 単体テスト |
|---|------|---------|-----------|
| F1 | [三面の彫刻](F1-trilemma-sculpture.md) | `TrilemmaSculpture.ts`、`procedural/silhouetteSolid.ts` | `silhouetteSolid.test.ts` |
| F2 | [傾きの間](F2-tilted-room.md) | `TiltedRoom.ts` | `tiltedRoom.test.ts`、`PlayerController.test.ts`、E2E `tilted.spec.ts` |
| F3 | [色の部屋](F3-ganzfeld-chamber.md) | `GanzfeldChamber.ts` | E2E `ganzfeld.spec.ts` |
| F4 | [窓の外の庭](F4-garden-window.md) | `ForcedPerspectiveGarden.ts`、`museum/fogScope.ts` | `gardenWindow.test.ts`、E2E `garden.spec.ts` |
| F5 | [無限の井戸](F5-infinity-well.md) | `InfinityWell.ts` | - |
| F6 | [終わらない階段](F6-endless-stair.md) | `EndlessStair.ts`、`stairGeometry.ts` | `stairGeometry.test.ts`、E2E `stair.spec.ts` |
| F7 | [逆さの水面](F7-inverted-pond.md) | `InvertedPond.ts`、`WaterSurface.ts` | E2E `pond.spec.ts` |
