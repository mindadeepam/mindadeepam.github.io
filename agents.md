# Agent Preferences

Use this as working guidance for future coding agents in this repo.

## Working Style

- Read the existing code and visual direction before changing structure.
- Prefer small, reversible edits over broad rewrites.
- Keep the site static and GitHub Pages friendly unless there is a clear need to move elsewhere.
- Preserve user-owned changes. Do not revert unrelated edits.
- Do not commit or push unless explicitly asked.
- When asked to push, commit the coherent current state with a plain commit message.

## Product Judgment

- Optimize the site for AI Engineer, ML Engineer, and Data Scientist II hiring screens.
- Make copy resume-ready, public-safe, and technically credible.
- Avoid exposing company-specific operational details that feel confidential.
- Prefer capability framing over internal workflow names.
- Keep text concise on first view, with deeper detail available by interaction.
- Avoid AI-sounding filler, sales language, and vague claims.

## Frontend Behavior

- Use interactions only when they improve reading and scanning.
- Avoid scroll-driven expansion for core content; it can feel unstable.
- Prefer direct click/tap/keyboard controls for expandable content.
- Make repeated sections visually calm. Do not make every row look like a headline.
- Support keyboard access and accurate ARIA states when adding interactive rows.
- Verify desktop and mobile after visual changes.

## Technical Signals To Preserve

- Agents: multi-agent architectures, tool calling, persistent memory, authentication, RAG, DSPy, LangChain, LangGraph, harness engineering, multimodal media.
- ML: PyTorch, Hugging Face, Transformers, fine-tuning, custom classifiers, contrastive learning, SetFit, computer vision, forecasting.
- Backend/data: Python, FastAPI, Celery, event-driven workflows, REST APIs, MongoDB, Postgres, Redis.
- Infra/ops: AWS EC2/ECS/SQS/SNS, GCP Cloud Functions, Databricks, PM2, Sentry, CloudWatch, cron operations.
