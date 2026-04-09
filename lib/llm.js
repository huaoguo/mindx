/**
 * LLM Provider Adapter
 *
 * Environment variables:
 *   LLM_PROVIDER  - 'openai' (default) or 'anthropic'
 *   LLM_API_KEY   - API key for the provider
 *   LLM_MODEL     - Model name (default: gpt-4o for openai, claude-sonnet-4-20250514 for anthropic)
 *   LLM_BASE_URL  - Optional custom base URL (for proxies or local models)
 */

const PROVIDER = process.env.LLM_PROVIDER || 'openai';
const API_KEY = process.env.LLM_API_KEY || '';
const MODEL = process.env.LLM_MODEL || (PROVIDER === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gpt-4o');
const BASE_URL = process.env.LLM_BASE_URL || '';

/**
 * Send a chat completion request to the configured LLM provider.
 * @param {Object} opts
 * @param {string} opts.systemPrompt - System message
 * @param {string} opts.userPrompt - User message
 * @param {number} [opts.temperature=0.3] - Sampling temperature
 * @returns {Promise<string>} The assistant's reply text
 */
async function chatCompletion({ systemPrompt, userPrompt, temperature = 0.3 }) {
  if (!API_KEY) {
    throw new Error('LLM_API_KEY not set. Configure it in environment variables.');
  }

  if (PROVIDER === 'anthropic') {
    return callAnthropic({ systemPrompt, userPrompt, temperature });
  }
  // Default: OpenAI-compatible
  return callOpenAI({ systemPrompt, userPrompt, temperature });
}

async function callOpenAI({ systemPrompt, userPrompt, temperature }) {
  const baseUrl = BASE_URL || 'https://api.openai.com';
  const url = `${baseUrl}/v1/chat/completions`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

async function callAnthropic({ systemPrompt, userPrompt, temperature }) {
  const baseUrl = BASE_URL || 'https://api.anthropic.com';
  const url = `${baseUrl}/v1/messages`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      temperature,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.content[0].text;
}

module.exports = { chatCompletion };
