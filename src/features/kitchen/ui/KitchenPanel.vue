<script setup lang="ts">
import type { Game, Command } from "../../../shared/types";
import StoveCard from "./StoveCard.vue";
defineProps<{ game: Game }>();
defineEmits<{ command: [cmd: Command] }>();
</script>
<template>
  <section class="panel kitchen-panel">
    <div class="section-heading">
      <div>
        <span class="eyebrow">03 / THE HOT LINE</span>
        <h2>共享灶台 <span class="small">COOK</span></h2>
      </div>
      <span class="pill"
        >{{ game.stoves.filter((s) => s.portion).length }} / 3 使用中</span
      >
    </div>
    <div class="stoves">
      <StoveCard
        v-for="s in game.stoves"
        :key="s.id"
        :stove="s"
        :game="game"
        @command="(cmd) => $emit('command', cmd)"
      />
    </div>
    <div class="kitchen-note">
      <span>♨ 低火 120℃ · 中火 170℃ · 高火 220℃</span>
      <span class="muted">锅温有惯性，调档后渐变；熟度与过热损伤共同决定品质，起锅后余温仍会作用</span>
    </div>
  </section>
</template>
