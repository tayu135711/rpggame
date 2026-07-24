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
const GACHA_COST_PREMIUM_EQUIP = 8;   // ダイヤ消費(プレミアムそうびガチャ)
const GACHA_COST_EQUIP         = 30;  // コイン消費(通常そうびガチャ)
/** プレミアムそうびガチャの最低保証レアリティ(2026/07/23 決定・数値は暫定) */
const PREMIUM_GACHA_MIN_RARITY = 3;

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

/**
 * 最低保証つきの重み付きランダムでレアリティを返す(プレミアムそうびガチャ用)
 * @param {number} minRarity - このレアリティ以上が確定で出る(1〜5)
 * @returns {number} minRarity〜5
 */
function rollRarityWithFloor(minRarity) {
  const weights = RARITY_WEIGHTS.slice(minRarity - 1);
  const total   = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return minRarity + i;
  }
  return minRarity;
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

/**
 * 属性こうげき 自属性ボーナス (STAB, 2026/07/24 追加)
 * 「相性不明な相手には通常こうげきが常に安定・無リスクな最適解になる」
 * という問題への対応として、属性こうげきには相性倍率とは別に
 * 固定の自属性ボーナスをかける。
 *   等倍(1.0倍)の相手 → 1.0 × 1.25 = 1.25倍 (通常こうげきより有利)
 *   苦手(0.5倍)の相手 → 0.5 × 1.25 = 0.625倍 (通常こうげきより不利)
 *   得意(1.5倍)の相手 → 1.5 × 1.25 = 1.875倍 (大きく有利)
 * これにより「相性がわからない相手には基本は属性こうげき、
 * 苦手だと分かっている/疑っているときだけ通常こうげきに切り替える」
 * という駆け引きが生まれる。通常こうげきは常に1.0倍のまま(ボーナス無し)。
 */
const ELEMENT_ATK_STAB = 1.25;

/* =========================================================
   バトルコマンド仕様 (2026/07/23 仕様変更)
   旧: ターン属性ローテーション方式(炎→水→自然→闇→光→つかまえる循環)は廃止。
   新: 属性は各キャラ固有のプロパティとして扱う。
       - プレイヤー(主人公): 「つうじょうこうげき」「つかまえる」の2コマンド
       - 仲間(捕獲済み):     「つうじょうこうげき」「[固有属性]こうげき」の2コマンド
       行動は1体ずつキャラを選んで個別に実行するターン制(battle.js参照)
========================================================= */

/* =========================================================
   とくぎ・しんか システム (2026/07/24 修正)
   全キャラ共通の固定レベルで、3つ目のコマンド「とくぎ」が解放される。
   仲間(捕獲したモンスター)は別途しんかレベルで見た目とステータスが強化される。
   旧仕様(しんかLv20 / とくぎ解放Lv30)では、見た目だけ強くなって
   コマンドが増えない「停滞期間」が10レベル分あったため、
   しんかととくぎ解放を同じレベルに統一し、レベルアップの節目として
   見た目・コマンド両方が同時に強化されるよう変更した。
   数値はすべて暫定値(たたき台) — バランス調整の余地あり
========================================================= */
const SKILL_UNLOCK_LEVEL = 20; // とくぎ解放レベル(全キャラ共通。しんかと同時に解放)
const EVOLVE_LEVEL       = 20; // モンスターしんかレベル(仲間のみ。プレイヤーはレアリティ成長で対応)

/**
 * 属性ごとの「とくぎ」定義。
 * プレイヤー側が使うときは「相手(敵)」に、敵側が使うときは「対象(味方1体)」に効果が向く。
 *   dmgMult      : 通常こうげきに対するダメージ倍率
 *   healPct      : 自分の陣営を最大HPの割合で回復する(水属性)
 *   bindTarget   : 相手を1ターン行動不能にする(自然属性)
 *   atkDebuffMult / debuffTurns : 相手の攻撃力を一定ターン下げる(闇属性)
 *   cleanseSelf  : 自分の陣営にかかった状態変化(束縛・攻撃力低下)をすべて解除する(光属性)
 */
const ELEMENT_SKILLS = {
  fire:   { name: 'だいばくはつ',   dmgMult: 1.7 },
  water:  { name: 'いやしのしずく', dmgMult: 1.0, healPct: 0.18 },
  nature: { name: 'からみつくツタ', dmgMult: 1.1, bindTarget: true },
  dark:   { name: 'のろいのことば', dmgMult: 1.1, atkDebuffMult: 0.6, debuffTurns: 2 },
  light:  { name: 'せいなるひかり', dmgMult: 1.3, cleanseSelf: true },
};

/* =========================================================
   装備システム (仕様書7-1,7-3確定)
   頭・服・足の3部位、レア度は星1〜5
========================================================= */
const EQUIP_PARTS = ['頭', '服', '足'];

/**
 * 宝箱から装備がドロップする確率 (2026/07/24 追加)
 * コイン(・時々ダイヤ)に加えて、一定確率で装備も一緒に手に入る
 */
const CHEST_EQUIP_DROP_CHANCE = 0.35;

/**
 * 回復地点 (いやしのいずみ, 2026/07/24 追加)
 * ステージ(迷路)内に設置し、近づくとパーティ全員のHPを全回復する。
 * 一度使うと少し離れるまで再発動しない(その場に立ち止まり続けての連発回復を防ぐ)
 */
const HEAL_SPOT_TRIGGER_DIST = 1.3; // これより近づくと発動
const HEAL_SPOT_RESET_DIST   = 2.6; // これより離れると再度発動可能になる

/**
 * 全滅(戦闘離脱)時のペナルティ (2026/07/24 追加)
 * 手持ちのコインの一定割合を失った状態でしまに送還される
 */
const WIPE_PENALTY_COIN_RATIO = 0.3;

/**
 * ぼうぎょコマンド (2026/07/24 追加)
 * 自分のターンにぼうぎょを選ぶと、そのラウンドの敵の攻撃で
 * 自分が狙われたときの被ダメージが軽減される
 */
const DEFEND_DAMAGE_REDUCTION = 0.5; // 被ダメージを50%に軽減

/**
 * セーブデータ (2026/07/24 追加)
 * localStorageに保存するキー。バージョンを上げる場合はキーも変更する
 */
const SAVE_KEY = 'capture_rpg_save_v1';

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
   捕獲時の初期レベル (2026/07/24 追加)
   旧仕様ではレア度に関係なく一律Lv5(ボスはLv15)固定で、
   レア度の恩恵がスキル構成の初期値以外に反映されていなかった。
   レア度が高いほど初期レベルにボーナスがつくようにし、
   ★1は従来と同じ基準値を維持しつつ、★5は明確に強い状態で
   仲間になるようにする。
========================================================= */
const CAPTURE_LEVEL_BASE            = 5;  // 通常個体の基準レベル(★1相当。従来値のまま)
const CAPTURE_LEVEL_BASE_BOSS       = 15; // ボス個体の基準レベル(★1相当。従来値のまま)
const CAPTURE_LEVEL_BONUS_PER_STAR  = 2;  // 通常個体: レア度1つにつき+2レベル
const CAPTURE_LEVEL_BONUS_PER_STAR_BOSS = 3; // ボス個体: レア度1つにつき+3レベル

/**
 * 捕獲したモンスターの初期レベルをレア度に応じて算出する
 * @param {number} rarity - 1〜5
 * @param {boolean} isBoss - ボス個体を捕獲した場合はtrue
 * @returns {number}
 */
function calcCaptureLevel(rarity, isBoss) {
  const base  = isBoss ? CAPTURE_LEVEL_BASE_BOSS : CAPTURE_LEVEL_BASE;
  const perStar = isBoss ? CAPTURE_LEVEL_BONUS_PER_STAR_BOSS : CAPTURE_LEVEL_BONUS_PER_STAR;
  return Math.min(MAX_LEVEL, base + perStar * (rarity - 1));
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
