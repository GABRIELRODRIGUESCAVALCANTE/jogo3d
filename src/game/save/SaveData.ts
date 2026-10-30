/**
 * Formato do arquivo de salvamento.
 * Sempre que o formato mudar, aumente SAVE_VERSION e trate a conversão em
 * `migrateSave` para que jogadores antigos não percam o progresso.
 */
import type { QuestSaveState } from '../Quests';

export const SAVE_VERSION = 2;

export interface StructureSave {
  id: string;
  type: string;
  x: number;
  z: number;
  rot: number;
  /** Altura (peças modulares empilhadas); ausente = altura do terreno. */
  y?: number;
  /** Conteúdo do baú ou estado do canteiro. */
  data?: Record<string, number | string>;
}

/** Estado de um recurso: quantidade restante e momento de renascer. */
export interface NodeSave {
  r: number;
  t: number;
}

export interface SaveData {
  version: number;
  savedAt: number;
  playTime: number;
  player: {
    x: number;
    y: number;
    z: number;
    yaw: number;
    energy: number;
    torch: boolean;
    buffTime: number;
    /** Saciedade (0 a 100). */
    hunger: number;
  };
  inventory: Record<string, number>;
  /** Durabilidade restante das ferramentas. */
  durability: Record<string, number>;
  progression: { xp: number };
  quests: QuestSaveState;
  structures: StructureSave[];
  world: {
    time: number;
    day: number;
    flags: string[];
    regions: string[];
    explored: string;
    nodes: Record<string, NodeSave>;
  };
  stats: { gathered: number; crafted: number; built: number };
}

/** Resumo exibido no menu inicial ("Continuar"). */
export interface SaveSummary {
  savedAt: number;
  playTime: number;
  level: number;
  day: number;
  questsDone: number;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Converte salvamentos antigos para a versão atual. */
export function migrateSave(raw: Record<string, unknown>): Record<string, unknown> {
  const data = { ...raw };
  const version = isNum(data.version) ? data.version : 0;
  if (version < 1) {
    // Versão 0 (protótipo) não tinha estatísticas.
    data.stats = { gathered: 0, crafted: 0, built: 0 };
    data.version = 1;
  }
  if ((data.version as number) < 2) {
    // Versão 2: fome e durabilidade (ferramentas antigas ficam novas).
    if (isObj(data.player)) data.player = { ...data.player, hunger: 100 };
    data.durability = {};
    data.version = 2;
  }
  return data;
}

/** Verifica se os dados lidos têm o formato esperado. Retorna null se estiverem corrompidos. */
export function validateSave(input: unknown): SaveData | null {
  if (!isObj(input)) return null;
  const data = migrateSave(input);
  const player = data.player;
  const world = data.world;
  if (!isObj(player) || !isNum(player.x) || !isNum(player.y) || !isNum(player.z)) return null;
  if (!isObj(world) || !isNum(world.time) || !isNum(world.day)) return null;
  if (!isObj(data.inventory) || !isObj(data.progression) || !isObj(data.quests)) return null;
  if (!Array.isArray(data.structures)) return null;

  const structures: StructureSave[] = [];
  for (const s of data.structures) {
    if (isObj(s) && typeof s.type === 'string' && typeof s.id === 'string' && isNum(s.x) && isNum(s.z) && isNum(s.rot)) {
      const item: StructureSave = { id: s.id, type: s.type, x: s.x, z: s.z, rot: s.rot };
      if (isNum(s.y)) item.y = s.y;
      if (isObj(s.data)) {
        item.data = Object.fromEntries(
          Object.entries(s.data).filter(([, v]) => isNum(v) || typeof v === 'string'),
        ) as Record<string, number | string>;
      }
      structures.push(item);
    }
  }
  const nodes: Record<string, NodeSave> = {};
  if (isObj(world.nodes)) {
    for (const [id, n] of Object.entries(world.nodes)) {
      if (isObj(n) && isNum(n.r) && isNum(n.t)) nodes[id] = { r: n.r, t: n.t };
    }
  }
  const quests = data.quests as Record<string, unknown>;
  const stats = isObj(data.stats) ? data.stats : {};

  return {
    version: SAVE_VERSION,
    savedAt: isNum(data.savedAt) ? data.savedAt : Date.now(),
    playTime: isNum(data.playTime) ? data.playTime : 0,
    player: {
      x: player.x,
      y: player.y,
      z: player.z,
      yaw: isNum(player.yaw) ? player.yaw : 0,
      energy: isNum(player.energy) ? player.energy : 100,
      torch: player.torch === true,
      buffTime: isNum(player.buffTime) ? player.buffTime : 0,
      hunger: isNum(player.hunger) ? player.hunger : 100,
    },
    durability: isObj(data.durability)
      ? (Object.fromEntries(Object.entries(data.durability).filter(([, v]) => isNum(v))) as Record<string, number>)
      : {},
    inventory: Object.fromEntries(
      Object.entries(data.inventory as Record<string, unknown>).filter(([, v]) => isNum(v)),
    ) as Record<string, number>,
    progression: { xp: isNum((data.progression as Record<string, unknown>).xp) ? ((data.progression as Record<string, unknown>).xp as number) : 0 },
    quests: {
      active: Array.isArray(quests.active) ? quests.active.filter((q): q is string => typeof q === 'string') : [],
      completed: Array.isArray(quests.completed) ? quests.completed.filter((q): q is string => typeof q === 'string') : [],
      progress: isObj(quests.progress) ? (quests.progress as Record<string, number[]>) : {},
      tracked: typeof quests.tracked === 'string' ? quests.tracked : null,
    },
    structures,
    world: {
      time: world.time,
      day: world.day,
      flags: Array.isArray(world.flags) ? world.flags.filter((f): f is string => typeof f === 'string') : [],
      regions: Array.isArray(world.regions) ? world.regions.filter((r): r is string => typeof r === 'string') : [],
      explored: typeof world.explored === 'string' ? world.explored : '',
      nodes,
    },
    stats: {
      gathered: isNum(stats.gathered) ? stats.gathered : 0,
      crafted: isNum(stats.crafted) ? stats.crafted : 0,
      built: isNum(stats.built) ? stats.built : 0,
    },
  };
}
