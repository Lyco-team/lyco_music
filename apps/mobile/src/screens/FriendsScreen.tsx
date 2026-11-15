/**
 * 好友页（移动端）
 *
 * 身份即订阅：未开通会员时引导去会员页；开通后用好友码加好友。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View,
} from 'react-native'
import { useFriendsApi, type ChatMessage, type FriendsState } from '../friends'
import { pullFeed, type FeedItem } from '../share'
import { colors, useTopInset } from '../theme'
import { t as tr, tf, useLocale } from '../lib/i18n'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const AVATAR = require('../assets/art/avatar-default.jpg') as number

function fmtTime(t: number): string {
  if (!t) return '—'
  const d = new Date(t * 1000)
  return (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
    String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}

export default function FriendsScreen({ onNeedMembership, onOpenMy }: { onNeedMembership?: () => void; onOpenMy?: () => void }) {
  const insetTop = useTopInset()
  useLocale()
  const api = useFriendsApi()
  const [state, setState] = useState<FriendsState>({
    me: null, friends: [], pendingIn: [], pendingOut: [],
  })
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [code, setCode] = useState('')
  /** 当前打开的会话（好友码），空串表示没开 */
  const [chatWith, setChatWith] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [unread, setUnread] = useState<Record<string, number>>({})
  /** 已拉到的最大消息 id，轮询游标 */
  const lastIdRef = useRef(0)

  const pull = useCallback(async () => {
    const r = await api.refresh()
    if (r) {
      setState({ me: r.mine, friends: r.list.friends, pendingIn: r.list.pendingIn, pendingOut: r.list.pendingOut })
    }
    const f = await pullFeed()
    if (f) setFeed(f.items)
  }, [])

  useEffect(() => { void pull() }, [])

  /** 未读角标：进页面拉一次，开会话时也刷一次 */
  const refreshUnread = useCallback(async () => {
    const r = await api.unread()
    if (r) setUnread(r.byCode ?? {})
  }, [])

  useEffect(() => { void refreshUnread() }, [])

  /**
   * 会话打开期间每 5 秒增量拉一次。
   *
   * 桌面端在 lib 里做了轮询，移动端这边之前只拉了首屏 —— 对方回消息要退出重进
   * 才看得到，等于聊天只能单边用。after 传已有的最大 id，只取新的。
   */
  useEffect(() => {
    if (!chatWith) return
    let alive = true
    const timer = setInterval(() => {
      void (async () => {
        // 用 ref 读游标：不能把 messages 放进依赖，否则每来一条消息
        // 都会重建定时器，等于把轮询节流成「消息越频繁越慢」
        const last = lastIdRef.current
        const r = await api.messages(chatWith, last)
        if (!alive || !r?.messages?.length) return
        setMessages((prev) => [...prev, ...r.messages])
        void refreshUnread()
      })()
    }, 5000)
    return () => { alive = false; clearInterval(timer) }
  }, [chatWith])

  const openChat = useCallback(async (friendCode: string) => {
    setChatWith(friendCode)
    setMessages([])
    lastIdRef.current = 0
    const r = await api.messages(friendCode, 0)
    if (r) {
      setMessages(r.messages ?? [])
      const list = r.messages ?? []
      if (list.length) lastIdRef.current = list[list.length - 1]!.id
    }
    void refreshUnread()
  }, [])

  const send = useCallback(async () => {
    const text = draft.trim()
    if (!text || !chatWith) return
    setDraft('')
    const ok = await api.sendText(chatWith, text)
    if (ok !== null) {
      const r = await api.messages(chatWith, lastIdRef.current)
      if (r?.messages?.length) {
        setMessages((prev) => [...prev, ...r.messages])
        lastIdRef.current = r.messages[r.messages.length - 1]!.id
      }
    }
  }, [draft, chatWith])

  const submit = async () => {
    if (!code.trim()) return
    const ok = await api.addByCode(code)
    if (ok !== null) {
      setCode('')
      void pull()
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insetTop }}
      contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
    >
      <Text style={{ color: colors.fg, fontSize: 24, fontWeight: '700' }}>{tr('page.friends')}</Text>

      {/* 确实没有会员：引导去开通 */}
      {api.denied && !state.me ? (
        <View style={{ marginTop: 40, alignItems: 'center' }}>
          <Image source={AVATAR} style={{ width: 110, height: 110, borderRadius: 55, opacity: 0.9 }} />
          <Text style={{ marginTop: 16, color: colors.fg, fontSize: 16 }}>{tr('fr.needVip')}</Text>
          <Text style={{ marginTop: 6, color: colors.muted, fontSize: 13, textAlign: 'center' }}>
            {tr('mobile.friends.needVipDesc')}
          </Text>
          <Pressable
            onPress={onNeedMembership}
            style={{ marginTop: 18, backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 26, paddingVertical: 11 }}
          >
            <Text style={{ color: '#fff', fontSize: 14 }}>{tr('fr.goActivate')}</Text>
          </Pressable>
        </View>
      ) : null}

      {/*
        加载失败（服务器 500 / 断网）单独一条分支。
        以前这里和「没有会员」共用同一块，于是服务端一抖，界面就告诉用户
        「好友功能需要音乐会员」—— 明明有 VIP 也像是掉了。
      */}
      {!api.denied && !state.me && !api.busy && !!api.error ? (
        <View style={{ marginTop: 40, alignItems: 'center' }}>
          <Text style={{ color: colors.fg, fontSize: 16 }}>{tr('fr.loadFail')}</Text>
          <Text style={{ marginTop: 6, color: colors.muted, fontSize: 13, textAlign: 'center' }}>
            {api.error}
          </Text>
          <Pressable
            onPress={() => { void pull() }}
            style={{ marginTop: 18, borderWidth: 1, borderColor: colors.divider, borderRadius: 999, paddingHorizontal: 26, paddingVertical: 10 }}
          >
            <Text style={{ color: colors.fg, fontSize: 14 }}>{tr('fr.reload')}</Text>
          </Pressable>
        </View>
      ) : null}

      {api.error ? (
        <Text style={{ marginTop: 10, color: colors.accent, fontSize: 13 }}>{api.error}</Text>
      ) : null}

      {state.me ? (
        <>
          {/* 我的身份卡 */}
          <View style={{
            marginTop: 14, backgroundColor: colors.surface, borderRadius: 12, padding: 16,
            flexDirection: 'row', alignItems: 'center', gap: 12,
          }}>
            <Image source={AVATAR} style={{ width: 56, height: 56, borderRadius: 28 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.fg, fontSize: 16, fontWeight: '600' }} numberOfLines={1}>
                {state.me.nickname}
              </Text>
              <View style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{tr('fr.code')}</Text>
                <Text style={{ color: colors.fg, fontSize: 14, letterSpacing: 2, fontFamily: 'monospace' }}>
                  {state.me.friendCode}
                </Text>
              </View>
            </View>
          </View>

          {/* 加好友 */}
          <View style={{ marginTop: 14, backgroundColor: colors.surface, borderRadius: 12, padding: 16 }}>
            <Text style={{ color: colors.fg, fontSize: 15, fontWeight: '600' }}>{tr('fr.add')}</Text>
            <View style={{ marginTop: 10, flexDirection: 'row', gap: 8 }}>
              <TextInput
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase())}
                maxLength={8}
                autoCapitalize="characters"
                placeholder={tr('mobile.friends.codePlaceholder')}
                placeholderTextColor={colors.fainter}
                style={{
                  flex: 1, borderWidth: 1, borderColor: colors.divider, borderRadius: 10,
                  paddingHorizontal: 12, paddingVertical: 10, color: colors.fg,
                  fontSize: 14, letterSpacing: 2, fontFamily: 'monospace',
                }}
              />
              <Pressable
                onPress={() => { void submit() }}
                disabled={api.busy || !code.trim()}
                style={{
                  backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 18,
                  paddingVertical: 10, justifyContent: 'center', opacity: api.busy || !code.trim() ? 0.5 : 1,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 13 }}>{tr('mobile.friends.addButton')}</Text>
              </Pressable>
            </View>
          </View>

          {/* 收到的请求 */}
          {state.pendingIn.length ? (
            <View style={{ marginTop: 16 }}>
              <Text style={{ color: colors.fg, fontSize: 15, fontWeight: '600' }}>
                {tf('mobile.friends.pending', { n: state.pendingIn.length })}
              </Text>
              {state.pendingIn.map((p) => (
                <View key={p.id} style={{
                  marginTop: 8, backgroundColor: colors.surface, borderRadius: 12, padding: 12,
                  flexDirection: 'row', alignItems: 'center', gap: 10,
                }}>
                  <Image source={AVATAR} style={{ width: 40, height: 40, borderRadius: 20 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.fg, fontSize: 14 }} numberOfLines={1}>{p.nickname}</Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>
                      {p.friendCode} · {fmtTime(p.createdAt)}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => { void api.accept(p.id).then(() => pull()) }}
                    style={{ backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 }}
                  >
                    <Text style={{ color: '#fff', fontSize: 12 }}>{tr('mobile.friends.accept')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => { void api.decline(p.id).then(() => pull()) }}
                    style={{ borderWidth: 1, borderColor: colors.divider, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 }}
                  >
                    <Text style={{ color: colors.muted, fontSize: 12 }}>{tr('mobile.friends.decline')}</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          {/* 好友动态 */}
          {feed.length ? (
            <View style={{ marginTop: 16 }}>
              <Text style={{ color: colors.fg, fontSize: 15, fontWeight: '600' }}>{tr('fr.feed')}</Text>
              {feed.map((item, i) => (
                <View key={i} style={{
                  marginTop: 8, backgroundColor: colors.surface, borderRadius: 12, padding: 12,
                  flexDirection: 'row', alignItems: 'center', gap: 10,
                }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.fg, fontSize: 13.5 }} numberOfLines={1}>
                      {tf('mobile.friends.shared', { name: item.nickname, title: item.payload.name })}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>{tf('mobile.my.tracks', { n: item.payload.count })}</Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      // 导入走「我的」页：把码暂存，MyMusicScreen 挂载时识别
                      // （RN 无 sessionStorage，用全局挂一个）
                      ;(globalThis as { __lycoImportShare?: string }).__lycoImportShare = item.payload.shareCode
                      onOpenMy?.()
                    }}
                    style={{ backgroundColor: colors.accent + '22', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
                    <Text style={{ color: colors.accent, fontSize: 12 }}>{tr('mobile.my.import')}</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : null}

          {/* 好友列表 */}
          <View style={{ marginTop: 16 }}>
            <Text style={{ color: colors.fg, fontSize: 15, fontWeight: '600' }}>
              {tf('mobile.friends.myFriends', { n: state.friends.length })}
            </Text>
            {!state.friends.length ? (
              <Text style={{ marginTop: 8, color: colors.muted, fontSize: 13 }}>
                {tr('mobile.friends.empty')}
              </Text>
            ) : state.friends.map((f) => (
              <View key={f.friendCode} style={{
                marginTop: 8, backgroundColor: colors.surface, borderRadius: 12, padding: 12,
                flexDirection: 'row', alignItems: 'center', gap: 10,
              }}>
                <View>
                  <Image source={AVATAR} style={{ width: 40, height: 40, borderRadius: 20 }} />
                  <View style={{
                    position: 'absolute', right: -1, bottom: -1, width: 11, height: 11,
                    borderRadius: 6, backgroundColor: f.online ? '#22c55e' : colors.fainter,
                    borderWidth: 2, borderColor: colors.surface,
                  }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.fg, fontSize: 14 }} numberOfLines={1}>{f.nickname}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>
                    {f.online ? tr('mobile.friends.online') : tf('mobile.friends.lastActive', { time: fmtTime(f.lastActiveAt) })}
                  </Text>
                </View>
                <Pressable
                  onPress={() => { void openChat(f.friendCode) }}
                  style={{ backgroundColor: colors.accent + '22', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}
                >
                  <Text style={{ color: colors.accent, fontSize: 12 }}>
                    {tf('mobile.friends.chat', { badge: unread[f.friendCode] ? ' ' + unread[f.friendCode] : '' })}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => { void api.remove(f.friendCode).then(() => pull()) }}
                  style={{ borderWidth: 1, borderColor: colors.divider, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}
                >
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{tr('mobile.friends.delete')}</Text>
                </Pressable>
              </View>
            ))}
          </View>

          {/* 聊天面板：点好友的「聊天」后展开在下面 */}
          {chatWith ? (
            <View style={{ marginTop: 16, backgroundColor: colors.surface, borderRadius: 12, padding: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ flex: 1, color: colors.fg, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>
                  {state.friends.find((x) => x.friendCode === chatWith)?.nickname ?? chatWith}
                </Text>
                <Pressable onPress={() => { setChatWith(''); setMessages([]) }}>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{tr('common.close')}</Text>
                </Pressable>
              </View>

              <View style={{ marginTop: 10, maxHeight: 280 }}>
                {!messages.length ? (
                  <Text style={{ color: colors.muted, fontSize: 13 }}>{tr('mobile.friends.emptyChat')}</Text>
                ) : messages.map((m) => (
                  <View
                    key={m.id}
                    style={{ alignSelf: m.mine ? 'flex-end' : 'flex-start', maxWidth: '78%', marginTop: 6 }}
                  >
                    <View style={{
                      backgroundColor: m.mine ? colors.accent : colors.bg,
                      borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
                    }}>
                      {m.kind === 'share' ? (
                        <View>
                          <Text style={{ color: m.mine ? '#fff' : colors.fg, fontSize: 13 }}>
                            {tf('mobile.friends.sharePlaylist', { name: m.shareName || m.text })}
                          </Text>
                          <Text style={{ color: m.mine ? '#ffffffcc' : colors.muted, fontSize: 11, marginTop: 2 }}>
                            {tf('mobile.friends.shareMeta', { n: m.shareCount, code: m.shareCode })}
                          </Text>
                        </View>
                      ) : (
                        <Text style={{ color: m.mine ? '#fff' : colors.fg, fontSize: 14 }}>{m.text}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>

              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' }}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder={tr('mobile.friends.chatPlaceholder')}
                  placeholderTextColor={colors.fainter}
                  style={{
                    flex: 1, color: colors.fg, backgroundColor: colors.bg, borderRadius: 999,
                    paddingHorizontal: 14, paddingVertical: 8, fontSize: 14,
                  }}
                  onSubmitEditing={() => { void send() }}
                />
                <Pressable
                  onPress={() => { void send() }}
                  disabled={!draft.trim()}
                  style={{
                    backgroundColor: colors.accent, borderRadius: 999,
                    paddingHorizontal: 16, paddingVertical: 9, opacity: draft.trim() ? 1 : 0.5,
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 13 }}>{tr('mobile.friends.send')}</Text>
                </Pressable>
              </View>
              {api.error ? (
                <Text style={{ color: colors.accent, fontSize: 12, marginTop: 6 }}>{api.error}</Text>
              ) : null}
            </View>
          ) : null}

          {api.busy ? (
            <ActivityIndicator style={{ marginTop: 18 }} color={colors.accent} />
          ) : null}
        </>
      ) : null}
    </ScrollView>
  )
}
