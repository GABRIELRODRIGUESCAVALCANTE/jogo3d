/**
 * Ícones em SVG desenhados à mão (nenhum arquivo externo necessário).
 * Ícones de itens são coloridos; ícones de interface usam `currentColor`
 * para herdar a cor do texto.
 */

const svg = (body: string, extra = '') =>
  `<svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" ${extra}>${body}</svg>`;

const ui = (body: string) =>
  svg(body, 'fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"');

export const ICONS: Record<string, string> = {
  // ----- Itens -----
  madeira: svg(`
    <rect x="3" y="10" width="23" height="12" rx="6" fill="#9a6a3c"/>
    <path d="M7 13.5h11M9 18.5h10" stroke="#74491f" stroke-width="1.5" stroke-linecap="round"/>
    <ellipse cx="25" cy="16" rx="4.2" ry="6" fill="#efc489"/>
    <ellipse cx="25" cy="16" rx="2.3" ry="3.4" fill="none" stroke="#b07a43" stroke-width="1.3"/>
    <circle cx="25" cy="16" r=".9" fill="#b07a43"/>`),
  pedra: svg(`
    <path d="M5 21l3-9 7-4 8 2 5 7-2 7-9 2-9-1z" fill="#9c978e"/>
    <path d="M8 12l7-4 8 2-6 5z" fill="#c4bfb6"/>
    <path d="M17 15l6-5 5 7-6 2z" fill="#857f77"/>
    <path d="M5 21l12-6 5 4-2 6-9 2z" fill="#a9a399"/>`),
  fibra: svg(`
    <path d="M10 29c1-8 0-15-4-23M14 29c0-9 1-16 0-24M18 29c0-8 2-15 6-22M22 29c-1-6 1-11 5-15" stroke="#a5c957" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path d="M12 29c0-7-2-12-5-17M20 29c1-7 3-11 7-14" stroke="#c7d36a" stroke-width="2" fill="none" stroke-linecap="round"/>
    <rect x="9" y="19" width="15" height="4" rx="2" fill="#c9a26b"/>`),
  fruta: svg(`
    <path d="M16 9c7 0 11 5 11 11s-5 9-11 9-11-3-11-9 4-11 11-11z" fill="#ff7a3d"/>
    <path d="M16 9c5 0 8 3 9 7-4-3-9-3-13 0-2 1-4 1-6 0 1-4 5-7 10-7z" fill="#ffb347"/>
    <ellipse cx="11" cy="17" rx="2" ry="3" fill="#ffd28a" opacity=".8"/>
    <path d="M16 9c0-3 1-5 3-6" stroke="#6b4a2a" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M18 6c3-3 7-2 8 0-3 2-6 2-8 0z" fill="#5cb848"/>`),
  fruta_assada: svg(`
    <path d="M4 28L27 5" stroke="#8b5a2b" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="13" cy="19" r="6" fill="#c8612a"/>
    <circle cx="20" cy="12" r="5" fill="#d9772f"/>
    <circle cx="11.5" cy="17.5" r="1.6" fill="#f2a65a"/>
    <path d="M22 26c-1-2 1-3 0-5M26 23c-1-2 1-3 0-5" stroke="#d7d7d7" stroke-width="1.5" fill="none" stroke-linecap="round"/>`),
  cristal: svg(`
    <path d="M16 2l6 9-6 19-6-19z" fill="#7ef4ff"/>
    <path d="M16 2l6 9-6 19z" fill="#3fc3e6"/>
    <path d="M8 13l3 4-3 10-3-10z" fill="#b896ff"/>
    <path d="M24 14l3 4-3 9-3-9z" fill="#b896ff"/>
    <path d="M24 14l3 4-3 9z" fill="#8b6bdc"/>
    <path d="M13 9l3-5 2 6z" fill="#e6fdff" opacity=".9"/>`),
  reliquia: svg(`
    <path d="M6 6l14-2 7 6-2 17-12 2-8-6z" fill="#6c7280"/>
    <path d="M6 6l14-2 7 6-9 2z" fill="#8a91a0"/>
    <circle cx="16" cy="17" r="5" fill="none" stroke="#5ee8ff" stroke-width="1.8"/>
    <path d="M16 10v3M16 21v3M9 17h3M20 17h3" stroke="#5ee8ff" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="16" cy="17" r="1.6" fill="#b8f6ff"/>`),
  corda: svg(`
    <ellipse cx="16" cy="17" rx="11" ry="9" fill="none" stroke="#c9a26b" stroke-width="3.2"/>
    <ellipse cx="16" cy="17" rx="6" ry="4.6" fill="none" stroke="#b08a52" stroke-width="3"/>
    <path d="M25 22c2 3 3 5 2 7" stroke="#c9a26b" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M8 12l2 2M13 9l1 2.5M20 9l-1 2.5" stroke="#8a6a3c" stroke-width="1.2"/>`),
  machado: svg(`
    <path d="M9 29L22 9" stroke="#8b5a2b" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M17 6c4-3 10-2 12 3l-8 7c-2-1-4-4-4-6z" fill="#b8bfc6"/>
    <path d="M24 5c3 1 5 3 5 4l-8 7c0-2 0-4-1-5z" fill="#8d959c"/>
    <path d="M17 13l3 2" stroke="#c9a26b" stroke-width="3" stroke-linecap="round"/>`),
  picareta: svg(`
    <path d="M10 29L20 10" stroke="#8b5a2b" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M4 10c6-6 18-7 25-2-6-1-12 0-17 3-3 1-6 1-8-1z" fill="#9aa1a8"/>
    <path d="M29 8c-6-1-12 0-17 3l3 2c4-3 9-4 14-5z" fill="#7d858c"/>`),
  tocha: svg(`
    <path d="M14 30l2-16 2 16z" fill="#8b5a2b"/>
    <rect x="12.5" y="13" width="7" height="3" rx="1" fill="#c9a26b"/>
    <path d="M16 2c5 4 6 8 3 11h-6c-3-3-1-7 3-11z" fill="#ff8a3d"/>
    <path d="M16 6c2.5 2.5 3 5 1.4 7h-2.8c-1.6-2-1-4.5 1.4-7z" fill="#ffd166"/>`),
  cabana: svg(`
    <path d="M3 15L16 4l13 11" fill="#c9573c"/>
    <path d="M3 15L16 4l13 11-2 1L16 7 5 16z" fill="#a8442f"/>
    <rect x="6" y="15" width="20" height="13" fill="#9a6a3f"/>
    <path d="M6 19h20M6 23h20" stroke="#7a5232" stroke-width="1.3"/>
    <rect x="13" y="19" width="6" height="9" fill="#5e3d24"/>
    <rect x="21" y="5" width="3" height="6" fill="#8e877b"/>`),
  fogueira: svg(`
    <path d="M5 27l22-6M5 21l22 6" stroke="#8b5a2b" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M16 3c6 5 8 10 4 16h-8c-4-6-2-11 4-16z" fill="#ff6b2d"/>
    <path d="M16 9c3 3 4 6 2 10h-4c-2-4-1-7 2-10z" fill="#ffd166"/>`),
  bancada: svg(`
    <rect x="3" y="13" width="26" height="4" rx="1" fill="#b98552"/>
    <path d="M6 17v11M26 17v11M6 23h20" stroke="#7a5232" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M10 13V8M8 8h7" stroke="#8d9196" stroke-width="2.6" stroke-linecap="round"/>
    <rect x="18" y="8" width="7" height="5" rx="1" fill="#9d978d"/>`),
  cerca: svg(`
    <path d="M7 28V8l2-3 2 3v20M15 28V8l2-3 2 3v20M23 28V8l2-3 2 3v20" fill="#9a6a3f"/>
    <path d="M4 13h25M4 22h25" stroke="#7a5232" stroke-width="2.6" stroke-linecap="round"/>`),
  caminho: svg(`
    <ellipse cx="9" cy="24" rx="6" ry="4" fill="#b3ada3"/>
    <ellipse cx="22" cy="20" rx="6" ry="4" fill="#c2bcb1"/>
    <ellipse cx="11" cy="12" rx="5" ry="3.5" fill="#c2bcb1"/>
    <ellipse cx="23" cy="8" rx="5" ry="3.3" fill="#b3ada3"/>`),
  lanterna: svg(`
    <path d="M16 29V12" stroke="#7a5232" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M10 6l6-4 6 4z" fill="#7a5232"/>
    <rect x="11" y="6" width="10" height="9" rx="1" fill="none" stroke="#7a5232" stroke-width="1.6"/>
    <path d="M16 7l2.5 3.5-2.5 4-2.5-4z" fill="#7ef4ff"/>
    <rect x="12" y="27" width="8" height="3" rx="1" fill="#9d978d"/>`),

  vara_de_pesca: svg(`
    <path d="M5 29L25 4" stroke="#8b5a2b" stroke-width="2.6" stroke-linecap="round"/>
    <path d="M25 4c2 6 3 13 1 19" stroke="#e8f4ff" stroke-width="1.2" fill="none"/>
    <circle cx="26" cy="24" r="2.4" fill="#ff5a4f"/>
    <rect x="7" y="22" width="4" height="4" rx="2" fill="#c9a26b"/>`),
  peixe: svg(`
    <path d="M4 16c5-7 14-8 20-2l5-5v14l-5-5c-6 6-15 5-20-2z" fill="#3fb0e6"/>
    <path d="M4 16c5-3 12-4 18 0-6 3-13 3-18 0z" fill="#8fe0ff"/>
    <circle cx="9" cy="14" r="1.5" fill="#123"/>`),
  peixe_assado: svg(`
    <path d="M4 17c5-7 14-8 20-2l5-5v14l-5-5c-6 6-15 5-20-2z" fill="#c8732e"/>
    <path d="M10 14l2 6M15 13l2 7M20 14l1 5" stroke="#7a3f14" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M12 7c-1-2 1-3 0-5M18 7c-1-2 1-3 0-5" stroke="#d7d7d7" stroke-width="1.4" fill="none" stroke-linecap="round"/>`),
  semente: svg(`
    <ellipse cx="11" cy="19" rx="4" ry="6" fill="#b88a4a" transform="rotate(-25 11 19)"/>
    <ellipse cx="21" cy="17" rx="4" ry="6" fill="#a8783c" transform="rotate(20 21 17)"/>
    <path d="M16 12c0-5 3-8 7-9-1 4-3 7-7 9z" fill="#5cb848"/>`),
  batata_doce: svg(`
    <path d="M5 20c2-8 13-13 21-8 4 3 1 11-7 13-7 2-15 2-14-5z" fill="#c8573a"/>
    <path d="M10 18c4-3 9-4 13-3" stroke="#e98b62" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M24 10c2-3 4-4 6-4-1 3-3 4-6 4z" fill="#5cb848"/>`),
  batata_assada: svg(`
    <path d="M5 20c2-8 13-13 21-8 4 3 1 11-7 13-7 2-15 2-14-5z" fill="#8a3e22"/>
    <path d="M12 16c3-2 7-2 9 0-3 3-6 3-9 0z" fill="#ffcf5c"/>
    <path d="M12 9c-1-2 1-3 0-5M18 9c-1-2 1-3 0-5" stroke="#d7d7d7" stroke-width="1.4" fill="none" stroke-linecap="round"/>`),
  semente_milho: svg(`
    <ellipse cx="10" cy="18" rx="3.5" ry="4.5" fill="#f2c53d"/>
    <ellipse cx="17" cy="21" rx="3.5" ry="4.5" fill="#e8b22c"/>
    <ellipse cx="22" cy="14" rx="3.5" ry="4.5" fill="#f5cf55"/>`),
  milho: svg(`
    <path d="M16 4c5 0 7 6 6 13s-3 11-6 11-5-4-6-11 1-13 6-13z" fill="#f5c935"/>
    <path d="M13 9h6M12 13h8M12 17h8M13 21h6" stroke="#d9a520" stroke-width="1.4"/>
    <path d="M10 27c-3-5-4-10-3-15 3 4 5 9 6 15zM22 27c3-5 4-10 3-15-3 4-5 9-6 15z" fill="#6cbf4a"/>`),
  milho_assado: svg(`
    <path d="M16 4c5 0 7 6 6 13s-3 11-6 11-5-4-6-11 1-13 6-13z" fill="#d99a2b"/>
    <path d="M13 9h6M12 13h8M12 17h8M13 21h6" stroke="#8a5a14" stroke-width="1.6"/>
    <path d="M9 7c-1-2 1-3 0-5M23 7c-1-2 1-3 0-5" stroke="#d7d7d7" stroke-width="1.4" fill="none" stroke-linecap="round"/>`),
  muda_abacaxi: svg(`
    <path d="M16 28c-4 0-6-1-6-3h12c0 2-2 3-6 3z" fill="#8a5a2e"/>
    <path d="M16 25L9 8l5 9 2-13 2 13 5-9z" fill="#4caf50"/>
    <path d="M16 25l-3-12 3 6 3-6z" fill="#7bd06a"/>`),
  abacaxi: svg(`
    <ellipse cx="16" cy="21" rx="7" ry="8.5" fill="#f2b632"/>
    <path d="M11 15l10 12M21 15l-10 12M9 20l7 8M23 20l-7 8" stroke="#c98a1c" stroke-width="1.3"/>
    <path d="M16 13l-5-10 4 5 1-6 1 6 4-5z" fill="#4caf50"/>`),
  salada_tropical: svg(`
    <path d="M4 16h24c0 7-5 12-12 12S4 23 4 16z" fill="#e9dcc0" stroke="#b9a27a" stroke-width="1.5"/>
    <circle cx="11" cy="14" r="3.5" fill="#ff6f61"/>
    <rect x="15" y="10" width="6" height="6" rx="1.5" fill="#f2b632"/>
    <circle cx="22" cy="14" r="3" fill="#ffa94d"/>
    <path d="M7 13c2-2 4-2 6 0" stroke="#4caf50" stroke-width="2" fill="none"/>`),
  ensopado: svg(`
    <path d="M5 14h22l-2 12H7z" fill="#5b6470"/>
    <path d="M5 14h22" stroke="#3b424b" stroke-width="2.4" stroke-linecap="round"/>
    <ellipse cx="16" cy="14.5" rx="10" ry="2.2" fill="#d9822b"/>
    <circle cx="12" cy="14" r="1.6" fill="#f5c935"/><circle cx="19" cy="14.4" r="1.6" fill="#c8573a"/>
    <path d="M12 9c-1-2 1-3 0-5M18 9c-1-2 1-3 0-5" stroke="#d7d7d7" stroke-width="1.4" fill="none" stroke-linecap="round"/>`),
  peixe_dourado: svg(`
    <circle cx="15" cy="16" r="12" fill="#ffe066" opacity="0.25"/>
    <path d="M4 16c5-7 14-8 20-2l5-5v14l-5-5c-6 6-15 5-20-2z" fill="#ffc533"/>
    <path d="M4 16c5-3 12-4 18 0-6 3-13 3-18 0z" fill="#fff0a0"/>
    <circle cx="9" cy="14" r="1.5" fill="#123"/>`),
  dourado_grelhado: svg(`
    <path d="M4 17c5-7 14-8 20-2l5-5v14l-5-5c-6 6-15 5-20-2z" fill="#e0a12a"/>
    <path d="M10 14l2 6M15 13l2 7M20 14l1 5" stroke="#8a5a14" stroke-width="1.6" stroke-linecap="round"/>
    <path d="M23 5l1 2 2 .5-2 .5-1 2-1-2-2-.5 2-.5z" fill="#fff6c2"/>`),
  bau: svg(`
    <rect x="4" y="13" width="24" height="14" rx="2" fill="#9a6a3f"/>
    <path d="M4 13c0-6 24-6 24 0z" fill="#b98552"/>
    <rect x="4" y="16" width="24" height="2.5" fill="#d9b24c"/>
    <rect x="14" y="15" width="4" height="6" rx="1" fill="#d9b24c"/>`),
  canteiro: svg(`
    <rect x="3" y="20" width="26" height="8" rx="1.5" fill="#6b4a2e"/>
    <rect x="3" y="18" width="26" height="3" fill="#7a5232"/>
    <path d="M9 18c-2-5 0-9 3-10 0 4-1 7-3 10zM16 18c0-6 2-9 5-10-1 4-2 7-5 10zM23 18c-1-4 1-7 3-8 0 3-1 6-3 8z" fill="#5cb848"/>`),
  piso: svg(`
    <path d="M3 18l13-7 13 7-13 7z" fill="#c4925e"/>
    <path d="M7 16l13 7M11 14l13 7M3 18v3l13 7v-3zM29 18v3l-13 7v-3z" stroke="#7a5232" stroke-width="1.2" fill="#9a6a3f"/>`),
  parede: svg(`
    <rect x="4" y="7" width="24" height="20" rx="1" fill="#9a6a3f"/>
    <path d="M4 12h24M4 17h24M4 22h24" stroke="#6b4528" stroke-width="1.5"/>`),
  parede_porta: svg(`
    <rect x="4" y="7" width="24" height="20" rx="1" fill="#9a6a3f"/>
    <path d="M4 12h24M4 17h24M4 22h24" stroke="#6b4528" stroke-width="1.5"/>
    <rect x="12" y="12" width="8" height="15" fill="#3a2614"/>`),
  parede_janela: svg(`
    <rect x="4" y="7" width="24" height="20" rx="1" fill="#9a6a3f"/>
    <path d="M4 12h24M4 22h24" stroke="#6b4528" stroke-width="1.5"/>
    <rect x="11" y="13" width="10" height="7" fill="#8fd3ff"/>
    <path d="M16 13v7" stroke="#6b4528" stroke-width="1.5"/>`),
  barco: svg(`
    <path d="M3 21h26l-4 6H8z" fill="#9a6a3f"/>
    <path d="M16 3v17" stroke="#6b4528" stroke-width="2"/>
    <path d="M16 4l9 15h-9z" fill="#f4ead2"/>
    <path d="M15 7l-8 12h8z" fill="#ffd9a0"/>
    <path d="M2 28c4-2 7 2 11 0s7 2 11 0 5 2 6 0" stroke="#3fb0e6" stroke-width="2" fill="none"/>`),
  escada: svg(`
    <path d="M5 27h6v-5h5v-5h5v-5h5V7h2v22H5z" fill="#c4925e" stroke="#7a5232" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M8 22L26 6" stroke="#7a5232" stroke-width="2" stroke-linecap="round"/>`),
  mesa: svg(`
    <rect x="4" y="11" width="24" height="4" rx="1" fill="#b98552"/>
    <path d="M7 15v12M25 15v12M11 15v8M21 15v8" stroke="#7a5232" stroke-width="2.4" stroke-linecap="round"/>`),
  cadeira: svg(`
    <path d="M10 4v12h13" stroke="#9a6a3f" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="9" y="15" width="15" height="3.5" rx="1" fill="#b98552"/>
    <path d="M11 19v9M22 19v9" stroke="#7a5232" stroke-width="2.4" stroke-linecap="round"/>`),
  tapete: svg(`
    <path d="M3 21l13-7 13 7-13 7z" fill="#c9573c"/>
    <path d="M8 21l8-4.3 8 4.3-8 4.3z" fill="#e9c46a"/>
    <path d="M12 21l4-2 4 2-4 2z" fill="#2a9d8f"/>`),
  vaso: svg(`
    <path d="M10 18h12l-2 10h-8z" fill="#c06a3e"/>
    <path d="M16 18V9M13 18l-3-7M19 18l3-6" stroke="#4caf50" stroke-width="1.6"/>
    <circle cx="16" cy="8" r="2.6" fill="#ff6f91"/><circle cx="10" cy="10" r="2.2" fill="#ffd166"/><circle cx="22" cy="11" r="2.2" fill="#9b5de5"/>`),
  telhado: svg(`
    <path d="M2 20L16 7l14 13z" fill="#d9b45a"/>
    <path d="M6 17h20M10 13h12" stroke="#a8843a" stroke-width="1.6"/>
    <rect x="6" y="20" width="20" height="3" fill="#7a5232"/>`),

  // ----- Interface -----
  mochila: ui(`<path d="M9 11a7 7 0 0 1 14 0v15a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2z"/><path d="M12 11V8a4 4 0 0 1 8 0v3"/><path d="M12 19h8v5h-8z"/>`),
  martelo: ui(`<path d="M15 13L5 26l2 2 12-11"/><path d="M14 8l6-4 8 8-4 6z"/>`),
  construir: ui(`<path d="M4 15L16 5l12 10"/><path d="M7 13v14h18V13"/><path d="M16 17v7M12.5 20.5h7"/>`),
  mapa: ui(`<path d="M4 8l8-3 8 3 8-3v19l-8 3-8-3-8 3z"/><path d="M12 5v19M20 8v19"/>`),
  missao: ui(`<path d="M8 4h13l4 4v20H8z"/><path d="M12 12h9M12 17h9M12 22h5"/>`),
  pausa: ui(`<path d="M11 7v18M21 7v18"/>`),
  engrenagem: ui(`<circle cx="16" cy="16" r="4"/><path d="M16 3v4M16 25v4M3 16h4M25 16h4M6.8 6.8l2.8 2.8M22.4 22.4l2.8 2.8M6.8 25.2l2.8-2.8M22.4 9.6l2.8-2.8"/>`),
  fechar: ui(`<path d="M8 8l16 16M24 8L8 24"/>`),
  girar: ui(`<path d="M25 16a9 9 0 1 1-3-6.7"/><path d="M23 4v6h-6"/>`),
  check: ui(`<path d="M6 17l6 6L26 9"/>`),
  pular: ui(`<path d="M16 26V7"/><path d="M8 14l8-8 8 8"/>`),
  mao: ui(`<path d="M10 17V8a2 2 0 0 1 4 0v7M14 14V6a2 2 0 0 1 4 0v8M18 14V8a2 2 0 0 1 4 0v9"/><path d="M22 13a2 2 0 0 1 4 0v5c0 6-4 10-9 10s-7-2-9-6l-3-5a2 2 0 0 1 3-2l2 2"/>`),
  correr: ui(`<path d="M18 3l-9 15h7l-2 11 9-15h-7z"/>`),
  salvar: ui(`<path d="M6 5h16l4 4v18H6z"/><path d="M10 5v7h10V5M10 27v-8h12v8"/>`),
  sair: ui(`<path d="M13 5H6v22h7"/><path d="M20 10l6 6-6 6M26 16H12"/>`),
  lixeira: ui(`<path d="M5 9h22M12 9V5h8v4M8 9l1.5 18h13L24 9"/><path d="M14 14v8M18 14v8"/>`),
  play: ui(`<path d="M10 6l16 10-16 10z"/>`),
  info: ui(`<circle cx="16" cy="16" r="12"/><path d="M16 15v8M16 10v.5"/>`),
  tela: ui(`<path d="M5 11V5h6M21 5h6v6M27 21v6h-6M11 27H5v-6"/>`),
  fome: svg(`<path d="M9 4v9a3 3 0 0 0 6 0V4M12 4v24" stroke="#ffb347" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M21 4c4 2 4 10 0 12v12" stroke="#ffb347" stroke-width="2.4" fill="none" stroke-linecap="round"/>`),
  remover: ui(`<path d="M6 26L26 6"/><path d="M5 15l7-7M17 27l10-10"/>`),
  alvo: ui(`<circle cx="16" cy="16" r="11"/><circle cx="16" cy="16" r="5"/><path d="M16 2v5M16 25v5M2 16h5M25 16h5"/>`),
  estrela: svg(`<path d="M16 3l4 8.5 9 1.2-6.6 6.2 1.7 9.1L16 23.6 7.9 28l1.7-9.1L3 12.7l9-1.2z" fill="#ffd166" stroke="#c98f1d" stroke-width="1.5" stroke-linejoin="round"/>`),
  raio: svg(`<path d="M18 2L7 18h8l-2 12 12-17h-8z" fill="#7bd88f" stroke="#3f9e57" stroke-width="1.5" stroke-linejoin="round"/>`),
  sol: svg(`<circle cx="16" cy="16" r="6.5" fill="#ffd166"/><path d="M16 3v4M16 25v4M3 16h4M25 16h4M6.8 6.8l2.8 2.8M22.4 22.4l2.8 2.8M6.8 25.2l2.8-2.8M22.4 9.6l2.8-2.8" stroke="#ffd166" stroke-width="2.4" stroke-linecap="round"/>`),
  lua: svg(`<path d="M21 4a12 12 0 1 0 7 17A10 10 0 0 1 21 4z" fill="#dfe7ff"/><circle cx="13" cy="15" r="1.6" fill="#b8c4ea"/><circle cx="17" cy="22" r="2" fill="#b8c4ea"/>`),
  nuvem: svg(`<path d="M9 24a6 6 0 0 1-.6-12A8 8 0 0 1 23.5 10 6.5 6.5 0 0 1 24 24z" fill="#d6dde6" stroke="#8e9aa8" stroke-width="1.5" stroke-linejoin="round"/>`),
  chuva: svg(`<path d="M9 19a5.5 5.5 0 0 1-.6-11A7.5 7.5 0 0 1 22.6 6.5 6 6 0 0 1 23 19z" fill="#aeb9c6" stroke="#6f7c8b" stroke-width="1.5" stroke-linejoin="round"/><path d="M10 23l-1.5 4M16 23l-1.5 4M22 23l-1.5 4" stroke="#6fb7ff" stroke-width="2.2" stroke-linecap="round"/>`),
  tempestade: svg(`<path d="M9 18a5.5 5.5 0 0 1-.6-11A7.5 7.5 0 0 1 22.6 5.5 6 6 0 0 1 23 18z" fill="#7d8794" stroke="#4a525e" stroke-width="1.5" stroke-linejoin="round"/><path d="M17 17l-4 7h4l-2 6 6-8h-4l2-5z" fill="#ffd166" stroke="#c99a2e" stroke-width="1" stroke-linejoin="round"/><path d="M9 22l-1.2 3.5M25 21l-1.2 3.5" stroke="#6fb7ff" stroke-width="2" stroke-linecap="round"/>`),
  fogueira_apagada: svg(`<path d="M7 26l18-5M7 21l18 5" stroke="#6b4a2f" stroke-width="3" stroke-linecap="round"/><path d="M14 17c-2-3 1-5 0-9M19 16c-1-2 1-4 0-6" stroke="#9aa4ae" stroke-width="2" stroke-linecap="round" fill="none"/>`),
  raposa: svg(`<path d="M6 6l5 7h10l5-7-1 11c0 6-4 10-9 10s-9-4-9-10z" fill="#e8743b"/><path d="M11 20c1.5 3 3 4 5 4s3.5-1 5-4c-2 1-3.5 1.5-5 1.5S13 21 11 20z" fill="#fff4e6"/><circle cx="12.5" cy="17" r="1.4" fill="#2b2b2b"/><circle cx="19.5" cy="17" r="1.4" fill="#2b2b2b"/><circle cx="16" cy="23" r="1.3" fill="#2b2b2b"/>`),
  papagaio: svg(`
    <path d="M12 30l2-7M17 30l-1-7" stroke="#5a4630" stroke-width="1.6" stroke-linecap="round"/>
    <ellipse cx="15" cy="17" rx="7" ry="9" fill="#3fbf4a"/>
    <path d="M10 15c-3 4-3 9 1 13l3-9z" fill="#2f8fdc"/>
    <circle cx="17" cy="9" r="6" fill="#e63946"/>
    <path d="M22 8c4 0 5 3 4 6-1-2-3-2-4-1z" fill="#ffd166"/>
    <circle cx="19" cy="8" r="1.8" fill="#fff"/><circle cx="19.5" cy="8" r="0.9" fill="#111"/>`),
  diario: svg(`
    <path d="M4 7c4-2 8-2 12 1v19c-4-3-8-3-12-1z" fill="#f6ecd2" stroke="#7a3f2a" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M28 7c-4-2-8-2-12 1v19c4-3 8-3 12-1z" fill="#f1e6c8" stroke="#7a3f2a" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M7 12h6M7 16h6M19 12h6M19 16h6M19 20h4" stroke="#b9a27a" stroke-width="1.2"/>`),
  bussola: svg(`<circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M16 6l3.5 10H12.5z" fill="#ff6b6b"/><path d="M16 26l-3.5-10h7z" fill="currentColor"/>`),
};

/** Retorna o SVG de um ícone (ou um círculo vazio se não existir). */
export function icon(name: string): string {
  return ICONS[name] ?? ui('<circle cx="16" cy="16" r="10"/>');
}
