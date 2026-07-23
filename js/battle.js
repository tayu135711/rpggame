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
battleCamera.position.set(0, 2.5, 4.6);
battleCamera.lookAt(0, 1.0, -1.2);
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
    const m    = f.isTrainer ? buildTrainerModel() : f.typeRef.build();
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

function triggerHitReaction(mesh) {
  if (!mesh) return;
  mesh.userData.hitAnim = { start: performance.now(), duration: 280 };
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
    } else {
      // 待機中のふわふわ浮遊
      mesh.position.y = Math.sin(performance.now() / 450 + mesh.id) * 0.05;
    }
  });
}

/* ---------------------------------------------------------
   バトルUI ヘルパー
--------------------------------------------------------- */
const overlay       = document.getElementById('battle-overlay');
const battleLog     = document.getElementById('battle-log');
const btnActiveCmd  = document.getElementById('btn-active-cmd');
const btnRun        = document.getElementById('btn-run');
const queueListEl   = document.getElementById('battle-queue-list');

let currentCommandIndex = 0;

function log(msg) {
  battleLog.innerHTML += `<div>${msg}</div>`;
  battleLog.scrollTop  = battleLog.scrollHeight;
}

function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function setActionButtons(enabled) {
  btnActiveCmd.disabled = !enabled;
  btnRun.disabled       = !enabled;
}

/** コマンドキューおよびアクティブボタンの見た目を更新 */
function updateCommandUI() {
  const currentCmd = COMMAND_ROTATION[currentCommandIndex];
  
  // アクティブボタンの更新
  const btnText = document.getElementById('cmd-active-text');
  const btnIcon = document.getElementById('cmd-active-icon');
  
  // クラスのクリーンアップ
  btnActiveCmd.className = 'btn cmd';
  btnIcon.className = 'cmd-icon';

  if (currentCmd === 'capture') {
    btnActiveCmd.classList.add('capture-btn');
    btnText.textContent = 'つかまえる';
    btnIcon.classList.add('icon-capture');
  } else {
    const elemName = ELEMENT_NAMES[currentCmd];
    btnActiveCmd.classList.add(`${currentCmd}-btn`);
    btnText.textContent = `${elemName}こうげき (全員)`;
    btnIcon.classList.add('icon-attack');
  }

  // キューリストの更新 (現在のターンから未来の6個を表示)
  queueListEl.innerHTML = '';
  for (let i = 0; i < COMMAND_ROTATION.length; i++) {
    const idx = (currentCommandIndex + i) % COMMAND_ROTATION.length;
    const cmd = COMMAND_ROTATION[idx];
    
    const item = document.createElement('div');
    item.className = 'queue-item';
    if (i === 0) item.classList.add('active');
    
    if (cmd === 'capture') {
      item.textContent = '捕';
      item.style.backgroundColor = 'var(--capture)';
    } else {
      item.textContent = ELEMENT_NAMES[cmd].substring(0, 1);
      item.style.backgroundColor = ELEMENT_COLORS[cmd];
    }
    queueListEl.appendChild(item);
  }
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
        <div class="ally-card-dot" style="background:#${f.color.toString(16).padStart(6, '0')}"></div>
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
  
  // コマンドローテーションの初期化
  currentCommandIndex = 0;
  updateCommandUI();
  
  updateAllyHpList();
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
  const alive = getAllFighters().filter(f => f.hp > 0);
  if (alive.length === 0) return;

  const target      = alive[Math.floor(Math.random() * alive.length)];
  const targetModel = findModelFor(target);
  triggerAttackMotion(enemyBattleModel, { x: 0, z: 1 });

  setTimeout(() => {
    if (!battleState) return;
    const e   = battleState.enemy;
    const dmg = Math.max(1, Math.round((e.type.atk || 5) * (0.8 + Math.random() * 0.4)));
    target.hp = Math.max(0, target.hp - dmg);
    log(`${e.type.name} の こうげき！ ${target.name} に ${dmg} のダメージ！`);
    triggerHitReaction(targetModel);
    updateAllyHpList();

    if (target.hp <= 0) log(`${target.name} は たおれた！`);

    const stillAlive = getAllFighters().some(f => f.hp > 0);
    if (!stillAlive) {
      log('みんな たおれてしまった…しまに はこばれた…');
      setActionButtons(false);
      setTimeout(() => { endBattle(); openIslandOverlay(); }, 1600);
    } else {
      // ターン属性を進める
      currentCommandIndex = (currentCommandIndex + 1) % COMMAND_ROTATION.length;
      updateCommandUI();
      setActionButtons(true);
    }
  }, 280);
}

/* ---------------------------------------------------------
   属性コマンドの実行
--------------------------------------------------------- */
btnActiveCmd.addEventListener('click', async () => {
  if (!battleState || btnActiveCmd.disabled) return;
  setActionButtons(false);

  const currentCmd = COMMAND_ROTATION[currentCommandIndex];
  if (currentCmd === 'capture') {
    executeCapture();
  } else {
    await executeElementAttack(currentCmd);
  }
});

/** 属性攻撃処理 */
async function executeElementAttack(turnElement) {
  const fighters = getAllFighters().filter(f => f.hp > 0);
  const e = battleState.enemy;
  const enemyElement = e.type.element;

  // 属性相性倍率
  const affinity = ELEMENT_AFFINITY[turnElement]?.[enemyElement] || 1.0;
  log(`【${ELEMENT_NAMES[turnElement]}属性のターン！】`);
  if (affinity > 1.0) {
    log('<span style="color:var(--red);">こうかは ばつぐんだ！</span>');
  } else if (affinity < 1.0) {
    log('<span style="color:var(--gold);">こうかは いまひとつ のようだ…</span>');
  }

  for (const f of fighters) {
    if (!battleState) return;
    const model = findModelFor(f);
    triggerAttackMotion(model, { x: 0, z: -1 });
    await wait(180);
    if (!battleState) return;

    // 基本ダメージ
    let dmg = Math.max(1, Math.round(f.atk + Math.random() * 5));
    
    // 属性相性乗算
    dmg = Math.round(dmg * affinity);
    
    // 味方と同属性ならボーナス (1.2倍)
    if (f.element === turnElement) {
      dmg = Math.round(dmg * 1.2);
    }
    
    e.hp -= dmg;
    log(`${f.name} の こうげき！ ${e.type.name} に ${dmg} のダメージ！`);
    triggerHitReaction(enemyBattleModel);
    updateHpBar();

    if (e.hp <= 0) {
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
        
        // ステージ2のロック解除
        const stage2 = STAGES.find(st => st.no === 2);
        if (stage2) {
          stage2.unlocked = true;
          // UIを更新
          const dots = document.querySelectorAll('.stage-dot');
          if (dots[1]) dots[1].classList.remove('locked');
        }
        
        setTimeout(() => {
          endBattle();
          showToast('ステージクリア！ しまにもどってきた');
          openIslandOverlay();
        }, 1000);
      } else {
        setTimeout(endBattle, 900);
      }
      return;
    }
    await wait(200);
  }
  enemyCounterattack();
}

/** 捕獲処理 */
function executeCapture() {
  const e = battleState.enemy;

  if (party.length >= MAX_PARTY) {
    log('パーティがいっぱいだ！これ以上つかまえられない。');
    setActionButtons(true);
    return;
  }

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
      party.push({
        name:    e.type.name,
        color:   e.type.color,
        hp:      Math.round(e.type.baseHp * 0.8),
        maxHp:   e.type.baseHp,
        atk:     Math.round(4 + e.type.baseHp / 10),
        typeRef: e.type,
        element: e.type.element,
        level:   e.isBoss ? 15 : 5,
        exp:     0,
        rarity:  rolledRarity,
      });
      
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

      addFieldFollower(e.type);
      updatePartyPanel();
      showToast(`${e.type.name} が なかまになった！`);
      e.alive = false;
      scene.remove(e.mesh);
      setTimeout(endBattle, 900);
    } else {
      log(`あ！ボールから ${e.type.name} が でてしまった…`);
      enemyCounterattack();
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
