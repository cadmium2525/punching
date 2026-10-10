# 31秒版 PV（tools/record-pv.mjs の出力）から15秒版を切り出す。
#   python3 tools/make-pv15.py pv-out pv15
#   node tools/render-pv-audio.mjs pv15/log.json $(cat pv15/dur) pv15/audio.wav
# 映像は見どころをつなぎ、効果音は映像に合わせて時刻をずらし、BGM は通しで作り直す。
import json, os, shutil, sys

PV, E = sys.argv[1:3]
FPS = 30
# (開始秒, 終了秒, BGMモード or None=止める, 風切り音)
SEGS = [
    (0.0, 1.6, 'calm', False),     # タイトル
    (6.9, 7.9, 'fight', False),    # 動くアイツを狙え
    (9.9, 11.5, 'fight', False),   # 連打
    (13.9, 15.2, 'fight', False),  # NOW!
    (15.5, 17.3, None, False),     # GOD PUNCH
    (20.5, 24.7, 'flight', True),  # 虹の飛行
    (27.05, 30.55, 'calm', False), # エンドカード
]
os.makedirs(f'{E}/frames', exist_ok=True)
log = json.load(open(f'{PV}/log.json'))
nframes = len(os.listdir(f'{PV}/frames'))
out, t0, k, mode = [], 0.0, 0, 'unset'
for a, b, m, wind in SEGS:
    fa, fb = round(a * FPS), min(round(b * FPS), nframes)
    for f in range(fa, fb):
        shutil.copy(f'{PV}/frames/{f:05d}.jpg', f'{E}/frames/{k:05d}.jpg')
        k += 1
    off = (t0 - a) * 1000
    if m != mode:
        out.append({'name': 'bgmStop' if m is None else 'bgmPlay', 'args': [] if m is None else [m], 't': t0 * 1000})
        mode = m
    if wind:
        out.append({'name': 'windStart', 'args': [], 't': t0 * 1000})
    for e in log:
        if e['name'].startswith('bgm') or e['name'] in ('windStart', 'windStop'):
            continue
        if e['name'] == 'windSet' and not wind:
            continue
        if a * 1000 <= e['t'] < b * 1000:
            out.append({**e, 't': e['t'] + off})
    t0 += (fb - fa) / FPS
    if wind:
        out.append({'name': 'windStop', 'args': [], 't': t0 * 1000 - 1})
out.sort(key=lambda e: e['t'])
json.dump(out, open(f'{E}/log.json', 'w'))
open(f'{E}/dur', 'w').write(str(k / FPS))
print(f'frames {k} ({k / FPS:.2f}s)')
