import type { SpriteDef } from '../sprite';
import { BOSS_SPRITES } from './bosses';
import { CHARACTER_SPRITES } from './characters';
import { DECOR_SPRITES } from './decor';
import { ENEMY_SPRITES } from './enemies';
import { ICON_SPRITES } from './icons';
import { ITEM_SPRITES } from './items';
import { PROJECTILE_SPRITES } from './projectiles';
import { UI_SPRITES } from './ui';

export const ALL_SPRITES: SpriteDef[] = [
  ...CHARACTER_SPRITES,
  ...ENEMY_SPRITES,
  ...BOSS_SPRITES,
  ...ICON_SPRITES,
  ...ITEM_SPRITES,
  ...PROJECTILE_SPRITES,
  ...DECOR_SPRITES,
  ...UI_SPRITES,
];

const BY_ID = new Map(ALL_SPRITES.map((s) => [s.id, s]));

export function getSprite(id: string): SpriteDef | undefined {
  return BY_ID.get(id);
}
