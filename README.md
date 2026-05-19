<div align="center">

# AWS Cloud Practitioner Exam Prep

**Professional AWS Cloud Practitioner practice exam dashboard using Vue.js, Vite, and static JSON exam data.**

![Vue](https://img.shields.io/badge/Vue-3-42b883?style=for-the-badge&logo=vue.js&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646cff?style=for-the-badge&logo=vite&logoColor=white)
![GitHub Pages](https://img.shields.io/badge/GitHub-Pages-222222?style=for-the-badge&logo=github&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-8cc84b?style=for-the-badge)
![Responsive](https://img.shields.io/badge/Responsive-Dashboard-0f766e?style=for-the-badge)

[GitHub Pages](https://ahmadzainuddin.github.io/AWS-Cloud-Practitioner-Exam-Prep/) · [Cloudflare Pages](https://aws-cloud-practitioner-exam-prep.pages.dev/) · [Repository](https://github.com/ahmadzainuddin/AWS-Cloud-Practitioner-Exam-Prep)

</div>

## Overview

AWS Cloud Practitioner Exam Prep is a Vue-based practice exam dashboard for AWS Cloud Practitioner revision. The application serves multiple-choice exams from static JSON, tracks progress in the browser, and publishes automatically to GitHub Pages.

The dashboard is designed for focused exam practice. Users can select an exam, move between questions, submit answers, review the correct answer, request an AI explanation on demand, and track score and completion progress.

This repository contains the public Vue web application. The private Flutter mobile app is maintained separately at:

```text
https://github.com/ahmadzainuddin/AWS-Cloud-Practitioner-Exam-Prep-Flutter
```

## Screenshot

![AWS Cloud Practitioner Exam Prep dashboard](docs/screenshots/aws-cloud-practitioner-dashboard.png)

## Disclaimer

This project is an educational practice tool created for AWS Cloud Practitioner exam revision. It is not an official AWS product, training platform, certification provider, or exam simulator.

AWS, AWS Cloud Practitioner, and related service names are trademarks of Amazon Web Services, Inc. or its affiliates. The questions and explanations in this project should be used as study support only. Users should always refer to official AWS documentation, AWS Skill Builder, and the latest certification exam guide for authoritative information.

## Dataset

Current dataset:

- 12 practice exams
- 591 answerable questions
- 0 questions with empty answer arrays
- Exams without answerable questions have been removed from the published dataset

## Features

- Exam selector for available practice exams
- Randomized question and option order saved per exam in browser cookies
- Question navigation with previous and next controls
- Single-answer and multi-answer question support
- Correct and incorrect answer highlighting after submission
- On-demand AI explanation button after answer submission
- Cloudflare R2 explanation cache so each question is generated once and reused
- Per-exam score, answered count, correct count, and incorrect count
- Question navigator showing answered, correct, and incorrect status
- Cookie-based progress persistence
- Static deployment through GitHub Pages

## Tech Stack

- Vue 3
- Vite
- JavaScript
- CSS
- Cloudflare Pages Functions
- Cloudflare R2
- OpenAI Responses API
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

Run the Cloudflare Pages local server with mock AI and local R2:

```bash
npm run build
npm run pages:dev
```

The local Pages server runs the Vue build and `/api/explain` function together. Mock mode is enabled by the `pages:dev` script so local testing does not call OpenAI.

## AI Explanation

AI explanation is only requested after a user submits an answer and clicks the `AI Explanation` button. The frontend sends the current question, options, and correct answer to:

```text
/api/explain
```

The Cloudflare Pages Function validates the submitted payload against `public/practice-exams-v2.json` before checking R2 or calling OpenAI. Requests for questions outside the approved dataset are rejected, which prevents arbitrary external questions from using the explanation API.

After validation, the function checks R2 first. If an explanation JSON already exists for the question hash, it returns the cached explanation. If not, it calls the OpenAI Responses API once, stores the generated explanation in R2, and returns it to the user.

Structured explanation objects are stored under:

```text
explanations/v5/{source_file}/question-{number}-{hash}.json
```

The current prompt writes ID-based structured explanations under `explanations/v5/...`. The hash ignores shuffled A-E order, so one cached explanation can be reused across different option rotations. The frontend adds the final correct/incorrect labels from the known answer IDs, while AI only supplies neutral option reasoning. Older `explanations/{source_file}/...`, `explanations/v2/...`, `explanations/v3/...`, and `explanations/v4/...` caches remain in R2 for previous payload formats.

R2 binding:

```text
AI_EXPLANATIONS
```

Required Cloudflare secret:

```text
OPENAI_API_KEY
```

Optional Cloudflare variable:

```text
OPENAI_MODEL=gpt-4.1-mini
```

The API key must be configured as a Cloudflare secret and must never be committed to GitHub or exposed through `VITE_*` frontend variables.

GitHub Pages builds can still use the AI feature by calling the Cloudflare Pages API fallback:

```text
https://aws-cloud-practitioner-exam-prep.pages.dev/api/explain
```

## Data Source

The application loads exam data from:

```text
public/practice-exams.json
public/practice-exams-v2.json
```

`practice-exams-v2.json` is the runtime data source for the app. Vite serves it as a public static asset at runtime.

Each exam uses this structure:

```json
{
  "schema_version": 2,
  "source_file": "practice-exam-1.md",
  "title": "Practice Exam 1",
  "question_count": 50,
  "questions": [
    {
      "number": 1,
      "question": "Question text",
      "select": 1,
      "options": [
        { "id": "option_a", "text": "Option A" },
        { "id": "option_b", "text": "Option B" }
      ],
      "answer": ["option_a"]
    }
  ]
}
```

Data quality rules:

- `questions` must not be empty for any published exam.
- Every question must have a non-empty `answer` array.
- `answer` values must match option IDs.
- Multi-answer questions should use multiple IDs, for example `["opsworks", "codedeploy"]`.
- `select` must match the final `answer.length`.
- `question_count` must match the final `questions.length`.

## Progress Storage

Progress is stored in a browser cookie named:

```text
aws_mcq_dashboard_state_v3
```

The cookie stores selected exam index, current question index, selected answers, submitted questions, randomized question order, and randomized option order per exam. It is scoped to the site path and expires after one year. AI explanations are not stored in the browser cookie; shared explanations are cached in Cloudflare R2.

When an exam is opened for the first time and no saved order exists, the app reads questions from `public/practice-exams-v2.json`, randomizes the question order and each question's option order, then saves those orders in the cookie. If the orders already exist, the app reuses them instead of randomizing again. Resetting an exam clears that exam's saved orders and creates fresh randomized sequences.

The question navigator always displays sorted session positions, such as `1` to `50`, while the underlying question content is randomized behind those positions. Option labels `A` to `E` are generated at runtime from stable option IDs, so the app can shuffle display order without changing the answer data.

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

For Cloudflare Pages, configure the project as a Vue/Vite app:

```text
Build command: npm run build
Build output directory: dist
```

If deploying from a parent workspace that contains both `vue/` and `flutter/`, set the Cloudflare Pages root directory to:

```text
vue
```

## Maintenance Notes

- Do not commit `node_modules/` or `dist/`; both are ignored.
- Do not commit `.dev.vars`, `.env`, or local Wrangler state.
- Keep `package-lock.json` committed for reproducible dependency installs.
- Validate data changes with `npm run build` before publishing.
- Validate AI explanation changes locally with `npm run pages:dev`.
- If new exam data is imported from Markdown, verify that numbered lists and `Correct Answer:` blocks are parsed correctly before replacing JSON.

## Author

Developed by Ahmad Zainuddin.

BSc (Hons) Information Technology candidate at Malaysia University of Science and Technology (MUST), with interests in data science, cloud computing, fintech systems, and financial analytics.

This project demonstrates a browser-based AWS Cloud Practitioner practice exam dashboard using Vue.js, Vite, static JSON datasets, cookie-based progress tracking, and GitHub Pages deployment.

Areas of interest: financial analytics, cloud computing, fintech systems, data visualization, and AI-assisted applications.

Relevant coursework:

- Data Science
- Business Analytics & Artificial Intelligence
- Applied Statistics
- Object-Oriented Analysis & Design
- System Analysis and Design
- Software Engineering
- Data Structures & Algorithms

GitHub: [@ahmadzainuddin](https://github.com/ahmadzainuddin)

Email: [zainuddin@codemaster.my](mailto:zainuddin@codemaster.my)

Project: AWS Cloud Practitioner Exam Prep

Live Demo: [aws-cloud-practitioner-exam-prep.pages.dev](https://aws-cloud-practitioner-exam-prep.pages.dev/)

GitHub Pages: [ahmadzainuddin.github.io/AWS-Cloud-Practitioner-Exam-Prep](https://ahmadzainuddin.github.io/AWS-Cloud-Practitioner-Exam-Prep/)

## License

This project is licensed under the MIT License.
