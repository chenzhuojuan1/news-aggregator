# 环境变量配置说明

在Render部署时，需要配置以下环境变量：

## 必需

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `DATABASE_URL` | PostgreSQL连接字符串 | `postgresql://user:pass@host:5432/dbname` |
| `JWT_SECRET` | JWT签名密钥 | 任意随机字符串 |
| `ADMIN_PASSWORD` | 管理员登录密码 | 你的密码 |

## 可选（LLM翻译/总结功能）

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `OPENAI_API_KEY` | OpenAI API密钥 | 无 |
| `OPENAI_BASE_URL` | OpenAI API地址 | `https://api.openai.com` |
| `OPENAI_MODEL` | 使用的模型 | `gpt-4o-mini` |

## 服务器

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `PORT` | 服务器端口 | `3000` |
| `NODE_ENV` | 环境模式 | `production` |
