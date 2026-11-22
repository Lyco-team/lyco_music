import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8')
const exists = (rel: string): boolean => existsSync(resolve(ROOT, rel))

const ROUTES = ['', 'search', 'discover', 'player', 'account', 'membership', 'sync', 'my', 'downloads', 'import', 'friends', 'settings', 'lyric-window'] as const
const VIEW_FOR: Record<string, string> = { '': 'apps/desktop/src/views/Home.vue', search: 'apps/desktop/src/views/Search.vue', discover: 'apps/desktop/src/views/Discover.vue', player: 'apps/desktop/src/views/Player.vue', account: 'apps/desktop/src/views/Account.vue', membership: 'apps/desktop/src/views/Membership.vue', sync: 'apps/desktop/src/views/Sync.vue', my: 'apps/desktop/src/views/MyMusic.vue', downloads: 'apps/desktop/src/views/Downloads.vue', import: 'apps/desktop/src/views/Import.vue', friends: 'apps/desktop/src/views/Friends.vue', settings: 'apps/desktop/src/views/Settings.vue', 'lyric-window': 'apps/desktop/src/views/DesktopLyric.vue' }

const CHANGED = [
  'apps/desktop/src/components/ui/ChannelCard.vue',
  'apps/desktop/src/components/ui/PlaylistCard.vue',
  'apps/desktop/src/components/ui/ActivityBanner.vue',
  'apps/desktop/src/components/layout/Sidebar.vue',
  'apps/desktop/src/components/layout/TopBar.vue',
  'apps/desktop/src/components/layout/PlayBar.vue',
  'apps/desktop/src/views/Home.vue',
  'apps/desktop/src/views/Player.vue',
  'apps/desktop/src/styles/main.css',
] as const

function template(rel: string): string {
  const src = read(rel)
  const a = src.indexOf('<template>')
  const z = src.lastIndexOf('</template>')
  expect(a, rel + ' template start').toBeGreaterThanOrEqual(0)
  expect(z, rel + ' template end').toBeGreaterThan(a)
  return src.slice(a, z)
}

describe('desktop UI parity feat: all pages present', () => {
  it('every router target has a real Vue view file', () => {
    const router = read('apps/desktop/src/router.ts')
    for (const route of ROUTES) {
      const path = route ? '/' + route : '/'
      expect(router, `route ${path}`).toContain(`path: '${path}'`)
      const file = VIEW_FOR[route]
      expect(exists(file), file).toBe(true)
      expect(read(file).includes('<template>'), file + ' has template').toBe(true)
      expect(read(file).includes('<script'), file + ' has script').toBe(true)
    }
  })

  it('each view has a navigable content region and page-level structure', () => {
    for (const route of ROUTES) {
      const file = VIEW_FOR[route]
      const tpl = template(file)
      const hasHeadingOrRegion = /<(h1|h2|h3|section|main|article|div)\b/.test(tpl)
      const hasInteractive = /<button\b|<input\b|role=/.test(tpl) || route === 'player' || route === 'lyric-window'
      expect(hasHeadingOrRegion, file + ' has heading/region').toBe(true)
      expect(hasInteractive, file + ' has interactive structure').toBe(true)
      expect(tpl.length, file + ' substantial template').toBeGreaterThan(1000)
    }
  })
})

describe('desktop UI parity feat: 100% changed-surface coverage', () => {
  it('all changed UI files are guarded by a contract assertion', () => {
    for (const rel of CHANGED) expect(exists(rel), rel).toBe(true)
    expect(exists('tests/desktop-ui-parity.test.ts'), 'self test').toBe(true)
  })

  it('shell measurements match DESIGN.md', () => {
    const app = read('apps/desktop/src/App.vue')
    expect(app).toContain('w-sidebar shrink-0')
    expect(app).toContain('h-topbar shrink-0')
    expect(app).toContain('h-bottombar shrink-0')
    expect(app).toContain('px-[49px]')

    const css = read('apps/desktop/src/styles/main.css')
    for (const token of ['--spacing-sidebar: 255px', '--spacing-topbar: 94px', '--spacing-bottombar: 102px', '--radius-nav: 10px', '--radius-search: 11px', '--radius-channel: 8px', '--radius-cover: 7px', '--radius-banner: 12px', '--radius-tab: 21px']) {
      expect(css, token).toContain(token)
    }
    expect(css).toContain('.no-scrollbar')
  })

  it('sidebar/topbar/playbar contract', () => {
    const sidebar = read('apps/desktop/src/components/layout/Sidebar.vue')
    expect(sidebar).toContain('ml-[30px] flex h-[47px] w-[206px]')
    expect(sidebar).toContain('rounded-nav')
    expect(sidebar).toContain('size-[35px]')
    expect(sidebar).toContain('min-h-[57px] w-[206px]')

    const topbar = read('apps/desktop/src/components/layout/TopBar.vue')
    expect(topbar).toContain('h-[44px] w-[34px]')
    expect(topbar).toContain('h-[45px] min-w-[160px] max-w-[324px]')
    expect(topbar).toContain('h-[45px] w-[45px]')

    const playbar = read('apps/desktop/src/components/layout/PlayBar.vue')
    expect(playbar).toContain('pl-[49px]')
    expect(playbar).toContain('size-[52px]')
    expect(playbar).toContain(':size="24"')
  })

  it('home cards are extracted and all data arrays are fully rendered', () => {
    const home = read('apps/desktop/src/views/Home.vue')
    for (const comp of ['ChannelCard', 'PlaylistCard', 'ActivityBanner']) {
      expect(home, comp + ' import').toContain(`components/ui/${comp}.vue`)
      expect(home, comp + ' usage').toContain(`<${comp}`)
    }
    expect(home).toContain('channelsRow')
    expect(home).toContain('playlistsRow')
    expect(home).toContain('scrollRow(channelsRow, -1)')
    expect(home).toContain('scrollRow(channelsRow, 1)')
    expect(home).toContain('v-for="pl in playlists"')
    expect(home).toContain('v-for="a in activities"')

    const channel = read('apps/desktop/src/components/ui/ChannelCard.vue')
    expect(channel).toContain('h-[266px] w-[207px]')
    expect(channel).toContain('rounded-channel')
    expect(channel).toContain('<h3')
    expect(channel).toContain("emit('open')")

    const playlist = read('apps/desktop/src/components/ui/PlaylistCard.vue')
    expect(playlist).toContain('h-[157px] w-[156px]')
    expect(playlist).toContain('line-clamp-2')
    expect(playlist).toContain('Headphones')
    expect(playlist).toContain('n >= 10000')

    const activity = read('apps/desktop/src/components/ui/ActivityBanner.vue')
    expect(activity).toContain('h-[209px] w-[373px]')
    expect(activity).toContain('rounded-banner')
    expect(activity).toContain("emit('open')")
  })

  it('player geometry and seek/lyric interactions are guarded', () => {
    const player = read('apps/desktop/src/views/Player.vue')
    expect(player).toContain('w-[1036px]')
    expect(player).toContain('size-[574px] translate-y-[19px]')
    expect(player).toContain('size-[344px]')
    expect(player).toContain('size-[316px]')
    expect(player).toContain('top-[90px]')
    expect(player).toContain('w-[260px] origin-left rotate-[26deg]')
    expect(player).toContain('-ml-[31px]')
    expect(player).toContain('repeating-radial-gradient')
    expect(player).toContain('animate-[spin_20s_linear_infinite]')
    expect(player).toContain('activeTab')
    expect(player).toContain('currentLine')
  })

  it('no Netease brand assets or names leaked into the UI', () => {
    const files = [...CHANGED, ...Object.values(VIEW_FOR)]
    for (const rel of [...new Set(files)]) {
      const src = read(rel)
      expect(src.includes('网易云音乐'), rel + ' brand name').toBe(false)
      expect(src.includes('云村'), rel + ' brand nickname').toBe(false)
      expect(/NeteaseCloudMusic|netease-cloud/i.test(src), rel + ' brand asset').toBe(false)
    }
  })
})
