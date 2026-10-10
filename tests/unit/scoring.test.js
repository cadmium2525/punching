import { describe, it, expect } from 'vitest';
import { gradeOf, gradeOfAcc, accOf, applyRound, powerFromAccs, distanceFromPower, scoreFromError, precisionBonus, MAX_POWER } from '../../src/core/scoring.js';
import { GameState, MINIGAME_IDS } from '../../src/core/state.js';
import { pickDistinct } from '../../src/core/rng.js';
import { formatKm, formatLightYears } from '../../src/core/format.js';
import { flightKm, reachedLandmarks, LANDMARKS, titleFor } from '../../src/core/stages.js';

describe('精度と判定', () => {
  it.each([
    [1000, 'PERFECT'], [970, 'PERFECT'], [969, 'GREAT'], [800, 'GREAT'], [799, 'GOOD'], [500, 'GOOD'], [499, 'MISS'], [0, 'MISS'],
  ])('精度%s → %s', (a, g) => expect(gradeOfAcc(a)).toBe(g));
  it('スコア→精度は0.1刻み・範囲外は丸める', () => {
    expect(accOf(97.04)).toBe(970);
    expect(accOf(96.94)).toBe(969);
    expect(accOf(120)).toBe(1000);
    expect(accOf(-3)).toBe(0);
    expect(accOf(NaN)).toBe(0);
    expect(gradeOf(97)).toBe('PERFECT');
    expect(gradeOf(96.9)).toBe('GREAT');
  });
  it('scoreFromError は各区間の境界で判定帯が切り替わる', () => {
    const th = { p: 10, g: 20, o: 30, m: 40 };
    expect(scoreFromError(0, th)).toBe(100);
    expect(gradeOf(scoreFromError(10, th))).toBe('PERFECT');
    expect(gradeOf(scoreFromError(10.01, th))).toBe('GREAT');
    expect(gradeOf(scoreFromError(20, th))).toBe('GREAT');
    expect(gradeOf(scoreFromError(20.5, th))).toBe('GOOD');
    expect(gradeOf(scoreFromError(30, th))).toBe('GOOD');
    expect(gradeOf(scoreFromError(31, th))).toBe('MISS');
    expect(scoreFromError(41, th)).toBe(0);
    expect(scoreFromError(-5, th)).toBe(scoreFromError(5, th));
  });
  it('PERFECT の中でもど真ん中ほど高い', () => {
    const th = { p: 10, g: 20, o: 30, m: 40 };
    expect(accOf(scoreFromError(1, th))).toBeGreaterThan(accOf(scoreFromError(8, th)));
  });
  it('精度ボーナスは900超えた分', () => {
    expect(precisionBonus(900)).toBe(0);
    expect(precisionBonus(970)).toBe(70);
    expect(precisionBonus(1000)).toBe(100);
  });
});

describe('パワーとコンボ', () => {
  it('全PERFECT(ど真ん中)で最大3200', () => expect(powerFromAccs(Array(5).fill(1000))).toBe(3200));
  it('全PERFECT(ギリギリ)で3050', () => expect(powerFromAccs(Array(5).fill(970))).toBe(3050));
  it('全MISSで350', () => expect(powerFromAccs(Array(5).fill(0))).toBe(350));
  it('全GREAT(精度800)で1100', () => expect(powerFromAccs(Array(5).fill(800))).toBe(1100));
  it('コンボは連続到達時に一度だけ・途切れたらリセット', () => {
    // P P G P P（精度970,970,900,970,970）→ 100 + 300+300+100 + 200 + 300+300+100 + 精度70×4
    expect(powerFromAccs([970, 970, 900, 970, 970])).toBe(100 + 700 + 200 + 700 + 280);
  });
  it('同じ全PERFECTでも精度で差がつく（ランキングが同点で埋まらない）', () => {
    const a = powerFromAccs([1000, 990, 985, 1000, 975]);
    const b = powerFromAccs([1000, 990, 984, 1000, 975]);
    expect(a).toBeGreaterThan(b);
  });
  it('最大値を超えない', () => {
    const r = applyRound({ power: 3150, perfectStreak: 4, maxPerfectStreak: 4 }, 1000);
    expect(r.power).toBe(MAX_POWER);
  });
});

describe('飛距離', () => {
  it('最短と全PERFECT', () => {
    expect(distanceFromPower(350)).toBe(1000);
    expect(distanceFromPower(3050)).toBeGreaterThan(LANDMARKS.find((l) => l.id === 'andromeda').km);
  });
  it('単調増加', () => {
    let prev = 0;
    for (let p = 350; p <= MAX_POWER; p += 10) {
      const d = distanceFromPower(p);
      expect(d).toBeGreaterThan(prev);
      prev = d;
    }
  });
  it('全PERFECTだけが天の川銀河を突破する', () => {
    const galaxy = LANDMARKS.find((l) => l.id === 'galaxy').km;
    expect(distanceFromPower(3050)).toBeGreaterThan(galaxy);
    // PERFECT 4回（精度満点）＋ GREAT 1回（精度969）が全PERFECT以外の最高
    const best = Math.max(powerFromAccs([969, 1000, 1000, 1000, 1000]), powerFromAccs([1000, 1000, 1000, 1000, 969]), powerFromAccs([1000, 1000, 969, 1000, 1000]));
    expect(distanceFromPower(best)).toBeLessThan(galaxy);
  });
  it('短距離では未到達エリアを含めない', () => {
    expect(reachedLandmarks(1000).map((l) => l.id)).toEqual(['karman', 'iss']);
  });
  it('称号', () => {
    expect(titleFor(distanceFromPower(3200), true)).toBe('宇宙の果てまでぶっ飛ばした神');
    expect(titleFor(distanceFromPower(3050), true)).toMatch(/神$/);
  });
  it('飛行表示は0から始まり最終値で終わる、単調', () => {
    const fin = distanceFromPower(1600);
    expect(flightKm(0, fin)).toBe(0);
    expect(flightKm(8, fin)).toBe(fin);
    let prev = -1;
    for (let t = 0; t <= 8; t += 0.05) {
      const v = flightKm(t, fin);
      expect(v).toBeGreaterThanOrEqual(prev);
      expect(v).toBeLessThanOrEqual(fin);
      prev = v;
    }
  });
});

describe('ゲーム状態', () => {
  it('10種から5種を重複なしで抽選', () => {
    expect(MINIGAME_IDS.length).toBe(10);
    const seen = new Set();
    for (let i = 0; i < 300; i++) {
      const g = pickDistinct(MINIGAME_IDS, 5);
      expect(new Set(g).size).toBe(5);
      g.forEach((id) => seen.add(id));
    }
    expect(seen.size).toBe(10);
  });
  it('ラウンド確定の二重実行を防ぐ', () => {
    const s = new GameState('preset-01');
    expect(s.commitRound(0, 100)).not.toBeNull();
    expect(s.commitRound(0, 100)).toBeNull();
    expect(s.currentRound).toBe(1);
    expect(s.commitRound(3, 100)).toBeNull();
  });
  it('5回で終了し距離確定・GOD PUNCH', () => {
    const s = new GameState('preset-01');
    for (let i = 0; i < 5; i++) s.commitRound(i, 98.5);
    expect(s.finished).toBe(true);
    expect(s.accs).toEqual([985, 985, 985, 985, 985]);
    expect(s.power).toBe(2700 + 85 * 5);
    expect(s.godPunch).toBe(true);
    expect(s.finalDistanceKm).toBe(distanceFromPower(s.power));
    expect(s.commitRound(5, 100)).toBeNull();
  });
});

describe('表示', () => {
  it('formatKm', () => {
    expect(formatKm(1234567)).toBe('1,234,567 km');
    expect(formatKm(3.72e12)).toBe('3.72兆 km');
    expect(formatKm(2e18)).toBe('200.0京 km');
    expect(formatKm(3.5e21)).toBe('35.00垓 km');
  });
  it('光年', () => {
    expect(formatLightYears(1000)).toBeNull();
    expect(formatLightYears(2e18)).toMatch(/万光年/);
    expect(formatLightYears(3.5e21)).toMatch(/億光年/);
  });
});
