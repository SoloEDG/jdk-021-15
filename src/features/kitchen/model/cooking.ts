import type { Game, HeatLevel, PlanStep, Stove } from "../../../shared/types";
import { recipes, ROOM_TEMP } from "../../../shared/catalog";
import {
  qualityFrom,
  adoptPlan,
} from "../lib/heat";

function resetStove(s: Stove) {
  s.portion = null;
  s.started = 0;
  s.heat = 2;
  s.temp = ROOM_TEMP;
  s.doneness = 0;
  s.damage = 0;
  s.sear = 0;
  s.plan = [];
  s.history = [];
}

export function cook(g: Game, portion: number, stove: number) {
  const p = g.portions.find((p) => p.id === portion),
    s = g.stoves.find((s) => s.id === stove);
  if (!p || !s || s.portion) return;
  if (recipes[p.recipe].station !== s.kind) {
    g.notice = "设备不匹配：意面用汤锅，牛排和沙拉用煎锅";
    return;
  }
  // 单次下锅菜沿用默认中火即可完成，无需任何手动操作
  resetStove(s);
  s.portion = p;
  s.started = g.time;
  s.heat = 2;
  g.portions = g.portions.filter((x) => x.id !== portion);
  g.notice = "已经下锅，默认中火烹饪，可调档或编排控火计划";
}

export function lift(g: Game, id: number) {
  const s = g.stoves.find((s) => s.id === id);
  if (!s?.portion) return;
  if (g.dishes.length >= 8) {
    g.notice = "出餐台已满，请先上菜或丢弃";
    return;
  }
  const p = s.portion;
  const breakdown = qualityFrom(p.recipe, s.doneness, s.damage, s.sear);
  g.dishes.push({
    id: p.id,
    recipe: p.recipe,
    quality: breakdown.quality,
    cookedAt: g.time,
    stage: "counter",
    // 离火带走当前锅温作为余温，后续在出餐台继续作用
    temp: s.temp,
    doneness: s.doneness,
    damage: s.damage,
    sear: s.sear,
  });
  resetStove(s);
  g.notice = `起锅完成，品质 ${breakdown.quality}（熟度契合 ${breakdown.donenessScore}${
    breakdown.damageLost ? ` · 过热 −${breakdown.damageLost}` : ""
  }${breakdown.searBonus ? ` · 封边 +${breakdown.searBonus}` : ""}），余温仍在继续作用`;
}

/** 手动调火：立即生效，并清空尚未执行的计划（玩家接管） */
export function adjustHeat(g: Game, id: number, level: HeatLevel) {
  const s = g.stoves.find((s) => s.id === id);
  if (!s?.portion) return;
  s.heat = level;
  s.plan = [];
  g.notice = `已切换为${["关火", "低火", "中火", "高火"][level]}，锅温将逐步变化`;
}

/** 采用编辑后的控火计划：只替换未执行段，已积累熟度与损伤不回写 */
export function adopt(g: Game, id: number, plan: PlanStep[]) {
  const s = g.stoves.find((s) => s.id === id);
  if (!s?.portion) return;
  const kept = adoptPlan(s, g.time, plan);
  g.notice = kept.length
    ? `控火计划已采用，${kept.length} 个换挡点将依次执行`
    : "计划中没有未来的换挡点，维持当前火力";
}
