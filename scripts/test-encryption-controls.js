const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const source = fs.readFileSync(path.join(__dirname, "../public/encryption.js"), "utf8");

function harness(keys = [{id: "personal", name: "Personal"}, {id: "work", name: "Work"}]) {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      value: "", children: [], attributes: {}, listeners: {}, dataset: {}, classes: new Set(),
      replaceChildren() { this.children = []; }, appendChild(child) { this.children.push(child); },
      append(...children) { this.children.push(...children); },
      addEventListener(type, handler) { this.listeners[type] = handler; },
      setAttribute(name, value) { this.attributes[name] = value; },
      focus() { this.focused = true; },
      classList: { toggle() {} },
    });
    return elements.get(id);
  }
  const tab = {key: "first", name: "first.md", encryptionKeyId: "", savedEncryptionKeyId: ""};
  const context = {
    I18N: {zh: {}, en: {}}, desktop: false, marks: 0, settingsOpened: false,
    state: {tabs: [tab], activeKey: tab.key},
    document: {getElementById: element, createElement: () => element("new-" + elements.size), querySelectorAll: () => []},
    isDesktop: () => context.desktop,
    t: key => context.I18N.en[key] || key,
    applyI18n() {}, showSettings() { context.settingsOpened = true; },
    encryptionChanged: item => !!item && (item.encryptionKeyId || "") !== (item.savedEncryptionKeyId || ""),
    markDirty() { context.marks += 1; context.renderEncryptionSettings(); },
    invoke() { throw Error("Controls must not save files or expose key secrets"); },
  };
  vm.createContext(context); vm.runInContext(source, context);
  context.desktop = true;
  vm.runInContext("encryptionKeys = " + JSON.stringify(keys), context);
  context.renderEncryptionSettings();
  return {context, tab, element, fire(id, type, value) {
    const target = element(id); if (value !== undefined) target.value = value;
    return target.listeners[type]({currentTarget: target});
  }};
}

test("quick encryption switch retains the selected key when toggled off and on", () => {
  const h = harness();
  h.fire("quick-encryption-key", "change", "work");
  assert.equal(h.tab.encryptionKeyId, "", "choosing a key alone does not turn encryption on");
  assert.equal(h.context.marks, 0);
  h.fire("quick-encryption-toggle", "click");
  assert.equal(h.tab.encryptionKeyId, "work");
  assert.equal(h.element("quick-encryption-toggle").attributes["aria-checked"], "true");
  assert.equal(h.element("document-encryption-key").value, "work");
  h.fire("quick-encryption-toggle", "click");
  assert.equal(h.tab.encryptionKeyId, "");
  assert.equal(h.element("quick-encryption-key").value, "work");
  h.fire("quick-encryption-toggle", "click");
  assert.equal(h.tab.encryptionKeyId, "work");
  assert.equal(h.tab.savedEncryptionKeyId, "", "the choice remains pending until a real save succeeds");
});

test("sidebar and settings encryption controls stay in sync for the active document", () => {
  const h = harness();
  h.fire("document-encryption-key", "change", "personal");
  assert.equal(h.element("quick-encryption-key").value, "personal");
  assert.equal(h.element("quick-encryption-toggle").attributes["aria-checked"], "true");
  h.fire("quick-encryption-key", "change", "work");
  assert.equal(h.element("document-encryption-key").value, "work");
  const other = {key: "second", name: "second.md", encryptionKeyId: "personal", savedEncryptionKeyId: "personal"};
  h.context.state.tabs.push(other); h.context.state.activeKey = other.key;
  h.context.renderEncryptionSettings();
  assert.equal(h.element("quick-encryption-key").value, "personal");
  h.fire("quick-encryption-toggle", "click");
  assert.equal(other.encryptionKeyId, "");
  assert.equal(h.tab.encryptionKeyId, "work", "changing another tab does not affect the first file");
});

test("enabling encryption without a key opens key settings without changing the document", () => {
  const h = harness([]);
  h.fire("quick-encryption-toggle", "click");
  assert.equal(h.context.settingsOpened, true);
  assert.equal(h.element("encryption-key-name").focused, true);
  assert.equal(h.tab.encryptionKeyId, "");
  assert.equal(h.context.marks, 0);
});

test("missing keys stay visible and unavailable controls do not alter documents", () => {
  const h = harness();
  h.tab.encryptionKeyId = h.tab.savedEncryptionKeyId = "missing";
  h.context.renderEncryptionSettings();
  assert.equal(h.element("quick-encryption-key").value, "missing");
  assert.equal(h.element("quick-encryption-toggle").attributes["aria-checked"], "true");
  assert(h.element("quick-encryption-key").children.some(option => option.value === "missing" && option.disabled));
  h.context.desktop = false;
  h.context.renderEncryptionSettings();
  assert.equal(h.element("quick-encryption-toggle").disabled, true);
  h.fire("quick-encryption-toggle", "click");
  assert.equal(h.tab.encryptionKeyId, "missing");
  h.context.desktop = true; h.context.state.activeKey = "";
  h.context.renderEncryptionSettings();
  assert.equal(h.element("quick-encryption-key").disabled, true);
});
