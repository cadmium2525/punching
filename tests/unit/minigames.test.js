import { describe, it, expect } from 'vitest';
import { createModel, MashModel, TripleModel } from '../../src/minigames/models.js';
import { gradeOf } from '../../src/core/scoring.js';
import { MINIGAME_IDS } from '../../src/core/state.js';

const T0 = 10000;
function play(id, times, { pointer = (i) => 0, rand } = {}) {
  const m = createModel(id, rand);
  m.start(T0);
  times.forEach((t, i) => {
    m.update(T0 + t);
    m.input(T0 + t, pointer(i));
  });
  for (let t = 0; t <= m.limitMs + 50 && !m.done; t += 16) m.update(T0 + t);
  m.update(T0 + m.limitMs + 1);
  return m;
}

describe('全ミニゲーム共通', () => {
  it.each(MINIGAME_IDS)('%s: 理想タイミングでPERFECT', (id) => {
    const m0 = createModel(id, () => 0.5);
    const m = play(id, m0.botTimes(), { rand: () => 0.5, pointer: (i) => i });
    expect(m.done).toBe(true);
    expect(gradeOf(m.score)).toBe('PERFECT');
  });
  it.each(MINIGAME_IDS)('%s: 未入力はMISS（タイムアウトで終了）', (id) => {
    const m = play(id, []);
    expect(m.done).toBe(true);
    expect(gradeOf(m.score)).toBe('MISS');
  });
});

describe('判定幅とタップ遅延', () => {
  it('ジャストバー: 中央から±30ms以内はPERFECT、80ms遅れはGOOD以下', () => {
    expect(gradeOf(play('justbar', [300 + 30]).score)).toBe('PERFECT');
    expect(gradeOf(play('justbar', [300 - 30]).score)).toBe('PERFECT');
    expect(['GOOD', 'MISS']).toContain(gradeOf(play('justbar', [300 + 80]).score));
    expect(gradeOf(play('justbar', [0]).score)).toBe('MISS'); // 端
  });
  it('ストップリング: 早すぎ/遅すぎ', () => {
    expect(gradeOf(play('stopring', [200]).score)).toBe('MISS');
    expect(gradeOf(play('stopring', [1100 + 40]).score)).toBe('PERFECT');
  });
  it('ゲージ: 頂点付近', () => {
    expect(gradeOf(play('gauge', [700 + 30]).score)).toBe('PERFECT');
    expect(gradeOf(play('gauge', [100]).score)).toBe('MISS');
  });
  it('リアクション: 早押しはMISS、反応時間で評価', () => {
    const r = () => 0; // NOW は 500ms
    expect(play('reaction', [300], { rand: r }).raw.early).toBe(true);
    expect(gradeOf(play('reaction', [300], { rand: r }).score)).toBe('MISS');
    expect(gradeOf(play('reaction', [500 + 250], { rand: r }).score)).toBe('PERFECT');
    expect(gradeOf(play('reaction', [500 + 330], { rand: r }).score)).toBe('GREAT');
    expect(gradeOf(play('reaction', [500 + 480], { rand: r }).score)).toBe('GOOD');
    expect(gradeOf(play('reaction', [500 + 1000], { rand: r }).score)).toBe('MISS');
  });
  it('リアクション: NOW は 0.5〜1.2秒', () => {
    expect(createModel('reaction', () => 0).nowAt).toBe(500);
    expect(createModel('reaction', () => 1).nowAt).toBe(1200);
  });
});

describe('パワー連打', () => {
  it.each([[16, 'PERFECT'], [15, 'GREAT'], [12, 'GREAT'], [11, 'GOOD'], [8, 'GOOD'], [7, 'MISS']])('%i回 → %s', (n, g) => {
    expect(gradeOf(MashModel.scoreFromCount(n))).toBe(g);
  });
  it('複数ポインタの同時押しは二重計上しない', () => {
    const m = createModel('mash');
    m.start(T0);
    m.input(T0 + 100, 1);
    m.input(T0 + 105, 2); // 同時押し
    m.input(T0 + 300, 2); // 別タップ
    m.input(T0 + 310, 1); // 同時押し
    expect(m.count).toBe(2);
  });
  it('同じ指の素早い連打は数える', () => {
    const m = createModel('mash');
    m.start(T0);
    m.input(T0 + 100, 1);
    m.input(T0 + 120, 1);
    expect(m.count).toBe(2);
  });
  it('制限時間後の入力は数えない', () => {
    const m = play('mash', Array.from({ length: 30 }, (_, i) => i * 100));
    expect(m.raw.count).toBe(25);
  });
});

describe('3連ジャスト', () => {
  it('1つ見逃すと平均が下がる', () => {
    const m = play('triple', [800, 2200]);
    expect(m.raw.errors[1]).toBe(Infinity);
    expect(gradeOf(m.score)).toBe('GOOD');
  });
  it('早すぎるタップはそのノーツをMISS', () => {
    const m = play('triple', [100, 1500, 2200]);
    expect(m.raw.errors[0]).toBe(Infinity);
  });
  it('3つ判定したら即終了', () => {
    const m = createModel('triple');
    m.start(T0);
    [800, 1500, 2200].forEach((t) => m.input(T0 + t));
    expect(m.done).toBe(true);
  });
});
