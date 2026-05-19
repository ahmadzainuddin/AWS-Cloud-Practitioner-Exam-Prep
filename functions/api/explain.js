const DEFAULT_MODEL = 'gpt-4.1-mini'
const PROMPT_VERSION = 3
const MAX_TEXT_LENGTH = 4000
const ALLOWED_ORIGINS = new Set([
  'https://ahmadzainuddin.github.io',
  'https://aws-cloud-practitioner-exam-prep.pages.dev',
])

const jsonHeaders = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
}

function getAllowedOrigin(request) {
  const origin = request.headers.get('Origin')
  return ALLOWED_ORIGINS.has(origin) ? origin : ''
}

function corsHeaders(origin) {
  return origin
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        Vary: 'Origin',
      }
    : {}
}

function jsonResponse(payload, status = 200, origin = '') {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...jsonHeaders,
      ...corsHeaders(origin),
    },
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

function stripHtml(value) {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/(?:ul|ol)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function sanitizeExplanationHtml(value) {
  const text = String(value || '').trim()
  if (!text) return ''

  const escapedCodeFences = text
    .replace(/^```html\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()

  return escapedCodeFences
    .replace(/<\s*(\/?)\s*(p|strong|em|ul|ol|li|br)\s*[^>]*>/gi, '<$1$2>')
    .replace(/<(?!\/?(?:p|strong|em|ul|ol|li|br)>)[^>]+>/gi, '')
    .replace(/<(p|strong|em|ul|ol|li|br)>/gi, (match) => match.toLowerCase())
    .replace(/<\/(p|strong|em|ul|ol|li)>/gi, (match) => match.toLowerCase())
    .trim()
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
      id: option.id ? String(option.id).trim().slice(0, 120) : '',
      key: String(option.key).trim().slice(0, 8),
      text: truncateText(option.text, 1200),
    }))
}

function normalizeAnswerIds(answerIds) {
  return Array.isArray(answerIds)
    ? answerIds.map((answer) => String(answer).trim()).filter(Boolean)
    : []
}

function validatePayload(payload) {
  const options = normalizeOptions(payload.options)
  const correctAnswer = Array.isArray(payload.correctAnswer)
    ? payload.correctAnswer.map((answer) => String(answer).trim()).filter(Boolean)
    : []
  const selectedAnswer = Array.isArray(payload.selectedAnswer)
    ? payload.selectedAnswer.map((answer) => String(answer).trim()).filter(Boolean)
    : []
  const correctAnswerIds = normalizeAnswerIds(payload.correctAnswerIds)
  const selectedAnswerIds = normalizeAnswerIds(payload.selectedAnswerIds)

  const normalized = {
    schemaVersion: Number(payload.schemaVersion) || 1,
    examTitle: truncateText(payload.examTitle, 200),
    sourceFile: sanitizePathSegment(payload.sourceFile),
    questionNumber: Number(payload.questionNumber),
    question: truncateText(payload.question),
    options,
    selectedAnswer,
    correctAnswer,
    selectedAnswerIds,
    correctAnswerIds,
  }

  if (!normalized.examTitle || !normalized.question || !Number.isFinite(normalized.questionNumber)) {
    return { error: 'Missing exam title, question number, or question text.' }
  }

  if (normalized.options.length < 2 || normalized.correctAnswer.length < 1) {
    return { error: 'Missing answer options or correct answer.' }
  }

  if (normalized.schemaVersion >= 2) {
    const optionIds = new Set(normalized.options.map((option) => option.id).filter(Boolean))
    if (optionIds.size !== normalized.options.length) {
      return { error: 'Schema v2 payload requires every option to have a unique ID.' }
    }
    if (normalized.correctAnswerIds.length !== normalized.correctAnswer.length) {
      return { error: 'Schema v2 payload requires matching correct answer IDs.' }
    }
    if (!normalized.correctAnswerIds.every((answerId) => optionIds.has(answerId))) {
      return { error: 'Schema v2 correct answer ID does not match any option.' }
    }
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
    payload.selectedAnswer.length ? `Selected answer: ${payload.selectedAnswer.join(', ')}` : '',
    '',
    'Use the displayed option letters exactly as provided above. Do not refer to internal option IDs.',
    'The answer data may come from shuffled schema v2 options, so the displayed letters are the only letters users see.',
    'Return clean HTML only. Do not use Markdown. Do not wrap the output in code fences.',
    'Use only these tags: <p>, <strong>, <ul>, <li>, and <em>.',
    'Write one short opening paragraph that states the correct answer letters exactly.',
    'Then write one <ul> with exactly one <li> for every displayed option letter, in option order.',
    'Each <li> must start with <strong>{letter}.</strong> and briefly say whether that option is correct or incorrect for this question.',
    'For multi-answer questions, explain every correct option and every incorrect option.',
    'Highlight the correct answer letters, correct service names, and important AWS service names with <strong>.',
    'Do not invent facts outside the question context. Keep it concise and under 260 words.',
  ].join('\n')
}

async function createExplanation(payload, env) {
  if (env.AI_EXPLANATION_MOCK === 'true') {
    const answer = payload.correctAnswer.join(', ')
    return `<p>The correct answer is <strong>${answer}</strong>. This explanation is generated in local mock mode so the UI and R2 cache flow can be tested without calling OpenAI.</p><ul><li><strong>Mock mode</strong> keeps local testing fast and avoids API cost.</li></ul>`
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
      instructions: 'You are an AWS Cloud Practitioner tutor. Produce clean, safe, concise HTML for exam revision. Never output scripts, styles, links, tables, images, or attributes.',
      input: buildPrompt(payload),
      max_output_tokens: 520,
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
  const origin = getAllowedOrigin(request)
  if (!origin) {
    return jsonResponse({ error: 'Origin is not allowed.' }, 403)
  }

  if (!env.AI_EXPLANATIONS) {
    return jsonResponse({ error: 'AI_EXPLANATIONS R2 binding is not configured.' }, 500, origin)
  }

  let payload
  try {
    payload = await request.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload.' }, 400, origin)
  }

  const validation = validatePayload(payload)
  if (validation.error) {
    return jsonResponse({ error: validation.error }, 400, origin)
  }

  const normalized = validation.normalized
  const hashInput = JSON.stringify({
    schemaVersion: normalized.schemaVersion,
    promptVersion: PROMPT_VERSION,
    question: normalized.question,
    options: normalized.options.map((option) => ({
      id: option.id,
      key: option.key,
      text: option.text,
    })),
    correctAnswer: normalized.correctAnswer,
    correctAnswerIds: normalized.correctAnswerIds,
  })
  const questionHash = await sha256Hex(hashInput)
  const cachePrefix = normalized.schemaVersion >= 2 ? `explanations/v${PROMPT_VERSION}` : 'explanations'
  const objectKey = `${cachePrefix}/${normalized.sourceFile}/question-${normalized.questionNumber}-${questionHash.slice(0, 16)}.json`

  const cached = await env.AI_EXPLANATIONS.get(objectKey)
  if (cached) {
    const cachedPayload = await cached.json()
    const explanation = cachedPayload.explanation || stripHtml(cachedPayload.explanationHtml || '')
    const explanationHtml = sanitizeExplanationHtml(cachedPayload.explanationHtml) || formatExplanationHtml(explanation)
    return jsonResponse({
      cached: true,
      explanation,
      explanationHtml,
      questionHash: cachedPayload.questionHash,
      createdAt: cachedPayload.createdAt,
      model: cachedPayload.model,
    }, 200, origin)
  }

  try {
    const aiOutput = await createExplanation(normalized, env)
    const explanationHtml = sanitizeExplanationHtml(aiOutput) || formatExplanationHtml(aiOutput)
    const explanation = stripHtml(explanationHtml) || stripHtml(aiOutput)
    const responsePayload = {
      schemaVersion: normalized.schemaVersion,
      promptVersion: PROMPT_VERSION,
      examTitle: normalized.examTitle,
      sourceFile: normalized.sourceFile,
      questionNumber: normalized.questionNumber,
      questionHash,
      model: env.AI_EXPLANATION_MOCK === 'true' ? 'mock' : env.OPENAI_MODEL || DEFAULT_MODEL,
      createdAt: new Date().toISOString(),
      options: normalized.options,
      correctAnswer: normalized.correctAnswer,
      correctAnswerIds: normalized.correctAnswerIds,
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
    }, 200, origin)
  } catch (error) {
    return jsonResponse({ error: error.message || 'Unable to generate explanation.' }, 502, origin)
  }
}

export function onRequestOptions({ request }) {
  const origin = getAllowedOrigin(request)
  if (!origin) {
    return new Response(null, { status: 403 })
  }

  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin),
  })
}
