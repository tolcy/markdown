const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { test } = require("node:test");
const source = fs.readFileSync(require("node:path").join(__dirname, "../public/app.js"), "utf8");
const start = source.indexOf("function editorLinkAt(");
const end = source.indexOf('document.getElementById("editor").addEventListener("pointerdown"', start);
assert(start >= 0 && end > start);

function linkHarness(href = "https://example.com/", kind = "anchor") {
  const calls = [], errors = [], listeners = {}, documentListeners = {}, windowListeners = {}, classes = new Set();
  const link = {
    nodeType: 1, textContent: href,
    closest: () => link,
    getAttribute: () => kind === "anchor" ? href : null,
    querySelector: () => kind === "ir" ? { textContent: href } : null,
    matches: () => kind === "source",
  };
  const editor = { contains: (node) => node === link, addEventListener: (event, action) => { listeners[event] = action; } };
  const context = {
    URL, state: {},
    document: { getElementById: (id) => id === "editor" ? editor : null,
      addEventListener: (event, action) => { documentListeners[event] = action; },
      body: { classList: { toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); }, remove: (name) => classes.delete(name) } } },
    window: { addEventListener: (event, action) => { windowListeners[event] = action; }, open: (...args) => calls.push({ browser: args }) },
    isDesktop: () => true, invoke: async (command, args) => calls.push({ command, url: args.url }),
    invokeFile: async (command, args) => {
      calls.push({ command, ...args });
      return { path: "C:\\notes\\" + args.target, name: args.target };
    },
    findTabForFile: () => null,
    openTreeFile: async (file) => calls.push({ opened: file.path }),
    switchTab: (key) => calls.push({ switched: key }),
    notice: (message) => errors.push(message), errorText: (error) => error.message, t: (key) => key,
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start, end), context);
  function event(ctrlKey = true, button = 0) {
    return { target: link, ctrlKey, metaKey: false, button, prevented: false, stopped: false,
      preventDefault() { this.prevented = true; }, stopImmediatePropagation() { this.stopped = true; } };
  }
  return { context, link, calls, errors, listeners, documentListeners, windowListeners, classes, event };
}
test("Ctrl-left-click opens a web link once through the desktop command", async () => {
  const h = linkHarness("https://example.com/path?q=1#part");
  const down = h.event(); h.listeners.mousedown(down);
  const click = h.event(); h.listeners.click(click);
  await Promise.resolve();
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].command, "open_external_url");
  assert.equal(h.calls[0].url, "https://example.com/path?q=1#part");
  assert(down.prevented && down.stopped && click.prevented && click.stopped);
});
test("ordinary clicks leave link text editable and never launch a browser", () => {
  const h = linkHarness(); const click = h.event(false);
  h.listeners.click(click);
  assert.equal(h.calls.length, 0);
  assert(click.prevented);
  assert.equal(click.stopped, false);
});
test("instant-render link markers and source-mode destinations are recognized", async () => {
  for (const kind of ["ir", "source"]) {
    const h = linkHarness("https://example.com/notes", kind);
    h.listeners.click(h.event()); await Promise.resolve();
    assert.equal(h.calls[0].url, "https://example.com/notes");
  }
});
test("middle-click does not trigger the Ctrl-left-click action", () => {
  const h = linkHarness(); h.listeners.click(h.event(true, 1));
  assert.equal(h.calls.length, 0);
});
test("unsupported protocols and control characters never reach the system opener", async () => {
  const h = linkHarness();
  for (const value of ["javascript:alert(1)", "file:///C:/Windows/notepad.exe", "data:text/html,test", "https://exa\nmple.com"]) {
    await assert.rejects(h.context.followEditorLink(value));
  }
  assert.equal(h.calls.length, 0);
});
test("Ctrl-left-click on a relative Chinese link opens a document tab", async () => {
  const file = "04_周四_治理与业务编码.md";
  const h = linkHarness(encodeURI(file), "ir");
  h.context.state.filePath = "C:\\notes\\00_本周安排.md";
  h.listeners.mousedown(h.event());
  h.listeners.click(h.event());
  await new Promise(setImmediate);
  assert.equal(h.calls.length, 2);
  assert.deepEqual(h.calls[0], { command: "resolve_markdown_link", source: h.context.state.filePath, target: file });
  assert.deepEqual(h.calls[1], { opened: "C:\\notes\\" + file });
});
test("links reuse an open tab and jump to the target heading", async () => {
  const h = linkHarness();
  h.context.state.filePath = "C:\\notes\\index.md";
  h.context.findTabForFile = () => ({ key: "draft" });
  let scrolled = false;
  const heading = { textContent: "## 任务", scrollIntoView() { scrolled = true; } };
  h.context.state.editor = { getCurrentMode: () => "ir", vditor: { ir: { element: { querySelectorAll: () => [heading] } } } };
  await h.context.followEditorLink("../tasks.md#" + encodeURIComponent("任务"));
  assert.equal(h.calls[0].target, "../tasks.md");
  assert.deepEqual(h.calls[1], { switched: "draft" });
  assert(scrolled);
});
test("an unsaved tab does not resolve relative links against an unrelated directory", async () => {
  const h = linkHarness();
  await assert.rejects(h.context.followEditorLink("./notes.md"), /saveBeforeLink/);
  assert.equal(h.calls.length, 0);
});
test("mail links use the same desktop command", async () => {
  const h = linkHarness();
  await h.context.followEditorLink("mailto:hello@example.com?subject=Hello");
  assert.equal(h.calls[0].url, "mailto:hello@example.com?subject=Hello");
});
test("browser previews use a new tab with no opener access", async () => {
  const h = linkHarness(); h.context.isDesktop = () => false;
  await h.context.followEditorLink("https://example.com");
  assert.deepEqual(h.calls[0].browser, ["https://example.com/", "_blank", "noopener,noreferrer"]);
});
test("internal heading links scroll within the document instead of opening a browser", async () => {
  const h = linkHarness(); let scrolled = false;
  const heading = { textContent: "## Hello World", scrollIntoView() { scrolled = true; } };
  h.context.state.editor = { getCurrentMode: () => "ir", vditor: { ir: { element: { contains: () => true, querySelectorAll: () => [heading] } } } };
  await h.context.followEditorLink("#hello-world");
  assert(scrolled);
  assert.equal(h.calls.length, 0);
});
test("releasing Ctrl or leaving the window resets link hover styling", () => {
  const h = linkHarness();
  h.documentListeners.keydown({ ctrlKey: true }); assert(h.classes.has("link-open-mode"));
  h.documentListeners.keyup({ ctrlKey: false }); assert(!h.classes.has("link-open-mode"));
  h.documentListeners.keydown({ ctrlKey: true }); h.windowListeners.blur();
  assert(!h.classes.has("link-open-mode"));
});
