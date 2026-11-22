import type { Recipe, RecipeId, Ingredient } from "./types";
export const recipes: Record<RecipeId, Recipe> = {
  steak: {
    id: "steak",
    name: "香煎牛排",
    icon: "🥩",
    ingredient: "beef",
    station: "pan",
    target: 12,
    price: 48,
  },
  pasta: {
    id: "pasta",
    name: "奶油意面",
    icon: "🍝",
    ingredient: "noodle",
    station: "pot",
    target: 10,
    price: 36,
  },
  salad: {
    id: "salad",
    name: "温蔬沙拉",
    icon: "🥗",
    ingredient: "greens",
    station: "pan",
    target: 6,
    price: 28,
  },
};
export const ingredients: Record<
  Ingredient,
  { name: string; icon: string; cost: number }
> = {
  beef: { name: "牛肉", icon: "🥩", cost: 12 },
  noodle: { name: "面条", icon: "🍜", cost: 7 },
  greens: { name: "时蔬", icon: "🥬", cost: 5 },
};
export const recipeList = Object.values(recipes);

/** 各档位锅温目标（摄氏度）与展示名称 */
export const heatLevels = [
  { level: 0 as const, name: "关火", target: 25, color: "#9aa391" },
  { level: 1 as const, name: "低火", target: 120, color: "#8fb07a" },
  { level: 2 as const, name: "中火", target: 170, color: "#d9a24f" },
  { level: 3 as const, name: "高火", target: 220, color: "#cf6b46" },
];
/** 室温：锅与离火菜品共同趋向的环境温度 */
export const ROOM_TEMP = 25;
/** 锅温惯性时间常数（秒），越大升温越慢 */
export const PAN_TAU = 2.4;
/** 离火余温衰减时间常数（秒） */
export const RESIDUAL_TAU = 6;

export interface ThermalProfile {
  /** 熟度开始累积的锅温 */
  cookMin: number;
  /** 熟度达到满速的锅温 */
  cookMax: number;
  /** 满速下烹饪到熟度 1 的参考时长（秒） */
  refTime: number;
  /** 开始累积过热损伤的锅温 */
  damageTemp: number;
  /** 损伤二次曲线的参考温差跨度 */
  damageSpan: number;
  /** 满跨度温差下的每秒损伤速率 */
  damageK: number;
  /** 单位损伤对应的品质扣分 */
  damagePenalty: number;
  /** 熟度偏离 1 的容忍带，带内不扣分 */
  donenessTolerance: number;
  /** 高火封边加分上限（仅牛排有效） */
  searBonusMax: number;
}
/**
 * 每道菜的热工特性：
 * - 低火（120℃）处于所有菜品损伤阈值之下，是安全慢做区
 * - 中火（170℃）默认档，短时间只会轻微积损伤
 * - 高火（220℃）过热迅速；牛排耐高温且有封边加分，时蔬最怕持续高火
 */
export const thermal: Record<RecipeId, ThermalProfile> = {
  steak: {
    cookMin: 55,
    cookMax: 130,
    refTime: 10.4,
    damageTemp: 150,
    damageSpan: 80,
    damageK: 0.05,
    damagePenalty: 130,
    donenessTolerance: 0.12,
    searBonusMax: 14,
  },
  pasta: {
    cookMin: 55,
    cookMax: 125,
    refTime: 8.8,
    damageTemp: 145,
    damageSpan: 75,
    damageK: 0.045,
    damagePenalty: 140,
    donenessTolerance: 0.12,
    searBonusMax: 0,
  },
  salad: {
    cookMin: 45,
    cookMax: 115,
    refTime: 5.2,
    damageTemp: 130,
    damageSpan: 90,
    damageK: 0.06,
    damagePenalty: 160,
    donenessTolerance: 0.1,
    searBonusMax: 0,
  },
};
