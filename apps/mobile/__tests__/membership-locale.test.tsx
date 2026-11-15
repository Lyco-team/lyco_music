/**
 * 会员页（移动端）多语言：英文下价格卡与按钮文案取自共享字典，中文沿用既有文案。
 */
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react-native'
import MembershipScreen from '../src/screens/MembershipScreen'
import { setLocale } from '../src/lib/i18n'

jest.mock('@lxmn/core', () => ({
  ...jest.requireActual('@lxmn/core'),
}))
jest.mock('../src/license', () => ({
  activate: jest.fn(async () => ({ status: { state: 'active' }, applied: { applied: [], unavailable: [] } })),
  refreshMembership: jest.fn(async () => ({ state: 'none' })),
  deactivate: jest.fn(async () => undefined),
}))
jest.mock('../src/sync', () => ({
  connectWithMembership: jest.fn(async () => undefined),
  disconnectSync: jest.fn(async () => undefined),
}))

afterEach(async () => { await setLocale('zh-CN') })

describe('会员页 · 多语言', () => {
  it('英文：价格卡与按钮文案取自共享字典', async () => {
    await setLocale('en-US')
    render(<MembershipScreen />)
    expect(screen.getByText('Membership')).toBeTruthy()
    expect(screen.getByText('Buy in shop')).toBeTruthy()
    expect(screen.getByText('Activate subscription')).toBeTruthy()
    expect(screen.getByText('Activate')).toBeTruthy()
    expect(screen.getByText('Check')).toBeTruthy()
    expect(screen.getByText('Music Membership · Annual')).toBeTruthy()
    expect(await screen.findByPlaceholderText('Paste subscription link or token')).toBeTruthy()
  })

  it('默认中文：沿用既有文案', async () => {
    await setLocale('zh-CN')
    render(<MembershipScreen />)
    expect(screen.getByText('音乐会员')).toBeTruthy()
    expect(screen.getByText('去商城购买')).toBeTruthy()
    expect(screen.getByText('激活订阅')).toBeTruthy()
    expect(screen.getByText('激活')).toBeTruthy()
    expect(screen.getByText('查询')).toBeTruthy()
    expect(screen.getByText('音乐会员 · 年卡')).toBeTruthy()
    expect(await screen.findByPlaceholderText('粘贴订阅链接或令牌')).toBeTruthy()
  })

  it('空链接激活时给出英文报错', async () => {
    await setLocale('en-US')
    render(<MembershipScreen />)
    fireEvent.press(screen.getByText('Activate'))
    expect(await screen.findByText('Paste a subscription link or token first')).toBeTruthy()
  })
})
