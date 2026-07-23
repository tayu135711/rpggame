/* =========================================================
   maze.js — 迷路生成・ステージセットアップ・障害物管理
   依存: THREE, config.js, models.js (makeRock, buildChest, ENEMY_TYPES)
   読み込み順: config.js → models.js → maze.js
========================================================= */

/* ---- 共有マテリアル ---- */
const wallMat = new THREE.MeshStandardMaterial({ color: 0x8a7863, flatShading: true, roughness: 1 });

/* ---- シーン上のオブジェクトリスト (scene は main.js で定義) ---- */
const obstacles       = []; // 丸型障害物(当たり判定付き装飾岩など)
let   mazeWallMeshes  = [];
let   mazeWallColliders = [];
let   stageDecorations = [];
let   chests          = [];
const enemies         = []; // { mesh, type, hp, maxHp, alive, isBoss, wanderTarget, wanderTimer }

/* ---------------------------------------------------------
   座標変換ヘルパー
--------------------------------------------------------- */
function cellToWorldX(c) { return (c - (MAZE_COLS - 1) / 2) * CELL; }
function cellToWorldZ(r) { return (r - (MAZE_ROWS - 1) / 2) * CELL; }

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
function spawnChest(x, z) {
  const mesh   = buildChest();
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe45e })
  );
  marker.position.y = 1.0;
  mesh.add(marker);
  chests.push({ mesh, opened: false });
}

function openChest(chest) {
  if (chest.opened) return;
  chest.opened = true;
  scene.remove(chest.mesh);
  const gotCoins = 10 + Math.floor(Math.random() * 21);
  coins += gotCoins;
  let msg = `たからばこを あけた！ コイン+${gotCoins}`;
  if (Math.random() < 0.3) {
    const gotDia = 2 + Math.floor(Math.random() * 4);
    diamonds += gotDia;
    msg += ` ダイヤ+${gotDia}`;
  }
  updateCurrencyUI();
  showToast(msg);
}

/* ---------------------------------------------------------
   敵スポーン
--------------------------------------------------------- */
function spawnEnemy(x, z) {
  const type  = ENEMY_TYPES[Math.floor(Math.random() * ENEMY_TYPES.length)];
  const mesh  = type.build();
  mesh.scale.set(1.3, 1.3, 1.3);
  mesh.position.set(x, 0, z);
  scene.add(mesh);

  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe45e })
  );
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

  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xffe45e })
  );
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

  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xff5050 })
  );
  marker.position.y = 2.7;
  mesh.add(marker);

  enemies.push({
    mesh, type: bossType,
    hp: bossType.baseHp, maxHp: bossType.baseHp,
    alive: true, isBoss: true,
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
  chests.forEach(c => { if (c.mesh) scene.remove(c.mesh); });
  chests = [];
}

/* ---------------------------------------------------------
   ステージ1: ケーキのしま
--------------------------------------------------------- */
function setupStage1() {
  clearStageObjects();
  
  // 壁のテクスチャ色をケーキ島用に戻す
  wallMat.color.setHex(0x8a7863);
  
  const grid     = generateMaze(MAZE_COLS, MAZE_ROWS);
  const bossCell = findFarthestCell(grid, MAZE_COLS, MAZE_ROWS);

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

  // 雑魚敵5体 (ケーキ島: チョコおばけ, ドーナツリング, いちごタルト姫)
  const usedCells = new Set([`0,0`, `${bossCell.r},${bossCell.c}`]);
  let spawned = 0, guard = 0;
  while (spawned < 5 && guard < 500) {
    guard++;
    const r = Math.floor(Math.random() * MAZE_ROWS);
    const c = Math.floor(Math.random() * MAZE_COLS);
    const key = `${r},${c}`;
    if (usedCells.has(key)) continue;
    usedCells.add(key);
    spawnEnemy(cellToWorldX(c), cellToWorldZ(r), [0, 2, 3]);
    spawned++;
  }

  // ボス (ホールケーキ王)
  spawnBoss(cellToWorldX(bossCell.c), cellToWorldZ(bossCell.r), 1);

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
}

/* ---------------------------------------------------------
   ステージ2: わがしのしま
--------------------------------------------------------- */
function setupStage2() {
  clearStageObjects();
  
  // 壁のテクスチャ色をあんこ色に変更
  wallMat.color.setHex(0x3a2010);
  
  const grid     = generateMaze(MAZE_COLS, MAZE_ROWS);
  const bossCell = findFarthestCell(grid, MAZE_COLS, MAZE_ROWS);

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

  // 雑魚敵5体 (和菓子島: チョコおばけ[闇], 抹茶ロール[自然])
  const usedCells = new Set([`0,0`, `${bossCell.r},${bossCell.c}`]);
  let spawned = 0, guard = 0;
  while (spawned < 5 && guard < 500) {
    guard++;
    const r = Math.floor(Math.random() * MAZE_ROWS);
    const c = Math.floor(Math.random() * MAZE_COLS);
    const key = `${r},${c}`;
    if (usedCells.has(key)) continue;
    usedCells.add(key);
    spawnEnemy(cellToWorldX(c), cellToWorldZ(r), [0, 4]);
    spawned++;
  }

  // ボス (抹茶ロール)
  spawnBoss(cellToWorldX(bossCell.c), cellToWorldZ(bossCell.r), 4);

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
}
