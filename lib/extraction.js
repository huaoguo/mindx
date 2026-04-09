/**
 * Memory Extraction Pipeline (L0 → L1 → L2)
 *
 * Extracts personalized insights from documents and notes,
 * reconciles with the user's existing insight library.
 */

const { pool } = require('../db');
const { chatCompletion } = require('./llm');

// ── System Prompt ──────────────────────────────────────────────────────

const EXTRACTION_INSTRUCTIONS = `你是 MindX 的记忆萃取引擎。你的任务是从用户提供的内容中，萃取个性化的高价值洞察。

## 处理流程（在内部执行，不要在输出中展示中间步骤）

**L0 — 标准化**：
- 去除噪音（系统指令、工具调用日志、口语重复、纯格式内容）
- 检测并去除 MindX 注入的记忆内容（[MindX Memory] 标记、memory_context_block 格式等）
- 保留用户原文完整内容，AI 回复只保留结构化摘要

**L1 — 萃取**：
- 以用户视角理解内容，关注用户表达的观点、决定、偏好
- 对每条候选信息回答三个问题：
  1. 这条信息说的是什么？→ 洞察内容（一句话，脱离上下文也能看懂）
  2. 从哪来的？→ 溯源（原文引用、位置、时间）
  3. 为什么值得记住？→ 价值摘要（必须和洞察内容说不同的事）
- 内部分类（不在输出中显示）：preference/fact/constraint/decision/goal/insight/relationship/event
- 置信度 0-100，低于 60 标注
- 产出 5-10 条，内容极短时可少于 5 条

**L2 — 调和**：
- 将每条 L1 洞察与「已有洞察」对比：
  - add：记忆库里完全没有这类信息 → 新增
  - update：有相关旧洞察但信息变化了 → 更新（指明被更新的 insight id）
  - deprecate：新信息和旧洞察矛盾，新信息更可信 → 废弃旧的（指明被废弃的 insight id）
  - skip：已有一模一样的信息 → 跳过
- 语义高度相似的洞察不应共存
- 时间更近 + 置信度更高的优先
- 用户置顶的洞察永不自动废弃

## 输出要求

**所有输出必须使用中文。**

返回严格的 JSON 数组，不要包含任何其他文字。每个元素格式：
{
  "content": "洞察内容（一句话，独立可读）",
  "value_summary": "价值摘要（为什么值得记住，和 content 不同）",
  "category": "preference|fact|constraint|decision|goal|insight|relationship|event",
  "confidence": 0-100,
  "source_quote": "原文引用（≤50字）",
  "source_position": "位置描述（如：第3段、消息12等）",
  "reconciliation": "add|update|deprecate|skip",
  "reconciles_insight_id": null 或已有洞察的 id（用于 update/deprecate）,
  "change_reason": "变更原因（update/deprecate 时必填）"
}`;

// ── Core Functions ─────────────────────────────────────────────────────

/**
 * Build a personalization profile from the user's existing insights.
 */
async function buildUserProfile(userId) {
  const { rows } = await pool.query(
    `SELECT id, content, value_summary, category, confidence, pinned
     FROM insights
     WHERE user_id = $1 AND status = 'confirmed'
     ORDER BY pinned DESC, confidence DESC
     LIMIT 50`,
    [userId]
  );
  return rows;
}

/**
 * Format existing insights into a prompt section.
 */
function formatExistingInsights(insights) {
  if (insights.length === 0) {
    return '（这是新用户，没有已有洞察。请广泛萃取以建立初始画像。）';
  }

  const grouped = {};
  for (const ins of insights) {
    if (!grouped[ins.category]) grouped[ins.category] = [];
    grouped[ins.category].push(ins);
  }

  const CATEGORY_LABELS = {
    goal: '目标', preference: '偏好', constraint: '约束', decision: '决策',
    fact: '事实', insight: '洞见', relationship: '关系', event: '事件',
  };

  let text = '';
  for (const [cat, items] of Object.entries(grouped)) {
    text += `\n### ${CATEGORY_LABELS[cat] || cat}\n`;
    for (const item of items) {
      text += `- [id=${item.id}] ${item.content}${item.pinned ? ' 📌' : ''}\n`;
    }
  }
  return text;
}

function buildPersonalizationDirective(insights) {
  if (insights.length === 0) {
    return '这是新用户，没有已有洞察记录。请广泛萃取，尝试建立用户的初始画像（目标、偏好、背景事实等）。';
  }
  return `根据该用户的已有画像，重点萃取：
1. 与其目标相关的新信息
2. 与已有决策/约束可能冲突的信息（及时发现变化）
3. 揭示新偏好、事实、关系的信息
4. 跳过已有洞察已覆盖的内容（reconciliation = skip）
5. 如果发现目标变化，务必萃取并标注`;
}

/**
 * Fetch source content (document or note).
 */
async function fetchSource(userId, sourceType, sourceId) {
  if (sourceType === 'document') {
    const { rows } = await pool.query(
      `SELECT d.id, d.type, d.filename, d.content, d.file_created_at, a.name AS agent_name
       FROM documents d JOIN agents a ON d.agent_id = a.id
       WHERE d.id = $1 AND d.user_id = $2`,
      [sourceId, userId]
    );
    if (rows.length === 0) return null;
    const doc = rows[0];
    return {
      title: doc.filename,
      meta: `类型: ${doc.type} | 来源 Agent: ${doc.agent_name} | 创建时间: ${doc.file_created_at}`,
      content: doc.content,
      timestamp: doc.file_created_at,
    };
  } else {
    const { rows } = await pool.query(
      'SELECT id, title, content, created_at FROM notes WHERE id = $1 AND user_id = $2',
      [sourceId, userId]
    );
    if (rows.length === 0) return null;
    const note = rows[0];
    return {
      title: note.title,
      meta: `笔记 | 创建时间: ${note.created_at}`,
      content: note.content,
      timestamp: note.created_at,
    };
  }
}

/**
 * Parse the LLM response and validate the structure.
 */
function parseExtractionResult(text) {
  // Strip markdown code block if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) {
    throw new Error('LLM response is not a JSON array');
  }

  // Validate each insight
  const VALID_CATEGORIES = ['preference', 'fact', 'constraint', 'decision', 'goal', 'insight', 'relationship', 'event'];
  const VALID_RECONCILIATIONS = ['add', 'update', 'deprecate', 'skip'];

  return parsed.filter(item => {
    if (!item.content || !item.value_summary || !item.category || item.confidence == null) {
      console.warn('Skipping invalid insight (missing required fields):', item);
      return false;
    }
    if (!VALID_CATEGORIES.includes(item.category)) {
      console.warn(`Skipping insight with invalid category "${item.category}":`, item.content);
      return false;
    }
    if (!VALID_RECONCILIATIONS.includes(item.reconciliation)) {
      item.reconciliation = 'add'; // Default to add
    }
    item.confidence = Math.max(0, Math.min(100, Math.round(item.confidence)));
    return true;
  });
}

/**
 * Write extraction results to the database.
 * Returns summary stats.
 */
async function writeInsights(userId, sourceType, sourceId, sourceTimestamp, insights) {
  const client = await pool.connect();
  const stats = { added: 0, updated: 0, deprecated: 0, skipped: 0 };
  const created = [];

  try {
    await client.query('BEGIN');

    for (const ins of insights) {
      if (ins.reconciliation === 'skip') {
        stats.skipped++;
        continue;
      }

      const status = ins.confidence < 60 ? 'pending' : 'confirmed';

      if (ins.reconciliation === 'add') {
        const { rows } = await client.query(
          `INSERT INTO insights (user_id, content, value_summary, category, confidence, status,
           source_type, source_id, source_quote, source_position, source_timestamp)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
           RETURNING id, content, value_summary, category, confidence, status, source_quote, source_position, pinned, created_at`,
          [userId, ins.content, ins.value_summary, ins.category, ins.confidence, status,
           sourceType, sourceId, ins.source_quote || null, ins.source_position || null, sourceTimestamp]
        );
        created.push(rows[0]);
        stats.added++;
      }

      if (ins.reconciliation === 'update' && ins.reconciles_insight_id) {
        // Deprecate the old insight
        await client.query(
          `UPDATE insights SET status = 'deprecated', change_reason = $1, updated_at = NOW()
           WHERE id = $2 AND user_id = $3 AND pinned = FALSE`,
          [ins.change_reason || 'Superseded by new extraction', ins.reconciles_insight_id, userId]
        );
        // Insert the new one, linking back
        const { rows } = await client.query(
          `INSERT INTO insights (user_id, content, value_summary, category, confidence, status,
           source_type, source_id, source_quote, source_position, source_timestamp, change_reason)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
           RETURNING id, content, value_summary, category, confidence, status, source_quote, source_position, pinned, created_at`,
          [userId, ins.content, ins.value_summary, ins.category, ins.confidence, status,
           sourceType, sourceId, ins.source_quote || null, ins.source_position || null, sourceTimestamp,
           ins.change_reason || null]
        );
        // Link old → new
        await client.query(
          'UPDATE insights SET superseded_by = $1 WHERE id = $2',
          [rows[0].id, ins.reconciles_insight_id]
        );
        created.push(rows[0]);
        stats.updated++;
      }

      if (ins.reconciliation === 'deprecate' && ins.reconciles_insight_id) {
        await client.query(
          `UPDATE insights SET status = 'deprecated', change_reason = $1, updated_at = NOW()
           WHERE id = $2 AND user_id = $3 AND pinned = FALSE`,
          [ins.change_reason || 'Deprecated by new extraction', ins.reconciles_insight_id, userId]
        );
        stats.deprecated++;
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return { stats, created };
}

/**
 * Main extraction function.
 */
async function extractInsights(userId, sourceType, sourceId) {
  // 1. Fetch source content
  const source = await fetchSource(userId, sourceType, sourceId);
  if (!source) {
    throw new Error(`Source not found: ${sourceType} #${sourceId}`);
  }

  // 2. Build user profile from existing insights
  const existingInsights = await buildUserProfile(userId);

  // 3. Assemble prompts
  const systemPrompt = `${EXTRACTION_INSTRUCTIONS}

## 个性化指令
${buildPersonalizationDirective(existingInsights)}

## 已有洞察（用于 L2 调和）
${formatExistingInsights(existingInsights)}`;

  const userPrompt = `请从以下内容中萃取记忆洞察：

**来源**: ${source.title}
**元信息**: ${source.meta}

---
${source.content}
---`;

  // 4. Call LLM
  const response = await chatCompletion({ systemPrompt, userPrompt });

  // 5. Parse response
  const insights = parseExtractionResult(response);

  // 6. Write to database
  const result = await writeInsights(userId, sourceType, sourceId, source.timestamp, insights);

  return {
    source: { type: sourceType, id: sourceId, title: source.title },
    ...result,
  };
}

module.exports = { extractInsights };
