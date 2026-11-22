<script setup lang="ts">
defineProps<{
  title: string
  desc: string
  tone: string
  cover?: string
}>()
const emit = defineEmits<{ (e: 'open'): void }>()
</script>

<template>
  <article
    class="group relative h-[266px] w-[207px] shrink-0 cursor-pointer overflow-hidden rounded-channel"
    :style="{ background: tone }"
    @click="emit('open')"
  >
    <img
      v-if="cover"
      :src="cover"
      alt=""
      class="absolute inset-0 size-full object-cover"
      referrerpolicy="no-referrer"
      loading="lazy"
    />
    <span class="tex-img" aria-hidden="true" />
    <div class="absolute inset-0 bg-gradient-to-b from-black/10 to-black/55" />

    <h3 class="absolute left-[13px] top-[13px] text-[21px] font-bold leading-tight text-white drop-shadow">
      {{ title }}
    </h3>

    <div class="absolute inset-x-0 bottom-0 px-[13px] pb-[13px]">
      <p class="text-[14px] leading-[22px] text-white/90">{{ desc }}</p>
    </div>

    <div
      class="absolute bottom-[13px] right-[13px] flex size-[34px] items-center justify-center rounded-full bg-white/90 opacity-0 transition-opacity group-hover:opacity-100"
    >
      <svg viewBox="0 0 24 24" class="size-4 fill-ncm-accent-play"><path d="M8 5v14l11-7z" /></svg>
    </div>
  </article>
</template>
