Build a Kanban web app using vanilla HTML, CSS, and JavaScript.

Goal:
Create a polished, usable Kanban board for personal task management that is AI enhanced with a local AI. 

Prioritize working features, clear UX, and maintainable code over unnecessary complexity. This should feel like a real small product, not a demo with placeholder behavior.

Technical requirements:
- Use only vanilla HTML, CSS, and JavaScript (no React, Vue, Svelte, etc.).
- You may use small third-party libraries where they add clear value (for example, a drag-and-drop helper), but the app logic should remain in your own JS.
- The app must run locally without a backend:
  - either by opening a single HTML file, or
  - via a simple dev setup (for example: npm run dev with Vite or similar).
- Persist all board data such as Cards, preferences and chat history in IndexedDB in the chrome browser. 
- Include a README with:
  - how to run the app
  - feature overview
  - brief notes on code structure

Core features of Main Page (The main page is the kanban itself.):

1. Board & columns
   - Default columns: "To Do", "In Progress", "Done".
   - Add, rename, reorder, and delete columns.
   - Reorder columns via drag-and-drop on column headers.
   - Deleting a column should not silently destroy its cards (move them to archive or prompt the user — explain behavior in the README).

2. Cards
   - Create, edit, and delete cards within columns.
   - Each card must include:
     - title (required)
     - description (plain text area — no Markdown rendering required)
     - one or more colour-coded labels
     - optional assignee name
   - Cards in the "Done" column should show a visible completion indicator (for example, a checkmark on the card).
   - Drag and drop cards:
     - between columns
     - reorder within a column

3. Archiving
   - Soft-delete cards and/or columns to an archive area.
   - Archived items can be viewed and restored.
   - Permanent delete is optional but archive must exist.

4. Search & filtering
   - Search bar filters cards by title and description.
   - Filter by label (colour/category).
   - Filter by assignee.
   - Filters should combine sensibly (search + label + assignee together).

5. Theme
   - Dark/light mode toggle.
   - Consistent styling across the whole app.  
   - Persist theme preference across reloads.
   - The page will have a dark and light mode and the style use should be that of the "HMI" theme in this repo: https://github.com/jpconstantineau/Design-md-prototype  

6. AI Chat
   - The side panel to the right is the Chat Window with the Local AI
   - WebMCP's Chrome features are used to make actions on the page available to the LLM.  
   - The page uses Chrome's Prompt API for the chatbot and LLM.  You can use https://github.com/GoogleChromeLabs/webmcp-extension as a reference implementation.   


UX expectations:
- The app should be understandable without instructions.
- Use clear empty states (empty board, empty column, no search results).
- Card editing should be easy (modal). When clicking a label, it should change to a text box for the user to edit. When clicking outside, it should update, save and be shown as a label again.
- Provide visible feedback for actions (add, archive, delete, save).
- Keyboard and mouse should both work for normal use; full accessibility compliance is not required.
- Use the modern-web-guidance and ponytail skills

Code quality expectations:
- Organize code into clear modules/files rather than one giant script.
- Separate concerns where reasonable (state, DOM/rendering, persistence, drag-and-drop, filters).
- Use readable names and avoid hard-coded magic values scattered everywhere.
- No dead features: if assignee filtering exists, assignee must be editable on cards.

Scope guidance:
- Do NOT build: user accounts, backend API, real-time collaboration, notifications, or mobile apps.
- Do NOT spend time on auth, deployment, or CI unless core features are complete.
- Simple, clean UI is preferred over flashy but fragile UI.

Deliverables:
- All source files needed to run the app should be in /docs
- README with run instructions
- App works end-to-end without manual code edits


Before finishing, review the code to confirm:
- Drag-and-drop handlers are wired for cards (between and within columns) and column header reorder
- Column add/rename/reorder/delete is implemented (including safe handling when deleting columns with cards)
- Cards include title, plain description, tags, and assignee; Done column shows a completion indicator
- Archive and restore flow is implemented
- Search and filters (label, assignee) combine correctly in the filtering logic
- Dark/light mode and board data persist
- README includes run instructions and feature overview 