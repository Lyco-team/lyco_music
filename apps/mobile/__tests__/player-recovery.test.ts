/**
 * 移动端播放自愈的回归测试。
 *
 * 真机上大量"播着播着停了"其实是第一次取到的 CDN 地址过期 / 被拒。
 * 播放器必须在 UI 报错前自动再取一次；这次测试把内核取流替换成探针，
 * 断言第一次失败、第二次成功后真的调用了 TrackPlayer.play()。
 */
import TrackPlayer, { State } from 'react-native-track-player'
import { installWySource } from '@lxmn/core'
import type { MusicItem } from '@lxmn/core'
const mockResolveWithFallback = jest.fn()
jest.mock('@lxmn/core', () => {
  const actual = jest.requireActual('@lxmn/core')
  const result = { ...actual }
  Object.defineProperty(result, 'resolveWithFallback', {
    configurable: true,
    get: () => mockResolveWithFallback,
  })
  return result
})
import { play, setupPlayer, getPlayerState } from '../src/player'

const item: MusicItem = { id: '1', songmid: 'm1', source: 'wy', name: '晴天', singer: '周杰伦' } as MusicItem

describe('移动端取流自愈', () => {
  beforeAll(() => { installWySource() })
  beforeEach(async () => {
    await setupPlayer()
    jest.clearAllMocks()
    ;(TrackPlayer.getPlaybackState as jest.Mock).mockResolvedValue({ state: State.Paused })
  })

  it('第一次取流失败、第二次成功后继续播放，不把失败糊到界面', async () => {
    mockResolveWithFallback.mockReset()
    mockResolveWithFallback
      .mockRejectedValueOnce(new Error('[lxmn/kg] 该歌曲暂无可播放地址（服务端仅返回占位音频）'))
      .mockResolvedValueOnce({
        info: { url: 'http://m701.music.126.net/a.mp3', quality: '128k', type: 'mp3' },
        item,
        switched: false,
      } as never)
    await play(item)

    expect(mockResolveWithFallback).toHaveBeenCalledTimes(2)
    expect(TrackPlayer.play).toHaveBeenCalled()
    expect(getPlayerState().error).toBe('')
    expect(getPlayerState().playing).toBe(true)
  })
})
