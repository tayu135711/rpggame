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
   戦闘背景の動的生成 (ステージに応じた背景)
--------------------------------------------------------- */
let battleBgGroup = null;
let battleState = null; // 背景初期化より前に参照されるため先に宣言

function updateBattleBackground() {
  if (battleBgGroup) {
    battleScene.remove(battleBgGroup);
  }
  battleBgGroup = new THREE.Group();
  battleScene.add(battleBgGroup);

  // ステージ1や2（迷路内）にいる時の戦闘なら暗くする
  const islandVisible = document.getElementById('island-overlay')?.style.display !== 'none';
  if (battleState && !islandVisible) {
    battleScene.background = new THREE.Color(0x140f18);
    battleScene.fog = new THREE.Fog(0x140f18, 5, 16);

    const rockMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, flatShading: true });
    for (let i = 0; i < 7; i++) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4 + Math.random()*0.3, 0), rockMat);
      const angle = (i / 7) * Math.PI * 2;
      const radius = 2.8 + Math.random()*0.5;
      rock.position.set(Math.cos(angle)*radius, 0.2, Math.sin(angle)*radius - 0.5);
      battleBgGroup.add(rock);
    }

    const wallGeo = new THREE.BoxGeometry(12, 5, 0.5);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x241a24, flatShading: true });
    const backWall = new THREE.Mesh(wallGeo, wallMat);
    backWall.position.set(0, 1.5, -4);
    battleBgGroup.add(backWall);

    const light = new THREE.PointLight(0xff7722, 1.6, 10, 1.2);
    light.position.set(0, 2.0, -3.0);
    battleBgGroup.add(light);

    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.35, 6), new THREE.MeshBasicMaterial({ color: 0xff5500 }));
    flame.position.set(0, 2.0, -2.9);
    battleBgGroup.add(flame);

    const flameInner = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 6), new THREE.MeshBasicMaterial({ color: 0xffaa00 }));
    flameInner.position.set(0, 1.95, -2.85);
    battleBgGroup.add(flameInner);

    battleFloor.material.color.setHex(0x3a2d3a);
    battleFloor.material.opacity = 0.85;

  } else {
    // 屋外
    battleScene.background = null;
    battleScene.fog = null;

    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(1.0, 20),
      new THREE.MeshBasicMaterial({ color: 0xfff3b0 })
    );
    sun.position.set(2.6, 4.2, -9.6);
    battleBgGroup.add(sun);

    const hillMatBack  = new THREE.MeshBasicMaterial({ color: 0xbfe0b8 });
    const hillMatFront = new THREE.MeshBasicMaterial({ color: 0x9fd08f });

    const hillBack = new THREE.Mesh(new THREE.CircleGeometry(6.5, 24, 0, Math.PI), hillMatBack);
    hillBack.rotation.x = -Math.PI / 2;
    hillBack.position.set(-1.5, -0.55, -8.5);
    hillBack.scale.set(1.4, 0.5, 1);
    battleBgGroup.add(hillBack);

    const hillFront = new THREE.Mesh(new THREE.CircleGeometry(5.5, 24, 0, Math.PI), hillMatFront);
    hillFront.rotation.x = -Math.PI / 2;
    hillFront.position.set(2.2, -0.55, -7.2);
    hillFront.scale.set(1.3, 0.42, 1);
    battleBgGroup.add(hillFront);

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
    battleBgGroup.add(makeCloud(-3.0, 3.4, -9.0, 1.1));
    battleBgGroup.add(makeCloud(3.4, 2.6, -9.4, 0.85));
    battleBgGroup.add(makeCloud(0.2, 4.0, -9.8, 0.7));

    battleFloor.material.color.setHex(0xffffff);
    battleFloor.material.opacity = 0.35;
  }
}
updateBattleBackground();


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
    const px = (i - (n - 1) / 2) * spacing;
    const pz = 1.4;
    m.position.set(px, 0, pz);
    m.rotation.y        = Math.PI; // 敵の方向を向く
    m.userData.fighter   = f;
    m.userData.baseScale = scale;
    m.userData.baseX     = px;
    m.userData.baseZ     = pz;
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
  enemyBattleModel.userData.baseX     = 0;
  enemyBattleModel.userData.baseZ     = -1.6;
  battleScene.add(enemyBattleModel);
}

/* ---------------------------------------------------------
   演出: ダメージポップアップ
--------------------------------------------------------- */
const damagePopupContainer = document.getElementById('damage-popup-container');

/**
 * バトル3D画面上にダメージ数値を浮かぶ
 * @param {number} dmg   - ダメージ数値
 * @param {boolean} big  - こうかはばつぐん時に大きく
 * @param {boolean} heal - 回復なら緑色
 * @param {string} side  - 'enemy'|’ally'
 */
function showDamagePopup(dmg, big = false, heal = false, side = 'enemy') {
  if (!damagePopupContainer) return;
  const el = document.createElement('div');
  el.className = 'damage-popup' + (big ? ' big' : '') + (heal ? ' heal' : '');
  // 攻撃側によって左右を分ける
  const x = side === 'enemy'
    ? 35 + Math.random() * 30
    : 60 + Math.random() * 30;
  const y = side === 'enemy' ? 20 + Math.random() * 20 : 45 + Math.random() * 20;
  el.style.left = x + '%';
  el.style.top  = y + '%';
  el.textContent = heal ? '+' + dmg : dmg;
  damagePopupContainer.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

/** コンボヒットパーティクル (敢を倒した時のきらきら) */
function spawnVictoryParticles() {
  const container = damagePopupContainer;
  if (!container) return;
  const colors = ['#ffd700','#ff6b6b','#6bffb8','#6bb8ff','#ff6bff'];
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('div');
    p.className = 'battle-particle';
    const size = 6 + Math.random() * 10;
    p.style.width  = size + 'px';
    p.style.height = size + 'px';
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.left = (20 + Math.random() * 60) + '%';
    p.style.top  = (30 + Math.random() * 30) + '%';
    p.style.animationDelay = (Math.random() * 0.4) + 's';
    container.appendChild(p);
    setTimeout(() => p.remove(), 1400);
  }
}

/* ---------------------------------------------------------
   演出: 衰撃波 (のしかかり専用)
--------------------------------------------------------- */
const shockwaveEl = document.getElementById('battle-shockwave');

function triggerShockwave() {
  if (!shockwaveEl) return;
  shockwaveEl.style.animation = 'none';
  // reflow
  void shockwaveEl.offsetWidth;
  shockwaveEl.style.animation = 'shockwave-burst 0.55s ease-out forwards';
}

/* ---------------------------------------------------------
   演出: カメラシェイク & 画面フラッシュ
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
   演出: 入場ズームイン (バトル開始時に敵が飛び込んでくる演出)
--------------------------------------------------------- */
function triggerEnemyEnterAnimation() {
  if (!enemyBattleModel) return;
  // CSSアニメーションは使えないのでThree.js上でエミュレート
  const startScale = enemyBattleModel.userData.baseScale || 1;
  const targetScale = startScale;
  enemyBattleModel.scale.set(startScale * 3.5, startScale * 3.5, startScale * 3.5);
  enemyBattleModel.userData.enterAnim = {
    start:    performance.now(),
    duration: 650,
    from:     startScale * 3.5,
    to:       targetScale,
  };
}

/* ---------------------------------------------------------
   アタックモーション
--------------------------------------------------------- */
function triggerAttackMotion(mesh, dir, type = 'normal') {
  if (!mesh) return;
  const bx = mesh.userData.baseX !== undefined ? mesh.userData.baseX : mesh.position.x;
  const bz = mesh.userData.baseZ !== undefined ? mesh.userData.baseZ : mesh.position.z;
  mesh.userData.atkAnim = {
    start:    performance.now(),
    duration: type === 'bodyslam' ? 1800 : type === 'spin' ? 1450 : type === 'jump' ? 1350 : 1150,
    dir,
    type,
    baseX: bx,
    baseZ: bz,
    baseY: mesh.position.y,
  };
}

function triggerHitReaction(mesh, opts) {
  if (!mesh) return;
  mesh.userData.hitAnim = { start: performance.now(), duration: 400 };
  const big = opts && opts.big;
  triggerCameraShake(big ? 0.28 : 0.13);
  const flashColor = opts && opts.element
    ? ({
        fire: '#ff6b30', water: '#30a8ff', nature: '#50d050',
        dark: '#a050ff', light: '#ffe050',
      }[opts.element] || '#ffffff')
    : (big ? '#ffe36b' : '#ffffff');
  triggerBattleFlash(flashColor, big ? 0.7 : 0.42);
}

function triggerDefendMotion(mesh) {
  if (!mesh) return;
  mesh.userData.defendAnim = { start: performance.now(), duration: 700 };
}

/** 毎フレーム呼び出してバトルモデルのアニメを更新 */
function updateAttackMotions() {
  const all = enemyBattleModel ? [...allyModels, enemyBattleModel] : [...allyModels];
  all.forEach(mesh => {
    if (!mesh) return;
    const baseScale = mesh.userData.baseScale || 1;
    const bx = mesh.userData.baseX !== undefined ? mesh.userData.baseX : mesh.position.x;
    const bz = mesh.userData.baseZ !== undefined ? mesh.userData.baseZ : mesh.position.z;

    // Entrance animation
    if (mesh.userData.enterAnim) {
      const ea = mesh.userData.enterAnim;
      const t  = Math.min(1, (performance.now() - ea.start) / ea.duration);
      const ease = 1 - Math.pow(1 - t, 3);
      const s = ea.from + (ea.to - ea.from) * ease;
      mesh.scale.set(s, s, s);
      if (t >= 1) {
        mesh.scale.set(ea.to, ea.to, ea.to);
        delete mesh.userData.enterAnim;
      }
      return;
    }

    if (mesh.userData.atkAnim) {
      const a = mesh.userData.atkAnim;
      const t = Math.min(1, (performance.now() - a.start) / a.duration);

      if (a.type === 'bodyslam') {
        const phase1End = 0.35;
        const phase2End = 0.70;
        if (t < phase1End) {
          const tp = t / phase1End;
          const s = baseScale * (1 + tp * 0.45);
          mesh.scale.set(s, s * (1 + tp * 0.25), s);
          mesh.position.z = a.baseZ - tp * 0.8;
          mesh.rotation.x = tp * 0.3;
          mesh.position.x = a.baseX;
        } else if (t < phase2End) {
          const tp = (t - phase1End) / (phase2End - phase1End);
          const squash = 1 - tp * 0.55;
          const s = baseScale * 1.45;
          mesh.scale.set(s * (1 + tp * 0.4), s * squash, s * (1 + tp * 0.4));
          mesh.position.z = a.baseZ - 0.8 + tp * 3.5;
          mesh.position.y = -tp * 0.25;
          mesh.rotation.x = 0.3 - tp * 0.6;
          mesh.position.x = a.baseX;
          if (tp > 0.85 && !a.shockwaveTriggered) {
            a.shockwaveTriggered = true;
            triggerShockwave();
            triggerCameraShake(0.35);
            triggerBattleFlash('#ff8830', 0.7);
          }
        } else {
          const tp = (t - phase2End) / (1 - phase2End);
          const bounce = Math.sin(tp * Math.PI) * 0.15;
          mesh.scale.set(baseScale * (1 + bounce * 0.1), baseScale * (1 - bounce * 0.05), baseScale * (1 + bounce * 0.1));
          mesh.position.z = a.baseZ + (1 - tp) * 2.7;
          mesh.position.y = Math.sin(tp * Math.PI) * 0.08;
          mesh.rotation.x = -(1 - tp) * 0.3;
          mesh.position.x = a.baseX;
        }
        if (t >= 1) {
          mesh.position.set(a.baseX, 0, a.baseZ);
          mesh.scale.set(baseScale, baseScale, baseScale);
          mesh.rotation.x = 0;
          delete mesh.userData.atkAnim;
        }

      } else if (a.type === 'spin') {
        const lunge = Math.sin(t * Math.PI) * 0.8;
        mesh.position.z = a.baseZ + a.dir.z * lunge;
        mesh.position.x = a.baseX + a.dir.x * lunge;
        mesh.rotation.y = t * Math.PI * 4;
        const s = baseScale * (1 + Math.sin(t * Math.PI) * 0.18);
        mesh.scale.set(s, s, s);
        if (t >= 1) {
          mesh.position.set(a.baseX, 0, a.baseZ);
          mesh.scale.set(baseScale, baseScale, baseScale);
          mesh.rotation.y = mesh === enemyBattleModel ? 0 : Math.PI;
          delete mesh.userData.atkAnim;
        }

      } else if (a.type === 'jump') {
        const lunge  = Math.sin(t * Math.PI) * 0.7;
        const height = Math.sin(t * Math.PI) * 0.8;
        mesh.position.x = a.baseX + a.dir.x * lunge;
        mesh.position.z = a.baseZ + a.dir.z * lunge;
        mesh.position.y = height;
        const s = baseScale * (1 + Math.sin(t * Math.PI) * 0.08);
        mesh.scale.set(s, s, s);
        if (t >= 1) {
          mesh.position.set(a.baseX, 0, a.baseZ);
          mesh.scale.set(baseScale, baseScale, baseScale);
          delete mesh.userData.atkAnim;
        }

      } else {
        const lunge = Math.sin(t * Math.PI) * 0.6;
        mesh.position.x = a.baseX + a.dir.x * lunge;
        mesh.position.z = a.baseZ + a.dir.z * lunge;
        const s = baseScale * (1 + Math.sin(t * Math.PI) * 0.1);
        mesh.scale.set(s, s, s);
        if (t >= 1) {
          mesh.position.set(a.baseX, 0, a.baseZ);
          mesh.scale.set(baseScale, baseScale, baseScale);
          delete mesh.userData.atkAnim;
        }
      }
    } else if (mesh.userData.hitAnim) {
      const h = mesh.userData.hitAnim;
      const t = Math.min(1, (performance.now() - h.start) / h.duration);
      const s = baseScale * (1 - Math.sin(t * Math.PI) * 0.15);
      mesh.scale.set(s, s, s);
      const shake = Math.sin(t * Math.PI * 6) * 0.06 * (1 - t);
      mesh.position.x = bx + shake;
      mesh.position.z = bz;
      if (t >= 1) {
        mesh.scale.set(baseScale, baseScale, baseScale);
        mesh.position.set(bx, 0, bz);
        delete mesh.userData.hitAnim;
      }
    } else if (mesh.userData.defendAnim) {
      const d = mesh.userData.defendAnim;
      const t = Math.min(1, (performance.now() - d.start) / d.duration);
      const dip = Math.sin(t * Math.PI) * 0.14;
      const s   = baseScale * (1 + dip * 0.4);
      mesh.scale.set(s, s * (1 - dip * 0.5), s);
      mesh.position.y = -dip * 0.5;
      mesh.position.x = bx;
      mesh.position.z = bz;
      if (t >= 1) {
        mesh.scale.set(baseScale, baseScale, baseScale);
        mesh.position.set(bx, 0, bz);
        delete mesh.userData.defendAnim;
      }
    } else {
      // 待機中のブレスアニメーション (弦波ブリング)
      const breathPhase = performance.now() / 1000;
      mesh.position.y = Math.sin(breathPhase * 1.4 + mesh.id) * 0.04
                      + Math.sin(breathPhase * 2.3 + mesh.id * 0.5) * 0.02;
      const breathScale = 1 + Math.sin(breathPhase * 1.2 + mesh.id) * 0.015;
      mesh.scale.set(baseScale * breathScale, baseScale / breathScale, baseScale * breathScale);
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
let bossReturnScheduled = false;

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
  bossReturnScheduled = false;
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
  
  // 背景更新
  updateBattleBackground();
  
  placeBattleModels();
  // 入場ズームイン演出
  triggerEnemyEnterAnimation();
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

function scheduleBossReturn() {
  if (bossReturnScheduled) return;
  bossReturnScheduled = true;
  setTimeout(() => {
    // 報酬・セーブ処理に影響されず、ボス撃破後は必ず島へ戻す。
    try { endBattle(); } finally {
      try { openIslandOverlay(); } catch (err) {
        const island = document.getElementById('island-overlay');
        if (island) island.style.display = 'flex';
      }
    }
    showToast('ボスを倒した！ しまに戻ってきた！');
  }, 1800);
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
      showDamagePopup(healAmt, false, true, 'enemy');
      updateHpBar();
      finishEnemyTurn();
      return;
    }

    let dmg = Math.max(1, Math.round((e.type.atk || 5) * (0.8 + Math.random() * 0.4)));
    if (e.atkDebuffTurns > 0) dmg = Math.round(dmg * e.atkDebuffMult);
    if (skill) dmg = Math.round(dmg * skill.dmgMult);

    // のしかかり専用モーション (bodySlamフラグがある敵タイプの時)
    const useBodySlam = e.type.bodySlam && Math.random() < 0.45;
    if (useBodySlam) {
      triggerAttackMotion(enemyBattleModel, { x: 0, z: 1 }, 'bodyslam');
      log(`${e.type.name} の のしかかり！どどどどっ！！`);
      dmg = Math.round(dmg * 1.4); // のしかかりは強力
    } else {
      // ランダムにモーションを切り替え
      const motionType = Math.random() < 0.35 ? 'spin'
                        : Math.random() < 0.5  ? 'jump'
                        : 'normal';
      triggerAttackMotion(enemyBattleModel, { x: 0, z: 1 }, motionType);
    }

    let defended = false;
    if (target.defending) {
      dmg = Math.max(1, Math.round(dmg * DEFEND_DAMAGE_REDUCTION));
      defended = true;
    }

    target.hp = Math.max(0, target.hp - dmg);
    log(`${e.type.name} の ${skill ? skill.name : useBodySlam ? 'のしかかり' : 'こうげき'}！ ${target.name} に ${dmg} のダメージ！`);
    if (defended) log(`<span style="color:var(--defend);">${target.name} は ぼうぎょして ダメージを おさえた！</span>`);
    triggerHitReaction(targetModel, { element: e.type.element });
    showDamagePopup(dmg, useBodySlam, false, 'ally');
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

  // 勝利パーティクル
  spawnVictoryParticles();

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
    if (typeof spawnChest === 'function' && currentMapMode === 'bossArena') {
      spawnChest(0, -3.8, true);
      showToast('ボスを倒した！ 金の宝箱が出現した！');
    }
    scheduleBossReturn();
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

    /* return is handled by scheduleBossReturn() above
    setTimeout(() => {
      endBattle();
      showToast('ステージクリア！ しまにもどってきた');
      openIslandOverlay();
    }, 1800);
    */
  } else {
    setTimeout(endBattle, 900);
  }
}

/** 捕獲処理 (プレイヤーの自分のターンにのみ選択可能) */
function executeCapture() {
  const e = battleState.enemy;

  if (e.isBoss) {
    log('ボスはステージクリアしないとつかまえられないよ！');
    showToast('ボスはステージクリアしないとつかまえられないよ！');
    setTimeout(() => {
      if (battleState) nextActor();
    }, 700);
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
btnRun.addEventListener('click', async () => {
  if (!battleState || btnRun.disabled || !activeFighter) return;
  setActionButtons(false);

  const e = battleState.enemy;

  // ボスからは絶対に逃げられない
  if (e.isBoss) {
    log('ボスからは にげられない！');
    await wait(1000);
    if (!battleState) return;
    nextActor();
    return;
  }

  // 逃走成功確率の計算。敵の強さ(HP/攻撃力/逃走耐性)を反映し、
  // 弱い敵は逃げやすく、強い敵はほぼ逃げられないようにする。
  const partyLevels = getAllFighters().map(f => f.level || 1);
  const maxPartyLevel = Math.max(...partyLevels);
  const enemyLevel = Math.max(1, Math.round(e.maxHp / 6 + e.type.atk / 2));
  const resistance = Math.min(0.95, e.type.fleeResistance ?? 0.35);
  let runChance = 0.82 - resistance * 0.78 + (maxPartyLevel - enemyLevel) * 0.018;
  runChance = Math.max(0.04, Math.min(0.88, runChance));

  log(`にげだそうと している… (成功率: 約${Math.round(runChance * 100)}%)`);
  await wait(800);
  if (!battleState) return;

  if (Math.random() < runChance) {
    log('うまく にげきれた！');
    setTimeout(endBattle, 800);
  } else {
    log('にげられなかった！');
    await wait(1000);
    if (!battleState) return;
    // 逃走失敗時はそのキャラのターン行動を消費し、次のアクターへ
    nextActor();
  }
});
