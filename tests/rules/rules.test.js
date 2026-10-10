// Firestore Rules のテスト（npm run test:rules で Firestore エミュレーターを起動して実行）
import { readFileSync } from 'node:fs';
import { describe, it, beforeAll, beforeEach, afterAll } from 'vitest';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, collection, updateDoc, deleteDoc, writeBatch, serverTimestamp, Timestamp } from 'firebase/firestore';
import { jstDay } from '../../src/core/date.js';
import { powerFromGrades } from '../../src/core/scoring.js';

let env;
const P5 = Array(5).fill('PERFECT');

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-punch',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});
afterAll(() => env?.cleanup());
beforeEach(() => env.clearFirestore());

const db = (uid) => (uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore());
const entry = (uid, grades, extra = {}) => ({
  uid,
  day: jstDay(),
  nickname: 'テスト',
  power: powerFromGrades(grades),
  grades,
  characterId: 'preset-01',
  achievedAt: serverTimestamp(),
  ...extra,
});

async function seedUser(uid, data = { nickname: 'テスト' }) {
  await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'users', uid), data));
}

function submit(uid, grades, { extra = {}, bump = true, dayId = jstDay(), targets = ['daily', 'alltime'] } = {}) {
  const d = db(uid);
  const b = writeBatch(d);
  if (bump) b.update(doc(d, 'users', uid), { lastSubmitAt: serverTimestamp() });
  if (targets.includes('daily')) b.set(doc(d, 'daily', `${dayId}_${uid}`), entry(uid, grades, extra));
  if (targets.includes('alltime')) b.set(doc(d, 'alltime', uid), entry(uid, grades, extra));
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

  it('正しい送信は成功（全PERFECT=2700）', () => assertSucceeds(submit('alice', P5)));
  it('コンボ途切れの正しい計算は成功', () => assertSucceeds(submit('alice', ['PERFECT', 'PERFECT', 'GREAT', 'PERFECT', 'PERFECT'])));
  it('パワー改ざんは拒否', async () => {
    await assertFails(submit('alice', P5, { extra: { power: 99999 } }));
    await assertFails(submit('alice', ['GOOD', 'GOOD', 'GOOD', 'GOOD', 'GOOD'], { extra: { power: 2700 } }));
  });
  it('判定の数や種類がおかしいものは拒否', async () => {
    await assertFails(submit('alice', ['PERFECT', 'PERFECT', 'PERFECT', 'PERFECT'], { extra: { power: 1800 } }));
    await assertFails(submit('alice', ['SUPER', 'PERFECT', 'PERFECT', 'PERFECT', 'PERFECT'], { extra: { power: 2700 } }));
  });
  it('余計なフィールド・写真データは拒否', async () => {
    await assertFails(submit('alice', P5, { extra: { photo: 'data:image/png;base64,AAAA' } }));
    await assertFails(submit('alice', P5, { extra: { characterId: 'custom-abc' } }));
    await assertSucceeds(submit('alice', P5, { extra: { characterId: 'custom' } }));
  });
  it('達成時刻をクライアントが決めるのは拒否', () => assertFails(submit('alice', P5, { extra: { achievedAt: Timestamp.fromMillis(0) } })));
  it('日付の改ざんは拒否', async () => {
    await assertFails(submit('alice', P5, { dayId: 20200101, targets: ['daily'] }));
    await assertFails(submit('alice', P5, { extra: { day: 20200101 }, targets: ['alltime'] }));
  });
  it('レート制限の更新なしでは書けない', () => assertFails(submit('alice', P5, { bump: false })));
  it('10秒以内の連続送信は拒否', async () => {
    await assertSucceeds(submit('alice', ['GOOD', 'GOOD', 'GOOD', 'GOOD', 'GOOD']));
    await assertFails(submit('alice', P5));
  });
  it('10秒経てば更新できるが、自己ベスト以下は書けない', async () => {
    await assertSucceeds(submit('alice', ['GREAT', 'GREAT', 'GREAT', 'GREAT', 'GREAT']));
    const past = Timestamp.fromMillis(Date.now() - 60_000);
    await env.withSecurityRulesDisabled((c) => updateDoc(doc(c.firestore(), 'users', 'alice'), { lastSubmitAt: past }));
    await assertFails(submit('alice', ['GOOD', 'GOOD', 'GOOD', 'GOOD', 'GOOD']));
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
    await assertSucceeds(submit('alice', ['GOOD', 'GOOD', 'GOOD', 'GOOD', 'GOOD']));
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
