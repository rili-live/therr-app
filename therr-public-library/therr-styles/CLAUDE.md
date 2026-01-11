# Claude Code Instructions - therr-styles

## Package Overview

- **Type**: Shared SCSS/CSS library
- **Purpose**: Design system variables, mixins, and compiled styles for web clients
- **Consumers**: therr-client-web, therr-client-web-dashboard, therr-react

## Directory Structure

```
lib/
├── _variables.scss      # Color palette, spacing, animation vars
├── _helpers.scss        # SCSS mixins and utilities
├── index.scss           # Main entry point
├── index.css            # Compiled CSS bundle
├── forms/               # Form-specific styles
├── buttons.scss/css     # Button styles
├── layout.scss/css      # Layout utilities
├── pagination.scss/css  # Pagination styles
├── spinner.scss/css     # Loading spinner
├── accessibility.scss/css # A11y utilities
└── ...
```

## Key Variables

### Color Palette

| Variable | Value | Purpose |
|----------|-------|---------|
| `$therr-black` | #021010 | Primary dark |
| `$therr-white` | #dee1e4 | Primary light |
| `$therr-primary-1` | #075248 | Primary brand (teal) |
| `$therr-primary-4` | #b14419 | Accent (orange) |
| `$therr-secondary-3` | #f96e6f | Highlight (coral) |
| `$therr-alert-success` | #60796e | Success states |
| `$therr-alert-error` | #d72c4b | Error states |
| `$therr-link-1` | #2073a1 | Link color |

### Animation

| Variable | Value |
|----------|-------|
| `$animation-duration-1` | 250ms |
| `$animation-duration-2` | 500ms |

## Usage in Web Clients

### Import SCSS Variables

```scss
@import 'therr-styles/lib/variables';

.my-component {
    background: $therr-primary-1;
    color: $therr-white;
}
```

### Import Compiled CSS

```javascript
import 'therr-styles/lib/index.css';
```

## Build

```bash
npm run build  # Compiles SCSS to CSS
```

## Important Notes

- **Web only**: These styles are for web clients, not React Native
- Mobile app has its own theming system in `TherrMobile/main/styles/themes/`
- Variables use `!default` flag for override capability
- Compiled CSS is checked into git (`lib/*.css`)

## Code Quality

Before completing code changes, validate SCSS syntax:

```bash
npm run build   # Compile SCSS - will fail on syntax errors
```

See root `CLAUDE.md` for full code quality requirements.
