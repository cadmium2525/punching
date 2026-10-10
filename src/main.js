import Phaser from 'phaser';
import { W, H, FONT_TITLE, FONT_UI } from './ui.js';
import { unlockAudio, resumePendingBgm } from './audio/sfx.js';
import { DEBUG } from './debug.js';
import fontChars from './fontChars.js';
import BootScene from './scenes/BootScene.js';
import HomeScene from './scenes/HomeScene.js';
import SelectScene from './scenes/SelectScene.js';
import MiniGameScene from './scenes/MiniGameScene.js';
import PunchScene from './scenes/PunchScene.js';
import FlightScene from './scenes/FlightScene.js';
import ResultScene from './scenes/ResultScene.js';
import RankingScene from './scenes/RankingScene.js';
import SettingsScene from './scenes/SettingsScene.js';
import PVScene from './scenes/PVScene.js';

async function waitFonts(timeout) {
  if (!document.fonts?.load) return;
  const sample = fontChars + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!?,.';
  const all = Promise.all([
    document.fonts.load(`40px ${FONT_TITLE}`, sample),
    document.fonts.load(`800 40px ${FONT_UI}`, sample),
  ]).catch(() => {});
  await Promise.race([all, new Promise((r) => setTimeout(r, timeout))]);
}

async function start() {
  await waitFonts(2500);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: W,
    height: H,
    backgroundColor: '#0b1230',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { activePointers: 4 },
    fps: { target: 60, smoothStep: false },
    render: { antialias: true, powerPreference: 'high-performance' },
    scene: [BootScene, HomeScene, SelectScene, MiniGameScene, PunchScene, FlightScene, ResultScene, RankingScene, SettingsScene, ...(DEBUG.pv ? [PVScene] : [])],
  });
  const unlock = () => {
    unlockAudio();
    resumePendingBgm();
  };
  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { capture: true });
  document.getElementById('loading')?.classList.add('done');
  if (DEBUG.test) window.__pf = { game };
  if (DEBUG.pv) {
    const a = await import('./audio/sfx.js');
    window.__pv = { renderAudio: a.renderPvAudio, log: a.pvLog };
  }
}

start();
