const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_API_URL = process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions'
const LLM_MODEL = process.env.LLM_MODEL || 'gpt-4o-mini'
const OPENAI_TIMEOUT = Number(process.env.OPENAI_TIMEOUT || 60_000)

if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not configured')
}

async function callOpenAI({ system, user, responseSchema }) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT)
  try {
    const body = {
      model: LLM_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.2,
      response_format: responseSchema ? { type: 'json_object' } : undefined,
    }

    const res = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`OpenAI error ${res.status}: ${text}`)
    }

    const json = await res.json()
    const content = json?.choices?.[0]?.message?.content
    if (!content) {
      throw new Error('OpenAI response missing content')
    }
    return content
  } finally {
    clearTimeout(timeout)
  }
}

function parseJson(content) {
  const start = content.indexOf('{')
  const end = content.lastIndexOf('}')
  if (start === -1 || end === -1) {
    throw new Error('OpenAI response did not include JSON')
  }
  const sliced = content.slice(start, end + 1)
  return JSON.parse(sliced)
}

module.exports = { callOpenAI, parseJson }
