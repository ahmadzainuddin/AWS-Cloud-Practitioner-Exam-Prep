# Changelog

All notable changes to this project are documented in this file.

The format follows a practical changelog style, with the newest changes listed first.

## 2026-05-07

### Added

- Added `.gitignore` entries for generated build and dependency directories.
- Added `package-lock.json` to make dependency installation reproducible across local and GitHub Actions builds.

### Changed

- Cleaned the practice exam dataset by removing all questions with missing or empty `answer` arrays.
- Removed empty exams from the published dataset after unanswered questions were filtered out.
- Updated the dataset to publish only answerable exams.

### Fixed

- Fixed the issue where `Practice Exam 13` displayed every question as question `1` by removing the affected unanswered exam data from the published dataset.
- Fixed the issue where `Practice Exam 14` and later displayed an empty `Correct answer:` value after submission.
- Fixed the dropdown showing exams that had no remaining answerable questions.

### Verified

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
