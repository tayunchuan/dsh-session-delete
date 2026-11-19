# dsh-session-delete

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的侧边栏会话菜单添加一个**红色「删除」**项，样式对齐 DeepSeek 网页版会话菜单中的删除操作（垃圾桶图标 + 红色文字）；并在侧边栏底部提供一个**「清空归档」**按钮，用来真正删除已归档会话的日志文件。

> 非官方插件，与 DeepSeek 官方无关。

## 功能

- 每个会话的「…」菜单末尾新增红色「删除 / Delete」一行（排在 Harness 自带的置顶、重命名、分叉、归档、复制 ID 之后）。
- 垃圾桶轮廓图标 + 红色文字，hover 时浅红背景，与 DeepSeek 网页版截图样式一致。
- 单会话删除：先确认，再从侧边栏移除（Harness 的归档机制，可恢复）。
- 侧边栏底部「清空归档」按钮：统计所有已归档会话的数量与占用，二次确认后**永久删除**日志、投影缓存和归档登记。不可恢复。
- 确认框支持 `Esc`、遮罩点击关闭、Tab 焦点循环；中英文文案跟随 Harness 语言；只使用 `--dsw-alias-*` 主题 token，适配浅色 / 深色。
- 已归档会话不再显示单会话「删除」行，避免重复操作。

## 安装

本仓库本身就是一个 DSH bundle 目录（`package.json` 里包含 `dsh.bundle` 与 `dsh.client`）。

1. 把仓库放到本地任意目录。
2. 在 DeepSeek Harness 中打开 **设置 → 插件**，使用插件管理器的本地目录安装入口，选择本仓库根目录。
3. 启用 **Session Delete**，刷新页面（Host 半的更新需要重启一次 Harness）。

安装后：

- 悬停任意会话行 →「…」→ 红色「删除」。
- 侧边栏底部（设置按钮旁）→ 垃圾桶图标 →「清空归档」。

> 已在 DeepSeek Harness `0.2.1-rc.2`（Windows、Web GUI）安装验证。

## 两种删除的区别

| 操作 | 做什么 | 能否恢复 |
|---|---|---|
| 菜单「删除」 | 停止运行中的工作，把会话**归档**（从侧边栏移除） | 能，在「全部对话（显示已归档）」中取消归档 |
| 底部「清空归档」 | 删除**所有已归档会话**的日志文件夹、投影缓存，并清理归档/工作区登记 | **不能** |

清空归档不会删除：

- 附件（图片/文件）在全局附件库里，可能被其他会话引用，因此保留；
- 正常会话、当前正在聊的会话（Host 会跳过仍在运行的会话）。

## 结构

```
.
├── package.json          # bundle 清单（dsh.bundle + dsh.client）
├── cordis.patch.yml      # 插入 session-delete 这一行
├── index.js              # Host 半：清空归档的 HTTP 路由 + 文件删除
├── client.js             # Client 半：菜单项、底部按钮、确认框、样式
├── locale/
│   ├── en.json           # 插件管理器展示用元数据
│   └── zh.json
└── icon.svg              # 插件图标
```

实现要点：

- 菜单项：`sidebar.workspaces.session.menu.item`（`order: 500`）。
- 底部按钮：`sidebar.footer.action`（`order: 100`）。
- 确认框：`shell.overlay`，不会被侧边栏或菜单裁剪。
- 单会话删除：`ctx.uiWorkspace.archiveSession(sessionId, { stopActivity: true })`。
- 清空归档：Client 调用 `POST /plugins/session-delete/purge`，由 Host 半读取 `workspace.json` 的归档集合，删除 `sessions/<workspace>/<id>` 与 `session_projcache`，再用 `workspaceRegistry.unarchiveSession` / `detachSession` 清理登记。

### 路由安全

Harness 的 HTTP 服务器没有全局鉴权，所以该路由自己做请求校验：

- 只接受 `POST`，Host 必须是回环地址且端口与 `webServer.getOrigin()` 一致；
- `Origin` 必须是同端口的回环地址，`Sec-Fetch-Site`（存在时）必须是 `same-origin`；
- `Content-Type: application/json`，并带私有请求头 `x-dsh-session-delete: purge`；
- 请求体上限 4 KB；跨站表单/脚本请求会在预检或校验阶段被拒绝。

该功能依赖 Web GUI（`http://127.0.0.1:...`）。Electron 的 `file://` 界面没有该路由，按钮会提示“仅在 Web 界面可用”。

## 开发

`client.js` 是 Harness 浏览器模块加载器格式（`window.__ModuleLoader__.load`），`index.js` 是普通 ESM Host 插件，均无需构建步骤。

```bash
node --check client.js
node --check index.js
```

修改 Host 半后需要重启 Harness 才会重新注册路由；只改 Client 半重新安装 bundle 并刷新页面即可。

## 许可

[MIT](./LICENSE)
