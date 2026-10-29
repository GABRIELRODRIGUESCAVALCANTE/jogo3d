/**
 * Como jogar: controles e dicas.
 */
import type { Game } from '../../game/Game';
import { icon } from '../icons';
import type { UIManager } from '../UIManager';
import { Panel } from './Panel';

export class HelpPanel extends Panel {
  constructor(ui: UIManager, game: Game) {
    super(ui, game, 'ajuda', 'Como jogar', 'info', 'wide');
  }

  render(): void {
    this.body.innerHTML = `
      <div class="help-grid">
        <section>
          <h3>${icon('tela')} Computador</h3>
          <ul class="keys-list">
            <li><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> ou setas <span>Andar</span></li>
            <li><kbd>Shift</kbd> <span>Correr (gasta energia)</span></li>
            <li><kbd>Espaço</kbd> <span>Pular</span></li>
            <li>Mouse <span>Girar a câmera (clique na tela para capturar)</span></li>
            <li>Roda do mouse <span>Aproximar / afastar</span></li>
            <li><kbd>E</kbd> ou clique <span>Interagir / coletar (segure para repetir)</span></li>
            <li><kbd>I</kbd> <span>Inventário</span></li>
            <li><kbd>C</kbd> <span>Fabricação</span></li>
            <li><kbd>B</kbd> <span>Construção</span> · <kbd>R</kbd> <span>girar</span></li>
            <li><kbd>M</kbd> <span>Mapa</span> · <kbd>J</kbd> <span>Missões</span></li>
            <li><kbd>T</kbd> <span>Acender / apagar a tocha</span></li>
            <li><kbd>Esc</kbd> <span>Pausa / fechar menus</span></li>
          </ul>
        </section>
        <section>
          <h3>${icon('mao')} Celular e tablet</h3>
          <ul class="keys-list">
            <li><b>Lado esquerdo</b> <span>Joystick: arraste para andar. Empurre até a borda para correr.</span></li>
            <li><b>Lado direito</b> <span>Arraste para girar a câmera.</span></li>
            <li><b>Botão de mão</b> <span>Interagir / coletar (segure para repetir).</span></li>
            <li><b>Botão de seta</b> <span>Pular.</span></li>
            <li><b>Ícones no topo</b> <span>Inventário, fabricação, construção, mapa, missões e pausa.</span></li>
          </ul>
          <h3>${icon('estrela')} Dicas</h3>
          <ul class="tips">
            <li>Siga o <b>feixe de luz dourado</b>: ele marca o objetivo da missão.</li>
            <li>Com o <b>machado</b>, cada golpe rende o dobro de madeira.</li>
            <li>Coma frutas para recuperar energia. Frutas assadas na fogueira deixam você <b>bem alimentado</b>.</li>
            <li>À noite, acenda a tocha ou construa fogueiras e lanternas.</li>
            <li>Durma na cabana para pular a noite. O jogo salva sozinho a cada minuto.</li>
          </ul>
          <h3>${icon('info')} Créditos</h3>
          <ul class="tips credits">
            <li>Robô: "RobotExpressive", de Tomás Laulhé (Quaternius) — CC0.</li>
            <li>Raposa: modelo de PixelMannen (CC0); animação de tomkranis e conversão de @AsoboStudio e @scurest (CC BY 4.0) — Khronos glTF Sample Assets.</li>
            <li>Efeitos sonoros: Kenney (kenney.nl) — CC0.</li>
            <li>Feito com Three.js, TypeScript e Vite.</li>
          </ul>
        </section>
      </div>`;
  }
}
