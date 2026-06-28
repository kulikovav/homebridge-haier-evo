---
alwaysApply: true
description: Repository coding guide: TypeScript; coding standards and patterns
---

# Expertise Focus

- TypeScript, Node.js, Jest
- Apply best practices and performance optimizations across these technologies

# Code Style and Structure

- Clean, maintainable, technically accurate TypeScript
- Prefer functional, declarative patterns; avoid classes
- Favor Composition API `<script setup>` in components
- Iterate and modularize to follow DRY and reduce duplication
- Use Composables to encapsulate reusable client-side logic/state and share across components/pages
- Use ES modules (import/export) syntax, not CommonJS (require)
- Destructure imports when possible (eg. import { foo } from 'bar')
- Use zod for all validation
- Define return types with zod schemas
- Export types generated from schemas

# Naming Conventions

- Composables: `use<MyComposable>`
- Components: PascalCase file names (e.g., `components/MyComponent.vue`)
- Exports: prefer named exports for functions
- Follow component naming conventions

# TypeScript Usage

- Use TS throughout; prefer interfaces over types for extendability/merging
- Avoid enums; use object maps for type safety/flexibility
- Use functional components with concise, purposeful interfaces

# General Guidance

- Match existing formatting; avoid unrelated refactors
- Keep code readable with meaningful names; avoid cryptic abbreviations
- Add concise comments only when necessary to explain “why”, not “how”

# Workflow

- Consider making configurations for multiple platforms
- Use Docker and Docker Compose for building and testing applications
- Be sure to typecheck when you’re done making a series of code changes
- Prefer running single tests, and not the whole test suite, for performance
- Do not create new markdown documents (.md files) until directly asked
