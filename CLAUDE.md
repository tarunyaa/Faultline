# Faultline Development Rules

## Core Principles

### Avoid Overengineering
- Prefer the simplest solution that solves the problem
- Don't add abstractions, helpers, or utilities for one-time operations
- Don't design for hypothetical future requirements
- Three similar lines of code is better than a premature abstraction

### Feature Development Process
When implementing new features, ALWAYS follow this process:

1. **Understand First**
   - Ask clarifying questions about requirements
   - Identify ambiguities and edge cases
   - Understand the existing codebase context

2. **Critique & Analyze**
   - Identify multiple possible implementation approaches
   - Critically evaluate each approach for:
     - Complexity vs. benefit tradeoff
     - Integration with existing architecture
     - Potential failure modes
     - Maintenance burden
   - Question assumptions in the requirements

3. **Propose Minimal Solution**
   - Present the most robust, minimal implementation
   - Explain tradeoffs clearly
   - Identify what is NOT being built and why

4. **Plan Before Implementing**
   - Use EnterPlanMode for non-trivial features
   - Get user sign-off on approach before writing code
   - Document key architectural decisions

5. **Implement**
   - Only after user approves the plan
   - Stick to the approved scope
   - No surprise additions or "improvements"

## UI/UX Guidelines

### Theme & Aesthetic
- **Color Palette**: Black, Red, White only
- **Aesthetic**: Playing cards theme
- All frontend work MUST follow this consistent design language
- Reference existing components for styling patterns

### Component Development
- Match the visual style of existing UI components
- Use Tailwind CSS classes that align with the theme
- Dark backgrounds, red accents, white text
- Card-like layouts and interactions

## What NOT to Do

- ❌ Don't implement features without discussing approach first
- ❌ Don't add "nice to have" features beyond scope
- ❌ Don't create abstractions before they're clearly needed
- ❌ Don't use colors outside the black/red/white palette
- ❌ Don't add extensive error handling for impossible scenarios
- ❌ Don't create utilities/helpers for one-off operations
