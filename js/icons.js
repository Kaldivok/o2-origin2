// O2《獸源》ORIGIN V2.1 — 自訂 SVG 向量圖示庫（全面取代簡陋表情符號）
window.O2_ICONS = {
  svg(path, cls = 'w-4 h-4', color = 'currentColor') {
    return `<svg class="${cls} inline-block shrink-0" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  },
  heart:    () => window.O2_ICONS.svg('<path d="M12 21s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9z"/>'),
  food:     () => window.O2_ICONS.svg('<path d="M4 11h16a8 8 0 0 0-16 0z"/><path d="M3 15h18"/><path d="M5 15v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/>'),
  train:    () => window.O2_ICONS.svg('<path d="M6 7v10M18 7v10M3 9v6M21 9v6M6 12h12"/>'),
  sword:    () => window.O2_ICONS.svg('<path d="M14.5 17.5L3 6V3h3l11.5 11.5"/><path d="M13 19l6-6"/><path d="M16 16l4 4"/>'),
  shield:   () => window.O2_ICONS.svg('<path d="M12 3l8 4v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V7l8-4z"/>'),
  bolt:     () => window.O2_ICONS.svg('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>'),
  water:    () => window.O2_ICONS.svg('<path d="M12 2.5C12 2.5 5 10 5 14.5a7 7 0 0 0 14 0C19 10 12 2.5 12 2.5z"/>'),
  moon:     () => window.O2_ICONS.svg('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  heal:     () => window.O2_ICONS.svg('<path d="M12 5v14M5 12h14"/><rect x="3" y="3" width="18" height="18" rx="4"/>'),
  sparkle:  () => window.O2_ICONS.svg('<path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4z"/>'),
  map:      () => window.O2_ICONS.svg('<polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>'),
  machine:  () => window.O2_ICONS.svg('<rect x="4" y="2" width="16" height="20" rx="3"/><rect x="7" y="5" width="10" height="8" rx="1"/><circle cx="9" cy="17" r="1"/><circle cx="12" cy="17" r="1"/><circle cx="15" cy="17" r="1"/>'),
  dex:      () => window.O2_ICONS.svg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),
  equip:    () => window.O2_ICONS.svg('<path d="M12 2l3 5h5l-4 4 1.5 6L12 14l-5.5 3L8 11 4 7h5z"/>'),
  bag:      () => window.O2_ICONS.svg('<path d="M6 7h12l1 13H5L6 7z"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/>'),
  shop:     () => window.O2_ICONS.svg('<path d="M3 9l2-5h14l2 5"/><path d="M3 9h18v11H3z"/><path d="M9 20v-6h6v6"/>'),
  gear:     () => window.O2_ICONS.svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>'),
  core:     () => window.O2_ICONS.svg('<polygon points="12 2 20 7 20 17 12 22 4 17 4 7"/><circle cx="12" cy="12" r="3"/>'),
  crest:    () => window.O2_ICONS.svg('<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>'),
  arrowUp:  () => window.O2_ICONS.svg('<path d="M12 19V5M5 12l7-7 7 7"/>'),
  arrowDn:  () => window.O2_ICONS.svg('<path d="M12 5v14M5 12l7 7 7-7"/>'),
  arrowLt:  () => window.O2_ICONS.svg('<path d="M19 12H5M12 5l-7 7 7 7"/>'),
  arrowRt:  () => window.O2_ICONS.svg('<path d="M5 12h14M12 5l7 7-7 7"/>')
};
