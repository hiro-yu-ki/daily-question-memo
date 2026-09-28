# Architecture

単一 Cloudflare Worker が Web API を提供し、static assets が同じ origin の PWA を配信します。D1 の `captures` は通常 ChatGPT の原文と処理状態を先に永続化し、`ideas` は validation 済み構造化結果を保持します。タグだけは検索・表示しやすい中間テーブルです。

`src/worker.js` は HTTP/use-case、`validation.js` は信頼境界、`ai.js` は Mock/OpenAI provider、`repository.js` は D1/in-memory storage を担当します。Custom GPT は構造化済み結果を直接 validation・保存し、Backend AI を再利用しません。通常インポートだけ provider を呼びます。

Web session は署名付き HttpOnly/Secure/SameSite cookie、書き込みは session 内 CSRF token を要求します。GPT Action は独立した Bearer secret です。将来 Backlog 連携は `ideas.next_actions` 等を読む別 adapter として追加でき、schema の全面変更は不要です。
