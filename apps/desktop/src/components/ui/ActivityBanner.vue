<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>()
const emit = defineEmits<{ (e: 'open'): void }>()
</script>

<template>
  <article
    class="relative h-[209px] w-[373px] shrink-0 cursor-pointer overflow-hidden rounded-banner bg-gradient-to-br from-[#dbe3f5] via-[#e9e2f3] to-[#f2dde6]"
    @click="emit('open')"
  >
    <span class="absolute -left-10 -top-12 size-[190px] rounded-full bg-white/45 blur-[2px]" aria-hidden="true" />
    <span class="absolute -bottom-16 right-[-30px] size-[210px] rounded-full bg-ncm-accent/12 blur-[3px]" aria-hidden="true" />
    <span class="absolute right-[36px] top-[30px] size-[92px] rotate-[18deg] rounded-[18px] border border-white/60 bg-white/25" aria-hidden="true" />

    <h3 class="absolute left-[18px] top-[16px] text-[20px] font-semibold text-ncm-fg">{{ title }}</h3>
    <p v-if="subtitle" class="absolute left-[18px] top-[48px] text-[13px] text-ncm-faint">{{ subtitle }}</p>

    <span class="absolute bottom-[16px] left-[18px] rounded-full bg-white/70 px-2.5 py-1 text-[12px] text-ncm-fg backdrop-blur-sm">
      查看详情 ›
    </span>
  </article>
</template>
