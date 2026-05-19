<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <center>      
        <h3>AWS Cloud Practitioner</h3>
        <p>Project CloudIgnite C2</p>
        </center>
      </div>

      <div class="panel">
        <label for="exam-select">Select Exam</label>
        <select id="exam-select" v-model="selectedExamIndex">
          <option v-for="(exam, idx) in exams" :key="exam.source_file" :value="idx">
            {{ exam.title }}
          </option>
        </select>
      </div>

      <div class="panel stats" v-if="currentExam">
        <div class="stat-item">
          <span>Answered</span>
          <strong>{{ answeredCount }}/{{ currentExam.questions.length }}</strong>
        </div>
        <div class="stat-item">
          <span>Correct</span>
          <strong>{{ correctCount }}</strong>
        </div>
        <div class="stat-item">
          <span>Incorrect</span>
          <strong>{{ incorrectCount }}</strong>
        </div>
        <div class="stat-item">
          <span>Score</span>
          <strong>{{ scorePercent }}%</strong>
        </div>
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: `${progressPercent}%` }"></div>
        </div>
      </div>

      <div class="panel actions">
        <button class="secondary" @click="jumpToUnanswered">Next Unanswered</button>
        <button class="danger" @click="resetCurrentExam">Reset Exam</button>
      </div>

      <p class="sidebar-footer">AWS re/Start with Forward College</p>
    </aside>

    <main class="content" v-if="currentExam && currentQuestion">
      <header class="content-header">
        <div>
          <h2>{{ currentExam.title }}</h2>
          <p>Question {{ currentQuestionIdx + 1 }} of {{ currentExam.questions.length }}</p>
        </div>
      </header>

      <section class="question-card">
        <p class="question-text">{{ currentQuestion.question }}</p>

        <div class="options">
          <button
            v-for="option in currentQuestion.options"
            :key="option.id"
            class="option-btn"
            :class="optionClass(option.id)"
            :disabled="isCurrentSubmitted"
            @click="toggleAnswer(option.id)"
          >
            <span class="option-key">{{ option.displayKey }}</span>
            <span>{{ option.text }}</span>
          </button>
        </div>

        <div class="qa-footer">
          <div class="answer-tools">
            <button class="submit-button" @click="submitCurrentQuestion" :disabled="isCurrentSubmitted || !hasCurrentAnswer">
              {{ isCurrentSubmitted ? 'Submitted' : 'Submit' }}
            </button>
            <p class="answer" v-if="isCurrentSubmitted">Correct answer: {{ currentAnswerDisplay }}</p>
            <button
              class="ai-button"
              v-if="isCurrentSubmitted"
              @click="fetchAiExplanation"
              :disabled="isCurrentExplanationLoading"
            >
              {{ isCurrentExplanationLoading ? 'Loading AI...' : 'AI Explanation' }}
            </button>
          </div>
          <div class="question-actions">
            <button class="chip" @click="prevQuestion" :disabled="currentQuestionIdx === 0">Prev</button>
            <button class="chip" @click="nextQuestion" :disabled="currentQuestionIdx === currentExam.questions.length - 1">Next</button>
          </div>
        </div>

        <div class="ai-explanation" v-if="isCurrentSubmitted && (currentExplanation || currentExplanationError)">
          <div class="ai-explanation-header">
            <strong>AI Explanation</strong>
            <span v-if="currentExplanationMeta">{{ currentExplanationMeta }}</span>
          </div>
          <div class="ai-explanation-body" v-if="currentExplanationHtml" v-html="currentExplanationHtml"></div>
          <p v-else-if="currentExplanation">{{ currentExplanation }}</p>
          <p class="ai-error" v-else>{{ currentExplanationError }}</p>
        </div>
      </section>

      <section class="navigator">
        <button
          v-for="(question, idx) in currentExam.questions"
          :key="`${question.number}-${idx}`"
          class="nav-item"
          :class="navClass(idx, question.number)"
          @click="currentQuestionIdx = idx"
        >
          <span>{{ idx + 1 }}</span>
        </button>
      </section>
    </main>

    <main class="content" v-else>
      <p>Loading exams...</p>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'

const COOKIE_KEY = 'aws_mcq_dashboard_state_v3'
const CLOUDFLARE_API_ORIGIN = 'https://aws-cloud-practitioner-exam-prep.pages.dev'
const OPTION_DISPLAY_KEYS = ['A', 'B', 'C', 'D', 'E']

const exams = ref([])
const rawExams = ref([])
const selectedExamIndex = ref(0)
const currentQuestionIdx = ref(0)
const answersByExam = ref({})
const submittedByExam = ref({})
const questionOrderByExam = ref({})
const optionOrderByExam = ref({})
const explanationsByQuestion = ref({})
const explanationStatusByQuestion = ref({})

const currentExam = computed(() => exams.value[selectedExamIndex.value])
const currentQuestion = computed(() => currentExam.value?.questions[currentQuestionIdx.value])

const currentExamKey = computed(() => currentExam.value?.source_file || '')
const currentQuestionKey = computed(() => {
  if (!currentExamKey.value || !currentQuestion.value) return ''
  return `${currentExamKey.value}:${currentQuestion.value.number}`
})
const selectedAnswers = computed(() => {
  if (!currentExamKey.value) return {}
  return answersByExam.value[currentExamKey.value] || {}
})
const submittedMap = computed(() => {
  if (!currentExamKey.value) return {}
  return submittedByExam.value[currentExamKey.value] || {}
})
const isCurrentSubmitted = computed(() => Boolean(submittedMap.value[currentQuestion.value?.number]))
const hasCurrentAnswer = computed(() => {
  if (!currentQuestion.value) return false
  return (selectedAnswers.value[currentQuestion.value.number] || []).length > 0
})
const currentExplanationState = computed(() => {
  if (!currentQuestionKey.value) return null
  return explanationsByQuestion.value[currentQuestionKey.value] || null
})
const currentExplanation = computed(() => currentExplanationState.value?.structuredExplanation?.summary || currentExplanationState.value?.explanation || '')
const currentExplanationHtml = computed(() => {
  if (!currentQuestion.value || !currentExplanationState.value) return ''
  return renderStructuredExplanation(currentQuestion.value, currentExplanationState.value.structuredExplanation)
    || currentExplanationState.value.explanationHtml
    || ''
})
const currentExplanationMeta = computed(() => {
  if (!currentExplanationState.value) return ''
  return currentExplanationState.value.cached ? 'Cached' : 'Generated'
})
const currentExplanationError = computed(() => {
  if (!currentQuestionKey.value) return ''
  return explanationStatusByQuestion.value[currentQuestionKey.value]?.error || ''
})
const isCurrentExplanationLoading = computed(() => {
  if (!currentQuestionKey.value) return false
  return Boolean(explanationStatusByQuestion.value[currentQuestionKey.value]?.loading)
})
const currentAnswerDisplay = computed(() => {
  if (!currentQuestion.value) return ''
  return getDisplayAnswers(currentQuestion.value, currentQuestion.value.answer).join(', ')
})

const answeredCount = computed(() => {
  return Object.values(selectedAnswers.value).filter((v) => Array.isArray(v) && v.length > 0).length
})

const correctCount = computed(() => {
  if (!currentExam.value) return 0
  let correct = 0
  for (const q of currentExam.value.questions) {
    const picked = selectedAnswers.value[q.number] || []
    const sortedPicked = [...picked].sort().join(',')
    const sortedAnswer = [...q.answer].sort().join(',')
    if (sortedPicked && sortedPicked === sortedAnswer) correct += 1
  }
  return correct
})
const incorrectCount = computed(() => {
  if (!currentExam.value) return 0
  let incorrect = 0
  for (const q of currentExam.value.questions) {
    if (!isQuestionSubmitted(q.number)) continue
    if (!isQuestionCorrect(q.number)) incorrect += 1
  }
  return incorrect
})

const scorePercent = computed(() => {
  if (!currentExam.value) return 0
  return Math.round((correctCount.value / currentExam.value.questions.length) * 100)
})

const progressPercent = computed(() => {
  if (!currentExam.value) return 0
  return Math.round((answeredCount.value / currentExam.value.questions.length) * 100)
})

function getAiExplanationApiUrl() {
  if (window.location.hostname.endsWith('github.io')) {
    return `${CLOUDFLARE_API_ORIGIN}/api/explain`
  }
  return '/api/explain'
}

function getCookie(name) {
  const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const matches = document.cookie.match(new RegExp(`(?:^|; )${escapeRegExp(name)}=([^;]*)`))
  return matches ? decodeURIComponent(matches[1]) : null
}

function setCookie(name, value, days = 365) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`
}

function saveState() {
  const payload = {
    selectedExamIndex: selectedExamIndex.value,
    currentQuestionIdx: currentQuestionIdx.value,
    answersByExam: answersByExam.value,
    submittedByExam: submittedByExam.value,
    questionOrderByExam: questionOrderByExam.value,
    optionOrderByExam: optionOrderByExam.value,
  }
  setCookie(COOKIE_KEY, JSON.stringify(payload))
}

function loadState() {
  const raw = getCookie(COOKIE_KEY)
  if (!raw) return
  try {
    const parsed = JSON.parse(raw)
    selectedExamIndex.value = parsed.selectedExamIndex || 0
    currentQuestionIdx.value = parsed.currentQuestionIdx || 0
    answersByExam.value = parsed.answersByExam || {}
    submittedByExam.value = parsed.submittedByExam || {}
    questionOrderByExam.value = parsed.questionOrderByExam || {}
    optionOrderByExam.value = parsed.optionOrderByExam || {}
  } catch {
    // Ignore malformed cookie
  }
}

function shuffleQuestions(questions) {
  const shuffled = [...questions]
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const current = shuffled[i]
    shuffled[i] = shuffled[j]
    shuffled[j] = current
  }
  return shuffled
}

function shuffleOptions(options) {
  const shuffled = [...options]
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const current = shuffled[i]
    shuffled[i] = shuffled[j]
    shuffled[j] = current
  }

  return shuffled
}

function isValidQuestionOrder(exam, order) {
  if (!Array.isArray(order) || order.length !== exam.questions.length) return false
  const questionNumbers = new Set(exam.questions.map((q) => q.number))
  return order.every((number) => questionNumbers.has(number)) && new Set(order).size === order.length
}

function isValidOptionOrder(question, order) {
  if (!Array.isArray(order) || order.length !== question.options.length) return false
  const optionIds = new Set(question.options.map((option) => option.id))
  return order.every((id) => optionIds.has(id)) && new Set(order).size === order.length
}

function isValidExamOptionOrder(exam, orderByQuestion) {
  if (!orderByQuestion || typeof orderByQuestion !== 'object') return false
  return exam.questions.every((question) => isValidOptionOrder(question, orderByQuestion[question.number]))
}

function createExamOptionOrder(exam) {
  return Object.fromEntries(
    exam.questions.map((question) => [
      question.number,
      shuffleOptions(question.options).map((option) => option.id),
    ]),
  )
}

function applyOptionOrder(question, order) {
  const optionMap = new Map(question.options.map((option) => [option.id, option]))
  return {
    ...question,
    options: order.map((id, index) => ({
      ...optionMap.get(id),
      displayKey: OPTION_DISPLAY_KEYS[index] || String(index + 1),
    })),
  }
}

function applyQuestionOrder(exam, questionOrder, optionOrder) {
  const questionMap = new Map(exam.questions.map((question) => [question.number, question]))
  return {
    ...exam,
    questions: questionOrder
      .map((number) => questionMap.get(number))
      .filter(Boolean)
      .map((question) => applyOptionOrder(question, optionOrder[question.number])),
  }
}

function ensureExamQuestionOrder(examIndex, forceNewOrder = false) {
  const exam = rawExams.value[examIndex]
  if (!exam) return

  const examKey = exam.source_file
  const storedOrder = questionOrderByExam.value[examKey]
  const storedOptionOrder = optionOrderByExam.value[examKey]
  const shouldCreateOrder = forceNewOrder || !isValidQuestionOrder(exam, storedOrder)
  const shouldCreateOptionOrder = forceNewOrder || !isValidExamOptionOrder(exam, storedOptionOrder)
  const order = shouldCreateOrder ? shuffleQuestions(exam.questions).map((question) => question.number) : storedOrder
  const optionOrder = shouldCreateOptionOrder ? createExamOptionOrder(exam) : storedOptionOrder

  if (shouldCreateOrder) {
    questionOrderByExam.value = {
      ...questionOrderByExam.value,
      [examKey]: order,
    }
  }

  if (shouldCreateOptionOrder) {
    optionOrderByExam.value = {
      ...optionOrderByExam.value,
      [examKey]: optionOrder,
    }
  }

  const orderedExam = applyQuestionOrder(exam, order, optionOrder)
  exams.value = exams.value.map((item, idx) => (idx === examIndex ? orderedExam : item))
}

function hasSavedAnswers(examKey) {
  const answers = answersByExam.value[examKey]
  if (!answers) return false
  return Object.values(answers).some((value) => Array.isArray(value) && value.length > 0)
}

function toggleAnswer(optionId) {
  if (isCurrentSubmitted.value) return
  const qNum = currentQuestion.value.number
  const map = { ...selectedAnswers.value }
  const existing = map[qNum] || []

  if (currentQuestion.value.answer.length > 1) {
    map[qNum] = existing.includes(optionId)
      ? existing.filter((id) => id !== optionId)
      : [...existing, optionId].sort()
  } else {
    map[qNum] = [optionId]
  }

  answersByExam.value = {
    ...answersByExam.value,
    [currentExamKey.value]: map,
  }
}

function optionClass(optionId) {
  const picked = selectedAnswers.value[currentQuestion.value.number] || []
  const isSelected = picked.includes(optionId)
  const isCorrect = currentQuestion.value.answer.includes(optionId)

  return {
    selected: isSelected,
    correct: isCurrentSubmitted.value && isCorrect,
    wrong: isCurrentSubmitted.value && isSelected && !isCorrect,
  }
}

function getDisplayAnswers(question, answerIds) {
  return answerIds
    .map((answerId) => question.options.find((option) => option.id === answerId)?.displayKey)
    .filter(Boolean)
    .sort((a, b) => OPTION_DISPLAY_KEYS.indexOf(a) - OPTION_DISPLAY_KEYS.indexOf(b))
}

function getAiOptions(question) {
  return question.options.map((option) => ({
    id: option.id,
    text: option.text,
  }))
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderStructuredExplanation(question, structuredExplanation) {
  if (!structuredExplanation || typeof structuredExplanation !== 'object') return ''
  const summary = escapeHtml(structuredExplanation.summary)
  const optionExplanations = structuredExplanation.optionExplanations || {}
  const items = question.options
    .map((option) => {
      const reason = optionExplanations[option.id]
      if (!reason) return ''
      return `<li><strong>${escapeHtml(option.displayKey)}.</strong> ${escapeHtml(reason)}</li>`
    })
    .filter(Boolean)
    .join('')

  if (!summary && !items) return ''
  return `${summary ? `<p>${summary}</p>` : ''}${items ? `<ul>${items}</ul>` : ''}`
}

function navClass(idx, qNum) {
  const answered = (selectedAnswers.value[qNum] || []).length > 0
  const submitted = isQuestionSubmitted(qNum)
  return {
    active: idx === currentQuestionIdx.value,
    done: answered,
    right: submitted && isQuestionCorrect(qNum),
    wrong: submitted && !isQuestionCorrect(qNum),
  }
}

function nextQuestion() {
  if (!currentExam.value) return
  if (currentQuestionIdx.value < currentExam.value.questions.length - 1) {
    currentQuestionIdx.value += 1
  }
}

function prevQuestion() {
  if (currentQuestionIdx.value > 0) {
    currentQuestionIdx.value -= 1
  }
}

function jumpToUnanswered() {
  if (!currentExam.value) return
  const idx = currentExam.value.questions.findIndex((q) => (selectedAnswers.value[q.number] || []).length === 0)
  if (idx >= 0) {
    currentQuestionIdx.value = idx
  }
}

function submitCurrentQuestion() {
  if (!currentQuestion.value || !hasCurrentAnswer.value || isCurrentSubmitted.value) return
  const qNum = currentQuestion.value.number
  submittedByExam.value = {
    ...submittedByExam.value,
    [currentExamKey.value]: {
      ...submittedMap.value,
      [qNum]: true,
    },
  }
}

async function fetchAiExplanation() {
  if (!currentExam.value || !currentQuestion.value || !isCurrentSubmitted.value || !currentQuestionKey.value) return
  if (currentExplanation.value || isCurrentExplanationLoading.value) return

  const questionKey = currentQuestionKey.value
  explanationStatusByQuestion.value = {
    ...explanationStatusByQuestion.value,
    [questionKey]: { loading: true, error: '' },
  }

  try {
    const response = await fetch(getAiExplanationApiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        schemaVersion: 2,
        examTitle: currentExam.value.title,
        sourceFile: currentExam.value.source_file,
        questionNumber: currentQuestion.value.number,
        question: currentQuestion.value.question,
        options: getAiOptions(currentQuestion.value),
        selectedAnswerIds: selectedAnswers.value[currentQuestion.value.number] || [],
        correctAnswerIds: currentQuestion.value.answer,
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'Unable to load AI explanation.')
    }

    explanationsByQuestion.value = {
      ...explanationsByQuestion.value,
      [questionKey]: {
        structuredExplanation: data.structuredExplanation,
        explanation: data.explanation,
        explanationHtml: data.explanationHtml,
        cached: Boolean(data.cached),
        model: data.model,
        createdAt: data.createdAt,
      },
    }
    explanationStatusByQuestion.value = {
      ...explanationStatusByQuestion.value,
      [questionKey]: { loading: false, error: '' },
    }
  } catch (error) {
    explanationStatusByQuestion.value = {
      ...explanationStatusByQuestion.value,
      [questionKey]: {
        loading: false,
        error: error.message || 'Unable to load AI explanation.',
      },
    }
  }
}

function isQuestionSubmitted(qNum) {
  return Boolean(submittedMap.value[qNum])
}

function isQuestionCorrect(qNum) {
  const q = currentExam.value?.questions.find((item) => item.number === qNum)
  if (!q) return false
  const picked = selectedAnswers.value[qNum] || []
  return [...picked].sort().join(',') === [...q.answer].sort().join(',')
}

function resetCurrentExam() {
  if (!currentExamKey.value) return
  const nextQuestionOrderByExam = { ...questionOrderByExam.value }
  const nextOptionOrderByExam = { ...optionOrderByExam.value }
  delete nextQuestionOrderByExam[currentExamKey.value]
  delete nextOptionOrderByExam[currentExamKey.value]

  questionOrderByExam.value = nextQuestionOrderByExam
  optionOrderByExam.value = nextOptionOrderByExam
  answersByExam.value = {
    ...answersByExam.value,
    [currentExamKey.value]: {},
  }
  submittedByExam.value = {
    ...submittedByExam.value,
    [currentExamKey.value]: {},
  }
  currentQuestionIdx.value = 0
  ensureExamQuestionOrder(selectedExamIndex.value, true)
}

watch([selectedExamIndex, currentQuestionIdx, answersByExam, submittedByExam, questionOrderByExam, optionOrderByExam], saveState, { deep: true })

watch(selectedExamIndex, () => {
  currentQuestionIdx.value = 0
  const examKey = rawExams.value[selectedExamIndex.value]?.source_file
  ensureExamQuestionOrder(selectedExamIndex.value, examKey ? !hasSavedAnswers(examKey) : false)
})

onMounted(async () => {
  loadState()
  const res = await fetch(`${import.meta.env.BASE_URL}practice-exams-v2.json`)
  const loadedExams = await res.json()
  rawExams.value = loadedExams
  exams.value = loadedExams

  if (selectedExamIndex.value > exams.value.length - 1) {
    selectedExamIndex.value = 0
  }

  const examKey = rawExams.value[selectedExamIndex.value]?.source_file
  ensureExamQuestionOrder(selectedExamIndex.value, examKey ? !hasSavedAnswers(examKey) : false)

  const maxIdx = (currentExam.value?.questions.length || 1) - 1
  if (currentQuestionIdx.value > maxIdx) {
    currentQuestionIdx.value = 0
  }
})
</script>
