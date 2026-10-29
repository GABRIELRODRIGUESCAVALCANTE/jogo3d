/**
 * Ponto de entrada do jogo.
 * 1. Carrega fontes e estilos.
 * 2. Verifica se o navegador suporta WebGL 2.
 * 3. Cria e inicia o jogo, mostrando uma mensagem clara se algo falhar.
 */
import '@fontsource/fredoka/latin-500.css';
import '@fontsource/fredoka/latin-600.css';
import '@fontsource/fredoka/latin-700.css';
import '@fontsource/nunito/latin-400.css';
import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-800.css';
import './style.css';
import { checkWebGLSupport } from './core/webgl';
import { Game } from './game/Game';
import { escapeHtml } from './ui/dom';

declare global {
  interface Window {
    /** Acesso ao jogo pelo console do navegador (útil para depurar). */
    alemDoHorizonte?: Game;
    /** Avisa o index.html de que o código do jogo carregou. */
    __adhIniciado?: boolean;
  }
}

window.__adhIniciado = true;

let started = false;

/** Tela de erro amigável (usada quando o jogo não consegue iniciar). */
function showFatal(title: string, message: string, details?: string): void {
  const app = document.getElementById('app')!;
  app.innerHTML = `
    <div class="fatal">
      <div class="fatal-box">
        <h1 class="game-title">Além do <span>Horizonte</span></h1>
        <h2>${escapeHtml(title)}</h2>
        <p>${escapeHtml(message)}</p>
        ${details ? `<details><summary>Detalhes técnicos</summary><pre>${escapeHtml(details)}</pre></details>` : ''}
        <button class="btn btn-primary" onclick="location.reload()">Tentar novamente</button>
      </div>
    </div>`;
}

async function start(): Promise<void> {
  const support = checkWebGLSupport();
  if (!support.ok) {
    showFatal(
      'Gráficos 3D não suportados',
      `${support.reason} Tente atualizar o navegador (Chrome, Edge, Firefox ou Safari recentes) ou ativar a aceleração por hardware nas configurações.`,
    );
    return;
  }

  const container = document.getElementById('game-container')!;
  const uiRoot = document.getElementById('ui-root')!;
  const game = new Game(container, uiRoot);
  window.alemDoHorizonte = game;
  try {
    await game.init();
    started = true;
  } catch (err) {
    console.error('[Além do Horizonte] falha ao iniciar', err);
    const details = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
    showFatal('Não foi possível iniciar o jogo', 'Ocorreu um erro ao preparar o mundo 3D.', details);
  }
}

// Erros antes de o jogo iniciar viram uma tela de erro; depois, só são registrados.
window.addEventListener('error', (event) => {
  if (!started && event.error) {
    showFatal('Erro ao carregar o jogo', 'Algum arquivo não pôde ser carregado. Verifique sua conexão e tente novamente.', String(event.error?.stack ?? event.message));
  }
});
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Além do Horizonte] erro não tratado', event.reason);
});
// Quando uma nova versão é publicada, arquivos antigos podem sumir: recarrega.
window.addEventListener('vite:preloadError', () => window.location.reload());

void start();
