/**
 * 云同步页（移动端）
 *
 * 默认服务器 lain42.top。会员用户点一下就用订阅令牌开通同步，
 * 不额外注册账号。也支持自建服务器。
 */
import { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator, Pressable, ScrollView, Text, TextInput, View,
} from 'react-native'
import type { SyncOutcome } from '@lxmn/core'
import {
  connectCustom, connectWithMembership, disconnectSync, library,
  loadLibrary, restoreSync, syncNow, syncServer, syncToken,
} from '../sync'
import { useMembership } from '../license'
import { colors, useTopInset } from '../theme'
import { t as tr, tf, useLocale } from '../lib/i18n'

interface Counts {
  favorites: number
  playlists: number
  history: number
}

export default function SyncScreen({ onBack }: { onBack?: () => void }) {
  const insetTop = useTopInset()
  useLocale()
  const [counts, setCounts] = useState<Counts>({ favorites: 0, playlists: 0, history: 0 })
  const [configured, setConfigured] = useState(false)
  const [mask, setMask] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [syncedAt, setSyncedAt] = useState(0)
  const [token, setToken] = useState('')
  const [base, setBase] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  const { isActive } = useMembership()

  const pull = useCallback(() => {
    const s = library.snapshot()
    setCounts({ favorites: s.favorites.length, playlists: s.playlists.length, history: s.history.length })
  }, [])

  const maskToken = (t: string) => {
    if (!t) return ''
    if (t.length <= 8) return t[0] + '****'
    return t.slice(0, 4) + '****' + t.slice(-4)
  }

  const refreshTokenMask = useCallback(async () => {
    setMask(maskToken(await syncToken()))
  }, [])

  useEffect(() => {
    void (async () => {
      await loadLibrary()
      pull()
      const r = await restoreSync()
      setConfigured(r.configured)
      setSyncedAt(r.syncedAt)
      await refreshTokenMask()
      pull()
    })()
  }, [pull, refreshTokenMask])

  /** 把同步结果翻译成人话；返回 true 表示成功 */
  function report(r: SyncOutcome | null): boolean {
    if (!r) return false
    switch (r.state) {
      case 'ok':
        setSyncedAt(Date.now())
        setMessage(r.pushed ? tr('mobile.sync.pushed') : tr('mobile.sync.upToDate'))
        return true
      case 'conflict':
        setMessage(tr('mobile.sync.merged'))
        return true
      case 'disabled':
        setConfigured(false)
        setMessage(r.reason)
        return false
      case 'error':
        setError(r.reason)
        return false
    }
  }

  async function onUseMembership() {
    setBusy(true); setError(''); setMessage('')
    try {
      report(await connectWithMembership())
      setConfigured(true)
      await refreshTokenMask()
      pull()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function onConnectCustom() {
    setBusy(true); setError(''); setMessage('')
    try {
      report(await connectCustom(base, token))
      setConfigured(true)
      setToken('')
      await refreshTokenMask()
      pull()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function onSyncNow() {
    setBusy(true); setError(''); setMessage('')
    try {
      report(await syncNow())
      pull()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function onDisconnect() {
    await disconnectSync()
    setConfigured(false)
    setMask('')
    setMessage(tr('mobile.sync.disconnected'))
  }

  function fmtTime(ms: number): string {
    if (!ms) return tr('mobile.sync.never')
    const d = new Date(ms)
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
  }

  const card = {
    backgroundColor: colors.surface, borderRadius: 16, padding: 20,
    borderWidth: 1, borderColor: '#2f2f2f',
  } as const

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insetTop }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={10} style={{ marginBottom: 12 }}>
            <Text style={{ color: colors.muted, fontSize: 13.5 }}>{tr('mobile.acct.back')}</Text>
          </Pressable>
        ) : null}
        <Text style={{ color: colors.fg, fontSize: 24, fontWeight: '700', marginBottom: 6 }}>{tr('nav.sync')}</Text>
        <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 20 }}>
          {tr('mobile.sync.subtitle')}
        </Text>

        {/* 服务器 + 状态 */}
        <View style={card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.fg, fontSize: 16, fontWeight: '600' }}>{tr('sync.server')}</Text>
              <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>{syncServer}</Text>
            </View>
            <View style={{
              borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
              backgroundColor: configured ? '#1d3324' : colors.elevated,
            }}>
              <Text style={{ color: configured ? '#6ede8a' : colors.muted, fontSize: 12 }}>
                {configured ? tr('mobile.sync.enabled') : tr('mobile.sync.disabled')}
              </Text>
            </View>
          </View>

          <Text style={{ color: colors.fainter, fontSize: 12, marginTop: 14, lineHeight: 18 }}>
            {tr('mobile.sync.serverHint')}
          </Text>

          {!configured ? (
            <>
              {isActive ? (
                <Pressable
                  onPress={onUseMembership}
                  disabled={busy}
                  style={{
                    marginTop: 16, backgroundColor: busy ? '#7a2630' : colors.accent,
                    borderRadius: 24, paddingVertical: 14, alignItems: 'center',
                  }}
                >
                  {busy ? <ActivityIndicator color="#fff" /> : (
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{tr('sync.oneClick')}</Text>
                  )}
                </Pressable>
              ) : (
                <View style={{ marginTop: 16, backgroundColor: colors.bg, borderRadius: 12, padding: 14 }}>
                  <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
                    {tr('mobile.sync.needMember')}
                  </Text>
                </View>
              )}

              <Pressable onPress={() => setShowCustom(v => !v)} style={{ marginTop: 12, paddingVertical: 6 }}>
                <Text style={{ color: colors.fainter, fontSize: 13 }}>
                  {showCustom ? tr('mobile.sync.hideCustom') : tr('mobile.sync.showCustom')}
                </Text>
              </Pressable>

              {showCustom ? (
                <>
                  <TextInput
                    value={base}
                    onChangeText={setBase}
                    placeholder={tr('mobile.sync.serverPlaceholder')}
                    placeholderTextColor={colors.fainter}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={{
                      marginTop: 12, backgroundColor: colors.bg, borderRadius: 12,
                      paddingHorizontal: 14, paddingVertical: 13, color: colors.fg,
                      fontSize: 14, borderWidth: 1, borderColor: '#2f2f2f',
                    }}
                  />
                  <TextInput
                    value={token}
                    onChangeText={setToken}
                    placeholder={tr('sync.token')}
                    placeholderTextColor={colors.fainter}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={{
                      marginTop: 10, backgroundColor: colors.bg, borderRadius: 12,
                      paddingHorizontal: 14, paddingVertical: 13, color: colors.fg,
                      fontSize: 14, borderWidth: 1, borderColor: '#2f2f2f',
                    }}
                  />
                  <Pressable
                    onPress={onConnectCustom}
                    disabled={busy}
                    style={{
                      marginTop: 10, borderRadius: 22, paddingVertical: 13,
                      alignItems: 'center', borderWidth: 1, borderColor: '#3a3a3a',
                    }}
                  >
                    <Text style={{ color: colors.fg, fontSize: 15 }}>{tr('sync.connect')}</Text>
                  </Pressable>
                </>
              ) : null}
            </>
          ) : (
            <>
              <View style={{
                marginTop: 16, backgroundColor: colors.bg, borderRadius: 12,
                padding: 16, flexDirection: 'row', alignItems: 'center',
              }}>
                <View>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{tr('sync.token')}</Text>
                  <Text style={{ color: colors.fg, fontSize: 14, marginTop: 4 }}>{mask || '—'}</Text>
                </View>
                <View style={{ marginLeft: 'auto', alignItems: 'flex-end' }}>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{tr('sync.lastSync')}</Text>
                  <Text style={{ color: colors.fg, fontSize: 14, marginTop: 4 }}>{fmtTime(syncedAt)}</Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <Pressable
                  onPress={onSyncNow}
                  disabled={busy}
                  style={{
                    flex: 1, backgroundColor: busy ? '#7a2630' : colors.accent,
                    borderRadius: 22, paddingVertical: 13, alignItems: 'center',
                  }}
                >
                  {busy ? <ActivityIndicator color="#fff" /> : (
                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>{tr('mobile.sync.syncNow')}</Text>
                  )}
                </Pressable>
                <Pressable
                  onPress={onDisconnect}
                  disabled={busy}
                  style={{
                    paddingHorizontal: 22, borderRadius: 22, paddingVertical: 13,
                    alignItems: 'center', borderWidth: 1, borderColor: '#3a3a3a',
                  }}
                >
                  <Text style={{ color: colors.fg, fontSize: 15 }}>{tr('sync.disable')}</Text>
                </Pressable>
              </View>
            </>
          )}

          {error ? <Text style={{ color: colors.accent, fontSize: 13, marginTop: 12 }}>{error}</Text> : null}
          {!error && message ? <Text style={{ color: colors.muted, fontSize: 13, marginTop: 12 }}>{message}</Text> : null}
        </View>

        {/* 本地数据概览 */}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
          {([
            [tr('mobile.sync.fav'), counts.favorites],
            [tr('mobile.sync.playlists'), counts.playlists],
            [tr('my.recent'), counts.history],
          ] as const).map(([label, n]) => (
            <View key={label} style={[card, { flex: 1, padding: 16 }]}>
              <Text style={{ color: colors.fg, fontSize: 22, fontWeight: '700' }}>{n}</Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{label}</Text>
            </View>
          ))}
        </View>

        {/* 冲突策略说明 */}
        <View style={[card, { marginTop: 16 }]}>
          <Text style={{ color: colors.fg, fontSize: 15, fontWeight: '600' }}>{tr('mobile.sync.conflicts')}</Text>
          {[
            tr('mobile.sync.rule1'),
            tr('mobile.sync.rule2'),
            tr('mobile.sync.rule3'),
          ].map(t => (
            <View key={t} style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent, marginTop: 6 }} />
              <Text style={{ color: colors.muted, fontSize: 13, flex: 1, lineHeight: 19 }}>{t}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}
