# MyBookmarks

A keyboard-first personal bookmark homepage available as a single local HTML file or on GitHub Pages. No account, extension, or backend is required. Keep bookmarks in browser storage or autosave them to a JSON file on your computer.

---

## Purpose

Most browser bookmark managers are designed for pointing and clicking. MyBookmarks is designed for people who prefer to keep their hands on the keyboard — particularly developers who maintain separate bookmarks for DEV, QA, and PROD environments and want to navigate between them quickly.

The page is meant to be set as your browser's homepage or new tab page. You open a tab, type a few characters, and hit Enter. That's it.

---

## How to Use

### Choose How to Run It

#### Hosted version (recommended)

Open [MyBookmarks on GitHub Pages](https://wbroder.github.io/MyBookmarks/). To use it as your startup page in Chrome, go to **Settings → On startup → Open a specific page** and add:

```
https://wbroder.github.io/MyBookmarks/
```

#### Local file version

1. Download [index.html](index.html) and save it somewhere permanent, such as `Documents/MyBookmarks/index.html`.
2. In Chrome, go to **Settings → On startup → Open a specific page** and add the file URL, for example:
   ```
   file:///C:/Users/yourname/Documents/MyBookmarks/index.html
   ```

> **Note:** The local and hosted versions use separate browser storage. Use Export/Import to move bookmarks, or connect the same JSON file wherever file access is supported. File permissions are granted separately for each page origin. Clipboard paste uses the **paste from clipboard** button. Fonts and favicons require an internet connection.

---

### Adding Bookmarks

Press **Ctrl+Shift+A** (or click the `+` button) to open the Add Bookmark modal.

| Field | Description |
|---|---|
| Title | Display name shown in the list |
| URL | Full or bare domain (e.g. `github.com` — `https://` is added automatically) |
| Category | Freeform label shown as a badge (e.g. `Dev`, `Work`) |
| Environment | `PROD`, `QA`, or `DEV` — colors the left border of the row |
| Tags | Comma-separated, used by search |
| Icon | Auto-detected, manually picked from a grid, or disabled |

**Shortcuts for faster entry:**
- **Drag a browser tab** onto the drop zone to auto-fill the URL and guess the title from the hostname.
- **Paste from clipboard** button reads a URL from your clipboard and does the same.

### Editing & Deleting Bookmarks

Press **Ctrl+Shift+E** while a bookmark is highlighted (use ↑↓ to navigate) to open the edit modal. The same modal is used for editing and for new bookmarks. A red **Delete** button appears when editing an existing entry.

### Searching

Start typing anywhere on the page — the search bar focuses automatically.

- Each space-separated word must appear as an exact substring somewhere in the bookmark's title, URL, tags, category, or environment field.
- Words can match in any order: `"stack over"` matches `"Stack Overflow"`, `"over stack"` also matches.
- Typos do **not** match — `"stck"` does not match `"Stack"`.
- Matching characters are highlighted in the results.
- Results are ranked: matches at word boundaries (e.g. the start of a word) score higher than mid-word matches.

### Filtering by Category

Use **← / →** to cycle through categories, or click a category above the results. The list starts with **All**, followed by categories in alphabetical order (ignoring case), and **Uncategorized** last when any bookmarks have no category. Categories differing only in capitalization or surrounding spaces share a filter.

Navigation wraps at either end. Categories remain visible in the same order while searching, including categories with no matches. Your query is preserved when you switch categories, and the first matching bookmark is highlighted. The bookmark count and **current filter** export reflect both filters.

When the search field has focus and contains text, Left/Right move the text cursor as usual. Click a category or move focus outside the search field to change categories while keeping your query. Modified arrows, such as Alt+Left/Right, retain their usual behavior. Category shortcuts are inactive inside modals.

Press **Esc** to clear a query while keeping the category; press it again to return to **All**. Each page load starts on **All**. If editing, deleting, or importing bookmarks removes the selected category, the filter returns to **All** automatically.

### Keyboard Reference

| Key | Action |
|---|---|
| `↑` / `↓` | Navigate through results |
| `←` / `→` | Previous / next category (when search is empty or unfocused) |
| `↵` | Open highlighted bookmark |
| `Shift+↵` | Open in a new tab |
| `Esc` | Clear search, then reset category to All; close an open modal |
| `Ctrl+Shift+A` | Add a new bookmark |
| `Ctrl+Shift+E` | Edit the highlighted bookmark |

### Environment Color Coding

Bookmarks with an environment set display a colored left border and a badge:

| Environment | Color |
|---|---|
| PROD | Amber |
| QA | Purple |
| DEV | Blue |

This makes it easy to scan a list of same-named services across environments without reading closely.

---

## Storage Options

Open **⚙ → Save bookmarks to**. Use the **browser / JSON file** toggle to choose a destination. File controls only appear under JSON file; browser storage remains active until a file is successfully connected. Both modes are local to your computer and use the same JSON array format, including categories, environments, tags, and icons.

Settings scroll inside the panel, with the title and Close button kept visible. Zoom, both export options, and Import remain available. The storage summary shows bookmark count, size, and location; less common file and deletion actions are expandable.

### Browser storage (default)

Bookmarks stay in the current browser profile's `localStorage`. No file permissions are needed. Clearing only cached images/files normally leaves them intact, but clearing site data or deleting the profile removes them. Export backups regularly.

### Local JSON file

Use desktop Chrome or Edge in a context that supports the File System Access API; the HTTPS GitHub Pages version is the recommended entry point. File buttons are disabled when the API is unavailable. No bookmark data is uploaded to GitHub or a database service.

1. Select **JSON file**, then **choose JSON file** to load an existing collection or exported backup. To copy your current bookmarks into a new `bookmarks.json`, expand **create a new file…** and click **create JSON file**. Once connected, that section becomes **new or different file…** and also offers **choose different file**.
2. Select a local file and allow editing when the browser asks. Choose **Allow on every visit** when offered; this option may appear on a later visit. See [Chrome's persistent permission behavior](https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api).
3. Add, edit, delete, import, or clear bookmarks normally. Each successful action saves directly to that file; no new permission prompt is requested for routine changes while access remains granted.

Settings shows the active storage location, saving progress, and any errors. Save errors also appear as toast notifications. A change is only reflected in the list after the save succeeds. Keep the page open until saving finishes.

**Opening and reconnecting never overwrite the file.** They load its contents first, including an intentionally empty `[]` collection. A malformed file is rejected without changing your active collection. Creating a file at an existing nonempty destination requires confirmation before replacing its contents.

The app remembers the connection locally and tries to reopen it on your next visit. If access expires or the file is unavailable, the last cached collection remains available for browsing/export, but file edits are blocked. The same file button changes from **choose JSON file** to **reload file** when connected, or **reconnect file** when access is needed. Click it to approve access if necessary and read the file again. If the connection cannot be remembered, a message explains that you must choose it again next time.

**After clearing site data:** the file remains on disk. Select **JSON file → choose JSON file**, select that same file, and approve access if prompted. Starter bookmarks will not replace its contents.

**Switching back:** selecting **browser** copies the displayed collection into browser storage after confirmation, replacing its previous collection. Cancelling keeps JSON file selected. The JSON file remains unchanged and stops receiving edits. Opening a JSON file does not overwrite the existing browser collection. To combine the two collections, export one and use **Import → merge** in the other.

If another tab or program has changed the file since it was loaded, saving stops with a reload message. The app coordinates its own saves across tabs when browser Web Locks are available; avoid editing the same file simultaneously from different browsers or other programs.

## Backup & Restore

**To export a backup:** Click the ⚙ button → Export → "all bookmarks ↓". This downloads a dated `.json` file.

**To export only the current results:** Select a category and/or run a search, then click "current filter ↓".

**To restore from a backup:** Click ⚙ → Import → paste the JSON array → choose:
- **Merge** — adds new entries, skips any URLs that already exist
- **Replace all** — wipes existing bookmarks and loads the import

Import and export work in both storage modes. Import saves to the active destination; exporting only downloads a separate copy and does not switch modes. Invalid entries reject the whole import, and `[]` is a valid empty collection.

**Recommendation:** Keep an occasional separate backup, even in file mode, to recover from accidental edits or deletion.

---

## Zoom

The page zoom level is saved per machine in localStorage under the key `mybookmarks_zoom`. Open ⚙ → Zoom to adjust it with a slider. Each device keeps its own independent zoom preference.

---

## How It Works — Technical Reference

### Architecture

MyBookmarks is a single HTML file with no build step, runtime package dependencies, or application server. Bookmark storage stays local; network requests load fonts and favicons. The entire application is:

```
index.html
  ├── <style>        — all CSS, organized by component
  ├── <body>         — static HTML structure (modals, search bar, hint bar)
  └── <script>       — all application logic
```

### Data Model

A bookmark is a plain JavaScript object with the following shape:

```json
{
  "title":    "My App",
  "url":      "https://myapp.company.com",
  "category": "App",
  "env":      "prod",
  "tags":     ["app", "admin"],
  "icon":     ""
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | ✅ | Display name |
| `url` | string | ✅ | HTTP or HTTPS URL; bare domains get an `https://` prefix |
| `category` | string | — | Shown as a grey badge |
| `env` | `"prod"` \| `"qa"` \| `"dev"` | — | Controls row color |
| `tags` | string[] | — | Used by search |
| `icon` | string | — | Omit = auto favicon, `""` = no icon, URL string = explicit icon |

### Storage

| Key | Value | Purpose |
|---|---|---|
| `mybookmarks_v1` | JSON array of bookmark objects | Browser-mode collection |
| `mybookmarks_zoom` | Number (70–150) | Zoom percentage for this machine |
| `mybookmarks_storage_mode` | `browser`, `file`, or `file-disconnected` | Active storage preference |
| `mybookmarks_file_cache` | JSON array of bookmark objects | Last loaded/saved file collection, for read-only use while disconnected |

These keys live in browser-local `localStorage`, scoped to the profile and page origin. File-mode data is authoritative on disk; its browser cache never silently overwrites a reconnected file. A browser-local IndexedDB database, `mybookmarks_files`, stores the selected `FileSystemFileHandle` in `connections/active`. It is only a remembered file connection, not an external database. Clearing site data removes these browser records, not the user-selected file.

`updateBookmarks(transform)` is the shared asynchronous mutation boundary for both modes. File saves check permission and compare current file text with the last loaded snapshot before writing, then await stream closure before updating the UI/cache. Browser saves check storage errors before updating the UI. `parseBookmarkData()` validates both files and pasted imports. File picker and permission requests run only from explicit user actions.

### Tests

Run `node --test tests/bookmarks.test.cjs` with Node.js. The suite runs the actual inline application script in an in-memory DOM/storage harness and simulates file permissions, save failures, reconnects, mode switching, and concurrent tabs. Native Chrome picker/permission dialogs still require browser testing.

### Search Algorithm

Search is performed by `scoreSearch(haystack, query)`:

1. The query is split on whitespace into individual terms.
2. For each term, every occurrence in the haystack string is located using `String.indexOf()`.
3. A match at a word boundary (start of string, or preceded by space, dash, underscore, dot, or slash) scores double (`term.length * 2`) versus a mid-word match (`term.length`).
4. If any term is not found at all, the entire query returns `null` (no match).
5. The final score is the sum of best-match scores across all terms.

Results are sorted descending by score before rendering. This means boundary matches (e.g. searching `"git"` matching the start of `"GitHub"`) rank above mid-word matches.

The search runs across a combined string of: `title + tags + category + env + url`. Title matches are re-scored separately so that highlight indices correspond only to the title text shown in the row.

### URL Normalization

`normalizeUrl(raw)` is called everywhere a URL is used:

1. Trims whitespace and strips trailing slashes.
2. If the string already starts with `http://` or `https://`, validates it with `new URL()` and returns it unchanged, or returns `""` if invalid.
3. Otherwise, prepends `https://` and validates. Returns `""` if still invalid.

This means users can type `github.com` and the stored URL will be `https://github.com`.

### Favicon Loading

Each bookmark row renders a favicon `<img>` with:
- `src` set to `https://www.google.com/s2/favicons?domain={host}&sz=32`
- `data-url` set to the bookmark's full URL

After each render, `patchFavicons()` attaches an `error` event listener to every favicon image. If the Google service fails, the listener replaces `src` with DuckDuckGo's favicon API (`https://icons.duckduckgo.com/ip3/{host}.ico`). If that also fails, the image is hidden with `visibility: hidden` (preserving layout space).

### Rendering

`renderBookmarkList(items, query)` builds the results list:

1. Sets `filtered` and `activeIdx` state.
2. Maps each item to an HTML string via `buildBookmarkRow()`.
3. Sets `container.innerHTML` to the joined strings.
4. Calls `attachRowEventListeners()` to wire up click handlers and favicon patching.

The first row (`i === 0`) always starts with the `active` class, keeping the keyboard focus on the top result.

### Modal System

Both modals (add/edit bookmark and settings) share:
- A `.modal-overlay` div that covers the full viewport
- An `.open` class toggled by `openX()` / `closeX()` functions
- A mousedown-origin check to prevent accidental closes when the user selects text inside the modal and releases the mouse outside of it

The mousedown check works by recording whether `mousedown` fired on the backdrop itself (not the modal inner div). The `click` handler only closes the modal if that flag is true.

### Zoom

`applyZoom(percent)` sets the CSS custom property `--zoom` on `document.documentElement`, which is picked up by `html { zoom: var(--zoom); }`. The value is also saved to `localStorage` immediately.

On boot, `initZoom()` reads the saved value (defaulting to 100%) and applies it before the first render, preventing a zoom flash.

---

## Sharing & Privacy

This project can be shared publicly on GitHub — it contains no credentials or personal bookmark data. Bookmarks are stored in the local browser profile or a user-selected file, with no cloud bookmark sync. A new installation starts with seed bookmarks until you connect a file or import your own list.

The only network requests made by the page are:
- Google Fonts (for typography, via `@import`)
- Google Favicon API (`www.google.com/s2/favicons`)
- DuckDuckGo Favicon API (`icons.duckduckgo.com`)

Favicon services receive the requested bookmark hostname to look up its icon. Search queries and the bookmark collection are not uploaded. Manually selected icons also load from their stored URLs.

---

## Seed Bookmarks

On first launch in browser mode (no stored collection), the page populates with `SEED_BOOKMARKS` from the script. Afterward, data comes from the selected storage mode. File mode never seeds or writes a file during startup or reconnect.
