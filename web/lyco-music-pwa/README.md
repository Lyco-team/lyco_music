# Lyco Music 网页只读入口（PWA 试水）

单页只读展示：复用 `packages/core/src/i18n.ts` 的 224 个共享 key、`translate` / `translateFormat` / `LOCALES` 与 `packages/core/src/text/s2t.ts` 的 `toTraditional`。页面专属文案放在 `src/copy.ts`（简 / 英 / 韩，33 个 `pwa.*` key），繁体运行时由简体逐字转换，未翻译回退中文。不引第三方 i18n 运行时，不 fork 客户端。

边界：不登录、不播放、不写服务端数据；搜索 / 导入 / 播放 / 会员都在桌面或移动客户端。Service Worker 只缓存本页静态资源，可「添加到主屏幕」离线查看说明。

线上：https://lain42.top/lyco-music/

## 构建

在仓库根目录执行：

```
node scripts/build-lyco-pwa.mjs
python3 scripts/check-lyco-pwa.py .
```

或 `pnpm pwa:build` / `pnpm pwa:check`。产物在 `web/lyco-music-pwa/dist/`（被 .gitignore 忽略）：

| 产物 | 说明 |
| --- | --- |
| `index.html` | 由 `index.template.html` 复制，挂 `/lyco-music/app.js` 与 manifest |
| `app.js` | esbuild 打包 `src/app.ts` + `src/copy.ts` + core 纯函数（iife / es2020 / minify） |
| `sw.js` | 静态资源缓存，缓存名 `lyco-pwa-<package.json version>[-rN]` |
| `manifest.webmanifest` | standalone + 3 个图标 |
| `icons/icon-192.png`、`icons/icon-512.png`、`icons/icon-maskable-512.png` | Pillow 从 `store-assets/icon/lyco_music_icon_1024.png` 生成 |

构建依赖：根 `devDependencies` 的 `esbuild`（`pnpm install` 提供）、Python Pillow（CI 用 `actions/setup-python` + `pip install Pillow`）。检查脚本会校验 7 个产物、manifest、PNG magic、i18n 与 SW 标记、以及 `sw.js` 缓存名以根 `package.json` 版本为前缀（允许 `-rN` 资源修订后缀）。CI 的 `pwa` job 跑同一套构建与校验并上传 `dist`。

版本号在 `src/app.ts` 的 `VERSION`、`src/copy.ts` 的 `pwa.eyebrow` 与 `sw.js` 的 `CACHE` 三处声明；常规 bump 时需同步，检查脚本会校验 `CACHE` 以根 `package.json` 版本开头。仅重部署 HTML / JS 而不发新版时，把 `CACHE` 的 `-rN` 递增（例如 `lyco-pwa-0.2.62-r2`），让已安装 SW 的浏览器换缓存并清理旧 `lyco-pwa-*`。

## 部署到 lain42.top

先本地构建并校验，然后：

```
scp -r web/lyco-music-pwa/dist/* lain42.top:/tmp/lyco-pwa-stage/
```

在远端（脚本通过 ssh stdin 传 `python3 -`，避免嵌套引号）：

1. `python3 /var/www/studio/docs/check-ui.py /tmp/lyco-pwa-stage/index.html` 预检（0 错 0 警）；
2. `install -d -m 0755 /var/www/studio/lyco-music/icons`；
3. 把 `index.html` / `app.js` / `sw.js` / `manifest.webmanifest` 与 `icons/*` 逐个 `install -m 0644` 到 `/var/www/studio/lyco-music/`（注意图标在 `icons/` 子目录，不是扁平路径）；
4. `cd /var/www/studio && python3 docs/check-ui.py lyco-music/index.html`（0 错 0 警）；
5. `curl -sS -o /dev/null -w "%{http_code}" https://lain42.top/lyco-music/` 应为 200；`manifest.webmanifest` / `sw.js` / 三个图标同样 200；
6. 用 320 / 360 / 390px headless CDP 验证无横向溢出；
7. 若只更新了 `index.html` / `app.js`，确认 `sw.js` 的 `CACHE` 已换 `-rN`，避免旧访问者继续读 cache-first 的旧资源。

整站 `python3 docs/check-ui.py` 目前有一个既存无关告警（alipay-auth 页面 38px 字号），不要据此判定本次部署失败；验收以错误数为 0 + 目标文件单独 0 错 0 警为准。

pingap v0.13.5 路由：原有 path = "/lyco" 会前缀抢走 /lyco-music/ 并转发到 uvicorn，需加一条更高权重静态路由 lyco_pwa（path = "/lyco-music/"、host = "lain42.top"、plugins = ["studio_dir"]、upstream = "placeholder"、weight = 2048）。目录根 /lyco-music/ 还需 rewrite = "^/lyco-music/?$ /lyco-music/index.html"，因为 directory 插件仅对 path.len() <= 1 自动改用 index.html；其它资产保持原路径。改前备份 /etc/pingap.toml、pingap --conf <candidate> --test 通过后再 os.replace，进程带 --autoreload，几秒内热加载。

入口链接：`/var/www/studio/index.html`（hero 按钮 / 常用入口 / 页脚）与 `/var/www/studio/docs/lyco-music.html`（hero 按钮 / 第 16 节 / 页脚）。
