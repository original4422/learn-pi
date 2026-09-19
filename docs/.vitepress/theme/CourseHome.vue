<script setup lang="ts">
import { useData } from 'vitepress';
import { computed } from 'vue';
const { lang } = useData();
const en = computed(() => lang.value === 'en');
const p = computed(() => en.value ? '/en/' : '/');
const units = computed(() => en.value ? [
  ['01—03', 'Give work a shape', 'Understand the loop. Separate planning from execution. Recover the task, not just the conversation.', '02-plan'],
  ['04—06', 'Make boundaries visible', 'Approve operations, connect a local MCP server, and delegate with bounded tools and concurrency.', '04-policy'],
  ['07—09', 'Close the coding loop', 'Change code, run tests, inspect a diff, recover a checkpoint, and assemble the SDK application.', '07-coding'],
] : [
  ['01—03', '让工作有条理', '看清工具循环，分开计划与执行，让任务清单能够跨重启保留。', '02-plan'],
  ['04—06', '让边界看得见', '审批操作、连接本地 MCP，用明确的职责与并发上限分派子任务。', '04-policy'],
  ['07—09', '让编程形成闭环', '修改代码、运行测试、审查差异、恢复检查点，最后用 SDK 装配成品。', '07-coding'],
]);
</script>

<template>
  <main class="course-home">
    <section class="course-hero">
      <div class="hero-copy">
        <p class="eyebrow">FIELD NOTES / BUILDING AGENTS · VOL. 01</p>
        <h1 v-if="en">A small core.<br>A capable agent.<br><em>Built by you.</em></h1>
        <h1 v-else>从一个小底座，<br>长出你自己的<br><em>编程 Agent。</em></h1>
        <p class="hero-deck">{{ en ? 'You know a little Python. You have used a coding agent. Now use TypeScript to extend the real Pi, and understand every boundary you add.' : '会一点 Python，用过编程 Agent。接下来，用 TypeScript 扩展真实 Pi，看懂每一项能力，也看清每一道边界。' }}</p>
        <div class="hero-actions"><a class="primary-link" :href="`${p}guide/quickstart`">{{ en ? 'Open the workbench' : '打开实验工作台' }} <span>↗</span></a><a class="secondary-link" :href="`${p}chapters/00-typescript`">{{ en ? 'Start with TypeScript →' : '从 TypeScript 开始 →' }}</a></div>
        <p class="hero-meta">PI 0.85.1 <span>·</span> TYPESCRIPT <span>·</span> 中文 / ENGLISH <span>·</span> LOCAL FIRST</p>
      </div>
      <div class="agent-board" role="img" :aria-label="en ? 'Nine progressive capabilities around the native Pi tool loop' : '围绕 Pi 原生工具循环逐步添加九个阶段的能力'">
        <div class="board-heading"><span>THE AGENT / EXPLODED VIEW</span><span class="board-dot"></span></div>
        <div class="board-row"><span class="board-index">01</span><div><strong>Pi runtime</strong><small>model → tools → feedback</small></div><span class="native-stamp">NATIVE</span></div>
        <div class="board-connector">↓</div>
        <div class="board-pair"><div><b>02—03</b><strong>plan + tasks</strong></div><div><b>04</b><strong>policy</strong></div></div>
        <div class="board-connector">↓</div>
        <div class="board-pair"><div><b>05</b><strong>MCP</strong></div><div><b>06</b><strong>subagents</strong></div></div>
        <div class="board-connector">↓</div>
        <div class="board-row final-row"><span class="board-index">09</span><div><strong>Your coding agent</strong><small>edit → test → diff → checkpoint</small></div><span class="final-mark">↗</span></div>
        <div class="board-footer"><span>{{ en ? 'READ THE SOURCE. TEST THE BOUNDARY.' : '读源码。做实验。验证边界。' }}</span><span>π</span></div>
      </div>
    </section>
    <section class="course-contract"><span class="contract-number">00—09</span><p>{{ en ? 'One TypeScript implementation, growing chapter by chapter. No API key needed for the first experiments; real Pi sessions throughout.' : '一套 TypeScript 主实现，逐章生长。入门实验无须 API Key，全程连接真实 Pi 会话。' }}</p><a :href="`${p}reference/sources`">{{ en ? 'What is real?' : '哪些能力来自哪里？' }} →</a></section>
    <section class="course-route"><div class="section-kicker"><span>{{ en ? 'THE LEARNING ROUTE' : '学习路线' }}</span><span>{{ en ? 'READ → RUN → BREAK → EXPLAIN' : '读懂 → 跑通 → 试错 → 解释' }}</span></div><div class="route-grid"><a v-for="unit in units" :key="unit[0]" :href="`${p}chapters/${unit[3]}`" class="route-unit"><span class="unit-number">{{ unit[0] }}</span><h2>{{ unit[1] }}</h2><p>{{ unit[2] }}</p><span class="unit-arrow">↗</span></a></div></section>
    <section class="course-note"><div><p class="eyebrow">A NOTE ON HONEST ENGINEERING</p><h2>{{ en ? 'The boundary is part of the lesson.' : '边界本身，就是课程的一部分。' }}</h2></div><p>{{ en ? 'Pi provides the agent loop. Official examples inform the extensions. This course makes the composition teachable. Approval hooks are not an OS sandbox; scripted providers are not evidence of model quality.' : 'Pi 提供 Agent 循环，官方示例提供扩展思路，课程把组合过程变成可理解的实验。审批钩子不等于操作系统沙箱，脚本化 Provider 也不代表真实模型效果。' }} <a :href="`${p}reference/comparison`">{{ en ? 'Read the design comparisons →' : '阅读设计对照 →' }}</a></p></section>
  </main>
</template>
