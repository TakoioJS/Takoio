# Task 2 Report: Style Optimization for External Forms & Toolbar

## Status
DONE

## Objectives Completed
1. **Toolbar Styling**:
   - Added a `1px` border-top separator (`border-top: 1px solid var(--tk-border-light)`) between the text area and the bottom toolbar.
   - Used negative margins (`margin-left`, `margin-right`, `margin-bottom`) to pull the toolbar and its border-top separator to the very edges of `.tk-submit-card`, matching the high-fidelity `comment-input.html` mockup.
   - Made the text area container borderless and transparent inside `.tk-submit-card` so the card itself acts as the main boundary, avoiding nested borders.
   - Refined the upload button (`.tk-btn-icon-ghost`) styling (size `28px * 28px`, opacity `0.55`) to perfectly match the layout, sizes, and hover states of the markdown toolbar buttons.
   - Ensured the toolbar fits neatly and wraps correctly on responsive screens (mobile breakpoint margin offsets matching card paddings).

2. **External Forms Styling**:
   - Conditioned the guest comment button (`.tk-btn-guest-toggle`) to hide when `isGuestActive` is true, ensuring it is only shown when the form is in its default state (mimicking `comment-input.html` and `comment-input-guest.html` transitions).
   - Styled `.tk-btn-guest-toggle` as a clean, rounded-pill with light border and appropriate theme hover/focus transitions.
   - Updated `.tk-input` to use the theme input background `var(--tk-bg-input)` and border `var(--tk-border-light)` with `10px 14px` padding to match mockup specifications.
   - Structured spacing and layout under the card container for `.tk-guest-info`, `.tk-meta-row`, and `.tk-auth-meta` using sibling margin selectors.

## Verification & Testing
- Run `pnpm type-check`: Passed with no errors.
- Run `pnpm test`: 620/620 passing successfully, 1 skipped.
