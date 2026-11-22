export type RecipeId = "steak" | "pasta" | "salad";
export type Ingredient = "beef" | "noodle" | "greens";
/** 火力档位：0 关火 / 1 低火 / 2 中火 / 3 高火 */
export type HeatLevel = 0 | 1 | 2 | 3;
export interface Recipe {
  id: RecipeId;
  name: string;
  icon: string;
  ingredient: Ingredient;
  station: "pan" | "pot";
  target: number;
  price: number;
}
export interface Order {
  id: number;
  recipe: RecipeId;
  guest: string;
  arrived: number;
  deadline: number;
  status: "waiting" | "accepted" | "served" | "left";
}
export interface Portion {
  id: number;
  recipe: RecipeId;
  preparedAt: number;
}
/** 控火计划中的一次换挡（at 为绝对游戏时间，秒） */
export interface PlanStep {
  at: number;
  level: HeatLevel;
}
/** 锅温 / 熟度采样点，用于界面趋势图 */
export interface ThermoSample {
  t: number;
  temp: number;
  doneness: number;
  damage: number;
}
export interface Stove {
  id: number;
  kind: "pan" | "pot";
  portion: Portion | null;
  started: number;
  /** 当前实际输出档位（计划换挡或手动调火都会改写） */
  heat: HeatLevel;
  /** 锅温（摄氏度），带惯性渐变 */
  temp: number;
  /** 累计熟度，1 表示恰到好处 */
  doneness: number;
  /** 累计过热损伤，0 起无上限 */
  damage: number;
  /** 牛排高火封边风味累计，其他菜品恒为 0 */
  sear: number;
  /** 尚未执行的控火计划（按 at 升序） */
  plan: PlanStep[];
  /** 最近的锅温 / 熟度采样 */
  history: ThermoSample[];
}
export interface Dish {
  id: number;
  recipe: RecipeId;
  /** 起锅瞬间的品质快照 */
  quality: number;
  cookedAt: number;
  stage: "counter" | "plated";
  /** 离火时的锅温，余温继续作用并逐步冷却 */
  temp: number;
  doneness: number;
  damage: number;
  sear: number;
}
export interface Entry {
  id: number;
  time: number;
  label: string;
  amount: number;
  kind: "sale" | "waste" | "miss" | "supply";
}
export interface Game {
  time: number;
  duration: number;
  running: boolean;
  ended: boolean;
  nextId: number;
  selectedOrder: number | null;
  selectedDish: number | null;
  orders: Order[];
  stock: Record<Ingredient, number>;
  portions: Portion[];
  stoves: Stove[];
  dishes: Dish[];
  entries: Entry[];
  combo: number;
  served: number;
  missed: number;
  notice: string;
  best: number;
}
export type Command =
  | { type: "accept"; id: number }
  | { type: "select-order"; id: number }
  | { type: "prepare"; recipe: RecipeId }
  | { type: "cook"; portion: number; stove: number }
  | { type: "lift"; id: number }
  | { type: "adjust-heat"; id: number; level: HeatLevel }
  | { type: "adopt-plan"; id: number; plan: PlanStep[] }
  | { type: "plate"; id: number }
  | { type: "select-dish"; id: number }
  | { type: "serve" }
  | { type: "discard"; id: number }
  | { type: "restock"; ingredient: Ingredient };
