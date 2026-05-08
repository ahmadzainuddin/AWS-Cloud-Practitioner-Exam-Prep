# Project Structure

This document describes the repository layout and the role of each important file.

## Root Files

```text
.
├── .github/
├── .gitignore
├── CHANGELOG.md
├── CONTRIBUTING.md
├── docs/
├── functions/
├── LICENSE
├── PROJECT_STRUCTURE.md
├── README.md
├── index.html
├── package-lock.json
├── package.json
├── public/
├── src/
├── vite.config.js
└── wrangler.toml
```

## Application Entry Points

### `index.html`

The Vite HTML entry point. It loads the Vue application from `src/main.js`.

### `src/main.js`

Creates and mounts the Vue app:

```text
src/main.js
```

Responsibilities:

- Import Vue
- Import the root component
- Import global CSS
- Mount the app to `#app`

### `src/App.vue`

The main application component.

Responsibilities:

- Load `public/practice-exams.json` through Vite's public asset path
- Create or reuse cookie-saved randomized question order per exam
- Store selected exam and question state
- Render the sidebar, stats, question card, options, and navigator
- Track selected answers and submitted questions
- Request AI explanations only after the user submits an answer and clicks the explanation button
- Calculate correct, incorrect, score, and progress values
- Persist progress to a browser cookie

Key state:

- `exams`
- `selectedExamIndex`
- `currentQuestionIdx`
- `answersByExam`
- `submittedByExam`
- `explanationsByQuestion`
- `explanationStatusByQuestion`

Key computed values:

- `currentExam`
- `currentQuestion`
- `answeredCount`
- `correctCount`
- `incorrectCount`
- `scorePercent`
- `progressPercent`

### `src/style.css`

Global CSS for the dashboard.

Responsibilities:

- Sidebar layout
- Exam selector panels
- Question card styling
- Option button states
- Correct and incorrect answer highlighting
- Question navigator styling
- Responsive layout for narrower screens

## Data Files

### `public/practice-exams.json`

Runtime data source and the only maintained exam dataset. Vite serves this file as a public static asset, and the app fetches it with:

```js
fetch(`${import.meta.env.BASE_URL}practice-exams.json`)
```

This is the file used by the deployed GitHub Pages app.

## Documentation Assets

### `docs/screenshots/aws-cloud-practitioner-dashboard.png`

Dashboard screenshot used in `README.md`.

## Cloudflare Functions

### `functions/api/explain.js`

Cloudflare Pages Function for on-demand AI explanations.

Responsibilities:

- Validate question explanation requests
- Generate a stable hash from question text, options, and correct answer
- Check the `AI_EXPLANATIONS` R2 bucket before calling OpenAI
- Return cached explanations when available
- Call the OpenAI Responses API only when no cached explanation exists
- Store generated explanation JSON back into R2

R2 object key format:

```text
explanations/{source_file}/question-{number}-{hash}.json
```

## Configuration

### `package.json`

Defines project metadata, scripts, and dependencies.

Available scripts:

```bash
npm run dev
npm run build
npm run preview
npm run pages:dev
```

### `package-lock.json`

Locks dependency versions for reproducible installs locally and in GitHub Actions.

### `vite.config.js`

Vite configuration.

Important setting:

```js
base: '/AWS-Cloud-Practitioner-Exam-Prep/'
```

This base path is required for GitHub Pages deployment under the repository URL.

### `wrangler.toml`

Cloudflare Pages and R2 configuration for local Pages Function testing and Cloudflare deployment metadata.

Important binding:

```text
AI_EXPLANATIONS
```

## Deployment Files

### `.github/workflows/deploy.yml`

GitHub Actions workflow for GitHub Pages deployment.

Trigger:

- Push to `main`
- Manual `workflow_dispatch`

Build job:

- Checks out the repository
- Sets up Node.js 20
- Installs dependencies
- Runs `npm run build`
- Uploads the `dist/` artifact

Deploy job:

- Publishes the built artifact to GitHub Pages

## Generated Files

These directories are generated locally and should not be committed:

```text
node_modules/
dist/
.dev.vars*
.env*
.wrangler/
```

They are ignored by `.gitignore`.

## Data Flow

```text
public/practice-exams.json
        ↓
src/App.vue fetch on mount
        ↓
Create or reuse cookie-saved question order
        ↓
Vue reactive state
        ↓
Question UI, stats, navigator
        ↓
Cookie persistence
        ↓
User clicks AI Explanation after submission
        ↓
functions/api/explain.js
        ↓
Check Cloudflare R2 cache
        ↓
Return cached explanation or call OpenAI once
```

## Publishing Flow

```text
Commit to main
        ↓
GitHub Actions
        ↓
npm install
        ↓
npm run build
        ↓
Upload dist artifact
        ↓
Deploy to GitHub Pages
```
