const DEFAULT_MODEL = 'gpt-4.1-mini'
const MAX_TEXT_LENGTH = 4000

const jsonHeaders = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: jsonHeaders,
  })
}

function truncateText(value, maxLength = MAX_TEXT_LENGTH) {
  const text = String(value || '').trim()
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text
}

function sanitizePathSegment(value) {
  return String(value || 'unknown')
    .toLowerCase()
    .replace(/\.md$/i, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown'
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatInlineHtml(value) {
  return escapeHtml(value).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
}

function formatExplanationHtml(explanation) {
  const paragraphs = String(explanation || '')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)

  if (!paragraphs.length) return ''

  return paragraphs
    .map((paragraph) => `<p>${formatInlineHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('')
}

async function sha256Hex(value) {
  const data = new TextEncoder().encode(value)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(hashBuffer)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function normalizeOptions(options) {
  if (!Array.isArray(options)) return []
  return options
    .filter((option) => option && option.key && option.text)
    .map((option) => ({
      key: String(option.key).trim().slice(0, 8),
      text: truncateText(option.text, 1200),
    }))
}

function validatePayload(payload) {
  const options = normalizeOptions(payload.options)
  const correctAnswer = Array.isArray(payload.correctAnswer)
    ? payload.correctAnswer.map((answer) => String(answer).trim()).filter(Boolean)
    : []

  const normalized = {
    examTitle: truncateText(payload.examTitle, 200),
    sourceFile: sanitizePathSegment(payload.sourceFile),
    questionNumber: Number(payload.questionNumber),
    question: truncateText(payload.question),
    options,
    correctAnswer,
  }

  if (!normalized.examTitle || !normalized.question || !Number.isFinite(normalized.questionNumber)) {
    return { error: 'Missing exam title, question number, or question text.' }
  }

  if (normalized.options.length < 2 || normalized.correctAnswer.length < 1) {
    return { error: 'Missing answer options or correct answer.' }
  }

  return { normalized }
}

function buildPrompt(payload) {
  const optionsText = payload.options
    .map((option) => `${option.key}. ${option.text}`)
    .join('\n')

  return [
    `Exam: ${payload.examTitle}`,
    `Question ${payload.questionNumber}: ${payload.question}`,
    '',
    'Options:',
    optionsText,
    '',
    `Correct answer: ${payload.correctAnswer.join(', ')}`,
    '',
    'Write a concise AWS Cloud Practitioner explanation for this answer.',
    'Explain why the correct answer is right and briefly why the other options are less suitable.',
    'Do not invent facts outside the question context. Keep it under 170 words.',
  ].join('\n')
}

async function createExplanation(payload, env) {
  if (env.AI_EXPLANATION_MOCK === 'true') {
    return `The correct answer is ${payload.correctAnswer.join(', ')}. This explanation is generated in local mock mode so the UI and R2 cache flow can be tested without calling OpenAI.`
  }

  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured.')
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || DEFAULT_MODEL,
      instructions: 'You are an AWS Cloud Practitioner tutor. Answer clearly and directly for exam revision.',
      input: buildPrompt(payload),
      max_output_tokens: 320,
      store: false,
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    const message = data?.error?.message || 'OpenAI request failed.'
    throw new Error(message)
  }

  const outputContent = data.output?.flatMap((item) => item.content || []) || []
  const explanation = data.output_text || outputContent
    .filter((content) => content.type === 'output_text')
    .map((content) => content.text)
    .join('\n')
    .trim()

  if (!explanation) {
    throw new Error('OpenAI returned an empty explanation.')
  }

  return explanation
}

export async function onRequestPost({ request, env }) {
  if (!env.AI_EXPLANATIONS) {
    return jsonResponse({ error: 'AI_EXPLANATIONS R2 binding is not configured.' }, 500)
  }

  let payload
  try {
    payload = await request.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload.' }, 400)
  }

  const validation = validatePayload(payload)
  if (validation.error) {
    return jsonResponse({ error: validation.error }, 400)
  }

  const normalized = validation.normalized
  const hashInput = JSON.stringify({
    question: normalized.question,
    options: normalized.options,
    correctAnswer: normalized.correctAnswer,
  })
  const questionHash = await sha256Hex(hashInput)
  const objectKey = `explanations/${normalized.sourceFile}/question-${normalized.questionNumber}-${questionHash.slice(0, 16)}.json`

  const cached = await env.AI_EXPLANATIONS.get(objectKey)
  if (cached) {
    const cachedPayload = await cached.json()
    const explanation = cachedPayload.explanation || ''
    const explanationHtml = cachedPayload.explanationHtml || formatExplanationHtml(explanation)
    return jsonResponse({
      cached: true,
      explanation,
      explanationHtml,
      questionHash: cachedPayload.questionHash,
      createdAt: cachedPayload.createdAt,
      model: cachedPayload.model,
    })
  }

  try {
    const explanation = await createExplanation(normalized, env)
    const explanationHtml = formatExplanationHtml(explanation)
    const responsePayload = {
      examTitle: normalized.examTitle,
      sourceFile: normalized.sourceFile,
      questionNumber: normalized.questionNumber,
      questionHash,
      model: env.AI_EXPLANATION_MOCK === 'true' ? 'mock' : env.OPENAI_MODEL || DEFAULT_MODEL,
      createdAt: new Date().toISOString(),
      explanation,
      explanationHtml,
    }

    await env.AI_EXPLANATIONS.put(objectKey, JSON.stringify(responsePayload, null, 2), {
      httpMetadata: {
        contentType: 'application/json',
      },
    })

    return jsonResponse({
      cached: false,
      explanation,
      explanationHtml,
      questionHash,
      createdAt: responsePayload.createdAt,
      model: responsePayload.model,
    })
  } catch (error) {
    return jsonResponse({ error: error.message || 'Unable to generate explanation.' }, 502)
  }
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: jsonHeaders,
  })
}
