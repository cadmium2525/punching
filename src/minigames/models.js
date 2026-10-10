// ミニゲームの判定ロジック（描画なし・時間は ms）。
// 時間は performance.now() 基準。入力は pointerdown のタイムスタンプを渡す。
import { scoreFromError } from '../core/scoring.js';

export const MINIGAME_INFO = {
  justbar: { no: '01', name: 'ジャストバー', call: 'ジャストタップ！', hint: '針がまん中に来たらタップ！' },
  stopring: { no: '02', name: 'ストップリング', call: 'ピタッと止めろ！', hint: '縮む輪が金の輪に重なったらタップ！' },
  mash: { no: '03', name: 'パワー連打', call: '連打！連打！連打！', hint: '画面をとにかく連打！16回以上でPERFECT' },
  gauge: { no: '04', name: 'ピタ止めゲージ', call: 'MAXで止めろ！', hint: 'ゲージがてっぺんに来たらタップ！' },
  reaction: { no: '05', name: '光速リアクション', call: 'NOW!でタップ！', hint: '「NOW!」が出た瞬間にタップ！早押しはMISS' },
  triple: { no: '06', name: '3連ジャスト', call: '3連ジャスト！', hint: '輪が①②③の円に重なる瞬間に3回タップ！' },
};

class BaseModel {
  constructor(limitMs) {
    this.limitMs = limitMs;
    this.t0 = null;
    this.done = false;
    this.score = 0;
    this.raw = null;
  }
  start(t) {
    this.t0 = t;
  }
  elapsed(t) {
    return t - this.t0;
  }
  finish(score, raw) {
    if (this.done) return;
    this.done = true;
    this.score = score;
    this.raw = raw;
  }
  update(t) {
    if (!this.done && this.elapsed(t) >= this.limitMs) this.onTimeout(t);
  }
  onTimeout() {
    this.finish(0, { timeout: true });
  }
  remaining(t) {
    return Math.max(0, this.limitMs - this.elapsed(t));
  }
}

const tri = (phase) => (phase < 0.5 ? phase * 2 : 2 - phase * 2); // 0→1→0

/** 01 ジャストバー：左右往復（周期1.2秒）する針が中央に来たらタップ */
export class JustBarModel extends BaseModel {
  static TH = { p: 0.1, g: 0.25, o: 0.5, m: 1.0 };
  constructor() {
    super(2000);
    this.period = 1200;
  }
  pos(t) {
    // -1(左端) 〜 +1(右端)
    const ph = ((this.elapsed(t) / this.period) % 1 + 1) % 1;
    return tri(ph) * 2 - 1;
  }
  input(t) {
    if (this.done) return;
    const err = Math.abs(this.pos(t));
    this.finish(scoreFromError(err, JustBarModel.TH), { err });
  }
  botTimes() {
    return [300];
  }
}

/** 02 ストップリング：縮小するリングが目標円と重なる瞬間にタップ */
export class StopRingModel extends BaseModel {
  static TH = { p: 0.06, g: 0.15, o: 0.35, m: 0.8 };
  constructor() {
    super(2000);
    this.hitAt = 1100; // 目標円と重なる時刻
    this.startSize = 2.6;
  }
  size(t) {
    const e = this.elapsed(t);
    return Math.max(0, this.startSize - ((this.startSize - 1) * e) / this.hitAt);
  }
  input(t) {
    if (this.done) return;
    const err = Math.abs(this.size(t) - 1);
    this.finish(scoreFromError(err, StopRingModel.TH), { err });
  }
  botTimes() {
    return [this.hitAt];
  }
}

/** 03 パワー連打：2.5秒間の連打数で評価（8/12/16回基準） */
export class MashModel extends BaseModel {
  static SAME_PRESS_MS = 35;
  constructor() {
    super(2500);
    this.count = 0;
    this.lastAt = -Infinity;
    this.lastPointer = null;
  }
  static scoreFromCount(c) {
    if (c >= 20) return 100;
    if (c >= 16) return 95 + ((c - 16) * 5) / 4;
    if (c >= 12) return 80 + ((c - 12) * 14) / 4;
    if (c >= 8) return 50 + ((c - 8) * 29) / 4;
    return (c * 49) / 8;
  }
  /** pointerId が異なる同時押し（35ms以内）は1回とみなす */
  input(t, pointerId = 0) {
    if (this.done || this.elapsed(t) < 0) return false;
    if (pointerId !== this.lastPointer && t - this.lastAt < MashModel.SAME_PRESS_MS) return false;
    this.count++;
    this.lastAt = t;
    this.lastPointer = pointerId;
    return true;
  }
  onTimeout() {
    this.finish(MashModel.scoreFromCount(this.count), { count: this.count });
  }
  botTimes() {
    return Array.from({ length: 20 }, (_, i) => 60 + i * 110);
  }
}

/** 04 ピタ止めゲージ：上下するゲージ（周期1.4秒）を最大値付近で停止 */
export class GaugeModel extends BaseModel {
  static TH = { p: 0.05, g: 0.15, o: 0.35, m: 0.8 };
  constructor() {
    super(2000);
    this.period = 1400;
  }
  value(t) {
    const ph = ((this.elapsed(t) / this.period) % 1 + 1) % 1;
    return tri(ph);
  }
  input(t) {
    if (this.done) return;
    const v = this.value(t);
    const err = 1 - v;
    this.finish(scoreFromError(err, GaugeModel.TH), { value: v });
  }
  botTimes() {
    return [this.period / 2];
  }
}

/** 05 光速リアクション：0.5〜1.2秒後の NOW 表示に反応。早押しは MISS */
export class ReactionModel extends BaseModel {
  static TH = { p: 80, g: 180, o: 340, m: 720 };
  static FLOOR_MS = 180;
  constructor(rand = Math.random) {
    super(2000);
    this.nowAt = 500 + Math.round(rand() * 700);
  }
  isNow(t) {
    return this.elapsed(t) >= this.nowAt;
  }
  input(t) {
    if (this.done) return;
    const e = this.elapsed(t);
    if (e < this.nowAt) {
      this.finish(0, { early: true, delay: this.nowAt });
      return;
    }
    const rt = e - this.nowAt;
    this.finish(scoreFromError(Math.max(0, rt - ReactionModel.FLOOR_MS), ReactionModel.TH), { rt, delay: this.nowAt });
  }
  botTimes() {
    return [this.nowAt + 200];
  }
}

/** 06 3連ジャスト：3つの到達タイミングに合わせてタップ。平均精度で評価 */
export class TripleModel extends BaseModel {
  static TH = { p: 60, g: 110, o: 180, m: 280 };
  constructor() {
    super(3000);
    this.targets = [800, 1500, 2200];
    this.errors = [null, null, null];
    this.scores = [null, null, null];
  }
  get next() {
    return this.scores.findIndex((s) => s === null);
  }
  judge(i, err) {
    this.errors[i] = err;
    this.scores[i] = Number.isFinite(err) ? scoreFromError(err, TripleModel.TH) : 0;
    if (this.next === -1) this.complete();
  }
  complete() {
    const avg = this.scores.reduce((a, b) => a + (b ?? 0), 0) / 3;
    this.finish(avg, { errors: this.errors.slice() });
  }
  /** 戻り値: 判定したノーツ番号と得点 */
  input(t) {
    if (this.done) return null;
    this.update(t);
    const i = this.next;
    if (i < 0 || this.done) return null;
    const diff = this.elapsed(t) - this.targets[i];
    if (diff < -TripleModel.TH.m) {
      this.judge(i, Infinity); // 早押し
    } else {
      this.judge(i, Math.abs(diff));
    }
    return { index: i, score: this.scores[i] };
  }
  update(t) {
    if (this.done) return;
    const e = this.elapsed(t);
    let i;
    while ((i = this.next) >= 0 && e > this.targets[i] + TripleModel.TH.m) this.judge(i, Infinity);
    if (!this.done && e >= this.limitMs) this.complete();
  }
  botTimes() {
    return this.targets.slice();
  }
}

export function createModel(id, rand = Math.random) {
  switch (id) {
    case 'justbar':
      return new JustBarModel();
    case 'stopring':
      return new StopRingModel();
    case 'mash':
      return new MashModel();
    case 'gauge':
      return new GaugeModel();
    case 'reaction':
      return new ReactionModel(rand);
    case 'triple':
      return new TripleModel();
    default:
      throw new Error(`unknown minigame ${id}`);
  }
}
