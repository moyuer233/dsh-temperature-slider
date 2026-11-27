# dsh-temperature-slider

> **⚠️ WIP · 未在真实 DSH 里实测**
> 目前只过了单元测试和静态检查，**还没有装进任何 profile 跑过**。
> 「状态」一节写清了哪些验过、哪些没验，别把这份 README 当成"能用"的承诺。

<p align="center">
  <img alt="WIP" src="https://img.shields.io/badge/status-WIP-d97706?style=flat-square&labelColor=161b22">
  <img alt="DSH" src="https://img.shields.io/badge/DSH-0.2.0--rc.2-4D6BFE?style=flat-square&labelColor=161b22&logo=deepseek&logoColor=white">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-3DA639?style=flat-square&labelColor=161b22">
</p>

给 DeepSeek Harness 的输入栏加一个「采样」按钮：点开是温度滑杆（0–2，步进 0.05），
值经 `agent/request` 钩子合并进每次模型调用的 `LlmCallConfig.temperature`。

只针对 **DSH 0.2.0-rc.2**，不做旧版本兼容。

## 它做什么

- 输入栏右侧多一个「采样」按钮，亮起＝覆盖生效中。
- 面板里一条温度滑杆 + 一个「覆盖模型默认」开关。
- 关掉开关就完全不动请求，跟随模型默认。
- 拦在 Provider 路由之前，所以官方 DeepSeek 和第三方接入都生效。

## 一个必须知道的前提

**思考模式开着时，温度会被上游忽略。**

DeepSeek 官方文档原话：思考模式不支持 temperature / presence_penalty / frequency_penalty，
「设置参数不会报错，但也不会生效」；deepseek-v4-pro 在思考模式下会忽略传入值
（启用工具调用时固定 0.95，否则 1.0）。

所以想让滑杆真的起作用，先把推理等级关掉。面板里也写了这句提示。

## 安装

```sh
dsh plugin --profile desktop add github:MoyuStarry/dsh-temperature-slider
```

然后在 profile 的 `cordis.patch.yml` 里确认有这一行（本包自带 `cordis.patch.yml`，装 bundle 时会带上）：

```yaml
- insert:
    - id: temperature-slider
      name: dsh-temperature-slider
```

重启 DSH。

## 原理

- **宿主**（`lib/index.js`）：声明 `Config`（`enabled` / `temperature`），
  监听 `agent/request` 瀑布事件，`await next()` 拿到机器本会使用的 `LlmCallConfig`，
  开着覆盖就把 `temperature` 并进去返回。
- **客户端**（`lib/client.js`）：`window.__ModuleLoader__.load` 工厂，
  注册 `conversation.input.right` 插槽条目，经 `ctx.remote.settings.describe/update`
  读写 `temperature-slider` 这个设置命名空间（＝ cordis 条目 id）。
- **纯逻辑**（`lib/merge.js`）：`withTemperature(config, resolved)`，单独成文件好直接测。

## 状态

| 项 | 结果 |
|---|---|
| `test/merge.test.mjs`（5 条：关闭/开启/越界/边界 0 与 2/无配置） | ✅ 通过 |
| `lib/*.js` 语法检查（`node --check`） | ✅ 通过 |
| `lib/client.js` 静态检查（loader / id / exports / 插槽名 / apply / settings RPC） | ✅ 6/6 |
| **在真实 DSH 里加载、按钮真的出现** | ❌ 未测 |
| **滑杆值真的进到 `LlmCallConfig.temperature`** | ❌ 未测 |

后两项要装进 profile 才能验。装之前请先备份 profile。

## 已知限制

- 只做了 `temperature`，没做 `top_p`（DSH 的 `LlmCallConfig` 抽象层就没这个字段）。
- 设置写入是否会被 DSH 接受，取决于 0.2.x 的 settings 是否按插件 `Config` 自动登记；未实测。
- 若设置读写失败，面板仍可拖动，但只影响当前会话、重启即丢。

## License

MIT © MoyuStarry
