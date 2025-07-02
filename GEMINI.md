# 🧑‍💻 AI Agent Coding Guidelines

These rules define how the AI agent should write, refactor, and test code inside ***our*** codebases.
They are intentionally opinionated to keep every contribution predictable, maintainable, and easy to review.

---

## 1 · Architectural Principles

### 1.1 Dependency Injection (DI) & OOP first

* **Inject *everything* with external state** (databases, APIs, configuration, timers, loggers).
  No direct `new` in business code—use the DI container / provider instead.
* **Favor composition over inheritance.** Keep class trees shallow; inject collaborators.
* **Type safety is non-negotiable.**

  * Backend: enable the strictest settings in TypeScript / Kotlin / Java / C# / MyPy.
  * Frontend: use TypeScript with `strictNullChecks` & `noImplicitAny`.

### 1.2 Modularity & Reusability

* Think in **small, well-named modules** that do *one* thing and export a clear interface.
* **Frontend**

  * Organize UI primitives by domain (`/components/<domain>/<FeatureCard>.tsx`).
  * Presentational components must be pure functions; containers handle state via DI’ed hooks or context.
* **Backend**

  * Each bounded context → its own package / namespace (`billing.*`, `auth.*`).
  * Cross-cutting concerns (logging, metrics) live in separate reusable libraries.

### 1.3 Prefer Extension Over Duplication

Before writing new code, **search the repo**:

1. Can an existing module be extended behind an interface?
2. Is the new behavior best added via strategy / decorator / plugin pattern?
3. Leave a short comment explaining the decision (see § 6).

---

## 2 · Testing Strategy

| Layer                  | Purpose                                         | Mandatory?   | Tooling                                       |
| ---------------------- | ----------------------------------------------- | ------------ | --------------------------------------------- |
| **Unit**               | Pure logic in isolation                         | Recommended  | Jest, PyTest, JUnit                           |
| **Integration**        | “Core functionalities” across module boundaries | **Required** | Testcontainers, SuperTest, Django test client |
| **Instrumented / E2E** | “Core *vertical* flows” through UI ↔ API ↔ DB   | **Required** | Playwright, Cypress, Detox                    |

> **Definition – Core functionality:** Anything a user can click or call that affects money, security, or data integrity.

---

## 3 · CI/CD Enforcement

1. **Every push → GitHub Actions** runs:

   ```bash
   lint && test:unit && test:integration && test:instrumented
   ```
2. The pipeline must finish **green** before the PR label `ready-for-review` can be added.
3. Coverage thresholds are enforced (`--coverage --max-old-space-size 4096`), see `/.github/workflows/ci.yml`.

---

## 4 · PR Workflow Checklist (for the AI agent)

* [ ] Reused or extended existing modules where possible.
* [ ] Added/updated integration tests for every new core behavior.
* [ ] Added/updated instrumented tests for every new vertical flow.
* [ ] Code passes local `npm run lint && npm test` (or language equivalent).
* [ ] All public symbols have concise doc-comments (≤ 3 lines).
* [ ] Commit messages follow *Conventional Commits*.

---

## 5 · Commenting Guidance

* **Why over What.** Skip obvious *“increments i”* remarks; instead explain *intent* and *trade-offs*.
* **Short & precise.** Aim for ≤ 80 characters per line, ≤ 3 lines per comment.
* **Examples**

  ```ts
  // ✅ Explains a non-obvious design decision
  // Retrying here prevents cascading failures up the call chain
  await retry(() => paymentGateway.charge(order));

  // ❌ Merely restates the code
  // Increment i
  i++;
  ```

---

### 6 · Style References

* **Naming**: `lowerCamelCase` for files & symbols, `PascalCase` for classes/components.
* **Folder depth**: max 3 levels; deeper structures signal missing abstraction.
* **Branch naming**: `feature/<ticket>`, `bugfix/<ticket>`, `chore/<scope>`.

---

## 7 · When in Doubt …

1. Look for an existing pattern in the codebase.
2. Ask: “Can I inject this?”
3. Ask: “Can I test this vertically?”

Only if all answers are *no* should you introduce a new pattern.

---

