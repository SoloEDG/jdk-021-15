import type { Dish, Game } from "../../../shared/types";
import { qualityFrom } from "../../kitchen/lib/heat";
/**
 * 上菜品质：
 * 1. 以离火后持续演化的熟度 / 损伤重算（余温可以补足熟度，也可能追加损伤）；
 * 2. 与起锅瞬间的品质快照取较小值，余温只可能暴露问题，不凭空变好；
 * 3. 起锅 15 秒后按停留时间追加装盘失温扣分。
 */
export function servingQuality(g: Game, d: Dish) {
  const current = qualityFrom(d.recipe, d.doneness, d.damage, d.sear).quality;
  const evolved = Math.min(d.quality, current);
  const freshLoss = Math.floor(Math.max(0, g.time - d.cookedAt - 15) * 2);
  return Math.max(0, evolved - freshLoss);
}
export function servicePair(g: Game) {
  return {
    dish: g.dishes.find((d) => d.id === g.selectedDish),
    order: g.orders.find(
      (o) => o.id === g.selectedOrder && o.status === "accepted",
    ),
  };
}
