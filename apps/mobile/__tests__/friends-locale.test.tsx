/**
 * 好友页（移动端）多语言：英文下关键文案取自共享字典，中文沿用既有文案。
 */
import React from 'react'
import { render, screen } from '@testing-library/react-native'
import FriendsScreen from '../src/screens/FriendsScreen'
import { setLocale } from '../src/lib/i18n'

const mockState = {
  mine: { nickname: '阿笠', friendCode: 'ABC123' },
  friends: [],
  pendingIn: [],
  pendingOut: [],
}

const mockApi = {
  denied: false,
  busy: false,
  error: null,
  refresh: jest.fn(async () => ({
    mine: mockState.mine,
    list: { friends: mockState.friends, pendingIn: mockState.pendingIn, pendingOut: mockState.pendingOut },
  })),
  unread: jest.fn(async () => ({ byCode: {} })),
  messages: jest.fn(async () => ({ messages: [] })),
  addByCode: jest.fn(async () => true),
  accept: jest.fn(async () => undefined),
  decline: jest.fn(async () => undefined),
  remove: jest.fn(async () => undefined),
  sendText: jest.fn(async () => 'ok'),
}

jest.mock('../src/friends', () => ({ useFriendsApi: () => mockApi }))
const mockFeed = jest.fn(async () => ({ items: [], unread: 0 }))
jest.mock('../src/share', () => ({ pullFeed: () => mockFeed() }))

afterEach(async () => { await setLocale('zh-CN') })

describe('好友页 · 多语言', () => {
  it('英文：会员态关键文案取自共享字典', async () => {
    await setLocale('en-US')
    render(<FriendsScreen />)
    expect(await screen.findByText('Friends')).toBeTruthy()
    expect(screen.getByText('Friend code')).toBeTruthy()
    expect(screen.getByText('Add friend')).toBeTruthy()
    expect(screen.getByText('My friends (0)')).toBeTruthy()
    expect(screen.getByText('No friends yet. Send your friend code to a friend.')).toBeTruthy()
  })

  it('默认中文：沿用既有文案（不回退英文）', async () => {
    await setLocale('zh-CN')
    render(<FriendsScreen />)
    expect(await screen.findByText('好友')).toBeTruthy()
    expect(screen.getByText('好友码')).toBeTruthy()
    expect(screen.getByText('添加好友')).toBeTruthy()
    expect(screen.getByText('我的好友（0）')).toBeTruthy()
    expect(screen.getByText('还没有好友。把你的好友码发给朋友。')).toBeTruthy()
  })
})
