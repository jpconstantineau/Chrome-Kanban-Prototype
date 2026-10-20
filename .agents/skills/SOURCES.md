# Added skills

Installed into this repository on 2026-10-19 with the Codex skill installer. These are project skills, not global installations. Each skill includes its upstream resources and MIT license.

| Skill | Source revision | Upstream path |
| --- | --- | --- |
| avoid-ai-writing 3.38.0 | [conorbronsdon/avoid-ai-writing at 7009955](https://github.com/conorbronsdon/avoid-ai-writing/tree/7009955c3b41433e091ab46401dea033644bdeba) | `skills/avoid-ai-writing/` |
| avoid-ai-design 0.4.0 | [funboy322/avoid-ai-design at 2b7c718](https://github.com/funboy322/avoid-ai-design/tree/2b7c71836b06cdf6b3d73265b56490c1b75ad5aa) | Repository root |

The installed `SKILL.md` files match those revisions byte for byte. SHA-256:

```text
avoid-ai-writing af4be7fb7898d00a9fca25b54ffe6d0f123117989aa60732d1be7dc69fac0491
avoid-ai-design  8261a426b62a08bef43069e47ad7ffbad1aa86cd3f51b76a84217d14ce9b92f4
```

`avoid-ai-writing/package.json` sets `type: commonjs` so its bundled Node scripts run inside this repository's ES module package. Its license was copied from the upstream repository root, and trailing whitespace was removed from `detector/patterns.js`. The design scanner's regression test uses `fileURLToPath` to resolve its scanner path on Windows. The skill instructions, references, and runtime scanners are otherwise unchanged.
