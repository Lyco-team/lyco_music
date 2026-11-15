/**
 * 渲染期错误边界（移动端）多语言：英文下错误卡片文案取自共享字典，中文沿用既有文案。
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react-native'
import ErrorBoundary from '../src/components/ErrorBoundary'
import { setLocale } from '../src/lib/i18n'

function Boom(): React.ReactElement {
  throw new Error('boom on purpose')
}

afterEach(async () => { await setLocale('zh-CN') })

describe('错误边界 · 多语言', () => {
  it('英文：错误卡片文案取自共享字典', async () => {
    await setLocale('en-US')
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect(await screen.findByText('Something went wrong')).toBeTruthy()
    expect(screen.getByText('Go back')).toBeTruthy()
    fireEvent.press(screen.getByText('View diagnostics (send a screenshot to the developer)'))
    expect(await screen.findByText('Hide diagnostics')).toBeTruthy()
    expect(screen.getAllByText(/boom on purpose/).length).toBeGreaterThanOrEqual(2)
  })

  it('默认中文：沿用既有文案', async () => {
    await setLocale('zh-CN')
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    expect(await screen.findByText('界面出错了')).toBeTruthy()
    expect(screen.getByText('返回继续用')).toBeTruthy()
    fireEvent.press(screen.getByText('查看诊断信息（截图发给开发者）'))
    expect(await screen.findByText('收起诊断信息')).toBeTruthy()
    expect(screen.getAllByText(/boom on purpose/).length).toBeGreaterThanOrEqual(2)
  })
})
