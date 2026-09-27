# 上线部署指南

这个项目已经是一个**完整的生产级静态站点**：构建、压缩、内容哈希、PWA 离线、安全响应头、SEO/分享卡片、404 页面、健康检查全部就绪。上线只需要把构建产物 `dist/` 放到任意静态托管上。

> 一句话：`npm run build` → 把 `dist/` 上传 → 完成。

---

## 1. 本地先跑一遍生产版本（30 秒）

```bash
npm install                 # 只需一次
npm run build               # 产出 dist/
npm start                   # 生产服务器，默认 http://127.0.0.1:8080
```

- `npm run dev`  → 开发服务器 http://127.0.0.1:4173（源码直出，改完刷新即可）
- `npm start`    → 生产服务器，读取 `dist/`，带压缩 / 缓存 / 安全头 / `/healthz`
- `Ctrl+C` 停止

生产服务器会自动监听 `0.0.0.0`，同一局域网的手机也能直接访问（终端会打印地址），适合上线前的真机测试。

---

## 2. 构建产物长什么样

```
dist/
├── index.html                  # 已注入 SEO / OG / PWA 标签
├── assets/
│   ├── style.<hash>.css        # 压缩 + 内容哈希（可永久缓存）
│   ├── flight-world.<hash>.js
│   ├── game.<hash>.js
│   ├── three.<hash>.js
│   └── boot.<hash>.js          # 注册 Service Worker
├── vendor/
│   ├── three.min.js / THREE-LICENSE.txt
│   └── mediapipe/0.5.1675469404/   # 体感模式自托管运行时（约 24 MB）
├── manifest.webmanifest + icon-*.png + apple-touch-icon.png
├── sw.js                       # 离线缓存
├── og-image.png                # 社交分享大图（1200×630）
├── robots.txt / sitemap.xml
├── 404.html
├── _headers / _redirects       # Netlify / Cloudflare Pages 自动读取
└── version.json                # 构建元数据，/healthz 会读取
```

文件名里的哈希让浏览器可以**永久缓存**资源；`index.html` 和 `sw.js` 是 `no-cache`，所以每次发新版用户立刻拿到新版本，不会卡在旧缓存。

---

## 3. 选一个托管平台

| 方案 | 成本 | 自定义域名 | 自定义响应头 | 上手难度 | 适合 |
| --- | --- | --- | --- | --- | --- |
| **Cloudflare Pages** | 免费 | ✅ 免费 | ✅ | ★ | 推荐首选，国内访问相对好 |
| **Netlify** | 免费额度 | ✅ | ✅ | ★ | 拖拽上传最省事 |
| **Vercel** | 免费额度 | ✅ | ✅（已配 vercel.json） | ★ | 已有 Vercel 账号 |
| **GitHub Pages** | 免费 | ✅ | ❌ 不支持 | ★★ | 只是想挂个链接 |
| **自有服务器 / Docker** | 服务器费用 | ✅ | ✅ | ★★★ | 想自己完全掌控 |

### 方案 A：Cloudflare Pages（推荐）

**方式一：直接上传（不用 Git，最快）**

1. 打开 <https://dash.cloudflare.com/> → Workers & Pages → Create → Pages → **Upload assets**
2. 把本地的 `dist` 文件夹整个拖进去
3. 得到形如 `https://your-project.pages.dev` 的地址，立刻可玩

**方式二：命令行**

```bash
npm run build
npx wrangler pages deploy dist
```

**方式三：连接 Git 仓库**（构建命令 `npm run build`，输出目录 `dist`，仓库里已有 `wrangler.toml`）

Cloudflare Pages 会自动读取 `dist/_headers`，安全头和缓存策略即刻生效。

### 方案 B：Netlify

**更新已有站点（推荐流程）**

```bash
npm run release      # 构建 dist/ 并打包成 nailong-site.zip（带完整性校验）
```

然后：Netlify 后台 → 你的站点 → **Deploys** → 把 `nailong-site.zip` 拖到
"Drag and drop your site output folder here" 区域。

> ⚠️ **一定要拖 `dist/`（或它打出来的 zip），不要拖项目根目录。**
>
> 曾经出现过的事故：线上那份 `index.html` 引用的是 `vendor/three.min.js`、`game.js`、
> `flight-world.js` 这些**未构建的源码路径**，而 `dist/` 里只有内容哈希过的
> `assets/*`，于是 three.js 404、3D 引擎初始化失败，页面只剩 "3D 引擎需要喘口气"。
>
> `npm run package` 会在打包前逐条检查 `index.html` 里引用的文件是否真实存在、
> 是否已经哈希化，不通过就直接退出——就是为了拦住这个事故。

**新建站点**：打开 <https://app.netlify.com/drop>，拖 `nailong-site.zip` 进去即可。

**命令行**：`npx netlify-cli deploy --prod --dir=dist`（需要 `NETLIFY_AUTH_TOKEN`）

**Git 集成**：仓库里已有 `netlify.toml`（构建 `npm run build`，发布 `dist`），连上仓库后每次 push 自动部署。

Netlify 同样读取 `_headers` / `_redirects`，所以 CSP 等安全响应头会直接生效。

### 方案 C：Vercel

```bash
npx vercel deploy --prod
```

仓库里的 `vercel.json` 已经写好了构建命令、输出目录、缓存和安全响应头，首次会让你登录并关联项目。

### 方案 D：GitHub Pages

仓库里已有 `.github/workflows/deploy-pages.yml`：推送到 `main` 后自动构建并发布。

1. 把项目推到 GitHub
2. Settings → Pages → Source 选 **GitHub Actions**
3. 之后每次 push 自动上线

> ⚠️ **GitHub Pages 不支持自定义响应头**，所以 CSP 等安全头在该平台上不会生效（`_headers` 会被忽略）。功能、缓存、HTTPS 都正常。如果要严格安全头，请用 Cloudflare Pages / Netlify / Vercel / 自有服务器。

### 方案 E：自有服务器 / Docker / VPS

```bash
docker build -t nailong-flight .
docker run -d --restart unless-stopped -p 80:8080 --name nailong nailong-flight
```

或者不用 Docker，直接跑内置的生产服务器：

```bash
npm run build
PORT=80 HOST=0.0.0.0 npm start     # Linux/macOS
```

`server.mjs` **零第三方依赖**，只用 Node 内置模块，自带 brotli/gzip 压缩、强缓存、条件请求（304）、路径穿越防护、优雅关闭，以及：

```
GET /healthz  →  {"status":"ok","uptimeSeconds":123,"assetVersion":"a6067c510e",...}
```

可以直接挂到 systemd / pm2 / 云厂商的容器服务后面，前面再套 Nginx 或 Caddy 做 HTTPS。

---

## 4. 上线前务必做的两件事

### ① 配置站点地址

打开 `site.config.json`，把 `siteUrl` 改成你的正式域名：

```json
{ "siteUrl": "https://nailong.example.com" }
```

然后重新 `npm run build`。这会让 `<link rel="canonical">`、`og:url`、`og:image` 的绝对地址和 `sitemap.xml` 正确生成。

也可以不改文件，用环境变量覆盖：`SITE_URL=https://... npm run build`。在 CI 里，Netlify / Cloudflare Pages / Vercel 会自动从平台变量（`URL` / `CF_PAGES_URL` / `VERCEL_URL`）推断，无需手动配置。

### ② 必须用 HTTPS

- **体感（摄像头）模式**要求安全上下文：`https://` 或 `localhost`。绝大多数托管平台默认就给 HTTPS，免费且自动续期。
- Service Worker（离线游玩、可安装成 App）同样只在 HTTPS/localhost 下生效。

---

## 5. 上线检查清单

```bash
npm run verify
```

这个命令会构建、启动生产服务器、用真实浏览器（Edge/Chrome）跑一整套检查，输出 `output/verify/report.json` 和截图：

- HTTP：状态码、CSP/安全头、`immutable` 缓存、304 条件请求、brotli 压缩、路径穿越拦截、`/healthz`、404 页面、PWA manifest
- 浏览器：WebGL 初始化、真实按住空格后会爬升（读取界面上的海拔数值）、暂停、喷射物切换、帮助弹窗、手机布局
- PWA：Service Worker 注册成功、页面被接管、**断网后仍能重新打开游戏**
- 控制台：无未捕获异常、无 CSP 违规、无 4xx/5xx

> `scripts/verify.ps1` 是 Windows 编排脚本；其他平台可以先手动跑起生产服务器，再用
> `BASE_URL=http://127.0.0.1:8080 CDP_URL=http://127.0.0.1:9222 node scripts/verify.mjs` 接上任意 Chromium。

发布后建议再人工确认：

- [ ] 手机打开，横竖屏都能玩，触摸按钮可用
- [ ] 地址栏出现“安装/添加到主屏幕”
- [ ] 分享链接到微信/Twitter，缩略图正常（`og-image.png`）
- [ ] 飞行指南、暂停、全屏、技能冷却都正常
- [ ] 打开 DevTools → Application → Service Workers，状态为 activated

---

## 6. 常见问题

**Q：`dist` 有 24 MB，是不是太大了？**
大的是 `vendor/mediapipe/`（体感模式的人体姿态识别模型），它只在用户点“开启体感”时才按需下载，并且被永久缓存，不影响正常开局的加载速度。不需要体感模式的话，删掉 `vendor/mediapipe/`（或执行 `Remove-Item vendor/mediapipe -Recurse`）再重新构建，`dist` 会变成约 **0.9 MB**，游戏会自动回退到 CDN 加载识别组件。

**Q：改了代码但线上还是旧的？**
先确认构建过（`npm run build`），再确认 `index.html` 的 `Cache-Control` 是 `no-cache`。资源文件名带哈希，不会互相覆盖。Service Worker 会在下一次访问时自动升级。

**Q：摄像头点了没反应？**
必须是 `https://` 或 `localhost`，且浏览器需要授权。识别全部在本地进行，视频不上传。

**Q：能不能不用 Node？**
完全可以。最终产物是纯静态文件，任何能托管 HTML 的地方都能跑。Node 只用于构建和可选的本地服务器。

**Q：想换成自己的域名？**
在托管平台后台绑定域名，然后按上面第 4 节把 `siteUrl` 改掉重新构建即可。

---

## 7. 我（AI）没有替你做的那一步

我无法替你在 Cloudflare / Netlify / Vercel 上创建账号或点授权，也无法把文件推到公网而不用你的凭据。所以：

- `dist/` 已经是**可以直接上传的成品**；
- 免费托管里**最快的是 Netlify Drop**（<https://app.netlify.com/drop>）和 **Cloudflare Pages 的 Upload assets**：把 `dist` 文件夹拖进去，几十秒后就有公网 HTTPS 地址。

如果你想让我直接部署，把对应平台的登录方式/令牌准备好（例如 Cloudflare 的 `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`，或 Netlify 的 `NETLIFY_AUTH_TOKEN`），我可以在这台机器上跑完 `wrangler pages deploy` / `netlify deploy` 并给你线上地址。
