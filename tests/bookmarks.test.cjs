// Run with: node --test tests/bookmarks.test.cjs
// Execute the actual page script with an in-memory DOM/storage harness.
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const html = readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8');

function app(options = {}) {
  let document;
  class Element {
    constructor(tag = 'div') {
      this.tag = tag;
      this.value = '';
      this.children = [];
      this.events = {};
      this.attributes = {};
      this.style = { setProperty() {} };
      this.dataset = {};
      this.className = '';
      this.scrollLeft = 0;
      this.scrollTop = 0;
      this.clientHeight = 400;
      this.clientWidth = 0;
      this.scrollCalls = [];
      this.classes = new Set();
      this.classList = {
        add: name => this.classes.add(name),
        remove: name => this.classes.delete(name),
        contains: name => this.classes.has(name),
      };
    }
    addEventListener(type, handler) { this.events[type] = handler; }
    setAttribute(name, value) { this.attributes[name] = value; }
    replaceChildren(...children) {
      this.children = children;
      if (this.layoutCategories) {
        children.forEach((child, index) => { child.offsetLeft = 4 + index * 80; child.offsetWidth = 74; });
        this.scrollWidth = children.length * 80 + 2;
      }
    }
    appendChild(child) { this.children.push(child); }
    contains(element) { return this === element || this.children.some(child => child.contains(element)); }
    matches(selector) {
      return selector === '.category-filter'
        ? this.className === 'category-filter'
        : selector.split(', ').includes(this.tag);
    }
    focus() { document.activeElement = this; }
    blur() { document.activeElement = document.body; }
    click() { return this.events.click?.({ preventDefault() {} }); }
    scrollIntoView() {}
    scrollTo(options) { this.scrollCalls.push(options); this.scrollLeft = options.left; }
    scrollBy(options) { this.scrollCalls.push(options); this.scrollTop += options.top || 0; }
  }
  const elements = Object.fromEntries([...html.matchAll(/<([\w-]+)[^>]*\bid="([^"]+)"/g)]
    .map(([, tag, id]) => [id, new Element(tag)]));
  document = {
    body: new Element('body'),
    documentElement: new Element('html'),
    getElementById: id => elements[id],
    createElement: tag => new Element(tag),
    querySelectorAll: () => [],
    querySelector: selector => selector === '.modal-overlay.open'
      ? [elements['modal-overlay'], elements['settings-overlay']].find(el => el.classes.has('open'))
      : elements['category-filters'].children.find(el => el.attributes['aria-pressed'] === 'true'),
    addEventListener(type, handler) { this[type] = handler; },
  };
  document.activeElement = document.body;
  const storage = options.storage || new Map();
  const connections = options.connections || new Map();
  // A small asynchronous IndexedDB stand-in for persisting the actual file handle.
  const indexedDB = { open() {
    const request = {};
    queueMicrotask(() => {
      if (options.connectionFailure) {
        request.error = Error('Connection storage unavailable');
        request.onerror();
        return;
      }
      request.result = {
        close() {},
        transaction() {
          const transaction = { objectStore() {
            const run = action => {
              const result = {};
              queueMicrotask(() => { result.result = action(); transaction.oncomplete(); });
              return result;
            };
            return {
              get: key => run(() => connections.get(key)),
              put: (value, key) => {
                if (options.connectionWriteFailure) throw Error('Cannot serialize file handle');
                return run(() => connections.set(key, value));
              },
            };
          } };
          return transaction;
        },
      };
      request.onsuccess();
    });
    return request;
  } };
  const window = {
    location: {}, open() { throw Error('Unexpected navigation'); },
    addEventListener() {},
    matchMedia: () => ({ matches: !!options.reducedMotion }),
  };
  if (options.file) {
    window.showOpenFilePicker = async () => {
      if (options.cancelPicker) throw Object.assign(Error('Cancelled'), { name: 'AbortError' });
      return [options.file];
    };
    window.showSaveFilePicker = async () => options.file;
  }
  const context = vm.createContext({
    document, URL, Blob, indexedDB, console: { error() {} },
    localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => { if (options.storageFailure) throw Error('Storage full'); storage.set(key, value); },
    },
    setInterval() {}, setTimeout() {}, clearTimeout() {}, confirm: options.confirm || (() => true),
    window, navigator: options.navigator || {},
  });
  const evaluate = source => vm.runInContext(source, context);
  evaluate(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
  const key = (key, modifiers = {}) => {
    const event = { key, preventDefault() { this.prevented = true; }, ...modifiers };
    document.keydown(event);
    return event;
  };
  const state = () => JSON.parse(evaluate('JSON.stringify({ selectedCategory, activeIdx, titles: filtered.map(b => b.title), options: getCategoryOptions() })'));
  const query = value => { elements.search.value = value; elements.search.events.input(); };
  return { evaluate, key, state, query, elements, document, storage, connections, ready: evaluate('bootReady') };
}

test('alphabetical navigation wraps, buttons select filters, and counts follow selection', () => {
  const a = app();
  assert.deepEqual(a.state().options.map(o => o.label), ['All', 'AI', 'Dev', 'Work']);
  a.key('ArrowLeft');
  assert.equal(a.state().selectedCategory, 'work');
  assert.deepEqual(a.state().titles, ['Gmail']);
  assert.match(a.elements['clock-count'].textContent, /1 \/ 5/);
  a.key('ArrowRight');
  assert.equal(a.state().selectedCategory, null);
  a.elements['category-filters'].children[2].focus();
  a.elements['category-filters'].children[2].click();
  assert.equal(a.state().selectedCategory, 'dev');
  assert.equal(a.document.activeElement.categoryKey, 'dev');
  assert.equal(a.key('Enter').prevented, undefined);
  assert.equal(a.key(' ').prevented, undefined);
  a.key('ArrowRight');
  assert.equal(a.document.activeElement.categoryKey, 'work');
});

test('queries intersect categories, preserve editing, and Escape resets in two steps', () => {
  const a = app();
  a.query('code');
  for (const key of ['ArrowLeft', 'ArrowRight']) assert.equal(a.key(key).prevented, undefined);
  assert.equal(a.state().selectedCategory, null);
  a.document.body.focus();
  a.key('ArrowRight');
  assert.equal(a.elements.search.value, 'code');
  assert.deepEqual(a.state().titles, []);
  a.key('ArrowDown');
  assert.equal(a.state().activeIdx, -1);
  assert.equal(a.state().options.length, 4);
  a.key('ArrowRight');
  assert.deepEqual(a.state().titles, ['GitHub', 'Stack Overflow']);
  assert.equal(a.state().activeIdx, 0);
  a.key('Escape');
  assert.equal(a.state().selectedCategory, 'dev');
  assert.equal(a.state().titles.length, 3);
  a.key('Escape');
  assert.equal(a.state().selectedCategory, null);
});

test('modified arrows and modal input never switch categories or throw', () => {
  const a = app();
  for (const modifier of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey', 'isComposing']) {
    assert.equal(a.key('ArrowRight', { [modifier]: true }).prevented, undefined);
    assert.equal(a.state().selectedCategory, null);
  }
  a.elements['settings-overlay'].classList.add('open');
  assert.equal(a.key('ArrowRight').prevented, undefined);
  assert.equal(a.key('a').prevented, undefined);
  assert.equal(a.state().selectedCategory, null);
  a.key('Escape');
  assert.equal(a.elements['settings-overlay'].classList.contains('open'), false);
});

test('case variants share a filter, uncategorized comes last, and imports refresh filters', async () => {
  const a = app();
  await a.evaluate(`finishImport([
    {title: 'One', url: 'https://one.test', category: ' work '},
    {title: 'Two', url: 'https://two.test', category: 'Work'},
    {title: 'Three', url: 'https://three.test'},
    {title: 'Four', url: 'https://four.test', category: 'AI'}
  ], 'Imported');`);
  assert.deepEqual(a.state().options.map(o => o.key), [null, 'ai', 'work', '']);
  a.key('ArrowLeft');
  assert.deepEqual(a.state().titles, ['Three']);
  a.key('ArrowLeft');
  assert.equal(a.state().titles.length, 2);
  a.query('one');
  await a.evaluate("finishImport([{title: 'Only', url: 'https://only.test', category: 'Work'}], 'Imported')");
  assert.equal(a.state().selectedCategory, 'work');
  assert.deepEqual(a.state().titles, []);
  await a.evaluate("finishImport([], 'Imported')");
  assert.equal(a.state().selectedCategory, null);
  assert.equal(a.state().activeIdx, -1);
  assert.equal(a.state().options.length, 1);
});

test('save/delete preserve filtering and filtered export includes category without a query', async () => {
  const a = app();
  a.key('ArrowLeft'); // Work
  a.evaluate('let exported; downloadAsJson = (data, label) => { exported = { data, label }; };');
  a.elements['export-filtered-btn'].click();
  assert.equal(a.evaluate('exported.data.length'), 1);
  assert.equal(a.evaluate('exported.label'), 'filtered');
  a.elements['f-title'].value = 'Another';
  a.elements['f-url'].value = 'https://another.test';
  a.elements['f-cat'].value = 'Dev';
  await a.evaluate('saveBookmark()');
  assert.deepEqual(a.state().titles, ['Gmail']);
  await a.evaluate('editingBookmark = filtered[0]; deleteBookmark()');
  assert.equal(a.state().selectedCategory, null);
  assert.equal(a.state().titles.length, 5);
  await a.elements['clear-btn'].click();
  assert.equal(a.state().titles.length, 0);
  assert.equal(a.state().options.length, 1);
});

function bookmark(title, category = 'Work') {
  return { title, url: `https://${title.toLowerCase()}.test`, category, env: 'dev', tags: ['test'], icon: '' };
}

function file(list = [bookmark('Existing')]) {
  return {
    name: 'bookmarks.json', text: JSON.stringify(list, null, 2), permission: 'granted',
    writes: 0, prompts: 0,
    async queryPermission() { return this.permission; },
    async requestPermission() { this.prompts++; return this.permission; },
    async getFile() {
      if (this.missing) throw Error('File not found');
      const text = this.text;
      return { size: text.length, text: async () => text };
    },
    async createWritable() {
      const handle = this;
      let pending;
      return {
        async write(text) { if (handle.writeFailure) throw Error('Disk full'); pending = text; },
        async close() {
          if (handle.beforeClose) await handle.beforeClose();
          if (handle.closeFailure) throw Error('Could not finish saving');
          handle.text = pending;
          handle.writes++;
        },
        async abort() { handle.aborted = true; },
      };
    },
  };
}

test('opening an existing JSON file loads it without writing or replacing the browser collection', async () => {
  const f = file();
  const a = app({ file: f });
  const previous = a.storage.get('mybookmarks_v1');
  assert.equal(await a.elements['storage-open-btn'].click(), true);
  assert.deepEqual(a.state().titles, ['Existing']);
  assert.equal(f.writes, 0);
  assert.equal(a.storage.get('mybookmarks_v1'), previous);
  assert.equal(a.evaluate('storageMode'), 'file');
  assert.equal(a.connections.get('active'), f);
  assert.equal(a.evaluate('fileReady'), true);
});

test('create file, add, edit, delete, merge, replace, clear, and switch back use the same JSON format', async () => {
  const f = file([]);
  f.text = '';
  const a = app({ file: f });
  await a.elements['storage-create-btn'].click();
  assert.equal(JSON.parse(f.text).length, 5);
  a.elements['f-title'].value = 'New';
  a.elements['f-url'].value = 'new.test';
  a.elements['f-cat'].value = 'Work';
  await a.evaluate('saveBookmark()');
  assert.equal(JSON.parse(f.text).length, 6);
  a.evaluate("editingBookmark = bookmarks.find(b => b.title === 'New')");
  a.elements['f-title'].value = 'Renamed';
  await a.evaluate('saveBookmark()');
  assert.ok(JSON.parse(f.text).some(b => b.title === 'Renamed'));
  await a.evaluate('deleteBookmark()');
  assert.equal(JSON.parse(f.text).length, 5);
  a.elements['import-text'].value = JSON.stringify([bookmark('Imported'), bookmark('Imported')]);
  await a.elements['import-merge-btn'].click();
  assert.equal(JSON.parse(f.text).length, 6);
  await a.elements['import-replace-btn'].click();
  assert.equal(JSON.parse(f.text).length, 2);
  assert.deepEqual(JSON.parse(f.text)[0], bookmark('Imported'));
  assert.equal(f.prompts, 1, 'No new permission requests for routine saves');
  const beforeSwitch = f.text;
  await a.elements['storage-browser-btn'].click();
  assert.equal(a.evaluate('storageMode'), 'browser');
  assert.deepEqual(JSON.parse(a.storage.get('mybookmarks_v1')), JSON.parse(f.text));
  await a.elements['clear-btn'].click();
  assert.equal(f.text, beforeSwitch, 'Browser edits must not keep writing to the old file');
  assert.equal(a.storage.get('mybookmarks_v1'), '[]');
  await a.elements['storage-open-btn'].click();
  await a.elements['clear-btn'].click();
  assert.equal(f.text, '[]');
});

test('reload restores a remembered permitted file without prompting or writing', async () => {
  const f = file();
  const first = app({ file: f });
  await first.elements['storage-open-btn'].click();
  f.text = JSON.stringify([bookmark('Fresh')]);
  const second = app({ file: f, storage: first.storage, connections: first.connections });
  await second.ready;
  assert.deepEqual(second.state().titles, ['Fresh']);
  assert.equal(f.prompts, 1);
  assert.equal(f.writes, 0);
  assert.equal(second.evaluate('fileReady'), true);
});

test('clearing site data leaves the file intact and reconnecting reads instead of seeding it', async () => {
  const f = file();
  const a = app({ file: f });
  assert.equal(a.state().titles.length, 5);
  await a.elements['storage-open-btn'].click();
  assert.deepEqual(a.state().titles, ['Existing']);
  assert.equal(f.writes, 0);
});

test('lost permission shows cached bookmarks read-only until reconnect reloads the file', async () => {
  const f = file();
  const first = app({ file: f });
  await first.elements['storage-open-btn'].click();
  f.permission = 'prompt';
  const second = app({ file: f, storage: first.storage, connections: first.connections });
  await second.ready;
  assert.equal(second.evaluate('fileReady'), false);
  assert.deepEqual(second.state().titles, ['Existing']);
  assert.equal(second.elements['modal-save'].disabled, true);
  assert.equal(await second.evaluate('updateBookmarks(() => [])'), false);
  assert.equal(f.writes, 0);
  assert.equal(f.prompts, 1, 'Startup must never request permission');
  f.permission = 'granted';
  f.text = JSON.stringify([bookmark('Updated')]);
  await second.elements['storage-open-btn'].click();
  assert.deepEqual(second.state().titles, ['Updated']);
  assert.equal(second.elements['modal-save'].disabled, false);
  assert.equal(f.writes, 0);
});

test('external edits are detected and never silently overwritten', async () => {
  const f = file();
  const a = app({ file: f });
  await a.elements['storage-open-btn'].click();
  f.text = JSON.stringify([bookmark('External')]);
  assert.equal(await a.evaluate('updateBookmarks(() => [])'), false);
  assert.equal(f.writes, 0);
  assert.match(a.elements['storage-status'].textContent, /changed elsewhere/);
  await a.elements['storage-open-btn'].click();
  assert.deepEqual(a.state().titles, ['External']);
});

test('invalid files, denied access, and cancelled pickers retain the active collection', async () => {
  for (const raw of ['broken JSON', '{}', '[null]', '[{"title":7,"url":"https://test.com"}]', '[{"title":"Test","url":"https://test.com","tags":42}]']) {
    const f = file();
    f.text = raw;
    const a = app({ file: f });
    assert.equal(await a.elements['storage-open-btn'].click(), false);
    assert.equal(a.evaluate('storageMode'), 'browser');
    assert.equal(a.state().titles.length, 5);
    assert.equal(f.writes, 0);
  }
  for (const options of [{ cancelPicker: true }, {}]) {
    const f = file();
    f.permission = 'denied';
    const a = app({ file: f, ...options });
    assert.equal(await a.elements['storage-open-btn'].click(), false);
    assert.equal(a.state().titles.length, 5);
    assert.equal(f.writes, 0);
  }
});

test('empty bookmark arrays are valid and stay empty on reconnect', async () => {
  const f = file([]);
  const a = app({ file: f });
  await a.elements['storage-open-btn'].click();
  assert.equal(a.state().titles.length, 0);
  await a.elements['storage-open-btn'].click();
  assert.equal(a.state().titles.length, 0);
  assert.equal(f.writes, 0);
});

test('failed file writes or close operations do not report success or mutate the list', async () => {
  for (const failure of ['writeFailure', 'closeFailure', 'missing']) {
    const f = file();
    const a = app({ file: f });
    await a.elements['storage-open-btn'].click();
    const original = f.text;
    f[failure] = true;
    assert.equal(await a.evaluate('finishImport([], "success")'), false);
    assert.deepEqual(a.state().titles, ['Existing']);
    assert.equal(f.text, original);
    assert.equal(a.evaluate('fileReady'), false);
    assert.notEqual(a.elements['import-status'].textContent, 'success');
  }
});

test('failed browser writes preserve file mode and bookmarks', async () => {
  const f = file();
  const options = { file: f };
  const a = app(options);
  await a.elements['storage-open-btn'].click();
  options.storageFailure = true;
  assert.equal(await a.elements['storage-browser-btn'].click(), false);
  assert.equal(a.evaluate('storageMode'), 'file');
  assert.deepEqual(a.state().titles, ['Existing']);
  options.storageFailure = false;
  await a.elements['storage-browser-btn'].click();
  options.storageFailure = true;
  assert.equal(await a.evaluate('updateBookmarks(() => [])'), false);
  assert.deepEqual(a.state().titles, ['Existing']);
});

test('unavailable connection storage still permits file saving for the current session', async () => {
  const f = file();
  const a = app({ file: f, connectionFailure: true });
  assert.equal(await a.elements['storage-open-btn'].click(), true);
  assert.match(a.elements['storage-status'].textContent, /session only/);
  assert.equal(await a.evaluate('updateBookmarks(() => [])'), true);
  assert.equal(f.text, '[]');
});

test('unsupported browsers keep local storage and disable file controls', () => {
  const a = app();
  assert.equal(a.elements['storage-open-btn'].disabled, true);
  assert.equal(a.elements['storage-create-btn'].disabled, true);
  assert.equal(a.elements['modal-save'].disabled, false);
});

test('replacing an existing file and switching to browser storage honor cancellation', async () => {
  const f = file();
  const a = app({ file: f, confirm: () => false });
  assert.equal(await a.elements['storage-create-btn'].click(), false);
  assert.equal(f.writes, 0);
  await a.elements['storage-open-btn'].click();
  assert.equal(await a.elements['storage-browser-btn'].click(), false);
  assert.equal(a.evaluate('storageMode'), 'file');
});

test('double submissions are blocked while a file write is still pending', async () => {
  const f = file();
  let finish;
  f.beforeClose = () => new Promise(resolve => { finish = resolve; });
  const a = app({ file: f });
  await a.elements['storage-open-btn'].click();
  const first = a.evaluate('updateBookmarks(() => [])');
  while (!finish) await new Promise(resolve => setImmediate(resolve));
  assert.equal(a.elements['modal-save'].disabled, true);
  assert.equal(await a.evaluate('updateBookmarks(current => current)'), false);
  finish();
  assert.equal(await first, true);
  assert.equal(f.writes, 1);
});

test('two app tabs serialize writes and reject a stale tab after the first save', async () => {
  let tail = Promise.resolve();
  const navigator = { locks: { request(name, action) {
    const next = tail.then(action);
    tail = next.catch(() => {});
    return next;
  } } };
  const f = file();
  const a = app({ file: f, navigator });
  const b = app({ file: f, navigator });
  await a.elements['storage-open-btn'].click();
  await b.elements['storage-open-btn'].click();
  const outcomes = await Promise.all([
    a.evaluate('updateBookmarks(() => [])'), b.evaluate('updateBookmarks(current => current)'),
  ]);
  assert.deepEqual(outcomes, [true, false]);
  assert.equal(f.writes, 1);
  assert.equal(f.text, '[]');
});

test('failing to remember a new file never reconnects a previously stored file on reload', async () => {
  const oldFile = file([bookmark('Old')]);
  const newFile = file([bookmark('New')]);
  const connections = new Map([['active', oldFile]]);
  const a = app({ file: newFile, connections, connectionWriteFailure: true });
  assert.equal(await a.elements['storage-open-btn'].click(), true);
  assert.equal(a.storage.get('mybookmarks_storage_mode'), 'file-disconnected');
  const reloaded = app({ file: newFile, storage: a.storage, connections });
  await reloaded.ready;
  assert.deepEqual(reloaded.state().titles, ['New']);
  assert.equal(reloaded.evaluate('fileHandle'), null);
  assert.equal(reloaded.evaluate('fileReady'), false);
  await reloaded.elements['storage-open-btn'].click();
  assert.equal(reloaded.evaluate('fileReady'), true);
  assert.deepEqual(reloaded.state().titles, ['New']);
  assert.equal(oldFile.writes, 0);
  assert.equal(newFile.writes, 0);
});

test('file writes succeed even when the optional browser cache cannot be saved', async () => {
  const f = file();
  const a = app({ file: f, storageFailure: true });
  assert.equal(await a.elements['storage-open-btn'].click(), true);
  assert.equal(await a.evaluate('updateBookmarks(() => [])'), true);
  assert.equal(f.text, '[]');
  assert.equal(a.evaluate('fileReady'), true);
  assert.equal(a.evaluate('storageMode'), 'file');
});

test('settings toggle reveals setup without switching storage until a file is connected', async () => {
  const f = file();
  const a = app({ file: f });
  a.elements['settings-btn'].click();
  assert.equal(a.document.activeElement, a.elements['settings-body']);
  assert.equal(a.elements['settings-body'].scrollTop, 0);
  assert.equal(a.elements['storage-file-controls'].hidden, true);
  assert.equal(a.elements['storage-browser-btn'].attributes['aria-pressed'], 'true');
  a.elements['storage-file-btn'].click();
  assert.equal(a.elements['storage-file-controls'].hidden, false);
  assert.equal(a.elements['storage-file-btn'].attributes['aria-pressed'], 'true');
  assert.equal(a.evaluate('storageMode'), 'browser');
  assert.equal(f.writes, 0);
  assert.match(a.elements['storage-file-note'].textContent, /Browser storage stays active/);
  assert.equal(a.elements['storage-file-options'].open, false);
  await a.elements['storage-browser-btn'].click();
  assert.equal(a.elements['storage-file-controls'].hidden, true);
  assert.equal(a.state().titles.length, 5);
});

test('one primary file control chooses, reloads, and reconnects; cancellation preserves toggle state', async () => {
  const f = file();
  const a = app({ file: f, confirm: () => false });
  a.elements['storage-file-btn'].click();
  assert.equal(a.elements['storage-open-btn'].textContent, 'choose JSON file');
  await a.elements['storage-open-btn'].click();
  assert.equal(a.elements['storage-open-btn'].textContent, 'reload file');
  assert.equal(a.elements['storage-change-btn'].hidden, false);
  assert.equal(a.elements['storage-file-options'].open, false);
  assert.equal(a.elements['storage-status'].textContent, '');
  f.permission = 'prompt';
  await a.evaluate('updateBookmarks(() => [])');
  assert.equal(a.elements['storage-open-btn'].textContent, 'reconnect file');
  f.permission = 'granted';
  await a.elements['storage-open-btn'].click();
  assert.equal(a.elements['storage-open-btn'].textContent, 'reload file');
  assert.equal(f.writes, 0);
  await a.elements['storage-browser-btn'].click();
  assert.equal(a.elements['storage-file-btn'].attributes['aria-pressed'], 'true');
  assert.equal(a.evaluate('storageMode'), 'file');
  assert.doesNotMatch(a.elements['storage-info'].innerHTML, /recommendation|risk|5 MB/);
});

test('category navigation reveals offscreen tabs in both directions without moving focus from search', () => {
  const a = app();
  const strip = a.elements['category-filters'];
  strip.layoutCategories = true;
  strip.clientWidth = 180;
  a.evaluate('runSearch("")');
  a.key('ArrowRight'); // AI still fits.
  assert.equal(strip.scrollCalls.length, 0);
  a.key('ArrowRight'); // Dev is past the right edge.
  assert.equal(strip.scrollLeft, 62);
  assert.equal(strip.scrollCalls.at(-1).behavior, 'smooth');
  a.key('ArrowRight');
  assert.equal(strip.scrollLeft, 142);
  a.key('ArrowRight'); // Wrap to All at the left end.
  assert.equal(strip.scrollLeft, 0);
  a.key('ArrowLeft'); // Wrap to Work at the right end.
  assert.equal(strip.scrollLeft, 142);
  assert.equal(a.document.activeElement, a.elements.search);
  const count = strip.scrollCalls.length;
  a.query('gmail');
  assert.equal(strip.scrollCalls.length, count, 'Typing should not move an already visible category');
});

test('category reveal respects reduced motion and adjusts to a narrower viewport', () => {
  const a = app({ reducedMotion: true });
  const strip = a.elements['category-filters'];
  strip.layoutCategories = true;
  strip.clientWidth = 180;
  a.evaluate('runSearch("")');
  a.key('ArrowLeft');
  assert.equal(strip.scrollCalls.at(-1).behavior, 'auto');
  strip.clientWidth = 120;
  a.evaluate('ensureSelectedCategoryVisible("auto")');
  assert.equal(strip.scrollLeft, 202);
  assert.equal(a.state().selectedCategory, 'work');
});

function wheel(a, target, overrides = {}) {
  const event = {
    target, deltaY: 60, deltaX: 0, deltaMode: 0, cancelable: true,
    preventDefault() { this.defaultPrevented = true; }, ...overrides,
  };
  a.document.wheel(event);
  return event;
}

test('vertical wheel input over header, categories, and background scrolls bookmarks', () => {
  const a = app();
  const pane = a.elements['bookmark-scroll'];
  for (const target of [a.document.body, a.elements['page-header'], a.elements.search, a.elements['category-filters'].children[0]]) {
    const before = pane.scrollTop;
    assert.equal(wheel(a, target).defaultPrevented, true);
    assert.equal(pane.scrollTop, before + 60);
  }
  wheel(a, a.elements.search, { deltaY: -30 });
  assert.equal(pane.scrollTop, 210);
  assert.equal(a.elements['category-filters'].scrollLeft, 0);
});

test('bookmark pane scrolling stays native, avoiding double scroll', () => {
  const a = app();
  const pane = a.elements['bookmark-scroll'];
  pane.children = [a.elements.results];
  assert.equal(wheel(a, pane).defaultPrevented, undefined);
  assert.equal(wheel(a, a.elements.results).defaultPrevented, undefined);
  assert.equal(pane.scrollCalls.length, 0);
});

test('wheel forwarding respects modal scrolling, horizontal gestures, and browser zoom', () => {
  const a = app();
  for (const overrides of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { deltaX: 80, deltaY: 5 }, { deltaY: 0 }, { cancelable: false }, { defaultPrevented: true }]) {
    wheel(a, a.elements['category-filters'], overrides);
  }
  for (const id of ['settings-overlay', 'modal-overlay']) {
    a.elements[id].classList.add('open');
    assert.equal(wheel(a, a.document.body).defaultPrevented, undefined);
    assert.equal(wheel(a, a.elements['settings-body']).defaultPrevented, undefined);
    a.elements[id].classList.remove('open');
  }
  assert.equal(a.elements['bookmark-scroll'].scrollCalls.length, 0);
});

test('wheel forwarding converts line and page deltas to scroll distances', () => {
  const a = app();
  const pane = a.elements['bookmark-scroll'];
  wheel(a, a.document.body, { deltaMode: 1, deltaY: 3 });
  assert.equal(pane.scrollTop, 48);
  wheel(a, a.document.body, { deltaMode: 2, deltaY: 1 });
  assert.equal(pane.scrollTop, 448);
});
