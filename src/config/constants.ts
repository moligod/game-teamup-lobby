// 项目常量配置文件

export const MARKET_CURRENCY = /^[A-Z]{3}$/.test(String(import.meta.env.VITE_MARKET_CURRENCY || '')) ? String(import.meta.env.VITE_MARKET_CURRENCY) : 'CNY'

export const GAME_NAME = String(import.meta.env.VITE_GAME_NAME || "").trim().slice(0, 80)

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '')
const browserOrigin = typeof window !== 'undefined' ? window.location.origin : ''
const defaultApiBaseUrl = import.meta.env.DEV ? 'http://localhost:3000' : browserOrigin

// API 基础地址
// Docker/VPS 默认走同域 Nginx 反代；本地开发可设置 VITE_API_BASE_URL=http://localhost:3000
export const API_BASE_URL = trimTrailingSlash(import.meta.env.VITE_API_BASE_URL || defaultApiBaseUrl)
export const WS_BASE_URL = `${trimTrailingSlash(import.meta.env.VITE_WS_BASE_URL || API_BASE_URL.replace(/^http/, 'ws'))}/ws`

// 默认头像地址（使用外链资源）
export const DEFAULT_AVATAR_URL = 'https://pic1.imgdb.cn/item/68b1af465bbbefd1fa54c2fc.webp'

// 消息相关配置
export const MESSAGE_CONFIG = {
  maxLength: 200,
  defaultLimit: 50
}

// 个人签名配置
export const SIGNATURE_CONFIG = {
  maxLength: 64,
  placeholder: '这个人很懒，什么都没留下...'
}

// 头像上传配置
export const AVATAR_CONFIG = {
  maxSize: 2 * 1024 * 1024, // 2MB
  allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
}

// 顶部导航栏 Logo 地址
