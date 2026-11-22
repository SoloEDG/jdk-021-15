<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { Game, Stove, Command, HeatLevel, PlanStep } from "../../../shared/types";
import { recipes, heatLevels, thermal } from "../../../shared/catalog";
import {
  heatLabel,
  stoveQuality,
  previewPlan,
  simulate,
} from "../lib/heat";

const props = defineProps<{ game: Game; stove: Stove }>();
const emit = defineEmits<{ command: [cmd: Command] }>();

const HORIZON = 18;
const editorOpen = ref(false);
const draft = ref<PlanStep[]>([]);
/** 每次调火/时间推进后预演需要重算，用版本号强制刷新 */
const previewTick = ref(0);

const profile = computed(() =>
  props.stove.portion ? thermal[props.stove.portion.recipe] : null,
);
const breakdown = computed(() => stoveQuality(props.stove));

// 起锅 / 换菜后关闭编辑器并清空草稿，避免旧计划残留到下一道菜
watch(
  () => props.stove.portion?.id,
  () => {
    editorOpen.value = false;
    draft.value = [];
  },
);

function openEditor() {
  draft.value = props.stove.plan.map((p) => ({ ...p }));
  if (!draft.value.length) {
    draft.value.push({ at: round1(props.game.time + 3), level: 1 });
  }
  editorOpen.value = true;
}
function closeEditor() {
  editorOpen.value = false;
}
function round1(v: number) {
  return Math.round(v * 10) / 10;
}
function addStep() {
  const lastAt = draft.value.length
    ? draft.value[draft.value.length - 1].at
    : props.game.time;
  draft.value.push({ at: round1(lastAt + 2), level: 1 });
}
function removeStep(i: number) {
  draft.value.splice(i, 1);
}
function shiftAt(i: number, delta: number) {
  draft.value[i].at = round1(
    Math.max(round1(props.game.time + 0.5), draft.value[i].at + delta),
  );
}
function setLevel(i: number, level: HeatLevel) {
  draft.value[i].level = level;
  previewTick.value++;
}
function adopt() {
  emit("command", {
    type: "adopt-plan",
    id: props.stove.id,
    plan: draft.value.map((p) => ({ ...p })),
  });
  editorOpen.value = false;
}

/** 编辑器内：草稿计划 vs 维持当前火力的对比预演 */
const preview = computed(() => {
  if (!editorOpen.value || !props.stove.portion) return null;
  // 依赖 time 与 previewTick，手动调火/改档后自动重算
  void props.game.time;
  void previewTick.value;
  const sorted = [...draft.value].sort((a, b) => a.at - b.at);
  return previewPlan(props.stove, sorted, props.game.time, HORIZON);
});

/** 趋势图预测：编辑器内跟草稿，关闭时跟已采用计划（无换挡则只画熟度延伸） */
const forecast = computed(() => {
  if (!props.stove.portion) return null;
  void props.game.time;
  if (editorOpen.value) return preview.value?.draft ?? null;
  return simulate(props.stove, props.stove.plan, HORIZON, props.game.time);
});

// ---- SVG 趋势图：实际历史（实线）+ 预演（虚线） ----
const W = 240;
const H = 86;
const PAD = 6;
const TEMP_MAX = 230;

interface Pt {
  x: number;
  y: number;
}
function tempY(temp: number) {
  return H - PAD - (Math.min(temp, TEMP_MAX) / TEMP_MAX) * (H - PAD * 2);
}
function donenessY(d: number) {
  return H - PAD - Math.min(d, 1.6) / 1.6 * (H - PAD * 2);
}
function path(points: Pt[]) {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
}

const chart = computed(() => {
  if (!props.stove.portion || !profile.value) return null;
  const now = props.game.time;
  // 左半为已发生历史，右半为未来预演，x 中线即“当前时刻”
  const midX = W / 2;
  const histSpan = 6;
  const histStart = now - histSpan;
  const hist: Pt[] = props.stove.history
    .filter((s) => s.t >= histStart - 1e-9)
    .map((s) => ({
      x: PAD + ((s.t - histStart) / histSpan) * (midX - PAD),
      y: tempY(s.temp),
    }));
  hist.push({ x: midX, y: tempY(props.stove.temp) });

  const draftPts: Pt[] = [];
  const basePts: Pt[] = [];
  const donePts: Pt[] = [];
  if (forecast.value) {
    const n = forecast.value.samples.length;
    const spanX = W - PAD - midX;
    forecast.value.samples.forEach((s, i) => {
      const x = midX + ((i + 1) / n) * spanX;
      draftPts.push({ x, y: tempY(s.temp) });
      donePts.push({ x, y: donenessY(s.doneness) });
    });
  }
  if (preview.value) {
    const n = preview.value.baseline.samples.length;
    const spanX = W - PAD - midX;
    preview.value.baseline.samples.forEach((s, i) => {
      const x = midX + ((i + 1) / n) * spanX;
      basePts.push({ x, y: tempY(s.temp) });
    });
  }
  return {
    hist,
    draftPts,
    basePts,
    donePts,
    thresholdY: tempY(profile.value.damageTemp),
    idealY: donenessY(1),
    midX,
  };
});

const flame = computed(() => ["·", "◦", "◌", "♨"][props.stove.heat]);
</script>

<template>
  <article class="stove" :class="{ cooking: stove.portion }">
    <div class="stove-head">
      <b>{{ stove.kind === "pan" ? "煎锅" : "汤锅" }} 0{{ stove.id }}</b
      ><span
        class="status-dot"
        :class="{ danger: heatLabel(game, stove) === '过热风险' }"
        >{{ heatLabel(game, stove) }}</span
      >
    </div>
    <div class="burner">
      <div class="pan-shape" :data-heat="stove.heat">
        <span>{{
          stove.portion ? recipes[stove.portion.recipe].icon : "＋"
        }}</span>
      </div>
      <div v-if="stove.portion" class="flame" :data-heat="stove.heat">
        {{ flame }} {{ heatLevels[stove.heat].name }} {{ flame }}
      </div>
    </div>
    <template v-if="stove.portion"
      ><strong>{{ recipes[stove.portion.recipe].name }}</strong>
      <div class="thermo-grid">
        <div>
          <small>锅温</small><b>{{ Math.round(stove.temp) }}℃</b>
        </div>
        <div>
          <small>熟度</small
          ><b :class="{ over: stove.doneness > 1 + (profile?.donenessTolerance ?? 0) }"
            >{{ Math.round(stove.doneness * 100) }}%</b
          >
        </div>
        <div>
          <small>损伤</small
          ><b :class="{ danger: stove.damage > 0.05 }">{{
            Math.round(stove.damage * 100)
          }}</b>
        </div>
      </div>

      <svg v-if="chart" class="trend" :viewBox="`0 0 ${W} ${H}`" role="img" aria-label="锅温与熟度趋势">
        <line
          :x1="PAD"
          :x2="W - PAD"
          :y1="chart.thresholdY"
          :y2="chart.thresholdY"
          class="grid danger-line"
        />
        <line
          :x1="PAD"
          :x2="W - PAD"
          :y1="chart.idealY"
          :y2="chart.idealY"
          class="grid ideal-line"
        />
        <line
          :x1="chart.midX"
          :x2="chart.midX"
          :y1="PAD"
          :y2="H - PAD"
          class="grid now-line"
        />
        <path :d="path(chart.hist)" class="line hist-temp" />
        <path v-if="chart.basePts.length" :d="path(chart.basePts)" class="line base-temp" />
        <path v-if="chart.draftPts.length" :d="path(chart.draftPts)" class="line draft-temp" />
        <path v-if="chart.donePts.length" :d="path(chart.donePts)" class="line done-line" />
      </svg>
      <p class="legend">
        <i class="lg-temp"></i>实际锅温
        <i class="lg-draft"></i>计划预演
        <i class="lg-done"></i>熟度
        <i class="lg-danger"></i>损伤阈值
        <i class="lg-ideal"></i>熟度100%
      </p>

      <div class="heat-switch" role="group" aria-label="火力档位">
        <button
          v-for="h in heatLevels"
          :key="h.level"
          class="heat-btn"
          :class="{ active: stove.heat === h.level }"
          :style="stove.heat === h.level ? { background: h.color } : {}"
          @click="emit('command', { type: 'adjust-heat', id: stove.id, level: h.level })"
        >
          {{ h.name }}
        </button>
      </div>

      <div v-if="stove.plan.length" class="plan-queue">
        <span>待执行换挡：</span>
        <em v-for="(p, i) in stove.plan" :key="i">
          {{ p.at.toFixed(1) }}s → {{ heatLevels[p.level].name }}
        </em>
      </div>

      <div class="stove-actions">
        <button class="tiny soft" @click="editorOpen ? closeEditor() : openEditor()">
          {{ editorOpen ? "收起计划" : "控火计划" }}
        </button>
        <button
          class="warm"
          @click="emit('command', { type: 'lift', id: stove.id })"
        >
          起锅 · 品质 {{ breakdown?.quality ?? 0 }}
        </button>
      </div>

      <div v-if="editorOpen" class="plan-editor">
        <p class="editor-title">
          编辑未来 {{ HORIZON }} 秒控火计划（当前 {{ game.time.toFixed(1) }}s）
        </p>
        <div v-for="(step, i) in draft" :key="i" class="plan-row">
          <span class="step-time">
            <button class="step-btn" @click="shiftAt(i, -0.5)">−</button>
            <b>{{ step.at.toFixed(1) }}s</b>
            <button class="step-btn" @click="shiftAt(i, 0.5)">＋</button>
          </span>
          <span class="step-levels">
            <button
              v-for="h in heatLevels"
              :key="h.level"
              class="mini-heat"
              :class="{ active: step.level === h.level }"
              :style="step.level === h.level ? { background: h.color } : {}"
              @click="setLevel(i, h.level)"
            >
              {{ h.name }}
            </button>
          </span>
          <button class="step-del" @click="removeStep(i)" aria-label="删除换挡点">×</button>
        </div>
        <div class="editor-buttons">
          <button class="tiny soft" @click="addStep">＋ 换挡点</button>
          <button class="tiny" @click="adopt">采用计划</button>
        </div>
        <div v-if="preview" class="preview-box">
          <div class="preview-row">
            <span>预演品质</span>
            <b>{{ preview.draft.quality.quality }}</b>
            <small>
              熟度 {{ Math.round(preview.draft.doneness * 100) }}% ·
              损伤 {{ Math.round(preview.draft.damage * 100)
              }}<template v-if="preview.draft.sear"> · 封边 +{{ preview.draft.quality.searBonus }}</template>
            </small>
          </div>
          <div class="preview-row base">
            <span>维持当前火力</span>
            <b>{{ preview.baseline.quality.quality }}</b>
            <small>
              熟度 {{ Math.round(preview.baseline.doneness * 100) }}% ·
              损伤 {{ Math.round(preview.baseline.damage * 100) }}
            </small>
          </div>
          <p class="preview-note">
            采用后仅替换未执行换挡点；已积累的熟度与损伤不会回写。手动调火会立即清空计划。
          </p>
        </div>
      </div></template
    ><template v-else
      ><p class="muted">等待食材下锅 · 默认中火即可完成</p>
      <div class="portion-picker">
        <button
          v-for="p in game.portions.filter(
            (p) => recipes[p.recipe].station === stove.kind,
          )"
          :key="p.id"
          class="tiny soft"
          @click="
            emit('command', { type: 'cook', portion: p.id, stove: stove.id })
          "
        >
          {{ recipes[p.recipe].icon }} #{{ p.id }} 下锅</button
        ><small
          v-if="
            !game.portions.some((p) => recipes[p.recipe].station === stove.kind)
          "
          >先到备料台准备食材</small
        >
      </div></template
    >
  </article>
</template>
