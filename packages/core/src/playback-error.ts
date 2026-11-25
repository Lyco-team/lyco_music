/**
 * 播放错误分类与用户文案（桌面端 / 移动端共用）
 *
 * 这一层刻意放在内核里：两端对「这个错误该不该自动重试」的判断必须一致。
 * 以前桌面端有一份、移动端另写一份，结果 desktop 修好的「地址过期自动换源」
 * 在手机上完全没生效 —— 用户看到的就是「手机端几乎啥也听不了」。
 */
import { TRIAL_EXHAUSTED_MESSAGE } from './util/duration'

/** 取出错误的可读文本，兼容 Error / 字符串 / null */
export function playbackErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  return ''
}

/**
 * 这个错误值不值得在本次播放里自动重试？
 *
 * 规则：
 *   - 自动播放被系统拦：重试也没用，必须让用户手动点一次；
 *   - 网络整体断了 / HTTP 明确失败：换源也救不了，别把故障藏起来；
 *   - 地址过期、CDN 403、编解码不支持、AbortError：值得重取一次。
 *
 * AbortError 以前被当成「用户主动中断」而直接报错，但实测 Chromium 在
 * 切 src / 预加载被替换时也会抛它，于是「我喜欢的音乐」里点一首歌，
 * 第一次点就显示「加载被中断，点一下播放按钮重试」——用户当然要点两次。
 * 现在它进入重试阶梯，而不是直接糊到界面上。
 */
export function isRetriablePlayError(e: unknown): boolean {
  const name = e instanceof Error ? e.name : ''
  const msg = playbackErrorMessage(e)
  if (/NotAllowedError/i.test(name + msg)) return false
  if (/HTTP \d|没有 fetch|Network|Failed to fetch|timeout|ECONN|ENOTFOUND|abort|aborted/i.test(msg)) return false
  if (/NotSupportedError|AbortError/i.test(name)) return true
  if (/no supported source|Failed to load|MEDIA_ERR|MEDIA_ELEMENT/i.test(msg)) return true
  if (/VIP 专享|试听|无可播放|暂无|版权|下架|缺少|not found|no.*url|占位/i.test(msg)) return true
  return false
}

/** 把底层错误翻成人话（不暴露内部模块前缀与英文原文） */
export function describePlayError(e: unknown): string {
  const name = e instanceof Error ? e.name : ''
  const msg = playbackErrorMessage(e)
  if (/NotAllowedError/i.test(name + msg)) return '系统拦截了自动播放，点一下播放按钮即可'
  if (/NotSupportedError/i.test(name) || /no supported source/i.test(msg)) {
    return '这个音源的地址打不开（可能已过期），已自动换过音源仍不行，稍后再试'
  }
  if (/AbortError/i.test(name + msg)) return '加载被中断，点一下播放按钮重试'
  if (/Network|Failed to fetch|timeout|ECONN|ENOTFOUND/i.test(msg)) return '网络异常，检查网络后重试'
  if (/VIP 专享|试听/.test(msg)) return TRIAL_EXHAUSTED_MESSAGE
  if (/占位/.test(msg)) return '该音源没有这首歌的可播放版本，换个音源试试'
  if (/版权|下架|暂无可播放|暂无|not found/i.test(msg)) return '各音源都没有这首歌的可播放版本，换首歌试试'
  return msg.replace(/^\[lxmn\/[a-z]+\]\s*/i, '') || '播放失败，请重试'
}

/** 播放地址统一升级到 https（明文 http 在 Android 9+ 会被 ExoPlayer 拒绝） */
export function toSecurePlaybackUrl(url: string): string {
  return String(url ?? '').replace(/^http:\/\//i, 'https://')
}
