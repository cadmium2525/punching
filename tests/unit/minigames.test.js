import { describe, it, expect } from 'vitest';
import { createModel, MashModel, MINIGAME_INFO } from '../../src/minigames/models.js';
import { gradeOf, accOf } from '../../src/core/scoring.js';
import { MINIGAME_IDS } from '../../src/core/state.js';

const T0 = 10000;
function play(id, inputs, { rand, level = 0 } = {}) {
  const m = createModel(id, rand, level);
  m.start(T0);
  inputs.forEach((inp, i) => {
    const b = typeof inp === 'number' ? { t: inp } : inp;
    m.update(T0 + b.t);
    m.input(T0 + b.t, i, b.x ?? 0, b.y ?? 0);
  });
  for (let t = 0; t <= m.limitMs + 50 && !m.done; t += 16) m.update(T0 + t);
  m.update(T0 + m.limitMs + 1);
  return m;
}
function botPlay(id, level = 0, offset = 0) {
  const m0 = createModel(id, () => 0.5, level);
  m0.start(T0);
  return play(id, m0.botInputs().map((b) => ({ ...b, t: b.t + offset })), { rand: () => 0.5, level });
}

describe('全ミニゲーム共通', () => {
  it('全10種に説明がある', () => MINIGAME_IDS.forEach((id) => expect(MINIGAME_INFO[id]).toBeTruthy()));
  for (const level of [0, 4]) {
    it.each(MINIGAME_IDS)(`%s: 理想の入力でPERFECT（ラウンド${level + 1}）`, (id) => {
      const m = botPlay(id, level);
      expect(m.done).toBe(true);
      expect(gradeOf(m.score)).toBe('PERFECT');
    });
  }
  it.each(MINIGAME_IDS)('%s: 未入力はMISS（タイムアウトで終了）', (id) => {
    const m = play(id, []);
    expect(m.done).toBe(true);
    expect(gradeOf(m.score)).toBe('MISS');
  });
  it.each(MINIGAME_IDS.filter((id) => id !== 'mash'))('%s: 40ms のズレで満点ではなくなる（精度で差がつく）', (id) => {
    const exact = accOf(botPlay(id).score);
    const off = accOf(botPlay(id, 0, 40).score);
    expect(off).toBeLessThan(exact);
  });
});

describe('判定幅とタップ遅延（厳しめ）', () => {
  it('ジャストバー: ±20ms以内はPERFECT、40msずれるとGREAT以下', () => {
    expect(gradeOf(play('justbar', [300 + 20]).score)).toBe('PERFECT');
    expect(gradeOf(play('justbar', [300 - 20]).score)).toBe('PERFECT');
    expect(gradeOf(play('justbar', [300 + 40]).score)).not.toBe('PERFECT');
    expect(gradeOf(play('justbar', [0]).score)).toBe('MISS');
  });
  it('後半ラウンドほど速い', () => {
    expect(createModel('justbar', undefined, 4).period).toBeLessThan(createModel('justbar', undefined, 0).period);
  });
  it('ストップリング: 早すぎ/遅すぎ', () => {
    expect(gradeOf(play('stopring', [200]).score)).toBe('MISS');
    expect(gradeOf(play('stopring', [1100 + 25]).score)).toBe('PERFECT');
    expect(gradeOf(play('stopring', [1100 + 50]).score)).not.toBe('PERFECT');
  });
  it('ゲージ: 頂点付近', () => {
    expect(gradeOf(play('gauge', [700 + 20]).score)).toBe('PERFECT');
    expect(gradeOf(play('gauge', [100]).score)).toBe('MISS');
  });
  it('リアクション: 早押しはMISS、反応時間で評価', () => {
    const r = () => 0; // NOW は 500ms
    expect(play('reaction', [300], { rand: r }).raw.early).toBe(true);
    expect(gradeOf(play('reaction', [300], { rand: r }).score)).toBe('MISS');
    expect(gradeOf(play('reaction', [500 + 230], { rand: r }).score)).toBe('PERFECT');
    expect(gradeOf(play('reaction', [500 + 300], { rand: r }).score)).toBe('GREAT');
    expect(gradeOf(play('reaction', [500 + 450], { rand: r }).score)).toBe('GOOD');
    expect(gradeOf(play('reaction', [500 + 1000], { rand: r }).score)).toBe('MISS');
  });
  it('ピタリ1秒: 1.00秒ちょうどで満点、±20ms以内PERFECT', () => {
    expect(accOf(play('stopwatch', [1000]).score)).toBe(1000);
    expect(gradeOf(play('stopwatch', [1018]).score)).toBe('PERFECT');
    expect(gradeOf(play('stopwatch', [1050]).score)).toBe('GREAT');
    expect(play('stopwatch', [1234]).raw.ms).toBe(1234);
  });
  it('ピタリ1秒: 後半ほど早く数字が消える', () => {
    expect(createModel('stopwatch', undefined, 4).hideAt).toBeLessThan(createModel('stopwatch', undefined, 0).hideAt);
  });
  it('リズムパンチ: お手本の後の3拍で評価、お手本中に押すとMISS', () => {
    const m = createModel('rhythm');
    expect(m.targets).toEqual([1800, 2250, 2700]);
    expect(gradeOf(play('rhythm', [1800, 2250, 2700]).score)).toBe('PERFECT');
    expect(play('rhythm', [400, 2250, 2700]).raw.errors[0]).toBe(Infinity);
  });
  it('動くアイツを狙え: 位置の精度で評価', () => {
    const r = () => 0;
    const m0 = createModel('target', r);
    m0.start(T0);
    const p = m0.pos(T0 + 700);
    expect(gradeOf(play('target', [{ t: 700, x: p.x, y: p.y }], { rand: r }).score)).toBe('PERFECT');
    expect(gradeOf(play('target', [{ t: 700, x: p.x + 30, y: p.y }], { rand: r }).score)).toBe('GREAT');
    expect(gradeOf(play('target', [{ t: 700, x: p.x + 200, y: p.y }], { rand: r }).score)).toBe('MISS');
  });
  it('回転ルーレット: 金色のマスの中心で満点', () => {
    const r = () => 0.5;
    const m0 = createModel('spin', r);
    const t = m0.botTimes()[0];
    expect(accOf(play('spin', [t], { rand: r }).score)).toBe(1000);
    expect(gradeOf(play('spin', [t + 120], { rand: r }).score)).not.toBe('PERFECT');
  });
});

describe('パワー連打', () => {
  it.each([[30, 'PERFECT'], [18, 'PERFECT'], [17, 'GREAT'], [14, 'GREAT'], [13, 'GOOD'], [9, 'GOOD'], [8, 'MISS']])('%i回 → %s', (n, g) => {
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
    const m = createModel('mash');
    m.start(T0);
    for (let i = 0; i < 40; i++) {
      m.update(T0 + i * 100);
      m.input(T0 + i * 100, 0);
    }
    expect(m.raw.count).toBe(25);
  });
});

describe('3連ジャスト', () => {
  it('1つ見逃すと平均が下がる', () => {
    const m = play('triple', [800, 2100]);
    expect(m.raw.errors[1]).toBe(Infinity);
    expect(gradeOf(m.score)).toBe('GOOD');
  });
  it('早すぎるタップはそのノーツをMISS', () => {
    const m = play('triple', [100, 1450, 2100]);
    expect(m.raw.errors[0]).toBe(Infinity);
  });
  it('3つ判定したら即終了', () => {
    const m = createModel('triple');
    m.start(T0);
    [800, 1450, 2100].forEach((t) => m.input(T0 + t));
    expect(m.done).toBe(true);
  });
});
