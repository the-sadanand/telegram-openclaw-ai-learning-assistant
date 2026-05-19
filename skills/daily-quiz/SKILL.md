# SKILL: Daily Tech Brief and Quiz Generation

## GOAL

Your goal is to generate a high-quality, **fully personalised** daily tech brief for a specific user and deliver it to them via Telegram. The brief must contain **exactly 5 interview questions** and **3 to 5 technical tidbits**. Every piece of content must be:
- Sourced from **fresh, real web content** discovered via `web_search` and `web_fetch`.
- Precisely calibrated to the user's **experience level**, **domains**, and **goals**.
- **Non-repetitive** — you must consult memory to avoid re-asking recent topics.

---

## CONTEXT

This skill is triggered automatically every evening at **9:00 PM** in the user's local timezone by the `nightly-tech-brief` cron job. You will be provided with the user's Telegram `user.id` in the job prompt. This process must be **fully autonomous** — do not ask the user for clarification or input.

---

## EXECUTION WORKFLOW

Follow these steps **in strict order**. Do not skip or reorder steps.

---

### Step 1 — Retrieve User Profile

Use the `memory_store` tool to **read** the user's profile using the key:

```
user_profile_{{user.id}}
```

Extract and internally store these fields:
- `domains` — list of technical interests
- `level` — experience level (junior / mid-level / senior / staff)
- `goals` — learning objectives
- `timezone` — IANA timezone (already used for scheduling; for reference only here)

If the profile does not exist, abort gracefully and send this message via Telegram:
> ⚠️ *I don't have a profile set up for you yet. Please send me a message to start the onboarding process!*

---

### Step 2 — Retrieve Recent Topics (Avoid Repetition)

Use the `memory_store` tool to **read** the recently used topics log:

```
recent_topics_{{user.id}}
```

This is a JSON array of topic strings from the **last 7 days**. Use it to ensure today's questions do not repeat recently covered subjects.

If the key does not exist, treat recent topics as an empty list `[]`.

---

### Step 3 — Web Search for Fresh Content

For **each domain** in the user's profile, perform **one targeted `web_search`**. Craft queries that:
- Use the domain name plus freshness indicators (e.g., "2025", "latest", "new", "best practices", "deep dive")
- Focus on tutorials, engineering blogs, release notes, or interview guides

**Example queries (adapt to actual domains):**
| Domain | Example Query |
|---|---|
| Go | `"golang concurrency patterns 2025"` |
| Distributed Systems | `"distributed systems consistency tradeoffs latest"` |
| PostgreSQL | `"postgresql performance tuning tips 2025"` |
| Machine Learning | `"LLM fine-tuning techniques recent"` |
| Frontend / React | `"react server components best practices 2025"` |
| Kubernetes | `"kubernetes production tips 2025"` |

For the **top 2–3 search results per domain**, use `web_fetch` to retrieve the actual article content. Do not rely solely on search snippets — the full content will produce far better tidbits and questions.

**Minimum search requirement:** At least **one `web_search` call per domain**. For users with 3+ domains, you may combine related domains into a single search if appropriate.

---

### Step 4 — Synthesise Technical Tidbits

Based on the fetched article content, synthesise **3 to 5 tidbits**. Each tidbit must:

- Be **concise** (2–4 sentences maximum)
- Contain a **genuinely interesting or actionable insight** — not generic filler
- Be written in **plain, accessible language** appropriate to the user's level
- Directly relate to one of the user's **domains**
- End with a short *"Why it matters"* or *"Pro tip"* line where relevant

**Level calibration:**
| Level | Tidbit style |
|---|---|
| Junior | Foundational concepts, "aha" moments, common gotchas |
| Mid-level | Patterns, trade-offs, tooling improvements |
| Senior | Architectural decisions, subtle edge cases, performance |
| Staff | System-wide impact, org-level patterns, emerging standards |

**Quality bar:** Each tidbit should be something the user would forward to a colleague or save for later.

---

### Step 5 — Generate Interview Questions

Generate **exactly 5 interview questions**. Apply the following rules rigorously:

#### 5a — Relevance
All questions must directly relate to the user's `domains`. Spread questions across domains where possible (don't ask 5 questions about one domain if the user listed three).

#### 5b — Difficulty Calibration
| Level | Question style |
|---|---|
| Junior | Definitions, basic usage, simple debugging, common patterns |
| Mid-level | Design trade-offs, moderate algorithms, framework internals |
| Senior | System design, performance bottlenecks, cross-cutting concerns |
| Staff | Organisational impact, multi-service architecture, RFC-level thinking |

#### 5c — Variety (Required Mix)
Include **at least one question from each of these four types**:
1. **Conceptual** — "Explain X", "What is the difference between X and Y?"
2. **Coding / Algorithmic** — A short problem or implementation task (specify language if the user listed one)
3. **System Design** — "How would you design X?", "How does Y scale?"
4. **Behavioural** — "Tell me about a time you...", "How do you approach X?"

The 5th question can be any type that feels most valuable.

#### 5d — Novelty
Cross-reference the `recent_topics_{{user.id}}` list. Do **not** ask questions on topics already covered in the last 7 days. If you must revisit a domain, choose a different angle or sub-topic.

---

### Step 6 — Update the Recent Topics Log

After generating the questions, extract the **core topic keywords** from each question (e.g., "goroutines", "CAP theorem", "binary search tree").

Use `memory_store` to **write** the updated recent topics list:
```
recent_topics_{{user.id}}
```

Keep only the **last 35 topics** (7 days × 5 questions). If the existing list has 35+ items, drop the oldest entries to stay within that limit.

---

### Step 7 — Assemble and Send the Telegram Message

Compose the final message using **Telegram Markdown formatting** (use `*bold*`, `_italic_`, `` `code` ``, and `---` separators). The message **must** follow this exact structure:

---

```
📚 *Your Daily Tech Brief — [Full Date, e.g. Monday, 14 July 2025]*

---

🎯 *Interview Questions*

*[Domain Label 1]*
*Q1.* [Question text]

*[Domain Label 2]*
*Q2.* [Question text]

*[Domain Label 3]*
*Q3.* [Question text]

*[Domain Label 4]*
*Q4.* [Question text]

*[Domain Label 5]*
*Q5.* [Question text]

---

💡 *Today's Tidbits*

*1.* [Tidbit title in bold] — [2–4 sentence insight. Pro tip / why it matters.]

*2.* [Tidbit title in bold] — [2–4 sentence insight.]

*3.* [Tidbit title in bold] — [2–4 sentence insight.]

*(Optional 4th and 5th tidbit if you found sufficiently good content)*

---

_Reply with any question number for a detailed answer, or send "more" for bonus questions!_ 💬
```

---

**Formatting rules:**
- Use `*text*` for bold headings and question labels.
- Use `_text_` for the footer instruction line.
- Use `` `code` `` for any inline code references in questions.
- Keep the message **mobile-friendly** — avoid excessively long lines.
- The total message length should be **under 4096 characters** (Telegram's limit). If it exceeds this, split into two messages: Part 1 = Questions, Part 2 = Tidbits.

---

## CONSTRAINTS

- ✅ This process is **fully autonomous** — never ask the user a question mid-execution.
- ✅ Always use `web_search` + `web_fetch` — never fabricate content from training data alone.
- ✅ Exactly **5 questions**, between **3 and 5 tidbits** — no more, no less.
- ✅ All content must be **accurate** — do not hallucinate APIs, functions, or statistics.
- ✅ The message **must** be sent via the Telegram channel.
- ❌ Do **not** include answers in the initial message — only questions.
- ❌ Do **not** repeat questions from the last 7 days (consult `recent_topics_{{user.id}}`).
- ❌ Do **not** deviate from the specified message format.
