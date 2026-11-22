<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { coverFor } from '@/lib/covers'
import { useI18n } from '@/lib/i18n'
import ChannelCard from '@/components/ui/ChannelCard.vue'
import PlaylistCard from '@/components/ui/PlaylistCard.vue'
import ActivityBanner from '@/components/ui/ActivityBanner.vue'

const { t } = useI18n()

/**
 * 首页「推荐」—— 实测规格：
 * 频道卡 7 张、207x266（比例 0.78）、间距 20px，整图背景 + 底部蒙层
 * 推荐歌单 1 行 9 列、封面 156x157、水平间距 19~20px、标题 2 行省略
 * 精选活动 4 张横幅、373x209、间距 24~25px
 * 区块纵向间距 38~47px
 */
const channels = computed(() => [
  { title: t('home.ch.daily', '每日推荐'), desc: t('home.ch.dailyDesc', '根据你的口味生成'), tone: '#e57373', keyword: '热门' },
  { title: t('home.ch.roam', '私人漫游'), desc: t('home.ch.roamDesc', '无限漫游'), tone: '#64b5f6', keyword: '华语流行' },
  { title: t('home.ch.radar', '私人雷达'), desc: t('home.ch.radarDesc', '为你精选'), tone: '#9575cd', keyword: '轻音乐' },
  { title: t('home.ch.hiphop', '嘻哈/说唱日推'), desc: t('home.ch.updated', '每日更新'), tone: '#4db6ac', keyword: '说唱' },
  { title: t('home.ch.mood', '心情氛围歌单'), desc: t('home.ch.moodDesc', '此刻的心情'), tone: '#ffb74d', keyword: '治愈' },
  { title: t('home.ch.western', '欧美流行日推'), desc: t('home.ch.updated', '每日更新'), tone: '#7986cb', keyword: '欧美流行' },
  { title: t('home.ch.folk', '民谣日推'), desc: t('home.ch.updated', '每日更新'), tone: '#a1887f', keyword: '民谣' },
])

const router = useRouter()

const covers = reactive<Record<string, string>>({})
const loaded = ref(false)
const channelsRow = ref<HTMLElement | null>(null)
const playlistsRow = ref<HTMLElement | null>(null)

async function fillCover(key: string): Promise<void> {
  const url = await coverFor(key).catch(() => '')
  if (url) covers[key] = url
}

onMounted(async () => {
  const channelKeys = [...new Set(channels.value.map(c => c.keyword))]
  const rest = [...new Set(playlists.map(p => p.title))].filter(k => !channelKeys.includes(k))
  await Promise.all(channelKeys.map(fillCover))
  loaded.value = true
  void Promise.all(rest.map(fillCover))
})

function picFor(keyword: string, fallback: string): string {
  return covers[keyword] || fallback
}

function openChannel(keyword: string): void {
  void router.push({ name: 'search', query: { q: keyword } })
}

function scrollRow(el: HTMLElement | null, dir: -1 | 1): void {
  el?.scrollBy({ left: dir * 454, behavior: 'smooth' })
}

const playCounts = [183420, 96218, 75430, 128900, 63150, 88420, 47260, 115800, 59310]
const playlists = [
  '华语流行精选', '轻音乐助眠', '深夜电台', '电子舞曲', '摇滚经典',
  '民谣故事', '古典名曲', '爵士夜曲', '影视原声',
].map((title, i) => ({ id: i, title, plays: playCounts[i] ?? 0 }))

const activities = ['新歌抢先听', '会员福利社', '音乐人计划', '线下演出'].map((title, i) => ({
  id: i,
  title,
}))

function openPlaylist(title: string): void {
  void router.push({ name: 'search', query: { q: title } })
}
</script>

<template>
  <div class="pt-4">
    <!-- ============ 顶部精选频道：7 张，207x266 ============ -->
    <section class="relative">
      <div ref="channelsRow" class="no-scrollbar flex gap-5 overflow-x-auto scroll-smooth pb-1">
        <ChannelCard
          v-for="ch in channels"
          :key="ch.title"
          :title="ch.title"
          :desc="ch.desc"
          :tone="ch.tone"
          :cover="covers[ch.keyword]"
          @open="openChannel(ch.keyword)"
        />
      </div>

      <button type="button" class="absolute -left-9 top-1/2 -translate-y-1/2 text-[26px] text-[#b9bfca] hover:text-ncm-accent" aria-label="上一组" @click="scrollRow(channelsRow, -1)">‹</button>
      <button type="button" class="absolute -right-9 top-1/2 -translate-y-1/2 text-[26px] text-[#b9bfca] hover:text-ncm-accent" aria-label="下一组" @click="scrollRow(channelsRow, 1)">›</button>
    </section>

    <!-- ============ 推荐歌单：9 列，封面 156x157 ============ -->
    <section class="mt-[43px]">
      <div class="mb-[18px] flex items-center gap-2">
        <h2 class="text-[24px] font-bold leading-8 text-ncm-fg">推荐歌单</h2>
        <span class="text-[20px] leading-8 text-ncm-fainter">›</span>
        <div class="flex-1" />
        <button type="button" class="text-[15px] text-ncm-faint hover:text-ncm-accent" aria-label="刷新">↻</button>
      </div>

      <div ref="playlistsRow" class="no-scrollbar flex gap-5 overflow-x-auto scroll-smooth pb-1">
        <PlaylistCard
          v-for="pl in playlists"
          :key="pl.id"
          :title="pl.title"
          :cover="picFor(pl.title, './art/playlist-default.jpg')"
          :plays="pl.plays"
          @open="openPlaylist(pl.title)"
        />
      </div>
    </section>

    <!-- ============ 精选活动：4 张，373x209 ============ -->
    <section class="mt-[43px]">
      <div class="mb-[18px] flex items-center gap-2">
        <h2 class="text-[24px] font-bold leading-8 text-ncm-fg">精选活动</h2>
        <span class="text-[20px] leading-8 text-ncm-fainter">›</span>
      </div>

      <div class="no-scrollbar flex gap-[24px] overflow-x-auto scroll-smooth pb-1">
        <ActivityBanner
          v-for="a in activities"
          :key="a.id"
          :title="a.title"
          @open="openPlaylist(a.title)"
        />
      </div>
    </section>
  </div>
</template>
