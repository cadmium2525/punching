// テスト用フラグ（?bot=perfect などで自動プレイ）
const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();
export const DEBUG = {
  bot: params.get('bot'), // perfect | great | good | miss | random
  test: params.has('test'),
  fast: params.has('fast'),
  games: params.get('games')?.split(',') ?? null, // 出題順を固定（テスト用）
};
