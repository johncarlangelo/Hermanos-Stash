# Hermanos Stash — Design Direction

## Design goal

Create a premium utility workstation that feels designed, calm, and intentional.

It must not look like:

- a generic SaaS dashboard;
- a collection of AI-generated cards;
- an "online tools" directory;
- an overly futuristic hacker terminal;
- an OLED-black developer app.

## Visual personality

Keywords:

**quiet / capable / refined / technical / warm / precise**

The product should communicate:

> "This is a serious tool I can trust."

## Layout

Prefer a persistent application shell:

```text
┌─────────────────────────────────────────────────────────────┐
│  STASH / app controls                              window   │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│  Search      │   Current tool / category workspace          │
│              │                                              │
│  Favorites   │   focused content                            │
│              │                                              │
│  Recent      │                                              │
│              │                                              │
│  Categories  │                                              │
│              │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

The sidebar should be useful, not decorative.

Tool views should feel like focused workspaces rather than dashboard cards.

## Color

Use a layered dark palette rather than black:

- application background: deep charcoal;
- sidebar: slightly different charcoal;
- elevated surfaces: a little lighter;
- borders: subtle low-contrast neutral;
- primary text: soft near-white;
- secondary text: muted gray;
- accent: one restrained brand color.

Avoid pure `#000000` as the dominant background.

Do not assign a different bright color to every category.

## Typography

Prioritize:

- readable UI font;
- strong numerical hierarchy;
- restrained weights;
- compact labels;
- generous line height in explanatory copy.

Use typography to create hierarchy rather than huge cards.

## Surfaces

Use:

- subtle borders;
- modest radius;
- restrained elevation;
- occasional soft shadow.

Avoid stacking rounded rectangles inside rounded rectangles indefinitely.

## Motion

Motion should answer one of these questions:

- What changed?
- Where did this come from?
- Is the system working?
- Can I interact with this?
- Did the operation succeed?

Preferred:

- 120–220ms microinteractions;
- opacity/transform transitions;
- subtle hover states;
- smooth panel transitions;
- progress animation;
- drag/drop state transitions.

Avoid:

- constant floating elements;
- animated gradients;
- excessive spring physics;
- decorative motion.

Respect reduced-motion preferences where applicable.

## Tool workspace pattern

A typical tool should have:

1. title + short explanation;
2. input area;
3. options;
4. primary action;
5. processing state;
6. result state;
7. secondary actions;
8. relevant help/error message.

Do not force every tool into an identical visual template when the interaction model genuinely differs.

## Drag/drop

Drag/drop is a major product interaction.

States should be obvious:

- idle;
- valid target;
- invalid file;
- processing;
- success;
- error.

The drop zone should not look like a giant generic dotted rectangle by default. Use context-sensitive, compact drop surfaces where appropriate.

## Search

Search should feel like a command center, not a form field.

Search results should show:

- tool name;
- category;
- concise description;
- useful tags;
- favorite state;
- optional keyboard hint.

Support fuzzy matching.

## Empty states

Never use:

> "No data found."

Prefer useful guidance that tells the user what they can do next.

## Accessibility

Minimum requirements:

- keyboard navigation;
- visible focus states;
- semantic controls;
- sufficient contrast;
- no color-only status indicators;
- sensible screen-reader labels;
- reduced-motion support;
- clear error messages.

## Anti-AI-slop rules

Reject design choices that exist only because they are common in generated UI examples.

Before adding a visual element ask:

> Does this improve orientation, hierarchy, interaction, or feedback?

If not, remove it.
