/**
 * 后台播放服务的回归测试。
 *
 * 原生 TrackPlayer 队列里只有当前一首（换曲要重新签名取流），
 * 通知栏 / 耳机按键如果直接调 skipToNext()，播放就会停住。
 * 这里只断言"远端切歌走 JS 队列"，避免真机才能发现。
 */
import playbackService from '../src/playback/service'
import TrackPlayer, { Event } from 'react-native-track-player'
import * as player from '../src/player'

jest.mock('../src/player', () => ({
  next: jest.fn(async () => undefined),
  prev: jest.fn(async () => undefined),
}))

describe('后台播放服务', () => {
  it('通知栏下一首/上一首走 JS 切歌，不做原生跳曲', async () => {
    const addEventListener = TrackPlayer.addEventListener as jest.Mock
    addEventListener.mockClear()
    await playbackService()
    const handlers = new Map<string, (e?: unknown) => void>()
    for (const [event, fn] of addEventListener.mock.calls) {
      if (typeof event !== 'string' || typeof fn !== 'function') continue
      handlers.set(event, fn as (e?: unknown) => void)
    }

    expect(handlers.has(Event.RemoteNext)).toBe(true)
    expect(handlers.has(Event.RemotePrevious)).toBe(true)
    handlers.get(Event.RemoteNext)?.()
    handlers.get(Event.RemotePrevious)?.()
    expect(player.next).toHaveBeenCalledWith(false)
    expect(player.prev).toHaveBeenCalled()
    expect(TrackPlayer.skipToNext).not.toHaveBeenCalled()
    expect(TrackPlayer.skipToPrevious).not.toHaveBeenCalled()
  })
})
