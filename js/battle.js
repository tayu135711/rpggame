/* =========================================================
   battle.js — バトルシーン・バトルシステム・コマンド処理
   依存: THREE, config.js, models.js, party.js, island.js
   読み込み順: config.js → models.js → maze.js → party.js → island.js → battle.js
========================================================= */

/* ---------------------------------------------------------
   バトル用ミニ3Dシーン (敵が正面奥、味方が手前)
--------------------------------------------------------- */
const battleCanvas   = document.getElementById('battle-canvas');
const battleScene    = new THREE.Scene();
const battleCamera   = new THREE.PerspectiveCamera(42, 1, 0.1, 50);
const battleCameraBase = new THREE.Vector3(0, 2.5, 4.6);
const battleCameraLookAt = new THREE.Vector3(0, 1.0, -1.2);
battleCamera.position.copy(battleCameraBase);
battleCamera.lookAt(battleCameraLookAt);
const battleRenderer = new THREE.WebGLRenderer({ canvas: battleCanvas, antialias: true, alpha: true });

// ライティング
battleScene.add(new THREE.HemisphereLight(0xffffff, 0xffd9ec, 1.0));
const battleSun = new THREE.DirectionalLight(0xffffff, 0.8);
battleSun.position.set(3, 5, 4);
battleScene.add(battleSun);

// バトルフロア(半透明)
const battleFloor = new THREE.Mesh(
  new THREE.CircleGeometry(3.6, 24),
  new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 })
);
battleFloor.rotation.x = -Math.PI / 2;
battleFloor.position.z = -0.5;
battleScene.add(battleFloor);

/* ---------------------------------------------------------
   戦闘背景 (太陽・雲・遠くの丘) — 空のグラデーションだけだと
   さびしいので、簡単な背景オブジェクトを奥に配置する
--------------------------------------------------------- */
function buildBattleBackground() {
  const g = new THREE.Group();

  // 太陽
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(1.0, 20),
    new THREE.MeshBasicMaterial({ color: 0xfff3b0 })
  );
  sun.position.set(2.6, 4.2, -9.6);
  g.add(sun);

  // 遠くの丘 (2段)
  const hillMatBack  = new THREE.MeshBasicMaterial({ color: 0xbfe0b8 });
  const hillMatFront = new THREE.MeshBasicMaterial({ color: 0x9fd08f });

  const hillBack = new THREE.Mesh(new THREE.CircleGeometry(6.5, 24, 0, Math.PI), hillMatBack);
  hillBack.rotation.x = -Math.PI / 2;
  hillBack.position.set(-1.5, -0.55, -8.5);
  hillBack.scale.set(1.4, 0.5, 1);
  g.add(hillBack);

  const hillFront = new THREE.Mesh(new THREE.CircleGeometry(5.5, 24, 0, Math.PI), hillMatFront);
  hillFront.rotation.x = -Math.PI / 2;
  hillFront.position.set(2.2, -0.55, -7.2);
  hillFront.scale.set(1.3, 0.42, 1);
  g.add(hillFront);

  // ふわふわ雲
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  function makeCloud(x, y, z, s) {
    const c = new THREE.Group();
    [[-0.35, 0], [0, 0.15], [0.35, 0], [0.13, -0.1], [-0.13, -0.1]].forEach(([ox, oy]) => {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), cloudMat);
      puff.position.set(ox, oy, 0);
      c.add(puff);
    });
    c.position.set(x, y, z);
    c.scale.set(s, s, s);
    return c;
  }
  g.add(makeCloud(-3.0, 3.4, -9.0, 1.1));
  g.add(makeCloud(3.4, 2.6, -9.4, 0.85));
  g.add(makeCloud(0.2, 4.0, -9.8, 0.7));

  return g;
}
battleScene.add(buildBattleBackground());

/* ---------------------------------------------------------
   バトルキャンバスのリサイズ
--------------------------------------------------------- */
function resizeBattleCanvas() {
  const w = battleCanvas.clientWidth  || 460;
  const h = battleCanvas.clientHeight || 210;
  battleRenderer.setSize(w, h, false);
  battleCamera.aspect = w / h;
  battleCamera.updateProjectionMatrix();
}

/* ---------------------------------------------------------
   バトル状態
--------------------------------------------------------- */
let battleState      = null; // { enemy }
let allyModels       = [];   // 各要素.userData.fighter で対応するfighterを参照
let enemyBattleModel = null;

/* ---------------------------------------------------------
   バトルモデル配置
--------------------------------------------------------- */
function clearBattleModels() {
  allyModels.forEach(m => battleScene.remove(m));
  allyModels = [];
  if (enemyBattleModel) { battleScene.remove(enemyBattleModel); enemyBattleModel = null; }
}

function placeBattleModels() {
  clearBattleModels();
  const fighters = getAllFighters();
  const n        = fighters.length;
  const spacing  = Math.min(1.05, 4.6 / Math.max(n, 1));
  const scale    = 0.6;

  fighters.forEach((f, i) => {
    const m = f.isTrainer
      ? buildTrainerModel()
      : (f.evolved && f.typeRef.evolvedBuild ? f.typeRef.evolvedBuild() : f.typeRef.build());
    m.scale.set(scale, scale, scale);
    m.position.set((i - (n - 1) / 2) * spacing, 0, 1.4);
    m.rotation.y        = Math.PI; // 敵の方向を向く
    m.userData.fighter   = f;
    m.userData.baseScale = scale;
    battleScene.add(m);
    allyModels.push(m);
  });

  // 敵モデル
  enemyBattleModel = battleState.enemy.type.build();
  enemyBattleModel.position.set(0, 0, -1.6);
  enemyBattleModel.rotation.y = 0;
  const bScale = battleState.enemy.type.battleScale || 1;
  enemyBattleModel.scale.set(bScale, bScale, bScale);
  enemyBattleModel.userData.baseScale = bScale;
  battleScene.add(enemyBattleModel);
}

/* ---------------------------------------------------------
   演出: カメラシェイク & 画面フラッシュ
   (動画のような迫力を出すため、被弾・とくぎ発動時にカメラを
    ゆらし、白/金色のフラッシュを一瞬入れる)
--------------------------------------------------------- */
const battleFlashEl = document.getElementById('battle-flash');
let camShakeUntil = 0;
let camShakeMag   = 0;
const CAM_SHAKE_DURATION = 220;

function triggerCameraShake(mag = 0.10) {
  camShakeMag   = mag;
  camShakeUntil = performance.now() + CAM_SHAKE_DURATION;
}

function updateCameraShake() {
  const now = performance.now();
  if (now < camShakeUntil) {
    const t   = (camShakeUntil - now) / CAM_SHAKE_DURATION;
    const mag = camShakeMag * t;
    battleCamera.position.set(
      battleCameraBase.x + (Math.random() - 0.5) * mag,
      battleCameraBase.y + (Math.random() - 0.5) * mag,
      battleCameraBase.z + (Math.random() - 0.5) * mag * 0.5
    );
  } else {
    battleCamera.position.copy(battleCameraBase);
  }
  battleCamera.lookAt(battleCameraLookAt);
}

/** 被弾フラッシュ (白=通常ヒット、金=こうかばつぐん) */
function triggerBattleFlash(color = '#ffffff', peak = 0.45) {
  if (!battleFlashEl) return;
  battleFlashEl.style.transition = 'none';
  battleFlashEl.style.background = color;
  battleFlashEl.style.opacity    = String(peak);
  requestAnimationFrame(() => {
    battleFlashEl.style.transition = 'opacity 0.32s ease-out';
    battleFlashEl.style.opacity    = '0';
  });
}

/* ---------------------------------------------------------
   アタックモーション
--------------------------------------------------------- */
function triggerAttackMotion(mesh, dir) {
  if (!mesh) return;
  mesh.userData.atkAnim = {
    start:    performance.now(),
    duration: 480,
    dir,
    baseX: mesh.position.x,
    baseZ: mesh.position.z,
  };
}

function triggerHitReaction(mesh, opts) {
  if (!mesh) return;
  mesh.userData.hitAnim = { start: performance.now(), duration: 280 };
  const big = opts && opts.big;
  triggerCameraShake(big ? 0.22 : 0.11);
  triggerBattleFlash(big ? '#ffe36b' : '#ffffff', big ? 0.65 : 0.4);
}

/** ぼうぎょ演出 (自分の位置で少し身をかがめる) */
function triggerDefendMotion(mesh) {
  if (!mesh) return;
  mesh.userData.defendAnim = { start: performance.now(), duration: 520 };
}

/** 毎フレーム呼び出してバトルモデルのアニメを更新 */
function updateAttackMotions() {
  const all = enemyBattleModel ? [...allyModels, enemyBattleModel] : [...allyModels];
  all.forEach(mesh => {
    if (!mesh) return;
    const baseScale = mesh.userData.baseScale || 1;

    if (mesh.userData.atkAnim) {
      const a = mesh.userData.atkAnim;
      const t = Math.min(1, (performance.now() - a.start) / a.duration);
      const lunge = Math.sin(t * Math.PI) * 0.6;
      mesh.position.x = a.baseX + a.dir.x * lunge;
      mesh.position.z = a.baseZ + a.dir.z * lunge;
      const s = baseScale * (1 + Math.sin(t * Math.PI) * 0.1);
      mesh.scale.set(s, s, s);
      if (t >= 1) {
        mesh.position.x = a.baseX; mesh.position.z = a.baseZ;
        mesh.scale.set(baseScale, baseScale, baseScale);
        delete mesh.userData.atkAnim;
      }
    } else if (mesh.userData.hitAnim) {
      const h = mesh.userData.hitAnim;
      const t = Math.min(1, (performance.now() - h.start) / h.duration);
      const s = baseScale * (1 - Math.sin(t * Math.PI) * 0.15);
      mesh.scale.set(s, s, s);
      if (t >= 1) {
        mesh.scale.set(baseScale, baseScale, baseScale);
        delete mesh.userData.hitAnim;
      }
    } else if (mesh.userData.defendAnim) {
      const d = mesh.userData.defendAnim;
      const t = Math.min(1, (performance.now() - d.start) / d.duration);
      const dip = Math.sin(t * Math.PI) * 0.14;
      const s   = baseScale * (1 + dip * 0.4);
      mesh.scale.set(s, s * (1 - dip * 0.5), s);
      mesh.position.y = -dip * 0.5;
      if (t >= 1) {
        mesh.scale.set(baseScale, baseScale, baseScale);
        mesh.position.y = 0;
        delete mesh.userData.defendAnim;
      }
    } else {
      // 待機中のふわふわ浮遊
      mesh.position.y = Math.sin(performance.now() / 450 + mesh.id) * 0.05;
    }
  });
  updateCameraShake();
}

/* ---------------------------------------------------------
   バトルUI ヘルパー
--------------------------------------------------------- */
const overlay        = document.getElementById('battle-overlay');
const battleLog       = document.getElementById('battle-log');
const btnNormalAtk    = document.getElementById('btn-normal-atk');
const btnElementAtk   = document.getElementById('btn-element-atk');
const btnSkill        = document.getElementById('btn-skill');
const btnCapture      = document.getElementById('btn-capture');
const btnDefend       = document.getElementById('btn-defend');
const btnRun          = document.getElementById('btn-run');
const queueListEl     = document.getElementById('battle-queue-list');
const activeActorLabel = document.getElementById('active-actor-label');

/** このラウンドでまだ行動していないメンバー(行動中のキャラは含まない) */
let turnQueue     = [];
/** 現在コマンド選択中のキャラ */
let activeFighter = null;

function log(msg) {
  battleLog.innerHTML += `<div>${msg}</div>`;
  battleLog.scrollTop  = battleLog.scrollHeight;
}

function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function setActionButtons(enabled) {
  btnNormalAtk.disabled  = !enabled;
  btnElementAtk.disabled = !enabled;
  btnSkill.disabled      = !enabled;
  btnCapture.disabled    = !enabled;
  btnDefend.disabled     = !enabled;
  btnRun.disabled        = !enabled;
}

/** 行動中キャラのコマンドボタン・行動キュー表示を更新する */
function updateCommandUI() {
  if (!activeFighter) return;

  activeActorLabel.textContent = `▶ ${activeFighter.name} の ばん`;

  const isTrainer = !!activeFighter.isTrainer;

  // 通常こうげきは誰でも共通
  btnNormalAtk.style.display = 'flex';
  // ぼうぎょも誰でも共通で選べる
  btnDefend.style.display = 'flex';

  if (isTrainer) {
    // プレイヤー: 通常こうげき + つかまえる (+ Lv.10でとくぎ)
    btnElementAtk.style.display = 'none';
    btnCapture.style.display    = 'flex';
  } else {
    // 仲間: 通常こうげき + 固有属性こうげき (+ Lv.10でとくぎ)
    btnCapture.style.display    = 'none';
    btnElementAtk.style.display = 'flex';
    btnElementAtk.className = 'btn cmd ' + activeFighter.element + '-btn';
    document.getElementById('element-atk-text').textContent =
      `${ELEMENT_NAMES[activeFighter.element]}こうげき`;
  }

  // とくぎ (全キャラ共通レベルで解放)
  if ((activeFighter.level || 1) >= SKILL_UNLOCK_LEVEL) {
    const skill = ELEMENT_SKILLS[activeFighter.element];
    btnSkill.style.display = 'flex';
    btnSkill.className = 'btn cmd ' + activeFighter.element + '-btn';
    document.getElementById('skill-text').textContent = skill.name;
  } else {
    btnSkill.style.display = 'none';
  }

  // キューリストの更新 (行動中キャラ → これから行動するキャラの順)
  queueListEl.innerHTML = '';
  const upcoming = [activeFighter, ...turnQueue];
  upcoming.forEach((f, i) => {
    const item = document.createElement('div');
    item.className = 'queue-item';
    if (i === 0) item.classList.add('active');
    item.textContent = f.name.substring(0, 1);
    item.style.backgroundColor = '#' + f.color.toString(16).padStart(6, '0');
    queueListEl.appendChild(item);
  });
}

function updateHpBar() {
  const e   = battleState.enemy;
  const pct = Math.max(0, e.hp / e.maxHp);
  const bar = document.getElementById('enemy-hpbar');
  bar.style.width = (pct * 100) + '%';
  bar.className   = 'hpbar-inner' + (pct < 0.25 ? ' critical' : pct < 0.5 ? ' low' : '');
  document.getElementById('enemy-hp-text').textContent =
    `${Math.max(0, Math.ceil(e.hp))}/${e.maxHp}`;
}

function updateAllyHpList() {
  const el = document.getElementById('ally-hp-list');
  el.innerHTML = getAllFighters().map(f => {
    const pct = Math.max(0, f.hp / f.maxHp);
    const cls = pct < 0.25 ? 'critical' : pct < 0.5 ? 'low' : '';
    const elemBadge = f.element ? `<span class="ally-card-element" style="background:${ELEMENT_COLORS[f.element]}">${ELEMENT_NAMES[f.element]}</span>` : '';
    const expPct = f.level ? (f.exp / calcNextExp(f.level)) * 100 : 0;
    
    return `
      <div class="ally-card${f.hp <= 0 ? ' fainted' : ''}">
        <img class="ally-card-icon" src="${getFighterIconUrl(f)}" alt="${f.name}">
        <div class="ally-card-name">${f.name}</div>
        ${f.level ? `<div class="ally-card-level">Lv.${f.level}</div>` : ''}
        ${elemBadge}
        <div class="hpbar-outer"><div class="hpbar-inner ${cls}" style="width:${pct * 100}%"></div></div>
        ${f.level ? `
        <div class="expbar-outer"><div class="expbar-inner" style="width:${expPct}%"></div></div>
        ` : ''}
        <div class="ally-card-atk">HP ${Math.max(0, Math.ceil(f.hp))}/${f.maxHp}</div>
      </div>`;
  }).join('');
}

function findModelFor(fighter) {
  return allyModels.find(m => m.userData.fighter === fighter);
}

/* ---------------------------------------------------------
   バトル開始・終了
--------------------------------------------------------- */
function startBattle(enemy) {
  battleState = { enemy };
  // 状態異常のリセット (前回のバトルの束縛・攻撃力低下を持ち越さない)
  getAllFighters().forEach(f => { f.atkDebuffMult = 1; f.atkDebuffTurns = 0; f.bound = false; });
  enemy.atkDebuffMult = 1; enemy.atkDebuffTurns = 0; enemy.bound = false;

  document.getElementById('battle-title').textContent = enemy.isBoss
    ? `ボスが たちふさがった！ ${enemy.type.name}`
    : `やせいの ${enemy.type.name} があらわれた！`;
  document.getElementById('enemy-name').textContent =
    enemy.type.name + (enemy.isBoss ? '(ボス)' : '');
  battleLog.innerHTML = '戦闘開始！';
  overlay.style.display = 'flex';
  resizeBattleCanvas();
  placeBattleModels();
  updateHpBar();
  updateAllyHpList();
  startRound();
}

/** 新しいラウンドを開始する (パーティ全員の行動キューを組み直す) */
function startRound() {
  if (!battleState) return;
  // 前ラウンドで発動した「ぼうぎょ」の効果はここでリセットする
  // (敵の反撃 → finishEnemyTurn → startRound の順で呼ばれるため、
  //  防御の効果が実際に使われた"後"にリセットされる)
  getAllFighters().forEach(f => { f.defending = false; });
  turnQueue = getAllFighters().filter(f => f.hp > 0);
  nextActor();
}

/** キューから次のキャラを取り出してコマンド選択を促す。キューが空ならラウンド終了 */
function nextActor() {
  if (!battleState) return;
  if (turnQueue.length === 0) {
    enemyCounterattack();
    return;
  }
  const f = turnQueue.shift();
  if (f.bound) {
    log(`${f.name} は からみつかれて うごけない！`);
    f.bound = false;
    nextActor();
    return;
  }
  activeFighter = f;
  updateCommandUI();
  setActionButtons(true);
}

function endBattle() {
  overlay.style.display = 'none';
  clearBattleModels();
  battleState = null;
  updatePartyPanel();
}

/* ---------------------------------------------------------
   敵の反撃
--------------------------------------------------------- */
function enemyCounterattack() {
  if (!battleState) return;
  const e = battleState.enemy;

  // 束縛されていたら反撃できない (からみつくツタ の効果)
  if (e.bound) {
    e.bound = false;
    log(`${e.type.name} は からみつかれて うごけない！`);
    setTimeout(finishEnemyTurn, 500);
    return;
  }

  const alive = getAllFighters().filter(f => f.hp > 0);
  if (alive.length === 0) return;

  const target      = alive[Math.floor(Math.random() * alive.length)];
  const targetModel = findModelFor(target);
  triggerAttackMotion(enemyBattleModel, { x: 0, z: 1 });

  // 一定確率で敵も固有属性のとくぎを使ってくる(捕獲後どんな技を使えるかのプレビューにもなる)
  const skill = Math.random() < 0.3 ? ELEMENT_SKILLS[e.type.element] : null;

  setTimeout(() => {
    if (!battleState) return;

    if (skill && skill.healPct) {
      // 水: 攻撃せず自己回復
      const healAmt = Math.round(e.maxHp * skill.healPct);
      e.hp = Math.min(e.maxHp, e.hp + healAmt);
      log(`${e.type.name} の ${skill.name}！ じぶんのHPを ${healAmt} かいふくした！`);
      updateHpBar();
      finishEnemyTurn();
      return;
    }

    let dmg = Math.max(1, Math.round((e.type.atk || 5) * (0.8 + Math.random() * 0.4)));
    if (e.atkDebuffTurns > 0) dmg = Math.round(dmg * e.atkDebuffMult);
    if (skill) dmg = Math.round(dmg * skill.dmgMult);

    let defended = false;
    if (target.defending) {
      dmg = Math.max(1, Math.round(dmg * DEFEND_DAMAGE_REDUCTION));
      defended = true;
    }

    target.hp = Math.max(0, target.hp - dmg);
    log(`${e.type.name} の ${skill ? skill.name : 'こうげき'}！ ${target.name} に ${dmg} のダメージ！`);
    if (defended) log(`<span style="color:var(--defend);">${target.name} は ぼうぎょして ダメージを おさえた！</span>`);
    triggerHitReaction(targetModel);
    updateAllyHpList();

    if (target.hp <= 0) log(`${target.name} は たおれた！`);

    if (skill && skill.bindTarget && target.hp > 0) {
      target.bound = true;
      log(`${target.name} は からみつかれて うごけなくなった！`);
    }
    if (skill && skill.atkDebuffMult && target.hp > 0) {
      target.atkDebuffMult = skill.atkDebuffMult;
      target.atkDebuffTurns = skill.debuffTurns;
      log(`${target.name} の こうげきりょくが さがった！`);
    }
    if (skill && skill.cleanseSelf) {
      e.atkDebuffTurns = 0; e.atkDebuffMult = 1; e.bound = false;
      log(`${e.type.name} は ちからを とりもどした！`);
    }

    finishEnemyTurn();
  }, 280);
}

/** 敵の行動後の共通後処理 (勝敗判定・デバフのターン経過・次ラウンドへ) */
function finishEnemyTurn() {
  if (!battleState) return;
  const stillAlive = getAllFighters().some(f => f.hp > 0);
  if (!stillAlive) {
    const lostCoins = Math.min(coins, Math.round(coins * WIPE_PENALTY_COIN_RATIO));
    coins -= lostCoins;
    updateCurrencyUI();
    log(lostCoins > 0
      ? `みんな たおれてしまった…しまに はこばれた…(コイン-${lostCoins})`
      : 'みんな たおれてしまった…しまに はこばれた…');
    setActionButtons(false);
    setTimeout(() => {
      endBattle();
      openIslandOverlay();
      showToast(lostCoins > 0 ? `しまに はこばれた…コインを ${lostCoins} おとしてしまった` : 'しまに はこばれた…');
    }, 1600);
    return;
  }

  // 味方にかかった攻撃力低下のターン経過
  getAllFighters().forEach(f => {
    if (f.atkDebuffTurns > 0) {
      f.atkDebuffTurns--;
      if (f.atkDebuffTurns <= 0) f.atkDebuffMult = 1;
    }
  });
  // 敵にかかった攻撃力低下のターン経過
  const e = battleState.enemy;
  if (e.atkDebuffTurns > 0) {
    e.atkDebuffTurns--;
    if (e.atkDebuffTurns <= 0) e.atkDebuffMult = 1;
  }

  startRound();
}

/* ---------------------------------------------------------
   コマンドの実行 (通常こうげき / 属性こうげき / つかまえる)
--------------------------------------------------------- */
btnNormalAtk.addEventListener('click', async () => {
  if (!battleState || btnNormalAtk.disabled || !activeFighter) return;
  setActionButtons(false);
  await executeSingleAttack(activeFighter, null);
});

btnElementAtk.addEventListener('click', async () => {
  if (!battleState || btnElementAtk.disabled || !activeFighter || activeFighter.isTrainer) return;
  setActionButtons(false);
  await executeSingleAttack(activeFighter, activeFighter.element);
});

btnCapture.addEventListener('click', () => {
  if (!battleState || btnCapture.disabled || !activeFighter || !activeFighter.isTrainer) return;
  setActionButtons(false);
  executeCapture();
});

btnDefend.addEventListener('click', async () => {
  if (!battleState || btnDefend.disabled || !activeFighter) return;
  setActionButtons(false);
  await executeDefend(activeFighter);
});

/** ぼうぎょの実行 (誰でも選べる。このラウンドの敵の攻撃で狙われた際の被ダメージを軽減する) */
async function executeDefend(fighter) {
  const model = findModelFor(fighter);
  triggerDefendMotion(model);
  fighter.defending = true;
  log(`${fighter.name} は みをまもっている！`);
  await wait(320);
  if (!battleState) return;
  nextActor();
}

btnSkill.addEventListener('click', async () => {
  if (!battleState || btnSkill.disabled || !activeFighter) return;
  if ((activeFighter.level || 1) < SKILL_UNLOCK_LEVEL) return;
  setActionButtons(false);
  await executeSkillAttack(activeFighter);
});

/** とくぎの実行 (Lv.10で解放。属性ごとに固有の追加効果を持つ) */
async function executeSkillAttack(fighter) {
  const skill = ELEMENT_SKILLS[fighter.element];
  const e = battleState.enemy;
  const enemyElement = e.type.element;
  const affinity = ELEMENT_AFFINITY[fighter.element]?.[enemyElement] || 1.0;

  const model = findModelFor(fighter);
  triggerAttackMotion(model, { x: 0, z: -1 });
  await wait(220);
  if (!battleState) return;

  log(`${fighter.name} の とくぎ「${skill.name}」！`);

  let dmg = Math.max(1, Math.round(fighter.atk + Math.random() * 5));
  if (fighter.atkDebuffTurns > 0) dmg = Math.round(dmg * fighter.atkDebuffMult);
  dmg = Math.round(dmg * affinity * skill.dmgMult);

  e.hp -= dmg;
  log(`${e.type.name} に ${dmg} のダメージ！`);
  if (affinity > 1.0) {
    log('<span style="color:var(--red);">こうかは ばつぐんだ！</span>');
  } else if (affinity < 1.0) {
    log('<span style="color:var(--gold);">こうかは いまひとつ のようだ…</span>');
  }
  triggerHitReaction(enemyBattleModel, { big: true });
  updateHpBar();

  if (skill.healPct) {
    let healedAny = false;
    getAllFighters().forEach(f => {
      if (f.hp > 0 && f.hp < f.maxHp) {
        f.hp = Math.min(f.maxHp, f.hp + Math.round(f.maxHp * skill.healPct));
        healedAny = true;
      }
    });
    if (healedAny) { log('なかま全員が すこし かいふくした！'); updateAllyHpList(); }
  }

  if (e.hp <= 0) {
    handleEnemyDefeated();
    return;
  }

  if (skill.bindTarget) {
    e.bound = true;
    log(`${e.type.name} は からみつかれて うごけなくなった！`);
  }
  if (skill.atkDebuffMult) {
    e.atkDebuffMult = skill.atkDebuffMult;
    e.atkDebuffTurns = skill.debuffTurns;
    log(`${e.type.name} の こうげきりょくが さがった！`);
  }
  if (skill.cleanseSelf) {
    getAllFighters().forEach(f => { f.atkDebuffTurns = 0; f.atkDebuffMult = 1; f.bound = false; });
    log('なかま全員の からだの へんかが もとにもどった！');
  }

  await wait(180);
  nextActor();
}

/**
 * 1体のキャラでこうげきを実行する。
 * @param {object} fighter - 行動するキャラ
 * @param {string|null} element - 属性こうげきなら固有属性キー、通常こうげきなら null(無属性・等倍)
 */
async function executeSingleAttack(fighter, element) {
  const e = battleState.enemy;
  const enemyElement = e.type.element;
  const affinity = element ? (ELEMENT_AFFINITY[element]?.[enemyElement] || 1.0) : 1.0;

  const model = findModelFor(fighter);
  triggerAttackMotion(model, { x: 0, z: -1 });
  await wait(200);
  if (!battleState) return;

  let dmg = Math.max(1, Math.round(fighter.atk + Math.random() * 5));
  if (fighter.atkDebuffTurns > 0) dmg = Math.round(dmg * fighter.atkDebuffMult);
  // 属性こうげきには自属性ボーナス(STAB)がかかる。通常こうげきは常に等倍のまま
  dmg = Math.round(dmg * affinity * (element ? ELEMENT_ATK_STAB : 1));

  if (element) {
    log(`${fighter.name} の ${ELEMENT_NAMES[element]}こうげき！`);
    if (affinity > 1.0) {
      log('<span style="color:var(--red);">こうかは ばつぐんだ！</span>');
    } else if (affinity < 1.0) {
      log('<span style="color:var(--gold);">こうかは いまひとつ のようだ…</span>');
    }
  } else {
    log(`${fighter.name} の こうげき！`);
  }

  e.hp -= dmg;
  log(`${e.type.name} に ${dmg} のダメージ！`);
  triggerHitReaction(enemyBattleModel, { big: affinity > 1.0 });
  updateHpBar();

  if (e.hp <= 0) {
    handleEnemyDefeated();
    return;
  }

  await wait(180);
  nextActor();
}

/** 敵を倒したときの共通処理 (経験値・コイン獲得・ステージクリア判定) */
function handleEnemyDefeated() {
  const e = battleState.enemy;
  log(`${e.type.name} をたおした！`);
  e.alive = false;
  scene.remove(e.mesh);

  // 経験値とコイン獲得
  const gainedExp = Math.round(e.type.baseHp * 0.5);
  const gainedCoins = Math.round(e.type.baseHp * 0.3) + 2;
  log(`なかま全員が ${gainedExp} のけいけんちをえた！`);
  log(`コイン+${gainedCoins} を手に入れた！`);
  coins += gainedCoins;
  updateCurrencyUI();

  // 全味方に経験値を分配
  getAllFighters().forEach(f => {
    if (f.hp > 0) gainExp(f, gainedExp);
  });

  if (e.isBoss) {
    log('ステージクリア！');

    // 次のステージのロック解除 (currentStageNoを基準に汎用化。2026/07/24修正: 旧実装はステージ2決め打ちだった)
    const nextStage = STAGES.find(st => st.no === currentStageNo + 1);
    if (nextStage && !nextStage.unlocked) {
      nextStage.unlocked = true;
      const dots = document.querySelectorAll('.stage-dot');
      const dot  = dots[nextStage.no - 1];
      if (dot) dot.classList.remove('locked');
    }

    // ステージクリアは進行の節目なので自動セーブしておく
    if (typeof saveGame === 'function') saveGame(false);

    setTimeout(() => {
      endBattle();
      showToast('ステージクリア！ しまにもどってきた');
      openIslandOverlay();
    }, 1000);
  } else {
    setTimeout(endBattle, 900);
  }
}

/** 捕獲処理 (プレイヤーの自分のターンにのみ選択可能) */
function executeCapture() {
  const e = battleState.enemy;

  const hpPct    = Math.max(0, e.hp / e.maxHp);
  const baseChance = 0.15 + (1 - hpPct) * 0.65;
  const chance   = Math.min(0.95, baseChance * e.type.catchMod);
  log(`ボールをなげた！ (成功率 約${Math.round(chance * 100)}%)`);

  const flash = document.getElementById('catch-flash');
  flash.style.opacity = '0.6';
  setTimeout(() => { flash.style.opacity = '0'; }, 150);

  setTimeout(() => {
    if (!battleState) return;
    if (Math.random() < chance) {
      log(`やった！ ${e.type.name} をつかまえた！`);

      const rolledRarity = rollRarity();
      const captured = {
        name:    e.type.name,
        color:   e.type.color,
        hp:      Math.round(e.type.baseHp * 0.8),
        maxHp:   e.type.baseHp,
        atk:     Math.round(4 + e.type.baseHp / 10),
        typeRef: e.type,
        element: e.type.element,
        level:   calcCaptureLevel(rolledRarity, e.isBoss),
        exp:     0,
        rarity:  rolledRarity,
      };

      // パーティに空きがあればそのまま加入、満員ならボックスへ预ける
      if (party.length < MAX_PARTY) {
        party.push(captured);
        addFieldFollower(e.type);
        updatePartyPanel();
        showToast(`${e.type.name} が なかまになった！`);
      } else {
        box.push(captured);
        updatePartyPanel();
        showToast(`${e.type.name} が なかまになった！(パーティがいっぱいなので ボックスへ)`);
      }

      // 捕獲成功時も経験値とコイン獲得
      const gainedExp = Math.round(e.type.baseHp * 0.5);
      const gainedCoins = Math.round(e.type.baseHp * 0.3) + 2;
      log(`なかま全員が ${gainedExp} のけいけんちをえた！`);
      log(`コイン+${gainedCoins} を手に入れた！`);
      coins += gainedCoins;
      updateCurrencyUI();
      
      getAllFighters().forEach(f => {
        if (f.hp > 0) gainExp(f, gainedExp);
      });

      e.alive = false;
      scene.remove(e.mesh);
      if (typeof saveGame === 'function') saveGame(false);
      setTimeout(endBattle, 900);
    } else {
      log(`あ！ボールから ${e.type.name} が でてしまった…`);
      nextActor();
    }
  }, 500);
}

/* ---------------------------------------------------------
   にげる コマンド
--------------------------------------------------------- */
btnRun.addEventListener('click', () => {
  if (!battleState || btnRun.disabled) return;
  setActionButtons(false);
  log('うまく にげきれた！');
  setTimeout(endBattle, 500);
});
