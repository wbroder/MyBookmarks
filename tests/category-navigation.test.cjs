// Run with: node --test tests/category-navigation.test.cjs
// Execute the actual page script with an in-memory DOM/storage harness.
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const html = readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8');

function app() {
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
      this.classes = new Set();
      this.classList = {
        add: name => this.classes.add(name),
        remove: name => this.classes.delete(name),
        contains: name => this.classes.has(name),
      };
    }
    addEventListener(type, handler) { this.events[type] = handler; }
    setAttribute(name, value) { this.attributes[name] = value; }
    replaceChildren(...children) { this.children = children; }
    appendChild(child) { this.children.push(child); }
    contains(element) { return this.children.includes(element); }
    matches(selector) {
      return selector === '.category-filter'
        ? this.className === 'category-filter'
        : selector.split(', ').includes(this.tag);
    }
    focus() { document.activeElement = this; }
    blur() { document.activeElement = document.body; }
    click() { this.events.click?.({ preventDefault() {} }); }
    scrollIntoView() {}
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
  const storage = new Map();
  const context = vm.createContext({
    document, URL, Blob, console,
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    setInterval() {}, setTimeout() {}, clearTimeout() {}, confirm: () => true,
    window: { location: {}, open() { throw Error('Unexpected navigation'); } },
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
  return { evaluate, key, state, query, elements, document };
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

test('case variants share a filter, uncategorized comes last, and imports refresh filters', () => {
  const a = app();
  a.evaluate(`finishImport([
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
  a.evaluate("finishImport([{title: 'Only', url: 'https://only.test', category: 'Work'}], 'Imported')");
  assert.equal(a.state().selectedCategory, 'work');
  assert.deepEqual(a.state().titles, []);
  a.evaluate("finishImport([], 'Imported')");
  assert.equal(a.state().selectedCategory, null);
  assert.equal(a.state().activeIdx, -1);
  assert.equal(a.state().options.length, 1);
});

test('save/delete preserve filtering and filtered export includes category without a query', () => {
  const a = app();
  a.key('ArrowLeft'); // Work
  a.evaluate('let exported; downloadAsJson = (data, label) => { exported = { data, label }; };');
  a.elements['export-filtered-btn'].click();
  assert.equal(a.evaluate('exported.data.length'), 1);
  assert.equal(a.evaluate('exported.label'), 'filtered');
  a.elements['f-title'].value = 'Another';
  a.elements['f-url'].value = 'https://another.test';
  a.elements['f-cat'].value = 'Dev';
  a.evaluate('saveBookmark()');
  assert.deepEqual(a.state().titles, ['Gmail']);
  a.evaluate('editingBookmark = filtered[0]; deleteBookmark()');
  assert.equal(a.state().selectedCategory, null);
  assert.equal(a.state().titles.length, 5);
  a.elements['clear-btn'].click();
  assert.equal(a.state().titles.length, 0);
  assert.equal(a.state().options.length, 1);
});
