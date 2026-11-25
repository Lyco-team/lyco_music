import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle, Apple, ArrowUpRight, BookOpen, Check, ChevronLeft, ChevronRight,
  Download, ExternalLink, Filter, Github, Globe, HardDrive, HelpCircle, Info,
  Laptop, Loader2, MonitorCog, Search, ShieldAlert, ShieldCheck, Smartphone, Sparkles, Terminal, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { cn, formatSize } from '@/lib/utils'
import {
  DEVICE_INFO, FILE_GLOSSARY, PLATFORM_KEYS, PLATFORM_LABELS, RECOMMENDATIONS,
  compatibility, detectDevice, fileInfo, fmtUpdated, fmtVersion, generalGuide, rowHint, sourceBadge,
  type Platform,
} from '@/lib/catalog'
import type { DownloadRow, Item, Manifest } from './types'

const DL_KEY = 'wb-token'
const DL_PRICE = 10
const PAGE_SIZE = 16 // 4 列 × 4 行 = 一节
const DEVICE_SEEN_KEY = 'dl-device-seen'
const SKIP_WARN_KEY = 'dl-skip-warn'

const PLATFORM_ICONS: Record<string, typeof Laptop> = {
  windows: Laptop, macos: Apple, ios: Smartphone, android: Smartphone, linux: Terminal,
  unknown: HelpCircle,
}
type HelpGroup = { os: string; arch: string[]; platforms: string[]; picks: string[]; checks: string[] }

const HELP_GROUPS: HelpGroup[] = [
  {
    os: 'Windows', arch: ['x86_64', 'arm64'], platforms: ['windows-x64', 'windows-arm64', 'windows-x86'],
    picks: ['RustDesk：Windows x86_64 免安装 zip / msi', 'ToDesk：Windows x64 安装包', '向日葵：Windows x64 安装包'],
    checks: ['确认 32/64 位与 ARM 版本，别装错', '首次运行允许屏幕录制与输入控制权限'],
  },
  {
    os: 'macOS', arch: ['arm64', 'x86_64'], platforms: ['macos-arm64', 'macos-x64'],
    picks: ['RustDesk：macOS universal dmg', 'TeamViewer：macOS dmg'],
    checks: ['Apple Silicon 优先 arm64，Intel 机器用 Rosetta 或 x86_64 包', '系统设置里授予「辅助功能」与「屏幕录制」'],
  },
  {
    os: 'Linux', arch: ['x86_64', 'aarch64'], platforms: ['linux-x64', 'linux-arm64', 'linux-x64-musl', 'linux-arm64-musl'],
    picks: ['RustDesk：AppImage / deb', 'TeamViewer：官方 Linux 子页（按 UA 自动落页）'],
    checks: ['确认 glibc / musl（Alpine 用静态构建）', 'Wayland 下远程控制能力受限，必要时切 X11'],
  },
  {
    os: 'Android / iOS', arch: ['arm64'], platforms: ['android-arm64', 'ios-arm64'],
    picks: ['RustDesk：移动端官方商店包', 'ToDesk：移动端官方商店包'],
    checks: ['移动端只做被控/旁观，输入控制能力有限', '只从官方应用商店安装'],
  },
]

const HELP_PLATFORM_OPTIONS = [
  { value: 'all', label: '全部平台（先手动选）' },
  { value: 'windows-x64', label: 'Windows x64' },
  { value: 'windows-arm64', label: 'Windows ARM64' },
  { value: 'windows-x86', label: 'Windows x86' },
  { value: 'macos-x64', label: 'macOS Intel' },
  { value: 'macos-arm64', label: 'macOS Apple Silicon' },
  { value: 'linux-x64', label: 'Linux x64' },
  { value: 'linux-arm64', label: 'Linux ARM64' },
  { value: 'linux-x64-musl', label: 'Linux x64 (musl)' },
  { value: 'linux-arm64-musl', label: 'Linux ARM64 (musl)' },
  { value: 'android-arm64', label: 'Android ARM64' },
  { value: 'ios-arm64', label: 'iPhone / iPad (ARM64)' },
]

const HELP_VALUE_BY_DEVICE: Record<Platform, string> = {
  windows: 'windows-x64', macos: 'macos-arm64', ios: 'ios-arm64',
  android: 'android-arm64', linux: 'linux-x64', unknown: 'all',
}

const REMOTE_TOOLS: { id: string; name: string; url: string; note: string }[] = [
  { id: 'rustdesk', name: 'RustDesk', url: 'https://rustdesk.com/', note: '开源、可自建中继；官方唯一域名 rustdesk.com' },
  { id: 'teamviewer', name: 'TeamViewer', url: 'https://www.teamviewer.com/en/download/', note: '商业远程支持；下载页会按系统 UA 自动跳转对应版本' },
  { id: 'anydesk', name: 'AnyDesk', url: 'https://anydesk.com/', note: '商业远程桌面；请从官方域名下载' },
  { id: 'todesk', name: 'ToDesk', url: 'https://www.todesk.com/', note: '国内常用远程工具；请从官方域名下载' },
  { id: 'sunlogin', name: '向日葵', url: 'https://sunlogin.oray.com/', note: '国内常用远程工具；请从官方域名下载' },
]

const HELP_NOTICE = '识别结果只是浏览器给出的猜测，可手动修正；仅保存非敏感的机器/环境信息。请勿填写密码、API key、token、远程 ID、设备 ID、验证码；正式会话凭据请通过可信渠道单独提供。不采集精确位置、不调用地理定位 API，城市/区域仅由发布者手动填写。'

function detectHelpPlatform(): string {
  if (typeof navigator === 'undefined') return 'all'
  const nav = navigator as Navigator & { userAgentData?: { platform?: string; architecture?: string; bitness?: string }; platform?: string }
  const ua = (navigator.userAgent || '').toLowerCase()
  const platform = (nav.userAgentData?.platform || nav.platform || '').toLowerCase()
  const arch = (nav.userAgentData?.architecture || '').toLowerCase()
  const isArm = /arm|aarch64/.test(arch) || /arm64|aarch64|apple silicon/.test(ua) || (/macintosh/.test(ua) && /arm/.test(platform))
  if (/iphone|ipad|ipod/.test(ua) || (/macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1)) return 'ios-arm64'
  if (/android/.test(ua) || /android/.test(platform)) return 'android-arm64'
  if (/windows|win32|win64/.test(ua) || /win/.test(platform)) return isArm ? 'windows-arm64' : 'windows-x64'
  if (/macintosh|mac os|darwin|macintel/.test(ua) || /mac/.test(platform)) return isArm ? 'macos-arm64' : 'macos-x64'
  if (/linux|x11|cros|ubuntu|fedora/.test(ua) || /linux/.test(platform)) return isArm ? 'linux-arm64' : 'linux-x64'
  return 'all'
}

function helpGroup(value: string): HelpGroup | null {
  return HELP_GROUPS.find((g) => g.platforms.includes(value)) || null
}

function optionLabel(value: string): string {
  return HELP_PLATFORM_OPTIONS.find((o) => o.value === value)?.label || '全部平台'
}


function getToken() {
  try { return localStorage.getItem(DL_KEY) || '' } catch { return '' }
}

type Action = {
  kind: 'ticket' | 'link' | 'detail'
  item: Item
  label: string
  file?: string
  hint?: string
  slug?: string
  href?: string
  external?: boolean
}

function primaryFor(item: Item): { action: Action; label: string } {
  const rows = Array.isArray(item.downloads) ? item.downloads : []
  const href = item.mirror?.url || item.download_url || item.official || ''
  if (rows.length) {
    return { action: { kind: 'detail', item, label: '选版本' }, label: '选版本' }
  }
  if (item.disabled) {
    return { action: { kind: 'detail', item, label: '已暂停' }, label: '已暂停' }
  }
  if (item.mirror?.slug) {
    const label = '下载 · ' + DL_PRICE + ' 积分'
    return { action: { kind: 'ticket', item, slug: item.mirror.slug, file: item.mirror.file, label }, label }
  }
  if (item.mirror) {
    const label = '下载校验文件'
    return { action: { kind: 'link', item, href, file: item.mirror.file, label }, label }
  }
  if (item.channel === '开发者测试') {
    return {
      action: { kind: 'link', item, href, file: 'unsigned-test.ipa', label: '获取未签名 IPA', external: true },
      label: '未签名 IPA',
    }
  }
  if (item.download_url) {
    return { action: { kind: 'link', item, href, label: '下载官方文件', external: true }, label: '下载官方文件' }
  }
  const label = item.channel === 'App Store' ? 'App Store' : '官网下载'
  return {
    action: { kind: 'link', item, href, label: item.channel === 'App Store' ? '前往 App Store' : '前往官网下载', external: true },
    label,
  }
}

/* ── 通用弹窗：挂到 body，z-index 盖过站点侧栏(80) / 顶栏(70) ── */
function Modal({
  children, onClose, titleId, wide,
}: { children: ReactNode; onClose: () => void; titleId: string; wide?: boolean }) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current() }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [])
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      className="dl-page fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/55 p-3 py-8 sm:p-6"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn('w-full rounded-2xl border border-border bg-background shadow-2xl', wide ? 'max-w-[min(100%,1120px)]' : 'max-w-[min(100%,560px)]')}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}

function ModalHead({ id, title, sub, onClose }: { id: string; title: string; sub?: string; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border p-4">
      <div className="min-w-0">
        <h2 id={id} className="text-base font-semibold leading-snug">{title}</h2>
        {sub && <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{sub}</p>}
      </div>
      <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="关闭弹窗" className="shrink-0"><X /></Button>
    </div>
  )
}

function FacetChips({
  title, options, active, onPick,
}: {
  title: string
  options: Array<{ value: string; label: string; count: number }>
  active: string
  onPick: (v: string) => void
}) {
  return (
    <div className="min-w-0">
      <div className="mb-2 text-[12px] font-semibold text-foreground">{title}</div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={active === o.value}
            onClick={() => onPick(o.value)}
            className={cn(
              'rounded-md border px-2 py-1 text-[11.5px] leading-none transition-colors',
              active === o.value
                ? 'border-brand bg-brand-soft font-medium text-brand'
                : 'border-border bg-background text-muted-foreground hover:border-brand/50 hover:text-foreground'
            )}
          >
            {o.label}<span className="ml-1 tabular-nums opacity-70">{o.count}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ── 4×4 网格里的紧凑卡片：DOM 语义 + SVG 节点合计最多 4 层 ── */
function SoftwareCard({
  item, device, busy, onAction, onDetail,
}: {
  item: Item
  device: Platform
  busy: boolean
  onAction: (a: Action) => void
  onDetail: (item: Item) => void
}) {
  const badge = sourceBadge(item)
  const info = fileInfo(item)
  const check = compatibility(item, device)
  const guide = generalGuide(item)
  const primary = primaryFor(item)
  const platforms = item.platforms || []
  const Icon = PLATFORM_ICONS[platforms[0]] || Globe

  return (
    <li
      id={'software-' + item.id}
      className="scroll-mt-20 grid h-full min-w-0 grid-cols-[2rem_minmax(0,1fr)_1.75rem] content-start gap-x-2 gap-y-1.5 rounded-xl border border-border bg-card p-3 shadow-xs transition-colors hover:border-brand/50 hover:bg-accent/20"
    >
      {item.icon ? (
        <img src={item.icon} alt="" loading="lazy" className="size-8 shrink-0 rounded-md border border-border object-cover" />
      ) : (
        <Icon className="size-8 shrink-0 rounded-md border border-border bg-muted p-2 text-muted-foreground" />
      )}
      <div className="min-w-0">
        <h3 className="truncate text-[13.5px] font-semibold leading-snug" title={item.name}>{item.name}</h3>
        <div className="mt-0.5 truncate text-[10.5px] text-muted-foreground" title={platforms.map((p) => PLATFORM_LABELS[p] || p).join(' / ')}>
          {platforms.map((p) => PLATFORM_LABELS[p] || p).join(' / ') || '全平台'}
          {item.version ? ' · ' + fmtVersion(item.version) : ''}
        </div>
      </div>
      <button type="button" onClick={() => onDetail(item)} aria-label={'查看 ' + item.name + ' 详情'} title="这是什么？点我看说明" className="grid size-7 place-items-center self-start rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
        <Info className="size-3.5" />
      </button>

      <p className="col-span-3 line-clamp-2 min-h-[2.7em] text-[11.5px] leading-snug text-muted-foreground">{item.summary}</p>

      <div className="col-span-3 flex flex-wrap items-center gap-1">
        <button type="button" onClick={() => onDetail(item)} title={info.what} className="rounded-md border border-brand/40 bg-brand-soft px-1.5 py-0.5 text-[10.5px] font-medium text-brand">
          {info.ext} 是什么？
        </button>
        <Badge variant={badge.tone} className="max-w-[9rem] truncate text-[10px]">{badge.label}</Badge>
        {item.mirror?.size ? <span className="text-[10px] tabular-nums text-muted-foreground">{formatSize(item.mirror.size)}</span> : null}
        {!check.ok && (
          <button type="button" onClick={() => onDetail(item)} title={check.reason} className="inline-flex items-center gap-0.5 rounded-md border border-amber-500/50 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
            ⚠ 可能装不上
          </button>
        )}
      </div>

      {item.disabled ? (
        <Button size="xs" variant="secondary" disabled className="col-span-2 mt-auto w-full justify-center">已暂停</Button>
      ) : (
        <Button
          size="xs"
          variant="brand"
          className="col-span-2 mt-auto min-w-0 justify-center truncate"
          title={primary.action.label}
          disabled={busy}
          onClick={() => onAction(primary.action)}
        >
          {busy ? <Loader2 className="animate-spin" /> : <Download />}{primary.label}
        </Button>
      )}
      <a href={guide.href} className="col-span-1 inline-flex items-center justify-center gap-0.5 self-end text-[10.5px] text-muted-foreground hover:bg-accent hover:text-foreground" title={guide.label}>
        <BookOpen className="size-3" />教程
      </a>
    </li>
  )
}

export default function App() {
  const [items, setItems] = useState<Item[] | null>(null)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState('')
  const [q, setQ] = useState('')
  const [platform, setPlatform] = useState('')
  const [category, setCategory] = useState('')
  const [channel, setChannel] = useState('')
  const [sort, setSort] = useState<'default' | 'name' | 'size'>('default')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [busySlug, setBusySlug] = useState('')
  const [page, setPage] = useState(0)
  const [device, setDevice] = useState<Platform>(() => detectDevice())
  const [detectedHelpPlatform] = useState<string>(() => detectHelpPlatform())
  const [helpPlatform, setHelpPlatform] = useState<string>(detectedHelpPlatform)
  const [deviceOpen, setDeviceOpen] = useState(false)
  const [glossaryOpen, setGlossaryOpen] = useState(false)
  const [detail, setDetail] = useState<Item | null>(null)
  const [warning, setWarning] = useState<{ reason: string; action: Action } | null>(null)
  const [skipWarn, setSkipWarn] = useState(() => {
    try { return sessionStorage.getItem(SKIP_WARN_KEY) === '1' } catch { return false }
  })

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    setQ(params.get('q') || '')
    const p = params.get('platform') || ''
    if (p in PLATFORM_LABELS) setPlatform(p)
  }, [])

  useEffect(() => {
    let seen = false
    try { seen = sessionStorage.getItem(DEVICE_SEEN_KEY) === '1' } catch { /* ignore */ }
    if (seen) return
    const t = setTimeout(() => setDeviceOpen(true), 700)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    let alive = true
    fetch('/downloads/manifest.json', { cache: 'no-store' })
      .then((r) => { if (!r.ok) throw new Error('manifest ' + r.status); return r.json() })
      .then((data: Manifest) => {
        if (!alive) return
        setItems(Array.isArray(data.items) ? data.items : [])
        setUpdatedAt(fmtUpdated(data.updatedAt))
      })
      .catch(() => { if (alive) { setItems([]); setError('目录暂时不可用，请稍后重试或前往软件官网。') } })
    return () => { alive = false }
  }, [])

  useEffect(() => { setPage(0) }, [q, platform, category, channel, sort])

  const countFor = useCallback((predicate: (i: Item) => boolean) => (
    (items || []).filter(predicate).length
  ), [items])

  const byId = useMemo(() => new Map((items || []).map((i) => [i.id, i])), [items])

  const categories = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of items || []) if (i.category) m.set(i.category, (m.get(i.category) || 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'))
  }, [items])

  const channels = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of items || []) {
      const label = sourceBadge(i).label
      m.set(label, (m.get(label) || 0) + 1)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [items])

  const shown = useMemo(() => {
    const needle = q.toLowerCase().trim()
    let list = (items || []).filter((i) => {
      if (platform && !(i.platforms || []).includes(platform)) return false
      if (category && i.category !== category) return false
      if (channel && sourceBadge(i).label !== channel) return false
      if (!needle) return true
      return [i.name, i.summary, i.category, i.license, i.channel, i.id, i.mirror?.file || ''].join(' ').toLowerCase().includes(needle)
    })
    if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    if (sort === 'size') list = [...list].sort((a, b) => (b.mirror?.size || 0) - (a.mirror?.size || 0))
    return list
  }, [items, q, platform, category, channel, sort])

  const total = items?.length ?? 0
  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE))
  const pageItems = shown.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const activeFilters = [platform && PLATFORM_LABELS[platform], category, channel].filter(Boolean) as string[]

  function reset() {
    setPlatform(''); setCategory(''); setChannel(''); setQ('')
    const url = new URL(location.href)
    history.replaceState(null, '', url.pathname + url.hash)
  }

  function pickPlatform(next: string) {
    const value = next === platform ? '' : next
    setPlatform(value)
    const url = new URL(location.href)
    if (value) url.searchParams.set('platform', value)
    else url.searchParams.delete('platform')
    history.replaceState(null, '', url.pathname + url.search + url.hash)
  }

  function download(slug: string, name: string) {
    const token = getToken()
    if (!token) {
      alert('下载需要登录 lain42.top 账户（每次下载扣 ' + DL_PRICE + ' 积分，同一文件当天只扣一次）。')
      location.href = '/shop/#register'
      return
    }
    setBusySlug(slug)
    fetch('/studio/api/download/ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ slug }),
    })
      .then((r) => r.json().then((j) => ({ ok: r.ok, body: j })))
      .then((res) => {
        if (!res.ok) {
          let msg = res.body && res.body.detail
          if (Array.isArray(msg)) msg = msg.map((x: { msg?: string }) => x.msg || x).join('；')
          throw new Error(msg || (res.body && res.body.message) || '无法获取下载链接（' + name + '）')
        }
        location.href = res.body.url
      })
      .catch((err) => alert('下载失败：' + err.message))
      .finally(() => setBusySlug(''))
  }

  function executeAction(a: Action) {
    if (a.kind === 'detail') { setDetail(a.item); return }
    if (a.kind === 'ticket' && a.slug) { download(a.slug, a.file || a.item.name); return }
    if (a.href) {
      if (a.external) window.open(a.href, '_blank', 'noopener,noreferrer')
      else location.href = a.href
    }
  }

  function requestAction(a: Action) {
    if (a.kind === 'detail') { setDetail(a.item); return }
    const check = compatibility(a.item, device, a.file, a.hint)
    if (!check.ok && !skipWarn) { setWarning({ reason: check.reason, action: a }); return }
    executeAction(a)
  }

  function closeDevice() {
    setDeviceOpen(false)
    try { sessionStorage.setItem(DEVICE_SEEN_KEY, '1') } catch { /* ignore */ }
  }

  function chooseDevice(p: Platform) {
    setDevice(p)
    setHelpPlatform(HELP_VALUE_BY_DEVICE[p])
    try { sessionStorage.setItem(DEVICE_SEEN_KEY, '1') } catch { /* ignore */ }
  }

  function toggleSkipWarn(v: boolean) {
    setSkipWarn(v)
    try { sessionStorage.setItem(SKIP_WARN_KEY, v ? '1' : '0') } catch { /* ignore */ }
  }

  const deviceInfo = DEVICE_INFO[device]

  return (
    <div className="dl-page mx-auto w-full max-w-[1280px] px-4 pb-16 pt-6 sm:px-6">
      {/* hero */}
      <header className="border-b border-border pb-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <Sparkles className="size-3.5" /> 4 × 4 grid · beginner friendly
            </div>
            <h1 className="mt-1.5 text-[clamp(26px,3.6vw,36px)] font-semibold leading-tight tracking-tight">软件下载中心</h1>
            <p className="mt-1.5 max-w-[76ch] text-[13px] leading-relaxed text-muted-foreground">
              每节 4 列 × 4 行，共 16 个；先看「这是什么」，再按设备下载。当前 <span className="font-medium text-foreground tabular-nums">{total}</span> 个条目
              {items && updatedAt ? <>，更新于 <span className="tabular-nums">{updatedAt}</span></> : null}。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="brand" size="sm" onClick={() => setDeviceOpen(true)}><Smartphone />帮我选安装包</Button>
            <Button variant="secondary" size="sm" onClick={() => setGlossaryOpen(true)}><HelpCircle />EXE / APK 是什么</Button>
            <Button variant="secondary" size="sm" asChild><a href="#machine-help"><MonitorCog />远程工具帮助</a></Button>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 p-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0 text-brand" />
          <div>
            <b className="text-foreground">镜像计费</b>：标「{DL_PRICE} 积分」的按钮登录后点击，扣 {DL_PRICE} 积分并签发 1 小时链接；
            同一文件当天只扣一次，断点续传不重复计费。新用户注册送 25 积分。
            <a className="ml-1 inline-flex items-center gap-0.5 font-medium text-foreground underline underline-offset-2" href="/shop/#register">注册 / 登录<ArrowUpRight className="size-3" /></a>
          </div>
        </div>
      </header>

      <section id="machine-help" className="mt-5 scroll-mt-4" aria-label="机器识别与远程工具帮助">
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-[15px] font-semibold"><MonitorCog className="size-4 text-brand" />机器识别与远程工具帮助</h2>
              <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">浏览器只给出平台猜测，架构 / musl / Rosetta 需要你人工确认。只列官方域名，不镜像或代下载第三方安装包。</p>
            </div>
            <Badge variant="outline" className="gap-1 text-[10px]"><ShieldCheck className="size-3" />官方域名 · 可手动切换</Badge>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge variant="brand" className="gap-1 text-[10px]"><Laptop className="size-3" />浏览器猜测：{optionLabel(detectedHelpPlatform)}</Badge>
            <Badge variant="outline" className="text-[10px]">当前选择：{optionLabel(helpPlatform)}</Badge>
            <label htmlFor="dl-help-platform" className="sr-only">手动选择平台版本</label>
            <select id="dl-help-platform" value={helpPlatform} onChange={(e) => setHelpPlatform(e.target.value)} aria-label="手动选择平台版本" className="h-8 max-w-[15rem] rounded-md border border-input bg-background px-2.5 text-[11.5px] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40">
              {HELP_PLATFORM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {detectedHelpPlatform !== helpPlatform ? (
              <Button variant="ghost" size="xs" onClick={() => setHelpPlatform(detectedHelpPlatform)}>回到我的平台</Button>
            ) : null}
          </div>
          {(() => {
            const group = helpGroup(helpPlatform)
            return group ? (
              <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="min-w-0 rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-[12.5px] font-semibold">匹配版本：{group.os}</h3>
                    <span className="font-mono text-[10.5px] text-muted-foreground">架构：{group.arch.join(' / ')}</span>
                  </div>
                  <ul className="mt-2 space-y-1 text-[11.5px] leading-relaxed">
                    {group.picks.map((pick) => <li key={pick}>· {pick}</li>)}
                    {group.checks.map((check) => <li key={check} className="text-muted-foreground">· {check}</li>)}
                  </ul>
                </div>
                <div className="min-w-0 rounded-lg border border-border bg-muted/30 p-3">
                  <h3 className="text-[12.5px] font-semibold">安装前校验清单</h3>
                  <ol className="mt-2 space-y-1 text-[11.5px] leading-relaxed text-muted-foreground">
                    <li>1. 只在下方官方域名下载；拒绝镜像站与搜索广告下载器。</li>
                    <li>2. 核对文件名与版本号是否与官方页面一致。</li>
                    <li>3. 尽量用官方公布的签名 / SHA256 校验值比对。</li>
                    <li>4. 安装时拒绝捆绑软件与来路不明的驱动。</li>
                    <li>5. 首次连接前用可信渠道确认对方的会话 ID。</li>
                  </ol>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-[11.5px] leading-relaxed">
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-300" />
                <div><b>未匹配到推荐版本</b><p className="mt-1 text-muted-foreground">请手动选择 Windows / macOS / Linux / 移动端，架构与 musl / Rosetta 需自行确认。</p></div>
              </div>
            )
          })()}
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {REMOTE_TOOLS.map((tool) => (
              <a key={tool.id} href={tool.url} target="_blank" rel="noreferrer noopener" className="min-w-0 rounded-lg border border-border bg-background p-2.5 transition hover:border-brand/50 hover:bg-muted/40" aria-label={tool.name + ' 官方网站'}>
                <span className="flex items-center justify-between gap-2 text-[12px] font-semibold"><span className="truncate">{tool.name}</span><ExternalLink className="size-3 shrink-0 text-muted-foreground" /></span>
                <span className="mt-1 block truncate font-mono text-[10px] text-brand">{tool.url}</span>
                <span className="mt-1 block text-[10.5px] leading-relaxed text-muted-foreground">{tool.note}</span>
              </a>
            ))}
          </div>
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-[11.5px] leading-relaxed">
            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-300" />
            <div><b>安全提示 · 不收集凭据</b><p className="mt-1 text-muted-foreground">{HELP_NOTICE}</p></div>
          </div>
        </div>
      </section>

      {/* toolbar */}
      <section className="mt-5" aria-label="搜索与筛选">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜索名称、用途、许可证…"
              aria-label="搜索软件"
              className="h-9 pl-9 pr-9"
            />
            {q && (
              <button type="button" onClick={() => setQ('')} aria-label="清空搜索" className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={() => setFiltersOpen((v) => !v)} aria-expanded={filtersOpen}>
            <Filter />筛选{activeFilters.length ? ' · ' + activeFilters.length : ''}
          </Button>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            aria-label="排序方式"
            className="h-9 shrink-0 rounded-md border border-input bg-background px-2.5 text-[13px] shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
          >
            <option value="default">默认排序</option>
            <option value="name">按名称</option>
            <option value="size">按体积</option>
          </select>
        </div>

        {filtersOpen && (
          <div className="mt-3 grid grid-cols-1 gap-3 rounded-lg border border-border bg-muted/30 p-3 md:grid-cols-3">
            <FacetChips
              title="设备 / 平台"
              options={PLATFORM_KEYS.map((p) => ({ value: p, label: PLATFORM_LABELS[p], count: countFor((i) => (i.platforms || []).includes(p)) }))}
              active={platform}
              onPick={pickPlatform}
            />
            <FacetChips
              title="分类"
              options={categories.map(([name, n]) => ({ value: name, label: name, count: n }))}
              active={category}
              onPick={(v) => setCategory(category === v ? '' : v)}
            />
            <FacetChips
              title="下载源"
              options={channels.map(([name, n]) => ({ value: name, label: name, count: n }))}
              active={channel}
              onPick={(v) => setChannel(channel === v ? '' : v)}
            />
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11.5px] text-muted-foreground">
          <span aria-live="polite" className="tabular-nums">
            {items === null ? '正在加载目录…' : '显示 ' + shown.length + ' / ' + total + ' 项 · 第 ' + (page + 1) + ' / ' + pages + ' 节（4×4 = 16 个）'}
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {activeFilters.map((f) => <Badge key={f} variant="soft" className="text-[10px]">{f}</Badge>)}
            {activeFilters.length > 0 && <button type="button" onClick={reset} className="rounded-md px-1.5 py-0.5 hover:bg-accent hover:text-foreground">清除全部</button>}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-brand/30 bg-brand-soft/40 px-3 py-2 text-[11.5px] leading-relaxed text-foreground">
          <BookOpen className="size-3.5 shrink-0 text-brand" />
          <span>不知道 EXE / MSI / APK / DMG 是什么？</span>
          <button type="button" onClick={() => setGlossaryOpen(true)} className="font-medium text-brand underline underline-offset-2">看 4×4 文件速查表</button>
          <span className="text-muted-foreground">·</span>
          <span>不知道手机 / 电脑该下哪个？</span>
          <button type="button" onClick={() => setDeviceOpen(true)} className="font-medium text-brand underline underline-offset-2">识别设备并推荐（当前：{deviceInfo.label}）</button>
        </div>
      </section>

      {/* 4×4 网格 */}
      {error && <div className="mt-6 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">{error}</div>}
      {items === null && !error && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />正在加载目录…</div>
      )}
      {items !== null && !error && shown.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">该筛选下没有软件，试试其他平台或关键词。</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={reset}>清除筛选</Button>
        </div>
      )}
      {pageItems.length > 0 && (
        <>
          <ul className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {pageItems.map((item) => (
              <SoftwareCard
                key={item.id}
                item={item}
                device={device}
                busy={!!item.mirror?.slug && busySlug === item.mirror.slug}
                onAction={requestAction}
                onDetail={setDetail}
              />
            ))}
          </ul>
          <nav aria-label="分节翻页" className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
              <ChevronLeft />上一节
            </Button>
            <div className="grid grid-cols-4 gap-1.5">
              {Array.from({ length: pages }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-current={page === i ? 'page' : undefined}
                  onClick={() => setPage(i)}
                  className={cn(
                    'grid size-8 place-items-center rounded-md border text-[12px] tabular-nums transition-colors',
                    page === i ? 'border-brand bg-brand font-semibold text-brand-foreground' : 'border-border bg-background text-muted-foreground hover:border-brand/50 hover:text-foreground'
                  )}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <Button variant="secondary" size="sm" disabled={page >= pages - 1} onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}>
              下一节<ChevronRight />
            </Button>
          </nav>
        </>
      )}

      {/* 底部：一行最多 4 个 */}
      <section className="mt-10 grid grid-cols-2 gap-2.5 lg:grid-cols-4" aria-label="帮助入口">
        {[
          { icon: BookOpen, title: 'AI 网关文档', text: '令牌、模型与计费说明', href: '/docs/' },
          { icon: Globe, title: '代理入门教程', text: 'Mac 三步导入订阅', href: '/proxy-guide/' },
          { icon: HelpCircle, title: '常见问题', text: '下载 / 积分 / 登录', href: '/help.html' },
          { icon: Sparkles, title: '充值与账户', text: '注册送 25 积分', href: '/shop/#register' },
        ].map((c) => (
          <a key={c.title} href={c.href} className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 p-3 transition-colors hover:border-brand/50 hover:bg-accent/20">
            <c.icon className="mt-0.5 size-4 shrink-0 text-brand" />
            <span className="min-w-0">
              <span className="block text-[12.5px] font-semibold">{c.title}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{c.text}</span>
            </span>
          </a>
        ))}
      </section>

      {/* 设备识别 / 推荐弹窗 */}
      {deviceOpen && (
        <Modal titleId="dl-device-title" onClose={closeDevice} wide>
          <ModalHead
            id="dl-device-title"
            title={'识别到你是「' + deviceInfo.label + '」· 该下哪个安装包？'}
            sub="下面按你的设备挑了 4 个最容易一次装成功的软件。选错系统的文件打不开，下载前我们还会再提醒一次。"
            onClose={closeDevice}
          />
          <div className="p-4">
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <div className="text-[12px] font-semibold">识别错了？点一下换设备</div>
              <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {[...PLATFORM_KEYS, 'unknown' as Platform].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => chooseDevice(p)}
                    aria-pressed={device === p}
                    className={cn(
                      'inline-flex items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-[11.5px] transition-colors',
                      device === p ? 'border-brand bg-brand-soft font-semibold text-brand' : 'border-border bg-background text-muted-foreground hover:border-brand/50 hover:text-foreground'
                    )}
                  >
                    {(() => { const I = PLATFORM_ICONS[p] || HelpCircle; return <I className="size-3.5" /> })()}
                    {p === 'unknown' ? '手动选' : PLATFORM_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-brand/30 bg-brand-soft/40 p-2.5 text-[11.5px] leading-relaxed">
                <div className="font-semibold text-brand">① 认准文件类型</div>
                <div className="mt-1 text-muted-foreground">{deviceInfo.file}</div>
              </div>
              <div className="rounded-lg border border-border p-2.5 text-[11.5px] leading-relaxed">
                <div className="font-semibold">② 下载后怎么装</div>
                <div className="mt-1 text-muted-foreground">{deviceInfo.how}</div>
              </div>
              <div className="rounded-lg border border-border p-2.5 text-[11.5px] leading-relaxed">
                <div className="font-semibold">③ 卡住了看这里</div>
                <div className="mt-1 text-muted-foreground">{deviceInfo.tip}</div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <h3 className="text-[13px] font-semibold">给「{deviceInfo.label}」的 4 个推荐</h3>
              <button type="button" onClick={() => setGlossaryOpen(true)} className="text-[11.5px] text-brand underline underline-offset-2">文件后缀看不懂？</button>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {RECOMMENDATIONS[device].length === 0 && (
                <div className="col-span-full rounded-lg border border-dashed border-border p-4 text-center text-[12px] text-muted-foreground">
                  先在上面选一个设备，我们再给你推荐。
                </div>
              )}
              {RECOMMENDATIONS[device].map((r) => {
                const it = byId.get(r.id)
                if (!it) return null
                const info = fileInfo(it)
                const ok = compatibility(it, device).ok
                return (
                  <div key={r.id} className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-border bg-card p-2.5">
                    <div className="truncate text-[12.5px] font-semibold" title={it.name}>{it.name}</div>
                    <div className="text-[10.5px] text-muted-foreground">{info.ext} · {info.label.split(' · ')[1] || info.label}</div>
                    <p className="line-clamp-3 min-h-[3.6em] text-[11px] leading-snug text-muted-foreground">{r.why}</p>
                    {!ok && <div className="inline-flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-300"><AlertTriangle className="size-3" />需要侧载 / 非普通安装</div>}
                    <Button size="xs" variant="brand" className="mt-auto w-full" onClick={() => { closeDevice(); setDetail(it) }}>
                      查看并下载<ArrowUpRight />
                    </Button>
                  </div>
                )
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <label className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                <input type="checkbox" checked={skipWarn} onChange={(e) => toggleSkipWarn(e.target.checked)} className="size-3.5 accent-[var(--brand)]" />
                本次会话下载前不再提醒选错系统
              </label>
              <div className="flex flex-wrap gap-2">
                {device !== 'unknown' && (
                  <Button variant="secondary" size="sm" onClick={() => { pickPlatform(device); closeDevice() }}>
                    <Check />只看适合 {deviceInfo.label} 的软件
                  </Button>
                )}
                <Button variant="brand" size="sm" onClick={closeDevice}>我自己逛逛</Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* 文件类型速查：4 列 × 4 行 = 16 个 */}
      {glossaryOpen && (
        <Modal titleId="dl-glossary-title" onClose={() => setGlossaryOpen(false)} wide>
          <ModalHead
            id="dl-glossary-title"
            title="文件类型速查 · 4×4"
            sub="看到 .exe / .apk / .dmg 不用猜：先看它是什么，再看怎么装。App Store 的应用没有文件后缀。"
            onClose={() => setGlossaryOpen(false)}
          />
          <div className="p-4">
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {FILE_GLOSSARY.map((f) => (
                <li key={f.ext} className="rounded-lg border border-border bg-card p-2.5">
                  <div className="inline-flex items-center rounded-md bg-brand-soft px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-brand">{f.ext}</div>
                  <div className="mt-1.5 text-[11.5px] font-semibold leading-snug">{f.label}</div>
                  <p className="mt-1 text-[10.5px] leading-snug text-muted-foreground">{f.what}</p>
                  <p className="mt-1 text-[10.5px] leading-snug text-foreground/80">{f.how}</p>
                  {f.risk && <p className="mt-1 text-[10px] leading-snug text-amber-700 dark:text-amber-300">{f.risk}</p>}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-[11.5px] text-muted-foreground">
              <span>还是不知道选哪个？让页面按设备推荐，下载前也会提醒装错系统。</span>
              <Button variant="brand" size="sm" onClick={() => { setGlossaryOpen(false); setDeviceOpen(true) }}><Smartphone />帮我选安装包</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* 详情：文件解释 + 安装步骤 + 教程 + 多版本选择 */}
      {detail && (
        <Modal titleId="dl-detail-title" onClose={() => setDetail(null)} wide>
          <ModalHead
            id="dl-detail-title"
            title={detail.name + (detail.version ? ' · ' + fmtVersion(detail.version) : '')}
            sub={detail.summary}
            onClose={() => setDetail(null)}
          />
          <DetailBody
            item={detail}
            device={device}
            busy={busySlug}
            onAction={requestAction}
          />
        </Modal>
      )}

      {/* 选错平台警告 */}
      {warning && (
        <Modal titleId="dl-warning-title" onClose={() => setWarning(null)}>
          <ModalHead id="dl-warning-title" title="等一下，这个文件可能装不上" sub="小白最容易在这里卡住，先确认一下再继续。" onClose={() => setWarning(null)} />
          <div className="p-4">
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-[12.5px] leading-relaxed text-foreground">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-300" />
              <div>
                <p>{warning.reason}</p>
                <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                  当前识别为「{deviceInfo.label}」。{deviceInfo.file}。{deviceInfo.how}
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-lg border border-border p-2.5 text-[11px] leading-relaxed text-muted-foreground"><b className="text-foreground">① 别下错</b><br />回到推荐里选适合 {deviceInfo.label} 的版本。</div>
              <div className="rounded-lg border border-border p-2.5 text-[11px] leading-relaxed text-muted-foreground"><b className="text-foreground">② 看教程</b><br />安装步骤和常见问题都写在教程里。</div>
              <div className="rounded-lg border border-border p-2.5 text-[11px] leading-relaxed text-muted-foreground"><b className="text-foreground">③ 仍要下</b><br />如果你是在帮别的设备下载，可以继续。</div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
              <label className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                <input type="checkbox" checked={skipWarn} onChange={(e) => toggleSkipWarn(e.target.checked)} className="size-3.5 accent-[var(--brand)]" />
                本次会话不再提醒
              </label>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => { setWarning(null); setDeviceOpen(true) }}><Smartphone />按设备推荐</Button>
                <Button variant="brand" size="sm" onClick={() => { const a = warning.action; setWarning(null); executeAction(a) }}>仍然继续<ArrowUpRight /></Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

/* 详情内容单独成组件，避免主 App 嵌套过深 */
function DetailBody({
  item, device, busy, onAction,
}: {
  item: Item
  device: Platform
  busy: string
  onAction: (a: Action) => void
}) {
  const info = fileInfo(item)
  const check = compatibility(item, device)
  const guide = generalGuide(item)
  const badge = sourceBadge(item)
  const d = DEVICE_INFO[device]
  const rows = Array.isArray(item.downloads) ? item.downloads : []
  const [onlyFit, setOnlyFit] = useState(true)
  const ranked = useMemo(() => rows
    .map((r) => ({ r, ok: compatibility(item, device, r.file, rowHint(r)).ok }))
    .sort((a, b) => Number(b.ok) - Number(a.ok)), [rows, item, device])
  const visible = onlyFit ? ranked.filter((x) => x.ok) : ranked
  const shownRows = visible.length ? visible : ranked

  function rowAction(r: DownloadRow): Action {
    if (r.slug) {
      return { kind: 'ticket', item, slug: r.slug, file: r.file, hint: rowHint(r), label: '下载 · ' + DL_PRICE + ' 积分' }
    }
    return { kind: 'link', item, href: r.url || item.official || '', file: r.file, hint: rowHint(r), label: '下载 ' + (r.file || r.platform), external: true }
  }

  const primary = primaryFor(item)
  const links = [
    item.guide ? { label: '使用教程', href: item.guide } : null,
    item.official ? { label: '版本与说明', href: item.official } : null,
    item.release && item.release !== item.official ? { label: '官方发布页', href: item.release } : null,
    item.repository ? { label: '源码仓库', href: item.repository } : null,
    item.originMirror ? { label: '源站备用', href: item.originMirror } : null,
    item.r2Mirror ? { label: 'R2 备用', href: item.r2Mirror } : null,
    item.landing_page ? { label: '产品介绍', href: item.landing_page } : null,
    { label: '新手帮助', href: '/help.html' },
  ].filter(Boolean) as Array<{ label: string; href: string }>

  return (
    <div className="p-4">
      <div className={cn('flex items-start gap-2.5 rounded-lg border p-3 text-[12px] leading-relaxed', check.ok ? 'border-brand/30 bg-brand-soft/40' : 'border-amber-500/50 bg-amber-500/10')}>
        {check.ok ? <Check className="mt-0.5 size-4 shrink-0 text-brand" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-300" />}
        <div>
          <b>{check.ok ? '这个文件和你的设备匹配' : '注意：' + check.reason}</b>
          <div className="mt-1 text-muted-foreground">当前设备：{d.label}。{d.file}</div>
        </div>
      </div>

      {/* 这个文件是什么 / 怎么装 / 教程：一行 3 个，不超过 4 */}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="inline-flex rounded-md bg-brand-soft px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-brand">{info.ext}</div>
          <div className="mt-1.5 text-[12.5px] font-semibold">{info.label}</div>
          <h3 className="mt-1 text-[11px] font-medium text-foreground/80">{info.ext} 是什么？</h3>
          <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{info.what}</p>
          {info.risk && <p className="mt-1 text-[10.5px] leading-snug text-amber-700 dark:text-amber-300">{info.risk}</p>}
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="text-[12.5px] font-semibold">下载后怎么装</div>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{info.how}</p>
          <p className="mt-1.5 text-[10.5px] leading-snug text-muted-foreground">{d.how}</p>
        </div>
        <div className="rounded-lg border border-brand/30 bg-brand-soft/30 p-3">
          <div className="text-[12.5px] font-semibold text-brand">跟着教程做</div>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">小白不用记命令：点开教程，按截图一步一步来。{d.tip}</p>
          <a href={guide.href} className="mt-2 inline-flex items-center gap-1 rounded-md bg-brand px-2.5 py-1.5 text-[11.5px] font-medium text-brand-foreground hover:opacity-90">
            <BookOpen className="size-3.5" />{guide.label}<ArrowUpRight className="size-3" />
          </a>
        </div>
      </div>

      {/* 多版本：每行最多 4 个 */}
      {rows.length > 0 && (
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[13px] font-semibold">选版本（共 {rows.length} 个，按你的设备排在前面）</h3>
            <label className="inline-flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
              <input type="checkbox" checked={onlyFit} onChange={(e) => setOnlyFit(e.target.checked)} className="size-3.5 accent-[var(--brand)]" />
              只看适合 {d.label} 的版本
            </label>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {shownRows.map(({ r, ok }, idx) => {
              const fi = fileInfo(item, r.file)
              const a = rowAction(r)
              return (
                <div key={(r.slug || r.file || r.platform) + idx} className={cn('flex min-w-0 flex-col gap-1 rounded-lg border p-2.5', ok ? 'border-border bg-card' : 'border-amber-500/40 bg-amber-500/5')}>
                  <div className="truncate text-[11.5px] font-semibold" title={r.platform}>{r.platform}</div>
                  <div className="truncate font-mono text-[10px] text-muted-foreground" title={r.file}>{r.file || fi.ext}</div>
                  <div className="text-[10px] text-muted-foreground">{r.size ? formatSize(r.size) + ' · ' : ''}{fi.ext}{r.note ? ' · ' + r.note : ''}</div>
                  {!ok && <div className="text-[10px] text-amber-700 dark:text-amber-300">非当前设备的版本</div>}
                  <Button size="xs" variant={ok ? 'brand' : 'secondary'} className="mt-auto w-full" disabled={busy === r.slug} onClick={() => onAction(a)}>
                    {busy === r.slug ? <Loader2 className="animate-spin" /> : <Download />}{r.slug ? DL_PRICE + ' 积分' : '下载'}
                  </Button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 镜像 / 备注 / 安装命令 */}
      {item.mirror && (
        <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-[11px] leading-relaxed">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <ShieldCheck className="size-3.5 shrink-0 text-brand" />
            <b className="text-[12px]">{item.mirror.platform}</b>
            <span className="truncate font-mono">{item.mirror.file}</span>
            {item.mirror.size ? <span className="tabular-nums">{formatSize(item.mirror.size)}</span> : null}
            <Badge variant={badge.tone} className="text-[10px]">{badge.label}</Badge>
          </div>
          <div className="mt-1.5 break-all font-mono text-[10px] opacity-75">SHA-256 {item.mirror.sha256}</div>
        </div>
      )}
      {item.note && <p className="mt-2 rounded-md border-l-2 border-brand/60 bg-muted/50 px-2.5 py-2 text-[11.5px] leading-relaxed text-muted-foreground">{item.note}</p>}
      {item.install && <code className="mt-2 block overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted px-2.5 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">{item.install}</code>}

      {/* 相关链接：一行最多 4 个 */}
      <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {links.slice(0, 8).map((l) => (
          <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-1 truncate rounded-md border border-border bg-background px-2 py-1.5 text-[10.5px] text-muted-foreground hover:border-brand/50 hover:text-foreground">
            {l.label.includes('源码') ? <Github className="size-3" /> : <ExternalLink className="size-3" />}{l.label}
          </a>
        ))}
      </div>

      {rows.length === 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <HardDrive className="size-3.5" />{item.category}{item.license ? ' · ' + item.license : ''}{item.release ? ' · ' + item.release : ''}
            {item.disabled ? <Badge variant="secondary" className="text-[10px]">已暂停下载</Badge> : null}
          </div>
          {item.disabled ? (
            <Button variant="secondary" size="sm" disabled>已暂停下载</Button>
          ) : (
            <Button variant="brand" size="sm" disabled={busy === item.mirror?.slug} onClick={() => onAction(primary.action)}>
              {busy === item.mirror?.slug ? <Loader2 className="animate-spin" /> : <Download />}{primary.action.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
