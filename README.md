> 公開用スナップショットです。実データ、認証情報、運用環境の識別子は含めていません。

# 日常の疑問メモ

ChatGPT で考えた内容のうち、明示的に残したいものだけを構造化して保存する個人用 PWA です。Custom GPT Action と通常 ChatGPT のコピー＆ペーストを、同じ API・D1・一覧へ集約します。

## Architecture

- Cloudflare Worker: API、認証、AI processing orchestration
- D1: raw captures、ideas、tags
- dependency-free responsive SPA/PWA: iPhone Safari first、PC responsive
- AI provider interface: zero-cost Mock が既定、OpenAI Responses adapter は optional

詳細は [ARCHITECTURE.md](ARCHITECTURE.md) を参照してください。

## Local setup

Node.js 20+ と Wrangler が必要です。repository 自体には runtime package dependency がありません。

1. `.env.example` を `.dev.vars` にコピーします。
2. `WEB_PASSWORD`、`SESSION_SECRET`、`GPT_ACTION_SECRET` に開発専用値を設定します。
3. `AI_PROVIDER=mock` のままにします。
4. `npm run dev` を実行し `http://localhost:8787` を開きます。

`.dev.vars` は Git 対象外です。ChatGPT Plus / Pro 契約と OpenAI API の billing は別です。本物の AI を使う場合だけ `AI_PROVIDER=openai`、課金設定済み API project の `OPENAI_API_KEY`、任意の `OPENAI_MODEL` を設定します。既定モデルは、会話の分類・抽出を低コストかつ低レイテンシで行う `gpt-5.6-luna` です。

## Environment variables

| Name | Required | Purpose |
|---|---:|---|
| `WEB_PASSWORD` | yes | Web login password |
| `SESSION_SECRET` | yes | signed session key（passwordとは別） |
| `GPT_ACTION_SECRET` | yes | Custom GPT Bearer secret |
| `AI_PROVIDER` | yes | `mock`（既定）または `openai` |
| `OPENAI_API_KEY` | only OpenAI | optional provider credential |
| `OPENAI_MODEL` | no | low-cost model name（既定: `gpt-5.6-luna`） |
| `ALLOWED_ORIGIN` | no | reserved deployment documentation value |

## Database migration

Local: `wrangler d1 migrations apply daily-question-memo --local`

Production: `wrangler d1 migrations apply daily-question-memo --remote`

`migrations/0001_initial.sql` は additive initial schema で、既存データ削除はしません。

## Run, test, build

```text
npm test
npm run typecheck
npm run lint
npm run build
npm run dev
```

Node tests は schema/parser/auth、duplicate、status transition、AI error、raw preservation、API integration、PWA/mobile requirements を検証します。Mock AI の `[[MOCK_TIMEOUT]]`、`[[MOCK_ERROR]]`、`[[MOCK_INVALID]]` は異常系確認用です。

Playwright が既に利用可能な環境では、local Worker 起動後に `E2E_WEB_PASSWORD=... npm run test:e2e:browser` で desktop/iPhone viewport の実ブラウザ spec も実行できます。本 workspace では package install 禁止のため runner を追加取得していません。

## Production deploy

1. D1 database を作成し、`wrangler.jsonc` の `database_id` を置換します。
2. production migration を適用します。
3. `wrangler secret put WEB_PASSWORD`、`wrangler secret put SESSION_SECRET`、`wrangler secret put GPT_ACTION_SECRET` を実行します。
4. OpenAI 使用時だけ `wrangler secret put OPENAI_API_KEY` と `AI_PROVIDER=openai` を設定します。
5. `npm run deploy`、続けて `https://YOUR_DOMAIN/health` を確認します。

この isolated workspace では外部認証・deploy は行いません。

## Usage

通常 ChatGPT では保存したい会話をコピーし、PWA の「会話を取り込む」へ貼り付けて「AI整理して保存」を押します。原文が先に保存されます。AI 失敗時は一覧に失敗理由・原文・再処理ボタンが表示されます。

Custom GPT は [setup](docs/CUSTOM_GPT_SETUP.md)、[instructions](docs/CUSTOM_GPT_INSTRUCTIONS.md)、[OpenAPI](docs/gpt-action-openapi.yaml) を使用します。構造化済み payload は再度 AI に送られません。

## Troubleshooting

- `401`: Web password または GPT Bearer secret の経路を確認します。両 secret は別物です。
- `403 Invalid CSRF token`: 再ログインします。sessionStorage を消したタブでは token を再取得する必要があります。
- `202` / failed: raw は保存済みです。provider 設定を直して一覧の「再処理」を押します。
- migration error: binding/database ID と local/remote 指定を確認します。破壊的 SQL は実行しません。
- PWA 更新が見えない: Safari/ブラウザを再起動するか site data/cache を更新します。
- OpenAI error: API billing/key/model を個別に確認し、まず `AI_PROVIDER=mock` で全 flow を切り分けます。

## Security notes

Secrets は source やログへ出しません。HTTPS、HttpOnly/Secure/SameSite cookie、CSRF token、login rate limit、parameterized SQL、payload/schema limit、HTML escaping を使用します。個人的で機密性のある会話を扱うため、公開 URL を secret 未設定で運用しないでください。
