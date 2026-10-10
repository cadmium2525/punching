// ミニゲームの判定ロジック（描画なし・時間は ms）。
// 時間は performance.now() 基準。入力は pointerdown のタイムスタンプを渡す。
// level(0〜4) はラウンド番号。後半ほど速くなる。
import { scoreFromError } from '../core/scoring.js';

export const MINIGAME_INFO = {
  justbar: { no: '01', name: 'ジャストバー', call: 'ジャストタップ！', hint: '針がまん中に来たらタップ！' },
  stopring: { no: '02', name: 'ストップリング', call: 'ピタッと止めろ！', hint: '縮む輪が金の輪に重なったらタップ！' },
  mash: { no: '03', name: 'パワー連打', call: '連打！連打！連打！', hint: '画面をとにかく連打！18回以上でPERFECT' },
  gauge: { no: '04', name: 'ピタ止めゲージ', call: 'MAXで止めろ！', hint: 'ゲージがてっぺんに来たらタップ！' },
  reaction: { no: '05', name: '光速リアクション', call: 'NOW!でタップ！', hint: '「NOW!」が出た瞬間にタップ！早押しはMISS' },
  triple: { no: '06', name: '3連ジャスト', call: '3連ジャスト！', hint: '輪が①②③の円に重なる瞬間に3回タップ！' },
  stopwatch: { no: '07', name: 'ピタリ1秒', call: 'ピタリ1.00秒！', hint: '途中で数字が消える！ 体内時計で1.00秒ぴったりにタップ' },
  rhythm: { no: '08', name: 'リズムパンチ', call: 'リズムに乗れ！', hint: '♪♪♪の3拍を聞いて、続きの3拍をタップ！' },
  target: { no: '09', name: '動くアイツを狙え', call: '顔面を狙え！', hint: '動き回るアイツの顔のど真ん中をタップ！' },
  spin: { no: '10', name: '回転ルーレット', call: 'ルーレットを止めろ！', hint: '回る針が金色のマスに来たらタップ！' },
};

class BaseModel {
  constructor(limitMs, level = 0) {
    this.limitMs = limitMs;
    this.level = level;
    this.sp = 1 + 0.08 * level; // 後半ほど速い
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
  /** 自動プレイ用：理想の入力（相対時刻 ms と、位置が必要なゲームは座標） */
  botInputs() {
    return this.botTimes().map((t) => ({ t }));
  }
}

const tri = (phase) => (phase < 0.5 ? phase * 2 : 2 - phase * 2); // 0→1→0
const phaseOf = (e, period) => ((e / period) % 1 + 1) % 1;

/** 01 ジャストバー：左右往復する針が中央に来たらタップ */
export class JustBarModel extends BaseModel {
  static TH = { p: 0.07, g: 0.2, o: 0.45, m: 1.0 };
  constructor(level) {
    super(2000, level);
    this.period = 1200 / this.sp;
  }
  pos(t) {
    return tri(phaseOf(this.elapsed(t), this.period)) * 2 - 1; // -1(左端)〜+1(右端)
  }
  input(t) {
    if (this.done) return;
    const err = Math.abs(this.pos(t));
    this.finish(scoreFromError(err, JustBarModel.TH), { err });
  }
  botTimes() {
    return [this.period / 4];
  }
}

/** 02 ストップリング：縮小するリングが目標円と重なる瞬間にタップ */
export class StopRingModel extends BaseModel {
  static TH = { p: 0.045, g: 0.12, o: 0.3, m: 0.75 };
  constructor(level) {
    super(2000, level);
    this.hitAt = 1100 / this.sp;
    this.startSize = 2.6;
  }
  size(t) {
    return Math.max(0, this.startSize - ((this.startSize - 1) * this.elapsed(t)) / this.hitAt);
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

/** 03 パワー連打：2.5秒間の連打数で評価（9/14/18回基準、30回で満点） */
export class MashModel extends BaseModel {
  static SAME_PRESS_MS = 35;
  static MARKS = { GOOD: 9, GREAT: 14, PERFECT: 18, MAX: 30 };
  constructor(level) {
    super(2500, level);
    this.count = 0;
    this.lastAt = -Infinity;
    this.lastPointer = null;
  }
  static scoreFromCount(c) {
    if (c >= 30) return 100;
    if (c >= 18) return 97 + ((c - 18) * 3) / 12;
    if (c >= 14) return 80 + ((c - 14) * 16.9) / 4;
    if (c >= 9) return 50 + ((c - 9) * 29.9) / 5;
    return (c * 49.9) / 9;
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
    return Array.from({ length: 30 }, (_, i) => 40 + i * 80);
  }
}

/** 04 ピタ止めゲージ：上下するゲージを最大値付近で停止 */
export class GaugeModel extends BaseModel {
  static TH = { p: 0.035, g: 0.12, o: 0.3, m: 0.75 };
  constructor(level) {
    super(2000, level);
    this.period = 1400 / this.sp;
  }
  value(t) {
    return tri(phaseOf(this.elapsed(t), this.period));
  }
  input(t) {
    if (this.done) return;
    const v = this.value(t);
    this.finish(scoreFromError(1 - v, GaugeModel.TH), { value: v });
  }
  botTimes() {
    return [this.period / 2];
  }
}

/** 05 光速リアクション：0.5〜1.2秒後の NOW 表示に反応。早押しは MISS */
export class ReactionModel extends BaseModel {
  static TH = { p: 60, g: 160, o: 320, m: 700 };
  static FLOOR_MS = 180; // これより速い反応は満点
  constructor(level, rand = Math.random) {
    super(2000, level);
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
    return [this.nowAt + 170];
  }
}

/** 複数のタイミングに合わせてタップし、平均精度で評価する共通ロジック */
class MultiTimingModel extends BaseModel {
  constructor(limitMs, level, targets, th) {
    super(limitMs, level);
    this.targets = targets;
    this.th = th;
    this.errors = targets.map(() => null);
    this.scores = targets.map(() => null);
  }
  get next() {
    return this.scores.findIndex((s) => s === null);
  }
  judge(i, err) {
    this.errors[i] = err;
    this.scores[i] = Number.isFinite(err) ? scoreFromError(err, this.th) : 0;
    if (this.next === -1) this.complete();
  }
  complete() {
    const avg = this.scores.reduce((a, b) => a + (b ?? 0), 0) / this.scores.length;
    this.finish(avg, { errors: this.errors.slice() });
  }
  /** 戻り値: 判定したノーツ番号と得点 */
  input(t) {
    if (this.done) return null;
    this.update(t);
    const i = this.next;
    if (i < 0 || this.done) return null;
    const diff = this.elapsed(t) - this.targets[i];
    this.judge(i, diff < -this.th.m ? Infinity : Math.abs(diff)); // 早すぎはそのノーツをMISS
    return { index: i, score: this.scores[i] };
  }
  update(t) {
    if (this.done) return;
    const e = this.elapsed(t);
    let i;
    while ((i = this.next) >= 0 && e > this.targets[i] + this.th.m) this.judge(i, Infinity);
    if (!this.done && e >= this.limitMs) this.complete();
  }
  botTimes() {
    return this.targets.slice();
  }
}

/** 06 3連ジャスト：3つの到達タイミングに合わせてタップ */
export class TripleModel extends MultiTimingModel {
  static TH = { p: 45, g: 95, o: 165, m: 260 };
  constructor(level) {
    const sp = 1 + 0.08 * level;
    super(3000, level, [800, 1450, 2100].map((t) => t / sp), TripleModel.TH);
  }
}

/** 07 ピタリ1秒：途中で表示が消えるストップウォッチを 1.00 秒ちょうどで止める */
export class StopwatchModel extends BaseModel {
  static TH = { p: 20, g: 60, o: 140, m: 350 };
  static TARGET = 1000;
  constructor(level) {
    super(2200, level);
    this.hideAt = 500 - 60 * level; // 後半ほど早く消える
  }
  input(t) {
    if (this.done) return;
    const e = this.elapsed(t);
    this.finish(scoreFromError(e - StopwatchModel.TARGET, StopwatchModel.TH), { ms: Math.round(e) });
  }
  botTimes() {
    return [StopwatchModel.TARGET];
  }
}

/** 08 リズムパンチ：3拍のお手本を聞いて、続きの3拍を自分でタップ */
export class RhythmModel extends MultiTimingModel {
  static TH = { p: 40, g: 85, o: 150, m: 250 };
  constructor(level) {
    const iv = 450 / (1 + 0.08 * level);
    super(iv * 6 + 400, level, [iv * 4, iv * 5, iv * 6], RhythmModel.TH);
    this.iv = iv;
    this.guides = [iv, iv * 2, iv * 3];
  }
}

/** 09 動くアイツを狙え：動き回る顔の中心をタップ（位置の精度で評価） */
export class TargetModel extends BaseModel {
  static TH = { p: 0.15, g: 0.4, o: 0.75, m: 1.2 };
  static R = 85;
  constructor(level, rand = Math.random) {
    super(2000, level);
    this.px = 1500 / this.sp;
    this.py = 1100 / this.sp;
    this.phase = rand() * Math.PI * 2;
  }
  /** ゲーム領域の中心を原点とした座標 */
  pos(t) {
    const e = this.elapsed(t);
    return {
      x: 220 * Math.sin((2 * Math.PI * e) / this.px + this.phase),
      y: 105 * Math.sin((2 * Math.PI * e) / this.py + this.phase * 1.7 + 0.7),
    };
  }
  input(t, _id, x = 0, y = 0) {
    if (this.done) return;
    const p = this.pos(t);
    const err = Math.hypot(x - p.x, y - p.y) / TargetModel.R;
    this.finish(scoreFromError(err, TargetModel.TH), { err, x, y });
  }
  botInputs() {
    const t = 700;
    const p = this.pos(this.t0 + t);
    return [{ t, x: p.x, y: p.y }];
  }
  botTimes() {
    return [700];
  }
}

/** 10 回転ルーレット：回る針が金色のマスの中心に来たらタップ */
export class SpinModel extends BaseModel {
  static TH = { p: 0.03, g: 0.08, o: 0.18, m: 0.45 };
  constructor(level, rand = Math.random) {
    super(2200, level);
    this.period = 900 / this.sp;
    this.goal = Math.PI * (0.6 + rand() * 0.8); // 目標の角度（真上から時計回り）
  }
  angle(t) {
    return (2 * Math.PI * phaseOf(this.elapsed(t), this.period));
  }
  input(t) {
    if (this.done) return;
    let d = Math.abs(this.angle(t) - this.goal) % (2 * Math.PI);
    if (d > Math.PI) d = 2 * Math.PI - d;
    const err = d / Math.PI;
    this.finish(scoreFromError(err, SpinModel.TH), { err });
  }
  botTimes() {
    return [(this.goal / (2 * Math.PI)) * this.period];
  }
}

export function createModel(id, rand = Math.random, level = 0) {
  switch (id) {
    case 'justbar':
      return new JustBarModel(level);
    case 'stopring':
      return new StopRingModel(level);
    case 'mash':
      return new MashModel(level);
    case 'gauge':
      return new GaugeModel(level);
    case 'reaction':
      return new ReactionModel(level, rand);
    case 'triple':
      return new TripleModel(level);
    case 'stopwatch':
      return new StopwatchModel(level);
    case 'rhythm':
      return new RhythmModel(level);
    case 'target':
      return new TargetModel(level, rand);
    case 'spin':
      return new SpinModel(level, rand);
    default:
      throw new Error(`unknown minigame ${id}`);
  }
}
