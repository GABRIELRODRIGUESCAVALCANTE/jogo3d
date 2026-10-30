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
| `npm run test:e2e`  | Abre o jogo num navegador e joga sozinho (Playwright)             |
| `npm run typecheck` | Só verifica os tipos                                              |

Na primeira vez, para os testes de ponta a ponta, instale o navegador do Playwright:

```bash
npx playwright install chromium
```

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
As teclas acima são as padrão; todas (menos o Esc) podem ser trocadas em **Opções → Teclado**.

---

## O que já existe no jogo

- Cena 3D low-poly com terreno, praia, floresta, montanhas, caverna, ruínas, oceano animado, céu e nuvens.
- Personagem em terceira pessoa com caminhada, corrida, pulo, natação e animações procedurais.
- Câmera que segue o personagem, desvia do terreno e se aproxima dentro da caverna e da cabana.
- Colisão com árvores, pedras, paredes e construções (dá para subir em pedras e pisos).
- Coleta de **madeira, pedra, fibra, frutas e cristais**; os recursos renascem com o tempo.
- **Fome (saciedade)**: diminui com o tempo; com fome a energia volta devagar, faminto ela não volta.
- **Durabilidade das ferramentas** (machado, picareta, vara de pesca e a tocha, que queima enquanto acesa).
- **Pesca** com minijogo (lançar, esperar a boia afundar e puxar na hora certa) perto dos cardumes.
- **Horta**: sementes do capim alto, canteiro, crescimento em tempo de jogo e colheita de batatas-doces.
- **Baú de armazenamento** para guardar itens.
- **Construção modular** em grade de 2 m: piso, paredes (lisa, com porta, com janela) e telhado de palha.
- **Barco a vela** (depois de acender o farol): construa na água rasa, embarque e navegue pelo mar.
- **Ilha da Aurora** (capítulo 2): uma segunda ilha a nordeste, gerada **sob demanda** — o terreno é
  montado aos poucos (um pedaço por quadro) quando você se aproxima. Tem floresta azulada, três
  pilares de cristal e o Observatório dos Lumeni, que acende uma aurora no céu noturno.
- Fauna: raposas animadas (glTF), caranguejos, gaivotas e peixes que saltam da água.
- Personagem à escolha: Explorador ou Robô (modelo glTF com animações e gestos).
- Inventário visual, comida que restaura energia e o bônus "Bem alimentado".
- Fabricação: corda, machado, picareta, tocha, vara de pesca e comidas assadas (com estações: bancada e fogueira).
- Construção com pré-visualização (verde/vermelho), rotação e remoção: fogueira, bancada, **cabana**, baú, canteiro, peças modulares, cerca, caminho e lanterna.
- 22 missões: capítulo 1 (15), capítulo 2 na Ilha da Aurora (4) e 3 opcionais, com recompensas e finais.
- Experiência e níveis (que desbloqueiam receitas e construções e aumentam a energia).
- Mapa de exploração com névoa, minimapa giratório e feixe de luz que aponta o objetivo.
- Ciclo de dia e noite (sol, lua, estrelas), luzes de fogueiras, lanternas e tocha; dormir na cabana pula a noite.
- Salvamento automático (a cada minuto, ao concluir missões, ao construir e ao sair da aba), salvamento manual, carregamento e opção de **apagar o salvamento com confirmação**.
- **Três espaços de salvamento**, com **exportar** (baixa um arquivo `.json`) e **importar** — para guardar uma cópia ou continuar em outro aparelho.
- **Acessibilidade**: teclas configuráveis (Opções → Teclado), tamanho da interface, cores para daltonismo (azul/laranja) e "reduzir movimento" (sem tremor de câmera e com menos animações).
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

### Expansão do mundo (várias ilhas)

Cada ilha é uma `IslandShape` em `src/game/world/islands.ts`: centro, tamanho, resolução e a
função de altura. O `TerrainSet` responde a altura do chão em qualquer ponto do mundo, perguntando
à ilha certa. A ilha principal é montada no carregamento; a Ilha da Aurora só é criada quando o
jogador chega a ~340 m dela, e a malha aparece um *chunk* por quadro (`Terrain.buildNextChunk`).
Para adicionar uma terceira ilha: crie outra `IslandShape`, inclua em `ISLAND_SHAPES`, adicione
uma grade de exploração em `WorldState`, uma faixa densa na água (`Water.ts`) e o conteúdo
(recursos, marcos e missões), seguindo o exemplo da Aurora.

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

## Automação no GitHub (CI e publicação)

- **`.github/workflows/ci.yml`**: a cada push, verifica os tipos, roda os testes de lógica,
  gera o build e joga o jogo num navegador (testes de ponta a ponta, incluindo a história
  completa, controles de toque e o aviso de navegador sem WebGL).
- **`.github/workflows/deploy.yml`**: a cada push na branch `main`, publica o jogo no
  **GitHub Pages**. Configuração única: no GitHub, abra *Settings → Pages* e, em *Source*,
  escolha **GitHub Actions**. O endereço fica `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.

## Funciona offline e pode ser instalado (PWA)

Na versão publicada, um *service worker* (gerado no build pelo `vite.config.ts`, a partir de
`src/pwa/service-worker.template.js`) guarda os arquivos do jogo. Depois da primeira visita,
o jogo abre mesmo sem internet. No celular, use "Adicionar à tela inicial" / "Instalar app"
para jogar em tela cheia, como um aplicativo.

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

## Gerar um APK Android

### Pelo GitHub (sem instalar nada)

O workflow `.github/workflows/android.yml` gera um APK de teste. No GitHub, abra
**Actions → APK Android → Run workflow** (ou crie uma tag como `v1.0.0`). Ao terminar,
baixe o arquivo em **Artifacts → alem-do-horizonte-apk**, copie para o celular e instale
(o Android pede para permitir "fontes desconhecidas"). O APK já vem na horizontal e com o ícone do jogo.

### No seu computador (Capacitor)

O Capacitor já está nas dependências do projeto. Requer Android Studio e JDK 21:

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
- Se o FPS ficar baixo por vários segundos, o jogo reduz a qualidade sozinho
  (pode ser desligado em **Opções → Ajustar qualidade automaticamente**).
- Em **Opções → Gráficos** há um diagnóstico com FPS, resolução, chamadas de desenho,
  triângulos e o nome da placa de vídeo — útil para testar em celulares reais.
- Ative **Opções → Mostrar FPS** para acompanhar o desempenho.

## Créditos e licença

Código, modelos low-poly do mundo, ícones e música foram criados por código para este projeto.
Recursos de terceiros (lista completa em `public/assets/CREDITOS.txt`):

- **Robô** (`robo.glb`): "RobotExpressive", de Tomás Laulhé (Quaternius) — CC0.
- **Raposa** (`raposa.glb`): "Fox" do glTF-Sample-Assets (Khronos) — modelo de PixelMannen (CC0);
  rigging/animação de tomkranis e conversão de @AsoboStudio e @scurest
  ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)).
- **Efeitos sonoros** gravados: [Kenney](https://kenney.nl) — CC0.
Bibliotecas: [Three.js](https://threejs.org) (MIT), [Vite](https://vite.dev) (MIT),
fontes [Fredoka](https://fonts.google.com/specimen/Fredoka) e
[Nunito](https://fonts.google.com/specimen/Nunito) via Fontsource (SIL Open Font License).
