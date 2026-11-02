# Candide

Two deployables in one repository:

- **Marketing site** (`index.html`, `missions.html`, `pilot.html`, `assets/`): static, deployed to candideai.com with clean URLs (`/`, `/missions`, `/pilot`; see `vercel.json`). `programme.html` and `enrol.html` are redirect stubs for the old URLs.
- **Platform** (`platform/`): the Next.js + Supabase classroom app, deployed to app.candideai.com with Vercel's Root Directory set to `platform`. See [platform/README.md](platform/README.md) for setup, environment, tests and deployment.
