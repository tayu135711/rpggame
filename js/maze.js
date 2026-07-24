/* =========================================================
   maze.js — 迷路生成・ステージセットアップ・障害物管理
   依存: THREE, config.js, models.js (makeRock, buildChest, ENEMY_TYPES)
   読み込み順: config.js → models.js → maze.js
========================================================= */

/* ---- 共有マテリアル ---- */
const wallMat = new THREE.MeshStandardMaterial({ color: 0x8a7863, flatShading: true, roughness: 1 });

/* ---------------------------------------------------------
   苔むした石だたみ風テクスチャ (プロシージャル生成・外部画像なし)
--------------------------------------------------------- */
function createStoneTexture(mossy) {
  const size = 256;
  const cvs  = document.createElement('canvas');
  cvs.width = size; cvs.height = size;
  const ctx = cvs.getContext('2d');

  // ベースの石色
  ctx.fillStyle = '#6b6459';
  ctx.fillRect(0, 0, size, size);

  // 石ブロックの目地(レンガ状にずらして配置)
  const blockSize = 32;
  ctx.strokeStyle = 'rgba(38,33,27,0.55)';
  ctx.lineWidth = 3;
  for (let y = 0; y < size; y += blockSize) {
    const offset = ((y / blockSize) % 2 === 0) ? 0 : blockSize / 2;
    for (let x = -blockSize; x < size + blockSize; x += blockSize) {
      ctx.strokeRect(x + offset, y, blockSize, blockSize);
    }
  }

  // 石のムラ(明暗のパッチで質感を出す)
  for (let i = 0; i < 150; i++) {
    const x = Math.random() * size, y = Math.random() * size;
    const r = 3 + Math.random() * 9;
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(28,24,20,0.18)' : 'rgba(160,150,130,0.14)';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  // 苔(緑の斑点)。下寄り・すきま寄りに多めに配置してリアルさを出す
  if (mossy) {
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * size;
      const y = size * 0.35 + Math.random() * size * 0.65;
      const r = 2 + Math.random() * 7;
      const g = 90 + Math.floor(Math.random() * 60);
      ctx.fillStyle = `rgba(35, ${g}, 40, ${0.25 + Math.random() * 0.35})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(cvs);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

const wallStoneTexture = createStoneTexture(true);
wallStoneTexture.repeat.set(1.4, 1);
wallMat.map = wallStoneTexture;
wallMat.needsUpdate = true;

const mazeFloorTexture = createStoneTexture(true);
mazeFloorTexture.repeat.set(MAZE_COLS * 0.9, MAZE_ROWS * 0.9);
const mazeFloorMat = new THREE.MeshStandardMaterial({ map: mazeFloorTexture, roughness: 1 });
let mazeFloorMesh = null;

/** 迷路の広さに合わせた苔石だたみの床を敷く (ステージ開始時に呼ぶ) */
function setupMazeFloor() {
  const geo = new THREE.PlaneGeometry(MAZE_COLS * CELL + 2, MAZE_ROWS * CELL + 2);
  mazeFloorMesh = new THREE.Mesh(geo, mazeFloorMat);
  mazeFloorMesh.rotation.x = -Math.PI / 2;
  mazeFloorMesh.position.y = 0.01; // 地面との重なり(Zファイティング)を防ぐ
  mazeFloorMesh.receiveShadow = true;
  scene.add(mazeFloorMesh);
  stageDecorations.push(mazeFloorMesh);
}

/* ---- シーン上のオブジェクトリスト (scene は main.js で定義) ---- */
const obstacles       = []; // 丸型障害物(当たり判定付き装飾岩など)
let   mazeWallMeshes  = [];
let   mazeWallColliders = [];
let   stageDecorations = [];
let   torches          = [];
let   chests          = [];
let   healSpots       = []; // { mesh, active } — active=trueの間は発動済み(再度離れるとfalseに戻る)
let   bossGate        = null;
let   currentMapMode  = 'stage'; // stage / bossArena
const enemies         = []; // { mesh, type, hp, maxHp, alive, isBoss, wanderTarget, wanderTimer }

/* ---------------------------------------------------------
   松明 (迷路の暗がりを照らす明かり)
--------------------------------------------------------- */
/** 松明1本分のモデル+点光源をまとめて生成する */
function buildTorch() {
  const g = new THREE.Group();

  const poleMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, flatShading: true });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.1, 6), poleMat);
  pole.position.y = 0.55;
  g.add(pole);

  const bowlMat = new THREE.MeshStandardMaterial({ color: 0x2a2420, flatShading: true });
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.08, 0.14, 8), bowlMat);
  bowl.position.y = 1.12;
  g.add(bowl);

  // 炎 (内側は明るい黄・外側はオレンジの2層 — ブルーム(発光)がかかる明るさにしてある)
  const flameOuter = new THREE.Mesh(
    new THREE.ConeGeometry(0.13, 0.34, 8),
    new THREE.MeshBasicMaterial({ color: 0xff8a30 })
  );
  flameOuter.position.y = 1.34;
  g.add(flameOuter);

  const flameInner = new THREE.Mesh(
    new THREE.ConeGeometry(0.07, 0.22, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe45e })
  );
  flameInner.position.y = 1.32;
  g.add(flameInner);

  const light = new THREE.PointLight(0xffaa55, 1.1, 6.5, 2);
  light.position.y = 1.3;
  g.add(light);

  g.userData.flameOuter = flameOuter;
  g.userData.flameInner = flameInner;
  g.userData.light      = light;
  g.userData.phase      = Math.random() * Math.PI * 2;

  return g;
}

/** 松明をワールド座標(x, z)に設置する */
function spawnTorch(x, z) {
  const t = buildTorch();
  t.position.set(x, 0, z);
  scene.add(t);
  torches.push(t);
}

/** 松明の炎のゆらぎアニメーション(毎フレーム呼び出す) */
function updateTorches() {
  if (torches.length === 0) return;
  const t0 = performance.now() / 1000;
  for (const torch of torches) {
    const phase = torch.userData.phase;
    const flick = Math.sin(t0 * 9 + phase) * 0.5 + Math.sin(t0 * 17 + phase) * 0.3;
    const s = 1 + flick * 0.12;
    torch.userData.flameOuter.scale.set(s, 1 + flick * 0.18, s);
    torch.userData.flameInner.scale.set(s, 1 + flick * 0.18, s);
    torch.userData.light.intensity = 1.0 + flick * 0.35;
  }
}

/* ---------------------------------------------------------
   座標変換ヘルパー
--------------------------------------------------------- */
function cellToWorldX(c) { return (c - (MAZE_COLS - 1) / 2) * CELL; }
function cellToWorldZ(r) { return (r - (MAZE_ROWS - 1) / 2) * CELL; }
/** ワールド座標→迷路のマス目(行・列)に変換する (ミニマップ探索判定用) */
function worldToCell(x, z) {
  return {
    c: Math.round(x / CELL + (MAZE_COLS - 1) / 2),
    r: Math.round(z / CELL + (MAZE_ROWS - 1) / 2),
  };
}

/* ---------------------------------------------------------
   ミニマップ (じわじわ開放方式)
   歩いて訪れたマスだけを地図上に表示する。ワイヤーフレームの
   迷路と違い、実際に足を運んでいない場所は真っ暗なまま。
--------------------------------------------------------- */
const minimapWrapEl       = document.getElementById('minimap-wrap');
const minimapFloorLabelEl = document.getElementById('minimap-floor-label');
const minimapCanvas       = document.getElementById('minimap-canvas');
const minimapCtx          = minimapCanvas ? minimapCanvas.getContext('2d') : null;
const minimapZoomOverlay  = document.getElementById('minimap-zoom-overlay');
const minimapZoomCanvas   = document.getElementById('minimap-zoom-canvas');
const minimapZoomCtx      = minimapZoomCanvas ? minimapZoomCanvas.getContext('2d') : null;

let currentMazeGrid = null;   // setupStage時点の grid (壁情報)
let exploredCells   = [];     // [r][c] = true/false (訪れたことがあるか)
let minimapZoomOpen  = false;
/** 現在挑戦中のステージ番号 (2026/07/24 追加: ボス撃破時の次ステージ解放を汎用化するため) */
let currentStageNo   = null;

document.getElementById('btn-minimap-zoom').addEventListener('click', () => {
  minimapZoomOpen = true;
  minimapZoomOverlay.style.display = 'flex';
  renderMinimap();
});
document.getElementById('btn-minimap-zoom-close').addEventListener('click', () => {
  minimapZoomOpen = false;
  minimapZoomOverlay.style.display = 'none';
});

/** ステージ開始時に呼び出す。探索状況をリセットしてミニマップを表示する */
function resetExploration(grid, stageLabel) {
  currentMazeGrid = grid;
  exploredCells = [];
  for (let r = 0; r < MAZE_ROWS; r++) exploredCells.push(new Array(MAZE_COLS).fill(false));
  exploredCells[0][0] = true; // スタート地点はあらかじめ見えている
  if (minimapFloorLabelEl) minimapFloorLabelEl.textContent = stageLabel;
  if (minimapWrapEl) minimapWrapEl.style.display = 'flex';
  renderMinimap();
}

/** プレイヤーの現在位置に応じて探索マスを更新する(毎フレーム呼び出す) */
function updateExploration() {
  if (!currentMazeGrid) return;
  const { r, c } = worldToCell(player.position.x, player.position.z);
  if (r < 0 || r >= MAZE_ROWS || c < 0 || c >= MAZE_COLS) return;
  if (!exploredCells[r][c]) {
    exploredCells[r][c] = true;
    renderMinimap();
  }
}

/** 1つのcanvasにミニマップを描画する共通処理 */
function drawMinimapOn(ctx, size) {
  if (!ctx || !currentMazeGrid) return;
  const cell = size / MAZE_COLS;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#0c0a10';
  ctx.fillRect(0, 0, size, size);

  for (let r = 0; r < MAZE_ROWS; r++) {
    for (let c = 0; c < MAZE_COLS; c++) {
      if (!exploredCells[r][c]) continue;
      const x = c * cell, y = r * cell;

      ctx.fillStyle = '#5a4c3e';
      ctx.fillRect(x, y, cell, cell);

      const wcell = currentMazeGrid[r][c];
      ctx.strokeStyle = '#f0e6cc';
      ctx.lineWidth = Math.max(1, cell * 0.1);
      ctx.beginPath();
      if (wcell.walls.N) { ctx.moveTo(x, y);        ctx.lineTo(x + cell, y); }
      if (wcell.walls.S) { ctx.moveTo(x, y + cell);  ctx.lineTo(x + cell, y + cell); }
      if (wcell.walls.E) { ctx.moveTo(x + cell, y);  ctx.lineTo(x + cell, y + cell); }
      if (wcell.walls.W) { ctx.moveTo(x, y);         ctx.lineTo(x, y + cell); }
      ctx.stroke();
    }
  }

  // 宝箱アイコン (見つけたマスのみ)
  chests.forEach(ch => {
    if (ch.opened) return;
    const { r, c } = worldToCell(ch.mesh.position.x, ch.mesh.position.z);
    if (r < 0 || r >= MAZE_ROWS || c < 0 || c >= MAZE_COLS || !exploredCells[r][c]) return;
    const x = c * cell + cell / 2, y = r * cell + cell / 2;
    ctx.fillStyle = '#ffd24a';
    ctx.strokeStyle = '#2b1810';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, cell * 0.16, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  });

  // 回復地点アイコン (見つけたマスのみ)
  healSpots.forEach(spot => {
    const { r, c } = worldToCell(spot.mesh.position.x, spot.mesh.position.z);
    if (r < 0 || r >= MAZE_ROWS || c < 0 || c >= MAZE_COLS || !exploredCells[r][c]) return;
    const x = c * cell + cell / 2, y = r * cell + cell / 2;
    ctx.fillStyle = '#6fe0d0';
    ctx.strokeStyle = '#0e5a50';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y - cell * 0.18);
    ctx.lineTo(x + cell * 0.14, y);
    ctx.lineTo(x, y + cell * 0.18);
    ctx.lineTo(x - cell * 0.14, y);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  });

  // ボスアイコン (見つけたマスのみ)
  enemies.forEach(e => {
    if (!e.isBoss || !e.alive) return;
    const { r, c } = worldToCell(e.mesh.position.x, e.mesh.position.z);
    if (r < 0 || r >= MAZE_ROWS || c < 0 || c >= MAZE_COLS || !exploredCells[r][c]) return;
    const x = c * cell + cell / 2, y = r * cell + cell / 2;
    ctx.fillStyle = '#ff4444';
    ctx.beginPath();
    ctx.moveTo(x, y - cell * 0.22);
    ctx.lineTo(x + cell * 0.2, y + cell * 0.16);
    ctx.lineTo(x - cell * 0.2, y + cell * 0.16);
    ctx.closePath();
    ctx.fill();
  });

  // プレイヤー(現在地は常に表示)
  const { r: pr, c: pc } = worldToCell(player.position.x, player.position.z);
  const px = pc * cell + cell / 2, py = pr * cell + cell / 2;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(playerAngle);
  ctx.fillStyle = '#4a90d9';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -cell * 0.28);
  ctx.lineTo(cell * 0.18, cell * 0.2);
  ctx.lineTo(-cell * 0.18, cell * 0.2);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

/** ミニマップ(小)と、開いていれば拡大表示も更新する */
function renderMinimap() {
  if (minimapCanvas) drawMinimapOn(minimapCtx, minimapCanvas.width);
  if (minimapZoomOpen && minimapZoomCanvas) drawMinimapOn(minimapZoomCtx, minimapZoomCanvas.width);
}

/* ---------------------------------------------------------
   迷路生成 (再帰バックトラッカー)
--------------------------------------------------------- */
function generateMaze(cols, rows) {
  const grid = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      row.push({ visited: false, walls: { N: true, S: true, E: true, W: true } });
    }
    grid.push(row);
  }

  const dirs = [
    { name: 'N', dr: -1, dc:  0, opp: 'S' },
    { name: 'S', dr:  1, dc:  0, opp: 'N' },
    { name: 'E', dr:  0, dc:  1, opp: 'W' },
    { name: 'W', dr:  0, dc: -1, opp: 'E' },
  ];

  const stack = [{ r: 0, c: 0 }];
  grid[0][0].visited = true;

  while (stack.length) {
    const cur       = stack[stack.length - 1];
    const neighbors = [];
    for (const d of dirs) {
      const nr = cur.r + d.dr, nc = cur.c + d.dc;
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !grid[nr][nc].visited) {
        neighbors.push({ r: nr, c: nc, dir: d });
      }
    }
    if (neighbors.length) {
      const next = neighbors[Math.floor(Math.random() * neighbors.length)];
      grid[cur.r][cur.c].walls[next.dir.name]  = false;
      grid[next.r][next.c].walls[next.dir.opp] = false;
      grid[next.r][next.c].visited             = true;
      stack.push({ r: next.r, c: next.c });
    } else {
      stack.pop();
    }
  }
  return grid;
}

/** BFSでスタートから最も遠いセルを探す (ボス配置用) */
function findFarthestCell(grid, cols, rows) {
  const dist = grid.map(row => row.map(() => -1));
  const queue = [{ r: 0, c: 0 }];
  dist[0][0] = 0;
  let farthest = { r: 0, c: 0, d: 0 };

  while (queue.length) {
    const cur  = queue.shift();
    const d    = dist[cur.r][cur.c];
    if (d > farthest.d) farthest = { r: cur.r, c: cur.c, d };
    const cell  = grid[cur.r][cur.c];
    const moves = [];
    if (!cell.walls.N) moves.push({ r: cur.r - 1, c: cur.c });
    if (!cell.walls.S) moves.push({ r: cur.r + 1, c: cur.c });
    if (!cell.walls.E) moves.push({ r: cur.r,     c: cur.c + 1 });
    if (!cell.walls.W) moves.push({ r: cur.r,     c: cur.c - 1 });
    for (const m of moves) {
      if (dist[m.r][m.c] === -1) {
        dist[m.r][m.c] = d + 1;
        queue.push(m);
      }
    }
  }
  return farthest;
}

/* ---------------------------------------------------------
   壁セグメントの生成・当たり判定
--------------------------------------------------------- */
function addWallSegment(cx, cz, width, depth) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, WALL_HEIGHT, depth), wallMat);
  mesh.position.set(cx, WALL_HEIGHT / 2, cz);
  mesh.castShadow    = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  mazeWallMeshes.push(mesh);
  mazeWallColliders.push({
    minX: cx - width / 2, maxX: cx + width / 2,
    minZ: cz - depth / 2, maxZ: cz + depth / 2,
  });
}

/** 指定座標(x,z)が壁コライダーと衝突しているか判定 */
function collidesWithWalls(x, z, radius) {
  for (const w of mazeWallColliders) {
    const cx = Math.max(w.minX, Math.min(x, w.maxX));
    const cz = Math.max(w.minZ, Math.min(z, w.maxZ));
    const dx = x - cx, dz = z - cz;
    if (dx * dx + dz * dz < radius * radius) return true;
  }
  return false;
}

/* ---------------------------------------------------------
   宝箱
--------------------------------------------------------- */
function spawnChest(x, z, isGolden = false) {
  const mesh   = buildChest();
  if (isGolden) {
    mesh.traverse(child => {
      if (!child.material?.color) return;
      child.material.color.setHex(child.material.color.getHex() === 0xd9a13c ? 0xffd447 : 0xb87818);
      child.material.emissive?.setHex(0x4a2600);
      if (child.material.emissiveIntensity !== undefined) child.material.emissiveIntensity = 0.35;
    });
  }
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  // 大型化した宝笱に合わせてマーカー位置を上方に調整
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe45e })
  );
  marker.position.y = 1.8;
  mesh.add(marker);
  // 宝笱自体に少し左右えている感じを出す
  mesh.rotation.y = (Math.random() - 0.5) * 0.4;
  chests.push({ mesh, opened: false, isGolden });
}

function openChest(chest) {
  if (chest.opened) return;
  chest.opened = true;
  scene.remove(chest.mesh);
  const gotCoins = chest.isGolden ? 80 + Math.floor(Math.random() * 61) : 10 + Math.floor(Math.random() * 21);
  coins += gotCoins;
  let msg = `たからばこを あけた！ コイン+${gotCoins}`;
  if (Math.random() < 0.3) {
    const gotDia = 2 + Math.floor(Math.random() * 4);
    diamonds += gotDia;
    msg += ` ダイヤ+${gotDia}`;
  }
  // 一定確率で装備もドロップする(2026/07/24 追加)
  if (chest.isGolden || Math.random() < CHEST_EQUIP_DROP_CHANCE) {
    const newEquip = createEquipItem(rollRarity());
    playerEquipInventory.push(newEquip);
    msg += ` 「${newEquip.name}」も みつけた！`;
  }
  updateCurrencyUI();
  showToast(msg); // showToastはtextContent表示のため装備名もプレーンテキストで追記する
}

function buildBossGate() {
  const gate = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: 0x4a3028, flatShading: true });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd49b38, emissive: 0x3a2100, emissiveIntensity: 0.25, flatShading: true });
  [-1.25, 1.25].forEach(x => {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.7, 3.3, 0.7), stone);
    pillar.position.set(x, 1.65, 0);
    pillar.castShadow = true;
    gate.add(pillar);
  });
  const top = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.65, 0.75), stone);
  top.position.y = 3.15;
  top.castShadow = true;
  gate.add(top);
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.5, 0.18), gold);
  door.position.set(0, 1.25, 0.12);
  door.castShadow = true;
  gate.add(door);
  const sign = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffe45e }));
  sign.position.set(0, 3.55, 0);
  gate.add(sign);
  return gate;
}

function spawnBossGate(x, z) {
  const mesh = buildBossGate();
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  stageDecorations.push(mesh);
  bossGate = { mesh, x, z, triggered: false };
}

function setupBossArena() {
  currentMapMode = 'bossArena';
  clearStageObjects();
  setupMazeFloor();
  setDungeonAtmosphere();
  wallMat.color.setHex(0x241a24);
  if (minimapWrapEl) minimapWrapEl.style.display = 'none';

  const arenaHalf = 14;
  addWallSegment(0, -arenaHalf, arenaHalf * 2, WALL_THICKNESS);
  addWallSegment(0, arenaHalf, arenaHalf * 2, WALL_THICKNESS);
  addWallSegment(-arenaHalf, 0, WALL_THICKNESS, arenaHalf * 2);
  addWallSegment(arenaHalf, 0, WALL_THICKNESS, arenaHalf * 2);

  player.position.set(0, 0, 8);
  player.rotation.y = Math.PI;
  fieldPartyModels.forEach((m, i) => m.position.set(0, 0, 8 + 1.3 * (i + 1)));
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    spawnTorch(Math.cos(angle) * 10, Math.sin(angle) * 10);
  }
  spawnBoss(0, -6, currentStageNo === 2 ? 4 : 1);
}

/* ---------------------------------------------------------
   回復地点 (いやしのいずみ)
--------------------------------------------------------- */
function spawnHealSpot(x, z) {
  const mesh = buildHealSpring();
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  healSpots.push({ mesh, active: false });
}

/** 回復地点のふわふわアニメーション(毎フレーム呼び出す) */
function updateHealSpots() {
  if (healSpots.length === 0) return;
  const t0 = performance.now() / 1000;
  for (const spot of healSpots) {
    const g = spot.mesh;
    const phase = g.userData.phase;
    if (g.userData.crystal) g.userData.crystal.rotation.y = t0 * 0.8 + phase;
    if (g.userData.light)   g.userData.light.intensity = 0.85 + Math.sin(t0 * 2 + phase) * 0.25;
    (g.userData.motes || []).forEach((mote, i) => {
      const a = t0 * 0.6 + phase + (i / 5) * Math.PI * 2;
      mote.position.x = Math.cos(a) * 0.55;
      mote.position.z = Math.sin(a) * 0.55;
      mote.position.y = 0.35 + Math.sin(t0 * 2 + i) * 0.12;
    });
  }
}

/** プレイヤーが回復地点に近づいたときの判定・発動(毎フレーム呼び出す) */
function updateHealSpotTrigger() {
  for (const spot of healSpots) {
    const dist = Math.hypot(
      player.position.x - spot.mesh.position.x,
      player.position.z - spot.mesh.position.z
    );
    if (dist < HEAL_SPOT_TRIGGER_DIST && !spot.active) {
      spot.active = true;
      const healed = healPartyFully();
      if (healed) showToast('いやしのいずみで やすんだ！なかまが ぜんかいふくした！');
    } else if (dist > HEAL_SPOT_RESET_DIST && spot.active) {
      spot.active = false;
    }
  }
}

/* ---------------------------------------------------------
   敵スポーン
--------------------------------------------------------- */
function buildEnemyAlertMarker(isBoss = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = 'bold 112px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('!', 64, 65);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  const marker = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    color: isBoss ? 0xff5050 : 0xff2020,
    transparent: true,
    depthTest: false,
  }));
  marker.scale.set(isBoss ? 1.25 : 0.9, isBoss ? 1.25 : 0.9, 1);
  marker.position.y = isBoss ? 2.8 : 2.15;
  marker.visible = false;
  return marker;
}

function spawnEnemy(x, z) {
  const type  = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)];
  const mesh  = type.build();
  mesh.scale.set(1.3, 1.3, 1.3);
  mesh.position.set(x, 0, z);
  scene.add(mesh);

  const marker = buildEnemyAlertMarker();
  marker.position.y = 2.1;
  mesh.add(marker);

  enemies.push({
    mesh, type,
    hp: type.baseHp, maxHp: type.baseHp,
    alive: true,
    wanderTarget: new THREE.Vector3(x, 0, z),
    wanderTimer: 0,
  });
}

function spawnEnemy(x, z, allowedIndices = [0, 1, 2, 3, 4]) {
  const randIdx = allowedIndices[Math.floor(Math.random() * allowedIndices.length)];
  const type  = ENEMY_TYPES[randIdx];
  const mesh  = type.build();
  mesh.scale.set(1.3, 1.3, 1.3);
  mesh.position.set(x, 0, z);
  scene.add(mesh);

  // 追跡マーカー: 通常は黄色、追跡中は赤に変わる
  const marker = buildEnemyAlertMarker();
  mesh.add(marker);
  mesh.userData.chaseMarker = marker; // main.jsから参照できるよう保存

  enemies.push({
    mesh, type,
    hp: type.baseHp, maxHp: type.baseHp,
    alive: true,
    wasChasing: false,
    visionRange: 8.5,
    visionAngle: Math.cos(Math.PI * 0.34),
    wanderTarget: new THREE.Vector3(x, 0, z),
    wanderTimer: 0,
  });
}

function spawnBoss(x, z, enemyTypeIdx = 1) {
  const baseType = ENEMY_TYPES[enemyTypeIdx];
  const bossType = Object.assign({}, baseType, {
    baseHp:      baseType.baseHp * 3,
    atk:         Math.round(baseType.atk * 1.8),
    battleScale: 1.4,
  });
  const mesh = baseType.build();
  mesh.scale.set(1.6, 1.6, 1.6);
  mesh.position.set(x, 0, z);
  scene.add(mesh);

  const marker = buildEnemyAlertMarker(true);
  mesh.add(marker);

  enemies.push({
    mesh, type: bossType,
    hp: bossType.baseHp, maxHp: bossType.baseHp,
    alive: true, isBoss: true, isGuardBoss: true,
    wasChasing: false,
    visionRange: 10.5,
    visionAngle: Math.cos(Math.PI * 0.42),
    wanderTarget: new THREE.Vector3(x, 0, z),
    wanderTimer: 0,
  });
}

/* ---------------------------------------------------------
   ステージオブジェクトの一括削除
--------------------------------------------------------- */
function clearStageObjects() {
  mazeWallMeshes.forEach(m => scene.remove(m));
  mazeWallMeshes   = [];
  mazeWallColliders = [];
  enemies.forEach(e => { if (e.mesh) scene.remove(e.mesh); });
  enemies.length = 0;
  stageDecorations.forEach(d => scene.remove(d));
  stageDecorations = [];
  torches.forEach(t => scene.remove(t));
  torches = [];
  chests.forEach(c => { if (c.mesh) scene.remove(c.mesh); });
  chests = [];
  healSpots.forEach(s => { if (s.mesh) scene.remove(s.mesh); });
  healSpots = [];
  bossGate = null;
}

/** 迷路突入時、屋外の明るいフォグ/ライティングから暗い洞窟風の雰囲気に切り替える */
function setDungeonAtmosphere() {
  scene.fog.color.setHex(0x140f18);
  scene.fog.near = 6;
  scene.fog.far  = 26;
  scene.background.setHex(0x140f18);
  hemi.intensity = 0.35;
  sun.intensity  = 0.15;
}

/* ---------------------------------------------------------
   ステージ1: ケーキのしま
--------------------------------------------------------- */
function setupStage1() {
  currentStageNo = 1;
  currentMapMode = 'stage';
  clearStageObjects();
  setupMazeFloor();
  setDungeonAtmosphere();
  
  // 壁のテクスチャ色をケーキ島用に戻す
  wallMat.color.setHex(0x8a7863);
  
  const grid     = generateMaze(MAZE_COLS, MAZE_ROWS);
  const bossCell = findFarthestCell(grid, MAZE_COLS, MAZE_ROWS);
  resetExploration(grid, 'ステージ1');

  // 壁を配置
  for (let r = 0; r < MAZE_ROWS; r++) {
    for (let c = 0; c < MAZE_COLS; c++) {
      const cell = grid[r][c];
      const cx   = cellToWorldX(c);
      const cz   = cellToWorldZ(r);
      if (cell.walls.N) addWallSegment(cx, cz - CELL / 2, CELL, WALL_THICKNESS);
      if (cell.walls.S) addWallSegment(cx, cz + CELL / 2, CELL, WALL_THICKNESS);
      if (cell.walls.E) addWallSegment(cx + CELL / 2, cz, WALL_THICKNESS, CELL);
      if (cell.walls.W) addWallSegment(cx - CELL / 2, cz, WALL_THICKNESS, CELL);
    }
  }

  // プレイヤーをスタート位置へ
  const startX = cellToWorldX(0), startZ = cellToWorldZ(0);
  player.position.set(startX, 0, startZ);
  player.rotation.y = 0;
  fieldPartyModels.forEach((m, i) => {
    m.position.set(startX, 0, startZ - 1.3 * (i + 1));
  });

  // 雑魚敵 10体 (ケーキ島: チョコおばけ, ドーナツリング, いちごタルト姫, もりのぬし)
  const usedCells = new Set([`0,0`, `${bossCell.r},${bossCell.c}`]);
  let spawned = 0, guard = 0;
  while (spawned < 10 && guard < 500) {
    guard++;
    const r = Math.floor(Math.random() * MAZE_ROWS);
    const c = Math.floor(Math.random() * MAZE_COLS);
    const key = `${r},${c}`;
    if (usedCells.has(key)) continue;
    usedCells.add(key);
    spawnEnemy(cellToWorldX(c), cellToWorldZ(r), [0, 2, 3, 5]);
    spawned++;
  }

  // ボス (ホールケーキ王)
  spawnBossGate(cellToWorldX(bossCell.c), cellToWorldZ(bossCell.r));

  // 宝箱3個
  const chestUsed = new Set([`0,0`, `${bossCell.r},${bossCell.c}`]);
  let chestSpawned = 0, chestGuard = 0;
  while (chestSpawned < 3 && chestGuard < 500) {
    chestGuard++;
    const r = Math.floor(Math.random() * MAZE_ROWS);
    const c = Math.floor(Math.random() * MAZE_COLS);
    const key = `${r},${c}`;
    if (chestUsed.has(key)) continue;
    chestUsed.add(key);
    spawnChest(cellToWorldX(c), cellToWorldZ(r));
    chestSpawned++;
  }

  // 回復地点(いやしのいずみ)を1箇所配置(2026/07/24 追加)
  {
    let healGuard = 0;
    while (healGuard < 500) {
      healGuard++;
      const r = Math.floor(Math.random() * MAZE_ROWS);
      const c = Math.floor(Math.random() * MAZE_COLS);
      const key = `${r},${c}`;
      if (chestUsed.has(key)) continue;
      chestUsed.add(key);
      spawnHealSpot(cellToWorldX(c), cellToWorldZ(r));
      break;
    }
  }

  // 装飾岩 (当たり判定なし)
  for (let i = 0; i < 10; i++) {
    const r    = Math.floor(Math.random() * MAZE_ROWS);
    const c    = Math.floor(Math.random() * MAZE_COLS);
    const rock = makeRock(
      cellToWorldX(c) + (Math.random() - 0.5) * 1.5,
      cellToWorldZ(r) + (Math.random() - 0.5) * 1.5
    );
    rock.scale.setScalar(0.6);
    scene.add(rock);
    stageDecorations.push(rock);
  }

  // 松明 (通路を照らす明かり)
  for (let i = 0; i < 9; i++) {
    const r = Math.floor(Math.random() * MAZE_ROWS);
    const c = Math.floor(Math.random() * MAZE_COLS);
    spawnTorch(
      cellToWorldX(c) + (Math.random() - 0.5) * 1.6,
      cellToWorldZ(r) + (Math.random() - 0.5) * 1.6
    );
  }
}

/* ---------------------------------------------------------
   ステージ2: わがしのしま
--------------------------------------------------------- */
function setupStage2() {
  currentStageNo = 2;
  currentMapMode = 'stage';
  clearStageObjects();
  setupMazeFloor();
  setDungeonAtmosphere();
  
  // 壁のテクスチャ色をあんこ色に変更
  wallMat.color.setHex(0x3a2010);
  
  const grid     = generateMaze(MAZE_COLS, MAZE_ROWS);
  const bossCell = findFarthestCell(grid, MAZE_COLS, MAZE_ROWS);
  resetExploration(grid, 'ステージ2');

  // 壁を配置
  for (let r = 0; r < MAZE_ROWS; r++) {
    for (let c = 0; c < MAZE_COLS; c++) {
      const cell = grid[r][c];
      const cx   = cellToWorldX(c);
      const cz   = cellToWorldZ(r);
      if (cell.walls.N) addWallSegment(cx, cz - CELL / 2, CELL, WALL_THICKNESS);
      if (cell.walls.S) addWallSegment(cx, cz + CELL / 2, CELL, WALL_THICKNESS);
      if (cell.walls.E) addWallSegment(cx + CELL / 2, cz, WALL_THICKNESS, CELL);
      if (cell.walls.W) addWallSegment(cx - CELL / 2, cz, WALL_THICKNESS, CELL);
    }
  }

  // プレイヤーをスタート位置へ
  const startX = cellToWorldX(0), startZ = cellToWorldZ(0);
  player.position.set(startX, 0, startZ);
  player.rotation.y = 0;
  fieldPartyModels.forEach((m, i) => {
    m.position.set(startX, 0, startZ - 1.3 * (i + 1));
  });

  // 雑魚敵 10体 (和菓子島: チョコおばけ[閒], 抹茶ロール[自然])
  const usedCells = new Set([`0,0`, `${bossCell.r},${bossCell.c}`]);
  let spawned = 0, guard = 0;
  while (spawned < 10 && guard < 500) {
    guard++;
    const r = Math.floor(Math.random() * MAZE_ROWS);
    const c = Math.floor(Math.random() * MAZE_COLS);
    const key = `${r},${c}`;
    if (usedCells.has(key)) continue;
    usedCells.add(key);
    spawnEnemy(cellToWorldX(c), cellToWorldZ(r), [0, 4, 5]);
    spawned++;
  }

  // ボス (抹茶ロール)
  spawnBossGate(cellToWorldX(bossCell.c), cellToWorldZ(bossCell.r));

  // 宝箱3個
  const chestUsed = new Set([`0,0`, `${bossCell.r},${bossCell.c}`]);
  let chestSpawned = 0, chestGuard = 0;
  while (chestSpawned < 3 && chestGuard < 500) {
    chestGuard++;
    const r = Math.floor(Math.random() * MAZE_ROWS);
    const c = Math.floor(Math.random() * MAZE_COLS);
    const key = `${r},${c}`;
    if (chestUsed.has(key)) continue;
    chestUsed.add(key);
    spawnChest(cellToWorldX(c), cellToWorldZ(r));
    chestSpawned++;
  }

  // 回復地点(いやしのいずみ)を1箇所配置(2026/07/24 追加)
  {
    let healGuard = 0;
    while (healGuard < 500) {
      healGuard++;
      const r = Math.floor(Math.random() * MAZE_ROWS);
      const c = Math.floor(Math.random() * MAZE_COLS);
      const key = `${r},${c}`;
      if (chestUsed.has(key)) continue;
      chestUsed.add(key);
      spawnHealSpot(cellToWorldX(c), cellToWorldZ(r));
      break;
    }
  }

  // 装飾岩
  for (let i = 0; i < 10; i++) {
    const r    = Math.floor(Math.random() * MAZE_ROWS);
    const c    = Math.floor(Math.random() * MAZE_COLS);
    const rock = makeRock(
      cellToWorldX(c) + (Math.random() - 0.5) * 1.5,
      cellToWorldZ(r) + (Math.random() - 0.5) * 1.5
    );
    rock.scale.setScalar(0.6);
    scene.add(rock);
    stageDecorations.push(rock);
  }

  // 松明 (通路を照らす明かり)
  for (let i = 0; i < 9; i++) {
    const r = Math.floor(Math.random() * MAZE_ROWS);
    const c = Math.floor(Math.random() * MAZE_COLS);
    spawnTorch(
      cellToWorldX(c) + (Math.random() - 0.5) * 1.6,
      cellToWorldZ(r) + (Math.random() - 0.5) * 1.6
    );
  }
}

/**
 * プレイヤーと敵の直線上に壁が存在しないか判定する (視界判定)
 * @param {number} x1 - 始点X (敵)
 * @param {number} z1 - 始点Z (敵)
 * @param {number} x2 - 終点X (プレイヤー)
 * @param {number} z2 - 終点Z (プレイヤー)
 * @returns {boolean} 壁に遮られていなければ true
 */
function isLineOfSightClear(x1, z1, x2, z2) {
  for (const w of mazeWallColliders) {
    if (lineIntersectsAABB(x1, z1, x2, z2, w.minX, w.maxX, w.minZ, w.maxZ)) {
      return false; // 壁に衝突＝視界が遮られている
    }
  }
  return true;
}

/** 簡易的な線分と矩形(AABB)の交差判定 */
function lineIntersectsAABB(x1, z1, x2, z2, minX, maxX, minZ, maxZ) {
  let tMin = 0.0;
  let tMax = 1.0;
  
  const dx = x2 - x1;
  const dz = z2 - z1;
  
  // X軸のクリッピング
  if (Math.abs(dx) < 0.000001) {
    if (x1 < minX || x1 > maxX) return false;
  } else {
    const invDX = 1.0 / dx;
    let t1 = (minX - x1) * invDX;
    let t2 = (maxX - x1) * invDX;
    if (t1 > t2) { const temp = t1; t1 = t2; t2 = temp; }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  
  // Z軸のクリッピング
  if (Math.abs(dz) < 0.000001) {
    if (z1 < minZ || z1 > maxZ) return false;
  } else {
    const invDZ = 1.0 / dz;
    let t1 = (minZ - z1) * invDZ;
    let t2 = (maxZ - z1) * invDZ;
    if (t1 > t2) { const temp = t1; t1 = t2; t2 = temp; }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  
  return true;
}
