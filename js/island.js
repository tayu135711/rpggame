/* =========================================================
   island.js — 島シーン・ガチャ・パーティ編成 UI
   依存: THREE, config.js, models.js, party.js
   読み込み順: config.js → models.js → maze.js → party.js → island.js
========================================================= */

/* ---------------------------------------------------------
   通貨
--------------------------------------------------------- */
let diamonds = 20;
let coins    = 50;

function updateCurrencyUI() {
  document.getElementById('diamond-count').textContent = diamonds;
  document.getElementById('coin-count').textContent    = coins;
}

/* ---------------------------------------------------------
   島シーン (Three.js)
--------------------------------------------------------- */
const islandCanvas   = document.getElementById('island-canvas');
const islandScene    = new THREE.Scene();
const islandCamera   = new THREE.PerspectiveCamera(45, 1, 0.1, 60);
const islandRenderer = new THREE.WebGLRenderer({ canvas: islandCanvas, antialias: true, alpha: true });

islandScene.add(new THREE.HemisphereLight(0xffffff, 0x2f6fae, 1.1));
const islandSun = new THREE.DirectionalLight(0xfff3d0, 0.55);
islandSun.position.set(5, 8, 4);
islandScene.add(islandSun);

// 水面
const water = new THREE.Mesh(
  new THREE.CircleGeometry(20, 32),
  new THREE.MeshStandardMaterial({ color: 0x3fa8e0, roughness: 1 })
);
water.rotation.x = -Math.PI / 2;
water.position.y = -0.05;
islandScene.add(water);

// 砂浜
const sand = new THREE.Mesh(
  new THREE.CylinderGeometry(3.2, 3.4, 0.3, 24),
  new THREE.MeshStandardMaterial({ color: 0xf0d89a, roughness: 1 })
);
sand.position.y = -0.15; // 表面がy=0になる高さ
islandScene.add(sand);

// 草地
const islandGrass = new THREE.Mesh(
  new THREE.CylinderGeometry(2.4, 2.7, 0.28, 24),
  new THREE.MeshStandardMaterial({ color: 0x6bc96b, roughness: 1 })
);
islandGrass.position.y = -0.11; // 砂浜よりわずかに高くZファイティング回避
islandScene.add(islandGrass);

// ヤシの木
[[1.3, 0.6], [-1.5, 0.8], [0.2, -1.6], [-0.9, -1.1]].forEach(([x, z]) => {
  islandScene.add(buildPalmTree(x, z, 0.9 + Math.random() * 0.3));
});

// 島プレイヤー
const islandPlayer = buildTrainerModel();
islandPlayer.scale.set(0.42, 0.42, 0.42);
islandPlayer.position.set(0, 0, 1.6);
islandScene.add(islandPlayer);

/* ---------------------------------------------------------
   島のリサイズ対応
--------------------------------------------------------- */
function resizeIslandCanvas() {
  const w = islandCanvas.clientWidth  || 400;
  const h = islandCanvas.clientHeight || 400;
  islandRenderer.setSize(w, h, false);
  islandCamera.aspect = w / h;
  islandCamera.updateProjectionMatrix();
}

/* ---------------------------------------------------------
   島プレイヤー移動 (毎フレーム)
--------------------------------------------------------- */
function updateIslandPlayer(dt) {
  let dx = 0, dz = 0;
  if (keys['w'] || keys['arrowup'])    dz -= 1;
  if (keys['s'] || keys['arrowdown'])  dz += 1;
  if (keys['a'] || keys['arrowleft'])  dx -= 1;
  if (keys['d'] || keys['arrowright']) dx += 1;

  if (dx !== 0 || dz !== 0) {
    const len = Math.hypot(dx, dz);
    dx /= len; dz /= len;
    let nx = islandPlayer.position.x + dx * ISLAND_PLAYER_SPEED * dt;
    let nz = islandPlayer.position.z + dz * ISLAND_PLAYER_SPEED * dt;
    const dist = Math.hypot(nx, nz);
    if (dist > ISLAND_RADIUS) {
      nx *= ISLAND_RADIUS / dist;
      nz *= ISLAND_RADIUS / dist;
    }
    islandPlayer.position.x = nx;
    islandPlayer.position.z = nz;
    islandPlayer.rotation.y = Math.atan2(dx, dz);
  }
  updateWalkAnimation(islandPlayer, dt, dx !== 0 || dz !== 0);

  // カメラ追従
  const targetPos = islandPlayer.position.clone().add(new THREE.Vector3(0, 2.5, 3.1));
  islandCamera.position.lerp(targetPos, 0.1);
  islandCamera.lookAt(islandPlayer.position.clone().add(new THREE.Vector3(0, 0.35, 0)));
}

/* ---------------------------------------------------------
   島オーバーレイの開閉
--------------------------------------------------------- */
let islandOverlayOpen = true;

const islandOverlayEl = document.getElementById('island-overlay');
const hudEl           = document.getElementById('hud');
const partyPanelEl    = document.getElementById('party-panel');

function openIslandOverlay() {
  islandOverlayOpen = true;
  islandOverlayEl.style.display = 'flex';
  hudEl.style.display       = 'none';
  partyPanelEl.style.display = 'none';
  document.getElementById('minimap-wrap').style.display = 'none';
  document.getElementById('minimap-zoom-overlay').style.display = 'none';
  minimapZoomOpen = false;
  resizeIslandCanvas();
  islandPlayer.position.set(0, 0, 1.6);
  islandPlayer.rotation.y = 0;
  resetFieldAtmosphere();
  const healed = healPartyFully();
  if (healed) showToast('しまで やすんで、なかまが ぜんかいふくした！');
}

function closeIslandOverlay() {
  islandOverlayOpen = false;
  islandOverlayEl.style.display = 'none';
  hudEl.style.display       = 'block';
  partyPanelEl.style.display = 'block';
}

/* ---------------------------------------------------------
   ステージドット UI
--------------------------------------------------------- */
const stageDotsEl = document.getElementById('stage-dots');
const stageCardEl = document.getElementById('stage-card');
const btnDepart   = document.getElementById('btn-depart');
let selectedStage = null;

STAGES.forEach(st => {
  const dot = document.createElement('div');
  dot.className = 'stage-dot' + (st.unlocked ? '' : ' locked');
  dot.textContent = st.no;
  dot.addEventListener('click', () => selectStage(st, dot));
  stageDotsEl.appendChild(dot);
});

function selectStage(st, dotEl) {
  document.querySelectorAll('.stage-dot').forEach(d => d.classList.remove('selected'));
  dotEl.classList.add('selected');
  selectedStage = st;
  document.getElementById('stage-card-icon').textContent = st.letter;
  document.getElementById('stage-card-name').textContent = `ステージ${st.no}: ${st.name}`;
  document.getElementById('stage-card-desc').textContent = st.desc;
  btnDepart.textContent = st.unlocked ? '出発する' : 'じゅんびちゅう';
  btnDepart.disabled    = !st.unlocked;
  stageCardEl.style.display = 'block';
}

btnDepart.addEventListener('click', () => {
  if (!selectedStage || !selectedStage.unlocked) return;
  closeIslandOverlay();
  if (selectedStage.no === 1) setupStage1();
  else if (selectedStage.no === 2) setupStage2();
});

/* ---------------------------------------------------------
   ガチャモーダル & 装備インベントリ
--------------------------------------------------------- */
const gachaModal    = document.getElementById('gacha-modal');
const gachaResultEl = document.getElementById('gacha-result');

/** プレイヤーの所持装備リスト */
const playerEquipInventory = [];
let currentGachaTab = 'equip';

// 装備の形容詞マッピング
const EQUIP_PREFIXES = {
  1: ['ボロい', 'ふつうの', 'みならいの'],
  2: ['がんじょうな', 'てつの', 'ブロンズ'],
  3: ['かがやく', 'ぎんの', 'シルバー'],
  4: ['まほうの', 'きんの', 'ゴールド'],
  5: ['でんせつの', 'しんぴの', 'プラチナ'],
};

/**
 * 指定レア度の装備アイテムをランダムに1つ生成して返す(所持リストへの追加は呼び出し側で行う)
 * @param {number} rarity - 1〜5
 * @returns {object} 装備アイテム
 */
function createEquipItem(rarity) {
  const part = EQUIP_PARTS[Math.floor(Math.random() * EQUIP_PARTS.length)];
  const prefixes = EQUIP_PREFIXES[rarity];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const partNameMap = { '頭': 'ヘッドギア', '服': 'ウェア', '足': 'ブーツ' };
  const equipName = `${prefix}${partNameMap[part]}`;
  const bonus = EQUIP_STAT_BY_RARITY[rarity];

  return {
    id: performance.now() + Math.random(),
    name: equipName,
    part: part,
    rarity: rarity,
    hpBonus: bonus.hp,
    atkBonus: bonus.atk,
    equippedTo: null, // 誰にも装備されていない
  };
}

document.getElementById('btn-open-gacha').addEventListener('click', () => {
  currentGachaTab = 'equip';
  gachaResultEl.textContent = 'そうびガチャ: コインを30消費して、装備を1つひくよ';
  gachaModal.style.display = 'flex';
});

document.getElementById('btn-gacha-close').addEventListener('click', () => {
  gachaModal.style.display = 'none';
});

document.getElementById('tab-equip').addEventListener('click', () => {
  currentGachaTab = 'equip';
  gachaResultEl.textContent = 'そうびガチャ: コインを30消費して、装備を1つひくよ';
});

document.getElementById('tab-premium').addEventListener('click', () => {
  currentGachaTab = 'premium';
  gachaResultEl.textContent =
    `プレミアムそうびガチャ: ダイヤを${GACHA_COST_PREMIUM_EQUIP}消費して、星${PREMIUM_GACHA_MIN_RARITY}以上確定の装備を1つひくよ`;
});

// でんぱガチャは廃止(仕様書5-5)。仲間の入手はバトル内の捕獲のみ。
// ダイヤの使い道はプレミアムそうびガチャ(レア度保証)に一本化(仕様書5-13)
document.getElementById('btn-gacha-pull').addEventListener('click', () => {
  const isPremium = currentGachaTab === 'premium';

  if (isPremium) {
    if (diamonds < GACHA_COST_PREMIUM_EQUIP) {
      gachaResultEl.textContent = 'ダイヤが たりない…';
      return;
    }
  } else {
    if (coins < GACHA_COST_EQUIP) {
      gachaResultEl.textContent = 'コインが たりない…';
      return;
    }
  }

  if (isPremium) {
    diamonds -= GACHA_COST_PREMIUM_EQUIP;
  } else {
    coins -= GACHA_COST_EQUIP;
  }
  updateCurrencyUI();

  const rolledRarity = isPremium ? rollRarityWithFloor(PREMIUM_GACHA_MIN_RARITY) : rollRarity();
  const newEquip = createEquipItem(rolledRarity);
  playerEquipInventory.push(newEquip);

  const stars = '★'.repeat(rolledRarity) + '☆'.repeat(5 - rolledRarity);
  gachaResultEl.innerHTML = `<span style="color:var(--green);">${newEquip.name}</span> をてにいれた！<br><span style="color:#e0a83a;">${stars}</span><br>HP+${newEquip.hpBonus} / ATK+${newEquip.atkBonus}`;
  showToast(`${newEquip.name} を てにいれた！`);
});

/* ---------------------------------------------------------
   パーティ編成モーダル & 装備変更UI
--------------------------------------------------------- */
const partyModal = document.getElementById('party-modal');

function renderPartyRoster() {
  const el = document.getElementById('party-roster');
  el.innerHTML = getAllFighters().map((f, index) => {
    const headText = f.equips?.頭 ? f.equips.頭.name : 'なし';
    const bodyText = f.equips?.服 ? f.equips.服.name : 'なし';
    const legText = f.equips?.足 ? f.equips.足.name : 'なし';
    const stars = p => p.rarity ? '★'.repeat(p.rarity) + '☆'.repeat(5 - p.rarity) : '';
    
    return `
      <div class="roster-row" style="flex-direction: column; align-items: flex-start; gap: 4px; padding: 10px 6px;">
        <div style="display:flex; align-items:center; width:100%; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:8px;">
            <img class="roster-icon" src="${getFighterIconUrl(f)}" alt="${f.name}">
            <div class="roster-name" style="width:auto; font-weight:800;">${f.name} (Lv.${f.level || 1})</div>
            ${f.element ? `<span style="background:${ELEMENT_COLORS[f.element]}; color:#fff; font-size:9px; padding:1px 3px; border:1.5px solid var(--ink); font-weight:800; border-radius:2px;">${ELEMENT_NAMES[f.element]}</span>` : ''}
          </div>
          <div style="display:flex; gap:6px;">
            ${!f.isTrainer ? `<button class="btn" style="font-size:11px; padding:4px 8px; background:var(--red); box-shadow:1.5px 1.5px 0 var(--ink);" onclick="actionSendToBox(${index})">ボックスへ</button>` : ''}
            <button class="btn" style="font-size:11px; padding:4px 8px; background:var(--plum); box-shadow:1.5px 1.5px 0 var(--ink);" onclick="openEquipManager(${index})">そうび変更</button>
          </div>
        </div>
        <div class="roster-stats">
          <div style="color:#e0a83a; font-weight:800; font-size:10px; margin-bottom:2px;">${stars(f)}</div>
          HP: ${Math.max(0, Math.ceil(f.hp))}/${f.maxHp} ・ ATK: ${f.atk}<br>
          <span style="font-size:10px; opacity:0.8; font-weight:700;">頭: ${headText} | 服: ${bodyText} | 足: ${legText}</span>
        </div>
      </div>
    `;
  }).join('');
}

window.renderPartyRoster = renderPartyRoster;

/* ---------------------------------------------------------
   ボックス UI (2026/07/24 追加)
   パーティ上限(MAX_PARTY)を超えて捕獲した仲間、または任意に预けた仲間の一覧
--------------------------------------------------------- */
function renderBoxRoster() {
  const el = document.getElementById('party-roster');
  const rows = box.length > 0 ? box.map((f, index) => {
    const stars = f.rarity ? '★'.repeat(f.rarity) + '☆'.repeat(5 - f.rarity) : '';
    return `
      <div class="roster-row" style="align-items:center; gap:8px; padding:10px 6px;">
        <img class="roster-icon" src="${getFighterIconUrl(f)}" alt="${f.name}">
        <div style="flex:1; text-align:left;">
          <div style="font-weight:800; font-size:12px;">${f.name} (Lv.${f.level})</div>
          <div style="color:#e0a83a; font-weight:800; font-size:10px;">${stars}</div>
        </div>
        <button class="btn" style="font-size:11px; padding:4px 8px; background:var(--green); box-shadow:1.5px 1.5px 0 var(--ink);" onclick="actionCallFromBox(${index})">パーティへ</button>
      </div>
    `;
  }).join('') : '<div style="padding:15px 0; text-align:center; font-size:12px; opacity:0.6; font-weight:700;">ボックスは からっぽです</div>';

  el.innerHTML = `
    <div style="text-align:left;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:2px solid var(--ink); padding-bottom:6px;">
        <span class="display" style="font-size:14px; color:var(--plum);">ボックス (${box.length})</span>
        <button class="btn" style="font-size:11px; padding:4px 8px; box-shadow:1px 1px 0 var(--ink);" onclick="renderPartyRoster()">もどる</button>
      </div>
      <div style="max-height:260px; overflow-y:auto;">${rows}</div>
    </div>
  `;
}
window.renderBoxRoster = renderBoxRoster;

window.actionCallFromBox = function(index) {
  const fighter = box[index];
  if (!fighter) return;
  if (party.length >= MAX_PARTY) {
    showToast('パーティがいっぱいです！だれかをボックスへ预けてください');
    return;
  }
  moveToParty(fighter);
  renderBoxRoster();
};

window.actionSendToBox = function(fighterIdx) {
  const fighter = getAllFighters()[fighterIdx];
  if (!fighter || fighter.isTrainer) return;
  moveToBox(fighter);
  renderPartyRoster();
};

window.openEquipManager = function(fighterIdx) {
  const fighter = getAllFighters()[fighterIdx];
  const el = document.getElementById('party-roster');
  
  const parts = ['頭', '服', '足'];
  const slotsHtml = parts.map(part => {
    const item = fighter.equips?.[part];
    const itemInfo = item ? `<span style="color:var(--green);">${item.name}</span> (HP+${item.hpBonus} / ATK+${item.atkBonus})` : '<span style="opacity:0.6;">未そうび</span>';
    const actionBtn = item 
      ? `<button class="btn" style="font-size:10px; padding:4px 8px; background:var(--red); box-shadow:1px 1px 0 var(--ink);" onclick="actionUnequip(${fighterIdx}, '${part}')">はずす</button>`
      : `<button class="btn" style="font-size:10px; padding:4px 8px; background:var(--green); box-shadow:1px 1px 0 var(--ink);" onclick="showEquipOptions(${fighterIdx}, '${part}')">そうび</button>`;
      
    return `
      <div style="display:flex; align-items:center; justify-content:space-between; border-bottom:1px dashed var(--ink); padding:8px 0;">
        <span style="font-weight:800; font-size:12px;">${part}: ${itemInfo}</span>
        ${actionBtn}
      </div>
    `;
  }).join('');

  el.innerHTML = `
    <div style="text-align:left;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:2px solid var(--ink); padding-bottom:6px;">
        <span class="display" style="font-size:14px; color:var(--plum);">${fighter.name} のそうび</span>
        <button class="btn" style="font-size:11px; padding:4px 8px; box-shadow:1px 1px 0 var(--ink);" onclick="renderPartyRoster()">もどる</button>
      </div>
      <div>
        ${slotsHtml}
      </div>
    </div>
  `;
};

window.actionUnequip = function(fighterIdx, part) {
  const fighter = getAllFighters()[fighterIdx];
  unequipItem(fighter, part);
  openEquipManager(fighterIdx);
};

window.showEquipOptions = function(fighterIdx, part) {
  const fighter = getAllFighters()[fighterIdx];
  const el = document.getElementById('party-roster');
  
  // 未装備の装備アイテムのうち、該当部位のものを探す
  const options = playerEquipInventory.filter(item => item.part === part && !item.equippedTo);
  
  const optionsHtml = options.length > 0 
    ? options.map(item => `
        <div style="display:flex; align-items:center; justify-content:space-between; border-bottom:1px dashed var(--ink); padding:8px 0;">
          <div style="display:flex; flex-direction:column; text-align:left; gap:2px;">
            <span style="font-weight:800; font-size:12px; color:var(--green);">${item.name}</span>
            <span style="font-size:9px; font-weight:700; opacity:0.8;">HP+${item.hpBonus} / ATK+${item.atkBonus} (${'★'.repeat(item.rarity)}${'☆'.repeat(5 - item.rarity)})</span>
          </div>
          <button class="btn" style="font-size:10px; padding:4px 8px; background:var(--green); box-shadow:1px 1px 0 var(--ink);" onclick="actionEquip(${fighterIdx}, ${item.id})">そうび</button>
        </div>
      `).join('')
    : '<div style="padding:15px 0; text-align:center; font-size:12px; opacity:0.6; font-weight:700;">そうびできるアイテムがありません</div>';

  el.innerHTML = `
    <div style="text-align:left;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:2px solid var(--ink); padding-bottom:6px;">
        <span class="display" style="font-size:13px; color:var(--plum);">${part}にそうびする</span>
        <button class="btn" style="font-size:11px; padding:4px 8px; box-shadow:1px 1px 0 var(--ink);" onclick="openEquipManager(${fighterIdx})">もどる</button>
      </div>
      <div style="max-height:200px; overflow-y:auto;">
        ${optionsHtml}
      </div>
    </div>
  `;
};

window.actionEquip = function(fighterIdx, itemId) {
  const fighter = getAllFighters()[fighterIdx];
  const item = playerEquipInventory.find(eq => eq.id === itemId);
  if (item) {
    equipItem(fighter, item);
  }
  openEquipManager(fighterIdx);
};

document.getElementById('btn-open-party').addEventListener('click', () => {
  renderPartyRoster();
  partyModal.style.display = 'flex';
});

document.getElementById('btn-party-close').addEventListener('click', () => {
  partyModal.style.display = 'none';
});

/* ---------------------------------------------------------
   初期化
--------------------------------------------------------- */
updateCurrencyUI();
resizeIslandCanvas();
