/**
 * 桌面端播放失败分类与文案。
 *
 * 实现已经下沉到 @lxmn/core，桌面端只保留薄壳：
 * 移动端也用同一份判断，避免「桌面端能自动重试，手机端却报找不到音乐」。
 */
export { isRetriablePlayError, describePlayError } from '@lxmn/core'
