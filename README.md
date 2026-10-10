# ぶっ飛ばせ！ムカつくアイツ！

5回のミニゲームでパンチ力を溜めて、ムカつくアイツを銀河の向こうまでぶっ飛ばす、スマホ縦画面のハイパーカジュアルゲームです。

- 1プレイ約26秒：対戦開始 → ミニゲーム×5 → フィニッシュパンチ → 自動飛行 → リザルト
- 全10種のミニゲームから毎回5種を重複なしで出題。ラウンドが進むほど速くなる
  - ジャストバー／ストップリング／パワー連打／ピタ止めゲージ／光速リアクション／3連ジャスト
  - ピタリ1秒（途中で数字が消える）／リズムパンチ（お手本3拍の続きを叩く）／動くアイツを狙え（顔面をタップ）／回転ルーレット
- 判定は 0.1% 刻みの「精度」で決まる。PERFECT の中でもど真ん中ほど **精度ボーナス** が入るので、全PERFECTでも 3050〜3200 POWER に分かれ、ランキングが同点で埋まらない
- 全PERFECTで **GOD PUNCH**。天の川銀河 → アンドロメダ → 銀河団 → 超銀河団の果て（最大約3.8億光年）まで吹っ飛ぶ
- プリセット11人（立ち姿の「煽りリーマン」＋上半身の10人）＋**写真からキャラ作成**（背景除去は端末内のみ・写真は送信しない）
- キャラは丸枠なしでそのまま表示。全身画像なら立ち姿のまま殴られて、くるくる回りながら吹っ飛ぶ
- 飛行中は虹の帯・虹のアーチ・虹色の流れ星・「RAINBOW RUSH!!」でドーパミン全開（光の点滅を減らす設定で控えめに）
- 効果音・BGMはすべてコードで合成（音源ファイルなし）
- 設定：光の点滅を減らす／画面揺れを減らす／効果音・BGM音量

## コスト

**すべて無料枠で動きます。** 有料サービスは使っていません。

| 用途 | 使うもの | 料金 |
|---|---|---|
| 公開 | GitHub Pages | 無料（public リポジトリ） |
| ランキング | Firebase **Spark プラン**（Firestore＋匿名認証） | 無料。クレカ登録不要。無料枠を超えると止まるだけで請求は発生しない |
| 不正対策 | Firestore Rules ＋ App Check（reCAPTCHA v3） | 無料 |
| 写真の背景除去 | MediaPipe（ブラウザ内で実行） | 無料・サーバー不要 |

Cloud Functions は従量課金の Blaze プランが必要になるため使っていません。

## 開発

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 単体テスト（判定・パワー・飛距離・ミニゲーム）
npm run build      # dist/ に出力（相対パスなのでどのサブパスでも動く）
npm run test:e2e   # ブラウザ通しテスト（build 後に実行）
npm run test:rules # Firestore Rules テスト（エミュレーター。Java が必要）
npm run test:online # エミュレーター上でゲーム→ランキング登録の通しテスト
```

テスト用URLパラメータ：`?test&bot=perfect`（自動でど真ん中を連打）、`bot=miss`、`bot=random`、`&fast`（演出短縮）、`&games=justbar,mash,...`（出題固定）。

## GitHub Pages で公開する

1. このリポジトリを GitHub に push（`main` ブランチ）
2. GitHub のリポジトリ → **Settings → Pages → Build and deployment → Source** を **GitHub Actions** にする
3. `main` に push するたびに `.github/workflows/deploy.yml` がテスト→ビルド→公開します

Firebase を設定しなくても、端末内の自己ベストで普通に遊べます。

## オンラインランキングを有効にする（任意・無料）

1. [Firebase コンソール](https://console.firebase.google.com/) でプロジェクトを作成（**Spark プランのまま**でOK。Google アナリティクスは不要）
2. **Authentication → Sign-in method → 匿名** を有効化
3. **Firestore Database** を作成（本番モード、ロケーションは `asia-northeast1` など）
4. **プロジェクトの設定 → マイアプリ → Web アプリを追加**して、表示された `apiKey` / `authDomain` / `projectId` / `appId` を控える
5. Authentication → 設定 → **承認済みドメイン** に `<ユーザー名>.github.io` を追加
6. ルールとインデックスをデプロイ：
   ```bash
   cp .firebaserc.example .firebaserc   # project id を書き換え
   npx firebase login
   npx firebase deploy --only firestore
   ```
7. GitHub リポジトリ → Settings → Secrets and variables → Actions → **Variables** に登録：
   `FIREBASE_API_KEY` `FIREBASE_AUTH_DOMAIN` `FIREBASE_PROJECT_ID` `FIREBASE_APP_ID`
   （Firebase の Web 設定は公開されても問題ない値です）
8. （推奨）**App Check**：reCAPTCHA v3 のサイトキーを作り（無料）、App Check に登録して Firestore の適用を ON。サイトキーを Variables の `RECAPTCHA_SITE_KEY` に登録
9. もう一度 push すると反映

ローカルで試すときは `.env.local` に `VITE_FIREBASE_API_KEY=...` などを書きます。

### 不正対策の範囲（正直なところ）

Rules で次を強制しています：本人のドキュメントにしか書けない／5回の精度からパワーを再計算して一致しないと拒否／日付は日本時間のサーバー時刻で決まる／自己ベスト更新時だけ書ける／10秒に1回まで／余計なフィールド（写真データ等）は拒否／削除不可。

ただし、ゲームの判定そのものはブラウザで行うため、改造クライアントが「全部ど真ん中だった」と嘘をつくことは防げません（最大値は 3200 POWER に限定されます）。完全に防ぐにはサーバーでゲームを再現する必要があり、無料構成の範囲外です。App Check を有効にするとスクリプトからの直接送信をかなり減らせます。

## プライバシー

- 写真はサーバーに送信しません。背景除去はブラウザ内で行い、端末内（IndexedDB）にだけ保存します
- 使えるのは自分の写真、または本人の許可を得た写真のみ（作成時に同意チェックが必須）
- ランキングに送るのは ニックネーム・パワー・判定・プリセット番号のみ。写真キャラは「写真」とだけ表示
- 写真キャラは「設定 → 写真キャラをすべて削除」またはキャラ選択で長押しして削除できます

## 仕様書からの変更点

- **飛距離式**：Ver.2.1 の `round(0.1 × P^2.4)` では最大でも約1,720万kmで銀河に届かないため、
  `round(10^(3 + 15.3 × (P − 350) / 2350))` に再調整しました（`data/game_config.json`）。
  全MISS(350)=1,000km、全GREAT(1100)≒7,600万km、全PERFECT(3050〜3200)≒4,000万〜3.8億光年。
  天の川銀河を突破できるのは GOD PUNCH だけです。飛行演出の通過ポイント（月・火星・太陽・…・ラニアケア超銀河団）は実距離に対応しています。
- **ミニゲーム**：6種 → 10種。PERFECT の判定幅を約3割狭くし、ラウンドごとに8%ずつ速くなる
- **パワー**：最大 2700 → 3200。精度(0〜1000)を導入し、`判定ポイント＋PERFECT連続ボーナス＋精度ボーナス(各ラウンド max(0, 精度−900))`。
  判定の境界は PERFECT ≥97.0% / GREAT ≥80.0% / GOOD ≥50.0%。ランキングに送るのも5回分の精度で、Rules がパワーを再計算して検証します
- **ランキング**：Cloud Functions ではなく Firestore Rules で検証（無料プランのため）
- **人物セグメンテーション**：ONNX Runtime Web の代わりに MediaPipe Image Segmenter（selfie_segmenter, Apache-2.0）を同梱
- キャラ画像は WebP（透過）。`public/assets/characters/character_NN.webp`
  - 11番は全身の立ち姿。01〜10 は仮素材の胸上ポートレート（市松模様が画像に焼き込まれています）
  - 全身画像に差し替える場合は、透過 WebP を置いて `src/characters.js` の `FACE_META` に顔の位置（`fx`,`fy`＝トリミング後の画像に対する比率、`face`＝顔の高さ÷全身の高さ）を書くと、パンチが顔に当たります

## 構成

```
src/core/        判定・パワー・飛距離・状態（純粋関数、単体テスト対象）
src/minigames/   models.js（判定ロジック）／views.js（描画）
src/scenes/      Boot / Home / Select / MiniGame / Punch / Flight / Result / Ranking / Settings
src/ranking/     Firebase（Spark）または端末内ランキング
src/photo/       写真キャラ作成（端末内セグメンテーション）
src/audio/sfx.js Web Audio による効果音・BGM合成
firestore.rules  ランキングの検証ルール
docs/            仕様書 Ver.2.1・ワイヤーフレーム・コンセプトボード
```
