# Implementation Roadmap

## Current Phase

Phase 1 - Design System Foundation

## Phase 1 Goal

Build the reusable UI and design-system foundation for SchoolWithEase in `packages/ui`, with a minimal `apps/web` preview surface for validating components, layouts, themes, and responsive behavior.

Phase 1 should make future product screens faster and safer to build by establishing shared visual tokens, reusable components, role-aware navigation primitives, and standard page states before full application workflows begin.

## Phase 1 Scope

- Scaffold a minimal `apps/web` Next.js application as a design-system preview and integration surface.
- Wire `apps/web` to `@workspace/ui`, shared Tailwind styles, TypeScript config, and workspace tooling.
- Define coded design tokens for color, typography, spacing, radius, elevation, charts, focus states, and layout dimensions.
- Align light and dark mode variables with approved design references.
- Clean `packages/ui` custom components so they use typed props instead of embedded sample data.
- Build reusable application shell components: sidebar, header, school switcher, user menu, breadcrumbs, page header, and mobile navigation.
- Define a role-aware and tenant-aware navigation model that can later be driven by permissions.
- Create reusable state components for loading, empty, error, forbidden, offline/read-only, and validation states.
- Create reusable layout patterns for dashboard, list/detail, table, form, and settings views.
- Add a `/design-system` preview route in `apps/web` to review the core components and states.
- Document usage rules for tokens, components, layouts, themes, navigation, and tenant branding boundaries.

## Out Of Scope For Phase 1

- Full product workflows.
- Backend feature expansion.
- New database models or migrations, unless required only to unblock design-system contracts.
- AI tutor or school intelligence assistant implementation.
- Finance, HR, transportation, library, cafeteria, health, or advanced operations modules.
- Native Android or iOS applications.
- Full PWA offline behavior.
- Production deployment infrastructure.
- Payment processing.
- Real notification delivery providers.

## Phase 1 Milestones

### 1. Web Preview Scaffold

Create the minimal `apps/web` application and confirm it can render shared UI components from `packages/ui`.

Deliverables:

- `apps/web/package.json`
- Next.js app structure
- Shared Tailwind/global CSS wiring
- Basic root layout
- `/design-system` preview route

Acceptance criteria:

- `pnpm dev` can run the web preview through Turborepo.
- `apps/web` imports and renders components from `@workspace/ui`.
- The preview route works on desktop and mobile viewport sizes.

### 2. Token Foundation

Translate the approved visual direction into stable coded tokens.

Deliverables:

- Color tokens for light and dark themes
- Typography scale
- Spacing scale
- Radius and elevation tokens
- Chart/status/semantic color roles
- Focus and interaction state tokens

Acceptance criteria:

- Tokens live in the shared UI styling layer.
- Light and dark themes have parity.
- Tenant branding can later override approved color roles without changing spacing, layout, or component behavior.

### 3. Core Shell Components

Productize the shared shell components for SchoolWithEase.

Deliverables:

- App shell
- Sidebar
- Header
- School switcher
- User menu
- Breadcrumbs
- Page header
- Mobile navigation behavior

Acceptance criteria:

- No hardcoded template data remains inside reusable shell components.
- Components accept typed props.
- Layout remains stable when content changes.
- Components support light and dark themes.

### 4. Role-Aware Navigation Model

Create the UI-side navigation model required for later RBAC integration.

Deliverables:

- Typed route/navigation config
- Support for role, clearance level, permission keys, tenant context, school type, and active route state
- Example SchoolWithEase navigation data for preview only

Acceptance criteria:

- Navigation rendering is data-driven.
- Components do not hardcode permissions or tenant logic.
- The model can represent platform-level and school-level navigation.

### 5. State And Feedback Components

Create the states required by the product requirements so screens never appear blank or undefined.

Deliverables:

- Loading state
- Skeleton patterns
- Empty state
- Error state
- Forbidden state
- Offline/read-only state
- Validation summary pattern

Acceptance criteria:

- States are reusable across future pages.
- States support concise titles/actions without layout shift.
- States are accessible and keyboard-friendly where actions exist.

### 6. Layout Patterns

Build reusable layout patterns for common authenticated surfaces.

Deliverables:

- Dashboard layout
- List/detail layout
- Data table layout
- Form layout
- Settings layout

Acceptance criteria:

- Patterns are responsive.
- Patterns avoid page-specific styling.
- Patterns compose existing shared components.

### 7. Verification And Documentation

Add enough validation and documentation to keep the design system usable.

Deliverables:

- Design-system usage notes
- Component preview examples
- Accessibility checklist
- Responsive verification notes
- Known gaps list for Phase 2 planning

Acceptance criteria:

- A developer can understand how to consume `packages/ui`.
- The preview route demonstrates the current component set.
- Known limitations are documented instead of hidden.

## Recommended Phase 1 Execution Order

1. Create the minimal `apps/web` preview scaffold.
2. Wire shared styling and confirm `@workspace/ui` imports.
3. Normalize global tokens in `packages/ui`.
4. Remove sample data from custom UI components.
5. Build the SchoolWithEase app shell and navigation model.
6. Add state components and layout patterns.
7. Document usage and verify responsive/accessibility behavior.

## Phase 1 Definition Of Done

Phase 1 is complete when:

- `apps/web` exists as a working Next.js preview surface.
- `packages/ui` exposes reusable, typed SchoolWithEase components.
- Shared shell, navigation, state, and layout components are previewable.
- Light and dark theme foundations are implemented.
- Components do not embed template/sample product data.
- The design-system preview works on mobile and desktop.
- Documentation explains how to use and extend the foundation.
- Future application screens can be built from shared components instead of one-off UI.

## Phase 1 Risks

- Design drift if approved `design-export` references are not translated into tokens before screens are built.
- Rework risk if `apps/web` grows into product workflows before the shared UI foundation is stable.
- Authorization drift if role-aware navigation is hardcoded instead of modeled with permissions and clearance levels.
- Tenant branding risk if color overrides are allowed to affect layout or component behavior.
- Accessibility risk if keyboard/focus behavior is not checked while shell and navigation components are still small.

## Post-Phase 1 Candidates

These items should wait until the design-system foundation is stable:

- Authentication UI flow.
- Tenant onboarding flow.
- School selection/profile switching UI.
- Student management screens.
- Academic structure screens.
- Assessment and grading screens.
- Communication screens.
- Reporting dashboard.
- PWA offline behavior.
- API client generation and frontend data fetching patterns.
- Backend hardening work identified in `docs/project-audit.md`.
