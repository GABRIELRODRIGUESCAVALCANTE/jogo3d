/**
 * Detecção simples do tipo de dispositivo.
 * Usada para escolher os controles (teclado/mouse ou toque) e a qualidade
 * gráfica inicial.
 */

/** Verdadeiro quando o aparelho usa principalmente toque (celulares e tablets). */
export function isTouchDevice(): boolean {
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const hover = window.matchMedia?.('(hover: hover)').matches ?? true;
  return coarse || (navigator.maxTouchPoints > 0 && !hover);
}

/** Estimativa grosseira de um aparelho modesto (pouca memória ou poucos núcleos). */
export function isLowEndDevice(): boolean {
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const cores = navigator.hardwareConcurrency ?? 8;
  return memory <= 4 || cores <= 4;
}

/** Verdadeiro em telas em pé (retrato). */
export function isPortrait(): boolean {
  return window.innerHeight > window.innerWidth;
}

/** Tenta entrar em tela cheia (pode falhar em alguns navegadores — tudo bem). */
export async function requestFullscreen(): Promise<boolean> {
  try {
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    if (document.fullscreenElement) return true;
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
    else return false;
    // Em celulares, tenta travar em paisagem.
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await orientation?.lock?.('landscape').catch(() => undefined);
    return true;
  } catch {
    return false;
  }
}

export async function exitFullscreen(): Promise<void> {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
  } catch {
    /* ignorado */
  }
}

export function isFullscreen(): boolean {
  return !!document.fullscreenElement;
}
