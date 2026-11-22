<script setup lang="ts">
import { Headphones } from 'lucide-vue-next'

const props = defineProps<{
  title: string
  cover: string
  plays: number
}>()
const emit = defineEmits<{ (e: 'open'): void }>()

function playCount(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万'
  return String(n)
}
</script>

<template>
  <article class="group w-[157px] shrink-0 cursor-pointer" @click="emit('open')">
    <div class="relative h-[157px] w-[156px] overflow-hidden rounded-cover bg-ncm-fainter/40">
      <img
        :src="cover"
        alt=""
        class="size-full object-cover"
        referrerpolicy="no-referrer"
        loading="lazy"
      />
      <span class="tex-img" aria-hidden="true" />

      <span
        class="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/45 px-1.5 py-0.5 text-[11px] leading-none text-white backdrop-blur-sm"
      >
        <Headphones :size="12" :stroke-width="2" aria-hidden="true" />
        {{ playCount(props.plays) }}
      </span>

      <div class="absolute bottom-2 right-2 flex size-[30px] items-center justify-center rounded-full bg-white/90 opacity-0 transition-opacity group-hover:opacity-100">
        <svg viewBox="0 0 24 24" class="size-3.5 fill-ncm-accent-play"><path d="M8 5v14l11-7z" /></svg>
      </div>
    </div>

    <p class="mt-2 line-clamp-2 text-[15px] leading-[22px] text-ncm-fg">{{ title }}</p>
  </article>
</template>
