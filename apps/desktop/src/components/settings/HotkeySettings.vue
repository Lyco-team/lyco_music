<script setup lang="ts">
/**
 * 快捷键自定义（PARITY 6.2）。
 *
 * 交互刻意做成「点一下 → 按新键」而不是下拉选：组合键的可能性太多，
 * 下拉框既列不全也没法表达 Ctrl+Shift+字母。
 *
 * 录键期间要在 documentElement 上打标记，让全局快捷键处理器闭嘴 ——
 * 否则用户按 Ctrl+K 想绑给「收藏」，结果先把焦点跳去搜索框了。
 */
import { onBeforeUnmount, ref } from 'vue'
import { Keyboard } from 'lucide-vue-next'
import { comboFromEvent, comboLabel, HOTKEY_ACTIONS, resetHotkeys } from '@/lib/hotkeys'
import { prefs } from '@/lib/prefs'
import { toast } from '@/lib/toast'
import { t, tf } from '@/lib/i18n'

const recording = ref('')

function startRecord(id: string): void {
  recording.value = id
  document.documentElement.dataset.recordingHotkey = '1'
  window.addEventListener('keydown', onRecord, true)
}

function stopRecord(): void {
  recording.value = ''
  delete document.documentElement.dataset.recordingHotkey
  window.removeEventListener('keydown', onRecord, true)
}

function onRecord(e: KeyboardEvent): void {
  e.preventDefault()
  e.stopPropagation()
  if (e.key === 'Escape') { stopRecord(); return }
  const combo = comboFromEvent(e)
  // 只按了修饰键（Ctrl/Shift/Alt）时 combo 里没有主键，等用户按下一个键
  if (!combo || combo === 'Ctrl' || combo === 'Shift' || combo === 'Alt') return

  const id = recording.value
  // 同一个组合键只能绑一个动作：否则后绑的永远抢不到（find 只返回第一个）
  const taken = Object.keys(prefs.shortcuts).find(k => k !== id && prefs.shortcuts[k] === combo)
  if (taken) {
    const labelKey = HOTKEY_ACTIONS.find(a => a.id === taken)?.labelKey
    const label = labelKey ? t(labelKey) : taken
    toast(tf('desktop.hotkey.alreadyBound', { combo: comboLabel(combo), label }))
    return
  }
  prefs.shortcuts[id] = combo
  stopRecord()
  toast(t('desktop.hotkey.bound'))
}

function clearOne(id: string): void {
  prefs.shortcuts[id] = ''
}

function restore(): void {
  resetHotkeys()
  toast(t('desktop.hotkey.restored'))
}

onBeforeUnmount(stopRecord)
</script>

<template>
  <div class="mt-5 rounded-2xl border border-ncm-divider bg-white p-7">
    <div class="flex items-center gap-2">
      <Keyboard :size="19" class="text-ncm-accent" />
      <h2 class="text-lg font-semibold text-ncm-fg">{{ t('desktop.hotkey.title') }}</h2>
      <button
        type="button"
        class="ml-auto rounded-full border border-ncm-divider px-3 py-1 text-[12px] text-ncm-muted hover:bg-ncm-bg"
        @click="restore"
      >{{ t('desktop.hotkey.restore') }}</button>
    </div>
    <p class="mt-2 text-sm text-ncm-faint">
      {{ t('desktop.hotkey.note') }}
    </p>

    <ul class="mt-4 divide-y divide-ncm-divider rounded-xl border border-ncm-divider">
      <li v-for="a in HOTKEY_ACTIONS" :key="a.id" class="flex items-center gap-3 px-3 py-2">
        <span class="min-w-0 flex-1 truncate text-[13px] text-ncm-fg">{{ t(a.labelKey) }}</span>
        <button
          type="button"
          class="shrink-0 rounded-lg border px-3 py-1 text-[12px] tabular-nums transition-colors"
          :class="recording === a.id
            ? 'border-ncm-accent bg-ncm-accent/10 text-ncm-accent'
            : prefs.shortcuts[a.id] ? 'border-ncm-divider text-ncm-muted hover:bg-ncm-bg' : 'border-dashed border-ncm-divider text-ncm-fainter hover:bg-ncm-bg'"
          @click="recording === a.id ? stopRecord() : startRecord(a.id)"
        >{{ recording === a.id ? t('desktop.hotkey.pressNew') : comboLabel(prefs.shortcuts[a.id] ?? '') }}</button>
        <button
          type="button"
          class="shrink-0 rounded-full px-2 py-1 text-[12px] text-ncm-faint hover:bg-black/5 disabled:opacity-30"
          :title="t('desktop.hotkey.unbind')"
          :disabled="!prefs.shortcuts[a.id]"
          @click="clearOne(a.id)"
        >✕</button>
      </li>
    </ul>
  </div>
</template>
