# SQL Agent UI Implementation Plan

## Objective

Implement the approved dark-mode SQL Agent interface from
[`html-pages/index.html`](./html-pages/index.html) in the Next.js application while preserving the
existing Vercel AI SDK chat and streaming behavior.

The implementation should provide:

- A polished initial state with a centered database illustration, supporting text, and suggested
  prompts.
- A persistent composer near the bottom of the workspace.
- Right-aligned user messages and left-aligned AI messages.
- Clear loading, streaming, SQL, result, error, and empty states.
- A responsive layout that works well on desktop and mobile.
- Reusable UI components without losing the custom visual identity of the prototype.

## Agreed Technology Stack

| Responsibility | Technology |
| --- | --- |
| Framework | Next.js App Router |
| Language | TypeScript and React 19 |
| Layout, spacing, responsive behavior, and branded visuals | Tailwind CSS 4 |
| General-purpose UI controls | Ant Design 6 |
| AI and chat-specific components | Ant Design X |
| Icons | Ant Design Icons 6 |
| Ant Design SSR style integration | `@ant-design/nextjs-registry` |
| Chat state, requests, and response streaming | Existing Vercel AI SDK |
| Additional CSS-in-JS library | None |

Tailwind CSS 4 and its PostCSS integration are already installed in
[`package.json`](./package.json) and loaded from [`app/globals.css`](./app/globals.css).

## Dependencies to Add

```bash
npm install antd@6 @ant-design/icons@6 @ant-design/x @ant-design/nextjs-registry
```

Use Ant Design 6 because the application already uses React 19. Ant Design 6 supports React 18+
and does not require the React 19 compatibility patch that was needed by Ant Design 5. Keep
`antd` and `@ant-design/icons` on matching major versions.

## Styling Decision

Use Tailwind CSS and Ant Design together, with a clear ownership boundary.

### Tailwind CSS owns

- The overall application shell.
- Sidebar and workspace layout.
- Responsive breakpoints.
- Empty-state positioning.
- Width and height constraints.
- Background gradients and decorative effects.
- Custom database artwork.
- User and assistant message alignment.
- Custom chat presentation and small visual refinements.
- Semantic layout elements such as `main`, `aside`, `header`, and `section`.

### Ant Design and Ant Design X own

- Buttons and icon buttons.
- Chat composer behavior.
- Chat message bubbles.
- Suggested prompts.
- Tooltips and dropdown menus.
- Mobile drawers.
- Dialogs and confirmation modals.
- Avatars.
- Loading indicators and skeleton states.
- Data tables and other structured result components.
- Copy, retry, feedback, and message actions.
- Accessible interactive states such as focus, disabled, and loading.

Do not force every wrapper or layout element into an Ant Design component. Native semantic HTML
and ordinary React layout wrappers remain appropriate.

## Why Emotion and Styled Components Are Excluded

Emotion and styled-components are CSS-in-JS styling tools, not ready-made component libraries.
They would still require us to write the component styles ourselves.

Adding either one would introduce a third styling system alongside Tailwind and Ant Design,
resulting in:

- Overlapping design tokens.
- More runtime styling code.
- Additional server-rendering configuration.
- Potential stylesheet ordering problems.
- Harder debugging and maintenance.
- Unnecessary client-side bundle overhead.

Ant Design already has its own styling and design-token system. Tailwind covers custom layout and
visual styling. If a component requires complex scoped CSS that is not cleanly expressible with
Tailwind, use a CSS Module as the fallback.

## Ant Design X Usage

Use Ant Design X as the UI layer for AI conversation patterns. It maps closely to the approved
prototype:

| Prototype element | Preferred component |
| --- | --- |
| Initial welcome state | `Welcome` |
| Example questions | `Prompts` |
| User and AI messages | `Bubble` / `Bubble.List` |
| Message input and send action | `Sender` |
| Loading or processing feedback | `Think` or an appropriate loading state |
| Conversation history | `Conversations` |
| Copy, retry, and feedback controls | `Actions` |
| SQL code presentation | `CodeHighlighter` or a custom SQL result component |

Use Ant Design X for presentation only. Continue using the existing Vercel AI SDK and `useChat()`
for message state, API communication, streaming, and error handling. Do not introduce Ant Design
X SDK unless a later requirement demonstrates a concrete need for it.

## Next.js Integration

The application uses the App Router. Install and configure `@ant-design/nextjs-registry` so that
Ant Design's initial styles are emitted during server rendering and the first screen does not
flash unstyled during hydration.

The provider hierarchy should conceptually be:

```text
RootLayout
└── AntdRegistry
    └── UI theme/provider layer
        └── Application
            └── Chat client component
```

Keep client-component boundaries as narrow as practical. The component that calls `useChat()` and
interactive Ant Design components will be a Client Component. Static shell elements can remain
Server Components when doing so does not complicate the layout.

Avoid deprecated Ant Design APIs and avoid App Router subcomponent syntax such as
`<Select.Option />` or `<Typography.Text />` where the official Next.js integration advises direct
imports or data-driven alternatives.

## Dark Theme and Design Tokens

Use Ant Design's `ConfigProvider` with `theme.darkAlgorithm` and explicit design tokens. Ant Design
components should look native to the SQL Agent design, not like unmodified default Ant Design.

The visual direction from the prototype includes:

- Canvas: near-black neutral background.
- Surfaces: subtly elevated blue-gray dark panels.
- Primary accent: restrained cyan.
- Secondary accent: muted violet.
- Success accent: soft green.
- Low-contrast translucent borders.
- Medium rounded corners rather than fully pill-shaped controls everywhere.
- Compact, readable typography suitable for a technical application.
- Monospace typography for SQL and query results.
- Subtle motion with support for `prefers-reduced-motion`.

Create one shared token definition and align Tailwind/CSS variables with the Ant Design theme
values. Do not maintain unrelated sets of colors, radii, and spacing values in multiple files.

Candidate theme values from the prototype:

```text
canvas       #07090d
sidebar      #0a0d12
surface      #0f131a
raised       #151a23
text         #f4f7fb
text-muted   #a4adba
primary      #70e1f5
secondary    #9b8afb
success      #66d9a5
```

These values can be adjusted during implementation to maintain sufficient contrast and consistent
Ant Design component states.

## Icon Strategy

Use `@ant-design/icons` for interface actions and states that already have a suitable Ant Design
icon. Import icons by name rather than importing the entire icon package.

The database hero artwork can remain a custom code-native SVG because it is part of the product's
visual identity rather than a generic action icon.

## Proposed Component Structure

The exact structure may evolve during implementation, but the initial target is:

```text
app/
├── layout.tsx                  Root layout and Ant Design SSR registry
├── page.tsx                    Route composition
├── globals.css                 Tailwind import and global design variables
└── api/chat/route.ts           Existing streaming API route

components/
├── providers/
│   └── ui-provider.tsx         Ant Design dark theme and application provider
└── chat/
    ├── chat-shell.tsx          Main interactive chat container
    ├── chat-sidebar.tsx        Branding, connection, and conversation history
    ├── chat-header.tsx         Conversation title and database status
    ├── chat-empty-state.tsx    Hero, explanation, and suggested prompts
    ├── chat-message-list.tsx   Message mapping and scroll behavior
    ├── chat-message.tsx        Role-specific message presentation
    ├── chat-composer.tsx       Sender and submission behavior
    ├── sql-code-block.tsx      SQL syntax and copy action
    └── query-result.tsx        Tabular result presentation
```

Do not split components solely to make the file tree larger. Extract components when they have a
clear responsibility, meaningful reuse, or independently complex behavior.

## Implementation Phases

### Phase 1: Foundation

- Install Ant Design 6, matching Ant Design Icons, Ant Design X, and the Next.js registry.
- Add `AntdRegistry` to the App Router root layout.
- Create the UI provider with the Ant Design dark algorithm and SQL Agent design tokens.
- Align the global Tailwind/CSS variables with the provider tokens.
- Confirm the application builds without hydration warnings or first-render style flashing.

### Phase 2: Application Shell

- Recreate the responsive sidebar and workspace shell.
- Add the brand, database connection status, recent conversation placeholders, and user profile.
- Add the top header and mobile sidebar drawer.
- Preserve semantic HTML and keyboard navigation.

### Phase 3: Initial Chat State

- Implement the centered database illustration.
- Add welcome copy describing what SQL Agent can do.
- Add suggested prompt cards using Ant Design X `Prompts` or a styled equivalent.
- Connect suggested prompts to the same send flow as manually typed prompts.
- Keep the composer visible near the bottom.

### Phase 4: Conversation State

- Map Vercel AI SDK messages into left/right chat bubbles.
- Render user messages on the right.
- Render assistant messages on the left with an agent avatar.
- Add loading and streaming feedback.
- Maintain automatic scrolling without disrupting users who have intentionally scrolled upward.
- Preserve whitespace and multiline response content.

### Phase 5: SQL-Specific Results

- Detect or explicitly model SQL code content where possible.
- Add syntax highlighting and a copy action.
- Add a reusable result table for structured query results.
- Design empty, loading, success, and error query states.
- Keep wide SQL and result tables horizontally scrollable on small screens.

### Phase 6: UX and Accessibility

- Support Enter to send and Shift+Enter for a new line.
- Disable sending for empty or whitespace-only input.
- Add visible focus states and accessible labels.
- Ensure all important controls are keyboard accessible.
- Verify color contrast in the dark theme.
- Respect reduced-motion preferences.
- Provide useful error and retry states.
- Test desktop, tablet, and mobile layouts.

### Phase 7: Verification

- Run linting.
- Run a production build.
- Test initial, loading, streaming, completed, empty, long-content, and error states.
- Check for hydration and React console warnings.
- Check that Ant Design styles render on the first server response.
- Verify responsive behavior at narrow and wide viewport sizes.
- Compare the result visually against the approved HTML prototype.

## Engineering Guardrails

- Preserve the existing AI SDK integration unless a change is required for the UI.
- Do not add Emotion or styled-components.
- Do not mix multiple independent theme definitions.
- Do not target private Ant Design DOM structure with fragile CSS selectors.
- Prefer Ant Design component tokens, semantic class/style APIs, and documented props for
  customization.
- Import only the components and icons that are used.
- Keep database credentials and model secrets on the server.
- Never render untrusted model-generated HTML directly.
- Keep SQL code and result rendering safe and escaped.
- Avoid unnecessary global CSS; use Tailwind, component tokens, or CSS Modules as appropriate.
- Validate the production build because CSS ordering and SSR behavior can differ from development.

## Acceptance Criteria

The UI implementation is complete when:

- The initial screen visually matches the approved dark prototype.
- The welcome illustration and supporting copy appear above the composer.
- Suggested prompts submit through the real chat flow.
- User messages are visually distinct and aligned to the right.
- Assistant messages are visually distinct and aligned to the left.
- Streaming and loading states feel stable and do not cause distracting layout shifts.
- SQL content is readable, copyable, and horizontally scrollable when necessary.
- Query results have a clear, reusable presentation.
- The layout is usable on desktop and mobile.
- Keyboard navigation and focus states work correctly.
- There are no hydration errors, first-render style flashes, or important console warnings.
- Linting and the production build pass.
- Emotion and styled-components are not present in the dependency tree as direct application
  dependencies.

## Reference Documentation

- [Next.js: CSS and Tailwind](https://nextjs.org/docs/app/getting-started/css)
- [Next.js: CSS-in-JS](https://nextjs.org/docs/app/guides/css-in-js)
- [Ant Design: Usage with Next.js](https://ant.design/docs/react/use-with-next/)
- [Ant Design: Theme customization](https://ant.design/docs/react/customize-theme/)
- [Ant Design: Migration from v5 to v6](https://ant.design/docs/react/migration-v6/)
- [Ant Design X: Introduction and components](https://x.ant.design/components/introduce/)

