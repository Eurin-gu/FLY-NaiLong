# 奶龙 · 3D 喷射起飞计划

真实 WebGL / Three.js 飞行场景。角色是程序搭建的奶龙造型：黄色圆肚子、绿色眼睛、奶油色肚皮、小爪子和尾巴。底下可喷便便、水柱或彩虹。保留了追捕吐槽、穿圈计分和搞笑结算。

## 运行

开发预览（源码直出，改完刷新即可）：

```bash
npm install          # 首次
npm run dev          # → http://127.0.0.1:4173
```

生产构建与运行：

```bash
npm run build        # 产出 dist/：压缩 + 内容哈希 + PWA + SEO
npm start            # → http://127.0.0.1:8080（读取 dist/）
```

`npm start` 监听 `0.0.0.0`，同一局域网的手机可直接访问（终端会打印地址），适合真机测试。也可以直接打开 `index.html`，但 Service Worker 离线能力与体感模式需要 HTTP(S) / localhost。

体感模式需要 localhost / HTTPS。人体姿态识别组件（MediaPipe Pose）已自托管在 `vendor/mediapipe/`（约 24 MB，仅在点击“开启体感”时按需加载）；该目录缺失时会自动回退到 jsDelivr CDN。视频仅在浏览器本地识别，不上传。切回手动模式会释放摄像头。

## 部署上线

见 [DEPLOY.md](DEPLOY.md)：Cloudflare Pages / Netlify / Vercel / GitHub Pages / Docker & 自有服务器 五种方案，含一键上传步骤、自定义域名与上线检查清单。

最短路径：`npm run build`，然后把 `dist/` 文件夹拖到 <https://app.netlify.com/drop> 或 Cloudflare Pages 的 **Upload assets**，几十秒后就能拿到公网 HTTPS 地址。

## 生产环境自检

```bash
npm run verify          # 构建 + 启动生产服务器 + 真实浏览器全量检查（Windows）
```

会用真实的 Edge/Chrome 跑完整链路，结果写到 `output/verify/report.json`，截图在 `output/verify/`：

- **HTTP 契约**：状态码、CSP/安全响应头、`immutable` 强缓存、brotli 协商、`If-None-Match` → 304、目录穿越拦截、自定义 404、`/healthz`、PWA manifest、Service Worker 预缓存清单里的每个 URL 都能 200。
- **真实渲染**：WebGL 初始化成功、渲染失败兜底保持隐藏、按住空格后界面海拔从 18 m 升到 250 m 以上、暂停真的冻结模拟、喷射物切换、帮助弹窗、390×844 手机布局。
- **PWA / 离线**：Service Worker 注册并接管页面，**断网后重新加载仍能进入游戏**。
- **体感运行时**：自托管的 MediaPipe Pose 在当前 CSP 下能真正加载并跑完一次推理（用空白画布，无需摄像头）。
- **控制台卫生**：无未捕获异常、无 CSP 违规、无 4xx/5xx。

浏览器层需要真实 Chromium。Windows 直接用 `npm run verify`；其他平台可以手动起服务后接上任意已开启 CDP 的 Chromium：

```bash
BASE_URL=http://127.0.0.1:8080 CDP_URL=http://127.0.0.1:9222 node scripts/verify.mjs
BASE_URL=http://127.0.0.1:8080 node scripts/verify.mjs --http-only   # 只跑 HTTP 层
```

## 操作

- 空格 / W / ↑ / 喷射按钮：模拟连续扇翅并喷射上升。普通爬升最高 40 m/s，无高度上限。体感每次下扇提供 200 ms 升力，需要连续快速扇动才能持续爬升。
- 松手：保留上升惯性，随后进入**真正的自由落体**——重力持续加速，没有终端速度，掉得越久越快；S / ↓ 会再加大重力。落地停住，继续扇翅才会重新升空。
- 地面和楼房都是陷阱：撞到地面、在楼下赖着不走，或撞上建筑物，都会招来**交警追捕**。被他抓到扣 1 点耐久，血量归零就结束（自由模式自动恢复）；爬到 120 m 以上即可甩掉他。护盾 / 冲刺 / 打滚期间被摸到也不算。
- A / D / ← / →：左右飞行，横向位置也不受屏幕宽度限制。
- 拖动画面：上下左右操纵；手机可用画面底部四个方向按钮。
- Q：切换便便、水柱、彩虹，外观及操作音效随之切换。
- 1：清除附近前方追兵，冷却 8 秒。
- 2 / Shift：2.5 秒无敌加速，镜头视角扩大，冷却 9 秒。
- 3：6 秒护盾，冷却 12 秒。
- E / 奶龙打滚：翻滚闪避 0.85 秒，冷却 4 秒。翻滚避开撞击 +80 分，擦边飞过无人机 +35 分。
- P / Esc：暂停；切走页面自动暂停。F / ⛶：全屏。

自由模式可以无限飞行，三颗心用完自动恢复。6 km 挑战需要保持耐久飞到终点。模式可在开局前或结算后选择；想在局中换模式，可刷新回到首页。

穿过甜甜圈基础 +100 分，连续收集增加奖励；清场每架 +60 分，护盾 / 冲刺撞机 +30 分，通关 +500 分。最高海拔纪录保存在本地浏览器，与旧版分数纪录分开。

本轮手感改进：停止扇翅后保留惯性并受重力下坠；目标提示同时显示左右和上下偏差，对准时变绿。喷口位于身体后下方，尾流朝下，喷射物继承速度并受重力下落；水柱和彩虹有连续尾流，冲刺增加速度线，角色会眨眼、摆尾。城市和云层使用稳定世界网格生成，避免切换区块时跳动。快速飞行使用整段运动轨迹进行碰撞判断。系统开启“减少动态效果”时隐藏速度线和翻滚旋转，闪避效果仍保留。

## 实现与文件

- `flight-world.js`：唯一的 3D 场景，奶龙模型、跟随镜头、城市与云层、立体喷射物、无人机和甜甜圈。
- `game.js`：独立世界坐标的飞行物理、三维目标碰撞、操作、流程和体感。画布 resize 只更新投影，不改变实际高度。
- `index.html` / `style.css`：响应式驾驶舱、仪表、操作控件。
- `vendor/three.min.js`：Three.js r160，附 MIT 许可证 `THREE-LICENSE.txt`。
- `vendor/mediapipe/`：自托管的人体姿态识别运行时，仅体感模式按需加载；缺失则回退 CDN。
- `boot.js`：注册 Service Worker、兜底未处理的异步错误（独立文件，保持 CSP 里没有内联脚本）。
- `scripts/build.mjs`：生产构建。压缩 JS/CSS、内容哈希、改写 `index.html`、注入 SEO/OG/PWA 标签、生成 `sw.js` 预缓存清单、写出 `_headers` / `_redirects` / `robots.txt` / `sitemap.xml` / `version.json`。缺少可选依赖时会退化为不压缩，构建照常成功。
- `scripts/security.mjs`：CSP 与缓存策略的唯一来源，构建（生成响应头文件）和 `server.mjs` 共用，避免两边不一致。
- `scripts/make-icons.mjs` + `scripts/png.mjs`：零依赖的 PNG 编码器与软件光栅器，生成 PWA 图标和社交卡片，不需要 sharp/canvas 之类的原生库。
- `scripts/vendor-mediapipe.mjs`：从 npm 镜像下载并裁剪 MediaPipe Pose 运行时到 `vendor/mediapipe/`。
- `server.mjs`：生产静态服务器，零第三方依赖。brotli/gzip 压缩、强缓存与 304、路径穿越防护、自定义 404、`/healthz`、优雅关闭。
- `public/`：直接复制进 `dist/` 的静态资源（图标、`404.html`）。
- `site.config.json`：站点名称、描述、`siteUrl` 等构建期配置。
- `dist/`：**构建产物**，不要手改；每次 `npm run build` 会整体重建。
- `backups/2d-v1/`：本轮改动前的 2D 版本；`original-backup.html` 为更早原版。
- `output/playwright/verify-3d.js`：浏览器验证脚本；临时注入的状态访问器只存在于测试浏览器，生产代码没有调试接口。
- `output/playwright/verify-flight-feel.js`：惯性上升、翻滚闪避与冷却、镜头暂停、高速碰撞、擦边计分、场景连续性与手机布局检查。

奶龙外观参考：[形象参考图集](https://www.bilibili.com/read/cv26114592/)。当前模型由基础几何体搭建，没有使用官方 3D 模型资产。

## 已验证

桌面和 390×844 手机布局、WebGL 初始化、8.5 秒从 18 m 爬升至约 762 m、镜头跟随、松手惯性与重力下坠、俯冲、横移、喷射物切换、冲刺视角、技能冷却、暂停、三维穿圈判定、清场、自由模式恢复、挑战胜负、全屏与帮助弹窗。没有页面脚本异常。真实摄像头识别仍需在本机授权后体验。

### 生产构建自检（`npm run verify`）

**51/51 通过**。报告见 `output/verify/report.json`，截图见 `output/verify/`。

- **HTTP 契约**：安全响应头与严格 CSP、`immutable` 强缓存、brotli 压缩、`If-None-Match` → 304、三种路径穿越写法全部拦截、自定义 404、`/healthz`、PWA manifest、Service Worker 预缓存清单里 11 个 URL 全部 200。
- **真实 Chromium 渲染**：WebGL 初始化成功、渲染失败兜底保持隐藏、按住空格后界面海拔 17 → 242 m、暂停真的冻结模拟、喷射物切换、帮助弹窗、390×844 手机方向盘可见。
- **自由落体与交警**：松手后实测 dv/dt = **57.3 m/s²**（等于重力常量，确认是 v = v₀ + g·t 而不是带阻力的匀减速）；下落峰值 **-237 m/s**，证明终端速度上限已经去掉；撞地会召唤交警，被抓扣 1 点耐久（3 → 2），爬升到 120 m 以上甩掉他则**不掉血**（2 → 2）；直接用游戏里的 `buildingHit` 函数探测屋顶高度有楼、54 m 以上无楼、河道走廊无楼；贴地横向飞进楼房会触发"撞楼"追捕。
- **PWA / 离线**：Service Worker 注册并接管页面；**断网后重新加载仍能进入游戏**。
- **体感运行时**：自托管的 MediaPipe Pose 在当前 CSP 下能真正加载并跑完一次推理（用空白画布，不需要摄像头），确认 `wasm-unsafe-eval` 足够、无需放开 `unsafe-eval`。
- **控制台卫生**：无未捕获异常、无 CSP 违规、无 4xx/5xx。

压缩后的生产包与未压缩源码行为一致：`game.js` 33 KB → 19.9 KB，`flight-world.js` 26.6 KB → 15.7 KB，`style.css` 31.7 KB → 22.9 KB（brotli 后 `three` 从 654 KB → 约 160 KB）。


体感升力来自抬臂后的向下扇动，每次提供短暂升力；静止举手不会持续飞升。新版头部为连续曲面，缩小绿色眼睛、去掉突出的口鼻，并加入随扇动展开的小翅膀。

`output/playwright/verify-gravity.js` 使用模拟姿态数据验证静止举手无升力、向下扇动触发、停扇超时和丢失追踪停止升力；也检查重力、落地不反弹、冲刺不自动扇翅。真实摄像头尚未实测。

## 参考图与体感转向更新

按用户提供的参考图加宽头部、加厚四肢，肚皮使用贴合身体曲面的渐变颜色。身体左右倾斜可转向，奶龙同步侧倾、转头和调整双臂。摄像头预览显示手臂骨架与转向指示，可点击“校准当前站姿”重设中立位置。

扇动识别改用相对行程，不必每次举过肩膀；加入平滑、运动阈值与重复触发间隔。手腕出框时尝试使用肘部，输入来源切换会重置行程，避免误触发。识别循环在上次推理完成后等待 16 ms 再处理，避免推理重叠。

`output/playwright/verify-pose-steering.js` 已验证小幅扇动、连续扇动、抖动抑制、左右倾斜、转向动画、校准和丢失追踪。测试使用合成姿态数据；真人识别体验仍受光线、入镜范围和设备性能影响，尚未完成真人校准测试。
