import type { Game } from "../../../shared/types";
import { totals } from "../lib/totals";
import { ROOM_TEMP } from "../../../shared/catalog";
export function closeShift(g: Game) {
  g.running = false;
  g.ended = true;
  g.portions = [];
  g.dishes = [];
  g.stoves.forEach((s) => {
    s.portion = null;
    s.started = 0;
    s.heat = 2;
    s.temp = ROOM_TEMP;
    s.doneness = 0;
    s.damage = 0;
    s.sear = 0;
    s.plan = [];
    s.history = [];
  });
  g.best = Math.max(g.best, totals(g).net);
  g.notice = "午市结束，辛苦了，主厨！";
}
export function saveBest(g: Game) {
  try {
    localStorage.setItem("lunch-rush-best", String(g.best));
  } catch {
    g.notice = "浏览器存储不可用，本局结算仍然有效";
  }
}
export function readBest() {
  try {
    const v = Number(localStorage.getItem("lunch-rush-best"));
    return Number.isFinite(v) ? Math.max(0, v) : 0;
  } catch {
    return 0;
  }
}
