// 手続き生成テクスチャ（画像アセット不要）
function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function add(scene, key, c) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, c);
}

function radial(ctx, x, y, r, stops) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}

function star(ctx, cx, cy, spikes, outer, inner, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = rot + (i * Math.PI) / spikes;
    ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  ctx.closePath();
}

function planet(scene, key, size, base, light, dark, extra) {
  const [c, x] = canvas(size);
  const r = size / 2 - 2;
  x.save();
  x.beginPath();
  x.arc(size / 2, size / 2, r, 0, Math.PI * 2);
  x.clip();
  x.fillStyle = base;
  x.fillRect(0, 0, size, size);
  extra?.(x, size);
  x.fillStyle = radial(x, size * 0.35, size * 0.32, size * 0.9, [
    [0, light],
    [0.5, 'rgba(0,0,0,0)'],
    [1, dark],
  ]);
  x.fillRect(0, 0, size, size);
  x.restore();
  add(scene, key, c);
}

export function makeTextures(scene) {
  // 柔らかい光の粒
  {
    const [c, x] = canvas(64);
    x.fillStyle = radial(x, 32, 32, 32, [
      [0, 'rgba(255,255,255,1)'],
      [0.35, 'rgba(255,255,255,0.8)'],
      [1, 'rgba(255,255,255,0)'],
    ]);
    x.fillRect(0, 0, 64, 64);
    add(scene, 'spark', c);
  }
  // 小さな点
  {
    const [c, x] = canvas(8);
    x.fillStyle = '#fff';
    x.beginPath();
    x.arc(4, 4, 3.5, 0, Math.PI * 2);
    x.fill();
    add(scene, 'dot', c);
  }
  // 星形
  {
    const [c, x] = canvas(64);
    star(x, 32, 32, 5, 30, 13);
    x.fillStyle = '#fff';
    x.fill();
    add(scene, 'star', c);
  }
  // キラッ（4方向）
  {
    const [c, x] = canvas(64);
    star(x, 32, 32, 4, 31, 5);
    x.fillStyle = '#fff';
    x.fill();
    add(scene, 'twinkle', c);
  }
  // 破片
  {
    const [c, x] = canvas(24);
    x.fillStyle = '#fff';
    x.beginPath();
    x.moveTo(2, 4);
    x.lineTo(22, 0);
    x.lineTo(16, 22);
    x.closePath();
    x.fill();
    add(scene, 'shard', c);
  }
  // リング
  {
    const [c, x] = canvas(256);
    x.strokeStyle = '#fff';
    x.lineWidth = 14;
    x.beginPath();
    x.arc(128, 128, 118, 0, Math.PI * 2);
    x.stroke();
    add(scene, 'ring', c);
  }
  // 集中線用の細長い光
  {
    const [c, x] = canvas(16, 256);
    const g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(5, 0, 6, 256);
    add(scene, 'streak', c);
  }
  // 漫画の爆発
  {
    const [c, x] = canvas(512);
    star(x, 256, 256, 14, 250, 160, 0.2);
    x.fillStyle = '#e63946';
    x.fill();
    star(x, 256, 256, 14, 220, 140, 0.2);
    x.fillStyle = '#ffd23f';
    x.fill();
    star(x, 256, 256, 14, 150, 100, 0.4);
    x.fillStyle = '#fff6c2';
    x.fill();
    add(scene, 'boom', c);
  }
  // ボクシンググローブ（上向き）
  {
    const [c, x] = canvas(256);
    x.translate(128, 128);
    // 手首のカフ
    x.fillStyle = '#f2f2f2';
    roundRect(x, -52, 50, 104, 70, 16);
    x.fill();
    x.fillStyle = '#c9ced8';
    x.fillRect(-52, 92, 104, 10);
    // 本体
    const body = x.createRadialGradient(-30, -50, 10, 0, -10, 130);
    body.addColorStop(0, '#ff8a8a');
    body.addColorStop(0.35, '#ef2b2b');
    body.addColorStop(1, '#8c0b12');
    x.fillStyle = body;
    x.beginPath();
    x.ellipse(0, -18, 86, 92, 0, 0, Math.PI * 2);
    x.fill();
    // 親指
    x.beginPath();
    x.ellipse(-70, 18, 30, 44, -0.5, 0, Math.PI * 2);
    x.fill();
    x.strokeStyle = 'rgba(80,0,0,0.5)';
    x.lineWidth = 5;
    x.beginPath();
    x.ellipse(-62, 14, 24, 38, -0.5, -1.2, 1.4);
    x.stroke();
    // 指の溝
    x.beginPath();
    x.moveTo(-40, -60);
    x.quadraticCurveTo(-10, -40, 40, -62);
    x.stroke();
    // ハイライト
    x.fillStyle = 'rgba(255,255,255,0.55)';
    x.beginPath();
    x.ellipse(-28, -62, 30, 16, -0.5, 0, Math.PI * 2);
    x.fill();
    add(scene, 'glove', c);
  }
  // 雲
  {
    const [c, x] = canvas(256, 128);
    x.fillStyle = 'rgba(255,255,255,0.95)';
    [
      [70, 80, 45],
      [120, 60, 55],
      [175, 78, 45],
      [100, 90, 40],
      [150, 92, 40],
    ].forEach(([cx, cy, r]) => {
      x.beginPath();
      x.arc(cx, cy, r, 0, Math.PI * 2);
      x.fill();
    });
    add(scene, 'cloud', c);
  }
  // 惑星たち
  planet(scene, 'earth', 512, '#1f6fd6', 'rgba(255,255,255,0.35)', 'rgba(0,0,20,0.85)', (x, s) => {
    x.fillStyle = '#3fae5a';
    [
      [0.3, 0.35, 0.18, 0.12],
      [0.62, 0.5, 0.2, 0.15],
      [0.45, 0.72, 0.12, 0.08],
      [0.78, 0.25, 0.1, 0.07],
    ].forEach(([a, b, w, h]) => {
      x.beginPath();
      x.ellipse(a * s, b * s, w * s, h * s, 0.6, 0, Math.PI * 2);
      x.fill();
    });
    x.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i < 8; i++) {
      x.beginPath();
      x.ellipse(Math.random() * s, Math.random() * s, s * 0.15, s * 0.025, 0.3, 0, Math.PI * 2);
      x.fill();
    }
  });
  planet(scene, 'moon', 256, '#c9c9c9', 'rgba(255,255,255,0.5)', 'rgba(0,0,0,0.75)', (x, s) => {
    x.fillStyle = 'rgba(120,120,120,0.6)';
    for (let i = 0; i < 14; i++) {
      x.beginPath();
      x.arc(Math.random() * s, Math.random() * s, s * (0.03 + Math.random() * 0.07), 0, Math.PI * 2);
      x.fill();
    }
  });
  planet(scene, 'mars', 256, '#d2552c', 'rgba(255,200,150,0.45)', 'rgba(40,0,0,0.8)', (x, s) => {
    x.fillStyle = 'rgba(120,30,10,0.5)';
    for (let i = 0; i < 6; i++) {
      x.beginPath();
      x.ellipse(Math.random() * s, Math.random() * s, s * 0.2, s * 0.05, Math.random(), 0, Math.PI * 2);
      x.fill();
    }
  });
  planet(scene, 'jupiter', 384, '#d9a66b', 'rgba(255,240,210,0.4)', 'rgba(30,10,0,0.8)', (x, s) => {
    const bands = ['#b5794a', '#eccb9a', '#a8653a', '#f1d9b0', '#c58a58'];
    for (let i = 0; i < 12; i++) {
      x.fillStyle = bands[i % bands.length];
      x.fillRect(0, (i / 12) * s, s, s / 18);
    }
    x.fillStyle = '#b8462c';
    x.beginPath();
    x.ellipse(s * 0.65, s * 0.62, s * 0.1, s * 0.05, 0, 0, Math.PI * 2);
    x.fill();
  });
  planet(scene, 'neptune', 256, '#3a66e0', 'rgba(200,230,255,0.5)', 'rgba(0,0,40,0.85)', (x, s) => {
    x.fillStyle = 'rgba(120,170,255,0.5)';
    x.fillRect(0, s * 0.4, s, s * 0.05);
  });
  // 土星（輪つき）
  {
    const [c, x] = canvas(512, 300);
    const ring = (front) => {
      x.save();
      x.translate(256, 150);
      x.scale(1, 0.28);
      x.lineWidth = 34;
      x.strokeStyle = 'rgba(230,205,150,0.9)';
      x.beginPath();
      x.arc(0, 0, 210, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2);
      x.stroke();
      x.restore();
    };
    ring(false);
    const g = radial(x, 220, 110, 160, [
      [0, '#fff1c9'],
      [0.5, '#e0b878'],
      [1, '#6b4a1e'],
    ]);
    x.fillStyle = g;
    x.beginPath();
    x.arc(256, 150, 110, 0, Math.PI * 2);
    x.fill();
    ring(true);
    add(scene, 'saturn', c);
  }
  // 太陽
  {
    const [c, x] = canvas(512);
    x.fillStyle = radial(x, 256, 256, 256, [
      [0, '#fffbe0'],
      [0.35, '#ffd23f'],
      [0.55, 'rgba(255,140,0,0.8)'],
      [1, 'rgba(255,80,0,0)'],
    ]);
    x.fillRect(0, 0, 512, 512);
    add(scene, 'sun', c);
  }
  // 恒星
  {
    const [c, x] = canvas(256);
    x.fillStyle = radial(x, 128, 128, 128, [
      [0, '#ffffff'],
      [0.15, '#cfe8ff'],
      [0.4, 'rgba(120,180,255,0.35)'],
      [1, 'rgba(120,180,255,0)'],
    ]);
    x.fillRect(0, 0, 256, 256);
    x.globalCompositeOperation = 'lighter';
    star(x, 128, 128, 4, 126, 6);
    x.fillStyle = 'rgba(255,255,255,0.8)';
    x.fill();
    add(scene, 'bigstar', c);
  }
  // 星雲
  {
    const [c, x] = canvas(512);
    x.globalCompositeOperation = 'lighter';
    const cols = ['rgba(255,80,160,0.25)', 'rgba(90,120,255,0.25)', 'rgba(255,170,80,0.18)', 'rgba(120,255,220,0.15)'];
    for (let i = 0; i < 40; i++) {
      const cx = 256 + (Math.random() - 0.5) * 300;
      const cy = 256 + (Math.random() - 0.5) * 260;
      const r = 40 + Math.random() * 120;
      x.fillStyle = radial(x, cx, cy, r, [
        [0, cols[i % cols.length]],
        [1, 'rgba(0,0,0,0)'],
      ]);
      x.fillRect(0, 0, 512, 512);
    }
    add(scene, 'nebula', c);
  }
  // 渦巻き銀河
  {
    const [c, x] = canvas(512);
    x.globalCompositeOperation = 'lighter';
    x.fillStyle = radial(x, 256, 256, 120, [
      [0, 'rgba(255,240,200,1)'],
      [0.4, 'rgba(255,200,140,0.4)'],
      [1, 'rgba(0,0,0,0)'],
    ]);
    x.fillRect(0, 0, 512, 512);
    for (let arm = 0; arm < 2; arm++) {
      for (let i = 0; i < 900; i++) {
        const t = Math.random();
        const a = arm * Math.PI + t * Math.PI * 3.2;
        const r = 20 + t * 220;
        const sp = (1 - t) * 18 + 10;
        const px = 256 + Math.cos(a) * r + (Math.random() - 0.5) * sp;
        const py = 256 + Math.sin(a) * r * 0.55 + (Math.random() - 0.5) * sp * 0.6;
        x.fillStyle = Math.random() < 0.3 ? 'rgba(255,170,220,0.5)' : 'rgba(170,200,255,0.55)';
        x.fillRect(px, py, 2, 2);
      }
    }
    add(scene, 'galaxy', c);
  }
  // 宇宙ステーション
  {
    const [c, x] = canvas(256, 128);
    x.fillStyle = '#3b6fd1';
    x.fillRect(10, 30, 70, 68);
    x.fillRect(176, 30, 70, 68);
    x.strokeStyle = '#9fc2ff';
    x.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      x.strokeRect(10 + i * 14, 30, 14, 68);
      x.strokeRect(176 + i * 14, 30, 14, 68);
    }
    x.fillStyle = '#d9dde6';
    x.fillRect(80, 58, 96, 12);
    x.fillRect(108, 40, 40, 48);
    x.fillStyle = '#ffd23f';
    x.fillRect(118, 52, 20, 8);
    add(scene, 'iss', c);
  }
  // 衛星
  {
    const [c, x] = canvas(160, 96);
    x.fillStyle = '#2f5fbf';
    x.fillRect(4, 30, 50, 36);
    x.fillRect(106, 30, 50, 36);
    x.fillStyle = '#e0c25a';
    x.fillRect(58, 22, 44, 52);
    x.fillStyle = '#ccc';
    x.beginPath();
    x.arc(80, 18, 12, Math.PI, 0);
    x.fill();
    add(scene, 'satellite', c);
  }
  // 虹のアーチ
  {
    const [c, x] = canvas(720, 380);
    const cols = ['#ff3b3b', '#ff9a1a', '#ffe53b', '#3ddc84', '#3da5ff', '#5b5bff', '#c04bff'];
    x.lineWidth = 26;
    cols.forEach((col, i) => {
      x.strokeStyle = col;
      x.globalAlpha = 0.85;
      x.beginPath();
      x.arc(360, 380, 340 - i * 24, Math.PI, 0);
      x.stroke();
    });
    add(scene, 'rainbowArc', c);
  }
  // 虹のオーロラ（縦に流すタイル）
  {
    const [c, x] = canvas(64, 512);
    const g = x.createLinearGradient(0, 0, 0, 512);
    const cols = ['#ff3b3b', '#ff9a1a', '#ffe53b', '#3ddc84', '#3da5ff', '#5b5bff', '#c04bff', '#ff3b3b'];
    cols.forEach((col, i) => g.addColorStop(i / (cols.length - 1), col));
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 512);
    add(scene, 'rainbowBand', c);
  }
  // 街並み
  {
    const [c, x] = canvas(720, 320);
    let px = 0;
    while (px < 720) {
      const w = 40 + Math.random() * 70;
      const h = 80 + Math.random() * 230;
      x.fillStyle = Math.random() < 0.5 ? '#1c2a5c' : '#24356f';
      x.fillRect(px, 320 - h, w, h);
      x.fillStyle = 'rgba(255,220,120,0.55)';
      for (let wy = 320 - h + 12; wy < 310; wy += 22) for (let wx = px + 8; wx < px + w - 10; wx += 16) if (Math.random() < 0.55) x.fillRect(wx, wy, 7, 10);
      px += w + 4;
    }
    add(scene, 'city', c);
  }
}

function roundRect(x, l, t, w, h, r) {
  x.beginPath();
  x.moveTo(l + r, t);
  x.arcTo(l + w, t, l + w, t + h, r);
  x.arcTo(l + w, t + h, l, t + h, r);
  x.arcTo(l, t + h, l, t, r);
  x.arcTo(l, t, l + w, t, r);
  x.closePath();
}
