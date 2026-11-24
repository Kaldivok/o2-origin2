// O2《獸源》ORIGIN V2.3 — 乾淨還原版 UI 控制器
window.O2_UI = (() => {
  let activeDock = 'machine';
  let topIconIdx = 0;
  let tick = 0;
  let lastTime = performance.now();
  let confirmCallback = null;
  let aiChainEnabled = false;
  let mapAutoEnabled = false;

  const canvas = document.getElementById('lcdCanvas');
  const ctx = canvas.getContext('2d');
  let LOGICAL_W = 360;
  let LOGICAL_H = 440;
  const DPR = Math.min(3, Math.max(2, window.devicePixelRatio || 2));
  canvas.width = LOGICAL_W * DPR;
  canvas.height = LOGICAL_H * DPR;
  const IC = window.O2_ICONS;

  function initStaticIcons() {
    const topIcons = [
      { idx: 0, icon: IC.heart(),   title: '能力' },
      { idx: 1, icon: IC.food(),    title: '餵食' },
      { idx: 2, icon: IC.sword(),   title: '對戰' },
      { idx: 3, icon: IC.map(),     title: '冒險' },
      { idx: 4, icon: IC.water(),   title: '清潔' },
      { idx: 5, icon: IC.moon(),    title: '睡眠' },
      { idx: 6, icon: IC.sparkle(), title: '進化' }
    ];
    document.getElementById('lcdIconStrip').innerHTML = topIcons.map((t) =>
      `<button data-icon="${t.idx}" class="lcd-top-icon ${t.idx === 0 ? 'active' : ''}" title="${t.title}">${t.icon}</button>`
    ).join('');

    const dockItems = [
      { id: 'machine', icon: IC.machine(), label: '機台' },
      { id: 'map',     icon: IC.map(),     label: '冒險' },
      { id: 'equip',   icon: IC.equip(),   label: '裝備' },
      { id: 'dex',     icon: IC.dex(),     label: '圖鑑' },
      { id: 'shop',    icon: IC.shop(),    label: '商城' }
    ];
    document.getElementById('bottomDock').innerHTML = dockItems.map((d) =>
      `<button data-dock="${d.id}" class="dock-btn ${d.id === 'machine' ? 'active' : ''}">${d.icon}<span>${d.label}</span></button>`
    ).join('');


  }

  function showToast(msg) {
    const el = document.getElementById('toastBox');
    el.textContent = msg;
    el.classList.remove('hidden');
    clearTimeout(el._tid);
    el._tid = setTimeout(() => el.classList.add('hidden'), 2200);
  }

  function openConfirm(title, body, onOk) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').textContent = body;
    confirmCallback = onOk;
    document.getElementById('modalOverlay').classList.remove('hidden');
  }

  document.getElementById('modalCancelBtn').addEventListener('click', () => {
    confirmCallback = null;
    document.getElementById('modalOverlay').classList.add('hidden');
  });
  document.getElementById('modalConfirmBtn').addEventListener('click', () => {
    const cb = confirmCallback;
    confirmCallback = null;
    document.getElementById('modalOverlay').classList.add('hidden');
    if (cb) cb();
  });

  function syncCanvasSize() {
    if (activeDock === 'map') {
      const wrap = canvas.parentElement;
      const rect = wrap.getBoundingClientRect();
      if (rect.width > 100 && rect.height > 100) {
        LOGICAL_W = Math.round(rect.width);
        LOGICAL_H = Math.round(rect.height);
      } else {
        LOGICAL_W = 390;
        LOGICAL_H = 540;
      }
    } else {
      LOGICAL_W = 360;
      LOGICAL_H = 440;
    }
    const targetW = Math.round(LOGICAL_W * DPR);
    const targetH = Math.round(LOGICAL_H * DPR);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
  }

  function switchDock(name) {
    activeDock = name;
    const isMap = name === 'map';
    if (!isMap) mapAutoEnabled = false;
    document.body.classList.toggle('ro-map-mode', isMap);
    document.querySelector('.cyber-shell').classList.toggle('map-fullscreen', isMap);
    window.O2_BATTLE.setViewMode(isMap ? 'map' : 'machine');
    document.querySelectorAll('.dock-btn').forEach((b) => b.classList.toggle('active', b.dataset.dock === name));
    document.querySelectorAll('.dock-panel').forEach((p) => p.classList.toggle('hidden', p.id !== `dock-${name}`));
    requestAnimationFrame(syncCanvasSize);
    renderUI();
  }

  window.addEventListener('resize', () => { if (activeDock === 'map') syncCanvasSize(); });

  function setTopIcon(idx) {
    topIconIdx = ((idx % 7) + 7) % 7;
    document.querySelectorAll('.lcd-top-icon').forEach((b) => b.classList.toggle('active', Number(b.dataset.icon) === topIconIdx));
  }

  function executeTopIcon(idx) {
    const eng = window.O2_ENGINE;
    const m = eng.getActiveMonster();
    if (idx === 0) {
      const cur = window.O2_BATTLE.getViewMode();
      window.O2_BATTLE.setViewMode(cur === 'status' ? 'machine' : 'status');
    } else if (idx === 1) {
      const res = eng.useBagItem('burger');
      if (res.ok) window.O2_BATTLE.startAnimation('eat', '大口吃漢堡!', 9, 96);
      else showToast(res.msg);
    } else if (idx === 2) {
      if (window.O2_BATTLE.isBattling()) window.O2_BATTLE.cancelAllAnimationsAndBattle();
      else {
        const res = window.O2_BATTLE.startAutoBattle(aiChainEnabled);
        if (!res.ok) showToast(res.msg);
      }
    } else if (idx === 3) {
      switchDock('map');
    } else if (idx === 4) {
      m.poopCount = 0; m.poopWarnSince = null;
      window.O2_BATTLE.startAnimation('flush', '水流沖洗中', 2, 96);
      eng.save();
    } else if (idx === 5) {
      m.sleeping = !m.sleeping;
      eng.save();
    } else if (idx === 6) {
      const evoSt = eng.getEvoStatus(m);
      if (evoSt.readyBranches && evoSt.readyBranches.length > 1) {
        const branchBtns = evoSt.readyBranches.map((brObj) =>
          `<button data-evotarget="${brObj.branch.target}" class="action-btn primary w-full justify-between px-3 py-1.5 text-xs"><span>${brObj.branch.label}</span><span class="text-[10px] text-cyan-200">${brObj.branch.route}</span></button>`
        ).join('');
        document.getElementById('modalTitle').textContent = '選擇成長期進化分支';
        document.getElementById('modalBody').innerHTML = `<div class="space-y-1.5"><p class="text-[11px] text-slate-300 mb-2">B1 已同時滿足多個分支條件，請選擇進化形態：</p>${branchBtns}</div>`;
        confirmCallback = null;
        document.getElementById('modalOverlay').classList.remove('hidden');
      } else {
        const res = eng.triggerNormalEvolution(false);
        if (res.evolved) window.O2_BATTLE.startAnimation('evo', `進化為 ${res.nextSp.name}!`, 4, 110);
        else showToast(res.msg);
      }
    }
    renderUI();
  }

  function renderUI() {
    const eng = window.O2_ENGINE;
    const state = eng.getState();
    const m = eng.getActiveMonster();

    document.getElementById('hdrCoins').textContent = state.coins;

    const btnAi = document.getElementById('btnAiChain');
    const battling = window.O2_BATTLE.isBattling();
    btnAi.classList.toggle('active', aiChainEnabled || battling);
    btnAi.textContent = battling ? '停止對戰' : (aiChainEnabled ? 'AI 連戰:開' : 'AI 連戰');

    const btnSpd = document.getElementById('btnSpeed2x');
    const spd = window.O2_BATTLE.getSpeed();
    btnSpd.classList.toggle('active', spd === 2);
    btnSpd.textContent = `速度 ×${spd}`;

    const eff = eng.getEffectiveStats(m);
    const hudOverlay = document.getElementById('mapHudOverlay');
    if (hudOverlay) hudOverlay.classList.toggle('hidden', activeDock !== 'map' || battling);
    document.getElementById('mapPurifiedCount').textContent = `已淨化 ${m.purifiedCount || 0}`;
    const btnMapAuto = document.getElementById('btnMapAuto');
    if (btnMapAuto) {
      btnMapAuto.classList.toggle('active', mapAutoEnabled);
      btnMapAuto.textContent = mapAutoEnabled ? 'AUTO:開' : 'AUTO 巡邏';
    }
    const hpPct = Math.max(0, Math.min(100, Math.round((m.currentHp / eff.hp) * 100)));
    const stamPct = Math.max(0, Math.min(100, Math.round((m.stamina / state.config.maxStamina) * 100)));
    document.getElementById('mapHpText').textContent = `${Math.round(m.currentHp)}/${eff.hp}`;
    document.getElementById('mapHpFill').style.width = `${hpPct}%`;
    document.getElementById('mapStamText').textContent = `${m.stamina}/${state.config.maxStamina}`;
    document.getElementById('mapStamFill').style.width = `${stamPct}%`;
    const quickIds = ['burger', 'energy_pill', 'purify_med'];
    document.getElementById('mapQuickBar').innerHTML = quickIds.map((id) => {
      const it = window.O2_DATA.ITEMS[id];
      const cnt = state.bag[id] || 0;
      return `<button data-use="${id}" class="quick-slot-btn ${cnt === 0 ? 'opacity-45' : ''}">
        <span class="text-[10px] font-bold truncate max-w-full">${it.name.slice(0, 4)}</span>
        <span class="mono text-[10px] text-amber-300">x${cnt}</span>
      </button>`;
    }).join('');

    const affSum = eng.getAffixSummary ? eng.getAffixSummary(m) : {};
    const affTags = window.O2_DATA.GEAR_AFFIXES.filter((a) => affSum[a.key] > 0).map((a) => `${a.name.slice(0,2)}+${Math.round(affSum[a.key]*100)}%`);
    const forgeCosts = [40, 80, 120, 160, 220];
    document.getElementById('equipSlotsGrid').innerHTML = Object.values(window.O2_DATA.EQUIP_SLOTS).map((slotDef) => {
      const eq = m.equip[slotDef.id];
      const iconHtml = IC[slotDef.icon]();
      if (!eq) {
        return `<div class="p-2 rounded-lg bg-slate-900/80 border border-dashed border-slate-700 text-[11px] flex items-center gap-2 text-slate-500">
          ${iconHtml}
          <div><div class="font-bold">${slotDef.name}</div><div class="text-[9px]">空欄位</div></div>
        </div>`;
      }
      const lv = eq.level || 0;
      const lvMult = 1 + lv * 0.18;
      const statStr = Object.entries(eq.bonus).filter(([, v]) => v > 0).map(([k, v]) => `${k.toUpperCase()}+${Math.round(v * lvMult)}`).join(' ');
      const affStr = eq.affix ? `<span class="text-[9px] text-fuchsia-300 font-bold">[${eq.affix.name}]</span>` : `<span class="text-[9px] text-slate-500">[無詞綴]</span>`;
      const enhBtn = lv >= 5 ? '<span class="text-[9px] text-amber-300 font-bold">已滿級</span>' : `<button data-enhance="${slotDef.id}" class="action-btn primary px-1.5 py-0.5 text-[9px]">強化(${forgeCosts[lv]})</button>`;
      const refTier = eq.affixTier || 1;
      const refineBtn = (!eq.affix || refTier >= 3) ? '' : `<button data-refine="${slotDef.id}" class="action-btn px-1.5 py-0.5 text-[9px] text-amber-300">精煉(${refTier === 1 ? 180 : 360})</button>`;
      return `<div class="p-2 rounded-lg bg-slate-800/90 border border-slate-600 text-[11px] space-y-1">
        <div class="flex items-center justify-between gap-1">
          <span class="font-bold truncate" style="color:${eq.color}">${eq.name}${lv > 0 ? ` +${lv}` : ''}</span>
          <button data-unequip="${slotDef.id}" class="action-btn px-1.5 py-0.5 text-[9px]">卸下</button>
        </div>
        <div class="mono text-[9px] text-emerald-300">${statStr}</div>
        <div class="flex items-center justify-between gap-1 pt-0.5">
          ${affStr}
          <div class="flex gap-1 flex-wrap justify-end">${enhBtn}${refineBtn}<button data-reforge="${slotDef.id}" class="action-btn px-1.5 py-0.5 text-[9px] text-fuchsia-300">重鑄(45)</button></div>
        </div>
      </div>`;
    }).join('') + (affTags.length > 0 ? `<div class="col-span-2 text-[10px] text-fuchsia-300 bg-fuchsia-950/30 border border-fuchsia-500/30 rounded-lg px-2 py-1">套裝詞綴總計：${affTags.join(' · ')}</div>` : '');

    document.getElementById('gearBagList').innerHTML = state.gearBag.length === 0
      ? '<div class="text-[11px] text-slate-500">進行對戰或冒險地圖可隨機獲得裝備</div>'
      : state.gearBag.map((g) => {
        const statStr = Object.entries(g.bonus).filter(([, v]) => v > 0).map(([k, v]) => `${k.toUpperCase()}+${v}`).join(' ');
        return `<div class="flex items-center justify-between gap-2 bg-slate-900/85 p-2 rounded-xl text-[11px] border" style="border-color:${g.color}55">
          <div>
            <span class="font-bold" style="color:${g.color}">${g.name}${g.level > 0 ? ` +${g.level}` : ""}</span>${g.affix ? ` <span class="text-[9px] text-fuchsia-300">[${g.affix.name}]</span>` : ""}
            <div class="mono text-[9px] text-emerald-300">${statStr}</div>
          </div>
          <div class="flex gap-1">
            <button data-equip="${g.uuid}" class="action-btn primary px-2 py-1 text-[10px]">裝備</button>
            <button data-dismantle="${g.uuid}" class="action-btn danger px-2 py-1 text-[10px]">分解</button>
          </div>
        </div>`;
      }).join('');

    const unlocked = state.unlockedScenes || ['sakura'];
    const activeSc = state.activeSceneId || 'sakura';
    document.getElementById('sceneShopList').innerHTML = window.O2_DATA.SCENES.map((sc) => {
      const owned = unlocked.includes(sc.id);
      const isEq = activeSc === sc.id;
      const btnHtml = isEq
        ? `<span class="mono text-[10px] font-bold text-cyan-300">使用中</span>`
        : (owned
            ? `<button data-buyscene="${sc.id}" class="action-btn primary px-2 py-0.5 text-[10px]">套用</button>`
            : `<button data-buyscene="${sc.id}" class="action-btn px-2 py-0.5 text-[10px] text-amber-300">${sc.price}幣</button>`);
      return `<div class="rounded-xl overflow-hidden border ${isEq ? 'border-cyan-400' : 'border-slate-700'} bg-slate-900/80 flex flex-col">
        <img src="${sc.img}" alt="${sc.name}" class="w-full h-14 object-cover" />
        <div class="p-1.5 flex items-center justify-between gap-1">
          <div class="text-[10px] font-bold text-white truncate">${sc.name}</div>
          ${btnHtml}
        </div>
      </div>`;
    }).join('');

    document.getElementById('shopList').innerHTML = Object.values(window.O2_DATA.ITEMS).filter((it) => !it.dropOnly).map((it) => `
      <div class="flex items-center justify-between gap-2 bg-slate-800/60 p-2 rounded-lg text-[11px]">
        <div><span class="font-bold text-white">${it.name}</span> <span class="mono text-amber-400">${it.price}源幣</span><div class="text-[10px] text-slate-400">${it.desc}</div></div>
        <button data-buy="${it.id}" class="action-btn primary px-2.5 py-1 text-[10px] shrink-0">購買</button>
      </div>
    `).join('');

    const bagKeys = Object.keys(state.bag);
    document.getElementById('bagList').innerHTML = bagKeys.length === 0 ? '<div class="text-[11px] text-slate-500">背包空空的</div>' : bagKeys.map((id) => {
      const it = window.O2_DATA.ITEMS[id];
      if (!it) return '';
      return `<div class="flex items-center justify-between gap-2 bg-slate-800/70 p-2 rounded-lg text-[11px]">
        <div><span class="font-bold text-white">${it.name}</span> <span class="mono text-amber-300">x${state.bag[id]}</span></div>
        <div class="flex gap-1">
          ${it.dropOnly ? '<span class="mono text-[9px] text-purple-300 px-1.5 py-0.5 rounded bg-purple-950/60 border border-purple-500/40">進化素材</span>' : `<button data-use="${id}" class="action-btn primary px-2 py-1 text-[10px]">使用</button><button data-store="${id}" class="action-btn px-2 py-1 text-[10px]">入庫</button>`}
        </div>
      </div>`;
    }).join('');

    const whKeys = Object.keys(state.warehouse);
    document.getElementById('warehouseList').innerHTML = whKeys.length === 0 ? '<div class="text-[11px] text-slate-500">倉庫空空的</div>' : whKeys.map((id) => {
      const it = window.O2_DATA.ITEMS[id];
      if (!it) return '';
      return `<div class="flex items-center justify-between gap-2 bg-slate-800/60 p-2 rounded-lg text-[11px]">
        <span>${it.name} <span class="mono text-cyan-300">x${state.warehouse[id]}</span></span>
        <button data-take="${id}" class="action-btn px-2 py-1 text-[10px]">取出</button>
      </div>`;
    }).join('');

    document.getElementById('monsterList').innerHTML = state.monsters.map((mon) => {
      const msp = window.O2_DATA.SPECIES[mon.speciesId];
      const isActive = mon.uuid === state.activeUuid;
      return `<div class="p-2 rounded-lg border ${isActive ? 'border-cyan-400 bg-slate-800' : 'border-slate-700 bg-slate-900/70'} text-[11px] space-y-1">
        <div class="flex items-center justify-between">
          <span class="font-bold text-white">${msp.id} ${mon.customName}</span>
          <span class="mono text-[10px] text-emerald-400">CP ${mon.cp} · IQ ${mon.iq}</span>
        </div>
        <div class="flex gap-1.5 pt-1">
          ${isActive ? '<span class="text-[10px] text-cyan-300 font-bold">出戰中</span>' : `<button data-switch="${mon.uuid}" class="action-btn primary px-2 py-0.5 text-[10px]">切換</button>`}
          <button data-gene="${mon.uuid}" class="action-btn px-2 py-0.5 text-[10px] text-amber-300">基因激發(150)</button>
          <button data-rename="${mon.uuid}" class="action-btn px-2 py-0.5 text-[10px]">改名</button>
          <button data-release="${mon.uuid}" class="action-btn danger px-2 py-0.5 text-[10px]">放生</button>
        </div>
      </div>`;
    }).join('') + `<div class="pt-2 border-t border-slate-800">
      <div class="grid grid-cols-2 gap-1.5">` +
      Object.values(window.O2_DATA.SPECIES).map((sp) => {
        const sUrl = window.O2_DATA.SPRITE_PATHS[sp.sheet] || '';
        const unlocked = state.monsters.some((mon) => mon.speciesId === sp.id || (mon.evoHistory || []).some((eh) => eh.formId === sp.id));
        return `<div class="flex items-center gap-2 p-2 rounded-xl bg-slate-900/90 border ${unlocked ? 'border-cyan-500/50' : 'border-slate-800 opacity-60'} text-left">
          <div style="width:40px;height:40px;background-image:url('${sUrl}');background-size:160px 480px;background-position:0 0;image-rendering:pixelated;flex-shrink:0;${unlocked ? '' : 'filter:brightness(0.25);'}"></div>
          <div class="min-w-0 flex-1">
            <div class="text-xs font-bold text-white truncate">${sp.id} ${sp.name}</div>
            <div class="text-[9px] ${unlocked ? 'text-cyan-300' : 'text-slate-500'}">${sp.series} · ${sp.element}系 · ${unlocked ? '已解鎖' : (sp.stage === 2 ? '需由成長期進化' : '需由幼年期進化')}</div>
          </div>
        </div>`;
      }).join('') + `</div></div>`;
  }

  document.addEventListener('click', (e) => {
    const eng = window.O2_ENGINE;
    const state = eng.getState();
    const btn = e.target.closest('button');
    if (!btn) return;

    if (btn.dataset.buyscene) {
      const sid = btn.dataset.buyscene;
      const sc = window.O2_DATA.SCENES.find((s) => s.id === sid);
      const owned = (state.unlockedScenes || ['sakura']).includes(sid);
      if (owned) { const r = eng.buyScene(sid); showToast(r.msg); renderUI(); return; }
      openConfirm('確認購買場景', `確定要花費 ${sc.price} 源幣購買場景【${sc.name}】嗎？`, () => {
        const r = eng.buyScene(sid); showToast(r.msg); renderUI();
      });
      return;
    }
    if (btn.dataset.dock) { switchDock(btn.dataset.dock); return; }
    if (btn.dataset.icon !== undefined) {
      const idx = Number(btn.dataset.icon);
      setTopIcon(idx); executeTopIcon(idx); return;
    }
    if (btn.dataset.enhance) { const r = eng.enhanceEquippedGear(btn.dataset.enhance); showToast(r.msg); renderUI(); return; }
    if (btn.dataset.reforge) { const r = eng.reforgeEquippedGear(btn.dataset.reforge); showToast(r.msg); renderUI(); return; }
    if (btn.dataset.refine) { const r = eng.refineEquippedGear(btn.dataset.refine); showToast(r.msg); renderUI(); return; }
    if (btn.dataset.gene) { const r = eng.awakenMonsterGene(btn.dataset.gene); showToast(r.msg); renderUI(); return; }
    if (btn.dataset.equip) { eng.equipGear(btn.dataset.equip); renderUI(); return; }
    if (btn.dataset.unequip) { eng.unequipSlot(btn.dataset.unequip); renderUI(); return; }
    if (btn.id === 'btnDismantleLow') {
      const res = eng.dismantleLowRarity();
      showToast(res.count > 0 ? `已分解 ${res.count} 件白/綠裝 (+${res.total} 源幣)` : '沒有可分解的白/綠裝');
      renderUI(); return;
    }
    if (btn.dataset.tpzone) {
      const z = window.O2_MAP.teleportZone(btn.dataset.tpzone);
      document.getElementById('modalOverlay').classList.add('hidden');
      showToast(`已傳送至 ${z.name}！`);
      renderUI(); return;
    }
    if (btn.dataset.dismantle) {
      const gid = btn.dataset.dismantle;
      const g = state.gearBag.find((x) => x.uuid === gid);
      if (g && ['rare', 'epic', 'legendary'].includes(g.rarityId)) {
        openConfirm('確認分解高階裝備', `確定要分解【${g.name}】換取源幣嗎？`, () => {
          const v = eng.dismantleGear(gid); showToast(`分解 +${v} 源幣`); renderUI();
        });
      } else {
        const v = eng.dismantleGear(gid); showToast(`分解 +${v} 源幣`); renderUI();
      }
      return;
    }
    if (btn.dataset.evotarget) {
      const targetId = btn.dataset.evotarget;
      document.getElementById('modalOverlay').classList.add('hidden');
      const res = eng.triggerNormalEvolution(false, targetId);
      if (res.evolved) window.O2_BATTLE.startAnimation('evo', `進化為 ${res.nextSp.name}!`, 4, 110);
      else showToast(res.msg);
      renderUI(); return;
    }
    if (btn.dataset.adopt) {
      const nm = eng.createMonster(btn.dataset.adopt);
      state.monsters.push(nm); state.activeUuid = nm.uuid;
      eng.save(); switchDock('machine');
      window.O2_BATTLE.startAnimation('happy', `${nm.customName} 登場!`, 2, 88);
      renderUI(); return;
    }
    if (btn.dataset.use) {
      const res = eng.useBagItem(btn.dataset.use);
      if (!res.ok) showToast(res.msg);
      else {
        if (res.itemId === 'burger') window.O2_BATTLE.startAnimation('eat', '大口吃漢堡!', 9, 96);
        else if (res.itemId === 'energy_pill') window.O2_BATTLE.startAnimation('pill', '能量補充!', 2, 80);
        showToast('道具使用成功！');
      }
      renderUI();
    } else if (btn.dataset.store) { eng.transferItem(btn.dataset.store, true); renderUI(); }
    else if (btn.dataset.take) { eng.transferItem(btn.dataset.take, false); renderUI(); }
    else if (btn.dataset.buy) {
      const iid = btn.dataset.buy;
      const it = window.O2_DATA.ITEMS[iid];
      openConfirm('確認購買道具', `確定要花費 ${it.price} 源幣購買【${it.name}】嗎？`, () => {
        const r = eng.buyItem(iid); showToast(r.ok ? '購買成功！' : r.msg); renderUI();
      });
    } else if (btn.dataset.switch) { state.activeUuid = btn.dataset.switch; eng.save(); renderUI(); }
    else if (btn.dataset.rename) {
      const mon = state.monsters.find((x) => x.uuid === btn.dataset.rename);
      if (mon) { mon.customName = `${window.O2_DATA.SPECIES[mon.speciesId].name}#${Math.floor(10 + Math.random() * 89)}`; eng.save(); renderUI(); }
    } else if (btn.dataset.release) {
      const uuid = btn.dataset.release;
      if (state.monsters.length <= 1) { showToast('至少須保留一隻怪獸！'); return; }
      openConfirm('確認放生', '放生後該 UUID 個體將永久移除，確定嗎？', () => {
        state.monsters = state.monsters.filter((x) => x.uuid !== uuid);
        if (state.activeUuid === uuid) state.activeUuid = state.monsters[0].uuid;
        eng.save(); renderUI();
      });
    }
  });

  document.getElementById('btnSpeed2x').addEventListener('click', () => {
    const nxt = window.O2_BATTLE.getSpeed() === 1 ? 2 : 1;
    window.O2_BATTLE.setSpeed(nxt);
    renderUI();
  });
  document.getElementById('btnAiChain').addEventListener('click', () => {
    if (window.O2_BATTLE.isBattling()) { handleC(); return; }
    aiChainEnabled = !aiChainEnabled;
    if (aiChainEnabled) {
      const res = window.O2_BATTLE.startAutoBattle(true);
      if (!res.ok) { aiChainEnabled = false; showToast(res.msg); }
    }
    renderUI();
  });

  document.getElementById('shopTabScenes').addEventListener('click', () => {
    document.getElementById('sceneShopList').classList.remove('hidden');
    document.getElementById('itemShopWrap').classList.add('hidden');
    document.getElementById('bagWhWrap').classList.add('hidden');
    document.getElementById('shopTabScenes').classList.add('primary');
    document.getElementById('shopTabItems').classList.remove('primary');
    document.getElementById('shopTabBag').classList.remove('primary');
  });
  document.getElementById('shopTabItems').addEventListener('click', () => {
    document.getElementById('sceneShopList').classList.add('hidden');
    document.getElementById('itemShopWrap').classList.remove('hidden');
    document.getElementById('bagWhWrap').classList.add('hidden');
    document.getElementById('shopTabItems').classList.add('primary');
    document.getElementById('shopTabScenes').classList.remove('primary');
    document.getElementById('shopTabBag').classList.remove('primary');
  });
  document.getElementById('shopTabBag').addEventListener('click', () => {
    document.getElementById('sceneShopList').classList.add('hidden');
    document.getElementById('itemShopWrap').classList.add('hidden');
    document.getElementById('bagWhWrap').classList.remove('hidden');
    document.getElementById('shopTabBag').classList.add('primary');
    document.getElementById('shopTabScenes').classList.remove('primary');
    document.getElementById('shopTabItems').classList.remove('primary');
  });

  function moveMap(dx, dy) {
    if (window.O2_BATTLE.isBattling()) return;
    if (activeDock !== 'map') switchDock('map');
    const res = window.O2_MAP.movePlayer(dx, dy);
    if (!res.moved) showToast(res.msg);
    else if (res.event) showToast(res.msg);
    else if (res.encounter && res.battleRes && !res.battleRes.ok) showToast(res.battleRes.msg);
    renderUI();
  }
  // 虛擬搖桿觸控/滑鼠拖曳控制
  const joyEl = document.getElementById('vJoystick');
  const joyKnob = document.getElementById('vJoyKnob');
  let joyActive = false;
  let joyDir = [0, 0];
  let joyStepTimer = null;

  function updateJoystick(clientX, clientY) {
    const rect = joyEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const maxR = 24;
    if (dist > maxR) { dx = (dx / dist) * maxR; dy = (dy / dist) * maxR; }
    joyKnob.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
    if (dist < 9) { joyDir = [0, 0]; return; }
    if (Math.abs(dx) >= Math.abs(dy)) joyDir = [dx > 0 ? 1 : -1, 0];
    else joyDir = [0, dy > 0 ? 1 : -1];
  }

  function stopJoystick() {
    joyActive = false;
    joyDir = [0, 0];
    joyKnob.style.transform = 'translate(0px, 0px)';
    if (joyStepTimer) { clearInterval(joyStepTimer); joyStepTimer = null; }
  }

  joyEl.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    joyActive = true;
    joyEl.setPointerCapture(e.pointerId);
    updateJoystick(e.clientX, e.clientY);
    if (joyDir[0] !== 0 || joyDir[1] !== 0) moveMap(joyDir[0], joyDir[1]);
    if (joyStepTimer) clearInterval(joyStepTimer);
    joyStepTimer = setInterval(() => {
      if (joyActive && (joyDir[0] !== 0 || joyDir[1] !== 0)) moveMap(joyDir[0], joyDir[1]);
    }, 190);
  });
  joyEl.addEventListener('pointermove', (e) => { if (joyActive) updateJoystick(e.clientX, e.clientY); });
  joyEl.addEventListener('pointerup', stopJoystick);
  joyEl.addEventListener('pointercancel', stopJoystick);

  document.getElementById('btnMapAuto').addEventListener('click', () => {
    mapAutoEnabled = !mapAutoEnabled;
    showToast(mapAutoEnabled ? 'AUTO 巡邏淨化啟動' : '已暫停 AUTO 巡邏');
    renderUI();
  });

  document.getElementById('btnZoneDrops').addEventListener('click', () => {
    const st = window.O2_ENGINE.getState();
    const z = window.O2_MAP.getZone(st.mapPos.x, st.mapPos.y);
    document.getElementById('modalTitle').textContent = `${z.name} (Lv.${z.level}) 掉寶情報`;
    document.getElementById('modalBody').innerHTML = `
      <div class="space-y-1.5 text-xs text-slate-200">
        <div>區域首領：<span class="text-fuchsia-300 font-bold">${z.polluted.name}</span></div>
        <div>進化碎片：<span class="text-purple-300 font-bold">${(window.O2_DATA.ITEMS[z.shardId]?.name || '隨機碎片')}</span> (25% 機率掉落)</div>
        <div>裝備掉率：<span class="text-emerald-300 font-bold">${Math.round(st.config.gearDropChanceMap * 100)}%</span> (普通～傳說 4 格裝備)</div>
        <div>淨化金幣：<span class="text-amber-300 font-bold">+${25 * z.level} 源幣</span></div>
        <div class="text-cyan-300 pt-1">${z.buffDesc}</div>
        <div class="pt-2 border-t border-slate-700">
          <div class="text-[10px] text-slate-400 mb-1">快速傳送生態區：</div>
          <div class="grid grid-cols-2 gap-1">
            <button data-tpzone="plains" class="action-btn py-1 text-[10px]">翠綠平原 (G1)</button>
            <button data-tpzone="lava" class="action-btn py-1 text-[10px]">熔岩裂谷 (G2)</button>
            <button data-tpzone="wasteland" class="action-btn py-1 text-[10px]">幽冥廢土 (G3)</button>
            <button data-tpzone="sanctum" class="action-btn py-1 text-[10px]">聖域神殿 (G4)</button>
          </div>
        </div>
      </div>`;
    confirmCallback = null;
    document.getElementById('modalOverlay').classList.remove('hidden');
  });

  setInterval(() => {
    if (!mapAutoEnabled || activeDock !== 'map' || window.O2_BATTLE.isBattling()) return;
    const res = window.O2_MAP.stepAutoPatrol();
    if (res.encounter && res.battleRes && !res.battleRes.ok) {
      mapAutoEnabled = false;
      showToast(res.battleRes.msg);
    } else if (res.event) {
      showToast(res.msg);
    }
    renderUI();
  }, 450);

  document.getElementById('btnHatchNew').addEventListener('click', () => {
    const eng = window.O2_ENGINE;
    const state = eng.getState();
    const nm = eng.createMonster('B1');
    state.monsters.push(nm); state.activeUuid = nm.uuid;
    eng.save(); showToast('召喚 B1 赤棘幼獸！'); renderUI();
  });
  document.getElementById('btnHatchB2').addEventListener('click', () => {
    const eng = window.O2_ENGINE;
    const state = eng.getState();
    const nm = eng.createMonster('B2');
    state.monsters.push(nm); state.activeUuid = nm.uuid;
    eng.save(); showToast('召喚 B2 幽魂幼靈！'); renderUI();
  });
  document.getElementById('btnHatchB3').addEventListener('click', () => {
    const eng = window.O2_ENGINE;
    const state = eng.getState();
    const nm = eng.createMonster('B3');
    state.monsters.push(nm); state.activeUuid = nm.uuid;
    eng.save(); showToast('召喚 B3 骨甲人龍！'); renderUI();
  });

  document.getElementById('btnSaveMgr').addEventListener('click', () => {
    const eng = window.O2_ENGINE;
    const blocked = eng.isStorageBlocked();
    const code = eng.exportSaveCode();
    document.getElementById('modalTitle').textContent = '存檔備份與還原';
    document.getElementById('modalBody').innerHTML = `
      <div class="space-y-2 text-[11px]">
        <div class="p-2 rounded-lg ${blocked ? 'bg-amber-950/60 border border-amber-500/50 text-amber-200' : 'bg-emerald-950/50 border border-emerald-500/40 text-emerald-200'}">
          ${blocked
            ? '偵測到目前預覽沙盒限制本機存檔，關閉預覽後會重置。請點擊下方「複製存檔碼」或「下載存檔」備份，或將 ZIP 託管至網頁空間即可永久自動存檔。'
            : '自動存檔運作中 (localStorage + IndexedDB)。跨版本測試或換裝置前，也可先備份存檔碼。'}
        </div>
        <div>
          <div class="text-slate-400 mb-1">目前存檔碼：</div>
          <textarea id="saveCodeExportBox" readonly rows="2" class="mono w-full bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-[10px] text-cyan-200">${code}</textarea>
          <div class="flex gap-1.5 mt-1">
            <button id="btnCopySaveCode" class="action-btn primary flex-1 py-1 text-[10px]">複製存檔碼</button>
            <button id="btnDownloadSaveJson" class="action-btn flex-1 py-1 text-[10px]">下載 .json 檔</button>
          </div>
        </div>
        <div class="pt-1.5 border-t border-slate-800">
          <div class="text-slate-400 mb-1">貼上存檔碼還原進度：</div>
          <textarea id="saveCodeImportBox" rows="2" placeholder="貼上 O2SAVE:... 或 JSON 內容" class="mono w-full bg-slate-950 border border-slate-700 rounded-lg p-1.5 text-[10px] text-white"></textarea>
          <div class="flex gap-1.5 mt-1">
            <button id="btnImportSaveCode" class="action-btn primary flex-1 py-1 text-[10px]">貼上並還原</button>
            <label class="action-btn flex-1 py-1 text-[10px] cursor-pointer">讀取 .json 檔<input id="fileImportSave" type="file" accept=".json,.txt" class="hidden" /></label>
          </div>
        </div>
      </div>`;
    confirmCallback = null;
    document.getElementById('modalOverlay').classList.remove('hidden');
  });

  document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'btnCopySaveCode') {
      const box = document.getElementById('saveCodeExportBox');
      if (box) {
        box.select();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(box.value).catch(() => document.execCommand('copy'));
        } else {
          document.execCommand('copy');
        }
        showToast('已複製存檔碼！');
      }
    } else if (e.target && e.target.id === 'btnDownloadSaveJson') {
      const blob = new Blob([JSON.stringify(window.O2_ENGINE.getState(), null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `o2_save_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      showToast('已下載存檔檔案！');
    } else if (e.target && e.target.id === 'btnImportSaveCode') {
      const val = document.getElementById('saveCodeImportBox')?.value || '';
      const res = window.O2_ENGINE.importSaveCode(val);
      showToast(res.msg);
      if (res.ok) {
        document.getElementById('modalOverlay').classList.add('hidden');
        renderUI();
      }
    }
  });

  document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'fileImportSave' && e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = () => {
        const res = window.O2_ENGINE.importSaveCode(String(reader.result || ''));
        showToast(res.msg);
        if (res.ok) {
          document.getElementById('modalOverlay').classList.add('hidden');
          renderUI();
        }
      };
      reader.readAsText(e.target.files[0]);
    }
  });

  document.getElementById('btnRedeem').addEventListener('click', () => {
    const res = window.O2_ENGINE.redeemCode(document.getElementById('redeemInput').value);
    showToast(res.msg); renderUI();
  });

  function handleA() { setTopIcon(topIconIdx + 1); }
  function handleB() {
    if (window.O2_BATTLE.getViewMode() === 'status') {
      window.O2_BATTLE.toggleStatusPage();
      return;
    }
    executeTopIcon(topIconIdx);
  }
  function handleC() {
    aiChainEnabled = false;
    window.O2_BATTLE.cancelAllAnimationsAndBattle();
    document.getElementById('modalOverlay').classList.add('hidden');
    if (activeDock !== 'machine') switchDock('machine');
    showToast('已安全取消並返回機台');
    renderUI();
  }

  document.getElementById('btnA').addEventListener('click', handleA);
  document.getElementById('btnB').addEventListener('click', handleB);
  document.getElementById('btnC').addEventListener('click', handleC);

  window.addEventListener('keydown', (e) => {
    if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
    if (activeDock === 'map') {
      if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'w') { e.preventDefault(); moveMap(0, -1); return; }
      if (e.key === 'ArrowDown' || e.key.toLowerCase() === 's') { e.preventDefault(); moveMap(0, 1); return; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); moveMap(-1, 0); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); moveMap(1, 0); return; }
    }
    if (e.key.toLowerCase() === 'a') handleA();
    else if (e.key === 'Enter' || e.key.toLowerCase() === 'b') handleB();
    else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') handleC();
  });

  document.addEventListener('visibilitychange', () => { window.O2_BATTLE.setPaused(document.hidden); });

  let secAcc = 0;
  function loop(now) {
    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;
    tick += 1;
    secAcc += dt;

    window.O2_BATTLE.stepBattle(dt);


    if (secAcc >= 1.0) {
      secAcc -= 1.0;
      const eng = window.O2_ENGINE;
      const state = eng.getState();
      const m = eng.getActiveMonster();
      if (m.sleeping) {
        m.stamina = Math.min(state.config.maxStamina, m.stamina + 3);
        m.currentHp = Math.min(eng.getEffectiveStats(m).hp, m.currentHp + 5);
      } else if (tick % 240 === 0) {
        m.stamina = Math.min(state.config.maxStamina, m.stamina + 1);
      }
      if (m.poopCount >= 2 && m.poopWarnSince && (Date.now() - m.poopWarnSince >= state.config.poisonWaitSeconds)) {
        if (!m.poisoned) m.poisoned = true;
      }
      eng.save();
      renderUI();
    }

    if (activeDock === 'map') syncCanvasSize();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    window.O2_BATTLE.render(ctx, LOGICAL_W, LOGICAL_H, tick);
    requestAnimationFrame(loop);
  }

  window.addEventListener('load', () => {
    initStaticIcons();
    switchDock('machine');
    requestAnimationFrame(loop);
  });

  return { renderUI, showToast };
})();
