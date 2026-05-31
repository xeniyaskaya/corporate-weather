# Corporate Weather

Corporate Weather is a DACH-focused Skybridge GPT app that analyzes visible public workplace risk signals. It is signal analysis only, not a prediction or legal advice.

## Getting Started

### Prerequisites

- Node.js 24+

### Local Development

#### 1. Install

```bash
npm install
# or
pnpm install
# or
bun install
# or
deno install
# or
yarn install
```

#### 2. Start the standalone website

Run the normal public website locally from this app directory:

```bash
npm run dev
```

This opens the standalone Corporate Weather website with routes for:
- `/`
- `/company/:companyName`
- `/radar`

The standalone website uses the same shared scoring logic in `src/risk-model.ts` as the ChatGPT/Skybridge app.

#### 3. Start the Skybridge app locally

Run the MCP/Skybridge development server from this app directory:

```bash
npm run dev:skybridge
```

This command starts:
- Your MCP server at `http://localhost:3000/mcp`.
- Skybridge DevTools UI at `http://localhost:3000`.

#### 4. Project structure

```
├── src/
│   ├── risk-model.ts     # DACH source strategy and scoring model
│   ├── server.ts         # MCP server entry point
│   ├── standalone.tsx    # Standalone public website entry point
│   ├── views/            # Skybridge/ChatGPT embedded views
│   └── helpers.ts        # Skybridge typed helpers
├── vite.config.ts
├── vite.web.config.ts    # Standalone website Vite config
├── vercel.json           # Vercel static-site deployment config
├── alpic.json            # Deployment config
└── package.json
```

### Create your first view

#### 1. Add a new view

- Register a tool in `src/server.ts` with a unique name (e.g., `my-view`) using [`registerTool`](https://docs.skybridge.tech/api-reference/register-tool) and a `view` config.
- Create a matching React component at `src/views/my-view.tsx`. **The file name must match the view name exactly**.

#### 2. Edit views with Hot Module Replacement (HMR)

Edit and save components in `src/views/` — changes will appear instantly inside your App.

#### 3. Edit server code

Modify files in `src/` and refresh the tool list with your MCP Client to see the changes.

### Testing your App

You can test your app locally by using our DevTools UI on `http://localhost:3000` while running the `dev` command.

To connect your app with web clients like ChatGPT or Claude, expose your server on the internet by adding the `--tunnel` flag.
By enabling the tunnel, you'll also be able to access a playground to chat with your app and a real LLM. Learn more by reading the [test guide](https://docs.skybridge.tech/quickstart/test-your-app).


## Deploy to Production

Skybridge is infrastructure vendor agnostic, and your app can be deployed on any cloud platform supporting MCP.

The simplest way to deploy your app is by running the `deploy` command, which will push your MCP server to the [Alpic](https://alpic.ai/) cloud for free.

## Standalone Website Deployment

Corporate Weather also ships as a normal standalone React website. This is separate from the Alpic/Skybridge playground, so it does not look like a CustomGPT or MCP testing screen.

The standalone website entry point is:

```text
index.html -> src/standalone.tsx
```

It reuses the shared scoring module:

```text
src/risk-model.ts
```

### Local Website Commands

```bash
npm run dev
npm run build
npm run preview
```

The production website build outputs to:

```text
dist-web
```

The same build command also emits the Skybridge `dist` folder so the Alpic deployment can still package the ChatGPT app.

### Deploy to Vercel

1. Push this repo to GitHub.
2. Open Vercel and choose **Add New Project**.
3. Import the `xeniyaskaya/corporate-weather` repository.
4. Use these settings:

```text
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist-web
Install Command: npm install
```

The included `vercel.json` also configures SPA rewrites, so these public routes work after deploy:

```text
/
/company/:companyName
/radar
```

### Skybridge Commands

The ChatGPT/Skybridge app remains available through separate scripts:

```bash
npm run dev:skybridge
npm run build:skybridge
npm run deploy
```

## ChatGPT App Directory Submission

The public ChatGPT App Directory submission packet is in:

```text
docs/chatgpt-app-submission.md
```

It includes the MCP server URL, listing copy, tool safety annotations, CSP notes, test prompts, review notes, and pre-submission checks.

The draft privacy policy is in:

```text
docs/privacy-policy.md
```

Before public submission, publish the standalone website and privacy policy so the OpenAI submission form has public company/developer and privacy-policy URLs.

## Resources
- [Skybridge Documentation](https://docs.skybridge.tech/)
- [Apps SDK Documentation](https://developers.openai.com/apps-sdk)
- [MCP Apps Documentation](https://github.com/modelcontextprotocol/ext-apps/tree/main)
- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [Alpic Documentation](https://docs.alpic.ai/)
