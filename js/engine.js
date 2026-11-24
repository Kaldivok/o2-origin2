// O2《獸源》ORIGIN V2.2 — 核心引擎（G1~G4、4格裝備、戰後自動成長與進化）
window.O2_ENGINE = (() => {
  const SAVE_KEY = 'o2_origin_v22_save_state';
  const SCHEMA_VER = 5;

  function genUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function createMonster(speciesId = 'B1', ownerId = 'PLAYER_LOCAL') {
    const sp = window.O2_DATA.SPECIES[speciesId] || window.O2_DATA.SPECIES.B1;
    const iq = Math.round(78 + Math.random() * 52);
    const growth = Number((5.45 + Math.random() * (7.06 - 5.45)).toFixed(2));
    const jitter = () => Math.round((Math.random() - 0.5) * 4);
    const birthStats = {
      hp:  Math.max(5, sp.base.hp + jitter() * 2),
      att: Math.max(5, sp.base.att + jitter()),
      def: Math.max(5, sp.base.def + jitter()),
      agi: Math.max(5, sp.base.agi + jitter())
    };
    const now = Date.now();

    const m = {
      uuid: genUUID(),
      speciesId: sp.id,
      formId: sp.id,
      customName: sp.name,
      birthTime: now,
      birthStats: { ...birthStats },
      stats: { ...birthStats },
      equip: { weapon: null, armor: null, core: null, crest: null },
      iq,
      cp: 0,
      bond: 10,
      purifiedCount: 0,
      initialGrowth: growth,
      currentGrowth: growth,
      wins: 0,
      losses: 0,
      stamina: window.O2_DATA.CONFIG.maxStamina,
      staminaSpentSincePoop: 0,
      currentHp: birthStats.hp,
      hunger: 85,
      sleeping: false,
      poisoned: false,
      poopCount: 0,
      poopWarnSince: null,
      evoTime: now,
      evoHistory: [{ time: now, formId: sp.id, name: sp.name, type: '出生' }],
      ownerId,
      locked: false
    };
    m.cp = calcCP(m);
    return m;
  }

  function getZoneBuffs() {
    const purified = (typeof state !== 'undefined' && state && state.purifiedTiles) ? state.purifiedTiles : {};
    let plains = 0, lava = 0, waste = 0, sanctum = 0;
    Object.keys(purified).forEach((k) => {
      const [x, y] = k.split(',').map(Number);
      if (x < 50 && y < 50) plains++;
      else if (x >= 50 && y < 50) lava++;
      else if (x < 50 && y >= 50) waste++;
      else sanctum++;
    });
    return {
      dropBonus: plains >= 5 ? 0.15 : 0,
      attMult: lava >= 5 ? 1.10 : 1.0,
      agiMult: waste >= 5 ? 1.10 : 1.0,
      legendaryBoost: sanctum >= 5
    };
  }

  function getEffectiveStats(m) {
    const res = { hp: m.stats.hp, att: m.stats.att, def: m.stats.def, agi: m.stats.agi };
    if (m.equip) {
      Object.values(m.equip).forEach((gear) => {
        if (!gear || !gear.bonus) return;
        res.hp  += gear.bonus.hp  || 0;
        res.att += gear.bonus.att || 0;
        res.def += gear.bonus.def || 0;
        res.agi += gear.bonus.agi || 0;
      });
    }
    const zb = getZoneBuffs();
    res.att *= zb.attMult;
    res.agi *= zb.agiMult;
    return {
      hp: Math.round(res.hp * 10) / 10,
      att: Math.round(res.att * 10) / 10,
      def: Math.round(res.def * 10) / 10,
      agi: Math.round(res.agi * 10) / 10
    };
  }

  function calcCP(m) {
    const eff = getEffectiveStats(m);
    return Math.round(eff.hp * 0.45 + eff.att * 2.4 + eff.def * 2.1 + eff.agi * 2.0 + m.iq * 0.35 + (m.bond || 0) * 0.5);
  }

  // 戰後實戰成長（取代原本主頁面枯燥的文字訓練按鈕）
  function applyBattleGrowth(m, zoneLevel = 1) {
    const sp = window.O2_DATA.SPECIES[m.speciesId];
    const cap = window.O2_DATA.STAGES[sp.stage].cap;
    const gMult = 0.90 + ((m.currentGrowth - 5.45) / (7.06 - 5.45)) * 0.20;
    const gain = Number((0.45 * zoneLevel * gMult).toFixed(1));
    m.stats.hp  = Math.min(cap.hp,  Number((m.stats.hp  + gain * 2.0).toFixed(1)));
    m.stats.att = Math.min(cap.att, Number((m.stats.att + gain * 0.6).toFixed(1)));
    m.stats.def = Math.min(cap.def, Number((m.stats.def + gain * 0.5).toFixed(1)));
    m.stats.agi = Math.min(cap.agi, Number((m.stats.agi + gain * 0.6).toFixed(1)));
    m.cp = calcCP(m);
  }

  function rollGearDrop(zoneLevel = 1) {
    const rarities = window.O2_DATA.RARITIES;
    const bonusWeight = (zoneLevel - 1) * 14;
    const weights = rarities.map((r, i) => r.weight + (i >= 2 ? bonusWeight : 0));
    const totalW = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * totalW;
    let chosenR = rarities[0];
    for (let i = 0; i < rarities.length; i++) {
      roll -= weights[i];
      if (roll <= 0) { chosenR = rarities[i]; break; }
    }

    const slotKeys = Object.keys(window.O2_DATA.EQUIP_SLOTS);
    const slot = slotKeys[Math.floor(Math.random() * slotKeys.length)];
    const slotItems = window.O2_DATA.GEAR_CATALOG.filter((g) => g.slot === slot);
    const picked = slotItems[Math.floor(Math.random() * slotItems.length)];
    const baseName = picked.name;
    const mult = chosenR.mult * (1 + (zoneLevel - 1) * 0.35);

    const bonus = { hp: 0, att: 0, def: 0, agi: 0 };
    if (slot === 'weapon') {
      bonus.att = Math.max(2, Math.round((4 + Math.random() * 4) * mult));
      bonus.agi = Math.round((1 + Math.random() * 2) * mult);
    } else if (slot === 'armor') {
      bonus.def = Math.max(2, Math.round((4 + Math.random() * 4) * mult));
      bonus.hp  = Math.round((10 + Math.random() * 10) * mult);
    } else if (slot === 'core') {
      bonus.hp  = Math.max(8, Math.round((14 + Math.random() * 12) * mult));
      bonus.att = Math.round((2 + Math.random() * 2) * mult);
    } else {
      bonus.agi = Math.max(2, Math.round((4 + Math.random() * 4) * mult));
      bonus.def = Math.round((1 + Math.random() * 2) * mult);
    }

    const affixes = window.O2_DATA.GEAR_AFFIXES;
    const hasAffix = ['rare', 'epic', 'legendary'].includes(chosenR.id) || Math.random() < 0.25;
    const affix = hasAffix ? { ...affixes[Math.floor(Math.random() * affixes.length)] } : null;
    return {
      uuid: genUUID(),
      gearId: picked.id,
      baseName,
      slot,
      name: `${chosenR.name}・${baseName}`,
      rarityId: chosenR.id,
      rarityName: chosenR.name,
      color: chosenR.color,
      level: 0,
      affix,
      bonus
    };
  }

  function createInitialAccount() {
    const first = createMonster('B1');
    return {
      schemaVersion: SCHEMA_VER,
      playerId: 'PLAYER_LOCAL',
      coins: 200,
      monsters: [first],
      activeUuid: first.uuid,
      gearBag: [],
      bag: { burger: 4, energy_pill: 3, purify_med: 2 },
      warehouse: { burger: 2 },
      activeSkinId: 'dragon',
      activeSceneId: 'sakura',
      unlockedScenes: ['sakura'],
      activeShellId: 'origin_default',
      unlockedShells: ['origin_default'],
      redeemCodes: JSON.parse(JSON.stringify(window.O2_DATA.DEFAULT_REDEEM_CODES)),
      mapPos: { x: 24, y: 24 },
      purifiedTiles: {},
      openedChests: {},
      config: { ...window.O2_DATA.CONFIG }
    };
  }

  let state = null;
  state = createInitialAccount();

  const LEGACY_KEYS = ['o2_origin_v21_save_state', 'o2_origin_v2_save'];
  let storageBlocked = false;

  function testLocalStorage() {
    try {
      const k = '__o2_test__';
      localStorage.setItem(k, '1');
      localStorage.removeItem(k);
      storageBlocked = false;
      return true;
    } catch (_) {
      storageBlocked = true;
      return false;
    }
  }

  function idbOpen(cb) {
    try {
      if (typeof indexedDB === 'undefined') return;
      const req = indexedDB.open('O2_ORIGIN_DB', 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('saves')) db.createObjectStore('saves');
      };
      req.onsuccess = () => cb(req.result);
      req.onerror = () => {};
    } catch (_) {}
  }

  function idbSave(payload) {
    idbOpen((db) => {
      try {
        const tx = db.transaction('saves', 'readwrite');
        tx.objectStore('saves').put(payload, SAVE_KEY);
      } catch (_) {}
    });
  }

  function idbLoad(cb) {
    idbOpen((db) => {
      try {
        const tx = db.transaction('saves', 'readonly');
        const req = tx.objectStore('saves').get(SAVE_KEY);
        req.onsuccess = () => { if (req.result) cb(req.result); };
      } catch (_) {}
    });
  }

  function applyParsedState(parsed) {
    if (!parsed || !Array.isArray(parsed.monsters) || parsed.monsters.length === 0) return false;
    const base = createInitialAccount();
    state = { ...base, ...parsed, schemaVersion: SCHEMA_VER };
    if (!Array.isArray(state.gearBag)) state.gearBag = [];
    if (!state.unlockedScenes || state.unlockedScenes.length === 0) state.unlockedScenes = ['sakura'];
    if (!state.activeSceneId) state.activeSceneId = 'sakura';
    if (!state.mapPos) state.mapPos = { x: 24, y: 24 };
    if (!state.purifiedTiles) state.purifiedTiles = {};
    if (!state.openedChests) state.openedChests = {};
    state.config = { ...window.O2_DATA.CONFIG, ...(state.config || {}), battleCost: 1 };
    state.monsters.forEach((mon) => {
      if (!window.O2_DATA.SPECIES[mon.speciesId]) { mon.speciesId = 'B1'; mon.formId = 'B1'; }
      if (!mon.equip || typeof mon.equip !== 'object') {
        mon.equip = { weapon: null, armor: null, core: null, crest: null };
      } else {
        ['weapon', 'armor', 'core', 'crest'].forEach((sk) => {
          if (mon.equip[sk] === undefined) mon.equip[sk] = null;
        });
      }
      mon.cp = calcCP(mon);
    });
    return true;
  }

  function load() {
    testLocalStorage();
    let raw = null;
    try {
      raw = localStorage.getItem(SAVE_KEY);
      if (!raw) {
        for (const lk of LEGACY_KEYS) {
          raw = localStorage.getItem(lk);
          if (raw) break;
        }
      }
    } catch (_) {
      storageBlocked = true;
    }
    if (!raw && typeof window !== 'undefined' && window.name && window.name.startsWith('O2_SAVE:')) {
      raw = window.name.slice(8);
    }
    if (raw) {
      try {
        if (applyParsedState(JSON.parse(raw))) {
          save();
          return;
        }
      } catch (_) {}
    }
    // 若 localStorage 無資料，嘗試從 IndexedDB 非同步還原
    idbLoad((idbRaw) => {
      try {
        if (applyParsedState(JSON.parse(idbRaw))) {
          save();
          if (window.O2_UI && window.O2_UI.renderUI) window.O2_UI.renderUI();
        }
      } catch (_) {}
    });
  }

  function save() {
    const payload = JSON.stringify(state);
    try { localStorage.setItem(SAVE_KEY, payload); } catch (_) { storageBlocked = true; }
    idbSave(payload);
    try {
      if (typeof window !== 'undefined' && payload.length < 1500000) {
        window.name = 'O2_SAVE:' + payload;
      }
    } catch (_) {}
  }

  function exportSaveCode() {
    const json = JSON.stringify(state);
    const bytes = new TextEncoder().encode(json);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return 'O2SAVE:' + btoa(bin);
  }

  function importSaveCode(rawStr) {
    try {
      const s = (rawStr || '').trim();
      if (!s) return { ok: false, msg: '請貼上存檔碼或 JSON 內容' };
      let json = s;
      if (s.startsWith('O2SAVE:')) {
        const bin = atob(s.slice(7));
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        json = new TextDecoder().decode(bytes);
      }
      const parsed = JSON.parse(json);
      if (!applyParsedState(parsed)) return { ok: false, msg: '存檔格式不正確或無怪獸資料' };
      save();
      return { ok: true, msg: `成功還原存檔！(持有 ${state.monsters.length} 隻怪獸 · ${state.coins} 源幣)` };
    } catch (_) {
      return { ok: false, msg: '存檔碼解析失敗，請確認內容是否完整' };
    }
  }

  function getActiveMonster() {
    return state.monsters.find((m) => m.uuid === state.activeUuid) || state.monsters[0];
  }

  function spendStamina(m, amount) {
    m.stamina = Math.max(0, m.stamina - amount);
    m.hunger = Math.max(0, (m.hunger ?? 85) - 4);
    m.staminaSpentSincePoop += amount;
    if (m.staminaSpentSincePoop >= state.config.poopEveryStamina || Math.random() < 0.05) {
      if (m.staminaSpentSincePoop >= state.config.poopEveryStamina) m.staminaSpentSincePoop = 0;
      m.poopCount = Math.min(6, m.poopCount + 1);
      if (m.poopCount >= 2 && !m.poopWarnSince) m.poopWarnSince = Date.now();
    }
  }

  function getEvoStatus(m) {
    const sp = window.O2_DATA.SPECIES[m.speciesId];
    if (!sp || !sp.evoBranches || sp.evoBranches.length === 0) {
      return { canEvo: false, branch: null, checks: [], branches: [], readyBranches: [] };
    }
    const eff = getEffectiveStats(m);
    const branches = sp.evoBranches.map((br) => {
      const req = br.req || {};
      const checks = [];
      if (req.wins !== undefined)     checks.push({ label: '勝場', cur: m.wins, need: req.wins, ok: m.wins >= req.wins });
      if (req.bond !== undefined)     checks.push({ label: '親密', cur: m.bond || 0, need: req.bond, ok: (m.bond || 0) >= req.bond });
      if (req.purified !== undefined) checks.push({ label: '淨化', cur: m.purifiedCount || 0, need: req.purified, ok: (m.purifiedCount || 0) >= req.purified });
      if (req.cp !== undefined)       checks.push({ label: '戰力', cur: m.cp, need: req.cp, ok: m.cp >= req.cp });
      if (req.att !== undefined)      checks.push({ label: 'ATT',  cur: Math.round(eff.att), need: req.att, ok: eff.att >= req.att });
      if (req.def !== undefined)      checks.push({ label: 'DEF',  cur: Math.round(eff.def), need: req.def, ok: eff.def >= req.def });
      if (req.agi !== undefined)      checks.push({ label: 'AGI',  cur: Math.round(eff.agi), need: req.agi, ok: eff.agi >= req.agi });
      if (req.iq !== undefined)       checks.push({ label: 'IQ',   cur: m.iq, need: req.iq, ok: m.iq >= req.iq });
      if (req.itemId !== undefined) {
        const have = state.bag[req.itemId] || 0;
        const sName = (window.O2_DATA.ITEMS[req.itemId]?.name || '碎片').slice(0, 4);
        checks.push({ label: sName, cur: have, need: req.itemQty, ok: have >= req.itemQty });
      }
      return { branch: br, checks, canEvo: checks.every((c) => c.ok) };
    });
    const readyBranches = branches.filter((b) => b.canEvo);
    const primary = readyBranches[0] || branches[0];
    return {
      canEvo: readyBranches.length > 0,
      branch: primary.branch,
      checks: primary.checks,
      branches,
      readyBranches
    };
  }

  function triggerNormalEvolution(ignoreChecks = false, targetSpeciesId = null) {
    const m = getActiveMonster();
    const st = getEvoStatus(m);
    if (!st.branches || st.branches.length === 0) return { evolved: false, msg: '已達目前最高成長期分支！' };
    let chosen = null;
    if (targetSpeciesId) {
      chosen = st.branches.find((b) => b.branch.target === targetSpeciesId);
      if (!chosen) return { evolved: false, msg: '無效的進化分支' };
      if (!ignoreChecks && !chosen.canEvo) {
        const missing = chosen.checks.filter((c) => !c.ok).map((c) => `${c.label} ${c.cur}/${c.need}`).join(' / ');
        return { evolved: false, msg: `尚缺：${missing}` };
      }
    } else {
      if (!ignoreChecks && st.readyBranches.length === 0) {
        const missing = st.checks.filter((c) => !c.ok).map((c) => `${c.label} ${c.cur}/${c.need}`).join(' / ');
        return { evolved: false, msg: `尚未滿足任一分支條件 (${st.branch.label} 尚缺：${missing})` };
      }
      chosen = st.readyBranches[0] || st.branches[0];
    }
    const req = chosen.branch.req || {};
    if (!ignoreChecks && req.itemId && req.itemQty) {
      state.bag[req.itemId] = Math.max(0, (state.bag[req.itemId] || 0) - req.itemQty);
      if (state.bag[req.itemId] <= 0) delete state.bag[req.itemId];
    }
    const nextSp = window.O2_DATA.SPECIES[chosen.branch.target];
    const prevSp = window.O2_DATA.SPECIES[m.speciesId];
    m.speciesId = nextSp.id;
    m.formId = nextSp.id;
    if (m.customName === prevSp.name) m.customName = nextSp.name;
    m.stats.hp = Math.max(m.stats.hp, nextSp.base.hp);
    m.stats.att = Math.max(m.stats.att, nextSp.base.att);
    m.stats.def = Math.max(m.stats.def, nextSp.base.def);
    m.stats.agi = Math.max(m.stats.agi, nextSp.base.agi);
    m.currentHp = getEffectiveStats(m).hp;
    m.evoTime = Date.now();
    m.evoHistory.push({ time: Date.now(), formId: nextSp.id, name: nextSp.name, type: '分支進化' });
    m.cp = calcCP(m);
    save();
    return { evolved: true, nextSp };
  }

  function getAffixSummary(m) {
    const sum = { vamp: 0, crit: 0, thorns: 0, dodge: 0, haste: 0, pierce: 0 };
    if (m && m.equip) {
      Object.values(m.equip).forEach((g) => {
        if (g && g.affix && sum[g.affix.key] !== undefined) {
          sum[g.affix.key] += g.affix.val;
        }
      });
    }
    return sum;
  }

  function enhanceEquippedGear(slot) {
    const m = getActiveMonster();
    const g = m.equip && m.equip[slot];
    if (!g) return { ok: false, msg: '該欄位尚未裝備道具' };
    const lv = g.level || 0;
    if (lv >= 5) return { ok: false, msg: '已達最高強化等級 (+5)' };
    const costs = [40, 80, 120, 160, 220];
    const rates = [1.0, 0.90, 0.75, 0.60, 0.45];
    const cost = costs[lv];
    if (state.coins < cost) return { ok: false, msg: `源幣不足 (需要 ${cost})` };
    state.coins -= cost;
    if (Math.random() < rates[lv]) {
      g.level = lv + 1;
      m.currentHp = getEffectiveStats(m).hp;
      m.cp = calcCP(m);
      save();
      return { ok: true, success: true, msg: `強化成功！【${g.name}】升至 +${g.level}` };
    }
    save();
    return { ok: true, success: false, msg: `強化失敗（裝備未損壞，消耗 ${cost} 源幣）` };
  }

  function reforgeEquippedGear(slot) {
    const m = getActiveMonster();
    const g = m.equip && m.equip[slot];
    if (!g) return { ok: false, msg: '該欄位尚未裝備道具' };
    const cost = 45;
    if (state.coins < cost) return { ok: false, msg: `源幣不足 (需要 ${cost})` };
    state.coins -= cost;
    const pool = window.O2_DATA.GEAR_AFFIXES;
    const prevKey = g.affix ? g.affix.key : null;
    const choices = pool.filter((a) => a.key !== prevKey);
    const picked = choices[Math.floor(Math.random() * choices.length)] || pool[0];
    g.affix = { ...picked };
    g.affixTier = 1;
    save();
    return { ok: true, msg: `重鑄成功！獲得詞綴 [${picked.name}]` };
  }

  function refineEquippedGear(slot) {
    const m = getActiveMonster();
    const g = m.equip && m.equip[slot];
    if (!g) return { ok: false, msg: '該欄位尚未裝備道具' };
    if (!g.affix) return { ok: false, msg: '請先重鑄出詞綴再進行精煉' };
    const tier = g.affixTier || 1;
    if (tier >= 3) return { ok: false, msg: '該詞綴已精煉至最高階 (III)' };
    const cost = tier === 1 ? 180 : 360;
    if (state.coins < cost) return { ok: false, msg: `源幣不足 (需要 ${cost})` };
    state.coins -= cost;
    const baseDef = window.O2_DATA.GEAR_AFFIXES.find((a) => a.key === g.affix.key) || g.affix;
    g.affixTier = tier + 1;
    const mult = g.affixTier === 2 ? 1.35 : 1.7;
    g.affix.val = Number((baseDef.val * mult).toFixed(3));
    const pct = Math.round(g.affix.val * 100);
    g.affix.name = `${baseDef.name.slice(0, 2)} +${pct}%`;
    save();
    return { ok: true, msg: `詞綴精煉成功！[${g.affix.name}] (階級 ${g.affixTier}/3)` };
  }

  function awakenMonsterGene(uuid) {
    const mon = state.monsters.find((x) => x.uuid === uuid) || getActiveMonster();
    if (!mon) return { ok: false, msg: '找不到個體' };
    if (mon.currentGrowth >= 7.06 && mon.iq >= 135) return { ok: false, msg: '該個體基因成長率與 IQ 已達完美上限！' };
    const cost = 150;
    if (state.coins < cost) return { ok: false, msg: `源幣不足 (需要 ${cost})` };
    state.coins -= cost;
    const oldG = mon.currentGrowth;
    const oldIq = mon.iq;
    mon.currentGrowth = Math.min(7.06, Number((mon.currentGrowth + 0.08 + Math.random() * 0.08).toFixed(2)));
    mon.iq = Math.min(135, mon.iq + 2 + Math.floor(Math.random() * 3));
    mon.cp = calcCP(mon);
    save();
    return { ok: true, msg: `基因激發！成長 ${oldG.toFixed(2)}→${mon.currentGrowth.toFixed(2)} · IQ ${oldIq}→${mon.iq}` };
  }

  function equipGear(gearUuid) {
    const m = getActiveMonster();
    const idx = state.gearBag.findIndex((g) => g.uuid === gearUuid);
    if (idx === -1) return { ok: false, msg: '找不到裝備' };
    const gear = state.gearBag[idx];
    state.gearBag.splice(idx, 1);
    if (m.equip[gear.slot]) state.gearBag.push(m.equip[gear.slot]);
    m.equip[gear.slot] = gear;
    m.currentHp = getEffectiveStats(m).hp;
    m.cp = calcCP(m);
    save();
    return { ok: true };
  }

  function unequipSlot(slot) {
    const m = getActiveMonster();
    if (!m.equip[slot]) return;
    state.gearBag.push(m.equip[slot]);
    m.equip[slot] = null;
    m.currentHp = Math.min(m.currentHp, getEffectiveStats(m).hp);
    m.cp = calcCP(m);
    save();
  }

  function dismantleGear(gearUuid) {
    const idx = state.gearBag.findIndex((g) => g.uuid === gearUuid);
    if (idx === -1) return 0;
    const gear = state.gearBag[idx];
    state.gearBag.splice(idx, 1);
    const val = gear.rarityId === 'legendary' ? 65 : (gear.rarityId === 'epic' ? 35 : (gear.rarityId === 'rare' ? 18 : (gear.rarityId === 'uncommon' ? 10 : 6)));
    state.coins += val;
    save();
    return val;
  }

  function dismantleLowRarity() {
    let total = 0, count = 0;
    state.gearBag = state.gearBag.filter((g) => {
      if (g.rarityId === 'common' || g.rarityId === 'uncommon') {
        total += g.rarityId === 'uncommon' ? 10 : 6;
        count++;
        return false;
      }
      return true;
    });
    if (count > 0) {
      state.coins += total;
      save();
    }
    return { count, total };
  }

  function useBagItem(itemId) {
    const qty = state.bag[itemId] || 0;
    if (qty <= 0) return { ok: false, msg: '背包數量不足' };
    const item = window.O2_DATA.ITEMS[itemId];
    const m = getActiveMonster();
    const sp = window.O2_DATA.SPECIES[m.speciesId];

    if (itemId === 'burger') {
      if ((m.hunger ?? 85) >= 100) return { ok: false, msg: '目前已經吃飽了，不需要進食' };
      m.hunger = Math.min(100, (m.hunger ?? 85) + 35);
      m.bond = Math.min(100, (m.bond || 0) + 3);
      state.bag[itemId] -= 1;
    } else if (itemId === 'energy_pill') {
      m.stamina = Math.min(state.config.maxStamina, m.stamina + 50);
      state.bag[itemId] -= 1;
    } else if (itemId === 'purify_med') {
      if (!m.poisoned) return { ok: false, msg: '目前健康無中毒' };
      m.poisoned = false; m.poopWarnSince = null;
      state.bag[itemId] -= 1;
    } else if (item.dropOnly) {
      return { ok: false, msg: '此為進化素材，請於滿足條件後點擊 ✦ 進化' };
    }

    if (state.bag[itemId] <= 0) delete state.bag[itemId];
    m.cp = calcCP(m);
    save();
    return { ok: true, itemId };
  }

  function transferItem(itemId, toWarehouse) {
    const src = toWarehouse ? state.bag : state.warehouse;
    const dst = toWarehouse ? state.warehouse : state.bag;
    if (!src[itemId] || src[itemId] <= 0) return false;
    src[itemId] -= 1;
    if (src[itemId] <= 0) delete src[itemId];
    dst[itemId] = (dst[itemId] || 0) + 1;
    save();
    return true;
  }

  function buyItem(itemId) {
    const item = window.O2_DATA.ITEMS[itemId];
    if (!item || item.dropOnly) return { ok: false, msg: '進化碎片僅限冒險戰鬥掉落' };
    if (state.coins < item.price) return { ok: false, msg: '源幣不足' };
    state.coins -= item.price;
    state.bag[itemId] = (state.bag[itemId] || 0) + 1;
    save();
    return { ok: true };
  }

  function redeemCode(codeStr) {
    const code = codeStr.trim().toUpperCase();
    const entry = state.redeemCodes[code];
    if (!entry) return { ok: false, msg: '無效兌換碼' };
    if (entry.used) return { ok: false, msg: '已使用過' };
    entry.used = true;
    state.bag[entry.itemId] = (state.bag[entry.itemId] || 0) + entry.qty;
    const itemName = window.O2_DATA.ITEMS[entry.itemId]?.name || entry.itemId;
    save();
    return { ok: true, msg: `獲得 ${itemName} x${entry.qty}` };
  }

  function buyScene(sceneId) {
    const sc = window.O2_DATA.SCENES.find((s) => s.id === sceneId);
    if (!sc) return { ok: false, msg: '找不到場景' };
    if (state.unlockedScenes.includes(sceneId)) {
      state.activeSceneId = sceneId;
      save();
      return { ok: true, msg: `已切換場景為【${sc.name}】` };
    }
    if (state.coins < sc.price) return { ok: false, msg: `源幣不足 (需要 ${sc.price})` };
    state.coins -= sc.price;
    state.unlockedScenes.push(sceneId);
    state.activeSceneId = sceneId;
    save();
    return { ok: true, msg: `購買並套用場景【${sc.name}】！` };
  }

  function equipScene(sceneId) {
    if (!state.unlockedScenes.includes(sceneId)) return false;
    state.activeSceneId = sceneId;
    save();
    return true;
  }

  load();

  return {
    getState: () => state,
    getActiveMonster,
    getZoneBuffs,
    getEffectiveStats,
    createMonster,
    calcCP,
    applyBattleGrowth,
    spendStamina,
    getEvoStatus,
    triggerNormalEvolution,
    rollGearDrop,
    getAffixSummary,
    enhanceEquippedGear,
    reforgeEquippedGear,
    refineEquippedGear,
    awakenMonsterGene,
    equipGear,
    unequipSlot,
    dismantleGear,
    dismantleLowRarity,
    useBagItem,
    transferItem,
    buyItem,
    buyScene,
    
    equipScene,
    redeemCode,
    exportSaveCode,
    importSaveCode,
    isStorageBlocked: () => storageBlocked,
    save
  };
})();
