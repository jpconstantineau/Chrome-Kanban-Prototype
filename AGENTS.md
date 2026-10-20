# Project guidance

All browser application files belong in `docs/`. Keep the app vanilla HTML/CSS/JavaScript, with no backend or runtime dependencies.

- Use `.agents/skills/modern-web-guidance/SKILL.md` before frontend changes and `.agents/skills/ponytail/SKILL.md` for implementation scope.
- For UI design changes, read `.agents/skills/avoid-ai-design/SKILL.md` and its referenced catalog. Preserve the HMI theme required in `todo.md`.
- For interface copy, use `.agents/skills/avoid-ai-writing/SKILL.md` and its referenced pattern rules. Rewrite extracted prose, then integrate the approved wording with code-aware edits; do not run prose rewriting tools on source files.
- Keep storage keys, board data, archive semantics, keyboard controls, and AI confirmation behavior intact during presentation changes.
- Run `npm test` for logic changes and `npm run test:browser` for UI changes. The latter uses installed Chrome and writes screenshots under ignored `test-results/`.
- Run `node .agents/skills/avoid-ai-design/scripts/detect.mjs docs/` after a redesign. Review findings in context; the scanner does not resolve external stylesheets.
