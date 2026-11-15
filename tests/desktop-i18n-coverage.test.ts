import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { TRANSLATION_KEYS, translate, translateFormat } from '../packages/core/src/i18n'

const ROOT = resolve(__dirname, '..')
const KEYS = new Set<string>(TRANSLATION_KEYS as string[])
const CJK = /[\u3400-\u9fff]/
const read = (file: string): string => readFileSync(resolve(ROOT, file), 'utf8')

// 只取单行字符串字面量；模板/注释里的中文不算界面文案。
function literals(src: string): string[] {
  const out: string[] = []
  for (const line of src.split('\n')) {
    const m = line.match(/^\s*(?:[\w.$]+:\s*)?(['"])((?:[^'"\\]|\\.)*)\1\s*[,;:)]?\s*$/)
    if (m && CJK.test(m[2])) out.push(m[2])
    else {
      // 同一行多个字面量（如预设数组/map）
      for (const x of line.matchAll(/(['"])((?:[^'"\\]|\\.)*)\1/g)) {
        if (CJK.test(x[2])) out.push(x[2])
      }
    }
  }
  return [...new Set(out)]
}

function dictLines(src: string, start: string): string[] {
  const lines = src.split('\n')
  const a = lines.findIndex(x => x.startsWith(start))
  const z = lines.findIndex((x, i) => i > a && x === '}')
  expect(a, start).toBeGreaterThanOrEqual(0)
  expect(z, start + ' closing').toBeGreaterThan(a)
  return lines.slice(a + 1, z)
}

function dict(src: string, start: string): Record<string, string> {
  const d: Record<string, string> = {}
  for (const line of dictLines(src, start)) {
    const m = line.match(/^\s*(['"])(.+?)\1:\s*(['"])(.*?)\3,?\s*$/)
    if (m) d[m[2]] = m[4]
  }
  return d
}

const CORE = read('packages/core/src/i18n.ts')
const ZH = dict(CORE, 'const ZH_CN: Dict = {')
const EN = dict(CORE, 'const EN_US: Dict = {')
const KO = dict(CORE, 'const KO_KR: Dict = {')

const DATA_MODULES = [
  'apps/desktop/src/lib/prefs.ts',
  'apps/desktop/src/lib/theme.ts',
  'apps/desktop/src/lib/texture.ts',
  'apps/desktop/src/lib/lyric-style.ts',
]

const VIEWS = [
  'apps/desktop/src/components/layout/PlayBar.vue',
  'apps/desktop/src/views/DesktopLyric.vue',
  'apps/desktop/src/components/settings/PrefsSettings.vue',
  'apps/desktop/src/views/Settings.vue',
  'apps/desktop/src/components/layout/TopBar.vue',
]

describe('desktop i18n coverage: playbar / lyric / settings', () => {
  it('三语字典同步、英文没有中文、中文 phrase key 逐字自洽', () => {
    expect(Object.keys(ZH)).toEqual(Object.keys(EN))
    expect(Object.keys(EN)).toEqual(Object.keys(KO))
    expect(Object.keys(ZH).length).toBeGreaterThanOrEqual(814)
    for (const [k, v] of Object.entries(ZH)) {
      if (CJK.test(k)) expect(v, k).toBe(k)
    }
    for (const [k, v] of Object.entries(EN)) {
      expect(v.length, k).toBeGreaterThan(0)
      expect(CJK.test(v), k + ' => ' + v).toBe(false)
      expect(v, k).not.toMatch(/^[a-z]+\.[a-z]/i)
    }
    for (const [k, v] of Object.entries(KO)) expect(v.length, k).toBeGreaterThan(0)
  })

  it('窗口/字体/主题/皮肤/歌词预设名和说明都进了共享字典', () => {
    for (const file of DATA_MODULES) {
      const missing = literals(read(file)).filter(x => !KEYS.has(x))
      expect(missing, file).toEqual([])
    }
    const expected = ['迷你', '宽屏', '大屏', '全高清', '适配屏幕', '网易红', '清青', '静谧蓝', '暮紫', '暖橙', '樱粉', '液态玻璃', '半调网点', '胶片颗粒', '抖动噪点', '细密网格', '纯净', '雅黑', '楷体', '圆体', '等宽']
    for (const key of expected) expect(KEYS.has(key), key).toBe(true)
  })

  it('播放栏/桌面歌词/设置页的脚本中文 key 都在字典，且非静态绑定', () => {
    for (const file of VIEWS) {
      const src = read(file)
      const a = src.indexOf('<script')
      const z = src.indexOf('</script>', a)
      const script = src.slice(a, z)
      const fallbacks = new Set<string>()
      for (const m of script.matchAll(/\bt\(\s*['"][^'"]+['"]\s*,\s*(['"])((?:[^'"\\]|\\.)*)\1/g)) fallbacks.add(m[2])
      // 只需过滤 named-key fallback 与 URI 示例；其余中文都应是字典 key 或注释。
      const missing = literals(script).filter(x => !fallbacks.has(x) && !KEYS.has(x) && !x.startsWith('lxmusic://') && !x.includes('/**') && !x.includes('*/'))
      expect(missing, file).toEqual([])
    }
  })

  it('模板里没有残留的静态中文属性、纯文本节点或裸预设名', () => {
    for (const file of VIEWS) {
      const src = read(file)
      const a = src.indexOf('<template>')
      const z = src.lastIndexOf('</template>')
      const html = src.slice(a, z)
      const stripped = html
        .replace(/\{\{[\s\S]*?\}\}/g, '')
        .replace(/:\w[\w.-]*="[^"]*"/g, '')
        .replace(/v-[\w.-]*="[^"]*"/g, '')
        .replace(/<script[\s\S]*?<\/script>/g, '')
      const attrs = [...stripped.matchAll(/\b(?:aria-label|title|placeholder|alt)="([^"]*)"/g)]
        .map(m => m[1]).filter(x => CJK.test(x))
      const textNodes = [...stripped.matchAll(/>([^<>]*)</g)]
        .map(m => m[1]).filter(x => CJK.test(x.trim()) && !/^\s*\{\{/.test(x))
      expect(attrs, file + ' static CJK attrs').toEqual([])
      expect(textNodes, file + ' static CJK text').toEqual([])
    }
  })

  it('本轮新接入的长文案、占位符插值和 named placeholder 三语可用', () => {
    const phrases = ['复制示例', '外部程序可以用', '唤起播放器：', '打开下载页', '启动时自动检查', '升级后弹更新日志', '恢复推荐', '脚本地址，https://…/xxx.js', '已恢复：', '已合并：']
    for (const key of phrases) {
      expect(KEYS.has(key), key).toBe(true)
      for (const loc of ['zh-CN', 'zh-TW', 'en-US', 'ko-KR'] as const) {
        expect(translate(key, loc), key + '/' + loc).toBeTruthy()
      }
    }
    expect(translateFormat('本机最多 {max} 声道，当前按 {current} 声道输出。', 'en-US', { max: 2, current: 2 })).toContain('2')
    expect(translateFormat('已导出：收藏 {favorites} · 歌单 {playlists} · 历史 {history} · 试听 {trial}', 'zh-CN', { favorites: 1, playlists: 2, history: 3, trial: 4 })).toBe('已导出：收藏 1 · 歌单 2 · 历史 3 · 试听 4')
    expect(translate('set.dislikePlaceholder', 'en-US')).toContain('Jay Chou')
  })
})
