# Kanban — Personal operations

A vanilla HTML/CSS/JavaScript Kanban workspace with IndexedDB persistence, a local Chrome AI assistant, and WebMCP board tools. All application source lives in **`docs/`**. There is no build step, backend, account, runtime dependency, or remote AI service.

## Run locally

Install [Node.js](https://nodejs.org/) 20 or newer, then run from this repository:

```sh
npm run dev
```

Open **http://127.0.0.1:4173** in desktop Chrome. No `npm install` is needed to run the app. Stop the server with Ctrl+C. Alternatively, serve `docs/` with any static HTTP server. Use localhost or HTTPS: JavaScript modules and the optional browser AI features require a served page; opening `index.html` as a `file:` URL is not supported.

## Using the board

- Start with empty **To Do**, **In Progress**, and **Done** columns. Add a card with **New card** or **Add card** inside a column.
- Open a card’s title to edit its required title, plain text description, column, optional assignee, and 1–10 colored labels. Click a label to rename it; Enter or clicking outside commits the name, Escape cancels. Labels on board cards save immediately; labels in the editor save with the card. Add/remove labels in the editor. Titles allow 160 characters, descriptions 5,000, assignees 80, and label names 40.
- Drag cards between columns or above/below another card. Use the card’s ↑/↓ controls to reorder with the keyboard; the card editor’s column selector moves it between columns.
- Use **Add column** or a column’s **···** button to add/rename a column or set its completion status. Drag a header to reorder columns, or use its ←/→ buttons. Column names allow 60 characters. The default Done column shows a checkmark on its cards; this status survives renaming.
- Search title/description and filter by label and assignee together. All three filters must match. **Clear filters** returns the complete active board.
- Switch between the reference [HMI theme](https://github.com/jpconstantineau/Design-md-prototype)’s light and dark palettes. The interface uses its flat outlined surfaces, compact controls, Segoe UI typography, and restrained state colors.

## Archive and restore

**Archive card** soft-deletes an individual card. **Archive column** hides the column and its attached cards together; it does not delete them or mark otherwise-active cards individually archived. The editor explains this behavior before archiving.

Open **Archive** to restore a whole column with its previously active cards, or restore one card on its own. A card returns to its original column if that column is active; otherwise it moves to the first active column. If every column is archived, restoring a card creates a new To Do column. An individually archived card stays archived when its column is restored. There is no permanent deletion.

## Local AI and WebMCP

**Enable local AI** checks Chrome’s [Prompt API](https://developer.chrome.com/docs/ai/prompt-api) and prepares its on-device model after a user gesture. Chrome may need an initial model download; progress is shown. Model and hardware availability depend on Chrome’s version, device resources, policy, and supported languages. The app requests English text input/output and reports unavailable or failed startup explicitly. Board editing remains fully available without AI.

After enabling, ask questions about the board or request a change. Responses stream into the right panel. Send with the button or Ctrl/Cmd+Enter; **Stop** cancels generation. The model can propose creating/editing/moving/archiving cards and creating columns. Every mutation requires confirmation showing the proposed fields. Validated tools use the same reducer and IndexedDB save path as the interface; model output and board descriptions are rendered as plain text. Clearing chat removes the saved transcript, leaving the board intact.

The page registers six [WebMCP imperative tools](https://developer.chrome.com/docs/ai/webmcp/imperative-api) when `document.modelContext` is available (with feature detection for the older `navigator.modelContext` shape): `list_board`, `create_card`, `update_card`, `move_card`, `archive_card`, and `create_column`. Unsupported WebMCP does not block local chat: the Prompt API uses structured JSON proposals with the same validated tool registry.

For inspection with Google’s [WebMCP reference extension](https://github.com/GoogleChromeLabs/webmcp-extension), follow that project’s current Chrome/flag requirements; its current setup uses Chrome 155+ and `chrome://flags/#enable-webmcp-testing`. This app’s structured-output chat does not require the experimental native tool-use flag or that extension. API support is feature-detected rather than assumed from the version number.

To bound local model context, each request supplies the most recent eight messages, up to 80 active cards, and the first 160 characters of each description. The full transcript and descriptions remain in IndexedDB. On larger boards, only the first 80 active cards are available to the assistant; use the normal board search and editor for cards outside that snapshot. No application data is sent to a remote AI endpoint.

## Persistence

Cards, ordered columns, archive status, theme, and chat history are stored in the browser’s **`local-kanban` IndexedDB database**. Saves wait for the transaction to commit before the UI reports success. Failed writes leave the previous saved board intact and show an error; invalid stored data is reported without resetting it.

Storage belongs to the exact browser profile and origin (scheme, host and port). Use the same URL to return to your board. Clearing site data, deleting the browser profile, or ending a private browsing session can remove it. Use one active board tab at a time; the workspace does not synchronize concurrent tabs or devices.

## Code structure

| File | Responsibility |
| --- | --- |
| `docs/index.html`, `docs/styles.css` | Semantic UI, native dialogs, responsive HMI theme |
| `docs/script.js` | UI events, queued persistence, modal drafts, feedback |
| `docs/state.js` | Validated immutable board actions, ordering, combined filters |
| `docs/storage.js` | IndexedDB snapshot reads/writes and transaction errors |
| `docs/view.js` | Safe DOM rendering, archive, inline label editor |
| `docs/drag.js` | Card and column native drag/drop |
| `docs/ai.js` | Prompt API lifecycle/chat and shared WebMCP tools |
| `scripts/serve.mjs` | Dependency-free local static server |
| `tests/` | State/tool unit tests and browser integration check |

## Verify

```sh
npm test
npm ci
npm run test:browser
```

The unit tests require only Node. `npm ci` installs the development-only Playwright dependency; the browser check uses installed desktop Chrome by default. Set `BROWSER_CHANNEL=msedge` to use installed Edge for core-board checks. The browser test starts and stops its own server on port 4174 and writes screenshots to ignored `test-results/`.

Coverage includes state validation, combined filters, ordering, archive recovery, tool confirmation/cancellation, stale tool targets, CRUD in Chrome, native drag/drop within/between columns and on headers, keyboard reorder, reload persistence, simulated storage failure, responsive layout, and unavailable AI. The AI browser check uses a deterministic model double to verify streamed structured output, WebMCP registration, approved mutations, and persisted chat. **Actual model inference and browser-agent discovery require a supported real Chrome setup and are not asserted by the automated tests.**

## GitHub Pages

In repository **Settings → Pages**, select **Deploy from a branch**, choose the branch, and select **`/docs`**. All assets use relative paths, so the app also works under the repository subpath. No GitHub Actions or build pipeline is required.
