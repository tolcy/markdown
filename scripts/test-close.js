const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { test } = require("node:test");

// Exercise the actual browser functions with an isolated file/dialog boundary.
const source = fs.readFileSync(require("node:path").join(__dirname, "../public/app.js"), "utf8");
function section(start, end) {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first);
  assert(first >= 0 && last > first, "Production function section must exist");
  return source.slice(first, last);
}
const closeCode = [
  "let closing = false; let closingTab = false;",
  section("function normalizeText(", "function renderStatus("),
  section("function markDirty(", "function untitledStem("),
  section("function adoptSaved(", "function isDesktop("),
  section("function flushActiveTab(", "function markNeverSaved("),
  section("function invokeFile(", "let loadGen"),
  section("function tabDirty(", "let tabsMenuOpen"),
  section("async function saveAs(", "async function saveTabBeforeClose("),
  section("async function saveTabBeforeClose(", "async function openFile("),
  section("async function closeTab(", "function showBlank("),
  section("let workspaceRefreshing =", "let menuNode ="),
].join("\n");

function documentTab(name = "a.md", saved = "old\n", value = "new\n", filePath = "C:/notes/" + name) {
  return { key: filePath || name, name, saved, value, filePath, handle: null };
}
function harness(tabs = [documentTab()], choice = "save", paths = ["C:/notes/draft.md"]) {
  const active = tabs[0];
  const calls = [], prompts = [], errors = [];
  const context = {
    state: { tabs, activeKey: active?.key || "", name: active?.name || "", saved: active?.saved ?? null,
      filePath: active?.filePath || "", dirty: true, loading: false, folders: [] },
    live: active?.value || "", window: {},
    setTimeout, clearTimeout,
    t: (key, values) => key + (values ? " " + JSON.stringify(values) : ""),
    isDesktop: () => true,
    askDialog: async (options) => { prompts.push(options); return context.choices ? context.choices.shift() : choice; },
    invoke: async (command, args) => {
      calls.push({ command, args });
      if (command === "save_file") return paths.shift() || null;
      if (command === "list_workspace") return context.workspaceTree || [];
      if (command === "write_text" && context.writeError) throw context.writeError;
      if (command === "write_text" && context.failPath === args.path) throw Error("Device disconnected");
      if (command === "write_text" && context.writePending) return context.writePending;
      if (command === "write_text" && context.duringWrite) context.duringWrite();
    },
    notice: async (error) => errors.push(error), errorText: (error) => typeof error === "string" ? error : error.message,
    renderStatus() {}, renderTabs() {}, renderTree() {}, scheduleOutline() {},
    ensureUntitled() { throw Error("Unexpected untracked draft"); },
    showBlank() { context.state.activeKey = ""; context.state.saved = ""; context.state.dirty = false; },
    switchTab(key) { context.state.activeKey = key; },
  };
  context.state.editor = { getValue: () => context.live };
  vm.createContext(context);
  vm.runInContext(closeCode, context);
  return { context, calls, prompts, errors, writes: () => calls.filter((call) => call.command === "write_text"),
    finished: () => calls.some((call) => call.command === "finish_close") };
}

test("opening a linked Markdown file preserves the source tab's real save status", async () => {
  require("vditor/dist/js/lute/lute.min.js");
  const lute = globalThis.Lute.New();
  const markdown = "| Date | Task |\n| --- | --- |\n| Thu | [周四任务](04_周四任务.md) |\n";
  const link = { path: "C:/notes/04_周四任务.md", name: "04_周四任务.md" };
  for (const editWhileOpening of [false, true]) {
    const h = harness([]);
    const c = h.context;
    c.state.editor.setValue = (text) => { c.live = lute.VditorIRDOM2Md(lute.Md2VditorIRDOM(text)); };
    c.showEditor = c.renderTree = c.renderOutline = () => {};
    c.invoke = async (command) => {
      if (command !== "read_text") return 1;
      if (editWhileOpening) c.live += "\nNew draft text\n";
      return "# Linked document\n";
    };
    vm.runInContext([
      section("let loadGen", "function sortNodes("),
      section("function findTabForFile(", "function clearHiddenUnder("),
      section("function bringTabFront(", "function tabDirty("),
      section("function switchTab(", "let outlineTimer"),
    ].join("\n"), c);
    c.load(markdown, "index.md", null, "index.md", "C:/notes/index.md");
    const sourceTab = c.state.tabs[0];
    assert.notEqual(sourceTab.saved, markdown, "Vditor actually reformats the source");
    await c.openTreeFile(link, link.name);
    assert.equal(c.state.activeKey, link.path);
    assert.equal(c.tabDirty(sourceTab), editWhileOpening);
    assert.equal(sourceTab.value.includes("New draft text"), editWhileOpening);
    c.switchTab(sourceTab.key);
    assert.equal(c.state.dirty, editWhileOpening);
  }
});

test("unchanged documents close without asking or writing", async () => {
  const h = harness([documentTab("a.md", "old\n", "old\r\n")]);
  await h.context.requestAppClose();
  assert.equal(h.prompts.length, 0);
  assert.equal(h.writes().length, 0);
  assert(h.finished());
});
test("new empty documents close directly, including Vditor's empty newline", async () => {
  for (const empty of ["", "\n", "\n\n"]) {
    const h = harness([documentTab("draft.md", "", empty, "")], false);
    vm.runInContext(section("function markNeverSaved(", "async function createDocument("), h.context);
    h.context.markNeverSaved();
    assert.equal(h.context.state.saved, null, "the draft still has no disk save");
    assert.equal(h.context.state.dirty, false);
    await h.context.closeTab(h.context.state.activeKey);
    assert.equal(h.context.state.tabs.length, 0);
    assert.equal(h.prompts.length, 0);
    assert.equal(h.calls.length, 0);
  }
});

test("empty drafts do not prompt when inactive or when exiting the app", async () => {
  const h = harness([
    documentTab("a.md", "saved text", "saved text"),
    documentTab("draft.md", null, "\n", ""),
  ], false);
  await h.context.closeTab("draft.md");
  assert.equal(h.context.state.tabs.length, 1);
  assert.equal(h.prompts.length, 0);
  const exit = harness([documentTab("draft.md", null, "\n", "")], false);
  await exit.context.requestAppClose();
  assert.equal(exit.prompts.length, 0);
  assert(exit.finished());
});

test("draft edits prompt for saving and undoing to empty makes them clean again", async () => {
  for (const content of ["new text\n", " \n"]) {
    const h = harness([documentTab("draft.md", null, "", "")], false);
    h.context.live = content;
    await h.context.closeTab(h.context.state.activeKey);
    assert.equal(h.prompts.length, 1);
    assert.equal(h.context.state.tabs.length, 1);
    assert.equal(h.context.state.dirty, true);
    h.context.live = "\n";
    await h.context.closeTab(h.context.state.activeKey);
    assert.equal(h.prompts.length, 1, "clearing the draft does not ask again");
    assert.equal(h.context.state.tabs.length, 0);
    assert.equal(h.writes().length, 0);
  }
});

test("changing only a document's encryption key is an unsaved change", async () => {
  const tab = documentTab("private.md", "text", "text");
  tab.savedEncryptionKeyId = "first"; tab.encryptionKeyId = "second";
  const h = harness([tab], false);
  await h.context.closeTab(tab.key);
  assert.equal(h.prompts.length, 1);
  assert.equal(h.context.state.tabs.length, 1);
  assert.equal(h.context.state.dirty, true);
});

test("Save As and recovery preserve the selected encryption key", async () => {
  const tab = documentTab(); tab.encryptionKeyId = "private-key";
  const h = harness([tab]);
  assert(await h.context.saveTabBeforeClose(tab, false, true));
  assert.equal(h.writes()[0].args.encryptionKeyId, "private-key");
  assert.equal(tab.savedEncryptionKeyId, "private-key");
  const recoveryTab = documentTab(); recoveryTab.encryptionKeyId = "recovery-key";
  const recovery = harness([recoveryTab]);
  recovery.context.failPath = recoveryTab.filePath;
  recovery.context.choices = ["save", "save-as"];
  await recovery.context.requestAppClose();
  assert.deepEqual(recovery.writes().map(write => write.args.encryptionKeyId), ["recovery-key", "recovery-key"]);
});

test("inactive tabs save their own encryption key", async () => {
  const active = documentTab(); active.encryptionKeyId = "key-a";
  const inactive = documentTab("b.md", "old", "new"); inactive.encryptionKeyId = "key-b";
  const h = harness([active, inactive]);
  await h.context.closeTab(inactive.key);
  assert.equal(h.writes()[0].args.encryptionKeyId, "key-b");
  assert.equal(h.writes()[0].args.contents, "new");
});

test("changing the key during a save does not mark the new selection saved", async () => {
  const tab = documentTab(); tab.encryptionKeyId = "first";
  const h = harness([tab]);
  h.context.duringWrite = () => { tab.encryptionKeyId = "second"; };
  assert.equal(await h.context.saveTabBeforeClose(tab), false);
  assert.equal(h.writes()[0].args.encryptionKeyId, "first");
  assert.equal(tab.savedEncryptionKeyId, "first");
  assert.equal(h.context.state.dirty, true);
});

test("encryption errors never retry a plaintext save or mark content saved", async () => {
  const tab = documentTab(); tab.encryptionKeyId = "missing";
  const h = harness([tab]); h.context.writeError = "SM_KEY_MISSING";
  assert.equal(await h.context.saveTabBeforeClose(tab), false);
  assert.equal(h.writes().length, 1);
  assert.equal(h.writes()[0].args.encryptionKeyId, "missing");
  assert.equal(h.prompts.length, 0);
  assert.equal(h.errors[0], "SM_KEY_MISSING");
  assert.equal(tab.saved, "old\n");
});

test("native document reads retain encryption metadata", async () => {
  const h = harness();
  h.context.invoke = async () => ({ text: "# private", keyId: "remembered-key" });
  const document = await h.context.readDesktopDocument("private.md");
  assert.equal(document.text, "# private");
  assert.equal(document.keyId, "remembered-key");
});

test("first Ctrl+S of an empty draft refreshes the workspace after writing it", async () => {
  const h = harness([documentTab("draft.md", null, "", "")]);
  const folder = {path: "C:/notes", tree: []};
  h.context.state.folders = [folder];
  h.context.workspaceTree = [{name: "draft.md", kind: "file", path: "C:/notes/draft.md"}];
  await h.context.save();
  await h.context.refreshWorkspace();
  assert.equal(h.writes().length, 1);
  assert.equal(folder.tree[0].path, h.writes()[0].args.path);
  assert(h.calls.findIndex(call => call.command === "write_text") < h.calls.findIndex(call => call.command === "list_workspace"));
});

test("a pre-save workspace scan is followed by a fresh scan without blocking saving", async () => {
  const h = harness([documentTab("draft.md", null, "new", "")]);
  const folder = {path: "C:/notes", tree: []};
  h.context.state.folders = [folder];
  let releaseOldScan, scans = 0;
  const nativeInvoke = h.context.invoke;
  h.context.invoke = (command, args) => {
    if (command !== "list_workspace") return nativeInvoke(command, args);
    scans += 1;
    if (scans === 1) return new Promise(resolve => { releaseOldScan = resolve; });
    return Promise.resolve([{name: "draft.md", path: "C:/notes/draft.md"}]);
  };
  const oldScan = h.context.refreshWorkspace();
  while (!releaseOldScan) await Promise.resolve();
  await h.context.save();
  assert.equal(h.writes().length, 1, "save finishes while the old scan is still pending");
  assert.equal(scans, 1);
  const afterSave = h.context.refreshWorkspace({afterSave: true});
  assert.equal(afterSave, h.context.refreshWorkspace({afterSave: true}), "pending requests share one follow-up scan");
  releaseOldScan([]);
  await oldScan;
  await afterSave;
  assert.equal(scans, 2);
  assert.equal(folder.tree[0].path, "C:/notes/draft.md");
});

test("failed or cancelled saves do not refresh the workspace", async () => {
  const cancelled = harness([documentTab("draft.md", null, "draft", "")], false, []);
  cancelled.context.state.folders = [{path: "C:/notes", tree: []}];
  await cancelled.context.save();
  assert.equal(cancelled.calls.filter(call => call.command === "list_workspace").length, 0);
  const failed = harness(undefined, false);
  failed.context.state.folders = [{path: "C:/notes", tree: []}];
  failed.context.writeError = Error("Disk full");
  await failed.context.save();
  assert.equal(failed.calls.filter(call => call.command === "list_workspace").length, 0);
});

test("cancel keeps modified documents and the window open", async () => {
  const h = harness(undefined, false);
  await h.context.requestAppClose();
  assert(!h.finished());
  assert.equal(h.writes().length, 0);
  assert.equal(h.context.state.tabs.length, 1);
  assert(h.context.state.dirty);
});
test("explicit discard closes without writing", async () => {
  const h = harness(undefined, "discard");
  await h.context.requestAppClose();
  assert(h.finished());
  assert.equal(h.writes().length, 0);
});
test("save writes the current document before closing", async () => {
  const h = harness();
  await h.context.requestAppClose();
  assert.equal(h.writes()[0].args.contents, "new\n");
  assert.equal(h.calls.at(-1).command, "finish_close");
  assert.equal(h.context.state.dirty, false);
});
test("a draft asks for a destination even without a workspace", async () => {
  const h = harness([documentTab("draft.md", null, "draft text", "")]);
  await h.context.requestAppClose();
  assert.equal(h.calls[0].command, "save_file");
  assert.equal(h.writes()[0].args.path, "C:/notes/draft.md");
  assert.equal(h.writes()[0].args.contents, "draft text");
  assert(h.finished());
});
test("cancelling the native save dialog does not exit or mark a draft saved", async () => {
  const h = harness([documentTab("draft.md", null, "draft text", "")], "save", []);
  await h.context.requestAppClose();
  assert(!h.finished());
  assert.equal(h.context.state.tabs[0].saved, null);
  assert.equal(h.writes().length, 0);
});
test("write failure offers recovery and keeps all documents open when cancelled", async () => {
  const h = harness(); h.context.writeError = Error("Disk full");
  await h.context.requestAppClose();
  assert(!h.finished());
  assert.equal(h.prompts.length, 2);
  assert(h.prompts[1].message.startsWith("saveElsewhere"));
  assert.equal(h.context.state.tabs[0].unavailable, true);
  assert.equal(h.context.state.tabs[0].saved, "old\n");
  assert.equal(h.context.state.tabs.length, 1);
});
test("a disconnected clean file closes without accessing its missing disk", async () => {
  const h = harness([documentTab("usb.md", "USB text", "USB text", "Z:/usb.md")]);
  h.context.failPath = "Z:/usb.md";
  await h.context.closeTab(h.context.state.activeKey);
  assert.equal(h.calls.length, 0);
  assert.equal(h.prompts.length, 0);
  assert.equal(h.context.state.tabs.length, 0);
});
test("a modified disconnected file can be discarded without any disk I/O", async () => {
  const h = harness([documentTab("usb.md", "old", "unsaved USB text", "Z:/usb.md")], "discard");
  await h.context.closeTab(h.context.state.activeKey);
  assert.equal(h.calls.length, 0);
  assert.equal(h.context.state.tabs.length, 0);
});
test("failed USB save can be redirected to a local path before closing", async () => {
  const h = harness([documentTab("usb.md", "old", "unsaved USB text", "Z:/usb.md")], "save", ["C:/notes/recovered.md"]);
  h.context.failPath = "Z:/usb.md";
  h.context.choices = ["save", "save-as"];
  await h.context.requestAppClose();
  assert(h.finished());
  assert.equal(h.writes().length, 2);
  assert.equal(h.writes()[1].args.path, "C:/notes/recovered.md");
  assert.equal(h.writes()[1].args.contents, "unsaved USB text");
  assert.equal(h.context.state.filePath, "C:/notes/recovered.md");
  assert.equal(h.context.state.tabs[0].unavailable, false);
});
test("failed USB save can be discarded directly from the recovery dialog", async () => {
  const h = harness([documentTab("usb.md", "old", "unsaved USB text", "Z:/usb.md")]);
  h.context.failPath = "Z:/usb.md";
  h.context.choices = ["save", "discard"];
  await h.context.closeTab(h.context.state.activeKey);
  assert.equal(h.context.state.tabs.length, 0);
});
test("cancelling recovery preserves content and releases the close guard for a later close", async () => {
  const h = harness([documentTab("usb.md", "old", "unsaved USB text", "Z:/usb.md")]);
  h.context.failPath = "Z:/usb.md";
  h.context.choices = ["save", false, "discard"];
  const key = h.context.state.activeKey;
  await h.context.closeTab(key);
  assert.equal(h.context.state.tabs.length, 1);
  assert.equal(h.context.live, "unsaved USB text");
  assert.equal(h.context.state.tabs[0].saved, "old");
  await h.context.closeTab(key);
  assert.equal(h.context.state.tabs.length, 0);
});
test("cancelling recovery's Save As retains the cached document", async () => {
  const h = harness([documentTab("usb.md", "old", "unsaved USB text", "Z:/usb.md")], "save", []);
  h.context.failPath = "Z:/usb.md";
  h.context.choices = ["save", "save-as"];
  await h.context.requestAppClose();
  assert(!h.finished());
  assert.equal(h.context.live, "unsaved USB text");
  assert.equal(h.context.state.filePath, "Z:/usb.md");
  assert.equal(h.context.state.tabs[0].saved, "old");
});
test("a hung file request times out and releases the close guard", async () => {
  const h = harness();
  h.context.writePending = new Promise(() => {});
  h.context.choices = ["save", false, "discard"];
  vm.runInContext("const boundedInvokeFile = invokeFile; invokeFile = (command, args) => boundedInvokeFile(command, args, 15);", h.context);
  const key = h.context.state.activeKey;
  await h.context.closeTab(key);
  assert.equal(h.context.state.tabs.length, 1);
  assert.equal(h.context.state.tabs[0].saved, "old\n");
  await h.context.closeTab(key);
  assert.equal(h.context.state.tabs.length, 0);
});

function externalHarness() {
  const h = harness([documentTab("usb.md", "USB text", "USB text", "Z:/usb.md")]);
  h.context.state.stamp = 1;
  h.context.refreshWorkspace = () => Promise.resolve();
  h.context.queueMicrotask = queueMicrotask;
  vm.runInContext("let loadGen = 0; " + section("let externalRefreshing =", "if (isDesktop() && window.__TAURI_INTERNALS__.transformCallback)"), h.context);
  return h;
}
test("device disconnection retains cached text and never leaves the editor loading", async () => {
  const h = externalHarness();
  h.context.invoke = async () => { throw Error("Device removed"); };
  await h.context.refreshExternal();
  assert.equal(h.context.live, "USB text");
  assert.equal(h.context.state.tabs[0].saved, "USB text");
  assert.equal(h.context.state.tabs[0].unavailable, true);
  assert.equal(h.context.state.loading, false);
});
test("a close does not wait for an in-flight disk check or resurrect the closed tab", async () => {
  const h = externalHarness(); let resolve;
  h.context.invoke = (command) => command === "file_stamp" ? new Promise((done) => { resolve = done; }) : Promise.resolve();
  const refresh = h.context.refreshExternal();
  await Promise.resolve();
  await h.context.closeTab(h.context.state.activeKey);
  assert.equal(h.context.state.tabs.length, 0);
  resolve(2); await refresh;
  assert.equal(h.context.state.tabs.length, 0);
  assert.equal(h.context.live, "USB text");
});
test("a delayed external read never replaces a different active document", async () => {
  const h = externalHarness(); let resolve;
  h.context.invoke = async (command) => command === "file_stamp" ? 2 : new Promise((done) => { resolve = done; });
  const refresh = h.context.refreshExternal();
  while (!resolve) await Promise.resolve();
  const other = documentTab("other.md", "other text", "other text");
  h.context.state.tabs.push(other);
  Object.assign(h.context.state, { activeKey: other.key, filePath: other.filePath, saved: other.saved });
  h.context.live = "other text";
  resolve("old device response"); await refresh;
  assert.equal(h.context.live, "other text");
  assert.equal(h.context.state.saved, "other text");
  assert.equal(h.context.state.loading, false);
});
test("typing during an external read keeps the newer edits", async () => {
  const h = externalHarness(); let resolve;
  h.context.invoke = async (command) => command === "file_stamp" ? 2 : new Promise((done) => { resolve = done; });
  const refresh = h.context.refreshExternal();
  while (!resolve) await Promise.resolve();
  h.context.live = "new unsaved edits";
  resolve("external text"); await refresh;
  assert.equal(h.context.live, "new unsaved edits");
  assert.equal(h.context.state.saved, "USB text");
  assert.equal(h.context.state.loading, false);
});
test("workspace scanning cannot block the active file check", async () => {
  const h = externalHarness();
  h.context.refreshWorkspace = () => new Promise(() => {});
  h.context.invoke = async () => 1;
  await h.context.refreshExternal();
  assert.equal(h.context.state.stamp, 1);
  assert.equal(h.context.state.tabs[0].unavailable, false);
});
test("multiple documents save their own text, including inactive drafts", async () => {
  const h = harness([documentTab(), documentTab("b.md", "b old", "b new"), documentTab("draft.md", null, "draft", "")]);
  await h.context.requestAppClose();
  assert.equal(h.prompts.length, 1);
  assert(h.prompts[0].message.includes('"count":3'));
  assert.deepEqual(h.writes().map((call) => call.args.contents), ["new\n", "b new", "draft"]);
  assert(h.finished());
});
test("cancelling a later save leaves every tab open and preserves earlier saves", async () => {
  const h = harness([documentTab(), documentTab("draft.md", null, "draft", "")], "save", []);
  await h.context.requestAppClose();
  assert(!h.finished());
  assert.equal(h.context.state.tabs.length, 2);
  assert.equal(h.context.state.tabs[0].saved, "new\n");
  assert.equal(h.context.state.tabs[1].saved, null);
});
test("an edit during saving prevents exit", async () => {
  const h = harness(); h.context.duringWrite = () => { h.context.live = "a later edit"; };
  await h.context.requestAppClose();
  assert(!h.finished());
  assert(h.context.state.dirty);
  assert.equal(h.context.state.tabs[0].value, "a later edit");
});
test("last-tab cancel keeps it open and discard closes it", async () => {
  const cancelled = harness(undefined, false);
  await cancelled.context.closeTab(cancelled.context.state.activeKey);
  assert.equal(cancelled.context.state.tabs.length, 1);
  const discarded = harness(undefined, "discard");
  await discarded.context.closeTab(discarded.context.state.activeKey);
  assert.equal(discarded.context.state.tabs.length, 0);
});
test("switching tabs during a write does not replace the new active document's baseline", async () => {
  const a = documentTab(), b = documentTab("b.md", "b old", "b new");
  const h = harness([a, b]);
  h.context.duringWrite = () => {
    h.context.state.activeKey = b.key;
    h.context.state.saved = b.saved;
    h.context.state.name = b.name;
    h.context.state.filePath = b.filePath;
    h.context.live = b.value;
  };
  await h.context.saveTabBeforeClose(a);
  assert.equal(h.context.state.saved, "b old");
  assert.equal(h.context.state.name, "b.md");
  assert.equal(b.saved, "b old");
  assert.equal(a.saved, "new\n");
});
test("new documents opened during saving prevent window exit", async () => {
  const h = harness();
  h.context.duringWrite = () => h.context.state.tabs.push(documentTab("draft.md", null, "new draft", ""));
  await h.context.requestAppClose();
  assert(!h.finished());
  assert.equal(h.context.state.tabs.length, 2);
});
test("saving a last draft still closes the correct tab after its key changes", async () => {
  const h = harness([documentTab("draft.md", null, "draft", "")]);
  await h.context.closeTab(h.context.state.activeKey);
  assert.equal(h.context.state.tabs.length, 0);
  assert.equal(h.writes()[0].args.contents, "draft");
});
test("saving an inactive tab never writes the active document into it", async () => {
  const h = harness([documentTab(), documentTab("b.md", "b old", "b new")]);
  const activeKey = h.context.state.activeKey;
  await h.context.closeTab(h.context.state.tabs[1].key);
  assert.equal(h.writes()[0].args.contents, "b new");
  assert.equal(h.context.live, "new\n");
  assert.equal(h.context.state.activeKey, activeKey);
  assert.equal(h.context.state.tabs.length, 1);
});
test("repeated window-close events do not duplicate the prompt", async () => {
  const h = harness(); let resolve;
  h.context.askDialog = () => { h.prompts.push({}); return new Promise((done) => { resolve = done; }); };
  const first = h.context.requestAppClose();
  await h.context.requestAppClose();
  assert.equal(h.prompts.length, 1);
  resolve(false); await first;
  assert(!h.finished());
});
test("three-way dialogs queue without replacing an existing prompt", async () => {
  const elements = new Map();
  const context = { t: (key) => key, document: { activeElement: null, getElementById(id) {
    if (!elements.has(id)) elements.set(id, { hidden: true, focus() {} });
    return elements.get(id);
  } } };
  vm.createContext(context);
  vm.runInContext(section("let dialogQueue =", "function errorText("), context);
  const first = context.askDialog({ title: "First", okValue: "save", extraText: "Discard", extraValue: "discard" });
  const second = context.askDialog({ title: "Second" });
  await Promise.resolve();
  assert.equal(elements.get("dialog-title").textContent, "First");
  elements.get("dialog-extra").onclick();
  assert.equal(await first, "discard");
  await Promise.resolve(); await Promise.resolve();
  assert.equal(elements.get("dialog-title").textContent, "Second");
  elements.get("dialog").onkeydown({ key: "Escape", preventDefault() {} });
  assert.equal(await second, false);
  assert.equal(elements.get("dialog").hidden, true);
  assert.equal(elements.get("dialog").onkeydown, null);
});
