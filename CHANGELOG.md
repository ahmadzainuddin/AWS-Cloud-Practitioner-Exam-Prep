# Changelog

All notable changes to this project are documented in this file.

The format follows a practical changelog style, with the newest changes listed first.

## 2026-05-19

### Added

- Added schema v2 exam data with stable option IDs for safe option randomization.
- Added ID-based AI explanation payloads and structured explanation responses.
- Added backend validation that only allows explanation requests matching `public/practice-exams-v2.json`.
- Added support for local Flutter web previews and native mobile requests to call the Cloudflare explanation API.

### Changed

- Randomized both question order and option order while keeping answer validation tied to stable option IDs.
- Moved the public Vue app into its own repository folder and kept Flutter in a separate private repository.
- Updated deployment workflow after making the Vue folder the repository root.
- Updated AI explanation cache namespace to `explanations/v5/...`.

### Fixed

- Fixed AI explanations so displayed `A-E` labels can rotate without corrupting correct answer labels.
- Fixed abuse risk where arbitrary external questions could be sent to the AI explanation API.
- Fixed CORS handling so browser origins stay restricted while native mobile requests without `Origin` can work.

### Verified

- Confirmed `npm run build` completes successfully after the repository restructure.
- Confirmed `functions/api/explain.js` passes `node --check`.

## 2026-05-07

### Added

- Added on-demand AI explanation support after answer submission.
- Added Cloudflare Pages Function endpoint at `/api/explain`.
- Added Cloudflare R2 explanation cache so each question explanation can be generated once and reused.
- Added local Cloudflare Pages dev script with mock AI mode.
- Added `.gitignore` entries for generated build and dependency directories.
- Added `package-lock.json` to make dependency installation reproducible across local and GitHub Actions builds.
- Added dashboard screenshot under `docs/screenshots/`.
- Added dashboard screenshot preview in `README.md`.
- Added cookie-saved randomized question ordering per exam.

### Changed

- Cleaned the practice exam dataset by removing all questions with missing or empty `answer` arrays.
- Removed empty exams from the published dataset after unanswered questions were filtered out.
- Updated the dataset to publish only answerable exams.
- Updated the question header and navigator to show sorted session positions while question content is randomized behind those positions.

### Fixed

- Fixed the issue where `Practice Exam 13` displayed every question as question `1` by removing the affected unanswered exam data from the published dataset.
- Fixed the issue where `Practice Exam 14` and later displayed an empty `Correct answer:` value after submission.
- Fixed the dropdown showing exams that had no remaining answerable questions.

### Verified

- Confirmed local AI explanation endpoint returns `cached:false` on first request and `cached:true` on repeated requests.
- Confirmed the AI explanation UI appears only after answer submission.
- Confirmed both JSON files are valid.
- Confirmed the published dataset contains:
  - 12 exams
  - 591 questions
  - 0 questions with empty answers
  - 0 empty exams
- Confirmed `npm run build` completes successfully.
- Confirmed GitHub Pages deployment completes successfully.

## Initial Release

### Added

- Added Vue MCQ dashboard.
- Added exam selector.
- Added answer selection and submission flow.
- Added correct and incorrect answer highlighting.
- Added score and progress tracking.
- Added cookie-based local progress persistence.
- Added GitHub Pages deployment workflow.
