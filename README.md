# 目标周报

一个以目标为主线的每日记录与周报工具。在浏览器中记录每天的进展、认识、问题和下一步思考，按周自动汇总。Mac 和 Windows 可以使用同一份数据，无需安装 Python、Git 或桌面客户端。

**[打开在线记录器](https://yuxiaoling1998-wq.github.io/weekly-report-web/)** · **[复制一份到自己的 GitHub](https://github.com/yuxiaoling1998-wq/weekly-report-web/fork)**

> 本仓库只包含网页程序。每位使用者需要自己的 GitHub 私有数据仓库和访问令牌。连接时请填写自己的用户名，不要沿用页面预填的作者用户名。

## 功能

- 为每个目标设置说明、完成标准和进行状态。
- 按日期新增、编辑每日记录：今日进展、今日认识、今日问题、下一步思考。
- 在目标页查看每天的记录和每周汇总。
- 生成跨目标总周报，保存到云端或下载为 Markdown。
- 在多台电脑之间继续记录，保存时检测同一条内容的修改冲突。
- 下载完整 JSON 备份，将兼容备份导入到空的数据仓库。

周报根据已填写的内容整理、去重，不调用 AI 模型，不需要 AI API Key。

## 先了解两个仓库

| 仓库 | 用途 | 可见性 |
| --- | --- | --- |
| `weekly-report-web` | 网页代码，负责显示界面和操作数据 | 使用 GitHub 免费版 Pages 部署时需公开 |
| `weekly-report-data` | 你的目标、每日记录和已保存周报 | **必须为 Private（私有）** |

仓库名是建议值。数据仓库可以用其他名称，只要在连接页面填写一致。

**不要把个人记录、备份或访问令牌上传到公开的网页仓库。** 网页会检查数据仓库是否为私有。

## 1. 准备网页入口

任选一种方式。

### 方式 A：直接使用现成网页

打开[在线记录器](https://yuxiaoling1998-wq.github.io/weekly-report-web/)，继续第 2 步。

这种方式不需要复制代码，但会依赖作者的网站是否持续开放及后续更新。只在你信任的网页中填写令牌；需要自行管理网页版本时，选择方式 B。

### 方式 B：部署自己的网页

1. 登录自己的 GitHub 账号，打开[本项目](https://github.com/yuxiaoling1998-wq/weekly-report-web)。
2. 点击右上角 **Fork**，即在自己的账号下复制一份仓库。Owner 选择自己的账号，仓库名可以保留 `weekly-report-web`，点击 **Create fork**。
3. 在复制后的仓库进入 **Settings → Pages**。
4. 在 **Build and deployment** 中，Source 选 **Deploy from a branch**，Branch 选 **main**，Folder 选 **/ (root)**，点击 **Save**。
5. 等待部署成功，打开 Pages 页面提供的网站链接。

如果仓库名未修改，网址通常为 `https://你的GitHub用户名.github.io/weekly-report-web/`。

无需额外构建命令。`index.html` 已位于仓库根目录。Fork 不会复制作者的私有记录，也不会自动为你开启 Pages。

## 2. 创建自己的私有数据仓库

1. 打开 [GitHub 新建仓库](https://github.com/new)。
2. **Repository name** 填 `weekly-report-data`。
3. 可见性选择 **Private**，不要选择 Public。
4. 勾选 **Add a README file**，初始化仓库。
5. 点击 **Create repository**。

不用手动创建数据文件，网页第一次保存时会生成 `weekly-data.json`。

## 3. 创建访问令牌

访问令牌（Token）是授权网页读写数据仓库的钥匙，不是 GitHub 登录密码。

打开 [Fine-grained token 创建页面](https://github.com/settings/personal-access-tokens/new)，也可以从 GitHub 头像菜单进入：

**Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**

| 设置 | 填写或选择 |
| --- | --- |
| Token name | `weekly-report`，名称可自定 |
| Resource owner | **你自己的 GitHub 账号** |
| Expiration | 令牌有效期，按需选择 |
| Repository access | **Only select repositories** |
| 所选仓库 | 只选择自己的 `weekly-report-data` |
| Repository permissions → Contents | **Read and write** |
| 其他权限 | 保持默认；Metadata 的只读权限会自动包含 |

点击 **Generate token**，复制令牌并保存在自己的密码管理器中。离开生成页面后通常不能再次查看完整令牌。

关于有效期和多设备：

- **90 days** 表示 90 天后失效，是可选设置，不是本工具的要求。
- 个人账号如果提供 **No expiration**，也可以选择不设置到期日。设置有效期可以限制泄露后的可用时间；不过期令牌需要自己管理和撤销。
- 到期不会删除记录，更换令牌后可以继续连接。
- Mac 和 Windows **可以使用同一个令牌**。分别创建只是方便独立撤销某台设备的授权。
- 不要把令牌提交到仓库、发给其他人或贴在 Issue 中。

## 4. 连接并开始记录

打开第 1 步准备好的网页：

| 页面字段 | 填什么 |
| --- | --- |
| GitHub 用户名 | 个人主页地址中 `github.com/` 后的用户名，**不是邮箱** |
| 私有数据仓库 | 仓库名，如 `weekly-report-data`；不用填写整个网址 |
| 仓库访问令牌 | 第 3 步生成的令牌 |

**页面可能预填作者的用户名，请改成你自己的用户名。** 成功连接后，当前浏览器会记住用户名和仓库名。

点击 **连接并读取记录**，然后：

1. 在首页创建目标，填写目标说明和完成标准。
2. 进入目标页面，填写每日记录，点击 **保存到这个目标**。
3. 看到 **“已保存到 GitHub”** 后，才表示云端保存成功。
4. 每周汇总会显示在目标页；顶部 **总周报** 可以保存或下载跨目标周报。

新用户直接创建目标即可，**不用导入示例数据或作者的数据**。

## 5. 在 Mac 和 Windows 之间切换

两台电脑打开同一网址，连接同一个私有数据仓库。

- 在上一台电脑保存，并确认显示“已保存到 GitHub”。
- 在另一台电脑连接；如果页面已经打开，点击 **读取最新记录**。
- 两台电脑不需要同时开机，数据通过 GitHub 中转。
- 同一条记录在两边发生冲突时，网页会展示两个版本，由你选择；不同记录的修改会尽量合并保留。

**当前版本不是自动实时同步。** 不会定时刷新，也不会在后台自动上传未提交草稿。

### 为什么刷新后需要重新填写令牌？

令牌只保留在当前页面内存中，不写入本地存储或数据文件。刷新、关闭页面或断开连接后，需要重新填写。可以从密码管理器中取出同一个有效令牌，无需重新生成。

Chrome 登录 Google 账号不等于已授权 GitHub 读写；即使密码管理器同步了令牌，仍需在网页中连接。

## 备份与导入

在 **连接设置 → 迁移与备份** 中：

- 点击 **下载完整数据备份**，导出当前已读取的数据为 JSON。备份前建议先“读取最新记录”。
- 如有本工具生成的兼容 JSON 文件，选择文件，核对数量后点击 **确认导入到私有仓库**。
- 导入只用于没有记录的数据仓库，不会合并或覆盖已有记录。
- 目标、每日记录和已保存周报都保存在 `weekly-data.json`；总周报页面可单独下载 Markdown 周报。

网页不能直接导入任意 Markdown、Excel 或 Word 文件。本地 Python 旧版需先使用其迁移工具生成兼容 JSON；本公开仓库不包含 Python 程序，也不会自动与旧版本地文件双向同步。

## 数据与隐私

- 公开仓库和网页界面不包含你的私人记录。记录保存在你选择的私有仓库，访问由 GitHub 权限控制。
- 当前代码在浏览器中直接请求 GitHub API，令牌只发送到 GitHub。没有额外的数据收集服务器，也不加载第三方统计脚本。
- 用户名、仓库名和未提交表单草稿会保存在本机浏览器中；草稿按用户名和仓库隔离。
- 网络失败时保留草稿，联网后再次点击保存。本机草稿不会自动出现在另一台电脑上。
- 使用共享电脑后，可在连接设置中清除本机草稿并断开连接。

## 常见问题

| 问题 | 检查方法 |
| --- | --- |
| 没看到自己的记录 | 检查用户名和仓库名，尤其不要保留作者的默认用户名，再读取最新记录 |
| 令牌无效或已到期（401） | 确认复制完整，或创建新令牌后重新连接 |
| 没有权限（403） | 检查令牌是否选中数据仓库、Contents 是否为 Read and write；请求额度耗尽时也可能出现此提示 |
| 找不到仓库（404） | 检查用户名、仓库名、令牌访问范围，并确认数据仓库已用 README 初始化 |
| 数据仓库必须为私有 | 将数据仓库设为 Private；不要误填公开的网页代码仓库 |
| 自己的网站是 404 | 确认在自己的 Fork 中开启了 Pages，并等待部署成功；以 Settings → Pages 提供的地址为准 |
| 另一台电脑看不到新内容 | 确认上一台已保存到 GitHub，再读取最新记录；本机草稿尚未上传 |
| 网络失败后不确定是否保存成功 | 保留草稿并重试；同一次提交会检查是否已保存，避免重复创建记录 |
| 记录文件过大 | 当前写入上限为 900,000 字节，约 900 KB；达到上限会拒绝继续写入，需要先备份再扩展存储方案 |

## 文件说明

本项目是纯 HTML、CSS 和 JavaScript 网页，无构建依赖。

| 文件 | 用途 |
| --- | --- |
| `index.html` | 网页入口 |
| `style.css` | 样式与移动端布局 |
| `app.js` | 界面、表单、本机草稿与用户操作 |
| `core.js` | 数据校验、日期计算、周报整理与冲突判断 |
| `github.js` | 私有仓库检查、GitHub API 读写与重试 |
| `README.md` | 使用说明，不参与程序运行 |

## GitHub 官方参考

- [Fork 一个仓库](https://docs.github.com/en/pull-requests/how-tos/work-with-forks/fork-a-repo)
- [创建 GitHub Pages 网站](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)
- [管理个人访问令牌](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
