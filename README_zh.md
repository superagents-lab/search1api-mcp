# Search1API MCP 服务

[![Smithery](https://img.shields.io/badge/Smithery-listed-6C5CE7)](https://smithery.ai/servers/superagents-lab/search1api-mcp)
[![Glama](https://img.shields.io/badge/Glama-listed-6C5CE7)](https://glama.ai/mcp/servers/superagents-lab/search1api-mcp)

[English](./README.md) | [Deutsch](./README_de.md)

[Search1API](https://s1.dev/?utm_source=mcp) 官方 MCP 服务 — 一个 API 搞定搜索、新闻、爬虫等能力。

## 认证

- 支持 OAuth 的客户端可以直接连接 Remote MCP URL，然后在浏览器中登录并授权。
- 现有集成可以继续使用从 [Search1API 仪表板](https://dashboard.search1api.com)获取的 API 密钥。
- 所有 MCP 请求（包括工具发现 `initialize`、`tools/list`）都需要凭证。未认证请求会返回 OAuth 挑战，客户端借此触发登录；登录前的能力查看由静态 [server card](https://mcp.search1api.com/.well-known/mcp/server-card.json) 承担。

## 快速开始（Remote MCP）

无需本地安装，直接在 MCP 客户端中配置远程 URL 即可使用。客户端支持时优先使用 OAuth，否则提供 API 密钥。

### 认证方式

支持三种方式，根据客户端能力选择：

| 方式 | 格式 |
|------|------|
| OAuth 2.1 | 不带密钥连接 `https://mcp.search1api.com/mcp`，按客户端提示完成登录授权 |
| Authorization Header | `Authorization: Bearer YOUR_SEARCH1API_KEY` |
| URL Query 参数（兼容方式） | `https://mcp.search1api.com/mcp?apiKey=YOUR_SEARCH1API_KEY` |

优先使用 OAuth 或 Authorization Header。URL Query 中的凭据可能暴露在 URL、日志和 shell 历史记录中。

### 展示已选来源

Remote MCP 和 `search1api-mcp` 0.8.0 及以上版本的本地 stdio 都提供 `render_results`。`search`、`news` 和 `ask` 负责获取数据；需要浏览来源时，再把已有结果传给 `render_results`。

支持 MCP Apps 的客户端可以展示来源卡片。所有客户端都收到完整文本列表和结构化 JSON；渲染和展开来源不会再次搜索，也不消耗搜索积分。不需要 `ui` URL 参数，继续使用标准端点 `https://mcp.search1api.com/mcp`。

本地安装请升级并重启 MCP 连接：`npm install -g search1api-mcp@latest`，或使用 `npx -y search1api-mcp@latest`。如果看不到新工具，请刷新连接器的工具定义。参数和返回结构见 [render_results](docs/render-results.md)。

### Claude Desktop

```json
{
  "mcpServers": {
    "search1api": {
      "url": "https://mcp.search1api.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_SEARCH1API_KEY"
      }
    }
  }
}
```

### Claude.ai（网页版）

从 [Claude 连接器目录](https://claude.ai/directory/search1api) 安装 Search1API，点 **Connect**，用 Search1API 账号登录即可。

不要通过 **Add custom connector** 手动添加 `https://mcp.search1api.com/mcp`：那样会另建一个自定义连接器，不填名称时 Claude 会用主机名 `mcp.search1api.com` 作为它的名字。

### Cursor

推荐以 Cursor 插件方式安装：本仓库已包含 Agent Plugins 的 `plugin.json` + `mcp.json`（可移植），以及 `.cursor-plugin/plugin.json`（Cursor Marketplace 元数据 / logo），用于 Remote MCP + OAuth。可通过 [cursor.directory](https://cursor.directory) 或 Cursor Marketplace 安装，首次连接时按提示登录。

本地测试时，请将插件文件复制到 `~/.cursor/plugins/local/search1api`（`plugin.json`、`.cursor-plugin/`、`mcp.json`、`assets/`）。不要从该目录外做 symlink——Cursor 会拒绝指向外部的符号链接。

也可手动配置：

```json
{
  "mcpServers": {
    "search1api": {
      "url": "https://mcp.search1api.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_SEARCH1API_KEY"
      }
    }
  }
}
```

### Antigravity

作为 Antigravity 插件安装：`antigravity-plugin/` 里是插件清单、`mcp_config.json`（远程 MCP，OAuth 登录）、Search1API skill 和市场展示用的 README。可以直接从 GitHub 安装，然后在浏览器里登录即可：

```bash
agy plugin install https://github.com/superagents-lab/search1api-mcp/tree/main/antigravity-plugin
```

本地测试：在仓库目录里运行 `agy plugin validate --strict ./antigravity-plugin` 和 `agy plugin install ./antigravity-plugin`。

### VS Code

```json
{
  "servers": {
    "search1api": {
      "type": "http",
      "url": "https://mcp.search1api.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_SEARCH1API_KEY"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add --transport http search1api https://mcp.search1api.com/mcp \
  --header "Authorization: Bearer YOUR_SEARCH1API_KEY"
```

### Windsurf

```json
{
  "mcpServers": {
    "search1api": {
      "serverUrl": "https://mcp.search1api.com/mcp?apiKey=YOUR_SEARCH1API_KEY"
    }
  }
}
```

## Agent Skill

Agent Skill 已迁移至 [search1api-cli](https://github.com/superagents-lab/search1api-cli)。安装方式：

```bash
npm install -g search1api-cli
npx skills add superagents-lab/search1api-cli
```

## 本地模式（stdio）

如果你更倾向于在本地运行，请使用 Node.js 20 或更高版本；通过 npx 即可使用，无需克隆仓库：

```json
{
  "mcpServers": {
    "search1api": {
      "command": "npx",
      "args": ["-y", "search1api-mcp"],
      "env": {
        "SEARCH1API_KEY": "YOUR_SEARCH1API_KEY"
      }
    }
  }
}
```

自行部署 HTTP 服务并使用反向代理时，请通过逗号分隔的
`MCP_ALLOWED_HOSTS` 环境变量添加会到达 Node.js 进程的内部主机名。
默认允许 `mcp.search1api.com` 和 localhost 地址。会发送 `Origin` 请求头的
浏览器客户端还需要通过逗号分隔的 `MCP_ALLOWED_ORIGINS` 添加可信来源的
主机名。服务端 MCP 客户端通常不会发送 `Origin`，因此不需要额外配置。

## 工具

### search
搜索网页。结果包含可引用的 `id`/`title`/`url` 结构。需要完整网页时，将结果 URL 传给 `crawl`。

| 参数 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| `query` | 是 | - | 搜索关键词 |
| `max_results` | 否 | 10 | 返回结果数量 |
| `search_service` | 否 | google | google、bing、bingcn、duckduckgo、yahoo、yandex、x、reddit、github、youtube、arxiv、wechat、bilibili、imdb、wikipedia、grokipedia |
| `page` | 否 | 1 | 结果页码（1-100）；仅 bing、bingcn、baidu、grokipedia 支持翻页 |
| `crawl_results` | 否 | 0 | 抓取完整内容的顶部结果数量；每个成功抓取的页面会在搜索请求基础 1 积分之外增加 1 积分 |
| `include_sites` | 否 | [] | 限定搜索的网站 |
| `exclude_sites` | 否 | [] | 排除的网站 |
| `time_range` | 否 | - | day、week、month、year |

引擎提供发布时间时，结果的 `metadata` 包含 `published_date`；`github` 结果另含 `kind`、`stars`、`language`、`num_comments`。

### news
搜索新闻。`hackernews` 结果链接到讨论帖，并在 `metadata` 中附带 `story_url`、`points`、`num_comments`。

| 参数 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| `query` | 是 | - | 搜索关键词 |
| `max_results` | 否 | 10 | 返回结果数量 |
| `search_service` | 否 | bing | google、bing、duckduckgo、yahoo、hackernews |
| `crawl_results` | 否 | 0 | 抓取完整内容的顶部结果数量；每个成功抓取的页面会在新闻请求基础 1 积分之外增加 1 积分 |
| `include_sites` | 否 | [] | 限定搜索的网站 |
| `exclude_sites` | 否 | [] | 排除的网站 |
| `time_range` | 否 | - | day、week、month、year |

### crawl
提取网页内容。

| 参数 | 必需 | 说明 |
|------|------|------|
| `url` | 是 | 目标 URL |

### sitemap
获取网站所有相关链接。

| 参数 | 必需 | 说明 |
|------|------|------|
| `url` | 是 | 目标 URL |

### trending
获取平台热门话题。

| 参数 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| `search_service` | 是 | - | github、hackernews |
| `max_results` | 否 | 10 | 返回数量 |

### ask
智能搜索：用自然语言描述需求，Search1API 会选择最多五个引擎和时间范围，过滤不相关的结果，按相关度返回最多 10 条可引用结果。结果还包含 `intent`（实际使用的关键词、引擎和时间范围）和 `errors`（其他引擎完成时失败的引擎）。每次成功请求消耗 5 积分；已知要用哪个引擎时请用 `search`。

| 参数 | 必需 | 说明 |
|------|------|------|
| `query` | 是 | 自然语言描述的需求，最多 500 字符 |

### send_feedback
向 Search1API 团队反馈问题：结果错误、为空或不完整，无法解决的报错，文档与实际行为不符，或缺少的能力。免费，不消耗积分。服务端有 Search1API 凭证时，反馈会关联到对应账号，方便团队跟进。请勿包含凭证或隐私数据。

| 参数 | 必需 | 说明 |
|------|------|------|
| `message` | 是 | 出了什么问题或缺少什么，最多 4000 字符 |
| `intent` | 否 | 当时想完成的任务 |
| `category` | 否 | bug、feature_request、docs、other |
| `request_id` | 否 | 出问题那次调用的请求 ID |
| `model` | 否 | 你的模型名称 |

## 版本历史

- v0.7.0: 新增智能搜索工具 `ask`。`search` 新增 `bingcn`、`yandex`、`grokipedia` 引擎和 `page` 参数；`search` 与 `news` 支持 `time_range: "week"`，并在结果 `metadata` 中透传 `published_date` 以及 GitHub、Hacker News 字段

- v0.6.1: Bug fix — MCP 发现类方法（`initialize`、`tools/list`、`resources/*`、`prompts/list`、`server/discover`）重新要求凭证。匿名开放会让"能列出工具即视为已登录"的客户端显示已连接却无法触发 OAuth；现在所有未认证请求一律返回 401 挑战，恢复连接时的 OAuth 登录流程。目录侧可见性不受影响，仍由静态 server card 与 registry 元数据提供
- v0.6.0: MCP 发现类方法（`initialize`、`tools/list`、`resources/*`、`prompts/list`、`server/discover`）无需凭证即可访问，客户端与目录站点可在登录前枚举工具；工具调用仍需 OAuth 或 API 密钥。stdio 模式在未设置 `SEARCH1API_KEY` 时也能启动并返回工具元数据，仅在调用工具时拒绝。畸形请求改为返回 JSON-RPC 而非 HTML 错误页
- v0.5.4: OAuth 签发方切换到 `clerk.s1.dev`，可通过 `OAUTH_AUTHORIZATION_SERVER` 配置；在 `/.well-known/mcp/server-card.json` 发布 MCP server card；OAuth 发现文档增加缓存头
- v0.5.3: OAuth 资源与工具 metadata 不再要求 OIDC 会话 scope；添加 Smithery 与 Glama 平台 badge
- v0.5.2: MCP `Origin` 校验提前到请求解析和认证之前执行；自行托管的 HTTP 部署可通过 `MCP_ALLOWED_ORIGINS` 配置信任的浏览器来源
- v0.5.1: 同步文档、LobeHub manifest 与 MCP Registry 元数据；传输域名提供 `robots.txt`
- v0.5.0: 支持 MCP 2026-07-28 与自动协议协商；通过无状态回退兼容 2025 版本 HTTP 客户端；改为请求级认证
- v0.4.0: 结构化输出 schema、OAuth 安全声明、只读安全注解和官方 MCP Registry 元数据
- v0.3.1: Remote MCP 支持 OAuth 2.1；移除已下线的 reasoning 工具
- v0.3.0: 新增 Remote MCP 支持（Streamable HTTP），per-session API 密钥认证
- v0.2.0: LibreChat 集成的 `.env` 回退支持
- v0.1.8: X (Twitter)、Reddit 搜索服务
- v0.1.7: GitHub、Hacker News 热榜工具
- v0.1.6: Wikipedia 搜索服务
- v0.1.5: 新增搜索参数及搜索服务（arxiv、wechat、bilibili、imdb）
- v0.1.3: 新闻搜索
- v0.1.2: 站点地图
- v0.1.1: 网页爬取
- v0.1.0: 首次发布

## 许可证

MIT

## UI 与第三方署名

`render_results` 的 MCP Apps 视图把已有来源展示为带标题和域名的卡片。所有客户端同时收到完整文本和结构化结果列表。视图改编自 Swami Malode 的 [Rare UI](https://rareui.com) 组件，其 MIT + Commons Clause + Attribution 许可完整保留在 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

UI 配置、沙箱来源与发布检查：[MCP Apps UI](docs/mcp-ui.md)。
