# UI Plan

## 1. Purpose

This document defines the frontend UI strategy for the SQL Agent application. The UI must remain visually flexible without coupling presentation changes to chat streaming, AI tool calling, or database functionality.

The static design in `html-pages/index.html` remains the visual reference. It is a reference implementation, not the final React component architecture.

## 2. Target UI stack

The application UI will use:

- **React and Next.js App Router** for application rendering and component composition.
- **Ant Design** for mature, accessible interactive UI primitives.
- **Tailwind CSS** for layout, responsive behavior, spacing, colors, typography, and application-specific styling.
- **Semantic HTML** for document structure and chat-specific elements where an Ant Design component adds no value.

Emotion and styled-components will not be added.

## 3. Current implementation status

Tailwind CSS is installed and imported globally, but the current chat interface primarily uses `components/chat/chat.module.css`.

Ant Design is not currently installed. The existing CSS Modules implementation was created by translating the custom styles from `html-pages/index.html` so that the reference design could be reproduced quickly.

The current component separation is still valuable: chat state and behavior live outside the presentation components. During migration, the public component props and callbacks should remain stable wherever possible.

## 4. Styling responsibilities

### Ant Design

Use Ant Design for established interactive controls and behavior that should not be rebuilt manually:

- `Button` for actions such as send, stop, retry, and new conversation.
- `Input.TextArea` for the chat composer.
- `Tooltip` for icon-only controls.
- `Drawer` for the mobile sidebar.
- `Avatar` for the user and SQL Agent identities.
- `Spin` or `Skeleton` for loading states.
- `Alert` for recoverable error states.
- `Table` for structured database-result views.

Ant Design is not required for every element. Chat bubbles, tool activity cards, message groups, and page-specific compositions should remain application components.

### Tailwind CSS

Use Tailwind utilities for:

- Grid and flex layouts.
- Width, height, padding, margin, and gaps.
- Responsive desktop and mobile behavior.
- Colors, borders, shadows, and backgrounds.
- Typography and text truncation.
- Chat-bubble alignment and appearance.
- Tool-result card presentation.
- Small transitions and interaction states.

Repeated visual decisions should be represented by shared theme values or reusable components rather than duplicated utility strings across the application.

### Semantic HTML

Continue using elements such as `main`, `aside`, `section`, `article`, `header`, and `div` where they correctly express the document structure. Ant Design complements semantic HTML; it does not replace every layout element.

## 5. Why Emotion and styled-components are excluded

Tailwind already provides the custom styling layer required by the application. Adding Emotion or styled-components would create another styling system, increase the dependency and runtime surface, and make styling ownership less clear without providing a necessary capability.

Ant Design uses its own component-level styling implementation internally. This does not require application code to adopt Emotion, styled-components, or Ant Design's internal CSS-in-JS APIs for custom components.

The intended styling model is:

```text
Ant Design components -> built-in component behavior and styling
Tailwind CSS          -> application layout and custom presentation
Semantic HTML         -> page and chat structure
Emotion/styled        -> not used
```

## 6. Component architecture

The UI must preserve a container/presentation boundary:

```text
app/page.tsx
    |
    | chat state, AI SDK integration, message adaptation, event handlers
    v
ChatWorkspace props
    |
    | presentation composition
    v
Ant Design primitives + Tailwind classes + semantic HTML
```

`app/page.tsx` remains responsible for:

- AI SDK chat state.
- Submitting and stopping messages.
- Retrying failed requests.
- Starting a new conversation.
- Converting AI SDK messages and tool calls into UI view models.

Components under `components/chat/` remain responsible for:

- Rendering the sidebar, header, welcome state, messages, tool activity, and composer.
- Applying Ant Design components and Tailwind styling.
- Managing presentation-only state such as whether the mobile drawer is open.
- Emitting typed callbacks without knowing how AI requests or database tools work.

Presentation components must not import database, Prisma, repository, AI model, or Route Handler modules.

## 7. Planned component mapping

| Application component | Ant Design primitives | Tailwind responsibility |
| --- | --- | --- |
| `ChatWorkspace` | `ConfigProvider`, optional `App` | Full-height shell and responsive layout |
| `ChatSidebar` | `Drawer`, `Button`, `Avatar`, `Tooltip` | Desktop sidebar layout and branded presentation |
| `ChatHeader` | `Button`, `Tooltip`, optional `Badge` | Header sizing, dividers, and responsive visibility |
| `ChatWelcome` | `Button` or semantic cards | Suggestion grid and decorative presentation |
| `ChatMessages` | `Avatar`, `Spin`/`Skeleton`, `Alert`, `Button` | Message alignment, bubbles, and tool cards |
| `ChatComposer` | `Input.TextArea`, `Button`, `Tooltip` | Composer container, sizing, and helper text |
| Database viewer | `Tabs`, `Table`, `Empty`, `Spin` | Page shell and responsive spacing |

The exact component choice should be based on behavior. A component should not be introduced only to eliminate a normal semantic element.

## 8. Theme strategy

Use Ant Design `ConfigProvider` theme tokens as the source of truth for Ant Design component styling, including:

- Dark color algorithm.
- Primary/accent color.
- Text and muted-text colors.
- Surface and container colors.
- Border colors.
- Border radius.
- Font family.
- Control heights.

Mirror the important product-specific values in Tailwind theme variables so Ant Design controls and custom chat elements appear as one design system.

Avoid targeting undocumented Ant Design internal DOM selectors such as deeply nested `.ant-*` structures. Prefer theme tokens, component APIs, `className`, `classNames`, and supported `styles` properties. This reduces breakage during Ant Design upgrades.

## 9. Tailwind and Ant Design compatibility

Ant Design and Tailwind can be used together, but their CSS priority must be configured deliberately.

During implementation:

1. Follow Ant Design's current Next.js App Router integration guidance.
2. Configure Ant Design's supported CSS layer mechanism so Tailwind application styles can override component defaults predictably.
3. Define the global CSS layer order before Ant Design's runtime styles are injected.
4. Verify that Tailwind Preflight does not unintentionally alter Ant Design controls.
5. Confirm server-rendered styles do not flash or change after hydration.

References:

- [Ant Design with Next.js](https://ant.design/docs/react/use-with-next/)
- [Ant Design style compatibility](https://ant.design/docs/react/compatible-style/)
- [Ant Design server-side rendering](https://ant.design/docs/react/server-side-rendering/)

## 10. Migration plan

### Phase 1: foundation

1. Install a stable Ant Design version compatible with the project's React and Next.js versions.
2. Add only the required companion package when mandated by Ant Design's official App Router integration.
3. Configure the root Ant Design provider and dark-theme tokens.
4. Configure CSS layer ordering for Ant Design and Tailwind.
5. Establish shared application color and spacing variables.

### Phase 2: component migration

Migrate one presentation component at a time in this order:

1. `ChatComposer`.
2. `ChatHeader`.
3. `ChatSidebar` and its mobile drawer.
4. Loading and error states in `ChatMessages`.
5. Welcome suggestion controls.
6. Database viewer tabs and tables.
7. Remaining chat-specific visual elements.

Keep component interfaces stable during this phase. Do not change the AI SDK message flow merely to accommodate a visual component.

### Phase 3: CSS cleanup

1. Confirm visual parity with `html-pages/index.html` at desktop and mobile sizes.
2. Remove CSS Module rules only after their replacements are verified.
3. Retain minimal global CSS for Tailwind imports, layer ordering, resets, and true global defaults.
4. Remove `chat.module.css` when no component imports it and no required styles remain.

## 11. Performance guidelines

- Import Ant Design components through supported module imports and allow the framework to tree-shake unused code.
- Keep client-component boundaries as narrow as practical.
- Do not move server-only database or AI logic into UI components.
- Avoid adding multiple runtime styling libraries.
- Prefer theme tokens and Tailwind utilities over frequently recalculated inline style objects.
- Preserve streamed chat rendering and avoid rerendering the entire message history for presentation-only state changes.
- Measure bundle size before and after migration rather than assuming the component library has no cost.

## 12. Accessibility requirements

- Preserve keyboard submission and multiline input behavior.
- Give icon-only buttons accessible names and tooltips.
- Maintain a visible keyboard focus indicator. Focus styling may match the design but must not be removed without an accessible replacement.
- Mark streaming and loading states appropriately for assistive technologies.
- Keep sufficient text and control contrast in the dark theme.
- Ensure the mobile drawer traps and restores focus correctly through Ant Design's supported behavior.
- Use semantic landmarks and headings where appropriate.

## 13. Verification

Every migrated component should pass:

- ESLint.
- TypeScript type checking.
- Existing chat and SQL-agent tests.
- Production build validation.
- Desktop and mobile visual comparison against `html-pages/index.html`.
- Keyboard-only interaction testing.
- Streaming, stopping, retrying, and new-conversation behavior checks.
- Loading, empty, success, and failure state checks.

## 14. Acceptance criteria

The migration is complete when:

1. Ant Design is used for suitable interactive primitives.
2. Tailwind owns application-specific layout and visual styling.
3. Emotion and styled-components are not application dependencies.
4. Chat functionality and AI tool calling behave exactly as before the migration.
5. Presentation components remain reusable through typed props and callbacks.
6. The resulting interface maintains visual parity with the approved static reference.
7. The UI works across supported desktop and mobile viewports.
8. CSS Module styling for the chat is removed once it is no longer needed.
