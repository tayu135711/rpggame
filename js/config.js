/* =========================================================
   config.js — ゲーム定数・ステージ定義
   他の全JSファイルより先に読み込む
========================================================= */

/* ---- 迷路パラメータ ---- */
const MAZE_COLS      = 9;
const MAZE_ROWS      = 9;
const CELL           = 5;
const WALL_HEIGHT    = 3.2;
const WALL_THICKNESS = 0.5;

/* ---- プレイヤー / フィールド ---- */
const PLAYER_SPEED   = 6.5;
const ENCOUNTER_DIST = 1.6;

/* ---- 島 ---- */
const ISLAND_RADIUS       = 3.0;
const ISLAND_PLAYER_SPEED = 4.5;

/* ---- パーティ ---- */
const MAX_PARTY    = 6;
const FOLLOW_GAP   = 1.3;
const FOLLOW_SPEED = PLAYER_SPEED * 1.15;

/* ---- ガチャコスト ---- */
const GACHA_COST_DENPA = 5;   // ダイヤ消費
const GACHA_COST_EQUIP = 30;  // コイン消費

/* =========================================================
   レアリティ共通テーブル
   星1:40% / 星2:30% / 星3:18% / 星4:9% / 星5:3%
   (でんぱガチャ・装備ガチャ共通の基準 — 仕様書5-7確定)
========================================================= */
const RARITY_WEIGHTS = [40, 30, 18, 9, 3];
const RARITY_TOTAL   = RARITY_WEIGHTS.reduce((a, b) => a + b, 0); // = 100

/**
 * 重み付きランダムでレアリティ(1〜5)を返す
 * @returns {number} 1〜5
 */
function rollRarity() {
  let r = Math.random() * RARITY_TOTAL;
  for (let i = 0; i < RARITY_WEIGHTS.length; i++) {
    r -= RARITY_WEIGHTS[i];
    if (r <= 0) return i + 1;
  }
  return 1;
}

/* =========================================================
   属性システム (仕様書5-1確定)
   炎・水・自然・闇・光 の基本5属性
========================================================= */

/** 属性キー → 表示名 */
const ELEMENT_NAMES = {
  fire:   '炎',
  water:  '水',
  nature: '自然',
  dark:   '闇',
  light:  '光',
};

/** 属性キー → ボタン背景色 */
const ELEMENT_COLORS = {
  fire:   '#c8361a',
  water:  '#1460b0',
  nature: '#246e2e',
  dark:   '#5a24a0',
  light:  '#b07800',
};

/**
 * 属性相性テーブル (仕様書5-8確定方針)
 * 攻撃側 → { 守備側: ダメージ倍率 }
 *   ×1.5 = こうかはばつぐんだ！
 *   ×0.5 = こうかはいまひとつ…
 *   記載なし = ×1.0 (等倍)
 */
const ELEMENT_AFFINITY = {
  fire:   { nature: 1.5, water:  0.5 },
  water:  { fire:   1.5, nature: 0.5 },
  nature: { water:  1.5, fire:   0.5 },
  dark:   { light:  1.5 },
  light:  { dark:   1.5 },
};

/* =========================================================
   コマンドローテーション (仕様書5-2確定)
   炎→水→自然→闇→光→つかまえる の固定順で1周
========================================================= */
const COMMAND_ROTATION = ['fire', 'water', 'nature', 'dark', 'light', 'capture'];

/* =========================================================
   装備システム (仕様書7-1,7-3確定)
   頭・服・足の3部位、レア度は星1〜5
========================================================= */
const EQUIP_PARTS = ['頭', '服', '足'];

/**
 * レア度別 装備ステータスボーナス (1個あたり)
 * 未決定事項: 具体的な数値は暫定値 — 実装後にバランス調整予定
 */
const EQUIP_STAT_BY_RARITY = {
  1: { hp:  2, atk: 1 },
  2: { hp:  4, atk: 2 },
  3: { hp:  7, atk: 3 },
  4: { hp: 12, atk: 5 },
  5: { hp: 20, atk: 8 },
};

/* =========================================================
   レベルアップ / 経験値 (仕様書4-1,4-2,4-3)
   最大レベル100 / EXP計算式: 指数的成長カーブ
========================================================= */
const MAX_LEVEL = 100;

/**
 * 次のレベルアップに必要なEXP
 * @param {number} lv - 現在のレベル (1〜99)
 * @returns {number}
 */
function calcNextExp(lv) {
  return Math.floor(30 * Math.pow(1.15, lv - 1));
}

/* =========================================================
   ステージ定義 (仕様書6-3確定: 食べ物テーマ全10ステージ)
========================================================= */
const STAGES = [
  { no:1,  name:'ケーキのしま',  letter:'ケ', unlocked:true,  desc:'あまい かおりがする、さいしょのステージ' },
  { no:2,  name:'わがしのしま',  letter:'わ', unlocked:false, desc:'じゅんびちゅう…' },
  { no:3,  name:'？？？',       letter:'?', unlocked:false, desc:'じゅんびちゅう…' },
  { no:4,  name:'？？？',       letter:'?', unlocked:false, desc:'じゅんびちゅう…' },
  { no:5,  name:'？？？',       letter:'?', unlocked:false, desc:'じゅんびちゅう…' },
  { no:6,  name:'？？？',       letter:'?', unlocked:false, desc:'じゅんびちゅう…' },
  { no:7,  name:'？？？',       letter:'?', unlocked:false, desc:'じゅんびちゅう…' },
  { no:8,  name:'？？？',       letter:'?', unlocked:false, desc:'じゅんびちゅう…' },
  { no:9,  name:'？？？',       letter:'?', unlocked:false, desc:'じゅんびちゅう…' },
  { no:10, name:'？？？',       letter:'?', unlocked:false, desc:'じゅんびちゅう…' },
];
