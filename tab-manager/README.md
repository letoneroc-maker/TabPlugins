# Tab Manager - 安装指南

一个简洁的 New Tab 标签页管理器，显示所有打开的标签缩略图，支持快速关闭。

## 功能

- 显示所有打开标签的缩略图预览
- 显示域名和标题
- 点击卡片跳转到对应标签
- 点击关闭按钮删除标签（带动画效果）
- 设置项：每行列数、缩略图质量、主题（跟随系统/浅色/深色）

## 安装步骤

### Chrome

1. 打开 Chrome，地址栏输入 `chrome://extensions/`
2. 右上角开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `tab-manager` 文件夹

### Microsoft Edge

1. 打开 Edge，地址栏输入 `edge://extensions/`
2. 左下角开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `tab-manager` 文件夹

## 使用方法

安装完成后，打开新标签页（Ctrl+T）即可看到标签管理器。

## 文件结构

```
tab-manager/
├── manifest.json       # 扩展配置
├── tab-manager.html   # 入口页面
├── styles.css          # 样式
├── app.js              # 逻辑
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## 卸载方法

1. 进入 `chrome://extensions/` 或 `edge://extensions/`
2. 找到「Tab Manager」
3. 点击「移除」
