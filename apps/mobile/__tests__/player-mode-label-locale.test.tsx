/**
 * 播放页：播放模式按钮的无障碍文案随界面语言切换。
 *
 * 之前该按钮 accessibilityLabel 直接取 player.ts 的中文 modeLabel()，
 * 非中文语言下仍是中文；本用例覆盖 zh-CN / en-US 两种语言。
 */
import React from 'react'
import { render, screen } from '@testing-library/react-native'
import { setLocale } from '../src/lib/i18n'
import PlayerScreen from '../src/screens/PlayerScreen'

jest.mock('../src/player', () => {
  const item = { songmid: '9', name: '测试歌曲', singer: '测试歌手', source: 'wy', albumName: '专辑', interval: '03:00' }
  return {
    currentItem: () => item,
    usePlayerState: () => ({
      queue: [item], index: 0, playing: false, loading: false, error: '',
      quality: '320k', lyric: '', tlyric: '', picUrl: '', mode: 'loop', rate: 1,
    }),
    useProgressState: () => ({ position: 1, duration: 180, playing: false }),
    useLyricLines: () => ({ lines: [], activeIndex: -1 }),
    cycleMode: jest.fn(), setRate: jest.fn(), cycleQuality: jest.fn(),
    RATES: [0.75, 1, 1.25, 1.5, 2],
    next: jest.fn(), prev: jest.fn(), seek: jest.fn(), toggle: jest.fn(), play: jest.fn(),
    retry: jest.fn(async () => undefined),
    clearQueue: jest.fn(), removeFromQueue: jest.fn(),
  }
})

jest.mock('../src/sync', () => ({
  library: {
    load: jest.fn(async () => undefined),
    snapshot: () => ({ favorites: [] }),
    toggleFavorite: jest.fn(async () => undefined),
    isDisliked: () => false,
    addDislikes: jest.fn(async () => undefined),
    removeDislike: jest.fn(async () => undefined),
  },
}))

jest.mock('@lxmn/core', () => ({
  ...jest.requireActual('@lxmn/core'),
  getSource: () => ({ id: 'wy', name: '网易云', getComments: async () => ({ list: [], total: 0, more: false, page: 1, limit: 20 }) }),
  hasSource: () => true, listSources: () => ['wy'],
  parseCommentContent: (text: string) => [{ type: 'text' as const, text: String(text ?? '') }],
  parseLyric: () => ({ lines: [], hasTranslation: false }), findLineIndex: () => -1,
}))

describe('播放页播放模式无障碍文案', () => {
  afterEach(async () => { await setLocale('zh-CN') })

  it('默认中文显示切换播放模式：列表循环', () => {
    render(<PlayerScreen />)
    expect(screen.getByLabelText('切换播放模式：列表循环')).toBeTruthy()
  })

  it('切到英文后显示 Switch play mode: List loop', async () => {
    await setLocale('en-US')
    render(<PlayerScreen />)
    expect(screen.getByLabelText('Switch play mode: List loop')).toBeTruthy()
  })
})
