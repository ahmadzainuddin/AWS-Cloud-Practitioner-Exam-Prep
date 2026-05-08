# Contributing

This project is a static Vue application backed by JSON exam data. Contributions should keep the application simple, reliable, and easy to publish through GitHub Pages.

## Development Workflow

1. Install dependencies:

```bash
npm install
```

2. Start the local development server:

```bash
npm run dev
```

3. For Cloudflare Pages Function work, build and run the local Pages server:

```bash
npm run build
npm run pages:dev
```

4. Make the change.

5. Validate the production build:

```bash
npm run build
```

6. Review the changed files:

```bash
git status --short
git diff --stat
```

7. Commit with a clear message.

## Commit Messages

Use concise commit messages that describe the change:

```text
fix: remove empty practice exams
chore: add npm lockfile and ignores
docs: add project documentation
```

Recommended prefixes:

- `fix:` for bug fixes
- `feat:` for user-facing features
- `docs:` for documentation changes
- `chore:` for repository maintenance
- `refactor:` for code restructuring without behavior changes

## Data Contribution Rules

Exam data is the most important part of this project. Before committing changes to `public/practice-exams.json`, verify the following:

- Both JSON files are valid.
- Both JSON files contain the same exam data.
- Every exam has at least one question.
- Every question has a non-empty `answer` array.
- Every answer key exists in the question options.
- `question_count` matches the number of questions in the exam.
- Question numbers are unique within an exam.
- Question numbers remain stable because the app uses them to track answers, submissions, and cookie-saved randomized order.

Useful validation command:

```bash
node -e "const fs=require('fs'); const f='public/practice-exams.json'; const exams=JSON.parse(fs.readFileSync(f,'utf8')); let questions=0, emptyAnswers=0, emptyExams=0; for (const exam of exams) { if (!exam.questions.length) emptyExams++; questions += exam.questions.length; for (const q of exam.questions) if (!Array.isArray(q.answer) || q.answer.length===0) emptyAnswers++; } console.log(f, { exams: exams.length, questions, emptyExams, emptyAnswers });"
```

## JSON Data Source

The app reads from:

```text
public/practice-exams.json
```

This file is the only maintained exam dataset. Do not add a duplicate root-level copy unless the project introduces a documented data generation workflow.

## UI Contribution Guidelines

- Preserve the app's focused exam-practice workflow.
- Keep navigation clear and predictable.
- Avoid adding backend dependencies unless there is a clear operational need.
- Keep generated files out of Git.
- Test narrow layout changes at desktop and mobile widths.

## AI Explanation Contribution Rules

- Never expose `OPENAI_API_KEY` in frontend code, `VITE_*` variables, screenshots, docs, or committed files.
- Store the production key as a Cloudflare secret.
- Keep AI explanation requests user-initiated after answer submission.
- Cache explanation output by stable question content, not by randomized session position.
- Keep generated explanations concise and exam-focused.
- Test cache behavior locally with mock mode before publishing.

## Deployment

Do not manually commit the `dist/` directory. GitHub Actions builds the app and publishes the generated artifact automatically on every push to `main`.

Deployment workflow:

```text
.github/workflows/deploy.yml
```

## Reporting Issues

When reporting a bug, include:

- Exam title
- Question number
- Expected behavior
- Actual behavior
- Screenshot if the issue is visual
- Browser and device information if relevant
