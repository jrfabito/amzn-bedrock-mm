# Bedrock Model Migration — Cloudscape Prototype

A front-end prototype of an **Amazon Bedrock "Model migration"** experience, built with the [Cloudscape](https://cloudscape.design/) design system and [Vite](https://vitejs.dev/). It demonstrates the end-to-end flow a user would follow to evaluate, optimize, and migrate from one foundation model to another using their own invocation logs.

> This is a UI prototype only. All data is mocked from static JSON files in `public/` — there is no backend or real Bedrock integration.

## What it does

The app walks through a three-stage model migration workflow:

1. **Review evaluation results** — automated performance comparisons (cost, latency, accuracy) between a current model and a candidate model.
2. **Optimize prompts** — provide prompt templates and let the flow fine-tune them for the target model.
3. **Run shadow testing** — deploy the candidate model alongside the current one against real-style traffic before committing.

### Pages

| Route | Page | Purpose |
| --- | --- | --- |
| `/` | Home | Migration overview, "How it works", migration history table, and model spotlights |
| `/create-migration` | Create migration | Configure a migration job (source/target models, invocation-log time range) |
| `/provide-prompt-templates` | Prompt templates | Supply prompt templates / schema for optimization |
| `/start-shadow-testing` | Shadow testing | Run the candidate model against a test dataset and review results |
| `/results/:jobId` | Migration results | Charts, metrics, and per-row comparisons for a completed job |

### Mocked states

Several pages support dev toggles and a `?state=` URL parameter to preview different stages without a backend. On the home page:

- `?state=EVAL_COMPLETE` — 1 of 3 stages completed (in progress)
- `?state=OPTIMIZATION_COMPLETE` — 2 of 3 stages completed (in progress)
- `?state=MIGRATION_COMPLETE` — 3 of 3 stages completed (success)

Mock data lives in `public/` (e.g. `job-1-*.json`, `job-2-*.json`, `invocation-log.json`, `shadow-testing-dataset.json`).

## Tech stack

- [Cloudscape Design System](https://cloudscape.design/) — components, design tokens, global styles, collection hooks
- [React 18](https://react.dev/) + [React Router 6](https://reactrouter.com/)
- [Vite 5](https://vitejs.dev/) + TypeScript
- Sass / PostCSS for styling
- Light/dark mode toggle (persisted via `localStorage`)

## Project structure

```
src/
  app.tsx                  # Router + route definitions
  main.tsx                 # App entry
  pages/                   # Home, create-migration, prompt-templates, shadow-testing, results, not-found
  components/              # App layout, global header, navigation panel, router wrappers
  common/                  # Constants, types, hooks (dark mode, nav state), helpers, utils
  styles/                  # app.scss
public/                    # Mock JSON data and images
```

## Development

1. Clone the repository:
   ```bash
   git clone https://github.com/aws-samples/cloudscape-examples
   cd cloudscape-examples/empty-vite
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the dev server (with hot reload):
   ```bash
   npm run dev
   ```
   The app runs at `http://localhost:3000` (or another port if 3000 is in use).

## Building for production

```bash
npm run build
```
Generates a `dist/` folder with the optimized production build.

## Previewing the production build

```bash
npm run preview
```
Serves the contents of `dist/` locally so you can preview before deployment.

## Other scripts

- `npm run lint` — run ESLint over `ts`/`tsx` files
- `npm run format` — format the codebase with Prettier

## Deployment

The included `vercel.json` rewrites all routes to `index.html` so the SPA's client-side router (`BrowserRouter`) works on [Vercel](https://vercel.com/). Routing can be switched to `HashRouter` via `USE_BROWSER_ROUTER` in `src/common/constants.ts`.
