# Tab Manager - 标签页管理器

一款优雅的浏览器 New Tab 扩展，替代默认的新标签页，提供强大的标签页可视化管理功能。支持实时缩略图预览、拖拽排序、快速关闭、多维度排序以及深浅主题切换。

## 功能特性

### 核心功能
- **缩略图预览** - 显示每个标签页的实时截图预览
- **网站图标** - 自动加载 Favicon，支持 Google Favicons 回退方案
- **快速导航** - 点击卡片即可跳转到对应标签页
- **快速关闭** - 悬停显示关闭按钮，支持关闭动画
- **拖拽排序** - 支持自由拖拽调整标签页顺序
- **多维排序** - 支持按手动、域名、标题、最近访问时间排序

### 设置选项
| 设置项 | 说明 |
|--------|------|
| 卡片最小宽度 | 120px - 700px 可调节 |
| 缩略图质量 | 低/中/高三档 |
| 排序方式 | 手动拖拽 / 按域名 / 按标题 / 最近访问 |
| 主题 | 跟随浏览器 / 浅色模式 / 深色模式 |

### 界面特性
- **响应式网格布局** - 自适应浏览器窗口大小
- **平滑动画** - 卡片悬停、拖拽、关闭动画
- **双主题支持** - 浅色（米兰风格）和深色主题
- **加载状态** - 显示加载动画和标签计数
- **空状态提示** - 无标签时的友好提示

## 技术架构

### 扩展架构 (Manifest V3)

```
tab-manager/
├── manifest.json        # 扩展配置文件（Manifest V3）
├── tab-manager.html     # New Tab 入口页面
├── styles.css           # 双主题样式系统
├── app.js               # 前端主逻辑
├── background.js        # Service Worker 后台服务
├── content-script.js    # 内容脚本（截图捕获）
├── offscreen.html       # 离屏文档
├── offscreen.js         # 离屏截图逻辑
└── icons/               # 扩展图标
```

### 核心模块

#### 1. [app.js](file:///workspace/tab-manager/app.js) - 前端主逻辑
- 标签页数据加载与渲染
- 拖拽排序系统（mousedown + mousemove + mouseup）
- 卡片缓存机制（Card Cache）
- 设置面板管理
- 主题切换逻辑

#### 2. [background.js](file:///workspace/tab-manager/background.js) - 后台服务
- Service Worker 生命周期管理
- 标签页查询与过滤
- 截图缓存管理（5分钟有效期）
- 并发截图控制（最多3个同时）
- 标签页移动与关闭操作

#### 3. [content-script.js](file:///workspace/tab-manager/content-script.js) - 内容脚本
- 注入到所有 HTTP/HTTPS 页面
- 接收截图请求并调用 `chrome.tabs.captureTab()`
- 返回截图数据 URL

#### 4. [offscreen.js](file:///workspace/tab-manager/offscreen.js) - 离屏截图
- 使用 `tabCapture` API 获取视频流
- 将视频帧绘制到 Canvas 并转为 JPEG
- 支持自定义分辨率

#### 5. [styles.css](file:///workspace/tab-manager/styles.css) - 样式系统
- CSS 变量驱动的双主题
- 浅色主题：米兰风格，暖琥珀色强调
- 深色主题：现代深灰，紫色强调

### 数据流

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ app.js      │────▶│ background.js   │────▶│ content-script.js│
│ (前端UI)     │◀────│ (Service Worker)│◀────│ (标签页内运行)    │
└─────────────┘     └─────────────────┘     └──────────────────┘
       │                    │
       │                    ▼
       │            ┌─────────────────┐
       │            │  screenshotCache│
       │            │  (内存缓存)      │
       │            └─────────────────┘
       ▼
┌─────────────────┐
│ localStorage    │
│ (用户配置+排序)  │
└─────────────────┘
```

### 权限说明

| 权限 | 用途 |
|------|------|
| `tabs` | 获取标签页信息 |
| `scripting` | 注入内容脚本 |
| `activeTab` | 访问当前活动标签 |
| `<all_urls>` | 允许在所有页面运行内容脚本 |

## 安装步骤

### Chrome 浏览器

1. 下载并解压扩展文件夹
2. 打开 Chrome，地址栏输入 `chrome://extensions/`
3. 右上角开启 **「开发者模式」**
4. 点击 **「加载已解压的扩展程序」**
5. 选择 `tab-manager` 文件夹
6. 完成！打开新标签页即可使用

### Microsoft Edge

1. 打开 Edge，地址栏输入 `edge://extensions/`
2. 左下角开启 **「开发者模式」**
3. 点击 **「加载已解压的扩展程序」**
4. 选择 `tab-manager` 文件夹
5. 完成！

### Firefox

> 注意：Firefox 使用 Gecko 扩展 ID，在 manifest.json 中已配置兼容字段。

1. 打开 Firefox，地址栏输入 `about:debugging#/runtime/this-firefox`
2. 点击 **「临时加载附加组件」**
3. 选择 `tab-manager` 文件夹中的任意文件
4. Firefox 会自动加载整个扩展

## 使用指南

### 基本操作
- **打开标签管理器**：按 `Ctrl+T` 或 `Cmd+T` 打开新标签页
- **切换到标签**：直接点击标签卡片
- **关闭标签**：悬停卡片，点击右上角关闭按钮
- **搜索标签**：滚动浏览或使用排序功能

### 拖拽排序
1. 鼠标悬停在任意标签卡片上
2. 按下鼠标左键开始拖拽
3. 移动到目标位置后释放
4. 标签顺序会自动保存

### 排序功能
- **手动拖拽**：自定义标签顺序
- **按域名**：按网站域名字母排序（如 google.com, github.com）
- **按标题**：按页面标题排序
- **最近访问**：按最后访问时间排序

### 主题切换
- 点击右上角设置图标
- 在「主题」下拉框中选择：
  - **跟随浏览器**：自动匹配系统主题
  - **浅色模式**：强制使用米兰浅色主题
  - **深色模式**：强制使用深色主题

## 配置存储

扩展使用 `localStorage` 存储以下数据：

| 键名 | 内容 |
|------|------|
| `tabmanager_config` | 用户设置（卡片宽度、质量、主题、排序方式） |
| `tabmanager_order` | 手动排序的标签 ID 列表 |

## 浏览器兼容性

| 浏览器 | 支持版本 | 最低版本 |
|--------|----------|----------|
| Google Chrome | ✅ | Chrome 88+ |
| Microsoft Edge | ✅ | Edge 88+ |
| Mozilla Firefox | ⚠️ 部分功能 | Firefox 109+ |

## 已知限制

1. **截图限制**：无法截取 `chrome://`、`about:` 等内部页面的缩略图
2. **隐私模式**：无痕模式下部分功能可能受限
3. **权限要求**：需要 `<all_urls>` 权限以注入内容脚本

## 开发相关

### 调试技巧

**前端调试**
1. 在新标签页上右键 → 检查
2. 打开开发者工具查看控制台输出

**后台脚本调试**
1. 打开 `chrome://extensions/`
2. 找到 Tab Manager，点击「Service Worker」链接
3. 在 DevTools 中查看日志和断点调试

### 构建修改

如需修改代码：
1. 修改对应文件
2. 在 `chrome://extensions/` 点击刷新按钮
3. 测试新功能

## 更新日志

### v1.0.0
- 初始版本发布
- 支持标签页缩略图预览
- 支持拖拽排序
- 支持多维度排序
- 支持深浅主题切换
- 完整的响应式布局

## License

MIT License
