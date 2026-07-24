/* =========================================================
   main.js — メインシーン初期化・プレイヤー制御・メインループ
   依存: 全JSファイル
   読み込み順: config.js → models.js → maze.js → party.js → island.js → battle.js → main.js
========================================================= */

/* ---------------------------------------------------------
   メインシーン (フィールド)
--------------------------------------------------------- */
const container = document.getElementById('canvas-container');
const scene     = new THREE.Scene();
scene.background = new THREE.Color(0x8fd0e8);
scene.fog        = new THREE.Fog(0x8fd0e8, 30, 70);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

/* ---------------------------------------------------------
   ポストプロセス(ブルーム)
   捕獲マーカー・炎などの明るい"発光"素材だけをふわっと光らせる。
   閾値を高めにして、空や地面などの中間輝度までは光らないよう絞っている。
--------------------------------------------------------- */
const composer = new THREE.EffectComposer(renderer);
composer.addPass(new THREE.RenderPass(scene, camera));
const bloomPass = new THREE.UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.6,   // strength
  0.35,  // radius
  0.82   // threshold — 空の輝度(約0.77)より上、黄色いマーカー等(約0.88)より下に設定
);
composer.addPass(bloomPass);

/* ---------------------------------------------------------
   ライティング
--------------------------------------------------------- */
const hemi = new THREE.HemisphereLight(0xffffff, 0x556b2f, 0.9);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff6e0, 0.9);
sun.position.set(15, 25, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left   = -30; sun.shadow.camera.right  = 30;
sun.shadow.camera.top    =  30; sun.shadow.camera.bottom = -30;
scene.add(sun);

/** 迷路(暗い洞窟)の雰囲気から、明るい屋外の雰囲気に戻す */
function resetFieldAtmosphere() {
  scene.fog.color.setHex(0x8fd0e8);
  scene.fog.near = 30;
  scene.fog.far  = 70;
  scene.background.setHex(0x8fd0e8);
  hemi.intensity = 0.9;
  sun.intensity  = 0.9;
}

/* ---------------------------------------------------------
   地面
--------------------------------------------------------- */
const groundGeo = new THREE.PlaneGeometry(70, 70, 20, 20);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x6b5d4f, flatShading: true });
const ground    = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x  = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

/* ---------------------------------------------------------
   プレイヤー (トレーナーモデル)
--------------------------------------------------------- */
const player = buildTrainerModel();
player.position.set(0, 0, 0);
scene.add(player);

let playerAngle = 0;

/* ---------------------------------------------------------
   キー入力
--------------------------------------------------------- */
const keys = {};
window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true;  });
window.addEventListener('keyup',   e => { keys[e.key.toLowerCase()] = false; });

/* ---------------------------------------------------------
   ウィンドウリサイズ
--------------------------------------------------------- */
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  resizeBattleCanvas();
  resizeIslandCanvas();
});

/* ---------------------------------------------------------
   カメラ追従 (フィールド見下ろし)
--------------------------------------------------------- */
function updateCamera() {
  const camOffset = new THREE.Vector3(0, 9, 7);
  const targetPos = player.position.clone().add(camOffset);
  camera.position.lerp(targetPos, 0.12);
  camera.lookAt(player.position.clone().add(new THREE.Vector3(0, 0.6, 0)));
}

/* ---------------------------------------------------------
   丸型障害物との衝突判定 (現状は装飾岩のみ使用)
--------------------------------------------------------- */
function checkCollision(x, z, radius) {
  for (const o of obstacles) {
    if (Math.hypot(x - o.x, z - o.z) < radius + o.r) return true;
  }
  return false;
}

/* ---------------------------------------------------------
   メインアニメーションループ
--------------------------------------------------------- */
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (islandOverlayOpen) {
    // 島マップ
    updateIslandPlayer(dt);
    islandRenderer.render(islandScene, islandCamera);

  } else if (!battleState) {
    // フィールド探索
    let dx = 0, dz = 0;
    if (keys['w'] || keys['arrowup'])    dz -= 1;
    if (keys['s'] || keys['arrowdown'])  dz += 1;
    if (keys['a'] || keys['arrowleft'])  dx -= 1;
    if (keys['d'] || keys['arrowright']) dx += 1;

    if (dx !== 0 || dz !== 0) {
      const len = Math.hypot(dx, dz);
      dx /= len; dz /= len;
      const nx = player.position.x + dx * PLAYER_SPEED * dt;
      const nz = player.position.z + dz * PLAYER_SPEED * dt;
      if (!checkCollision(nx, nz, 0.5) && !collidesWithWalls(nx, nz, 0.4)) {
        player.position.x = nx;
        player.position.z = nz;
      }
      playerAngle      = Math.atan2(dx, dz);
      player.rotation.y = playerAngle;
    }
    updateWalkAnimation(player, dt, dx !== 0 || dz !== 0);
    updateFieldFollowers(dt);
    updateTorches();
    updateHealSpots();
    updateHealSpotTrigger();
    updateExploration();

    // 敵のAI (徘徊 + エンカウント)
    for (const e of enemies) {
      if (!e.alive) continue;

      e.wanderTimer -= dt;
      if (e.wanderTimer <= 0) {
        e.wanderTimer = 2 + Math.random() * 3;
        e.wanderTarget.set(
          e.mesh.position.x + (Math.random() - 0.5) * 6,
          0,
          e.mesh.position.z + (Math.random() - 0.5) * 6
        );
      }

      const dir = new THREE.Vector3(
        e.wanderTarget.x - e.mesh.position.x,
        0,
        e.wanderTarget.z - e.mesh.position.z
      );
      if (dir.length() > 0.1) {
        dir.normalize();
        const enx = e.mesh.position.x + dir.x * 1.2 * dt;
        const enz = e.mesh.position.z + dir.z * 1.2 * dt;
        if (!collidesWithWalls(enx, enz, 0.65)) {
          e.mesh.position.x = enx;
          e.mesh.position.z = enz;
        } else {
          e.wanderTimer = 0; // 壁衝突 → 次フレームで新目標を選択
        }
        e.mesh.rotation.y = Math.atan2(dir.x, dir.z);
      }
      // ふわふわ浮遊
      e.mesh.position.y = Math.sin(performance.now() / 400 + e.mesh.id) * 0.08;

      // エンカウント判定
      const dist = Math.hypot(
        player.position.x - e.mesh.position.x,
        player.position.z - e.mesh.position.z
      );
      if (dist < ENCOUNTER_DIST) startBattle(e);
    }

    // 宝箱の自動開封
    for (const chest of chests) {
      if (chest.opened) continue;
      const cd = Math.hypot(
        player.position.x - chest.mesh.position.x,
        player.position.z - chest.mesh.position.z
      );
      if (cd < 1.2) openChest(chest);
    }

  } else {
    // バトル中
    updateAttackMotions();
    battleRenderer.render(battleScene, battleCamera);
  }

  updateCamera();
  composer.render();
}

/* ---------------------------------------------------------
   起動
--------------------------------------------------------- */
animate();
