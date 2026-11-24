// O2《獸源》ORIGIN — 2.5D 等距菱形 99x99 冒險大地圖與即時動作戰鬥
window.O2_MAP = (() => {
  const MAP_SIZE = 99;
  const plainsTileImg = new Image();
  plainsTileImg.src = 'scenes/tile_plains.jpg';
  const lavaTileImg = new Image();
  lavaTileImg.src = 'scenes/tile_lava.jpg';
  const chestAnimImg = new Image();
  chestAnimImg.src = 'sprites/chest_anim.png';

  const LAVA_PATCHES = [
    [90,  10,  72, 72], // 熔岩裂紋地面
    [190, 60,  72, 72], // 黑曜石火山地
    [40,  180, 72, 72], // 岩漿裂縫地磚
    [160, 210, 72, 72], // 熔岩池邊緣
    [250, 140, 72, 72], // 火山灰與裂隙
    [110, 270, 72, 72]  // 灼熱岩床
  ];

  // 從使用者上傳的草原圖中切出多個乾淨草地、花朵、碎石子區塊 (以 360x360 為基準)
  const PLAINS_PATCHES = [
    [130, 130, 72, 72], // 純草地
    [180, 180, 72, 72], // 草叢
    [95,  195, 72, 72], // 翠綠草皮
    [220, 100, 72, 72], // 粉紅小花草地
    [265, 130, 72, 72], // 黃色小花草地
    [36,  140, 72, 72], // 白色小花草地
    [140, 250, 72, 72]  // 雙色草叢
  ];

  function hash2D(x, y) {
    let n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  }

  function getZone(x, y) {
    for (const z of window.O2_DATA.MAP_ZONES) {
      if (x >= z.xRange[0] && x <= z.xRange[1] && y >= z.yRange[0] && y <= z.yRange[1]) return z;
    }
    return window.O2_DATA.MAP_ZONES[0];
  }

  function getWildOverride(zone, tx, ty) {
    const wm = window.O2_DATA.WILD_MONSTERS;
    if (!wm) return null;
    const roll = hash2D(tx * 17 + 3, ty * 23 + 9);
    if (roll > 0.55) return null; // 45% 保留原區域怪，55% 隨機替換為新野生怪獸
    if (zone.id === 'lava') return roll < 0.36 ? wm.W3 : wm.W1;
    if (zone.id === 'sanctum') return roll < 0.36 ? wm.W2 : wm.W3;
    if (zone.id === 'wasteland') return roll < 0.36 ? wm.W1 : wm.W3;
    return roll < 0.30 ? wm.W1 : wm.W2;
  }

  function getTileInfo(x, y) {
    if (x < 0 || y < 0 || x >= MAP_SIZE || y >= MAP_SIZE) return { type: 'wall' };
    const state = window.O2_ENGINE.getState();
    const key = `${x},${y}`;
    const zone = getZone(x, y);

    if (x === 24 && y === 24) return { type: 'safe', zone };
    const nearMonsters = [[25, 23], [22, 24], [26, 25], [24, 21]];
    const nearChests = [[23, 25], [26, 22]];
    const isNearMonster = nearMonsters.some(([mx, my]) => mx === x && my === y);
    const isNearChest = nearChests.some(([cx, cy]) => cx === x && cy === y);

    const h = hash2D(x, y);
    if (!isNearMonster && !isNearChest && h > 0.90) return { type: 'obstacle', zone };
    if ((isNearChest || (h > 0.86 && h <= 0.90)) && !state.openedChests[key]) return { type: 'chest', zone };
    if (h > 0.83 && h <= 0.86) return { type: 'fountain', zone };

    const isPollutedSpawn = isNearMonster || (h > 0.71 && h <= 0.83);
    const alreadyPurified = !!state.purifiedTiles[key];
    return {
      type: isPollutedSpawn && !alreadyPurified ? 'polluted' : 'ground',
      purified: alreadyPurified,
      zone
    };
  }

  const liveEnemies = {};
  let activeTargetKey = null;
  let lastFaceDir = [1, 0];
  let atkAnimTimer = 0;
  let atkAnimRow = 3;
  let cdAtk = 0;
  let cdDash = 0;
  let cdSkill = 0;
  let mapFx = [];
  let mapFloats = [];

  function ensureEnemyAt(tx, ty, zone) {
    const key = `${tx},${ty}`;
    if (liveEnemies[key]) return liveEnemies[key];
    const p = zone.polluted;
    const wild = getWildOverride(zone, tx, ty);
    const jitter = () => 0.94 + hash2D(tx * 13 + 1, ty * 19 + 5) * 0.12;
    const hp = Math.round(p.stats.hp * jitter());
    liveEnemies[key] = {
      key, x: tx, y: ty, zone,
      speciesId: wild ? wild.id : p.speciesId,
      name: wild ? `污染・${wild.name}` : p.name,
      hp, maxHp: hp,
      att: Math.round(p.stats.att * jitter()),
      def: Math.round(p.stats.def * jitter()),
      agi: Math.round(p.stats.agi * jitter()),
      retaliateCd: 1.15
    };
    return liveEnemies[key];
  }

  function findNearestPolluted(px, py, maxDist = 2) {
    let best = null;
    let bestD = 999;
    for (let dy = -maxDist; dy <= maxDist; dy++) {
      for (let dx = -maxDist; dx <= maxDist; dx++) {
        if (dx === 0 && dy === 0) continue;
        const tx = px + dx, ty = py + dy;
        const info = getTileInfo(tx, ty);
        if (info.type === 'polluted') {
          const d = Math.abs(dx) + Math.abs(dy);
          if (d < bestD) {
            bestD = d;
            best = ensureEnemyAt(tx, ty, info.zone);
          }
        }
      }
    }
    return best;
  }

  function awardMapKill(en) {
    const eng = window.O2_ENGINE;
    const state = eng.getState();
    const m = eng.getActiveMonster();
    const cfg = state.config;
    delete liveEnemies[en.key];
    if (activeTargetKey === en.key) activeTargetKey = null;

    state.purifiedTiles[en.key] = true;
    m.purifiedCount = (m.purifiedCount || 0) + 1;
    m.wins += 1;
    eng.applyBattleGrowth(m, en.zone.level);
    m.bond = Math.min(100, (m.bond || 0) + 3);
    eng.spendStamina(m, cfg.battleCost);

    const msgs = [];
    if (Math.random() < 0.25) {
      const allShards = ['shard_g1', 'shard_g2', 'shard_g3', 'shard_g4'];
      const dropShard = (Math.random() < 0.80 && en.zone.shardId)
        ? en.zone.shardId
        : allShards[Math.floor(Math.random() * allShards.length)];
      state.bag[dropShard] = (state.bag[dropShard] || 0) + 1;
      const sName = (window.O2_DATA.ITEMS[dropShard]?.name || dropShard).slice(0, 4);
      msgs.push(`+${sName}`);
      mapFloats.push({ x: en.x, y: en.y, txt: `+${sName}`, color: '#e879f9', life: 44 });
    }
    if (Math.random() < cfg.coinDropChance) {
      const drop = Math.round(cfg.coinDropMin + Math.random() * (cfg.coinDropMax - cfg.coinDropMin)) * en.zone.level;
      state.coins += drop;
      msgs.push(`+${drop}幣`);
      mapFloats.push({ x: en.x, y: en.y, txt: `+${drop}幣`, color: '#fde047', life: 38 });
    }
    const zb = eng.getZoneBuffs ? eng.getZoneBuffs() : { dropBonus: 0 };
    if (Math.random() < cfg.gearDropChanceMap + zb.dropBonus) {
      const gear = eng.rollGearDrop(en.zone.level);
      state.gearBag.unshift(gear);
      msgs.push(`[${gear.rarityName}]`);
    }
    // Recover HP smoothly after kill
    m.currentHp = eng.getEffectiveStats(m).hp;
    m.cp = eng.calcCP(m);
    eng.save();
    return msgs.length > 0 ? `淨化成功！${msgs.join(' ')}` : '淨化成功！';
  }

  function dealDamageToEnemy(en, dmgMult = 1.0) {
    const eng = window.O2_ENGINE;
    const state = eng.getState();
    const m = eng.getActiveMonster();
    const eff = eng.getEffectiveStats(m);
    const cfg = state.config;
    const aff = eng.getAffixSummary ? eng.getAffixSummary(m) : { vamp: 0, crit: 0, thorns: 0, dodge: 0, haste: 0, pierce: 0 };

    const dodgeChance = Math.min(0.28, Math.max(0.03, (en.agi - eff.agi) * 0.003 + 0.05));
    if (Math.random() < dodgeChance) {
      mapFloats.push({ x: en.x, y: en.y, txt: 'MISS', color: '#cbd5e1', life: 28 });
      return null;
    }
    const effDef = en.def * (1 - aff.pierce);
    const mitigation = 110 / (110 + effDef * cfg.dmgCoeffD);
    const critChance = Math.min(0.45, 0.05 + eff.agi * 0.0022 + aff.crit);
    const crit = Math.random() < critChance;
    const dmg = Math.max(1, Math.round(eff.att * dmgMult * cfg.dmgCoeffA * mitigation * (crit ? 1.45 : 0.92 + Math.random() * 0.16)));

    en.hp = Math.max(0, en.hp - dmg);
    if (aff.vamp > 0) {
      m.currentHp = Math.min(eff.hp, m.currentHp + Math.max(1, Math.round(dmg * aff.vamp)));
    }
    mapFloats.push({ x: en.x, y: en.y, txt: `${crit ? 'CRIT ' : ''}-${dmg}`, color: crit ? '#fde047' : '#fb923c', life: 32 });
    mapFx.push({ x: en.x, y: en.y, type: dmgMult > 1.2 ? 'ring' : 'slash', life: 16, maxLife: 16 });

    if (en.hp <= 0) {
      return awardMapKill(en);
    }
    return null;
  }

  function performMapAttack(isSkill = false) {
    const eng = window.O2_ENGINE;
    const state = eng.getState();
    const m = eng.getActiveMonster();
    if (m.sleeping) return { ok: false, msg: '睡眠中無法攻擊！' };
    if (m.poisoned) return { ok: false, msg: '中毒中無法攻擊，請先淨化！' };
    if (m.stamina < state.config.battleCost) return { ok: false, msg: `體力不足 (需要 ${state.config.battleCost})` };

    if (isSkill && cdSkill > 0) return { ok: false, msg: `源力斬冷卻中 (${cdSkill.toFixed(1)}s)` };
    if (!isSkill && cdAtk > 0) return { ok: false };

    const pos = state.mapPos;
    let target = (activeTargetKey && liveEnemies[activeTargetKey]) ? liveEnemies[activeTargetKey] : findNearestPolluted(pos.x, pos.y, 1);
    if (target && Math.abs(target.x - pos.x) + Math.abs(target.y - pos.y) > 1) target = null;

    if (!target) {
      const near = findNearestPolluted(pos.x, pos.y, 4);
      if (near) {
        const dx = Math.abs(near.x - pos.x) >= Math.abs(near.y - pos.y) ? Math.sign(near.x - pos.x) : 0;
        const dy = dx === 0 ? Math.sign(near.y - pos.y) : 0;
        const mv = movePlayer(dx, dy);
        return { ok: true, msg: mv.msg };
      }
      atkAnimRow = 3;
      atkAnimTimer = 0.22;
      cdAtk = 0.42;
      mapFx.push({ x: pos.x + lastFaceDir[0], y: pos.y + lastFaceDir[1], type: isSkill ? 'ring' : 'slash', life: 14, maxLife: 14 });
      return { ok: true };
    }

    activeTargetKey = target.key;
    if (target.x !== pos.x) lastFaceDir = [Math.sign(target.x - pos.x), 0];

    if (isSkill) {
      cdSkill = 3.5;
      atkAnimRow = 6;
      atkAnimTimer = 0.36;
      const killedMsgs = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const info = getTileInfo(pos.x + dx, pos.y + dy);
          if (info.type === 'polluted') {
            const en = ensureEnemyAt(pos.x + dx, pos.y + dy, info.zone);
            const km = dealDamageToEnemy(en, 1.85);
            if (km) killedMsgs.push(km);
          }
        }
      }
      return { ok: true, msg: killedMsgs[0] || '' };
    } else {
      const eff = eng.getEffectiveStats(m);
      const aff = eng.getAffixSummary ? eng.getAffixSummary(m) : { haste: 0 };
      cdAtk = Math.max(0.32, (1.1 / (1 + eff.agi / 50)) * (1 - aff.haste));
      atkAnimRow = 3;
      atkAnimTimer = 0.26;
      const km = dealDamageToEnemy(target, 1.0);
      return { ok: true, msg: km || '' };
    }
  }

  function performMapDash() {
    if (cdDash > 0) return { ok: false, msg: `瞬步冷卻中 (${cdDash.toFixed(1)}s)` };
    cdDash = 2.4;
    const state = window.O2_ENGINE.getState();
    const pos = state.mapPos;
    mapFx.push({ x: pos.x, y: pos.y, type: 'ring', life: 14, maxLife: 14 });
    let moved = 0;
    for (let i = 0; i < 2; i++) {
      const nx = pos.x + lastFaceDir[0], ny = pos.y + lastFaceDir[1];
      const t = getTileInfo(nx, ny);
      if (t.type !== 'wall' && t.type !== 'obstacle' && t.type !== 'polluted') {
        pos.x = nx; pos.y = ny; moved++;
      } else break;
    }
    window.O2_ENGINE.save();
    return { ok: true, msg: moved > 0 ? '瞬步閃避！' : '前方受阻' };
  }

  function stepMapCombat(dt) {
    if (cdAtk > 0) cdAtk = Math.max(0, cdAtk - dt);
    if (cdDash > 0) cdDash = Math.max(0, cdDash - dt);
    if (cdSkill > 0) cdSkill = Math.max(0, cdSkill - dt);
    if (atkAnimTimer > 0) atkAnimTimer = Math.max(0, atkAnimTimer - dt);

    const eng = window.O2_ENGINE;
    const state = eng.getState();
    const m = eng.getActiveMonster();
    const pos = state.mapPos;
    const eff = eng.getEffectiveStats(m);
    const aff = eng.getAffixSummary ? eng.getAffixSummary(m) : { dodge: 0, thorns: 0 };

    // Adjacent polluted monsters counter-attack in real time
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (Math.abs(dx) + Math.abs(dy) !== 1) continue;
        const info = getTileInfo(pos.x + dx, pos.y + dy);
        if (info.type !== 'polluted') continue;
        const en = ensureEnemyAt(pos.x + dx, pos.y + dy, info.zone);
        if (!activeTargetKey) activeTargetKey = en.key;
        en.retaliateCd -= dt;
        if (en.retaliateCd <= 0) {
          en.retaliateCd = Math.max(0.85, 1.8 / (1 + en.agi / 45));
          const dodgeChance = Math.min(0.42, Math.min(0.28, Math.max(0.03, (eff.agi - en.agi) * 0.003 + 0.05)) + aff.dodge);
          if (Math.random() < dodgeChance) {
            mapFloats.push({ x: pos.x, y: pos.y, txt: '閃避', color: '#7dd3fc', life: 26 });
          } else {
            const mit = 110 / (110 + eff.def * state.config.dmgCoeffD);
            const dmg = Math.max(1, Math.round(en.att * state.config.dmgCoeffA * mit * (0.9 + Math.random() * 0.2)));
            m.currentHp = Math.max(0, m.currentHp - dmg);
            mapFloats.push({ x: pos.x, y: pos.y, txt: `-${dmg}`, color: '#f43f5e', life: 28 });
            const th = Math.round(eff.def * (0.08 + aff.thorns));
            if (th > 0) {
              en.hp = Math.max(0, en.hp - th);
              if (en.hp <= 0) awardMapKill(en);
            }
            if (m.currentHp <= 0) {
              m.losses += 1;
              m.currentHp = eff.hp;
              pos.x = 24; pos.y = 24;
              activeTargetKey = null;
              eng.save();
              mapFloats.push({ x: 24, y: 24, txt: '力竭傳回安全區', color: '#f43f5e', life: 45 });
              return;
            }
          }
        }
      }
    }
  }

  function movePlayer(dx, dy) {
    const eng = window.O2_ENGINE;
    const state = eng.getState();
    const pos = state.mapPos;
    if (dx !== 0 || dy !== 0) lastFaceDir = [dx, dy];
    const nx = pos.x + dx;
    const ny = pos.y + dy;
    const tile = getTileInfo(nx, ny);

    if (tile.type === 'wall' || tile.type === 'obstacle') return { moved: false, msg: '前方有地形障礙！' };

    pos.x = nx;
    pos.y = ny;

    if (tile.type === 'chest') {
      state.openedChests[`${nx},${ny}`] = true;
      const gear = eng.rollGearDrop(tile.zone.level);
      state.gearBag.unshift(gear);
      const bonusCoins = 25 * tile.zone.level;
      state.coins += bonusCoins;
      eng.save();
      return { moved: true, event: 'chest', msg: `開啟寶箱！獲得 ${gear.name} 與 +${bonusCoins} 源幣`, zone: tile.zone };
    }

    if (tile.type === 'fountain') {
      const m = eng.getActiveMonster();
      m.stamina = Math.min(state.config.maxStamina, m.stamina + 35);
      m.currentHp = eng.getEffectiveStats(m).hp;
      eng.save();
      return { moved: true, event: 'fountain', msg: '發現淨化泉水！體力 +35、HP 全滿', zone: tile.zone };
    }

    eng.save();
    if (tile.type === 'polluted') {
      const wild = getWildOverride(tile.zone, nx, ny);
      const res = window.O2_BATTLE.startMapPollutedBattle(tile.zone, nx, ny, wild);
      return { moved: true, encounter: true, battleRes: res, zone: tile.zone };
    }
    return { moved: true, encounter: false, zone: tile.zone };
  }

  // 繪製精緻像素紋理磚塊
  function drawTexturedTile(ctx, px, py, tw, th, tx, ty, info, tick) {
    const z = info.zone;
    if (z.id === 'lava' && lavaTileImg.complete && lavaTileImg.naturalWidth > 0) {
      const idx = Math.floor(hash2D(tx * 5 + 3, ty * 11 + 7) * LAVA_PATCHES.length) % LAVA_PATCHES.length;
      const [sx, sy, sw, sh] = LAVA_PATCHES[idx];
      ctx.drawImage(lavaTileImg, sx, sy, sw, sh, px, py, tw, th);
      if (info.purified) {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.28)';
        ctx.fillRect(px, py, tw, th);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 1, py + 1, tw - 2, th - 2);
      }
      return;
    }

    if (z.id === 'plains' && plainsTileImg.complete && plainsTileImg.naturalWidth > 0) {
      const idx = Math.floor(hash2D(tx * 3 + 5, ty * 7 + 11) * PLAINS_PATCHES.length) % PLAINS_PATCHES.length;
      const [sx, sy, sw, sh] = PLAINS_PATCHES[idx];
      ctx.drawImage(plainsTileImg, sx, sy, sw, sh, px, py, tw, th);
      if (info.purified) {
        ctx.fillStyle = 'rgba(56, 189, 248, 0.28)';
        ctx.fillRect(px, py, tw, th);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 1, py + 1, tw - 2, th - 2);
      }
      return;
    }

    if (info.purified) {
      ctx.fillStyle = '#0c4a6e';
      ctx.fillRect(px, py, tw, th);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(px + 4, py + 4, 4, 4);
      ctx.fillRect(px + tw - 8, py + th - 8, 4, 4);
      return;
    }

    // 基底色 + 交錯棋盤微調
    const checker = (tx + ty) % 2 === 0;
    if (z.id === 'plains') {
      ctx.fillStyle = checker ? '#14532d' : '#166534';
      ctx.fillRect(px, py, tw, th);
    } else if (z.id === 'lava') {
      ctx.fillStyle = checker ? '#450a0a' : '#5c1111';
      ctx.fillRect(px, py, tw, th);
      // 岩漿裂紋
      ctx.fillStyle = (tick % 40 < 20) ? '#f97316' : '#ef4444';
      ctx.fillRect(px + 4, py + th - 9, tw - 12, 3);
      ctx.fillRect(px + tw - 10, py + 6, 3, 12);
    } else if (z.id === 'wasteland') {
      ctx.fillStyle = checker ? '#2e1065' : '#3b0764';
      ctx.fillRect(px, py, tw, th);
      ctx.fillStyle = '#9333ea';
      ctx.fillRect(px + 8, py + 8, 6, 2);
      ctx.fillRect(px + 10, py + 6, 2, 6);
    } else {
      ctx.fillStyle = checker ? '#713f12' : '#854d0e';
      ctx.fillRect(px, py, tw, th);
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 3, py + 3, tw - 6, th - 6);
    }
  }

  function renderMapViewport(ctx, w, h, tick) {
    ctx.imageSmoothingEnabled = false;
    const eng = window.O2_ENGINE;
    const state = eng.getState();
    const m = eng.getActiveMonster();
    const pos = state.mapPos;
    const curZone = getZone(pos.x, pos.y);

    const tileSize = Math.max(36, Math.min(48, Math.floor(w / 10)));
    let cols = Math.max(9, Math.floor(w / tileSize));
    if (cols % 2 === 0) cols -= 1;
    let rows = Math.max(9, Math.floor((h - 30) / tileSize));
    if (rows % 2 === 0) rows -= 1;
    const tileW = Math.floor(w / cols);
    const tileH = Math.floor((h - 30) / rows);
    const halfX = Math.floor(cols / 2);
    const halfY = Math.floor(rows / 2);

    ctx.fillStyle = '#050811';
    ctx.fillRect(0, 0, w, h);

    for (let ry = 0; ry < rows; ry++) {
      for (let rx = 0; rx < cols; rx++) {
        const tx = pos.x - halfX + rx;
        const ty = pos.y - halfY + ry;
        const ox = Math.floor((w - cols * tileW) / 2);
        const px = ox + rx * tileW;
        const py = ry * tileH + 30;
        const info = getTileInfo(tx, ty);

        if (info.type === 'wall') {
          ctx.fillStyle = '#090d16';
          ctx.fillRect(px, py, tileW - 1, tileH - 1);
          continue;
        }

        drawTexturedTile(ctx, px, py, tileW - 1, tileH - 1, tx, ty, info, tick);

        if (info.type === 'obstacle') {
          if (info.zone.id === 'lava' && lavaTileImg.complete && lavaTileImg.naturalWidth > 0) {
            const useSpire = hash2D(tx, ty) > 0.94;
            if (useSpire) {
              ctx.drawImage(lavaTileImg, 120, 6, 56, 56, px + 2, py + 2, tileW - 5, tileH - 5);
            } else {
              ctx.drawImage(lavaTileImg, 176, 118, 58, 58, px + 2, py + 2, tileW - 5, tileH - 5);
            }
          } else if (info.zone.id === 'plains' && plainsTileImg.complete && plainsTileImg.naturalWidth > 0) {
            const useTree = hash2D(tx, ty) > 0.94;
            if (useTree) {
              ctx.drawImage(plainsTileImg, 2, 2, 84, 84, px + 1, py + 1, tileW - 3, tileH - 3);
            } else {
              ctx.drawImage(plainsTileImg, 276, 62, 64, 52, px + 3, py + 4, tileW - 7, tileH - 9);
            }
          } else {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(px + 5, py + 7, tileW - 11, tileH - 11);
            ctx.fillStyle = info.zone.tileAccent;
            ctx.fillRect(px + 7, py + 5, tileW - 15, tileH - 17);
            ctx.fillStyle = 'rgba(255,255,255,0.22)';
            ctx.fillRect(px + 9, py + 7, 6, 4);
          }
        } else if (info.type === 'chest') {
          if (chestAnimImg.complete && chestAnimImg.naturalWidth > 0) {
            const cFrame = Math.floor(tick / 24) % 4;
            ctx.drawImage(chestAnimImg, cFrame * 64, 0, 64, 64, px + 2, py + 2, tileW - 5, tileH - 5);
          } else {
            const glow = tick % 24 < 12;
            ctx.fillStyle = '#78350f';
            ctx.fillRect(px + 6, py + 9, tileW - 13, tileH - 15);
            ctx.fillStyle = glow ? '#fde047' : '#f59e0b';
            ctx.fillRect(px + 7, py + 10, tileW - 15, tileH - 19);
          }
        } else if (info.type === 'fountain') {
          const ripple = (tick >> 3) % 3;
          ctx.fillStyle = '#0284c7';
          ctx.fillRect(px + 6, py + 6, tileW - 13, tileH - 13);
          ctx.fillStyle = '#7dd3fc';
          ctx.fillRect(px + 9 + ripple, py + 9 + ripple, tileW - 19 - ripple * 2, tileH - 19 - ripple * 2);
        } else if (info.type === 'polluted') {
          const en = ensureEnemyAt(tx, ty, info.zone);
          const isTarget = activeTargetKey === en.key;
          const pulse = Math.sin(tick * 0.16) * 2;
          ctx.strokeStyle = isTarget ? '#f43f5e' : '#d946ef';
          ctx.lineWidth = isTarget ? 2 : 1.2;
          ctx.strokeRect(px + 2, py + 2, tileW - 5, tileH - 5);
          window.O2_BATTLE.drawSpeciesSprite(
            ctx, en.speciesId, 0, Math.floor(tick / 18) % 4,
            px + 2, py + 3 + pulse * 0.4, tileW - 5, tx < pos.x ? 'right' : 'left'
          );
          // 怪物頭頂血條 (RO風格)
          const hpR = Math.max(0, en.hp / en.maxHp);
          ctx.fillStyle = 'rgba(0,0,0,0.75)';
          ctx.fillRect(px + 4, py + 1, tileW - 9, 4);
          ctx.fillStyle = '#f43f5e';
          ctx.fillRect(px + 4, py + 1, Math.round((tileW - 9) * hpR), 4);
        }
      }
    }

    // 中心玩家怪獸 (含攻擊動作與血條)
    const oxBase = Math.floor((w - cols * tileW) / 2);
    const centerPx = oxBase + halfX * tileW - 1;
    const centerPy = halfY * tileH + 28;
    const pRow = atkAnimTimer > 0 ? atkAnimRow : 1;
    const pFace = lastFaceDir[0] < 0 ? 'left' : 'right';
    window.O2_BATTLE.drawSpeciesSprite(
      ctx, m.speciesId, pRow, Math.floor(tick / 16) % 4, centerPx, centerPy, tileW - 1, pFace
    );
    const effMe = eng.getEffectiveStats(m);
    const myHpR = Math.max(0, Math.min(1, m.currentHp / effMe.hp));
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(centerPx + 4, centerPy + 1, tileW - 9, 4);
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(centerPx + 4, centerPy + 1, Math.round((tileW - 9) * myHpR), 4);

    // 渲染地圖戰鬥斬擊特效與浮動傷害數字
    mapFx = mapFx.filter((fx) => fx.life > 0);
    mapFx.forEach((fx) => {
      fx.life -= 1;
      const sx = oxBase + (fx.x - pos.x + halfX) * tileW + tileW / 2;
      const sy = (fx.y - pos.y + halfY) * tileH + 30 + tileH / 2;
      const prog = 1 - fx.life / fx.maxLife;
      ctx.save();
      ctx.strokeStyle = fx.type === 'ring' ? `rgba(56, 189, 248, ${1 - prog})` : `rgba(253, 224, 71, ${1 - prog})`;
      ctx.lineWidth = fx.type === 'ring' ? 3 : 2.5;
      ctx.beginPath();
      if (fx.type === 'ring') ctx.arc(sx, sy, 10 + prog * 34, 0, Math.PI * 2);
      else ctx.arc(sx, sy, 18, -Math.PI * 0.4 + prog * 2, Math.PI * 0.4 + prog * 2);
      ctx.stroke();
      ctx.restore();
    });

    mapFloats = mapFloats.filter((fl) => fl.life > 0);
    mapFloats.forEach((fl) => {
      fl.life -= 1;
      const sx = oxBase + (fl.x - pos.x + halfX) * tileW + tileW / 2;
      const sy = (fl.y - pos.y + halfY) * tileH + 30 - (44 - fl.life) * 0.55;
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000000';
      ctx.fillText(fl.txt, sx + 1, sy + 1);
      ctx.fillStyle = fl.color;
      ctx.fillText(fl.txt, sx, sy);
      ctx.textAlign = 'left';
    });

    // 頂部 HUD + 迷你雷達
    ctx.fillStyle = 'rgba(9, 13, 22, 0.94)';
    ctx.fillRect(0, 0, w, 28);
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.fillStyle = '#22d3ee';
    ctx.fillText(`${curZone.name} (Lv.${curZone.level})`, 8, 18);
    const rx0 = w - 34, ry0 = 3, rs = 24;
    ctx.fillStyle = '#166534'; ctx.fillRect(rx0, ry0, 12, 12);
    ctx.fillStyle = '#7f1d1d'; ctx.fillRect(rx0 + 12, ry0, 12, 12);
    ctx.fillStyle = '#3b0764'; ctx.fillRect(rx0, ry0 + 12, 12, 12);
    ctx.fillStyle = '#78350f'; ctx.fillRect(rx0 + 12, ry0 + 12, 12, 12);
    ctx.strokeStyle = '#475569'; ctx.lineWidth = 1; ctx.strokeRect(rx0, ry0, rs, rs);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(rx0 + Math.floor((pos.x / 99) * rs) - 1, ry0 + Math.floor((pos.y / 99) * rs) - 1, 3, 3);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(`(${pos.x},${pos.y})`, rx0 - 6, 18);
    ctx.textAlign = 'left';
  }

  function stepAutoPatrol() {
    const state = window.O2_ENGINE.getState();
    const pos = state.mapPos;
    let best = null;
    let bestDist = 999;
    for (let dy = -10; dy <= 10; dy++) {
      for (let dx = -10; dx <= 10; dx++) {
        if (dx === 0 && dy === 0) continue;
        const tx = pos.x + dx;
        const ty = pos.y + dy;
        const info = getTileInfo(tx, ty);
        if (info.type === 'polluted' || info.type === 'chest') {
          const d = Math.abs(dx) + Math.abs(dy);
          if (d < bestDist) { bestDist = d; best = { dx, dy }; }
        }
      }
    }
    const candidates = [];
    if (best) {
      if (Math.abs(best.dx) >= Math.abs(best.dy)) {
        candidates.push([Math.sign(best.dx), 0], [0, Math.sign(best.dy) || 1]);
      } else {
        candidates.push([0, Math.sign(best.dy)], [Math.sign(best.dx) || 1, 0]);
      }
    }
    candidates.push([1, 0], [-1, 0], [0, 1], [0, -1]);
    for (const [cx, cy] of candidates) {
      if (cx === 0 && cy === 0) continue;
      const t = getTileInfo(pos.x + cx, pos.y + cy);
      if (t.type !== 'wall' && t.type !== 'obstacle') {
        return movePlayer(cx, cy);
      }
    }
    return { moved: false, msg: '周圍受阻' };
  }

  function teleportZone(zoneId) {
    const centers = { plains: [24, 24], lava: [72, 24], wasteland: [24, 72], sanctum: [72, 72] };
    const [bx, by] = centers[zoneId] || [24, 24];
    const state = window.O2_ENGINE.getState();
    for (let r = 0; r < 5; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const t = getTileInfo(bx + dx, by + dy);
          if (t.type !== 'wall' && t.type !== 'obstacle') {
            state.mapPos = { x: bx + dx, y: by + dy };
            window.O2_ENGINE.save();
            return t.zone;
          }
        }
      }
    }
    return getZone(bx, by);
  }

  return {
    MAP_SIZE,
    getZone,
    getTileInfo,
    movePlayer,
    stepAutoPatrol,
    performMapAttack,
    performMapDash,
    stepMapCombat,
    getCooldowns: () => ({ atk: cdAtk, dash: cdDash, skill: cdSkill }),
    teleportZone,
    renderMapViewport
  };
})();
