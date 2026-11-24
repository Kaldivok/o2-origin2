// O2《獸源》ORIGIN V2.2 — G1~G4 編號架構、裝備系統、99x99 冒險地圖與多維進化
window.O2_DATA = {
  ELEMENTS: ['火', '水', '風', '森林', '機械', '黑暗', '神聖', '土', '鬼', '幽靈'],

  STAGES: [
    { id: 0, name: '幼年期', cap: { hp: 110, att: 28,  def: 26,  agi: 28 } },
    { id: 1, name: '成長期', cap: { hp: 220, att: 58,  def: 54,  agi: 58 } },
    { id: 2, name: '成熟期', cap: { hp: 290, att: 82,  def: 78,  agi: 82 } },
    { id: 3, name: '完全體', cap: { hp: 420, att: 120, def: 115, agi: 120 } },
    { id: 4, name: '究極體', cap: { hp: 600, att: 165, def: 158, agi: 165 } }
  ],

  CONFIG: {
    staminaPreset: '8_20',
    battleCost: 1,
    maxStamina: 120,
    poopEveryStamina: 300,
    poisonWaitSeconds: 3600,
    coinDropChance: 0.45,
    coinDropMin: 12,
    coinDropMax: 28,
    gearDropChanceBattle: 0.10,
    gearDropChanceMap: 0.18,
    dmgCoeffA: 0.85,
    dmgCoeffD: 1.75
  },

  // B1 幼年期 + G1~G4 分支進化成長期
  SPECIES: {
    B1: {
      id: 'B1', series: '幼年期', name: '赤棘幼獸', stage: 0, element: '源質',
      sheet: 'baby_b1', sheetCellSize: 224, defaultFacing: 'left',
      base: { hp: 78, att: 16, def: 14, agi: 18 },
      evoBranches: [
        { target: 'G1', label: 'G1 暗影狐',   route: '疾風結晶', req: { wins: 70, agi: 20, itemId: 'shard_g1', itemQty: 15 } },
        { target: 'G2', label: 'G2 炎棘龍',   route: '堅盾龍鱗', req: { wins: 75, def: 18, purified: 20, itemId: 'shard_g2', itemQty: 18 } },
        { target: 'G3', label: 'G3 緋紅夜獸', route: '魔瞳狂攻', req: { wins: 80, att: 21, iq: 95, itemId: 'shard_g3', itemQty: 20 } },
        { target: 'G4', label: 'G4 熾焰飛龍', route: '龍魂霸者', req: { wins: 90, bond: 25, purified: 30, itemId: 'shard_g4', itemQty: 25 } }
      ]
    },
    B2: {
      id: 'B2', series: '幼年期', name: '幽魂幼靈', stage: 0, element: '黑暗',
      sheet: 'baby_b2', sheetCellSize: 224, defaultFacing: 'left',
      base: { hp: 74, att: 18, def: 12, agi: 20 },
      evoBranches: [
        { target: 'M1', label: 'M1 鬼武亡靈', route: '鬼道劍魄', req: { wins: 70, agi: 22, itemId: 'shard_g1', itemQty: 15 } },
        { target: 'M2', label: 'M2 咒印鳥居', route: '幽冥結界', req: { wins: 75, def: 16, purified: 20, itemId: 'shard_g2', itemQty: 18 } },
        { target: 'M3', label: 'M3 怨偶幽姬', route: '咒偶狂攻', req: { wins: 80, att: 22, iq: 95, itemId: 'shard_g3', itemQty: 20 } },
        { target: 'M4', label: 'M4 冥鎧劍鬼', route: '冥界霸鎧', req: { wins: 90, bond: 25, purified: 30, itemId: 'shard_g4', itemQty: 25 } }
      ]
    },
    B3: {
      id: 'B3', series: '幼年期', name: '骨甲人龍', stage: 0, element: '土',
      sheet: 'baby_b3', sheetCellSize: 224, defaultFacing: 'left',
      base: { hp: 82, att: 17, def: 18, agi: 14 },
      evoBranches: [
        { target: 'G1', label: 'G1 暗影狐',   route: '疾風結晶', req: { wins: 70, agi: 20, itemId: 'shard_g1', itemQty: 15 } },
        { target: 'G2', label: 'G2 炎棘龍',   route: '堅盾龍鱗', req: { wins: 75, def: 18, purified: 20, itemId: 'shard_g2', itemQty: 18 } },
        { target: 'G3', label: 'G3 緋紅夜獸', route: '魔瞳狂攻', req: { wins: 80, att: 21, iq: 95, itemId: 'shard_g3', itemQty: 20 } },
        { target: 'G4', label: 'G4 熾焰飛龍', route: '龍魂霸者', req: { wins: 90, bond: 25, purified: 30, itemId: 'shard_g4', itemQty: 25 } }
      ]
    },
    G1: {
      id: 'G1', series: '成長期', name: '暗影狐', stage: 1, element: '黑暗',
      sheet: 'shadow_fox', sheetCellSize: 224, defaultFacing: 'left',
      base: { hp: 118, att: 28, def: 20, agi: 36 },
      evoBranches: []
    },
    G2: {
      id: 'G2', series: '成長期', name: '炎棘龍', stage: 1, element: '火',
      sheet: 'blaze_dino', sheetCellSize: 224, defaultFacing: 'left',
      base: { hp: 145, att: 30, def: 35, agi: 22 },
      evoBranches: []
    },
    G3: {
      id: 'G3', series: '成長期', name: '緋紅夜獸', stage: 1, element: '黑暗',
      sheet: 'crimson_lynx', sheetCellSize: 224, defaultFacing: 'left',
      base: { hp: 128, att: 38, def: 24, agi: 32 },
      evoBranches: []
    },
    G4: {
      id: 'G4', series: '成長期', name: '熾焰飛龍', stage: 1, element: '火',
      sheet: 'flare_drake', sheetCellSize: 224, defaultFacing: 'left',
      base: { hp: 152, att: 36, def: 32, agi: 34 },
      evoBranches: []
    },
    M1: {
      id: 'M1', series: '成長期', name: '鬼武亡靈', stage: 1, element: '鬼',
      sheet: 'mature_m1', sheetCellSize: 224, defaultFacing: 'left',
      base: { hp: 195, att: 54, def: 38, agi: 58 },
      evoBranches: []
    },
    M2: {
      id: 'M2', series: '成長期', name: '咒印鳥居', stage: 1, element: '幽靈',
      sheet: 'mature_m2', sheetCellSize: 224, defaultFacing: 'left',
      base: { hp: 235, att: 44, def: 58, agi: 36 },
      evoBranches: []
    },
    M3: {
      id: 'M3', series: '成長期', name: '怨偶幽姬', stage: 1, element: '幽靈',
      sheet: 'mature_m3', sheetCellSize: 224, defaultFacing: 'left',
      base: { hp: 205, att: 60, def: 42, agi: 52 },
      evoBranches: []
    },
    M4: {
      id: 'M4', series: '成長期', name: '冥鎧劍鬼', stage: 1, element: '鬼',
      sheet: 'mature_m4', sheetCellSize: 224, defaultFacing: 'left',
      base: { hp: 245, att: 58, def: 54, agi: 50 },
      evoBranches: []
    }
  },

  // 冒險地圖限定野生怪獸（不接入進化與圖鑑，隨機替換各區污染怪）
  WILD_MONSTERS: {
    W1: { id: 'W1', name: '腐木骸靈', sheet: 'wild_moss',       sheetCellSize: 224, defaultFacing: 'left' },
    W2: { id: 'W2', name: '白狐神龕', sheet: 'wild_fox_shrine', sheetCellSize: 224, defaultFacing: 'left' },
    W3: { id: 'W3', name: '炎獄魔門', sheet: 'wild_lava_gate',  sheetCellSize: 224, defaultFacing: 'left' }
  },

  EQUIP_SLOTS: {
    weapon: { id: 'weapon', name: '武器', icon: 'sword' },
    armor:  { id: 'armor',  name: '護甲', icon: 'shield' },
    core:   { id: 'core',   name: '源核', icon: 'core' },
    crest:  { id: 'crest',  name: '徽章', icon: 'crest' }
  },

  RARITIES: [
    { id: 'common',    name: '普通', color: '#cbd5e1', mult: 1.0, weight: 44 },
    { id: 'uncommon',  name: '精良', color: '#4ade80', mult: 1.4, weight: 28 },
    { id: 'rare',      name: '稀有', color: '#38bdf8', mult: 1.9, weight: 17 },
    { id: 'epic',      name: '史詩', color: '#c084fc', mult: 2.6, weight: 8 },
    { id: 'legendary', name: '傳說', color: '#fbbf24', mult: 3.5, weight: 3 }
  ],

  GEAR_AFFIXES: [
    { id: 'vamp',   name: '吸血 +6%',  key: 'vamp',   val: 0.06 },
    { id: 'crit',   name: '暴擊 +7%',  key: 'crit',   val: 0.07 },
    { id: 'thorns', name: '反傷 +3%',  key: 'thorns', val: 0.03 },
    { id: 'dodge',  name: '閃避 +5%',  key: 'dodge',  val: 0.05 },
    { id: 'haste',  name: '疾速 +6%',  key: 'haste',  val: 0.06 },
    { id: 'pierce', name: '破甲 +8%',  key: 'pierce', val: 0.08 }
  ],

  GEAR_PREFIXES: {
    weapon: ['脈衝數據爪', '超頻光束刃', '破譯電磁牙', '毀滅演算砲'],
    armor:  ['數碼防火牆', '奈米重裝殼', '矩陣緩衝盾', '零號加密鎧'],
    core:   ['O₂ 源質晶片', '超導數據核', '量子運算核', '創世母體核'],
    crest:  ['加速協定印', '淨化編碼徽', '同步共振章', '終端支配印']
  },

  // 16 種固定裝備圖鑑索引（方便後續逐一替換 img 圖檔）
  GEAR_CATALOG: [
    { id: 'weapon_01', slot: 'weapon', name: '烈焰利爪', img: null },
    { id: 'weapon_02', slot: 'weapon', name: '暗影戰刃', img: null },
    { id: 'weapon_03', slot: 'weapon', name: '破甲尖牙', img: null },
    { id: 'weapon_04', slot: 'weapon', name: '龍炎重劍', img: null },
    { id: 'armor_01',  slot: 'armor',  name: '黑曜鱗甲', img: null },
    { id: 'armor_02',  slot: 'armor',  name: '泰坦重鎧', img: null },
    { id: 'armor_03',  slot: 'armor',  name: '秘銀胸甲', img: null },
    { id: 'armor_04',  slot: 'armor',  name: '聖域護盾', img: null },
    { id: 'core_01',   slot: 'core',   name: '源質結晶', img: null },
    { id: 'core_02',   slot: 'core',   name: '混沌核心', img: null },
    { id: 'core_03',   slot: 'core',   name: '星辰反應爐', img: null },
    { id: 'core_04',   slot: 'core',   name: '太陽心臟', img: null },
    { id: 'crest_01',  slot: 'crest',  name: '疾風徽章', img: null },
    { id: 'crest_02',  slot: 'crest',  name: '勇氣紋章', img: null },
    { id: 'crest_03',  slot: 'crest',  name: '夜梟之印', img: null },
    { id: 'crest_04',  slot: 'crest',  name: '霸者信物', img: null }
  ],

  // 99x99 冒險大地圖生態區 + 淨化獎勵 Buff
  MAP_ZONES: [
    {
      id: 'plains', shardId: 'shard_g1', name: '翠綠平原', xRange: [0, 49], yRange: [0, 49], level: 1,
      tileBg: '#166534', tileAccent: '#22c55e',
      buffDesc: '淨化獎勵：掉寶率 +15%',
      polluted: { speciesId: 'G1', name: '污染・G1暗影狐', stats: { hp: 70, att: 14, def: 11, agi: 16 } }
    },
    {
      id: 'lava', shardId: 'shard_g2', name: '熔岩裂谷', xRange: [50, 98], yRange: [0, 49], level: 2,
      tileBg: '#7f1d1d', tileAccent: '#ea580c',
      buffDesc: '淨化獎勵：全體 ATT +10%',
      polluted: { speciesId: 'G2', name: '狂暴・G2炎棘龍', stats: { hp: 115, att: 22, def: 19, agi: 21 } }
    },
    {
      id: 'wasteland', shardId: 'shard_g3', name: '幽冥廢土', xRange: [0, 49], yRange: [50, 98], level: 3,
      tileBg: '#3b0764', tileAccent: '#7e22ce',
      buffDesc: '淨化獎勵：全體 AGI +10%',
      polluted: { speciesId: 'G3', name: '蝕影・G3緋紅夜獸', stats: { hp: 165, att: 32, def: 26, agi: 30 } }
    },
    {
      id: 'sanctum', shardId: 'shard_g4', name: '聖域神殿', xRange: [50, 98], yRange: [50, 98], level: 4,
      tileBg: '#78350f', tileAccent: '#d97706',
      buffDesc: '淨化獎勵：傳說掉率 UP',
      polluted: { speciesId: 'G4', name: '墮落・G4熾焰飛龍', stats: { hp: 215, att: 42, def: 34, agi: 38 } }
    }
  ],

  ITEMS: {
    burger:      { id: 'burger',      name: '能量漢堡',     cat: '食物',     price: 25, desc: '飢餓 +35 / 親密 +3 (飽食時無法使用)' },
    energy_pill: { id: 'energy_pill', name: '藍色能量豆',   cat: '體力恢復', price: 60, desc: '體力 +50' },
    purify_med:  { id: 'purify_med',  name: '全效淨化藥',   cat: '中毒淨化', price: 45, desc: '解除中毒狀態' },
    shard_g1:    { id: 'shard_g1',    name: '暗影結晶碎片', cat: '進化素材', price: 0,  dropOnly: true, desc: '冒險對戰掉落，B1 進化 G1 必要素材 (需15個)' },
    shard_g2:    { id: 'shard_g2',    name: '炎棘龍鱗碎片', cat: '進化素材', price: 0,  dropOnly: true, desc: '冒險對戰掉落，B1 進化 G2 必要素材 (需18個)' },
    shard_g3:    { id: 'shard_g3',    name: '緋紅魔瞳碎片', cat: '進化素材', price: 0,  dropOnly: true, desc: '冒險對戰掉落，B1 進化 G3 必要素材 (需20個)' },
    shard_g4:    { id: 'shard_g4',    name: '熾焰龍魂碎片', cat: '進化素材', price: 0,  dropOnly: true, desc: '冒險對戰掉落，B1 進化 G4 必要素材 (需25個)' }
  },

  SKINS: [
    { id: 'dragon',  name: '暗黑魔龍', img: 'skins/skin_dragon.jpg' },
    { id: 'arcade',  name: '藍電街機', img: 'skins/skin_arcade.jpg' },
    { id: 'crystal', name: '紫晶聖殿', img: 'skins/skin_crystal.jpg' },
    { id: 'forest',  name: '森靈木紋', img: 'skins/skin_forest.jpg' },
    { id: 'holy',    name: '白金神域', img: 'skins/skin_holy.jpg' },
    { id: 'ruins',   name: '古代遺跡', img: 'skins/skin_ruins.jpg' }
  ],

  SCENES: [
    { id: 'sakura',   name: '櫻花虹瀑', price: 0,   img: 'scenes/scene_sakura.jpg',   desc: '預設初始場景，繁花與彩虹瀑布' },
    { id: 'desert',   name: '荒漠遺骨', price: 120, img: 'scenes/scene_desert.jpg',   desc: '烈日沙丘與古代巨獸遺骸' },
    { id: 'twilight', name: '黃昏廢墟', price: 180, img: 'scenes/scene_twilight.jpg', desc: '夕陽餘暉下的鋼鐵文明遺跡' },
    { id: 'ocean',    name: '深海遺跡', price: 240, img: 'scenes/scene_ocean.jpg',    desc: '珊瑚礁與亞特蘭提斯海底神殿' },
    { id: 'thunder',  name: '雷鳴聖殿', price: 320, img: 'scenes/scene_thunder.jpg',  desc: '藍電裂隙與暴風雨瀑布遺跡' },
    { id: 'sky',      name: '天空浮島', price: 400, img: 'scenes/scene_sky.jpg',      desc: '雲海之上的魔導浮空聖域' },
    { id: 'volcano',  name: '熾焰火山', price: 480, img: 'scenes/scene_volcano.jpg',  desc: '沸騰岩漿與黑曜石古橋' },
    { id: 'temple',   name: '結晶古廟', price: 580, img: 'scenes/scene_temple.jpg',   desc: '石獅守護的蒼藍魔晶神壇' },
    { id: 'void',     name: '冥界裂谷', price: 720, img: 'scenes/scene_void.jpg',     desc: '紫炎深淵與浮空暗黑魔城' }
  ],

  DEFAULT_REDEEM_CODES: {
    'O2START2026': { itemId: 'energy_pill', qty: 3, used: false },
    'PURIFY999':   { itemId: 'purify_med',  qty: 2, used: false }
  },

  SPRITE_PATHS: {
    baby_b1:      'sprites/baby_b1.png',
    baby_b2:      'sprites/baby_b2.png',
    baby_b3:      'sprites/baby_b3.png',
    shadow_fox:   'sprites/shadow_fox.png',
    blaze_dino:   'sprites/blaze_dino.png',
    crimson_lynx: 'sprites/crimson_lynx.png',
    flare_drake:  'sprites/flare_drake.png',
    mature_m1:    'sprites/mature_m1.png',
    mature_m2:    'sprites/mature_m2.png',
    mature_m3:    'sprites/mature_m3.png',
    mature_m4:    'sprites/mature_m4.png',
    wild_moss:       'sprites/wild_moss.png',
    wild_fox_shrine: 'sprites/wild_fox_shrine.png',
    wild_lava_gate:  'sprites/wild_lava_gate.png'
  }
};
