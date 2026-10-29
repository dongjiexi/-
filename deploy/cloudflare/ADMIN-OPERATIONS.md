# 云端请求保护与管理员监控

本文适用于现有 Workers + D1 接口。代码提供暂停开关和管理员汇总接口；新配置默认不启用，发布这些代码不会自动改变公开访问方式、访问口令、限流次数或模型。

## 暂停新推理请求

在现有 Cloudflare Worker 的变量设置中将 `DONGJIEXI_INFERENCE_PAUSED` 设为字符串 `true` 并部署。新解题、识图和追问会返回明确的暂停提示；不会发起模型请求、占用并发租约或扣减请求额度。会话签发和私人用量查询仍可使用。健康接口返回 `engine.health_status=paused`，不会向模型平台探测。

恢复时将该变量设为 `false` 或移除并部署。现有计数保持，不重置额度。

暂停针对新请求。部署前已受理的推理仍可能继续运行并产生费用；这不是撤销已发生费用的功能。紧急情况下还可在模型平台撤销 API Key，但需要随后重新配置才能恢复。

## 独立管理员凭证

`GET /api/admin/usage` 仅接受独立管理员秘密，不接受网页的匿名凭证、访问口令、模型密钥或会话签名秘密。未配置或未授权时返回 404，不查询计数表。

1. 在密码管理器中生成至少 32 字符、至多 256 字符、无空白的密码学随机秘密。
2. 使用 Cloudflare 的秘密设置，或在管理员终端交互执行 `wrangler secret put DONGJIEXI_ADMIN_TOKEN`。不要把值写进项目配置、命令参数、聊天或日志。
3. 该秘密必须与 `SESSION_SECRET`、`DONGJIEXI_ACCESS_KEY`、`DONGJIEXI_MODEL_API_KEY` 完全不同；复用时接口拒绝服务。
4. 轮换时更新同名秘密并部署，原秘密立即不能访问新部署。

管理员接口只返回当日总计、现有请求保护上限、剩余量、并发数量和预警状态；不返回客户端哈希、IP、题目、答案、密钥或租约 ID。响应禁止缓存。

### Windows 安全配置脚本

也可在已登录 Cloudflare 的管理员电脑上使用 `setup-admin.ps1`。该脚本要求 Windows PowerShell 7，并接收三个绝对本地文件路径：

```powershell
& .\deploy\cloudflare\setup-admin.ps1 -TokenFile 'C:\Private\Dongjiexi\admin-token-v1.clixml' -WranglerScript 'C:\Tools\cloudflare\node_modules\wrangler\bin\wrangler.js' -ConfigPath 'D:\Dongjiexi\deploy\cloudflare\wrangler.local.jsonc'
```

以上是路径示例，执行前替换为实际路径。先创建仅供管理员使用的本地目录，推荐当前用户 `%LOCALAPPDATA%\Dongjiexi\Admin`，并传入展开后的绝对路径。令牌文件须放在项目目录之外，不放入 Git 或发布包。Wrangler 和配置文件应指向既有安装及既有 Worker。

脚本用密码学随机数生成 32 字节令牌，在内存中转换为 SecureString，经 `Export-Clixml` 使用 Windows DPAPI 加密保存，再通过重定向标准输入提交给 `wrangler secret put DONGJIEXI_ADMIN_TOKEN`。它不会将令牌放入进程参数，不显示 Wrangler 的标准输出或错误输出，也不输出令牌。保存文件只可由原 Windows 用户在原机器上正常解密；令牌在发请求或提交 Wrangler 时仍需短暂存在进程内存中。

现有令牌文件一律拒绝覆盖。轮换时传入新的版本化文件名；成功后云端将改用新令牌，旧文件保留为人工恢复材料。若 Wrangler 返回失败，脚本仍保留加密文件，因为远程提交状态可能不确定；先核对云端状态，不直接删除恢复材料或盲目重置其它秘密。这个脚本会更新指定 Worker 的管理员秘密，但不会新增监控调度、外部通知服务或推理调用。

## 请求阈值提醒

`DONGJIEXI_USAGE_WARNING_PERCENT` 可设为 1–100 的整数，默认 80。实际阈值为 `ceil(当前日次数上限 × 百分比 / 100)`。管理员接口的 `usage.state` 为 `normal`、`warning` 或 `exhausted`，`alerts` 同时给出对应状态。暂停时另有 `INFERENCE_PAUSED` 提示。

配套 `check-usage.ps1` 只调用该只读接口，不调用模型。先通过私有方式向当前管理员进程注入 `DONGJIEXI_ADMIN_TOKEN` 环境变量，然后执行脚本。它输出汇总 JSON；退出码 0 为正常、20 为接近请求保护上限、30 为已到上限、40 为推理暂停。请求失败会报错，不被当作正常。可由管理员现有监控系统读取退出码并发送通知，建议最多每 5 分钟查询一次。

使用上述 DPAPI 文件时无需把令牌复制到环境变量，可直接执行：

```powershell
& .\deploy\cloudflare\check-usage.ps1 -TokenFile 'C:\Private\Dongjiexi\admin-token-v1.clixml'
```

检查脚本仅向指定的 HTTPS API origin 发起只读请求，拒绝重定向；解密失败、返回格式异常和网络错误均报错。不要将 `-ApiBase` 指向不受信任的服务，因为这个参数决定管理员令牌的接收者。

本次代码不创建外部通知服务、不配置邮箱或 webhook，也不会自动安装定时监控。只有保存了独立秘密并配置管理员监控后，才能收到主动通知。

## 次数不是金额

计数统计已被上游接受的请求和当前预留中的请求；上游拒绝的预留会退回，中断但已经受理的流可能仍会计费。预留、活动租约与状态分别读取，汇总用于运行监控，不是交易级账单。

日窗口为 UTC 自然日（北京时间次日 08:00 重置），涵盖解题、识图和追问；不存 token 数量或人民币金额。不同模型、输入输出长度和深度模式的价格不同，不能将请求次数推算成确定的费用。

金额告警、余额提醒及消费上限须在模型供应商账户的实际功能中单独配置。本模块没有读取供应商账单，也不声称已为该账户开启金额告警。

## 验证

运行 `node tests/cloud_usage_guard_tests.cjs`，覆盖独立鉴权、复用凭证拒绝、汇总数据脱敏、UTC 窗口切换、阈值状态、暂停不扣额度、恢复不重置计数等场景。已有 `cloudflare_worker_tests.cjs` 与 `cloud_admission_tests.cjs` 继续覆盖认证、固定上游、限流和失败清理。

Windows 管理脚本可运行 `tests/cloud_admin_scripts_tests.ps1`，使用完全离线的伪 Wrangler 验证随机令牌、DPAPI 文件、禁止覆盖、抑制意外回显和读取令牌文件后的预警退出码，不接触真实 Worker。
