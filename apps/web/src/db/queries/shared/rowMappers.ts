import type { Row } from '../../sqlite';
import type {
  EquipRecord,
  ItemRecord,
  MapRecord,
  MobRecord,
  NpcRecord,
  QuestRecord,
} from '../../types';

export interface ItemRow extends Row {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  icon_path: string | null;
  icon_data: Uint8Array | null;
  price: number | null;
  stack_size: number | null;
  required_level: number | null;
  cash: number;
  trade_block: number;
  account_sharable: number;
  only_one: number;
  quest_item: number;
  time_limited: number;
  expire_on_logout: number;
  pickup_block: number;
  not_sale: number;
  drop_block: number;
  trade_available: number;
  source_path: string;
}

export interface EquipRow extends Row {
  id: number;
  name: string;
  description: string | null;
  slot: string | null;
  category: string | null;
  required_level: number | null;
  required_str: number | null;
  required_dex: number | null;
  required_int: number | null;
  required_luk: number | null;
  required_job: number | null;
  attack: number | null;
  magic_attack: number | null;
  defense: number | null;
  magic_defense: number | null;
  accuracy: number | null;
  avoidability: number | null;
  upgrade_slots: number | null;
  inc_str: number | null;
  inc_dex: number | null;
  inc_int: number | null;
  inc_luk: number | null;
  inc_hp: number | null;
  inc_mp: number | null;
  inc_speed: number | null;
  inc_jump: number | null;
  cash: number;
  equip_type: string | null;
  trade_block: number;
  equip_trade_block: number;
  account_sharable: number;
  only_one: number;
  quest_item: number;
  time_limited: number;
  expire_on_logout: number;
  pickup_block: number;
  not_sale: number;
  icon_path: string | null;
  icon_data: Uint8Array | null;
  source_path: string;
}

export interface MobRow extends Row {
  id: number;
  name: string;
  level: number | null;
  hp: number | null;
  mp: number | null;
  exp: number | null;
  is_boss: number;
  element_attack: string | null;
  element_defenses_json: string | null;
  icon_path: string | null;
  icon_data: Uint8Array | null;
  source_path: string;
}

export interface NpcRow extends Row {
  id: number;
  name: string;
  description: string | null;
  icon_path: string | null;
  icon_data: Uint8Array | null;
  source_path: string;
}

export interface MapRow extends Row {
  id: number;
  name: string | null;
  street_name: string | null;
  return_map_id: number | null;
  forced_return_map_id: number | null;
  field_limit: number | null;
  mob_rate: number | null;
  minimap_path: string | null;
  minimap_data: Uint8Array | null;
  minimap_center_x: number | null;
  minimap_center_y: number | null;
  minimap_width: number | null;
  minimap_height: number | null;
  minimap_mag: number | null;
  source_path: string;
}

export interface QuestRow extends Row {
  id: number;
  name: string;
  parent: string | null;
  description: string | null;
  start_npc_id: number | null;
  end_npc_id: number | null;
  required_level: number | null;
  required_job: number | null;
  source_path: string;
}

export function rowToItem(r: ItemRow): ItemRecord {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    category: r.category,
    subcategory: r.subcategory,
    iconPath: r.icon_path,
    iconData: r.icon_data,
    price: r.price,
    stackSize: r.stack_size,
    requiredLevel: r.required_level,
    cash: r.cash === 1,
    tradeBlock: r.trade_block === 1,
    accountSharable: r.account_sharable === 1,
    only: r.only_one === 1,
    quest: r.quest_item === 1,
    timeLimited: r.time_limited === 1,
    expireOnLogout: r.expire_on_logout === 1,
    pickupBlock: r.pickup_block === 1,
    notSale: r.not_sale === 1,
    dropBlock: r.drop_block === 1,
    tradeAvailable: r.trade_available === 1,
    sourcePath: r.source_path,
  };
}

export function rowToMob(r: MobRow): MobRecord {
  return {
    id: r.id,
    name: r.name,
    level: r.level,
    hp: r.hp,
    mp: r.mp,
    exp: r.exp,
    isBoss: r.is_boss === 1,
    elementAttack: r.element_attack,
    elementDefensesJson: r.element_defenses_json,
    iconPath: r.icon_path,
    iconData: r.icon_data,
    sourcePath: r.source_path,
  };
}

export function rowToNpc(r: NpcRow): NpcRecord {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    iconPath: r.icon_path,
    iconData: r.icon_data,
    sourcePath: r.source_path,
  };
}

export function rowToMap(r: MapRow): MapRecord {
  return {
    id: r.id,
    name: r.name,
    streetName: r.street_name,
    returnMapId: r.return_map_id,
    forcedReturnMapId: r.forced_return_map_id,
    fieldLimit: r.field_limit,
    mobRate: r.mob_rate,
    minimapPath: r.minimap_path,
    minimapData: r.minimap_data,
    minimapCenterX: r.minimap_center_x,
    minimapCenterY: r.minimap_center_y,
    minimapWidth: r.minimap_width,
    minimapHeight: r.minimap_height,
    minimapMag: r.minimap_mag,
    sourcePath: r.source_path,
  };
}

export function rowToQuest(r: QuestRow): QuestRecord {
  return {
    id: r.id,
    name: r.name,
    parent: r.parent,
    description: r.description,
    startNpcId: r.start_npc_id,
    endNpcId: r.end_npc_id,
    requiredLevel: r.required_level,
    requiredJob: r.required_job,
    sourcePath: r.source_path,
  };
}

export function rowToEquip(r: EquipRow): EquipRecord {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    slot: r.slot,
    category: r.category,
    requiredLevel: r.required_level,
    requiredStr: r.required_str,
    requiredDex: r.required_dex,
    requiredInt: r.required_int,
    requiredLuk: r.required_luk,
    requiredJob: r.required_job,
    attack: r.attack,
    magicAttack: r.magic_attack,
    defense: r.defense,
    magicDefense: r.magic_defense,
    accuracy: r.accuracy,
    avoidability: r.avoidability,
    upgradeSlots: r.upgrade_slots,
    incStr: r.inc_str,
    incDex: r.inc_dex,
    incInt: r.inc_int,
    incLuk: r.inc_luk,
    incHp: r.inc_hp,
    incMp: r.inc_mp,
    incSpeed: r.inc_speed,
    incJump: r.inc_jump,
    cash: r.cash === 1,
    equipType: r.equip_type,
    tradeBlock: r.trade_block === 1,
    equipTradeBlock: r.equip_trade_block === 1,
    accountSharable: r.account_sharable === 1,
    only: r.only_one === 1,
    quest: r.quest_item === 1,
    timeLimited: r.time_limited === 1,
    expireOnLogout: r.expire_on_logout === 1,
    pickupBlock: r.pickup_block === 1,
    notSale: r.not_sale === 1,
    iconPath: r.icon_path,
    iconData: r.icon_data,
    sourcePath: r.source_path,
  };
}
