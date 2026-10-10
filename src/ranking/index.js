// ランキング：Firebase（Spark 無料プラン）または端末内のみ
import { isFirebaseConfigured, firebaseConfig, recaptchaSiteKey, emulatorHost } from './config.js';
import { topLocal } from '../storage/records.js';
import { distanceFromPower } from '../core/scoring.js';
import { jstDay } from '../core/date.js';
import { cleanNickname, isValidNickname } from './validate.js';

class LocalRanking {
  online = false;
  nickname = null;
  async init() {}
  async submit() {
    return null;
  }
  async top() {
    return topLocal(10).map((r) => ({ nickname: 'あなた', power: r.power, km: r.km, characterId: r.characterId, isMe: true, at: r.at }));
  }
  async myRank() {
    return null;
  }
}

function friendly(e) {
  const err = new Error(e?.message || String(e));
  if (e?.code === 'permission-denied') err.userMessage = '少し時間をおいてね';
  else if (e?.code === 'unavailable') err.userMessage = 'オフラインです';
  else err.userMessage = '送信できませんでした';
  return err;
}

class FirebaseRanking {
  online = true;
  nickname = null;
  uid = null;
  _ready = null;

  init() {
    if (!this._ready) this._ready = this._init().catch((e) => {
      this.online = false;
      throw e;
    });
    return this._ready;
  }

  async _init() {
    const [{ initializeApp }, A, F] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore')]);
    this.F = F;
    const app = initializeApp(firebaseConfig);
    if (recaptchaSiteKey && !emulatorHost) {
      const { initializeAppCheck, ReCaptchaV3Provider } = await import('firebase/app-check');
      initializeAppCheck(app, { provider: new ReCaptchaV3Provider(recaptchaSiteKey), isTokenAutoRefreshEnabled: true });
    }
    const auth = A.getAuth(app);
    this.db = F.getFirestore(app);
    if (emulatorHost) {
      A.connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
      F.connectFirestoreEmulator(this.db, emulatorHost, 8080);
    }
    const cred = await A.signInAnonymously(auth);
    this.uid = cred.user.uid;
    const u = await F.getDoc(F.doc(this.db, 'users', this.uid));
    this.nickname = u.exists() ? u.data().nickname : null;
  }

  async setNickname(raw) {
    await this.init();
    const { F, db, uid } = this;
    const nickname = cleanNickname(raw);
    if (!isValidNickname(nickname)) throw new Error('invalid nickname');
    const userRef = F.doc(db, 'users', uid);
    const u = await F.getDoc(userRef);
    const batch = F.writeBatch(db);
    if (u.exists()) batch.update(userRef, { nickname });
    else batch.set(userRef, { nickname });
    const day = jstDay();
    for (const ref of [F.doc(db, 'alltime', uid), F.doc(db, 'daily', `${day}_${uid}`)]) {
      const s = await F.getDoc(ref);
      if (s.exists()) batch.update(ref, { nickname });
    }
    try {
      await batch.commit();
    } catch (e) {
      throw friendly(e);
    }
    this.nickname = nickname;
  }

  /** 自己ベスト更新時だけ書き込む。Rules がパワーを再計算・日付・レート制限を検証する */
  async submit(state) {
    await this.init();
    if (!this.nickname) return null;
    const { F, db, uid } = this;
    const day = jstDay();
    const dailyRef = F.doc(db, 'daily', `${day}_${uid}`);
    const allRef = F.doc(db, 'alltime', uid);
    const [d, a] = await Promise.all([F.getDoc(dailyRef), F.getDoc(allRef)]);
    const power = state.power;
    const betterDaily = !d.exists() || power > d.data().power;
    const betterAll = !a.exists() || power > a.data().power;
    if (betterDaily || betterAll) {
      const entry = {
        uid,
        day,
        nickname: this.nickname,
        power,
        accs: state.accs,
        characterId: state.characterId.startsWith('preset-') ? state.characterId : 'custom', // 写真は送らない
        achievedAt: F.serverTimestamp(),
      };
      const batch = F.writeBatch(db);
      batch.update(F.doc(db, 'users', uid), { lastSubmitAt: F.serverTimestamp() });
      if (betterDaily) batch.set(dailyRef, entry);
      if (betterAll) batch.set(allRef, entry);
      try {
        await batch.commit();
      } catch (e) {
        throw friendly(e);
      }
    }
    const best = betterDaily ? power : d.data().power;
    const dailyRank = await this._rankAbove(F.query(F.collection(db, 'daily'), F.where('day', '==', day), F.where('power', '>', best)));
    return { dailyRank, improved: betterDaily || betterAll };
  }

  async _rankAbove(q) {
    const snap = await this.F.getCountFromServer(q);
    return snap.data().count + 1;
  }

  async top(kind = 'daily', n = 20) {
    await this.init();
    const { F, db } = this;
    const q =
      kind === 'daily'
        ? F.query(F.collection(db, 'daily'), F.where('day', '==', jstDay()), F.orderBy('power', 'desc'), F.orderBy('achievedAt', 'asc'), F.limit(n))
        : F.query(F.collection(db, 'alltime'), F.orderBy('power', 'desc'), F.orderBy('achievedAt', 'asc'), F.limit(n));
    const snap = await F.getDocs(q);
    return snap.docs.map((s) => {
      const v = s.data();
      return { nickname: v.nickname, power: v.power, km: distanceFromPower(v.power), characterId: v.characterId, isMe: v.uid === this.uid };
    });
  }

  async myRank(kind = 'daily') {
    await this.init();
    const { F, db, uid } = this;
    const day = jstDay();
    const ref = kind === 'daily' ? F.doc(db, 'daily', `${day}_${uid}`) : F.doc(db, 'alltime', uid);
    const s = await F.getDoc(ref);
    if (!s.exists()) return null;
    const p = s.data().power;
    const base = kind === 'daily' ? F.query(F.collection(db, 'daily'), F.where('day', '==', day), F.where('power', '>', p)) : F.query(F.collection(db, 'alltime'), F.where('power', '>', p));
    return { rank: await this._rankAbove(base), power: p, km: distanceFromPower(p) };
  }
}

export const ranking = isFirebaseConfigured ? new FirebaseRanking() : new LocalRanking();
