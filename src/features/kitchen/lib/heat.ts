import type {
  RecipeId,
  Game,
  Stove,
  Dish,
  HeatLevel,
  PlanStep,
  ThermoSample,
} from "../../../shared/types";
import {
  thermal,
  heatLevels,
  ROOM_TEMP,
  PAN_TAU,
  RESIDUAL_TAU,
} from "../../../shared/catalog";

export const TICK = 0.1;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

export function heatName(level: HeatLevel) {
  return heatLevels[level].name;
}
export function panTargetTemp(level: HeatLevel) {
  return heatLevels[level].target;
}

/** 锅温一阶惯性：调档后温度指数趋近目标温度，不会瞬间跳变 */
export function advancePanTemp(temp: number, level: HeatLevel, dt: number) {
  const target = panTargetTemp(level);
  return target + (temp - target) * Math.exp(-dt / PAN_TAU);
}

/** 离火余温：菜品温度指数回落至室温 */
export function coolDishTemp(temp: number, dt: number) {
  return ROOM_TEMP + (temp - ROOM_TEMP) * Math.exp(-dt / RESIDUAL_TAU);
}

/** 熟度累积速率（每秒），锅温低于 cookMin 不积熟度，达到 cookMax 后满速 */
export function cookRate(recipe: RecipeId, temp: number) {
  const p = thermal[recipe];
  return clamp01((temp - p.cookMin) / (p.cookMax - p.cookMin)) / p.refTime;
}

/** 过热损伤速率（每秒），二次曲线：轻微超温可容忍，持续高温迅速崩坏 */
export function damageRate(recipe: RecipeId, temp: number) {
  const p = thermal[recipe];
  const over = Math.max(0, temp - p.damageTemp);
  if (over <= 0) return 0;
  return p.damageK * (over / p.damageSpan) ** 2;
}

/** 牛排高火封边风味：仅高火档且锅温越过损伤阈值时累积，封顶 1 */
export function searRate(
  recipe: RecipeId,
  temp: number,
  level: HeatLevel,
) {
  if (recipe !== "steak" || level < 3) return 0;
  const p = thermal[recipe];
  return clamp01((temp - p.damageTemp) / 50) * 0.45;
}

export interface QualityBreakdown {
  quality: number;
  donenessScore: number;
  damageLost: number;
  searBonus: number;
}

/** 品质 = 熟度契合度 - 过热损伤 + 封边风味，全部由累计状态决定，与耗时无直接关系 */
export function qualityFrom(
  recipe: RecipeId,
  doneness: number,
  damage: number,
  sear: number,
): QualityBreakdown {
  const p = thermal[recipe];
  const miss = Math.max(0, Math.abs(doneness - 1) - p.donenessTolerance);
  const donenessScore = Math.max(0, 100 - miss * 130);
  const damageLost = damage * p.damagePenalty;
  const searBonus = Math.min(1, sear) * p.searBonusMax;
  const quality = clamp(
    Math.round(donenessScore - damageLost + searBonus),
    0,
    110,
  );
  return {
    quality,
    donenessScore: Math.round(donenessScore),
    damageLost: Math.round(damageLost),
    searBonus: Math.round(searBonus),
  };
}

export function stoveQuality(s: Stove): QualityBreakdown | null {
  if (!s.portion) return null;
  return qualityFrom(s.portion.recipe, s.doneness, s.damage, s.sear);
}

/** 实锅推进一个 tick：先消费到期计划换挡，再做温度与积分更新 */
export function stepStove(s: Stove, now: number, dt: number) {
  if (!s.portion) return;
  while (s.plan.length && s.plan[0].at <= now + 1e-9) {
    s.heat = s.plan.shift()!.level;
  }
  s.temp = advancePanTemp(s.temp, s.heat, dt);
  const r = s.portion.recipe;
  s.doneness += cookRate(r, s.temp) * dt;
  s.damage += damageRate(r, s.temp) * dt;
  s.sear += searRate(r, s.temp, s.heat) * dt;
  const last = s.history[s.history.length - 1];
  if (!last || now - last.t >= 0.5) {
    s.history.push({
      t: now,
      temp: s.temp,
      doneness: s.doneness,
      damage: s.damage,
    });
    if (s.history.length > 120) s.history.shift();
  }
}

/** 离锅菜品继续受余温作用：熟度可能补足，过热损伤也可能继续累积 */
export function stepDish(d: Dish, dt: number) {
  d.temp = coolDishTemp(d.temp, dt);
  d.doneness += cookRate(d.recipe, d.temp) * dt;
  d.damage += damageRate(d.recipe, d.temp) * dt;
}

export function tickKitchen(g: Game, dt: number) {
  for (const s of g.stoves) stepStove(s, g.time, dt);
  for (const d of g.dishes) stepDish(d, dt);
}

export interface PreviewResult {
  samples: ThermoSample[];
  temp: number;
  doneness: number;
  damage: number;
  sear: number;
  quality: QualityBreakdown;
}

/**
 * 纯函数预演：从灶台当前真实状态出发，沿计划推导 horizon 秒。
 * now 为当前游戏时间，计划换挡点按绝对时间对齐；不写回任何已积累状态。
 */
export function simulate(
  s: Stove,
  plan: PlanStep[],
  horizon: number,
  now: number,
  dt = TICK,
): PreviewResult {
  const recipe = s.portion!.recipe;
  let temp = s.temp,
    doneness = s.doneness,
    damage = s.damage,
    sear = s.sear,
    level: HeatLevel = s.heat;
  const samples: ThermoSample[] = [];
  const steps = [...plan].sort((a, b) => a.at - b.at);
  for (let t = dt; t <= horizon + 1e-9; t += dt) {
    const at = now + t;
    while (steps.length && steps[0].at <= at + 1e-9) {
      level = steps.shift()!.level;
    }
    temp = advancePanTemp(temp, level, dt);
    doneness += cookRate(recipe, temp) * dt;
    damage += damageRate(recipe, temp) * dt;
    sear += searRate(recipe, temp, level) * dt;
    samples.push({ t: at, temp, doneness, damage });
  }
  return {
    samples,
    temp,
    doneness,
    damage,
    sear,
    quality: qualityFrom(recipe, doneness, damage, sear),
  };
}

/** 预演新计划，并与“维持当前火力不换挡”的基准做对比 */
export function previewPlan(
  s: Stove,
  draft: PlanStep[],
  now: number,
  horizon = 18,
) {
  return {
    draft: simulate(s, draft, horizon, now),
    baseline: simulate(s, [], horizon, now),
  };
}

/** 采用计划：只保留未来换挡点，已积累状态一律不动 */
export function adoptPlan(s: Stove, now: number, draft: PlanStep[]): PlanStep[] {
  const future = draft
    .filter((p) => p.at > now + 1e-9)
    .map((p) => ({ ...p }))
    .sort((a, b) => a.at - b.at);
  const deduped = future.filter(
    (p, i) => i === 0 || Math.abs(p.at - future[i - 1].at) > 1e-9,
  );
  s.plan = deduped;
  return deduped;
}

export function heatLabel(g: Game, s: Stove) {
  if (!s.portion) return "空闲";
  const p = thermal[s.portion.recipe];
  if (s.temp > p.damageTemp && damageRate(s.portion.recipe, s.temp) > 0.02)
    return "过热风险";
  const tol = p.donenessTolerance;
  if (s.doneness >= 1 - tol && s.doneness <= 1 + tol) return "最佳起锅窗口";
  return s.doneness < 1 - tol ? "烹饪中" : "已过熟";
}
