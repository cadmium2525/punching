// Firestore Rules のテスト（npm run test:rules で Firestore エミュレーターを起動して実行）
import { readFileSync } from 'node:fs';
import { describe, it, beforeAll, beforeEach, afterAll } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, collection, updateDoc, deleteDoc, writeBatch, serverTimestamp, Timestamp } from 'firebase/firestore';
import { jstDay } from '../../src/core/date.js';
import { powerFromAccs } from '../../src/core/scoring.js';

let env;
const P5 = [1000, 990, 985, 975, 1000]; // 全PERFECT
const GOOD5 = Array(5).fill(600);
const GREAT5 = Array(5).fill(850);

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-punch',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(() => env?.cleanup());
beforeEach(() => env.clearFirestore());

const db = (uid) => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());
const entry = (uid, accs, extra = {}) => ({
  uid,
  day: jstDay(),
  nickname: 'テスト',
  power: powerFromAccs(accs),
  accs,
  characterId: 'preset-01',
  achievedAt: serverTimestamp(),
  ...extra,
});

async function seedUser(uid, data = { nickname: 'テスト' }) {
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'users', uid), data));
}

function submit(uid, accs, { extra = {}, bump = true, dayId = jstDay(), targets = ['daily', 'alltime'] } = {}) {
  const d = db(uid);
  const b = writeBatch(d);
  if (bump) b.update(doc(d, 'users', uid), { lastSubmitAt: serverTimestamp() });
  if (targets.includes('daily')) b.set(doc(d, 'daily', `${dayId}_${uid}`), entry(uid, accs, extra));
  if (targets.includes('alltime')) b.set(doc(d, 'alltime', uid), entry(uid, accs, extra));
  return b.commit();
}

describe('users', () => {
  it('本人はニックネームを作成できる', () => assertSucceeds(setDoc(doc(db('alice'), 'users', 'alice'), { nickname: 'アリス' })));
  it('他人のドキュメントは作れない', () => assertFails(setDoc(doc(db('alice'), 'users', 'bob'), { nickname: 'x' })));
  it('不正なニックネームは拒否', async () => {
    await assertFails(setDoc(doc(db('alice'), 'users', 'alice'), { nickname: '' }));
    await assertFails(setDoc(doc(db('alice'), 'users', 'alice'), { nickname: 'あ'.repeat(13) }));
    await assertFails(setDoc(doc(db('alice'), 'users', 'alice'), { nickname: '<script>' }));
  });
  it('作成時に lastSubmitAt を勝手に入れられない', () => assertFails(setDoc(doc(db('alice'), 'users', 'alice'), { nickname: 'a', lastSubmitAt: serverTimestamp() })));
  it('他人のユーザー情報は読めない', async () => {
    await seedUser('bob');
    await assertFails(getDoc(doc(db('alice'), 'users', 'bob')));
    await assertSucceeds(getDoc(doc(db('bob'), 'users', 'bob')));
  });
});

describe('スコア送信', () => {
  beforeEach(() => seedUser('alice'));

  it('正しい送信は成功（全PERFECT＋精度ボーナス）', () => assertSucceeds(submit('alice', P5)));
  it('満点3200も成功', () => assertSucceeds(submit('alice', Array(5).fill(1000))));
  it('コンボ途切れ・精度ボーナスの正しい計算は成功', () => assertSucceeds(submit('alice', [1000, 975, 930, 999, 970])));
  it('パワー改ざんは拒否', async () => {
    await assertFails(submit('alice', P5, { extra: { power: 99999 } }));
    await assertFails(submit('alice', GOOD5, { extra: { power: 3200 } }));
    await assertFails(submit('alice', P5, { extra: { power: powerFromAccs(P5) + 1 } }));
  });
  it('精度の数や範囲がおかしいものは拒否', async () => {
    await assertFails(submit('alice', [1000, 1000, 1000, 1000], { extra: { power: 1800 } }));
    await assertFails(submit('alice', [1001, 1000, 1000, 1000, 1000], { extra: { power: 3200 } }));
    await assertFails(submit('alice', [-1, 1000, 1000, 1000, 1000]));
    await assertFails(submit('alice', [99.5, 1000, 1000, 1000, 1000], { extra: { power: 3000 } }));
  });
  it('余計なフィールド・写真データは拒否', async () => {
    await assertFails(submit('alice', P5, { extra: { photo: 'data:image/png;base64,AAAA' } }));
    await assertFails(submit('alice', P5, { extra: { characterId: 'custom-abc' } }));
    await assertFails(submit('alice', P5, { extra: { characterId: 'preset-05' } }));
    await assertSucceeds(submit('alice', P5, { extra: { characterId: 'custom' } }));
  });
  it('達成時刻をクライアントが決めるのは拒否', () => assertFails(submit('alice', P5, { extra: { achievedAt: Timestamp.fromMillis(0) } })));
  it('日付の改ざんは拒否', async () => {
    await assertFails(submit('alice', P5, { dayId: 20200101, targets: ['daily'] }));
    await assertFails(submit('alice', P5, { extra: { day: 20200101 }, targets: ['alltime'] }));
  });
  it('レート制限の更新なしでは書けない', () => assertFails(submit('alice', P5, { bump: false })));
  it('10秒以内の連続送信は拒否', async () => {
    await assertSucceeds(submit('alice', GOOD5));
    await assertFails(submit('alice', P5));
  });
  it('10秒経てば更新できるが、自己ベスト以下は書けない', async () => {
    await assertSucceeds(submit('alice', GREAT5));
    const past = Timestamp.fromMillis(Date.now() - 60_000);
    await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), 'users', 'alice'), { lastSubmitAt: past }));
    await assertFails(submit('alice', GOOD5));
    await assertSucceeds(submit('alice', P5));
  });
  it('他人になりすまして書けない', async () => {
    await seedUser('bob');
    const d = db('alice');
    const b = writeBatch(d);
    b.update(doc(d, 'users', 'alice'), { lastSubmitAt: serverTimestamp() });
    b.set(doc(d, 'alltime', 'bob'), entry('bob', P5));
    await assertFails(b.commit());
  });
  it('ニックネームだけの変更はできる／他の項目は変えられない', async () => {
    await assertSucceeds(submit('alice', GOOD5));
    await assertSucceeds(updateDoc(doc(db('alice'), 'alltime', 'alice'), { nickname: '新しい名前' }));
    await assertFails(updateDoc(doc(db('alice'), 'alltime', 'alice'), { power: 2700 }));
  });
  it('削除はできない', async () => {
    await assertSucceeds(submit('alice', P5));
    await assertFails(deleteDoc(doc(db('alice'), 'alltime', 'alice')));
  });
});

describe('読み取り', () => {
  it('ログイン済みならランキングを読める／未ログインは不可', async () => {
    await assertSucceeds(getDocs(collection(db('alice'), 'alltime')));
    await assertFails(getDocs(collection(db(null), 'alltime')));
  });
  it('その他のコレクションは読み書き不可', async () => {
    await assertFails(setDoc(doc(db('alice'), 'secret', 'x'), { a: 1 }));
  });
});
