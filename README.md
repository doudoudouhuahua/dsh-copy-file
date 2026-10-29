# dsh-copy-file

给 [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) 的右侧文档预览加一个「复制文件」按钮：
点击后把当前预览的文件放进 Windows 剪贴板，直接到任意文件夹里 **Ctrl+V** 就能粘贴这个文件，
不用再回原文件夹里找。

## 功能

- 按钮出现在右侧文档预览头部（「打开 / 显示文件位置」图标那一排的右边）。
- 点击后把**文件本身**（不是文本内容）写入剪贴板文件列表（CF_HDROP），资源管理器可直接粘贴。
- 按钮短暂变为对勾表示成功；失败时变为警告图标，悬停可看原因。
- 支持中文文件名 / 中文路径。
- 只在本机 DSH 宿主内工作：文件路径不离开本机，不上传、不读取文件内容。

## 安装

要求：Windows + DSH Desktop（0.2.x，自带 PowerShell 5.1）。

### 方式一：让 DSH 插件管理器安装（推荐）

在 DSH 会话里执行：

```text
plugin_manager(action: "install_bundle", target: "github:doudoudouhuahua/dsh-copy-file")
```

安装完成后 **完全退出并重新打开 DSH Desktop**。

### 方式二：手动安装到 desktop profile

```powershell
# 1) 克隆到任意目录
git clone https://github.com/doudoudouhuahua/dsh-copy-file.git D:\AI\dsh-copy-file

# 2) 在 profile 的 package.json 里加依赖
#    "dsh-copy-file": "link:D:/AI/dsh-copy-file"
#    并把 "dsh-copy-file" 加到 dsh.profile.bundles 末尾

# 3) 建 junction（Windows）
cmd /c mklink /J "%USERPROFILE%\.dsh\profiles\desktop\node_modules\dsh-copy-file" "D:\AI\dsh-copy-file"

# 4) 完全退出并重新打开 DSH Desktop
```

## 使用

1. 在右侧 Sidebar 打开一个文件预览（代码、Markdown、图片等任意可预览文件）。
2. 在预览头部找到「复制文件」图标，点击。
3. 到目标文件夹按 Ctrl+V。

注意：复制会覆盖剪贴板当前内容；一次复制一个文件（预览本身也是单文件）。

## 原理

| 半边 | 作用 |
| --- | --- |
| `lib/client.js` | 在 `sidebar.right.tab.document.actions` 插槽注册按钮，把 `absolutePath` POST 给宿主 |
| `lib/index.js` | 注册 `POST /dsh-copy-file`，校验绝对路径存在且是普通文件；调用 `powershell.exe -Sta -Command "Set-Clipboard -LiteralPath ..."` |
| `cordis.patch.yml` | bundle 挂载声明（host 行 `dsh-copy-file`） |

宿主路由只接受本机同源、已认证的 POST；不会读取文件内容，也不把路径写进日志。

## 兼容性

- DSH 0.2.x（依赖 `sidebar.right.tab.document.actions` 插槽与 `webServer.register` 路由 API）。
- Windows（`Set-Clipboard -LiteralPath` 需要 Windows PowerShell 5.1；无需管理员权限）。
- DSH 大版本升级后若按钮消失，可能需要对一下插槽 / 路由 API。

## 卸载

1. 从 profile 的 `package.json` 删除依赖与 bundles 项；
2. `cmd /c rmdir "%USERPROFILE%\.dsh\profiles\desktop\node_modules\dsh-copy-file"`（只删链接）；
3. 完全退出并重开 DSH。

## License

[MIT](LICENSE)
