# Telemed Creative Engine v2 — Design Spec
_Date: 2026-04-22_

## Overview

An autonomous telemedicine marketing pipeline that takes a product as input and delivers fully-tested advertorials, copy briefs, ad scripts, static images, and video ads to ClickUp — with a virtual interest group scoring loop that iterates until assets hit a 7.0/10 passing threshold.

---

## Architecture

**Approach: Next.js (Vercel) + Express Worker (Railway)**

Two services:
- **Frontend** — Next.js 15 App Router on Vercel. Auth (Clerk), dashboard, run detail with live logs, asset viewer, advertorial preview hosting.
- **Backend Worker** — Express + tRPC on Railway. BullMQ job queue, 21-stage pipeline, all agent logic, external API calls (no timeout ceiling).

Both services share a single Supabase Postgres database and Supabase Storage bucket.

```
User → Vercel Frontend (Next.js 15, Clerk auth)
            │ tRPC
       Railway Worker (Express, BullMQ, 21 stages)
            ├── Supabase Postgres (data)
            ├── Supabase Storage (images, videos, HTML)
            ├── Anthropic API (Claude Opus 4.7 + Sonnet 4.6)
            ├── Exa API (competitor + advertorial discovery)
            ├── Firecrawl API (full-page content extraction)
            ├── Fal.ai API (Flux images, Minimax/Kling video, PlayAI voice)
            ├── Vercel Deploy API (advertorial preview pages)
            └── ClickUp API (final delivery)
```

---

## Pipeline Stages

21 stages run sequentially. Stages 17–20 form a scored revision loop (max 3 passes, exit when avg score ≥ 7.0).

| # | Stage | Agent | Model | APIs |
|---|-------|-------|-------|------|
| 1 | INTAKE | — | — | — |
| 2 | OFFER_PROFILE | Offer Profiler | Claude Opus 4.7 | — |
| 3 | AVATAR_BUILD | Avatar Agent | Claude Opus 4.7 | — |
| 4 | COMPETITOR_DISCOVER | Research Agent | Claude Sonnet 4.6 | Exa |
| 5 | ADVERTORIAL_DISCOVER | Research Agent | Claude Sonnet 4.6 | Exa |
| 6 | ADVERTORIAL_FETCH | Analyst Agent | — | Firecrawl |
| 7 | REVERSE_ENGINEER | Analyst Agent | Claude Opus 4.7 | — |
| 8 | REVERSE_BRIEF | Brief Writer | Claude Opus 4.7 | — |
| 9 | COPY_CONCEPTS | Brief Writer | Claude Sonnet 4.6 | — |
| 10 | ADVERTORIAL_COPY | Copy Chief | Claude Opus 4.7 | — |
| 11 | CREATIVE_DIRECTION | Creative Director | Claude Opus 4.7 | — |
| 12 | AD_SCRIPTS | Creative Director | Claude Sonnet 4.6 | — |
| 13 | FUNNEL_BUILD | Funnel Builder | Claude Sonnet 4.6 | Vercel API |
| 14 | STATIC_ADS | Image Agent | Fal.ai Flux 1.1 Pro | Fal.ai |
| 15 | VIDEO_DRAFT | Video Agent | Fal.ai Minimax | Fal.ai + PlayAI |
| 16 | VIDEO_FINAL | Video Agent | Fal.ai Kling 2.0 | Fal.ai |
| 17 | PERSONA_TEST | 15 Persona Agents | Claude Sonnet 4.6 | — |
| 18 | FEEDBACK_AGGREGATE | QA Agent | Claude Sonnet 4.6 | — |
| 19 | REVISION | (originating agent) | Claude Opus 4.7 | varies |
| 20 | QA_FINAL | QA Agent | Claude Sonnet 4.6 | — |
| 21 | DELIVERY | ClickUp Publisher | — | ClickUp API |

### Revision Loop Logic
- After PERSONA_TEST: compute average score per asset (advertorial, each static ad, each video)
- Assets scoring < 7.0 → flagged → routed to originating agent with persona feedback as context
- Loop re-runs PERSONA_TEST after each revision pass
- Max 3 revision passes; if still failing on pass 3, deliver anyway with QA note in ClickUp task

---

## Agent Definitions

### Offer Profiler (Claude Opus 4.7)
Uses Todd Brown E5 methodology and WEB Analysis (Wants, Emotions, Beliefs) from rapid-launch-agent.
Outputs: offer analysis JSON, avatar demographics, empathy map, goals grid, manifold, launch document.

### Avatar Agent (Claude Opus 4.7)
Builds 15 telemedicine-specific archetype avatars from the offer profile.
Seeded once per product, reused across revision loops.

### Research Agent (Claude Sonnet 4.6 + Exa)
Stage 4: Finds top 5–7 telemedicine competitors via Exa semantic search.
Stage 5: Finds top 3–5 advertorials driving traffic to those competitors via Exa.
Scores sources by relevance and estimated authority.

### Analyst Agent (Claude Opus 4.7 + Firecrawl)
Stage 6: Fetches full advertorial content via Firecrawl (handles JS-rendered pages).
Stage 7: Line-by-line reverse engineering — identifies hook structure, belief bridges, CTA mechanics, voice, pacing, emotional arc.

### Brief Writer (Claude Opus 4.7 / Sonnet 4.6)
Stage 8: Reverse brief — a copywriter-ready document capturing WHY the top advertorial converts.
Stage 9: 3 new advertorial concepts with copy briefs for each.

### Copy Chief (Claude Opus 4.7)
Writes a full advertorial (1500–2500 words) in the same voice and pacing as the top competitor advertorial, but positioning the telemedicine product as the superior option. Uses extended thinking for quality.

### Creative Director (Claude Opus 4.7 / Sonnet 4.6)
Stage 11: Analyzes advertorial copy to derive 3 creative concepts for video + static ads.
Stage 12: Writes full scripts (30s+) and creative briefs for each concept.

### Funnel Builder (Claude Sonnet 4.6 + Vercel API)
Generates a single-page HTML/CSS/JS advertorial funnel following direct response principles (above-fold hook, social proof, CTA placement, mobile-first). Auto-deploys to Vercel as a preview URL.

### Image Agent (Fal.ai Flux 1.1 Pro)
Generates 3–5 static ad variations (1:1, 4:5, 9:16 formats) per creative concept.

### Video Agent (Fal.ai Minimax + Kling 2.0 + PlayAI)
Stage 15: Draft videos via Minimax (fast, cheap) for rapid iteration.
Stage 16: Final videos via Kling 2.0 Master (highest quality). Minimum 30 seconds. PlayAI voice-over generated separately and composited.

### 15 Persona Agents (Claude Sonnet 4.6)
Each persona is a distinct telemedicine patient archetype with specific demographics, fears, beliefs, and objections. They review each asset independently, scoring 1–10 with specific objections and suggested edits. See Persona Roster below.

### QA Agent (Claude Sonnet 4.6)
Aggregates persona scores, identifies failing assets, routes revision instructions, and performs final quality check before delivery.

### ClickUp Publisher
Creates tasks in two ClickUp lists:
- **Advertorial Pipeline**: one task per run with advertorial URL, copy doc, persona scores. Status: Drafting. Production Phase: Post-Production.
- **Creative Pipeline**: one task per creative asset (JPEGs, MP4s, PDF briefs). Status: AI Generation. Deliverable Format set per asset type. Brand Identity set from product config.

---

## 15 Telemedicine Persona Archetypes

| # | Name | Archetype | Age/Gender | Primary Fear | Primary Currency |
|---|------|-----------|------------|--------------|-----------------|
| 1 | Harold | Skeptical Boomer | M 58–68 | "It's not real medicine" | Security |
| 2 | Sarah | Busy Mom | F 32–45 | "No time for appointments" | Time |
| 3 | Marcus | Cost-Conscious Worker | M 40–55 | "Can't afford this" | Money |
| 4 | Emma | Health Anxious Millennial | F 28–38 | "What if it's serious?" | Health |
| 5 | Robert | Privacy Protector | M 45–60 | "Who sees my data?" | Security |
| 6 | Linda | Already Tried Everything | F 35–50 | "Nothing works for me" | Hope |
| 7 | Derek | High-Performer Executive | M 30–45 | "I don't have time to be sick" | Time |
| 8 | Ray | Rural Patient | M/F 40–65 | "No doctors near me" | Access |
| 9 | Dorothy | Tech-Averse Senior | F 60–75 | "I can't figure out the app" | Simplicity |
| 10 | Michelle | Weight-Loss Seeker | F 35–55 | "I've failed before" | Confidence |
| 11 | Carol | Caregiver | F 40–60 | "I need this for someone else" | Reliability |
| 12 | James | Embarrassed Patient | M 40–60 | "I can't say this to a doctor" | Privacy |
| 13 | Tina | Insurance-Burnt | F 35–55 | "Insurance won't cover this" | Value |
| 14 | Aisha | Social Proof Dependent | F 25–40 | "I need to see reviews first" | Trust |
| 15 | Victor | Urgency Driven | M/F 30–50 | "I need help right now" | Speed |

---

## Data Model (Supabase Postgres)

```sql
-- Core entities
products (id, name, url, target_market, brief, vertical default 'telemedicine', created_by, created_at)
pipeline_runs (id, product_id, status, current_stage, revision_pass, started_at, completed_at, created_by)
stage_logs (id, run_id, stage, level, message, metadata_json, created_at)

-- Research & analysis artifacts
offer_profiles (id, run_id, offer_analysis_json, avatar_json, beliefs_json, manifold_json, launch_doc_json)
research_artifacts (id, run_id, type, url, title, traffic_score, raw_content, analysis_json)
reverse_briefs (id, run_id, source_url, line_analysis_json, brief_json, concepts_json)

-- Generated content
copy_assets (id, run_id, type, content, version, score, status)
creative_assets (id, run_id, type, fal_job_id, storage_url, format, score, status)
funnel_pages (id, run_id, html_content, vercel_deployment_id, vercel_url, status)

-- Persona testing
personas (id, name, archetype, demographics_json, psychographics_json, primary_fear, primary_currency) -- seeded once
persona_reviews (id, run_id, persona_id, asset_id, asset_type, score, sentiment, objection, suggested_edit)

-- Delivery
clickup_deliverables (id, run_id, list, task_id, task_url, delivered_at)
```

---

## Environment Variables

### Railway Worker
```
DATABASE_URL                    Supabase direct connection string
SUPABASE_URL                    Supabase project URL
SUPABASE_SERVICE_ROLE_KEY       Supabase service role JWT
ANTHROPIC_API_KEY               Claude Opus 4.7 + Sonnet 4.6
EXA_API_KEY                     Exa semantic search
FIRECRAWL_API_KEY               Firecrawl page extraction
FAL_KEY                         Fal.ai image + video + voice
CLICKUP_API_TOKEN               ClickUp delivery
CLICKUP_ADVERTORIAL_LIST_ID     ClickUp Advertorial Pipeline list ID
CLICKUP_CREATIVE_LIST_ID        ClickUp Creative Pipeline list ID
VERCEL_TOKEN                    For advertorial preview deployments
VERCEL_TEAM_ID                  Vercel team
VERCEL_ADVERTORIAL_PROJECT_ID   Vercel project for funnel pages
REDIS_URL                       Railway Redis addon
```

### Vercel Frontend
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
RAILWAY_BACKEND_URL             Internal URL of Railway worker
```

---

## Why This Build is Better Than v1 (telemed-creative-engine)

| Dimension | v1 (Manus) | v2 |
|-----------|-----------|-----|
| Competitor research | DuckDuckGo HTML scraping (fragile, gets blocked) | Exa semantic API (reliable, rich metadata) |
| Advertorial extraction | Basic HTTP fetch + HTML strip | Firecrawl (handles JS-rendered pages, auth walls) |
| Offer profiling | None | Full Todd Brown E5 + WEB Analysis (from rapid-launch-agent) |
| Video generation | None | Fal.ai Minimax (draft) + Kling 2.0 (final) + PlayAI voice |
| Static ads | DALL-E via basic prompt | Fal.ai Flux 1.1 Pro (state-of-art, multi-format) |
| Avatar system | Generic personas | 15 named telemedicine archetypes with fears, currencies, objections |
| Funnel builder | None | HTML/CSS advertorial page auto-deployed to Vercel preview |
| Pipeline execution | Single async function (can timeout) | BullMQ job queue on Railway (no timeout, retry logic) |
| Revision loop | Simple 1-pass | Scored loop (max 3 passes, exit at 7.0/10 avg) |
| ClickUp delivery | Generic task creation | Structured delivery to two lists with correct columns pre-filled |

---

## Repo Structure

```
telemed-creative-engine-v2/
├── apps/
│   ├── web/                    # Next.js 15 frontend (Vercel)
│   │   ├── app/
│   │   │   ├── (auth)/         # Clerk sign-in/up
│   │   │   ├── dashboard/      # Run list
│   │   │   ├── runs/[id]/      # Live run detail + logs
│   │   │   └── assets/[id]/    # Asset viewer
│   │   └── ...
│   └── worker/                 # Express backend (Railway)
│       ├── src/
│       │   ├── agents/         # One file per agent
│       │   ├── pipeline/       # Stage orchestrator + BullMQ
│       │   ├── db/             # Drizzle schema + queries
│       │   ├── lib/            # Exa, Firecrawl, Fal, ClickUp, Vercel clients
│       │   └── router.ts       # tRPC router
│       └── ...
├── packages/
│   └── shared/                 # Shared types (TypeScript)
├── docs/
│   └── superpowers/specs/      # This file
├── turbo.json
└── package.json
```
