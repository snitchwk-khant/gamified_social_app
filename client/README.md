# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.

## Architecture Decision

This project now follows a Supabase-only backend architecture.

- Use Supabase for auth, database, realtime, and storage.
- Do not add new MongoDB/Express backend features.
- Existing server folder is retained but ignored for active feature development.

## Sprint 5 Supabase Artifacts

- Schema migration: [supabase/migrations/20260628_sprint5_supabase_production_schema.sql](supabase/migrations/20260628_sprint5_supabase_production_schema.sql)
- Sprint plan and table audit: [docs/sprint5-supabase-plan.md](docs/sprint5-supabase-plan.md)
