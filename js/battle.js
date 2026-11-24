// O2《獸源》ORIGIN V2.1 — 戰鬥引擎 (戰後自動回滿HP、裝備加成、地圖污染怪對戰、隨機裝備掉落)
window.O2_BATTLE = (() => {
  const CELL_SIZE = 224;
  const loadedSheets = {};
  Object.entries(window.O2_DATA.SPRITE_PATHS).forEach(([k, src]) => {
    const img = new Image();
    img.src = src;
    loadedSheets[k] = img;
  });

  const loadedScenes = {};
  window.O2_DATA.SCENES.forEach((sc) => {
    const img = new Image();
    img.src = sc.img;
    loadedScenes[sc.id] = img;
  });

  let activeBattle = null;
  let animState = { mode: 'idle', timer: 0, maxTimer: 1, text: '', row: 0 };
  let lastHitBanner = '';
  let viewMode = 'machine';
  let speedMult = 1;
  let statusPage = 0;
  let particles = [];
  let projectiles = [];
  let floatDamages = [];
  let shakeFrames = 0;

  function spawnParticles(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 1.2 + Math.random() * 2.8;
      particles.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        size: 3 + Math.floor(Math.random() * 4),
        color,
        life: 18 + Math.floor(Math.random() * 12)
      });
    }
  }


  function drawSceneBg(ctx, x, y, w, h, sceneId, tick) {
    const img = loadedScenes[sceneId] || loadedScenes.sakura;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    if (img && img.complete && img.naturalWidth > 0) {
      const iw = img.naturalWidth, ih = img.naturalHeight;
      const scale = Math.max(w / iw, h / ih);
      const dw = iw * scale, dh = ih * scale;
      const dx = x + (w - dw) / 2;
      const dy = y + (h - dh) / 2;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, dx, dy, dw, dh);
    } else {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
  }

  function drawSpeciesSprite(ctx, speciesId, row, col, x, y, size, faceDirection) {
    const sp = window.O2_DATA.SPECIES[speciesId] || (window.O2_DATA.WILD_MONSTERS && window.O2_DATA.WILD_MONSTERS[speciesId]) || window.O2_DATA.SPECIES.B1;
    const img = loadedSheets[sp.sheet];
    if (!img || !img.complete || img.naturalWidth === 0) return;

    const cs = sp.sheetCellSize || CELL_SIZE;
    const sx = (col % 4) * cs;
    const sy = (row % 12) * cs;
    const needFlip = sp.defaultFacing !== faceDirection;

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (needFlip) {
      ctx.translate(Math.round(x + size), Math.round(y));
      ctx.scale(-1, 1);
      ctx.drawImage(img, sx, sy, cs, cs, 0, 0, size, size);
    } else {
      ctx.drawImage(img, sx, sy, cs, cs, Math.round(x), Math.round(y), size, size);
    }
    ctx.restore();
  }

  function drawSmoothWaterWave(ctx, w, h, progress) {
    const waveX = progress * (w + 80) - 40;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(waveX, 0);
    for (let y = 0; y <= h; y += 10) {
      ctx.lineTo(waveX + Math.sin(y * 0.09 + progress * 14) * 14, y);
    }
    ctx.lineTo(0, h);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, waveX + 16, 0);
    grad.addColorStop(0, 'rgba(14, 165, 233, 0.2)');
    grad.addColorStop(0.85, 'rgba(56, 189, 248, 0.68)');
    grad.addColorStop(1, 'rgba(224, 242, 254, 0.92)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }

  function startAnimation(mode, text, row = 2, duration = 96) {
    animState = { mode, text, row, timer: duration, maxTimer: duration };
  }

  function cancelAllAnimationsAndBattle() {
    if (activeBattle) {
      activeBattle.autoChain = false;
      activeBattle = null;
      const m = window.O2_ENGINE.getActiveMonster();
      m.currentHp = window.O2_ENGINE.getEffectiveStats(m).hp;
      
      window.O2_ENGINE.save();
    }
    projectiles = [];
    animState = { mode: 'idle', timer: 0, maxTimer: 1, text: '', row: 0 };
    lastHitBanner = '';
  }

  function launchBattle(opp, autoChain = false, mapCoord = null, zoneLevel = 1) {
    const eng = window.O2_ENGINE;
    const state = eng.getState();
    const m = eng.getActiveMonster();
    const eff = eng.getEffectiveStats(m);
    const cost = state.config.battleCost;

    if (m.sleeping) return { ok: false, msg: '睡眠中無法出戰！' };
    if (m.poisoned) return { ok: false, msg: '中毒中無法出戰，請先淨化！' };
    if (m.stamina < cost) return { ok: false, msg: `體力不足 (需要 ${cost})` };

    // 戰前確保滿血開戰
    m.currentHp = eff.hp;
    eng.spendStamina(m, cost);

    const bgs = (state.unlockedScenes && state.unlockedScenes.length > 0) ? state.unlockedScenes : ['sakura'];
    const bgOpp = bgs[Math.floor(Math.random() * bgs.length)];
    const bgMe = state.activeSceneId || 'sakura';

    const aff = eng.getAffixSummary ? eng.getAffixSummary(m) : { vamp: 0, crit: 0, thorns: 0, dodge: 0, haste: 0, pierce: 0 };
    const cdMe = Math.max(0.65, (2.3 / (1 + eff.agi / 45)) * (1 - aff.haste));
    const cdOpp = Math.max(0.65, 2.3 / (1 + opp.agi / 45));

    activeBattle = {
      bgOpp, bgMe, autoChain, paused: false, opp,
      mapCoord, zoneLevel,
      myMaxHp: eff.hp,
      cdMe, cdOpp, nextMe: cdMe * 0.5, nextOpp: cdOpp,
      elapsed: 0, myRow: 0, oppRow: 0, myCol: 0, oppCol: 0,
      meHits: 0, oppHits: 0,
      phase: 'ready', phaseTimer: 0.25, pendingHit: null,
      finished: false, endTimer: 0
    };
    lastHitBanner = mapCoord ? `遭遇區域污染怪！` : '交鋒開始！';
    eng.save();
    return { ok: true };
  }

  function startAutoBattle(autoChain = false) {
    const eng = window.O2_ENGINE;
    const m = eng.getActiveMonster();
    const eff = eng.getEffectiveStats(m);
    const myStage = window.O2_DATA.SPECIES[m.speciesId].stage;
    const pool = Object.values(window.O2_DATA.SPECIES).filter((s) => Math.abs(s.stage - myStage) <= 1);
    const oppSp = pool[Math.floor(Math.random() * pool.length)] || window.O2_DATA.SPECIES.G1;
    const scale = 0.82 + Math.random() * 0.28;
    const opp = {
      speciesId: oppSp.id,
      name: `${oppSp.name}`,
      hp: Math.round(eff.hp * scale),
      maxHp: Math.round(eff.hp * scale),
      att: Math.round(eff.att * scale),
      def: Math.round(eff.def * scale),
      agi: Math.round(eff.agi * scale)
    };
    return launchBattle(opp, autoChain, null, Math.max(1, myStage));
  }

  function startMapPollutedBattle(zone, tileX, tileY, wildMonster = null) {
    const p = zone.polluted;
    const jitter = () => 0.94 + Math.random() * 0.12;
    const hp = Math.round(p.stats.hp * jitter());
    const opp = {
      speciesId: wildMonster ? wildMonster.id : p.speciesId,
      name: wildMonster ? `污染・${wildMonster.name}` : p.name,
      hp,
      maxHp: hp,
      att: Math.round(p.stats.att * jitter()),
      def: Math.round(p.stats.def * jitter()),
      agi: Math.round(p.stats.agi * jitter())
    };
    return launchBattle(opp, false, { x: tileX, y: tileY }, zone.level);
  }

  function stepBattle(dt) {
    if (!activeBattle || activeBattle.paused) return;
    const eng = window.O2_ENGINE;
    const state = eng.getState();
    const m = eng.getActiveMonster();
    const eff = eng.getEffectiveStats(m);

    if (activeBattle.finished) {
      activeBattle.endTimer -= dt * speedMult;
      if (activeBattle.endTimer <= 0) {
        // 關鍵修正：戰後自動回滿 HP！確保自動連戰能順暢進入下一場
        m.currentHp = eff.hp;
        const shouldChain = activeBattle.autoChain && m.stamina >= state.config.battleCost && !m.poisoned;
        const wasChain = activeBattle.autoChain;
        activeBattle = null;
        eng.save();
        if (shouldChain) {
          startAutoBattle(true);
        } else if (wasChain && m.stamina < state.config.battleCost) {
          
        }
      }
      return;
    }

    const stepDt = dt * speedMult;
    b.phaseTimer = Math.max(0, b.phaseTimer - stepDt);

    function prepareTurn(isMeAttacker) {
      const aff = eng.getAffixSummary ? eng.getAffixSummary(m) : { vamp: 0, crit: 0, thorns: 0, dodge: 0, haste: 0, pierce: 0 };
      const atk = isMeAttacker ? eff : b.opp;
      const dfn = isMeAttacker ? b.opp : eff;
      const baseDodge = Math.min(0.28, Math.max(0.03, (dfn.agi - atk.agi) * 0.003 + 0.05));
      const dodgeChance = Math.min(0.42, baseDodge + (isMeAttacker ? 0 : aff.dodge));
      const dodged = Math.random() < dodgeChance;

      if (isMeAttacker) b.meHits = (b.meHits || 0) + 1;
      else b.oppHits = (b.oppHits || 0) + 1;
      const isSpecialTurn = (isMeAttacker ? b.meHits : b.oppHits) % 3 === 0;
      const effDef = isMeAttacker ? dfn.def * (1 - aff.pierce) : dfn.def;
      const mitigation = 110 / (110 + effDef * cfg.dmgCoeffD);
      const critChance = Math.min(0.45, 0.05 + atk.agi * 0.0022 + (isMeAttacker ? aff.crit : 0));
      const crit = !dodged && ((Math.random() < critChance) || isSpecialTurn);
      const dmg = dodged ? 0 : Math.max(1, Math.round(atk.att * cfg.dmgCoeffA * mitigation * (crit ? 1.45 : 0.92 + Math.random() * 0.16)));
      const thorns = dodged ? 0 : Math.round(dfn.def * (0.08 + (isMeAttacker ? 0 : aff.thorns)));

      b.pendingHit = { isMeAttacker, dodged, crit, isSpecialTurn, dmg, thorns, vamp: aff.vamp };
      b.phase = 'windup';
      b.phaseTimer = 0.60; // 0->1->2 (0.60s windup, launches fireball exactly at Frame 2!)
      if (isMeAttacker) {
        b.myRow = crit ? 6 : 3; b.myCol = 0;
        b.oppRow = 0; b.oppCol = 0;
      } else {
        b.oppRow = crit ? 6 : 3; b.oppCol = 0;
        b.myRow = 0; b.myCol = 0;
      }
    }

    function applyPendingImpact(h) {
      if (h.dodged) {
        lastHitBanner = h.isMeAttacker ? '我方 攻擊被閃過!' : '我方 成功閃避!';
        if (h.isMeAttacker) { b.oppRow = 2; b.oppCol = 0; } else { b.myRow = 2; b.myCol = 0; }
        floatDamages.push({ x: h.isMeAttacker ? 84 : 248, y: h.isMeAttacker ? 100 : 256, txt: 'MISS', color: '#cbd5e1', life: 45 });
      } else if (h.isMeAttacker) {
        b.opp.hp = Math.max(0, b.opp.hp - h.dmg);
        if (h.vamp > 0) m.currentHp = Math.min(b.myMaxHp, m.currentHp + Math.max(1, Math.round(h.dmg * h.vamp)));
        m.currentHp = Math.max(0, m.currentHp - h.thorns);
        b.oppRow = 5; b.oppCol = 0;
        lastHitBanner = `我方 ${h.isSpecialTurn ? '必殺特攻' : (h.crit ? '暴擊' : '命中')} -${h.dmg}`;
        spawnParticles(78, 118, h.crit ? '#fde047' : '#f97316', h.crit ? 22 : 14);
        floatDamages.push({ x: 84, y: 100, txt: `${h.crit ? 'CRIT ' : ''}-${h.dmg}`, color: h.crit ? '#fde047' : '#fb7185', life: 45 });
        if (h.crit) shakeFrames = 8;
      } else {
        m.currentHp = Math.max(0, m.currentHp - h.dmg);
        b.opp.hp = Math.max(0, b.opp.hp - h.thorns);
        b.myRow = 5; b.myCol = 0;
        lastHitBanner = `敵方 ${h.isSpecialTurn ? '必殺特攻' : (h.crit ? '暴擊' : '命中')} -${h.dmg}`;
        spawnParticles(258, 278, h.crit ? '#fde047' : '#c084fc', h.crit ? 22 : 14);
        floatDamages.push({ x: 248, y: 256, txt: `${h.crit ? 'CRIT ' : ''}-${h.dmg}`, color: h.crit ? '#fde047' : '#fb7185', life: 45 });
        if (h.crit) shakeFrames = 8;
      }
      b.phase = 'react';
      b.phaseTimer = 0.68;
    }

    if (b.phase === 'ready') {
      b.myRow = 0; b.oppRow = 0;
      if (b.phaseTimer <= 0) {
        if (b.nextMe <= b.nextOpp) {
          b.nextOpp -= b.nextMe;
          b.nextMe = b.cdMe;
          prepareTurn(true);
        } else {
          b.nextMe -= b.nextOpp;
          b.nextOpp = b.cdOpp;
          prepareTurn(false);
        }
      }
    } else if (b.phase === 'windup') {
      const p = 1 - b.phaseTimer / 0.60;
      const col = p < 0.35 ? 0 : (p < 0.72 ? 1 : 2);
      if (b.pendingHit.isMeAttacker) b.myCol = col;
      else b.oppCol = col;
      if (b.phaseTimer <= 0) {
        // Launch fireball right on Frame 2!
        const h = b.pendingHit;
        if (h.isMeAttacker) b.myCol = 2; else b.oppCol = 2;
        projectiles.push({
          dir: h.isMeAttacker ? 'meToOpp' : 'oppToMe',
          prog: 0,
          spd: h.crit ? 0.019 : 0.022, // ~0.85-0.95s slow, readable flight!
          color: h.isMeAttacker ? (h.crit ? '#fde047' : '#f97316') : (h.crit ? '#fde047' : '#c084fc'),
          core: h.isMeAttacker ? '#fef08a' : '#f5d0fe',
          radius: h.crit ? 12 : 9,
          onImpact: () => applyPendingImpact(h)
        });
        b.phase = 'flight';
        b.phaseTimer = 2.0; // safety guard
      }
    } else if (b.phase === 'flight') {
      if (b.pendingHit) {
        if (b.pendingHit.isMeAttacker) b.myCol = b.phaseTimer < 1.6 ? 3 : 2;
        else b.oppCol = b.phaseTimer < 1.6 ? 3 : 2;
      }
      if (projectiles.length === 0 && b.pendingHit) {
        applyPendingImpact(b.pendingHit);
      }
    } else if (b.phase === 'react') {
      const col = Math.min(3, Math.floor((1 - b.phaseTimer / 0.68) * 4));
      if (b.pendingHit) {
        if (b.pendingHit.isMeAttacker) b.oppCol = col;
        else b.myCol = col;
      }
      if (b.phaseTimer <= 0) {
        b.pendingHit = null;
        b.myRow = 0; b.oppRow = 0;
        b.phase = 'ready';
        b.phaseTimer = 0.25;
      }
    }

    if ((b.phase === 'react' || b.phase === 'ready') && (m.currentHp <= 0 || b.opp.hp <= 0)) {
      b.finished = true;
      b.endTimer = 1.65;
      if (b.opp.hp <= 0 && m.currentHp > 0) {
        m.wins += 1;
        eng.applyBattleGrowth(m, b.zoneLevel);
        m.bond = Math.min(100, (m.bond || 0) + 3);
        b.myRow = 2; b.oppRow = 7;

        const rewards = [];
        // 地圖淨化處理 + 進化碎片隨機掉落 (25% 機率，主產區 80% 權重)
        if (b.mapCoord) {
          state.purifiedTiles[`${b.mapCoord.x},${b.mapCoord.y}`] = true;
          m.purifiedCount = (m.purifiedCount || 0) + 1;
          if (Math.random() < 0.25) {
            const z = window.O2_MAP.getZone(b.mapCoord.x, b.mapCoord.y);
            const allShards = ['shard_g1', 'shard_g2', 'shard_g3', 'shard_g4'];
            const dropShard = (Math.random() < 0.80 && z.shardId)
              ? z.shardId
              : allShards[Math.floor(Math.random() * allShards.length)];
            state.bag[dropShard] = (state.bag[dropShard] || 0) + 1;
            const sName = (window.O2_DATA.ITEMS[dropShard]?.name || dropShard).slice(0, 4);
            rewards.push(`+${sName}`);
          }
        }

        // 掉落源幣
        if (Math.random() < cfg.coinDropChance) {
          const drop = Math.round(cfg.coinDropMin + Math.random() * (cfg.coinDropMax - cfg.coinDropMin)) * b.zoneLevel;
          state.coins += drop;
          rewards.push(`+${drop}幣`);
        }

        // 隨機掉落裝備至裝備背包
        const zb = eng.getZoneBuffs ? eng.getZoneBuffs() : { dropBonus: 0 };
        const gearChance = (b.mapCoord ? cfg.gearDropChanceMap : cfg.gearDropChanceBattle) + zb.dropBonus;
        if (Math.random() < gearChance) {
          const gear = eng.rollGearDrop(b.zoneLevel);
          state.gearBag.unshift(gear);
          rewards.push(`[${gear.rarityName}]`);
        }
        lastHitBanner = rewards.length > 0 ? `勝利！${rewards.join(' ')}` : `勝利！(HP已自動回滿)`;
      } else {
        m.losses += 1;
        b.myRow = 7; b.oppRow = 2;
        lastHitBanner = `戰敗！(HP將自動回滿)`;
        
      }
      // 戰鬥結束立即補滿 HP
      m.currentHp = eff.hp;
      m.cp = eng.calcCP(m);
      eng.save();
    }
  }


  function renderStatusScreen(ctx, w, h, tick) {
    const eng = window.O2_ENGINE;
    const m = eng.getActiveMonster();
    const eff = eng.getEffectiveStats(m);
    const sp = window.O2_DATA.SPECIES[m.speciesId];
    const stg = window.O2_DATA.STAGES[sp.stage];
    const f4 = Math.floor(tick / 18) % 4;
    const SANS = "'PingFang TC', 'Noto Sans TC', 'Inter', sans-serif";

    drawSceneBg(ctx, 0, 0, w, h - 54, eng.getState().activeSceneId || 'sakura', tick);
    ctx.fillStyle = 'rgba(7, 11, 20, 0.93)';
    ctx.fillRect(6, 6, w - 12, h - 12);
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(6, 6, w - 12, h - 12);

    ctx.fillStyle = 'rgba(34, 211, 238, 0.16)';
    ctx.fillRect(8, 8, w - 16, 30);
    ctx.font = `bold 13px ${SANS}`;
    ctx.fillStyle = '#fde047';
    ctx.fillText(`${sp.id} · ${m.customName}`, 14, 28);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#4ade80';
    ctx.font = `bold 12px ${SANS}`;
    ctx.fillText(`CP ${m.cp}  [${stg.name}]`, w - 14, 28);
    ctx.textAlign = 'left';

    ctx.fillStyle = 'rgba(30, 41, 59, 0.85)';
    ctx.fillRect(14, 44, 134, 186);
    drawSpeciesSprite(ctx, m.speciesId, 0, f4, 33, 50, 96, 'right');

    ctx.font = `bold 10.5px ${SANS}`;
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(`UUID:${m.uuid.slice(0, 10)}`, 20, 162);
    ctx.fillStyle = '#7dd3fc';
    ctx.fillText(`IQ:${m.iq}  成長:${m.currentGrowth.toFixed(2)}`, 20, 180);
    ctx.fillStyle = '#f9a8d4';
    ctx.fillText(`親密:${m.bond || 0}  淨化:${m.purifiedCount || 0}`, 20, 198);
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(`戰績:${m.wins}勝 ${m.losses}敗`, 20, 216);

    const rx = 158;
    const rw = w - rx - 16;
    const statsList = [
      { k: 'HP',  v: eff.hp,  cap: stg.cap.hp,  c: '#fbbf24' },
      { k: 'ATT', v: eff.att, cap: stg.cap.att, c: '#f43f5e' },
      { k: 'DEF', v: eff.def, cap: stg.cap.def, c: '#38bdf8' },
      { k: 'AGI', v: eff.agi, cap: stg.cap.agi, c: '#4ade80' }
    ];
    statsList.forEach((st, i) => {
      const sy = 50 + i * 44;
      ctx.font = `bold 11.5px ${SANS}`;
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(st.k, rx, sy + 11);
      ctx.textAlign = 'right';
      ctx.fillStyle = st.c;
      ctx.fillText(`${st.v}/${st.cap}`, w - 16, sy + 11);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(rx, sy + 17, rw, 8);
      ctx.fillStyle = st.c;
      ctx.fillRect(rx, sy + 17, Math.min(rw, Math.round((st.v / st.cap) * rw)), 8);
    });

    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    ctx.fillRect(14, 238, w - 28, 58);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(14, 238, w - 28, 58);

    const slots = [['weapon', '武器'], ['armor', '護甲'], ['core', '源核'], ['crest', '徽章']];
    slots.forEach(([sk, sl], idx) => {
      const gx = 22 + (idx % 2) * 164;
      const gy = 259 + Math.floor(idx / 2) * 24;
      const eq = m.equip ? m.equip[sk] : null;
      ctx.font = `bold 11px ${SANS}`;
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(`${sl}:`, gx, gy);
      ctx.fillStyle = eq ? eq.color : '#64748b';
      ctx.fillText(eq ? eq.name.slice(0, 8) : '未裝備', gx + 32, gy);
    });

    const evoSt = eng.getEvoStatus(m);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.96)';
    ctx.fillRect(14, 304, w - 28, 108);
    if (statusPage === 0) {
      ctx.strokeStyle = evoSt.canEvo ? '#4ade80' : 'rgba(168, 85, 247, 0.6)';
      ctx.strokeRect(14, 304, w - 28, 108);

      if (!evoSt.branches || evoSt.branches.length === 0) {
        ctx.font = `bold 12px ${SANS}`;
        ctx.fillStyle = '#fde047';
        ctx.fillText('進化方向：已進化為成長期形態', 22, 328);
        ctx.font = `11px ${SANS}`;
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText('由幼年期分支進化而來', 22, 354);
        ctx.fillText('可穿戴 4 格高階裝備與淨化地圖強化戰力', 22, 376);
      } else if (evoSt.branches.length > 1) {
        ctx.font = `bold 12px ${SANS}`;
        ctx.fillStyle = '#fde047';
        ctx.fillText(`分支進化：${evoSt.branches.map((x) => x.branch.target).join('/')} 成長期`, 22, 324);
        ctx.textAlign = 'right';
        ctx.fillStyle = evoSt.canEvo ? '#4ade80' : '#f472b6';
        ctx.fillText(evoSt.canEvo ? `可點擊 ✦ 進化 (${evoSt.readyBranches.length})` : '培育中', w - 22, 324);
        ctx.textAlign = 'left';

        evoSt.branches.slice(0, 4).forEach((brObj, idx) => {
          const bx = 22 + (idx % 2) * 162;
          const by = 348 + Math.floor(idx / 2) * 22;
          const doneCnt = brObj.checks.filter((c) => c.ok).length;
          ctx.font = `bold 11px ${SANS}`;
          ctx.fillStyle = brObj.canEvo ? '#4ade80' : '#f1f5f9';
          ctx.fillText(`${brObj.branch.label} ${brObj.canEvo ? '✓' : `${doneCnt}/${brObj.checks.length}`}`, bx, by);
        });
        ctx.font = `bold 10.5px ${SANS}`;
        ctx.fillStyle = '#7dd3fc';
        ctx.fillText('按 B 鍵翻至第 2 頁查看詳細進化條件', 22, 398);
      } else {
        ctx.font = `bold 12px ${SANS}`;
        ctx.fillStyle = '#fde047';
        ctx.fillText(`進化方向：${evoSt.branch.label}`, 22, 324);
        ctx.textAlign = 'right';
        ctx.fillStyle = evoSt.canEvo ? '#4ade80' : '#f472b6';
        ctx.fillText(evoSt.canEvo ? '可點擊 ✦ 進化!' : '條件未滿', w - 22, 324);
        ctx.textAlign = 'left';

        evoSt.checks.forEach((c, idx) => {
          const cx = 22 + (idx % 2) * 162;
          const cy = 348 + Math.floor(idx / 2) * 22;
          const rem = Math.max(0, c.need - c.cur);
          ctx.font = `bold 11px ${SANS}`;
          ctx.fillStyle = c.ok ? '#4ade80' : '#f1f5f9';
          ctx.fillText(`${c.label}: ${c.cur}/${c.need}${c.ok ? ' ✓' : ` (缺${rem})`}`, cx, cy);
        });
        ctx.font = `10.5px ${SANS}`;
        ctx.fillStyle = '#cbd5e1';
        ctx.fillText('條件全滿後點擊頂部 ✦ 圖示觸發進化', 22, 398);
      }
    } else {
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.strokeRect(14, 304, w - 28, 108);
      if (evoSt.branches && evoSt.branches.length > 1) {
        ctx.font = `bold 11.5px ${SANS}`;
        ctx.fillStyle = '#7dd3fc';
        ctx.fillText(`${sp.id} 分支條件明細 (初始成長 ${m.initialGrowth.toFixed(2)})`, 22, 323);
        evoSt.branches.slice(0, 4).forEach((brObj, idx) => {
          const cy = 344 + idx * 18;
          ctx.font = `bold 10.5px ${SANS}`;
          ctx.fillStyle = brObj.canEvo ? '#4ade80' : '#fde047';
          ctx.fillText(`${brObj.branch.target}:`, 22, cy);
          ctx.fillStyle = brObj.canEvo ? '#4ade80' : '#f1f5f9';
          const reqStr = brObj.checks.map((c) => `${c.label}${c.cur}/${c.need}`).join('  ');
          ctx.fillText(reqStr, 46, cy);
        });
      } else {
        ctx.font = `bold 11.5px ${SANS}`;
        ctx.fillStyle = '#7dd3fc';
        ctx.fillText(`個體成長紀錄 (初始成長率 ${m.initialGrowth.toFixed(2)})`, 22, 326);
        const hist = (m.evoHistory || []).slice(-3);
        hist.forEach((hItem, idx) => {
          ctx.font = `11px ${SANS}`;
          ctx.fillStyle = '#f1f5f9';
          ctx.fillText(`• ${hItem.type} → ${hItem.formId} ${hItem.name}`, 22, 350 + idx * 19);
        });
      }
    }

    ctx.font = `bold 10.5px ${SANS}`;
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'center';
    ctx.fillText(`第 ${statusPage + 1}/2 頁 · 按 B 切換下一頁 · 按 C 返回主畫面`, w / 2, h - 10);
    ctx.textAlign = 'left';
  }

  function render(ctx, w, h, tick) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const eng = window.O2_ENGINE;
    const m = eng.getActiveMonster();
    const eff = eng.getEffectiveStats(m);
    const sp = window.O2_DATA.SPECIES[m.speciesId];
    const stg = window.O2_DATA.STAGES[sp.stage];
    const f4 = Math.floor(tick / 16) % 4;

    if (activeBattle) {
      ctx.save();
      if (shakeFrames > 0) {
        shakeFrames -= 1;
        ctx.translate((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
      }
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = '#1e1b2e';
      ctx.fillRect(0, 0, w, 40);
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(`對手 · ${activeBattle.opp.name}`, 10, 15);
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 10px monospace';
      ctx.fillText('HP', 10, 31);
      ctx.fillStyle = '#334155';
      ctx.fillRect(30, 24, w - 110, 7);
      ctx.fillStyle = '#ec4899';
      ctx.fillRect(30, 24, Math.max(0, (activeBattle.opp.hp / activeBattle.opp.maxHp) * (w - 110)), 7);
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(`${Math.round(activeBattle.opp.hp)} / ${activeBattle.opp.maxHp}`, w - 74, 31);

      const topH = 40;
      const botH = 58;
      const midH = 26;
      const arenaH = Math.floor((h - topH - botH - midH) / 2);
      const midY = topH + arenaH;
      const botY = h - botH;

      drawSceneBg(ctx, 0, topH, w, arenaH, activeBattle.bgOpp, tick);
      const oppY = topH + Math.max(10, Math.floor((arenaH - 112) / 2));
      ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.beginPath(); ctx.ellipse(80, oppY + 102, 34, 9, 0, 0, Math.PI * 2); ctx.fill();
      const bColOpp = activeBattle.oppRow !== 0 ? (activeBattle.oppCol ?? f4) : f4;
      drawSpeciesSprite(ctx, activeBattle.opp.speciesId, activeBattle.oppRow, bColOpp, 24, topH + Math.max(10, Math.floor((arenaH - 112) / 2)), 112, 'right');

      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.moveTo(0, midY); ctx.lineTo(w, midY - 8); ctx.lineTo(w, midY + midH - 6); ctx.lineTo(0, midY + midH + 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, midY); ctx.lineTo(w, midY - 8);
      ctx.moveTo(0, midY + midH + 2); ctx.lineTo(w, midY + midH - 6);
      ctx.stroke();

      ctx.font = 'italic bold 14px monospace';
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.fillText('VS  交鋒', w / 2, midY + 15);
      ctx.textAlign = 'left';

      const myArenaY = midY + midH - 4;
      drawSceneBg(ctx, 0, myArenaY, w, botY - myArenaY, activeBattle.bgMe, tick);
      const meY = myArenaY + Math.max(8, Math.floor((botY - myArenaY - 112) / 2));
      ctx.fillStyle = 'rgba(0,0,0,0.42)'; ctx.beginPath(); ctx.ellipse(w - 80, meY + 102, 34, 9, 0, 0, Math.PI * 2); ctx.fill();
      const bColMe = activeBattle.myRow !== 0 ? (activeBattle.myCol ?? f4) : f4;
      drawSpeciesSprite(ctx, m.speciesId, activeBattle.myRow, bColMe, w - 136, myArenaY + Math.max(8, Math.floor((botY - myArenaY - 112) / 2)), 112, 'left');

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, botY, w, botH);
      ctx.font = 'bold 11.5px Inter, sans-serif';
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(`我方 · ${sp.id} ${m.customName}`, 10, botY + 17);
      ctx.font = 'bold 10.5px monospace';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText('HP', 10, botY + 33);
      ctx.fillStyle = '#334155';
      ctx.fillRect(30, botY + 26, w - 110, 7);
      ctx.fillStyle = '#2dd4bf';
      ctx.fillRect(30, botY + 26, Math.max(0, (m.currentHp / activeBattle.myMaxHp) * (w - 110)), 7);
      ctx.fillStyle = '#f8fafc';
      ctx.fillText(`${Math.round(m.currentHp)} / ${Math.round(eff.hp)}`, w - 74, botY + 33);

      ctx.font = 'bold 11.5px Inter, sans-serif';
      ctx.fillStyle = '#fde047';
      ctx.textAlign = 'center';
      ctx.fillText(lastHitBanner, w / 2, botY + 50);
      ctx.textAlign = 'left';

      // Render 2-stage horizontal screen-wrap fireballs aligned directly to monster mouth height
      const myStg = window.O2_DATA.SPECIES[m.speciesId]?.stage ?? 0;
      const oppSpObj = window.O2_DATA.SPECIES[activeBattle.opp.speciesId];
      const oppStg = oppSpObj ? oppSpObj.stage : 1;
      const topMouthX = 112;
      const topMouthY = oppY + (oppStg === 0 ? 74 : 66);
      const botMouthX = w - 114;
      const botMouthY = meY + (myStg === 0 ? 74 : 66);

      projectiles = projectiles.filter((pr) => pr.prog < 1);
      projectiles.forEach((pr) => {
        pr.prog = Math.min(1, pr.prog + pr.spd * speedMult);
        let px, py, tx, ty, clipY, clipH;
        if (pr.dir === 'meToOpp') {
          if (pr.prog < 0.5) {
            const p = pr.prog * 2;
            py = botMouthY;
            px = botMouthX + (-24 - botMouthX) * p;
            tx = Math.min(botMouthX, px + 52);
            ty = py;
            clipY = myArenaY; clipH = botY - myArenaY;
          } else {
            const p = (pr.prog - 0.5) * 2;
            py = topMouthY;
            px = (w + 24) + (80 - (w + 24)) * p;
            tx = px + 52;
            ty = py;
            clipY = topH; clipH = arenaH;
          }
        } else {
          if (pr.prog < 0.5) {
            const p = pr.prog * 2;
            py = topMouthY;
            px = topMouthX + ((w + 24) - topMouthX) * p;
            tx = Math.max(topMouthX, px - 52);
            ty = py;
            clipY = topH; clipH = arenaH;
          } else {
            const p = (pr.prog - 0.5) * 2;
            py = botMouthY;
            px = -24 + ((w - 80) - (-24)) * p;
            tx = px - 52;
            ty = py;
            clipY = myArenaY; clipH = botY - myArenaY;
          }
        }
        ctx.save();
        ctx.beginPath(); ctx.rect(0, clipY, w, clipH); ctx.clip();
        // Mouth ignition flash at launch
        if (pr.prog < 0.14) {
          const mx = pr.dir === 'meToOpp' ? botMouthX : topMouthX;
          const my = pr.dir === 'meToOpp' ? botMouthY : topMouthY;
          ctx.fillStyle = pr.core;
          ctx.beginPath(); ctx.arc(mx, my, pr.radius * 1.35, 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = pr.color;
        ctx.lineWidth = pr.radius * 1.35;
        ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(px, py); ctx.stroke();
        ctx.fillStyle = pr.core;
        ctx.beginPath(); ctx.arc(px, py, pr.radius * 0.72, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        if (Math.random() < 0.8) {
          particles.push({ x: px, y: py, vx: (Math.random()-0.5)*2.2, vy: (Math.random()-0.5)*2.2, size: 4, color: pr.color, life: 12 });
        }
        if (pr.prog >= 1) {
          spawnParticles(px, py, pr.color, 18);
          if (pr.onImpact) { const fn = pr.onImpact; pr.onImpact = null; fn(); }
        }
      });

      // Render pixel particles
      particles = particles.filter((p) => p.life > 0);
      particles.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.life -= 1;
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      });

      // Render floating damage numbers
      floatDamages = floatDamages.filter((fd) => fd.life > 0);
      floatDamages.forEach((fd) => {
        fd.y -= 0.45; fd.life -= 1;
        ctx.font = 'bold 14px monospace';
        ctx.fillStyle = '#000000';
        ctx.fillText(fd.txt, fd.x + 1, fd.y + 1);
        ctx.fillStyle = fd.color;
        ctx.fillText(fd.txt, fd.x, fd.y);
      });

      ctx.restore();
      return;
    }

    if (viewMode === 'status') {
      renderStatusScreen(ctx, w, h, tick);
      return;
    }
    if (viewMode === 'map') {
      window.O2_MAP.renderMapViewport(ctx, w, h, tick);
      return;
    }

    drawSceneBg(ctx, 0, 0, w, h - 54, eng.getState().activeSceneId || 'sakura', tick);

    const nowStr = new Date().toLocaleTimeString('zh-TW', { hour12: false, hour: '2-digit', minute: '2-digit' });
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillText(`${stg.name} · ${sp.element}系`, 11, 21);
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(`${stg.name} · ${sp.element}系`, 10, 20);
    ctx.textAlign = 'right';
    ctx.fillText(nowStr, w - 10, 20);
    ctx.textAlign = 'left';

    const spriteSize = 128;
    const centerX = Math.round((w - spriteSize) / 2);
    const spriteY = 182;

    if (m.sleeping) {
      drawSpeciesSprite(ctx, m.speciesId, 10, 2 + (Math.floor(tick / 36) % 2), centerX, spriteY, spriteSize, 'left');
      ctx.font = 'bold 13px monospace';
      ctx.fillStyle = '#fde047';
      ctx.fillText('Zzz...', w / 2 - 16, 68);
    } else if (animState.mode === 'flush') {
      drawSpeciesSprite(ctx, m.speciesId, 2, f4, centerX, spriteY, spriteSize, 'left');
      const prog = 1 - animState.timer / animState.maxTimer;
      drawSmoothWaterWave(ctx, w, h - 54, prog);
      animState.timer -= 1;
      if (animState.timer <= 0) animState.mode = 'idle';
    } else if (animState.mode !== 'idle') {
      drawSpeciesSprite(ctx, m.speciesId, animState.row, f4, centerX, spriteY, spriteSize, 'left');
      ctx.font = 'bold 13px Inter, sans-serif';
      ctx.fillStyle = '#fde047';
      ctx.textAlign = 'center';
      ctx.fillText(animState.text, w / 2, 56);
      ctx.textAlign = 'left';
      animState.timer -= 1;
      if (animState.timer <= 0) animState.mode = 'idle';
    } else {
      const row = m.poisoned ? 11 : 1;
      const walkX = Math.round(centerX + Math.sin(tick * 0.018) * 34);
      const facing = Math.cos(tick * 0.018) >= 0 ? 'right' : 'left';
      drawSpeciesSprite(ctx, m.speciesId, row, f4, walkX, spriteY, spriteSize, facing);

      for (let i = 0; i < m.poopCount; i++) {
        ctx.fillStyle = '#78350f';
        ctx.fillRect(w - 22 - i * 16, h - 72, 12, 12);
      }
      if (m.poisoned) {
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.fillStyle = '#e879f9';
        ctx.fillText('中毒狀態', 10, 44);
      }
    }

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, h - 54, w, 54);
    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.fillText(`O2-${sp.id} · ${m.customName} (親密 ${m.bond || 0})`, w / 2, h - 30);
    ctx.textAlign = 'left';

    ctx.font = '11px Inter, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(m.sleeping ? '保管休眠中' : (m.poisoned ? '異常中毒中' : '育成活動中'), 10, h - 10);
    ctx.textAlign = 'right';
    const hearts = Math.max(0, Math.min(4, Math.ceil(m.hunger / 25)));
    ctx.fillStyle = '#f8fafc';
    ctx.fillText('♥'.repeat(hearts) + '♡'.repeat(4 - hearts), w - 10, h - 10);
    ctx.textAlign = 'left';
  }

  return {
    drawSpeciesSprite,
    startAnimation,
    cancelAllAnimationsAndBattle,
    startAutoBattle,
    startMapPollutedBattle,
    stepBattle,
    render,
    setViewMode: (mode) => { viewMode = mode; },
    getViewMode: () => viewMode,
    isBattling: () => !!activeBattle,
    setPaused: (p) => { if (activeBattle) activeBattle.paused = p; },
    setSpeed: (s) => { speedMult = s; },
    getSpeed: () => speedMult,
    toggleStatusPage: () => { statusPage = statusPage === 0 ? 1 : 0; }
  };
})();
