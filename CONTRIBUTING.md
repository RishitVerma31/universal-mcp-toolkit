# Contributing to universal-mcp-toolkit

Thank you for your interest in contributing to `universal-mcp-toolkit`!

This repository aims to be a public, reusable, cloud-hosted MCP server toolkit that any developer can deploy into their own Cloudflare account.

---

## Guiding Principles

1. **Universal & Agent-Agnostic**: Tools must comply with the official Model Context Protocol specifications and work across all compatible clients.
2. **Independent Deployments**: Every user deploys to their own personal Cloudflare account. No shared central service or credentials.
3. **Free Tier Friendly**: No paid APIs, mandatory subscriptions, or paid services.
4. **Security & Sandboxing**: Tools must not implement arbitrary shell execution, unrestricted filesystem operations, or untrusted network fetching.

---

## Development Setup

1. **Fork and Clone**:
    ```bash
    git clone https://github.com/<your-username>/universal-mcp-toolkit.git
    cd universal-mcp-toolkit
    ```
2. **Install Dependencies**:
    ```bash
    npm install
    ```
3. **Run Checks**:
    ```bash
    npm test
    npm run type-check
    npm run lint
    npm run format
    ```

---

## Adding a New Tool

1. **Create the Tool Module**:
    - Place new tools in `src/tools/<category>/<tool-name>.ts`.
    - Separate the pure utility logic from the tool handler.
    - Use Zod schemas with `.describe(...)` annotations for all inputs.
    - Return `{ isError: true, content: [...] }` on failures rather than throwing uncaught exceptions.
2. **Register the Tool**:
    - Export the registration function from `src/tools/index.ts` and add it to `registerAllTools(server)`.
3. **Add Automated Tests**:
    - Create comprehensive unit tests in `tests/tools/<tool-name>.test.ts` covering normal execution, edge cases, and error handling.
    - Run `npm test` to verify.

---

## Pull Request Checklist

Before opening a pull request, ensure:

- [ ] All automated tests pass: `npm test`
- [ ] TypeScript checks succeed: `npm run type-check`
- [ ] Linter reports 0 warnings/errors: `npm run lint`
- [ ] Code is formatted: `npm run format`
- [ ] Security audit reports 0 vulnerabilities: `npm audit`
- [ ] Cloudflare bundler dry run succeeds: `npx wrangler deploy --dry-run`
- [ ] Documentation in `README.md` is updated if applicable
