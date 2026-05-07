# AWS Cloud Practitioner Exam Prep

A Vue-based practice exam dashboard for AWS Cloud Practitioner revision. The application serves multiple-choice exams from static JSON, tracks progress in the browser, and publishes automatically to GitHub Pages.

Live site: https://ahmadzainuddin.github.io/AWS-Cloud-Practitioner-Exam-Prep/

## Overview

The dashboard is designed for focused exam practice. Users can select an exam, move between questions, submit answers, review the correct answer, and track score and completion progress without needing a backend service.

Current dataset:

- 12 practice exams
- 591 answerable questions
- 0 questions with empty answer arrays
- Exams without answerable questions have been removed from the published dataset

## Features

- Exam selector for available practice exams
- Question navigation with previous and next controls
- Single-answer and multi-answer question support
- Correct and incorrect answer highlighting after submission
- Per-exam score, answered count, correct count, and incorrect count
- Question navigator showing answered, correct, and incorrect status
- Cookie-based progress persistence
- Static deployment through GitHub Pages

## Tech Stack

- Vue 3
- Vite
- JavaScript
- CSS
- GitHub Actions
- GitHub Pages

## Getting Started

Install dependencies:

```bash
npm install
```

Start the local development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Data Source

The application loads exam data from:

```text
public/practice-exams.json
```

A root copy is also kept at:

```text
practice-exams.json
```

Both files should stay synchronized because the root copy is useful for inspection and maintenance, while the public copy is served by Vite at runtime.

Each exam uses this structure:

```json
{
  "source_file": "practice-exam-1.md",
  "title": "Practice Exam 1",
  "question_count": 50,
  "questions": [
    {
      "number": 1,
      "question": "Question text",
      "options": [
        { "key": "A", "text": "Option A" },
        { "key": "B", "text": "Option B" }
      ],
      "answer": ["A"]
    }
  ]
}
```

Data quality rules:

- `questions` must not be empty for any published exam.
- Every question must have a non-empty `answer` array.
- `answer` values must match option keys.
- Multi-answer questions should use multiple keys, for example `["A", "D"]`.
- `question_count` must match the final `questions.length`.

## Progress Storage

Progress is stored in a browser cookie named:

```text
aws_mcq_dashboard_state
```

The cookie stores selected exam index, current question index, selected answers, and submitted questions. It is scoped to the site path and expires after one year.

## Deployment

Deployment is handled by GitHub Actions:

```text
.github/workflows/deploy.yml
```

The workflow runs on every push to `main` and performs:

1. Checkout
2. Node.js setup
3. Dependency installation
4. Production build
5. GitHub Pages artifact upload
6. GitHub Pages deployment

## Maintenance Notes

- Do not commit `node_modules/` or `dist/`; both are ignored.
- Keep `package-lock.json` committed for reproducible dependency installs.
- Validate data changes with `npm run build` before publishing.
- If new exam data is imported from Markdown, verify that numbered lists and `Correct Answer:` blocks are parsed correctly before replacing JSON.

