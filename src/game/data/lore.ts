/**
 * Textos de história exibidos ao examinar objetos do mundo.
 */
export interface LoreEntry {
  title: string;
  paragraphs: string[];
}

export const LORE: Record<string, LoreEntry> = {
  destrocos: {
    title: 'Destroços do barco',
    paragraphs: [
      'O que sobrou do seu pequeno barco está espalhado pela areia. A tempestade veio do nada, com relâmpagos azulados que pareciam vir da própria ilha.',
      'Não há como consertá-lo agora. Primeiro, é preciso sobreviver: madeira, pedras e um abrigo.',
    ],
  },
  bau_praia: {
    title: 'Um baú antigo',
    paragraphs: [
      'Dentro do baú há cordas, frutas e um fragmento de pedra gravado com símbolos que brilham levemente.',
      'Os símbolos lembram um sol nascendo sobre o mar. Talvez existam outros fragmentos pela ilha.',
    ],
  },
  monolito: {
    title: 'O Monólito dos Lumeni',
    paragraphs: [
      '"Nós, os Lumeni, acendemos a luz que guiava os viajantes através do mar sem fim."',
      '"Quando partimos para além do horizonte, dividimos a chave em três: uma entregamos à areia, uma guardamos aos pés da árvore mais antiga e a última confiamos à pedra que brilha."',
      '"Reúna os fragmentos e a luz dos cristais diante do portal, e o caminho será revelado."',
    ],
  },
  bau_floresta: {
    title: 'Aos pés da árvore mais antiga',
    paragraphs: [
      'Entre as raízes gigantes, um baú coberto de musgo guarda o segundo fragmento.',
      'Restam a pedra que brilha… a caverna ao norte, talvez?',
    ],
  },
  bau_caverna: {
    title: 'O coração da caverna',
    paragraphs: [
      'No fundo da gruta, cercado por cristais, está o terceiro fragmento. Ele vibra quando chega perto dos outros dois.',
      'Agora só falta levar tudo ao altar das ruínas.',
    ],
  },
  altar_inativo: {
    title: 'Altar do Portal',
    paragraphs: [
      'Um altar com três encaixes em forma de fragmento e cinco cavidades para cristais.',
      'Traga 3 Fragmentos Antigos e 5 Cristais para ativá-lo.',
    ],
  },
  portal: {
    title: 'O portal desperta',
    paragraphs: [
      'Os fragmentos se encaixam e os cristais se acendem um a um. O arco de pedra se enche de luz e um feixe sobe ao céu, apontando para o pico ao norte.',
      'Lá no alto, algo antigo parece esperar para ser aceso.',
    ],
  },
  farol: {
    title: 'O Farol dos Lumeni',
    paragraphs: [
      'Você acende o velho farol. A chama azul cresce, e por um instante a ilha inteira parece respirar.',
      'Muito longe, além do horizonte, uma luz responde. Os Lumeni não desapareceram — apenas seguiram viagem.',
      'Sua jornada nesta ilha está completa… por enquanto. Continue explorando, construindo e aguarde novas regiões!',
    ],
  },
};
