/* =========================================================
   party.js — パーティ管理・フィールド追従・トースト通知
   依存: config.js, models.js (buildTrainerModel, ENEMY_TYPES)
   読み込み順: config.js → models.js → maze.js → party.js
========================================================= */

/* ---- トレーナー (プレイヤー本体のステータス) ---- */
const TRAINER = {
  name: 'あなた',
  color: 0x2f6fd0,
  hp: 40, maxHp: 40,
  atk: 7,
  isTrainer: true,
  element: 'light', // 主人公は光属性
  level: 1,
  exp: 0,
  rarity: 1, // レア度成長
  equips: { 頭: null, 服: null, 足: null },
};

/** 捕獲した仲間のリスト (最大 MAX_PARTY 体) */
const party = [];

/**
 * ボックス (2026/07/24 追加)
 * パーティ上限(MAX_PARTY)を超えて捕獲した仲間や、任意に预けた仲間を保管する場所。
 * ボックス内の仲間はフィールド追従モデルを持たず、経験値も獲得しない。
 */
const box = [];

/**
 * 仲間をパーティからボックスへ移動する(トレーナー本体は対象外)
 * @param {object} fighter - party配列内の要素
 * @returns {boolean} 成功したらtrue
 */
function moveToBox(fighter) {
  const idx = party.indexOf(fighter);
  if (idx === -1 || fighter.isTrainer) return false;

  party.splice(idx, 1);
  box.push(fighter);

  const model = fieldPartyModels[idx];
  if (model) {
    scene.remove(model);
    model.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
      }
    });
  }
  fieldPartyModels.splice(idx, 1);

  updatePartyPanel();
  return true;
}

/**
 * 仲間をボックスからパーティへ呼び出す
 * @param {object} fighter - box配列内の要素
 * @returns {boolean} 成功したらtrue(パーティが上限のときはfalse)
 */
function moveToParty(fighter) {
  if (party.length >= MAX_PARTY) return false;
  const idx = box.indexOf(fighter);
  if (idx === -1) return false;

  box.splice(idx, 1);
  party.push(fighter);
  if (fighter.typeRef) addFieldFollower(fighter.typeRef);

  updatePartyPanel();
  return true;
}

/**
 * フィールドでプレイヤーの後ろを追従する仲間の3Dモデルリスト
 * party と同じ順番で対応している
 */
const fieldPartyModels = [];

/** トレーナー + パーティ全員をまとめて返す */
function getAllFighters() {
  return [TRAINER, ...party];
}

/** 経験値獲得とレベルアップ処理 */
function gainExp(fighter, amount) {
  if (!fighter.level || fighter.level >= MAX_LEVEL) return;
  fighter.exp += amount;
  
  let leveledUp = false;
  while (fighter.exp >= calcNextExp(fighter.level) && fighter.level < MAX_LEVEL) {
    fighter.exp -= calcNextExp(fighter.level);
    fighter.level++;
    leveledUp = true;
    
    // ステータス上昇
    const hpGrow = Math.floor(Math.random() * 3) + 3; // +3〜5
    const atkGrow = Math.floor(Math.random() * 2) + 1; // +1〜2
    fighter.maxHp += hpGrow;
    fighter.atk += atkGrow;
    fighter.hp = fighter.maxHp; // レベルアップで全回復
  }
  
  if (leveledUp) {
    showToast(`${fighter.name} は レベル ${fighter.level} にあがった！`);
    if (typeof log === 'function' && document.getElementById('battle-overlay').style.display === 'flex') {
      log(`<span style="color:var(--gold); font-weight:bold;">${fighter.name} は レベル ${fighter.level} にあがった！</span>`);
    }
    // 主人公のレアリティ成長
    if (fighter.isTrainer) {
      const targetRarity = Math.min(5, Math.floor(fighter.level / 20) + 1);
      if (targetRarity > fighter.rarity) {
        fighter.rarity = targetRarity;
        showToast(`主人公のレアリティが星 ${fighter.rarity} にあがった！`);
      }
    }

    // モンスターのしんか (仲間のみ・Lv.20到達で見た目とステータスが強化される)
    if (!fighter.isTrainer && !fighter.evolved && fighter.level >= EVOLVE_LEVEL &&
        fighter.typeRef && fighter.typeRef.evolvedBuild) {
      fighter.evolved = true;
      fighter.name    = fighter.typeRef.evolvedName;
      const hpBoost  = Math.round(fighter.maxHp * 0.3);
      const atkBoost = Math.round(fighter.atk * 0.3);
      fighter.maxHp += hpBoost;
      fighter.atk   += atkBoost;
      fighter.hp     = fighter.maxHp;
      fighter._iconUrl = null; // 進化後の見た目でアイコンを作り直す
<<<<<<< HEAD
      refreshFieldFollowerModel(fighter);
=======
>>>>>>> ff5e4243085a73b648b156adff64bbfdcf280c13

      showToast(`✨ ${fighter.name} に しんかした！`);
      if (typeof log === 'function' && document.getElementById('battle-overlay').style.display === 'flex') {
        log(`<span style="color:var(--gold); font-weight:bold;">✨ ${fighter.name} に しんかした！</span>`);
      }
    }
  }
}

/* ---------------------------------------------------------
   パーティアイコン (3Dモデルのサムネイル画像) 生成
   各キャラの見た目がひと目でわかるよう、実際の3Dモデルを
   正面からレンダリングした画像をアイコンとして使う。
   一度生成した画像は fighter._iconUrl にキャッシュする。
--------------------------------------------------------- */
const _iconCanvas = document.createElement('canvas');
_iconCanvas.width  = 128;
_iconCanvas.height = 128;
const _iconRenderer = new THREE.WebGLRenderer({ canvas: _iconCanvas, antialias: true, alpha: true });
_iconRenderer.setSize(128, 128, false);
const _iconScene = new THREE.Scene();
_iconScene.add(new THREE.HemisphereLight(0xffffff, 0xffd9ec, 1.15));
const _iconSun = new THREE.DirectionalLight(0xffffff, 0.75);
_iconSun.position.set(2, 4, 3);
_iconScene.add(_iconSun);
const _iconCamera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);

/**
 * fighter (TRAINER または party の要素) の顔アイコン画像(dataURL)を返す。
 * @param {object} fighter
 * @returns {string} dataURL
 */
function getFighterIconUrl(fighter) {
  if (fighter._iconUrl) return fighter._iconUrl;

  const model = fighter.isTrainer
    ? buildTrainerModel()
    : (fighter.evolved && fighter.typeRef.evolvedBuild ? fighter.typeRef.evolvedBuild() : fighter.typeRef.build());
  _iconScene.add(model);

  // モデル全体のバウンディングボックスに合わせてカメラを自動フレーミング
  const box    = new THREE.Box3().setFromObject(model);
  const size   = new THREE.Vector3(); box.getSize(size);
  const center = new THREE.Vector3(); box.getCenter(center);
  const radius = Math.max(size.x, size.y, size.z, 0.4) * 0.7;

  _iconCamera.position.set(center.x, center.y + size.y * 0.08, center.z + radius * 2.3);
  _iconCamera.lookAt(center.x, center.y, center.z);
  _iconCamera.updateProjectionMatrix();

  _iconRenderer.setClearColor(0x000000, 0);
  _iconRenderer.clear();
  _iconRenderer.render(_iconScene, _iconCamera);
  fighter._iconUrl = _iconCanvas.toDataURL('image/png');

  // 使い終わったモデルは破棄してメモリリークを防ぐ
  _iconScene.remove(model);
  model.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
    }
  });

  return fighter._iconUrl;
}

/* ---------------------------------------------------------
   パーティパネル UI 更新
--------------------------------------------------------- */
function updatePartyPanel() {
  document.getElementById('party-count').textContent = party.length;
  const list = document.getElementById('party-list');
  const rows = getAllFighters().map(p => {
    const elemBadge = p.element ? `<span style="background:${ELEMENT_COLORS[p.element]}; color:#fff; font-size:9px; padding:1px 3px; border:1.5px solid var(--ink); margin-left:4px; font-weight:800; border-radius:2px;">${ELEMENT_NAMES[p.element]}</span>` : '';
    const lvText = p.level ? ` <span style="color:var(--red); font-size:10px; font-weight:800;">Lv.${p.level}</span>` : '';
    const stars = p.rarity ? '★'.repeat(p.rarity) : '';
    return `
      <div class="party-member" style="border-bottom:1px dashed var(--ink); padding-bottom:4px; align-items: flex-start; gap: 8px;">
        <img class="party-icon" src="${getFighterIconUrl(p)}" alt="${p.name}">
        <div style="display:flex; flex-direction:column; gap:2px;">
          <div style="display:flex; align-items:center; flex-wrap: wrap; gap:2px;">
            <span style="font-size:12px; font-weight:800;">${p.name}</span>
            ${lvText}
            ${elemBadge}
          </div>
          <div style="font-size:9px; color:#e0a83a; font-weight:800; line-height:1;">${stars}</div>
          <div style="font-size:9px; font-weight:700; opacity:0.8;">HP ${Math.max(0, Math.ceil(p.hp))}/${p.maxHp}</div>
        </div>
      </div>
    `;
  }).join('');
  list.innerHTML = rows || '<span style="color:#999;">まだ誰もいない…</span>';
}

/* ---------------------------------------------------------
   フィールド追従モデルの追加
--------------------------------------------------------- */
/**
 * 新しい仲間のフィールド追従モデルを生成してシーンに追加する
 * @param {object} type - ENEMY_TYPES の要素 (または { build, color } を持つオブジェクト)
 */
function addFieldFollower(type) {
  const m         = type.build();
  const behindDist = FOLLOW_GAP * (fieldPartyModels.length + 1);
  const angle      = player.rotation.y;
  m.scale.set(0.65, 0.65, 0.65);
  m.position.set(
    player.position.x - Math.sin(angle) * behindDist,
    0,
    player.position.z - Math.cos(angle) * behindDist
  );
  scene.add(m);
  fieldPartyModels.push(m);
}

/**
 * 仲間がしんかしたときに、フィールド追従モデルを進化後の見た目に差し替える
 * @param {object} fighter - party 配列内のしんかした仲間
 */
function refreshFieldFollowerModel(fighter) {
  const idx = party.indexOf(fighter);
  if (idx === -1) return;
  const oldModel = fieldPartyModels[idx];
  if (!oldModel || !fighter.typeRef || !fighter.typeRef.evolvedBuild) return;

  const newModel = fighter.typeRef.evolvedBuild();
  newModel.scale.set(0.65, 0.65, 0.65);
  newModel.position.copy(oldModel.position);
  newModel.rotation.y = oldModel.rotation.y;

  scene.remove(oldModel);
  oldModel.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => m.dispose());
    }
  });

  scene.add(newModel);
  fieldPartyModels[idx] = newModel;
}

/* ---------------------------------------------------------
   フィールド追従アニメーション (毎フレーム呼び出す)
--------------------------------------------------------- */
function updateFieldFollowers(dt) {
  let leaderPos = player.position;
  for (const model of fieldPartyModels) {
    const dx   = leaderPos.x - model.position.x;
    const dz   = leaderPos.z - model.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > FOLLOW_GAP) {
      const move = Math.min(FOLLOW_SPEED * dt, dist - FOLLOW_GAP);
      model.position.x += (dx / dist) * move;
      model.position.z += (dz / dist) * move;
      model.rotation.y  = Math.atan2(dx, dz);
    }
    // ふわふわ浮遊
    model.position.y = Math.sin(performance.now() / 400 + model.id) * 0.05;
    leaderPos = model.position;
  }
}

/* ---------------------------------------------------------
   パーティ全回復 (島に帰還時)
--------------------------------------------------------- */
function healPartyFully() {
  const fighters  = getAllFighters();
  const needsHeal = fighters.some(f => f.hp < f.maxHp);
  fighters.forEach(f => { f.hp = f.maxHp; });
  updatePartyPanel();
  return needsHeal;
}

/* ---------------------------------------------------------
   トースト通知
--------------------------------------------------------- */
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent  = msg;
  t.style.opacity = '1';
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => { t.style.opacity = '0'; }, 2200);
}

/* ---------------------------------------------------------
   装備の装着・解除処理
--------------------------------------------------------- */
function equipItem(fighter, item) {
  fighter.equips = fighter.equips || { 頭: null, 服: null, 足: null };
  const part = item.part;
  
  if (fighter.equips[part]) {
    unequipItem(fighter, part);
  }
  
  fighter.equips[part] = item;
  item.equippedTo = fighter;
  
  fighter.maxHp += item.hpBonus;
  fighter.atk += item.atkBonus;
  fighter.hp = Math.min(fighter.maxHp, fighter.hp + item.hpBonus);
  
  updatePartyPanel();
  if (typeof updateAllyHpList === 'function' && document.getElementById('battle-overlay').style.display === 'flex') {
    updateAllyHpList();
  }
}

function unequipItem(fighter, part) {
  fighter.equips = fighter.equips || { 頭: null, 服: null, 足: null };
  const item = fighter.equips[part];
  if (!item) return;
  
  fighter.maxHp = Math.max(1, fighter.maxHp - item.hpBonus);
  fighter.atk = Math.max(1, fighter.atk - item.atkBonus);
  fighter.hp = Math.min(fighter.maxHp, fighter.hp);
  
  item.equippedTo = null;
  fighter.equips[part] = null;
  
  updatePartyPanel();
  if (typeof updateAllyHpList === 'function' && document.getElementById('battle-overlay').style.display === 'flex') {
    updateAllyHpList();
  }
}
