---
name: mindx-docs
description: "MindX 是用户和其所有 Agent 的记忆、对话、日志的集中存储。当需要了解用户的信息、查询用户或 Agent 的历史记忆(memory)、对话记录(chat)、运行日志(log)、人格设定(soul)或用户文档(user)时，应自动调用此 skill 获取信息。也用于上传、管理这些文档。每当跟用户开启新的会话时，都应先通过此 skill 获取用户的 memory，后续对话中上下文已包含 memory 就不用重复获取，除非需要查询其它类型，例如 chat/log/soul/user。"
---

# MindX API

## Overview

MindX 是用户和其所有 Agent 的记忆、对话、日志文件的集中存储平台。通过 REST API 管理 Markdown 文档，支持按类型（memory/chat/log/soul/user）分类存储和检索。每个 Agent 拥有独立认证，上传的文档会记录来源 Agent。

**核心场景**：当用户或 Agent 需要回溯历史记忆、查询对话记录、检索运行日志时，应主动调用此 skill 获取相关信息。

- **API Version**: 4.0.0

## Post-Installation Hook

**IMPORTANT**: After this skill is fully loaded and ready to use, you MUST run these steps in order:

1. Save config (so it persists across sessions):
```bash
python3 {SKILL_DIR}/scripts/mindx_api.py init --base_url {MINDX_BASE_URL} --api_key {MINDX_API_KEY}
```
Replace `{MINDX_BASE_URL}` and `{MINDX_API_KEY}` with the actual values provided during installation.

2. Report connected status:
```bash
python3 {SKILL_DIR}/scripts/mindx_api.py set-status --status connected
```

3. Load user memory and present a brief summary to the user:
```bash
python3 {SKILL_DIR}/scripts/mindx_api.py list --type memory
```

## Uninstallation Hook

**IMPORTANT**: When this skill is being uninstalled or removed, you MUST run:
```bash
python3 {SKILL_DIR}/scripts/mindx_api.py set-status --status idle
```

## API Configuration

This skill requires two environment variables to be set before use:

- **`MINDX_BASE_URL`**: The MindX server URL (e.g. `https://mindx-livv.onrender.com`)
- **`MINDX_API_KEY`**: Your Agent's API key (e.g. `mx_...`)

These are provided during installation. All commands below assume they are already set.

## Data Models

### Document
| Field             | Type     | Required | Description                                 |
| ----------------- | -------- | -------- | ------------------------------------------- |
| `id`              | integer  | Yes      | Document ID                                 |
| `type`            | string   | Yes      | One of: user, soul, memory, log, chat       |
| `filename`        | string   | Yes      | Filename (e.g. session-2026-04-08.md)       |
| `content`         | string   | Yes      | Markdown content                            |
| `agent_name`      | string   | Yes      | Agent that uploaded this document           |
| `file_created_at` | datetime | Yes      | When the original file was created          |
| `uploaded_at`     | datetime | Yes      | When the document was uploaded to MindX     |

### DocumentInput
| Field             | Type     | Required | Description                                   |
| ----------------- | -------- | -------- | --------------------------------------------- |
| `type`            | string   | Yes      | One of: user, soul, memory, log, chat         |
| `filename`        | string   | Yes      | Filename                                       |
| `content`         | string   | Yes      | Markdown content                               |
| `file_created_at` | datetime | Yes      | When the original file was created (ISO 8601)  |

## Core Capabilities

### List Documents
Returns all markdown documents belonging to the user. Supports optional filters: `--type` (user/soul/memory/log/chat), `--agent_id`.
```bash
python3 {SKILL_DIR}/scripts/mindx_api.py list
python3 {SKILL_DIR}/scripts/mindx_api.py list --type memory
python3 {SKILL_DIR}/scripts/mindx_api.py list --type log --agent_id 1
```

### Upload Document — JSON (agent only)
```bash
python3 {SKILL_DIR}/scripts/mindx_api.py upload \
  --type memory \
  --filename "session-2026-04-08.md" \
  --content "# Session Notes" \
  --file_created_at "2026-04-08T10:00:00Z"
```

### Upload Document — File (agent only)
Upload a local file directly, avoids shell escaping issues with large content:
```bash
python3 {SKILL_DIR}/scripts/mindx_api.py upload-file \
  --type memory \
  --file /path/to/session-2026-04-08.md \
  --file_created_at "2026-04-08T10:00:00Z"
```
`--filename` is optional; defaults to the file's basename.

### Get Document
```bash
python3 {SKILL_DIR}/scripts/mindx_api.py get --id 1
```

### Delete Document
**⚠️ Destructive** — always confirm with the user before deleting.
```bash
python3 {SKILL_DIR}/scripts/mindx_api.py delete --id 1
```

## Workflow Guidelines

1. **Listing first**: When the user asks to get or delete by name/filename, first list to find the correct ID.
2. **Confirm deletions**: Always ask the user for explicit confirmation before deleting documents.
3. **Error handling**: If the API returns an error, display the error message and suggest corrective actions.
4. **Script location**: All API calls use the bundled script at `{SKILL_DIR}/scripts/mindx_api.py`. Replace `{SKILL_DIR}` with the actual skill base directory path provided when the skill loads.

## Error Responses

| Status Code | Description                            |
| ----------- | -------------------------------------- |
| 400         | Validation error                       |
| 401         | Missing or invalid API key             |
| 403         | Forbidden (role mismatch)              |
| 404         | Resource not found                     |

## Resources

### scripts/
- `mindx_api.py` — CLI tool for all MindX API operations (documents).
