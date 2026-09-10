# Working on Intentcraft

- Write concise Chinese user-facing instructions; keep names and protocol keys stable.
- Maintain two user-invoked skills, not an automatic lifecycle engine.
- Both `SKILL.md` files must retain `disable-model-invocation: true` and an
  explicit activation boundary. Do not add automatic hooks or startup prompts.
- Research, discussion, requirements, and planning belong to `intentcraft`;
  independent read-only document review belongs to `intentcraft-review`.
- Simple work skips unnecessary stages. Backend/CLI/library work does not
  acquire UI, browser, or prototype requirements merely by using this package.
- Keep each skill independently installable: runtime references must stay
  inside its own directory. Do not assume a sibling skill is installed.
- A static text check is not a behavioral evaluation or a runtime safety gate.
  Report exactly what was checked and what remains unverified.
- Use `npm test`, `npm pack --dry-run --json`, and `git diff --check` before
  delivery. Update `tests/scenarios.md` when a behavioral boundary changes.
- Never stage or publish `example/`, `.pi/`, credentials, or session artifacts.
- Prefer original prose and existing host tools over copied frameworks,
  new dependencies, custom orchestration, and fixed agent fleets.
