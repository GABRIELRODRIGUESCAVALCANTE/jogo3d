# Além do Horizonte

Aventura 3D de mundo aberto que roda direto no navegador (computador, tablet e celular).
Você acorda numa ilha misteriosa, coleta recursos, fabrica ferramentas, constrói sua cabana
e desvenda os segredos dos **Lumeni**, uma civilização desaparecida.

Feito com **TypeScript + Three.js + Vite**, sem servidor, sem cadastro e sem serviços externos.

---

## Como executar no seu computador

Pré-requisito: **Node.js 20.19+ ou 22.12+** (inclui o `npm`). Baixe em <https://nodejs.org>.

```bash
npm install
```

```bash
npm run dev
```

Abra o endereço mostrado no terminal (normalmente <http://localhost:5173>).
O comando já usa `--host`, então o terminal também mostra um endereço de rede
(ex.: `http://192.168.0.10:5173`) para testar no celular conectado ao mesmo Wi‑Fi.

### Outros comandos

| Comando             | O que faz                                                         |
| ------------------- | ----------------------------------------------------------------- |
| `npm run dev`       | Servidor de desenvolvimento com recarga automática                |
| `npm run build`     | Verifica os tipos (TypeScript) e gera a versão de produção em `dist/` |
| `npm run preview`   | Serve a pasta `dist/` localmente para testar a versão de produção |
| `npm test`          | Roda os testes automáticos da lógica do jogo (Vitest)             |
| `npm run typecheck` | Só verifica os tipos                                              |

---

## Controles

**Computador**

| Tecla                     | Ação                                          |
| ------------------------- | --------------------------------------------- |
| `W A S D` ou setas        | Andar                                         |
| `Shift`                   | Correr (gasta energia)                        |
| `Espaço`                  | Pular                                         |
| Mouse                     | Girar a câmera (clique na tela para capturar) |
| Roda do mouse             | Aproximar/afastar a câmera                    |
| `E` ou clique             | Interagir/coletar (segure para repetir)       |
| `I` / `C` / `B`           | Inventário / Fabricação / Construção          |
| `M` / `J`                 | Mapa / Missões                                |
| `R`                       | Girar construção                              |
| `T`                       | Acender/apagar a tocha                        |
| `Esc`                     | Pausa / fechar menus                          |

**Celular e tablet**

- Joystick virtual à esquerda (empurre até a borda para correr).
- Arraste no lado direito para girar a câmera.
- Botões de pular e interagir (o botão mostra a ação: "Cortar árvore", "Abrir baú"...).
- Ícones no topo: inventário, fabricação, construção, mapa, missões e pausa.

O tipo de controle é detectado automaticamente e pode ser trocado em **Opções → Tipo de controle**.

---

## O que já existe no jogo

- Cena 3D low-poly com terreno, praia, floresta, montanhas, caverna, ruínas, oceano animado, céu e nuvens.
- Personagem em terceira pessoa com caminhada, corrida, pulo, natação e animações procedurais.
- Câmera que segue o personagem, desvia do terreno e se aproxima dentro da caverna e da cabana.
- Colisão com árvores, pedras, paredes e construções (dá para subir em pedras e pisos).
- Coleta de **madeira, pedra, fibra, frutas e cristais**; os recursos renascem com o tempo.
- Inventário visual, comida que restaura energia e o bônus "Bem alimentado".
- Fabricação: corda, machado, picareta, tocha e fruta assada (com estações: bancada e fogueira).
- Construção com pré-visualização (verde/vermelho), rotação e remoção: fogueira, bancada, **cabana**, cerca, caminho e lanterna.
- 15 missões encadeadas com objetivos, recompensas e um final.
- Experiência e níveis (que desbloqueiam receitas e construções e aumentam a energia).
- Mapa de exploração com névoa, minimapa giratório e feixe de luz que aponta o objetivo.
- Ciclo de dia e noite (sol, lua, estrelas), luzes de fogueiras, lanternas e tocha; dormir na cabana pula a noite.
- Salvamento automático (a cada minuto, ao concluir missões, ao construir e ao sair da aba), salvamento manual, carregamento e opção de **apagar o salvamento com confirmação**.
- Áudio sintetizado (efeitos, ondas, vento, pássaros, grilos e música suave), com volumes separados.
- Opções de qualidade gráfica (Baixa/Média/Alta), sensibilidade, inversão do eixo e duração do dia.
- Tratamento de redimensionamento, perda do contexto WebGL, navegador sem WebGL 2 e falhas de carregamento.

---

## Estrutura do projeto

```
index.html                 Página principal (contém o aviso de falha de carregamento)
vite.config.ts             Configuração do Vite (base relativa: funciona em subpastas e no Capacitor)
capacitor.config.json      Configuração pronta para empacotar como app Android (opcional)
public/
  manifest.webmanifest     Permite "Adicionar à tela inicial" no celular
  assets/icon.svg          Ícone do jogo
src/
  main.ts                  Ponto de entrada: verifica WebGL e inicia o jogo
  style.css                Toda a aparência da interface
  core/                    Utilidades sem regra de jogo
    AudioManager.ts        Sons sintetizados (Web Audio)
    Input.ts               Teclado, mouse e toque unificados
    Settings.ts            Opções e níveis de qualidade
    Device.ts, webgl.ts    Detecção de aparelho e suporte gráfico
    storage.ts             localStorage seguro (cai para memória se bloqueado)
    EventBus.ts, math.ts, noise.ts
  game/
    Game.ts                "Maestro": cria tudo, liga os eventos e roda o laço principal
    World.ts               Monta o mundo 3D (terreno, água, céu, recursos, marcos)
    Player.ts              Movimento, física simples, energia e animação
    CameraController.ts    Câmera em terceira pessoa
    Collision.ts           Colisão 2D com círculos e caixas giradas
    InteractionSystem.ts   Escolhe o objeto à frente e executa a ação
    Inventory.ts           Itens e quantidades
    Crafting.ts            Regras de fabricação
    Building.ts            Posicionamento, validação e remoção de construções
    Quests.ts              Missões, objetivos e recompensas
    Progression.ts         Experiência e níveis
    DayNight.ts            Sol, lua, cores do céu e luzes
    LightManager.ts        Número fixo de luzes distribuído às fontes mais próximas
    Particles.ts           Lascas, poeira e faíscas
    SaveSystem.ts          Salvar/carregar/apagar
    WorldState.ts          Marcadores da história, regiões e névoa do mapa
    save/                  Formato do salvamento e provedores de armazenamento
    data/                  DADOS do jogo: itens, receitas, construções, missões, regiões, textos
    world/                 Terreno, água, céu, recursos, decorações, marcos e layout da ilha
    models/                Modelos low-poly feitos por código (personagem, árvores, cabana...)
  ui/
    UIManager.ts           Telas, painéis, diálogos e avisos
    HUD.ts                 Barras, recursos, missão, relógio e minimapa
    TouchControls.ts       Joystick e botões de toque
    MapRenderer.ts         Desenho do mapa e do minimapa
    Notifications.ts, Dialogs.ts, icons.ts, dom.ts
    panels/                Inventário, fabricação, construção, mapa, missões, pausa, opções e ajuda
tests/                     Testes automáticos (Vitest)
```

### Como mexer no jogo (dicas para iniciantes)

- **Novo item:** acrescente em `src/game/data/items.ts` (e um ícone em `src/ui/icons.ts`).
- **Nova receita:** `src/game/data/recipes.ts`.
- **Nova construção:** `src/game/data/structures.ts` + modelo em `src/game/models/structures.ts`
  + colisões/uso em `Building.place()`.
- **Nova missão:** `src/game/data/quests.ts` (os objetivos podem ser coletar, fabricar, usar,
  construir, visitar região, interagir ou alcançar nível).
- **Lugares e regiões:** `src/game/world/layout.ts` e `src/game/data/regions.ts`.
- **Dificuldade da coleta:** `src/game/data/resources.ts` (golpes, quantidades, tempo para renascer).

Os sistemas conversam por **eventos** (`src/game/events.ts`), então um módulo novo pode reagir,
por exemplo, a `resource:gathered` sem alterar o inventário.

### Expansão do mundo

O terreno é gerado por uma função determinística (mesma semente = mesma ilha) e montado em
*chunks* (`Terrain.ts`), que já são escondidos quando ficam longe. Para crescer o mundo:
aumente `WORLD_SIZE`/`TERRAIN_SEGMENTS` em `layout.ts`, adicione regiões e lugares, e — para mapas
muito grandes — gere/carregue os chunks perto do jogador em vez de todos de uma vez.

---

## Salvamento

O progresso fica no **localStorage** do navegador (posição, inventário, construções, missões,
experiência, regiões descobertas, mapa explorado, hora do dia e estado dos recursos).
As opções ficam separadas, em outra chave.

A camada de armazenamento é uma interface (`src/game/save/StorageProvider.ts`) com métodos
assíncronos. Para criar contas e salvamento em nuvem no futuro, basta implementar outro provedor
(há um exemplo comentado no arquivo) e passá-lo ao `SaveSystem` — o resto do jogo não muda.
O formato tem número de versão e uma função de migração (`save/SaveData.ts`).

Se o navegador bloquear o armazenamento (modo privado, por exemplo), o jogo avisa e continua
funcionando com salvamento apenas em memória.

---

## Publicar na internet (site estático com HTTPS)

```bash
npm run build
```

Envie o conteúdo da pasta `dist/` para qualquer hospedagem de sites estáticos. Todas abaixo
oferecem HTTPS automático e gratuito:

- **Netlify:** arraste a pasta `dist/` em <https://app.netlify.com/drop>
  (ou conecte o repositório com comando `npm run build` e pasta `dist`).
- **Vercel / Cloudflare Pages:** importe o repositório; comando `npm run build`, pasta `dist`.
- **GitHub Pages:** publique o conteúdo de `dist/` (ex.: com a ação oficial
  `actions/deploy-pages`). Como o projeto usa caminhos relativos (`base: './'`), funciona
  também em subpastas como `usuario.github.io/alem-do-horizonte/`.

Depois é só compartilhar o link. No celular, o navegador permite "Adicionar à tela inicial".

---

## Gerar um APK Android com Capacitor (futuro)

O projeto já está preparado (`base: './'` e `capacitor.config.json`). Passo a passo:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
```

```bash
npm run build
```

```bash
npx cap add android
```

```bash
npx cap sync android
```

```bash
npx cap open android
```

O último comando abre o Android Studio, onde você gera o APK/AAB
(*Build → Build Bundle(s) / APK(s)*). Sempre que mudar o jogo, rode `npm run build` e
`npx cap sync android` novamente. Requer Android Studio e JDK instalados.

---

## Desempenho

- Árvores, pedras, capim e decorações usam `InstancedMesh` (centenas de objetos em uma chamada de desenho).
- Número fixo de luzes pontuais (sem recompilar shaders), terreno em chunks com distância de visão.
- Qualidade **Baixa** desliga sombras, reduz a resolução e a vegetação — recomendada para celulares simples.
- O jogo sugere reduzir a qualidade se detectar FPS baixo por vários segundos.
- Ative **Opções → Mostrar FPS** para acompanhar o desempenho.

## Créditos e licença

Código, modelos low-poly, ícones e sons foram criados por código para este projeto.
Bibliotecas: [Three.js](https://threejs.org) (MIT), [Vite](https://vite.dev) (MIT),
fontes [Fredoka](https://fonts.google.com/specimen/Fredoka) e
[Nunito](https://fonts.google.com/specimen/Nunito) via Fontsource (SIL Open Font License).
