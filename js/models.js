/* =========================================================
   models.js — Three.js プリミティブによる3Dモデル生成
   依存: THREE (three.min.js)
   読み込み順: config.js → models.js
========================================================= */

/* ---------------------------------------------------------
   ユーティリティ: 岩・宝箱
--------------------------------------------------------- */

/** 装飾用の岩を生成して返す */
function makeRock(x, z) {
  const rock = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.6 + Math.random() * 0.4, 0),
    new THREE.MeshStandardMaterial({ color: 0x8a8378, flatShading: true })
  );
  rock.position.set(x, 0.4, z);
  rock.castShadow = true;
  return rock;
}

/** 宝箱メッシュを生成して返す (大型化: 約二倍サイズ) */
function buildChest() {
  const g       = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8a5a2a, flatShading: true });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xd9a13c, flatShading: true });

  const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.8, 0.92), woodMat);
  base.position.y = 0.4; base.castShadow = true;
  g.add(base);

  const lid = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.44, 0.96), woodMat);
  lid.position.y = 1.02; lid.castShadow = true;
  g.add(lid);

  const band1 = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.12, 1.0), trimMat);
  band1.position.y = 0.4;
  g.add(band1);

  const band2 = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.12, 1.0), trimMat);
  band2.position.y = 1.02;
  g.add(band2);

  const lock = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.28, 0.12), trimMat);
  lock.position.set(0, 0.7, 0.5);
  g.add(lock);

  // 金色の角鉄
  [[-0.68, -0.45], [0.68, -0.45], [-0.68, 0.45], [0.68, 0.45]].forEach(([bx, bz]) => {
    const corner = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.88, 0.14), trimMat);
    corner.position.set(bx, 0.44, bz);
    g.add(corner);
  });

  // 宝石飾り
  const gemMat = new THREE.MeshBasicMaterial({ color: 0x4adfff });
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), gemMat);
  gem.position.set(0, 0.7, 0.52);
  g.add(gem);

  return g;
}

/** 回復地点(いやしのいずみ)メッシュを生成して返す。中央の水晶+浮遊する光の粒で回復スポットとわかるようにする */
function buildHealSpring() {
  const g = new THREE.Group();

  const basinMat = new THREE.MeshStandardMaterial({ color: 0x9a8a6a, flatShading: true, roughness: 1 });
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.7, 0.16, 12), basinMat);
  basin.position.y = 0.08;
  g.add(basin);

  const waterMat = new THREE.MeshStandardMaterial({ color: 0x6fe0d0, transparent: true, opacity: 0.85, roughness: 0.2 });
  const water = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.06, 12), waterMat);
  water.position.y = 0.17;
  g.add(water);

  const crystalMat = new THREE.MeshBasicMaterial({ color: 0xb0fff0 });
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), crystalMat);
  crystal.position.y = 0.5;
  g.add(crystal);

  const glowLight = new THREE.PointLight(0x7fffe0, 1.0, 4.5, 2);
  glowLight.position.y = 0.55;
  g.add(glowLight);

  // 周囲を漂う光の粒(回復スポットの目印。ふわふわアニメーションさせる)
  const motes = [];
  for (let i = 0; i < 5; i++) {
    const mote = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xe0fff8 })
    );
    const angle = (i / 5) * Math.PI * 2;
    mote.position.set(Math.cos(angle) * 0.55, 0.35 + Math.random() * 0.3, Math.sin(angle) * 0.55);
    g.add(mote);
    motes.push(mote);
  }

  g.userData.crystal = crystal;
  g.userData.motes    = motes;
  g.userData.light    = glowLight;
  g.userData.phase    = Math.random() * Math.PI * 2;

  return g;
}

/* ---------------------------------------------------------
   ヤシの木 (島マップ用)
--------------------------------------------------------- */
function buildPalmTree(x, z, scale) {
  const g      = new THREE.Group();
  const trunk  = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.14, 1.8, 6),
    new THREE.MeshStandardMaterial({ color: 0x9a7a4a })
  );
  trunk.position.y = 0.9;
  trunk.rotation.z = 0.12;
  g.add(trunk);

  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3fae4f, flatShading: true });
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const leaf  = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.0, 4), leafMat);
    leaf.position.set(Math.cos(angle) * 0.32, 1.85, Math.sin(angle) * 0.32);
    leaf.rotation.x = Math.PI / 2.2;
    leaf.rotation.y = angle;
    g.add(leaf);
  }

  const coconut = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 6, 6),
    new THREE.MeshStandardMaterial({ color: 0x5a3a20 })
  );
  coconut.position.y = 1.72;
  g.add(coconut);

  g.position.set(x, 0, z);
  g.scale.set(scale, scale, scale);
  return g;
}

/* ---------------------------------------------------------
   トレーナー (プレイヤー・島プレイヤー共用)
--------------------------------------------------------- */
function buildTrainerModel() {
  const g      = new THREE.Group();
  const skin   = new THREE.MeshStandardMaterial({ color: 0xffd9b0, flatShading: true });
  const jacket = new THREE.MeshStandardMaterial({ color: 0x2f6fd0, flatShading: true });
  const pants  = new THREE.MeshStandardMaterial({ color: 0x3a3a4a, flatShading: true });
  const capMat = new THREE.MeshStandardMaterial({ color: 0xd03030, flatShading: true });

  const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.55, 8), pants);
  legL.position.set(-0.16, 0.28, 0); legL.castShadow = true;
  g.add(legL);

  const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.55, 8), pants);
  legR.position.set(0.16, 0.28, 0); legR.castShadow = true;
  g.add(legR);

  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.75, 10), jacket);
  torso.position.y = 0.93; torso.castShadow = true;
  g.add(torso);

  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.6, 8), jacket);
  armL.position.set(-0.5, 0.92, 0); armL.rotation.z = 0.15; armL.castShadow = true;
  g.add(armL);
  const handL = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), skin);
  handL.position.set(0, -0.34, 0); // 腕ローカル座標
  armL.add(handL);

  const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.6, 8), jacket);
  armR.position.set(0.5, 0.92, 0); armR.rotation.z = -0.15; armR.castShadow = true;
  g.add(armR);
  const handR = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), skin);
  handR.position.set(0, -0.34, 0); // 腕ローカル座標
  armR.add(handR);

  const pack = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.5, 0.22),
    new THREE.MeshStandardMaterial({ color: 0xffcd3c, flatShading: true })
  );
  pack.position.set(0, 0.95, -0.34); pack.castShadow = true;
  g.add(pack);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 12), skin);
  head.position.y = 1.55; head.castShadow = true;
  g.add(head);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x2a2a2a });
  [-0.13, 0.13].forEach(ex => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeMat);
    eye.position.set(ex, 1.58, 0.33);
    g.add(eye);
  });

  const mouth = new THREE.Mesh(
    new THREE.TorusGeometry(0.06, 0.014, 6, 10, Math.PI),
    new THREE.MeshBasicMaterial({ color: 0x8a4a3a })
  );
  mouth.position.set(0, 1.47, 0.34);
  mouth.rotation.x = Math.PI;
  g.add(mouth);

  const capTop = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    capMat
  );
  capTop.position.y = 1.78; capTop.castShadow = true;
  g.add(capTop);

  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.05, 16), capMat);
  brim.position.set(0, 1.8, 0.12); brim.castShadow = true;
  g.add(brim);

  // ウォークアニメ用に参照を保存
  g.userData.legL      = legL;
  g.userData.legR      = legR;
  g.userData.armL      = armL;
  g.userData.armR      = armR;
  g.userData.walkPhase = 0;

  return g;
}

/**
 * 歩行アニメーション更新 (毎フレーム呼び出す)
 * @param {THREE.Group} group
 * @param {number} dt - デルタ秒
 * @param {boolean} moving - 移動中かどうか
 */
function updateWalkAnimation(group, dt, moving) {
  if (!group || !group.userData.legL) return;
  const u = group.userData;
  if (moving) {
    u.walkPhase += dt * 9;
    const swing = Math.sin(u.walkPhase) * 0.55;
    u.legL.rotation.x =  swing;
    u.legR.rotation.x = -swing;
    u.armL.rotation.x = -swing * 0.8;
    u.armR.rotation.x =  swing * 0.8;
  } else {
    u.legL.rotation.x *= 0.8;
    u.legR.rotation.x *= 0.8;
    u.armL.rotation.x *= 0.8;
    u.armR.rotation.x *= 0.8;
  }
}

/* ---------------------------------------------------------
   敵キャラクター (食べ物モチーフ)
--------------------------------------------------------- */

/** チョコおばけ */
function buildChocoGhost() {
  const g       = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4a2c17, flatShading: true });
  const body    = new THREE.Mesh(new THREE.SphereGeometry(0.6, 14, 10), bodyMat);
  body.scale.set(1, 1.15, 1);
  body.position.y = 0.6; body.castShadow = true;
  g.add(body);

  const dripMat   = new THREE.MeshStandardMaterial({ color: 0x3a2010, flatShading: true });
  const dripCount = 6;
  for (let i = 0; i < dripCount; i++) {
    const angle = (i / dripCount) * Math.PI * 2;
    const drip  = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 6), dripMat);
    drip.position.set(Math.cos(angle) * 0.52, 0.1, Math.sin(angle) * 0.52);
    drip.rotation.x = Math.PI; drip.castShadow = true;
    g.add(drip);
  }

  const eyeMat   = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x1a1a1a });
  [-0.18, 0.18].forEach(ex => {
    const eye = new THREE.Mesh(new THREE.CircleGeometry(0.11, 10), eyeMat);
    eye.position.set(ex, 0.66, 0.57);
    g.add(eye);
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.05, 10), pupilMat);
    pupil.position.set(ex, 0.64, 0.585);
    g.add(pupil);
  });

  const cherry = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xc42840 })
  );
  cherry.position.set(0, 1.28, 0); cherry.castShadow = true;
  g.add(cherry);

  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.14, 4),
    new THREE.MeshStandardMaterial({ color: 0x2f6b2f })
  );
  stem.position.set(0, 1.38, 0);
  g.add(stem);

  return g;
}

/** ホールケーキ王 */
function buildCakeKing() {
  const g     = new THREE.Group();
  const tier1 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.75, 0.8, 0.45, 14),
    new THREE.MeshStandardMaterial({ color: 0xf6dfc4, flatShading: true })
  );
  tier1.position.y = 0.225; tier1.castShadow = true;

  const tier2 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.6, 0.4, 14),
    new THREE.MeshStandardMaterial({ color: 0xf4c6d0, flatShading: true })
  );
  tier2.position.y = 0.65; tier2.castShadow = true;

  const tier3 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.42, 0.35, 14),
    new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true })
  );
  tier3.position.y = 1.02; tier3.castShadow = true;

  g.add(tier1, tier2, tier3);

  const crown = new THREE.Mesh(
    new THREE.TorusGeometry(0.3, 0.06, 8, 16),
    new THREE.MeshStandardMaterial({ color: 0xe0b83a, metalness: 0.3, roughness: 0.4 })
  );
  crown.rotation.x = Math.PI / 2;
  crown.position.y = 1.28; crown.castShadow = true;
  g.add(crown);

  const cherry = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xc42840 })
  );
  cherry.position.y = 1.44;
  g.add(cherry);

  for (let i = 0; i < 3; i++) {
    const angle  = (i / 3) * Math.PI * 2;
    const candle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.22, 6),
      new THREE.MeshStandardMaterial({ color: 0xffffff })
    );
    candle.position.set(Math.cos(angle) * 0.2, 1.2, Math.sin(angle) * 0.2);
    g.add(candle);

    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.03, 0.08, 6),
      new THREE.MeshBasicMaterial({ color: 0xffb020 })
    );
    flame.position.set(Math.cos(angle) * 0.2, 1.35, Math.sin(angle) * 0.2);
    g.add(flame);
  }

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x2a2a2a });
  [-0.18, 0.18].forEach(ex => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), eyeMat);
    eye.position.set(ex, 0.68, 0.58);
    g.add(eye);
  });

  return g;
}

/** ドーナツリング */
function buildDonutRing() {
  const g     = new THREE.Group();
  const donut = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.28, 10, 20),
    new THREE.MeshStandardMaterial({ color: 0xe8a0c0, flatShading: true })
  );
  donut.rotation.x = Math.PI / 2;
  donut.position.y = 0.5; donut.castShadow = true;
  g.add(donut);

  const sprinkleColors = [0xffe45e, 0x5ed6ff, 0x7bd67a, 0xff6f91, 0xffffff];
  for (let i = 0; i < 14; i++) {
    const angle  = Math.random() * Math.PI * 2;
    const radius = 0.3 + Math.random() * 0.5;
    const spr    = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 0.12, 5),
      new THREE.MeshStandardMaterial({ color: sprinkleColors[i % sprinkleColors.length] })
    );
    spr.position.set(
      Math.cos(angle) * radius,
      0.68 + Math.random() * 0.08,
      Math.sin(angle) * radius
    );
    spr.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    g.add(spr);
  }

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x2a2a2a });
  [-0.15, 0.15].forEach(ex => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), eyeMat);
    eye.position.set(ex, 0.5, 0.75);
    g.add(eye);
  });

  return g;
}

/** いちごタルト姫 */
function buildTartPrincess() {
  const g     = new THREE.Group();
  const crust = new THREE.Mesh(
    new THREE.CylinderGeometry(0.65, 0.7, 0.22, 14),
    new THREE.MeshStandardMaterial({ color: 0xd9a066, flatShading: true })
  );
  crust.position.y = 0.11; crust.castShadow = true;
  g.add(crust);

  const cream = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0xfff6e8, flatShading: true })
  );
  cream.position.y = 0.22; cream.castShadow = true;
  g.add(cream);

  const berryMat = new THREE.MeshStandardMaterial({ color: 0xd6304a, flatShading: true });
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const berry = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.22, 8), berryMat);
    berry.position.set(Math.cos(angle) * 0.28, 0.55, Math.sin(angle) * 0.28);
    berry.rotation.x = Math.PI; berry.castShadow = true;
    g.add(berry);
  }

  const crownBerry = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 8), berryMat);
  crownBerry.position.y = 0.72;
  crownBerry.rotation.x = Math.PI;
  g.add(crownBerry);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x2a2a2a });
  [-0.16, 0.16].forEach(ex => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), eyeMat);
    eye.position.set(ex, 0.32, 0.66);
    g.add(eye);
  });

  return g;
}

/* ---------------------------------------------------------
   ENEMY_TYPES — 全敵キャラクターのマスタデータ
   (build関数を参照するため models.js 末尾に定義)
--------------------------------------------------------- */
/** 抹茶ロール (自然属性) */
function buildMatchaRoll() {
  const g = new THREE.Group();
  const rollMat = new THREE.MeshStandardMaterial({ color: 0x4a7c3f, flatShading: true });
  const roll = new THREE.Mesh(
    new THREE.CylinderGeometry(0.6, 0.6, 0.4, 16),
    rollMat
  );
  roll.rotation.x = Math.PI / 2;
  roll.position.y = 0.6;
  roll.castShadow = true;
  g.add(roll);

  const creamMat = new THREE.MeshStandardMaterial({ color: 0xfffcf0, flatShading: true });
  const innerRoll = new THREE.Mesh(
    new THREE.CylinderGeometry(0.48, 0.48, 0.41, 16),
    creamMat
  );
  innerRoll.rotation.x = Math.PI / 2;
  innerRoll.position.y = 0.6;
  g.add(innerRoll);

  const spiralMat = new THREE.MeshStandardMaterial({ color: 0x4a7c3f, flatShading: true });
  const spiral = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.15, 0.43),
    spiralMat
  );
  spiral.position.set(0.1, 0.6, 0);
  g.add(spiral);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x2a2a2a });
  [-0.15, 0.15].forEach(ex => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), eyeMat);
    eye.position.set(ex, 0.6, 0.22);
    g.add(eye);
  });

  return g;
}

/* ---------------------------------------------------------
   進化後モデル (Lv.20到達で見た目が強化される)
--------------------------------------------------------- */
/** 進化演出共通パーツ: 足元に属性カラーの光る輪をつける */
function addAuraRing(g, color, y, radius) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.04, 8, 24),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = y;
  g.add(ring);
  return ring;
}

/** チョコおばけ 進化形態: チョコキング (闇) */
function buildChocoGhostEvolved() {
  const g = buildChocoGhost();
  g.scale.set(1.25, 1.25, 1.25);

  const hornMat = new THREE.MeshStandardMaterial({ color: 0x1a0d08, flatShading: true });
  [-0.22, 0.22].forEach(hx => {
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.32, 6), hornMat);
    horn.position.set(hx, 1.25, 0);
    horn.rotation.z = hx > 0 ? -0.3 : 0.3;
    horn.castShadow = true;
    g.add(horn);
  });

  addAuraRing(g, 0x5a24a0, 0.02, 0.85);
  return g;
}

/** ホールケーキ王 進化形態: ホールケーキ神皇 (光) */
function buildCakeKingEvolved() {
  const g = buildCakeKing();
  g.scale.set(1.2, 1.25, 1.2);

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.04, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff3b0 })
  );
  halo.position.y = 1.75;
  g.add(halo);

  addAuraRing(g, 0xb07800, 0.02, 0.95);
  return g;
}

/** ドーナツリング 進化形態: ドーナツフレア (炎) */
function buildDonutRingEvolved() {
  const g = buildDonutRing();
  g.scale.set(1.2, 1.2, 1.2);

  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff7a30 });
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 6), flameMat);
    flame.position.set(Math.cos(angle) * 0.55, 0.5 + Math.sin(i) * 0.05, Math.sin(angle) * 0.55);
    flame.rotation.x = Math.PI;
    g.add(flame);
  }

  addAuraRing(g, 0xc8361a, 0.02, 0.85);
  return g;
}

/** いちごタルト姫 進化形態: いちごタルト女王 (水) */
function buildTartPrincessEvolved() {
  const g = buildTartPrincess();
  g.scale.set(1.2, 1.2, 1.2);

  const tiaraMat = new THREE.MeshStandardMaterial({ color: 0x9fd6ff, metalness: 0.4, roughness: 0.3 });
  const tiara = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 8, 16, Math.PI), tiaraMat);
  tiara.rotation.x = Math.PI / 2;
  tiara.position.y = 0.78;
  g.add(tiara);

  addAuraRing(g, 0x1460b0, 0.02, 0.8);
  return g;
}

/** 抹茶ロール 進化形態: 抹茶ロール大樹 (自然) */
function buildMatchaRollEvolved() {
  const g = buildMatchaRoll();
  g.scale.set(1.15, 1.3, 1.15);

  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f9142, flatShading: true });
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.28, 5), leafMat);
    leaf.position.set(Math.cos(angle) * 0.25, 0.95, Math.sin(angle) * 0.25);
    leaf.rotation.x = Math.PI;
    g.add(leaf);
  }

  addAuraRing(g, 0x246e2e, 0.02, 0.8);
  return g;
}

/** もりのぬし (自然属性) — 画像のようなずっしり丸い体に赤いキノコが生えているモンスター */
function buildMushroomBoss() {
  const g = new THREE.Group();

  // ボディ — ずっしりした丸い角张り
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd4c8a8, flatShading: true, roughness: 0.8 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 10), bodyMat);
  body.scale.set(1.15, 1.05, 1.1);
  body.position.y = 0.72;
  body.castShadow = true;
  g.add(body);

  // 腐葉層 — 下半を少し木色に
  const baseMat = new THREE.MeshStandardMaterial({ color: 0xa89878, flatShading: true, roughness: 1 });
  const baseBody = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.55, 0.5, 12), baseMat);
  baseBody.position.y = 0.25;
  baseBody.castShadow = true;
  g.add(baseBody);

  // なまこ髪 (ボディ横幅に旀) — 大型キノコを何本か繋りまとめたような形
  const capMat    = new THREE.MeshStandardMaterial({ color: 0xc23030, flatShading: true, roughness: 0.7 });
  const capSpotMat = new THREE.MeshBasicMaterial({ color: 0xfff5e0 });

  // メインキノコ (真正面上)
  const mainCap = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8, 0, Math.PI*2, 0, Math.PI*0.6), capMat);
  mainCap.position.set(0, 1.42, 0);
  mainCap.castShadow = true;
  g.add(mainCap);

  const mainStem = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.28, 8), bodyMat);
  mainStem.position.set(0, 1.2, 0);
  g.add(mainStem);

  // 山の点
  for (let si = 0; si < 4; si++) {
    const sAngle = (si / 4) * Math.PI * 2 + 0.3;
    const r      = 0.28 + (si % 2) * 0.08;
    const sx = Math.cos(sAngle) * r;
    const sz = Math.sin(sAngle) * r;
    const spot = new THREE.Mesh(new THREE.CircleGeometry(0.06 + Math.random()*0.04, 8), capSpotMat);
    spot.position.set(sx, 1.68 + Math.random()*0.08, sz);
    spot.lookAt(sx * 3, 3.5, sz * 3);
    g.add(spot);
  }

  // サイドキノコ (左)
  const sideCapL = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 7, 0, Math.PI*2, 0, Math.PI*0.6), capMat);
  sideCapL.position.set(-0.5, 1.18, 0.1);
  sideCapL.rotation.z = -0.3;
  sideCapL.castShadow = true;
  g.add(sideCapL);
  const sideStemL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.18, 6), bodyMat);
  sideStemL.position.set(-0.46, 1.06, 0.1);
  sideStemL.rotation.z = -0.3;
  g.add(sideStemL);

  // サイドキノコ (右)
  const sideCapR = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 7, 0, Math.PI*2, 0, Math.PI*0.6), capMat);
  sideCapR.position.set(0.52, 1.22, 0.05);
  sideCapR.rotation.z = 0.35;
  sideCapR.castShadow = true;
  g.add(sideCapR);
  const sideStemR = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.15, 6), bodyMat);
  sideStemR.position.set(0.48, 1.1, 0.05);
  sideStemR.rotation.z = 0.35;
  g.add(sideStemR);

  // 小さなキノコ (左耂部)
  const tinyCap1 = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6, 0, Math.PI*2, 0, Math.PI*0.55), capMat);
  tinyCap1.position.set(-0.62, 0.75, 0.35);
  g.add(tinyCap1);
  const tinyCap2 = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6, 0, Math.PI*2, 0, Math.PI*0.55), capMat);
  tinyCap2.position.set(0.60, 0.72, 0.32);
  g.add(tinyCap2);

  // 目 (強面の赤い目)
  const eyeMat    = new THREE.MeshStandardMaterial({ color: 0x8a1010, flatShading: true });
  const eyeGlowMat = new THREE.MeshBasicMaterial({ color: 0xff4040 });
  [-0.22, 0.22].forEach((ex, idx) => {
    // 外側の目
    const eyeOuter = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), eyeMat);
    eyeOuter.position.set(ex, 0.84, 0.7);
    eyeOuter.scale.set(1, 0.6, 0.7);
    g.add(eyeOuter);
    // 光る瞳子
    const eyeGlow = new THREE.Mesh(new THREE.SphereGeometry(0.055, 7, 7), eyeGlowMat);
    eyeGlow.position.set(ex, 0.84, 0.74);
    g.add(eyeGlow);
    // 山屡たまゆ
    const browMat = new THREE.MeshStandardMaterial({ color: 0x4a2020, flatShading: true });
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.06), browMat);
    brow.position.set(ex, 0.94, 0.7);
    brow.rotation.z = idx === 0 ? 0.3 : -0.3;
    g.add(brow);
  });

  // 小さなバビ (脂肪たっぷり感)
  const blobMat = new THREE.MeshStandardMaterial({ color: 0xccc0a0, flatShading: true, roughness: 0.9 });
  [[-0.58, 0.5, 0.5, 0.15], [0.55, 0.48, 0.55, 0.13], [-0.2, 0.28, 0.68, 0.11], [0.22, 0.3, 0.66, 0.10]].forEach(([bx, by, bz, br]) => {
    const blob = new THREE.Mesh(new THREE.SphereGeometry(br, 8, 6), blobMat);
    blob.position.set(bx, by, bz);
    g.add(blob);
  });

  // 自然属性の「かび」演出用オーラリング
  addAuraRing(g, 0x246e2e, 0.04, 0.9);

  return g;
}

/** もりのぬし 進化 (大樹キノコ王) */
function buildMushroomBossEvolved() {
  const g = buildMushroomBoss();
  g.scale.set(1.2, 1.2, 1.2);

  // 追加の巨大キノコ
  const capMat = new THREE.MeshStandardMaterial({ color: 0xa01818, flatShading: true });
  const megaCap = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8, 0, Math.PI*2, 0, Math.PI*0.55), capMat);
  megaCap.position.set(0.15, 1.85, 0);
  megaCap.rotation.z = 0.2;
  g.add(megaCap);

  // 木の根のようなもの
  const rootMat = new THREE.MeshStandardMaterial({ color: 0x6a4a28, flatShading: true });
  [-0.4, 0.4].forEach(rx => {
    const root = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.1), rootMat);
    root.position.set(rx, -0.05, 0.3);
    root.rotation.z = rx > 0 ? 0.4 : -0.4;
    g.add(root);
  });

  addAuraRing(g, 0x1a5e22, 0.04, 1.1);
  return g;
}

const ENEMY_TYPES = [
  { name: 'チョコおばけ',   color: 0x4a2c17, build: buildChocoGhost,    baseHp: 28, atk: 4, catchMod: 1.3, element: 'dark',
    fleeResistance: 0.12,
    evolvedName: 'ビターチョコおばけ',    evolvedBuild: buildChocoGhostEvolved },
  { name: 'ホールケーキ王', color: 0xe0b83a, build: buildCakeKing,      baseHp: 60, atk: 8, catchMod: 0.6, element: 'light',
    fleeResistance: 0.82,
    evolvedName: 'ホールケーキ大王',      evolvedBuild: buildCakeKingEvolved },
  { name: 'ドーナツリング', color: 0xe8a0c0, build: buildDonutRing,     baseHp: 32, atk: 5, catchMod: 1.2, element: 'fire',
    fleeResistance: 0.24,
    evolvedName: 'アツアツドーナツリング', evolvedBuild: buildDonutRingEvolved },
  { name: 'いちごタルト姫', color: 0xd6304a, build: buildTartPrincess,  baseHp: 38, atk: 6, catchMod: 1.0, element: 'water',
    fleeResistance: 0.38,
    evolvedName: 'ダブルいちごタルト姫',  evolvedBuild: buildTartPrincessEvolved },
  { name: '抹茶ロール',     color: 0x4a7c3f, build: buildMatchaRoll,    baseHp: 35, atk: 5, catchMod: 1.1, element: 'nature',
    fleeResistance: 0.5,
    evolvedName: '特濃抹茶ロール',        evolvedBuild: buildMatchaRollEvolved },
  { name: 'もりのぬし',     color: 0x8a3a3a, build: buildMushroomBoss,  baseHp: 55, atk: 7, catchMod: 0.7, element: 'nature',
    fleeResistance: 0.9, bodySlam: true,
    evolvedName: '大樹のぬし',            evolvedBuild: buildMushroomBossEvolved },
];
