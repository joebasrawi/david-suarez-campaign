# Civic Network design QA

## Compared artifacts

- Selected agenda direction: `/Users/joe/.codex/generated_images/01a06d30-4655-7692-aa71-f2fe4a29a919/exec-2061be98-f076-426a-a18f-75ad9c7e27a2.png`
- Implementation: `http://127.0.0.1:4173/commission-agenda/?item=R5P`
- Combined comparison: `http://127.0.0.1:4173/work/qa/agenda-comparison.html`
- Reference and implementation were reviewed together in one comparison input using the same 1440 × 1024 target state.

## Findings and fixes

1. **P1 · Agenda hierarchy:** The first implementation used an oversized navy meeting banner that displaced the core reader. It was replaced with the selected direction’s compact cream meeting header, official-source panel, filter row, section tabs, and split list/detail workspace.
2. **P1 · Sponsor integrity:** Concept imagery could not be treated as sponsor identity. Production sponsor cards now resolve only against the official City of Miami Beach elected-official roster and use City-hosted portraits plus official profile links. Unresolved names never receive a portrait.
3. **P1 · Data completeness:** The prior homepage snapshot exposed only David-sponsored items. The reader now imports all 142 agenda items and all six source sections, while the homepage still highlights the 19 David-sponsored or co-sponsored items.
4. **P2 · Hero composition:** The featured story’s left-side text field obscured the official YouTube thumbnail and cropped the right-hand subject. Text was moved into a compact lower field and the image now uses the complete 16:9 thumbnail without a cover crop.
5. **P2 · Naming:** The visible video series label and supporting library copy now use “Accountability” instead of “Investigations.”

## Final verification

- The source sync reports 142 parsed items, matching the meeting-page count exactly.
- Section totals resolve to 6 competitive bid reports, 6 committee assignments, 2 committee reports, 60 consent resolutions, 44 ordinances, and 24 regular resolutions.
- Search, department, neighborhood, hearing-time, status, section, and David-only controls are wired to the same filtered item collection.
- Direct item URLs preserve selection through `?item=` and update as residents move between items.
- Item R5P correctly resolves the official David Suarez and Alex J. Fernandez portraits, City profiles, City Attorney department, Citywide neighborhood, and 9:55 a.m. hearing time.
- The PrimeGov meeting stays labeled as the legal source; Miami Beach Agenda stays labeled as the navigation layer.
- Static data validation, JavaScript syntax checks, and whitespace checks pass.

final result: passed
