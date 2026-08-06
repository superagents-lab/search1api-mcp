# Search1API MCP 服务

[English](./README.md)

[Search1API](https://www.search1api.com/?utm_source=mcp) 官方 MCP 服务 — 一个 API 搞定搜索、新闻、爬虫等能力。

## 认证

- 支持 OAuth 的客户端可以直接连接 Remote MCP URL，然后在浏览器中登录并授权。
- 现有集成可以继续使用从 [Search1API 仪表板](https://dashboard.search1api.com)获取的 API 密钥。

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

Settings > Connectors > Add custom connector：

```
https://mcp.search1api.com/mcp?apiKey=YOUR_SEARCH1API_KEY
```

### Cursor

推荐以 Cursor 插件方式安装：本仓库已包含 `.cursor-plugin/plugin.json` 和 `mcp.json`（Remote MCP + OAuth）。可通过 [cursor.directory](https://cursor.directory) 或 Cursor Marketplace 安装，首次连接时按提示登录。

本地测试时，请将插件文件复制到 `~/.cursor/plugins/local/search1api`（`.cursor-plugin/`、`mcp.json`、`assets/`）。不要从该目录外做 symlink——Cursor 会拒绝指向外部的符号链接。

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
默认允许 `mcp.search1api.com` 和 localhost 地址。

## 工具

### search
搜索网页。结果包含可引用的 `id`/`title`/`url` 结构。需要完整网页时，
将结果 URL 传给 `crawl`。

| 参数 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| `query` | 是 | - | 搜索关键词 |
| `max_results` | 否 | 10 | 返回结果数量 |
| `search_service` | 否 | google | google、bing、duckduckgo、yahoo、x、reddit、github、youtube、arxiv、wechat、bilibili、imdb、wikipedia |
| `crawl_results` | 否 | 0 | 抓取完整内容的顶部结果数量；每个成功抓取的页面会在搜索请求基础 1 积分之外增加 1 积分 |
| `include_sites` | 否 | [] | 限定搜索的网站 |
| `exclude_sites` | 否 | [] | 排除的网站 |
| `time_range` | 否 | - | day、month、year |

### news
搜索新闻。

| 参数 | 必需 | 默认值 | 说明 |
|------|------|--------|------|
| `query` | 是 | - | 搜索关键词 |
| `max_results` | 否 | 10 | 返回结果数量 |
| `search_service` | 否 | bing | google、bing、duckduckgo、yahoo、hackernews |
| `crawl_results` | 否 | 0 | 抓取完整内容的顶部结果数量；每个成功抓取的页面会在新闻请求基础 1 积分之外增加 1 积分 |
| `include_sites` | 否 | [] | 限定搜索的网站 |
| `exclude_sites` | 否 | [] | 排除的网站 |
| `time_range` | 否 | - | day、month、year |

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

## 版本历史

- v0.5.1: 移除与 `crawl` 重复的 `fetch` 工具；搜索结果 URL 直接交给 `crawl`
- v0.5.0: 支持 MCP 2026-07-28 与自动协议协商；通过无状态回退兼容 2025 版本 HTTP 客户端；改为请求级认证
- v0.4.0: 初始 `search`/`fetch` 兼容、结构化输出 schema、OAuth 安全声明、只读安全注解和官方 MCP Registry 元数据
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
