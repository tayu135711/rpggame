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
  }
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
        <div class="party-dot" style="background:#${p.color.toString(16).padStart(6, '0')}; margin-top: 4px;"></div>
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
