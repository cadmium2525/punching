// 1プレイ分のゲーム状態（仕様書 10章）
import config from '../../data/game_config.json';
import { applyRound, BASE_POWER, distanceFromPower, accOf } from './scoring.js';
import { pickDistinct, randomId } from './rng.js';

export const MINIGAME_IDS = ['justbar', 'stopring', 'mash', 'gauge', 'reaction', 'triple', 'stopwatch', 'rhythm', 'target', 'spin'];

export class GameState {
  constructor(characterId, { rand = Math.random, miniGames } = {}) {
    this.sessionId = randomId();
    this.characterId = characterId;
    this.miniGames = miniGames ?? pickDistinct(MINIGAME_IDS, config.rounds, rand);
    this.currentRound = 0;
    this.power = BASE_POWER;
    this.perfectStreak = 0;
    this.maxPerfectStreak = 0;
    this.godPunch = false;
    this.finalDistanceKm = null;
    this.finished = false;
    this.rounds = [];
    this.startedAt = Date.now();
  }

  get totalRounds() {
    return config.rounds;
  }

  get currentGameId() {
    return this.miniGames[this.currentRound];
  }

  /**
   * ラウンド確定。同じラウンドの二重確定は無視して null を返す。
   */
  commitRound(roundIndex, score, raw = null) {
    if (this.finished || roundIndex !== this.currentRound || this.rounds[roundIndex]) return null;
    const acc = accOf(score);
    const r = applyRound(this, acc);
    const grade = r.grade;
    this.power = r.power;
    this.perfectStreak = r.perfectStreak;
    this.maxPerfectStreak = r.maxPerfectStreak;
    const result = {
      round: roundIndex,
      gameId: this.miniGames[roundIndex],
      acc,
      grade,
      gained: r.gained,
      points: r.points,
      comboBonus: r.comboBonus,
      precision: r.precision,
      streak: r.perfectStreak,
      raw,
    };
    this.rounds[roundIndex] = result;
    this.currentRound++;
    if (this.currentRound >= config.rounds) this.finish();
    return result;
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    this.godPunch = this.rounds.length === config.rounds && this.rounds.every((r) => r.grade === 'PERFECT');
    // 飛行開始前に最終距離を確定（スキップしても不変）
    this.finalDistanceKm = distanceFromPower(this.power);
  }

  get accs() {
    return this.rounds.map((r) => r.acc);
  }

  get grades() {
    return this.rounds.map((r) => r.grade);
  }

  get perfectCount() {
    return this.rounds.filter((r) => r.grade === 'PERFECT').length;
  }
}
