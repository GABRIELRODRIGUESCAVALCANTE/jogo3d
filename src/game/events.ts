/**
 * Lista de todos os eventos trocados entre os sistemas do jogo.
 */
import { EventBus } from '../core/EventBus';
import type { ItemId } from './data/items';
import type { RegionId } from './data/regions';
import type { StructureId } from './data/structures';

export type NotifyKind = 'info' | 'success' | 'warning' | 'item' | 'xp' | 'quest' | 'region';

export interface GameEvents {
  'inventory:changed': { itemId: ItemId; delta: number; total: number };
  'resource:gathered': { itemId: ItemId; amount: number };
  'item:crafted': { itemId: ItemId; amount: number };
  'item:used': { itemId: ItemId };
  'structure:built': { type: StructureId; id: string };
  'structure:removed': { type: StructureId; id: string };
  'region:discovered': { regionId: RegionId };
  'flag:set': { flag: string };
  'xp:changed': { xp: number; level: number; gained: number };
  'level:up': { level: number };
  'quest:started': { questId: string };
  'quest:progress': { questId: string };
  'quest:completed': { questId: string };
  notify: { text: string; kind?: NotifyKind; icon?: string };
}

export type GameEventBus = EventBus<GameEvents>;

export function createEventBus(): GameEventBus {
  return new EventBus<GameEvents>();
}
