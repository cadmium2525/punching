import { describe, it, expect } from 'vitest';
import { gradeOf, applyRound, powerFromGrades, distanceFromPower, scoreFromError, clampScore } from '../../src/core/scoring.js';
import { GameState, MINIGAME_IDS } from '../../src/core/state.js';
import { pickDistinct } from '../../src/core/rng.js';
import { formatKm, formatLightYears } from '../../src/core/format.js';
import { flightKm, reachedLandmarks, LANDMARKS } from '../../src/core/stages.js';

describe('判定境界', () => {
  it.each([
    [100, 'PERFECT'], [95, 'PERFECT'], [94, 'GREAT'], [80, 'GREAT'], [79, 'GOOD'],
    [50, 'GOOD'], [49, 'MISS'], [0, 'MISS'], [94.6, 'PERFECT'], [94.4, 'GREAT'], [-5, 'MISS'], [NaN, 'MISS'], [120, 'PERFECT'],
  ])('%s → %s', (s, g) => expect(gradeOf(s)).toBe(g));
  it('clampScore', () => {
    expect(clampScore(101)).toBe(100);
    expect(clampScore(Infinity)).toBe(0);
  });
  it('scoreFromError は区分の境界で各判定帯に入る', () => {
    const th = { p: 10, g: 20, o: 30, m: 40 };
    expect(scoreFromError(0, th)).toBe(100);
    expect(gradeOf(scoreFromError(10, th))).toBe('PERFECT');
    expect(gradeOf(scoreFromError(10.01, th))).toBe('GREAT');
    expect(gradeOf(scoreFromError(20, th))).toBe('GREAT');
    expect(gradeOf(scoreFromError(20.5, th))).toBe('GOOD');
    expect(gradeOf(scoreFromError(30, th))).toBe('GOOD');
    expect(gradeOf(scoreFromError(31, th))).toBe('MISS');
    expect(scoreFromError(41, th)).toBe(0);
  });
});

describe('パワーとコンボ', () => {
  it('全PERFECTで2700', () => expect(powerFromGrades(Array(5).fill('PERFECT'))).toBe(2700));
  it('全MISSで350', () => expect(powerFromGrades(Array(5).fill('MISS'))).toBe(350));
  it('全GREATで1100', () => expect(powerFromGrades(Array(5).fill('GREAT'))).toBe(1100));
  it('コンボは連続到達時に一度だけ・途切れたらリセット', () => {
    // P P G P P → 100 + 300+300+100 + 200 + 300+300+100
    expect(powerFromGrades(['PERFECT', 'PERFECT', 'GREAT', 'PERFECT', 'PERFECT'])).toBe(100 + 700 + 200 + 700);
    // G P P P P → 100+200 + 1200 + 100+200+300
    expect(powerFromGrades(['GREAT', 'PERFECT', 'PERFECT', 'PERFECT', 'PERFECT'])).toBe(2100);
  });
  it('最大値を超えない', () => {
    const r = applyRound({ power: 2650, perfectStreak: 4, maxPerfectStreak: 4 }, 'PERFECT');
    expect(r.power).toBe(2700);
    expect(r.gained).toBe(50);
  });
});

describe('飛距離', () => {
  it('最短と最大', () => {
    expect(distanceFromPower(350)).toBe(1000);
    expect(distanceFromPower(2700)).toBeGreaterThan(1.5e18); // 銀河の向こう
  });
  it('単調増加', () => {
    let prev = 0;
    for (let p = 350; p <= 2700; p += 10) {
      const d = distanceFromPower(p);
      expect(d).toBeGreaterThan(prev);
      prev = d;
    }
  });
  it('全PERFECTだけが天の川銀河を突破する', () => {
    const galaxy = LANDMARKS.find((l) => l.id === 'galaxy').km;
    expect(distanceFromPower(2700)).toBeGreaterThan(galaxy);
    // 2番目に高いパワー（GREAT 1回）
    expect(distanceFromPower(2100)).toBeLessThan(galaxy);
  });
  it('短距離では未到達エリアを含めない', () => {
    expect(reachedLandmarks(1000).map((l) => l.id)).toEqual(['karman', 'iss']);
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
  it('6種から5種を重複なしで抽選', () => {
    for (let i = 0; i < 200; i++) {
      const g = pickDistinct(MINIGAME_IDS, 5);
      expect(new Set(g).size).toBe(5);
      g.forEach((id) => expect(MINIGAME_IDS).toContain(id));
    }
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
    for (let i = 0; i < 5; i++) s.commitRound(i, 97);
    expect(s.finished).toBe(true);
    expect(s.power).toBe(2700);
    expect(s.godPunch).toBe(true);
    expect(s.finalDistanceKm).toBe(distanceFromPower(2700));
    expect(s.commitRound(5, 100)).toBeNull();
  });
});

describe('表示', () => {
  it('formatKm', () => {
    expect(formatKm(1234567)).toBe('1,234,567 km');
    expect(formatKm(3.72e12)).toBe('3.72兆 km');
    expect(formatKm(2e18)).toBe('200.0京 km');
  });
  it('光年', () => {
    expect(formatLightYears(1000)).toBeNull();
    expect(formatLightYears(2e18)).toMatch(/万光年/);
  });
});
