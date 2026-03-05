# Fundamental Edge Operations Center

Internal operating system for Fundamental Edge -- a financial training firm. Built with Next.js 14, Tailwind CSS, and Supabase.

## Tech Stack

- **Frontend:** Next.js 14 (App Router), React 18, Tailwind CSS
- **Database:** Supabase (PostgreSQL)
- **Deployment:** Vercel
- **Typography:** Barlow (headings), Fira Sans (body) via Google Fonts

## Features

- **Dashboard** -- Active project cards, summary metrics, progress tracking
- **This Week** -- Filterable task view by team member with status toggling
- **Projects** -- Full project list with workflow type filtering
- **Project Detail** -- Phase-by-phase task breakdown with expand/collapse, inline status updates, editable project name and start date
- **New Project Wizard** -- 3-step workflow: select template, enter details, confirm and auto-generate all tasks
- **Team** -- Team member cards with workload metrics and overload warnings

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd fundamental-edge-ops
npm install
```

### 2. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your **Project URL** and **anon public key** from Settings > API

### 3. Set Up the Database

1. In your Supabase dashboard, go to **SQL Editor**
2. Open `supabase/schema.sql` and run the entire contents -- this creates all tables, indexes, and RLS policies
3. Open `supabase/seed.sql` and run the entire contents -- this populates team members, workflow templates, template tasks, and 3 sample projects with realistic task data

### 4. Configure Environment Variables

Create a `.env.local` file in the project root:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 5. Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 6. Deploy to Vercel

1. Push the repo to GitHub
2. Go to [vercel.com](https://vercel.com) and import the repository
3. Add the two environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy -- Vercel will auto-detect Next.js and build

## Database Schema

| Table | Purpose |
|---|---|
| `team_members` | 5 team members with name, role, initials, avatar color |
| `workflow_templates` | 4 workflow types: Course Launch, Podcast, Newsletter, Subscription |
| `template_tasks` | SOP task templates for each workflow with phase, order, owners |
| `projects` | Active project instances tied to a workflow template |
| `project_tasks` | Generated tasks for each project with due dates and status |

## Seed Data

The seed includes 3 active projects:

1. **AI Accelerator -- Cohort 3** (Course Launch) -- Week 6 of 8, mix of completed and in-progress tasks
2. **Episode 12 -- AI in Portfolio Construction** (Podcast) -- Week 1 of 2, first two tasks done
3. **Signal & Noise -- Issue 14** (Newsletter) -- Week 2, assembly in progress

## Team

| Name | Role | Avatar Color |
|---|---|---|
| Brett Caughran | Owner & Lead Trainer | #0762C8 |
| Paul Teraberry | Operations & Financial Manager | #1B365D |
| Jessica Corbin | Marketing & Operations Coordinator | #B29838 |
| Britt Williams | Graphic & Visual Designer | #437F94 |
| Nick North | Branding Strategist | #647692 |

## Brand Colors

| Name | Hex |
|---|---|
| Primary Blue | #0762C8 |
| Navy | #1B365D |
| Deep Gold | #B29838 |
| Tan/Gold Light | #D9C58D |
| Blue-Gray | #647692 |
| Anthracite | #3F4444 |
| Off-White | #F8F9FB |
| Green (Done) | #046A38 |
| Red (Blocked) | #C8350D |
| Teal (Podcast) | #437F94 |

## Project Structure

```
src/
  app/
    page.tsx              # Dashboard
    layout.tsx            # Root layout with sidebar
    globals.css           # Global styles + Google Fonts
    this-week/page.tsx    # This Week view
    team/page.tsx         # Team view
    projects/
      page.tsx            # Projects list
      new/page.tsx        # New Project wizard
      [id]/page.tsx       # Project detail
    api/
      team/route.ts
      projects/route.ts
      projects/[id]/route.ts
      projects/[id]/tasks/[taskId]/route.ts
      tasks/this-week/route.ts
      workflow-templates/route.ts
  components/
    Sidebar.tsx
    Avatar.tsx
    StatusBadge.tsx
    WorkflowBadge.tsx
    ProgressBar.tsx
  lib/
    supabase.ts
    types.ts
supabase/
  schema.sql
  seed.sql
```
