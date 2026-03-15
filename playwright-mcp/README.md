# Playwright MCP – AI-driven recording

Session videos from Playwright MCP (AI-driven browser runs) are saved in `recordings/`. That folder is in `.gitignore`.

## Use this config in Cursor

1. **Cursor** → **Settings** → **MCP** → **Add new MCP Server** (or edit existing Playwright server).
2. **Command:** `npx @playwright/mcp@latest`
3. **Arguments:** add so the server uses this project’s config and records video:
   - `--config=playwright-mcp/config.json`

   (If your client uses separate arg fields, use one arg: `--config=playwright-mcp/config.json`. Ensure the MCP process runs with the repo root as the current working directory.)

4. Restart Cursor if needed.

Videos will be written to `playwright-mcp/recordings/` when you run AI-driven browser tasks (e.g. "go through all app features") and close the browser.

---

## How to run a full-feature recording

1. **Start the app:** `npm run dev` (keep it running).
2. **In Cursor Chat**, paste this prompt:

   ```
   Use the Playwright browser. Go to http://localhost:3000 and sign in with email e2e@test.com and password E2eTest@123. Then go through each section in the sidebar: Dashboard, Portfolio, Expenses, Loans, Goals, Financial Health, Tax, AI Planner, Scenario, FIRE, AI Advisor, Integrations, and Settings. On each page: take a snapshot, do one or two actions so the recording shows the feature, then scroll to the bottom of the page so the full page is visible in the recording. Only then move to the next section. When you're done with all of them, close the browser.
   ```

3. **Wait** for the run to finish. Don't close the browser or Cursor until the AI says it's done and has closed the browser.
4. **Recording location:** `playwright-mcp/recordings/` (e.g. `d:\Dashboard\wealth-saas\wealth-saas\playwright-mcp\recordings\`).  
   If that folder is empty, the MCP may have used its default path (e.g. `C:\Users\<you>\playwright-mcp\recordings\` and a `videos` subfolder). Ensure the MCP server is started with the **repo root as working directory** so it uses `config.json` and writes into the project.

