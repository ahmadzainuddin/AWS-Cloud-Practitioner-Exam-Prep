const DEFAULT_MODEL = 'gpt-4.1-mini'
const PROMPT_VERSION = 4
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

function sanitizeStructuredExplanation(value, options) {
  const payload = value && typeof value === 'object' ? value : {}
  const optionIds = new Set(options.map((option) => option.id))
  const optionExplanations = payload.optionExplanations && typeof payload.optionExplanations === 'object'
    ? payload.optionExplanations
    : {}

  return {
    summary: truncateText(payload.summary, 900),
    optionExplanations: Object.fromEntries(
      Object.entries(optionExplanations)
        .filter(([optionId, explanation]) => optionIds.has(optionId) && explanation)
        .map(([optionId, explanation]) => [optionId, truncateText(explanation, 500)]),
    ),
  }
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
    .filter((option) => option && (option.id || option.key) && option.text)
    .map((option) => ({
      id: option.id ? String(option.id).trim().slice(0, 120) : '',
      key: option.key ? String(option.key).trim().slice(0, 8) : '',
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
  const correctAnswerIds = normalizeAnswerIds(payload.correctAnswerIds)
  const selectedAnswerIds = normalizeAnswerIds(payload.selectedAnswerIds)

  const normalized = {
    schemaVersion: Number(payload.schemaVersion) || 1,
    examTitle: truncateText(payload.examTitle, 200),
    sourceFile: sanitizePathSegment(payload.sourceFile),
    questionNumber: Number(payload.questionNumber),
    question: truncateText(payload.question),
    options,
    selectedAnswerIds,
    correctAnswerIds,
  }

  if (!normalized.examTitle || !normalized.question || !Number.isFinite(normalized.questionNumber)) {
    return { error: 'Missing exam title, question number, or question text.' }
  }

  if (normalized.options.length < 2 || normalized.correctAnswerIds.length < 1) {
    return { error: 'Missing answer options or correct answer.' }
  }

  if (normalized.schemaVersion >= 2) {
    const optionIds = new Set(normalized.options.map((option) => option.id).filter(Boolean))
    if (optionIds.size !== normalized.options.length) {
      return { error: 'Schema v2 payload requires every option to have a unique ID.' }
    }
    if (!normalized.correctAnswerIds.every((answerId) => optionIds.has(answerId))) {
      return { error: 'Schema v2 correct answer ID does not match any option.' }
    }
  }

  return { normalized }
}

function buildPrompt(payload) {
  const optionsText = [...payload.options]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((option) => `- optionId: ${option.id}\n  text: ${option.text}`)
    .join('\n')

  return [
    `Exam: ${payload.examTitle}`,
    `Question ${payload.questionNumber}: ${payload.question}`,
    '',
    'Options by stable ID:',
    optionsText,
    '',
    `Correct answer IDs: ${payload.correctAnswerIds.join(', ')}`,
    '',
    'Return strict JSON only. Do not wrap the output in code fences.',
    'Use this exact JSON shape:',
    '{"summary":"short summary without option letters","optionExplanations":{"option_id":"brief reason for that option"}}',
    'The optionExplanations object must include exactly one entry for every provided optionId.',
    'Do not use A-E letters because the frontend randomizes display labels.',
    'For each option reason, state whether it is correct or incorrect for this question.',
    'Do not invent facts outside the question context. Keep each reason concise.',
  ].join('\n')
}

function parseAiJson(value) {
  const text = String(value || '')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
  return JSON.parse(text)
}

async function createExplanation(payload, env) {
  if (env.AI_EXPLANATION_MOCK === 'true') {
    return sanitizeStructuredExplanation({
      summary: 'This is a mock explanation generated without calling OpenAI.',
      optionExplanations: Object.fromEntries(
        payload.options.map((option) => [
          option.id,
          payload.correctAnswerIds.includes(option.id)
            ? 'Correct option in the mock response.'
            : 'Incorrect option in the mock response.',
        ]),
      ),
    }, payload.options)
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
      instructions: 'You are an AWS Cloud Practitioner tutor. Produce concise, factual JSON for exam revision. Return only valid JSON.',
      input: buildPrompt(payload),
      max_output_tokens: 700,
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

  return sanitizeStructuredExplanation(parseAiJson(explanation), payload.options)
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
    options: [...normalized.options]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((option) => ({
        id: option.id,
        text: option.text,
      })),
    correctAnswerIds: [...normalized.correctAnswerIds].sort(),
  })
  const questionHash = await sha256Hex(hashInput)
  const cachePrefix = normalized.schemaVersion >= 2 ? `explanations/v${PROMPT_VERSION}` : 'explanations'
  const objectKey = `${cachePrefix}/${normalized.sourceFile}/question-${normalized.questionNumber}-${questionHash.slice(0, 16)}.json`

  const cached = await env.AI_EXPLANATIONS.get(objectKey)
  if (cached) {
    const cachedPayload = await cached.json()
    const structuredExplanation = sanitizeStructuredExplanation(cachedPayload.structuredExplanation, normalized.options)
    return jsonResponse({
      cached: true,
      structuredExplanation,
      explanation: structuredExplanation.summary,
      explanationHtml: '',
      questionHash: cachedPayload.questionHash,
      createdAt: cachedPayload.createdAt,
      model: cachedPayload.model,
    }, 200, origin)
  }

  try {
    const structuredExplanation = await createExplanation(normalized, env)
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
      correctAnswerIds: normalized.correctAnswerIds,
      structuredExplanation,
    }

    await env.AI_EXPLANATIONS.put(objectKey, JSON.stringify(responsePayload, null, 2), {
      httpMetadata: {
        contentType: 'application/json',
      },
    })

    return jsonResponse({
      cached: false,
      structuredExplanation,
      explanation: structuredExplanation.summary,
      explanationHtml: '',
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
