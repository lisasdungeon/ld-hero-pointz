/**
 * Minimal Foundry/DOM stubs for ld-hero-pointz unit tests.
 */

let originalGlobals;
let settingsStore = new Map();
let elementRegistry = new Map();
const hookHandlers = new Map();

function createElement(tag) {
  const listeners = {};
  const children = [];
  const el = {
    tagName: String(tag).toUpperCase(),
    className: '',
    id: '',
    style: {},
    dataset: {},
    children,
    parentNode: null,
    _innerHTML: '',
    get innerHTML() {
      return this._innerHTML;
    },
    set innerHTML(value) {
      this._innerHTML = String(value);
      this._parsed = true;
    },
    textContent: '',
    value: '',
    appendChild(child) {
      children.push(child);
      child.parentNode = el;
      return child;
    },
    remove() {
      if (el.parentNode) {
        const sibs = el.parentNode.children;
        const idx = sibs.indexOf(el);
        if (idx >= 0) sibs.splice(idx, 1);
      }
      if (el.id) elementRegistry.delete(el.id);
    },
    querySelector(sel) {
      if (sel === '.message-content') {
        return children.find((c) => c.className === 'message-content') || null;
      }
      if (sel === '.window-header') {
        return children.find((c) => c.className === 'window-header') ||
          (el.className === 'window-header' ? el : null) ||
          el._header ||
          null;
      }
      if (sel === '.ld-hero-pointz-gm-controls') {
        return children.find((c) => c.className === 'ld-hero-pointz-gm-controls') || null;
      }
      if (sel.startsWith('.')) {
        const cls = sel.slice(1);
        const found = children.find((c) => c.className === cls || (c.className || '').includes(cls));
        if (found) return found;
        for (const child of children) {
          if (child.querySelector) {
            const nested = child.querySelector(sel);
            if (nested) return nested;
          }
        }
        return null;
      }
      if (sel.startsWith('input[name=')) {
        const name = sel.match(/name="([^"]+)"/)?.[1] || sel.match(/name='([^']+)'/)?.[1];
        return children.find((c) => c.name === name) || el._inputs?.[name] || null;
      }
      if (sel.startsWith('#')) {
        const id = sel.slice(1);
        return children.find((c) => c.id === id) || null;
      }
      return null;
    },
    querySelectorAll(sel) {
      if (sel.startsWith('.')) {
        const cls = sel.slice(1);
        const out = [];
        const walk = (node) => {
          const name = node.className || '';
          if (name === cls || name.includes(cls) || name.split(/\s+/).includes(cls)) out.push(node);
          for (const c of node.children || []) walk(c);
        };
        walk(el);
        return out;
      }
      if (sel === '[data-actor-id]') {
        return children.filter((c) => c.dataset?.actorId != null);
      }
      return [];
    },
    addEventListener(type, fn) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    },
    dispatchEvent(event) {
      const payload = event?.target ? event : { ...(event || {}), target: el, currentTarget: el, type: event?.type };
      for (const fn of listeners[payload.type] || []) fn(payload);
      return true;
    },
    closest(sel) {
      if (sel === 'button' && el.tagName === 'BUTTON') return el;
      if (sel === '[data-action]' && el.dataset?.action) return el;
      return null;
    },
    setAttribute(name, value) {
      el[name] = value;
    },
    click() {
      for (const fn of listeners.click || []) fn({ type: 'click', target: el, currentTarget: el });
    },
    _listeners: listeners
  };
  if (globalThis.HTMLElement) {
    Object.setPrototypeOf(el, globalThis.HTMLElement.prototype);
  }
  return el;
}

export function installMocks(options = {}) {
  if (!originalGlobals) {
    originalGlobals = {
      game: globalThis.game,
      ui: globalThis.ui,
      document: globalThis.document,
      Hooks: globalThis.Hooks,
      foundry: globalThis.foundry,
      Dialog: globalThis.Dialog,
      Roll: globalThis.Roll,
      ChatMessage: globalThis.ChatMessage,
      canvas: globalThis.canvas,
      HTMLElement: globalThis.HTMLElement,
      window: globalThis.window,
      fromUuid: globalThis.fromUuid
    };
  }

  settingsStore = new Map();
  elementRegistry = new Map();
  hookHandlers.clear();

  const actors = options.actors || [];
  const actorMap = new Map(actors.map((a) => [a.id, a]));

  const game = {
    user: options.user ?? { id: 'gm1', isGM: true },
    users: {
      get: (id) => {
        if (id === 'gm1' || id === game.user.id) return { id: game.user.id, name: 'GM Player' };
        return options.users?.find?.((u) => u.id === id) || null;
      }
    },
    actors: Object.assign([...actorMap.values()], {
      get: (id) => actorMap.get(id) ?? null,
      forEach: (fn) => actorMap.forEach((a) => fn(a))
    }),
    settings: {
      register(moduleId, key, config) {
        const storeKey = `${moduleId}.${key}`;
        if (!settingsStore.has(storeKey)) settingsStore.set(storeKey, config.default);
        settingsStore.set(`${storeKey}__config`, config);
      },
      registerMenu(moduleId, key, config) {
        const type = config?.type;
        const AppV2 = globalThis.foundry?.applications?.api?.ApplicationV2;
        const FormApplication = globalThis.FormApplication;
        const isV2 = Boolean(AppV2) && type && (type === AppV2 || type.prototype instanceof AppV2);
        const isV1 = Boolean(FormApplication) && type && (type === FormApplication || type.prototype instanceof FormApplication);
        if (!isV2 && !isV1) {
          throw new Error('You must provide a menu type that is a FormApplication or ApplicationV2 instance or subclass');
        }
        settingsStore.set(`${moduleId}.menu.${key}`, config);
      },
      get(moduleId, key) {
        return settingsStore.get(`${moduleId}.${key}`);
      },
      async set(moduleId, key, value) {
        settingsStore.set(`${moduleId}.${key}`, value);
        return value;
      }
    },
    socket: {
      on(channel, fn) {
        game._socketHandler = fn;
        game._socketChannel = channel;
      },
      emit(channel, payload) {
        game._emitted = game._emitted || [];
        game._emitted.push({ channel, payload });
      }
    },
    i18n: {
      localize: (key) => key,
      format: (key, data) => `${key}:${JSON.stringify(data || {})}`
    }
  };

  const ui = {
    notifications: {
      info: (...a) => { ui._info = ui._info || []; ui._info.push(a); },
      warn: (...a) => { ui._warn = ui._warn || []; ui._warn.push(a); },
      error: (...a) => { ui._error = ui._error || []; ui._error.push(a); }
    },
    windows: {}
  };

  const Hooks = {
    on(name, fn) {
      if (!hookHandlers.has(name)) hookHandlers.set(name, []);
      hookHandlers.get(name).push(fn);
    },
    once(name, fn) {
      if (!hookHandlers.has(name)) hookHandlers.set(name, []);
      hookHandlers.get(name).push(fn);
    },
    call(name, ...args) {
      for (const fn of hookHandlers.get(name) || []) fn(...args);
    },
    _handlers: hookHandlers
  };

  class ApplicationV2 {
    static instances = [];
    constructor(...args) {
      this._args = args;
      this.element = createElement('div');
      ApplicationV2.instances.push(this);
    }
    async render() {
      return this;
    }
    close() {
      return this;
    }
    async _prepareContext() {
      return {};
    }
    _attachPartListeners() {}
  }

  const HandlebarsApplicationMixin = (Base) => class extends Base {};

  const DialogV2 = {
    confirm: async () => true,
    input: async () => ({ amount: '1' })
  };

  globalThis.foundry = {
    applications: {
      api: { ApplicationV2, HandlebarsApplicationMixin, DialogV2 }
    },
    utils: {
      randomID: () => `id-${Math.random().toString(36).slice(2, 9)}`,
      getProperty(obj, path) {
        return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
      },
      setProperty(obj, path, value) {
        const parts = path.split('.');
        let cur = obj;
        for (let i = 0; i < parts.length - 1; i++) {
          if (cur[parts[i]] == null) cur[parts[i]] = {};
          cur = cur[parts[i]];
        }
        cur[parts[parts.length - 1]] = value;
      },
      hasProperty(obj, path) {
        return this.getProperty(obj, path) !== undefined;
      }
    }
  };

  globalThis.game = game;
  globalThis.ui = ui;
  globalThis.Hooks = Hooks;
  globalThis.document = {
    createElement,
    getElementById: (id) => elementRegistry.get(id) || null,
    head: {
      appendChild(el) {
        if (el.id) elementRegistry.set(el.id, el);
        return el;
      }
    }
  };
  globalThis.Dialog = {
    confirm: async () => true
  };
  globalThis.Roll = class Roll {
    constructor(formula) {
      this.formula = formula;
      this.total = 4;
    }
    async evaluate() {
      return this;
    }
    async toMessage() {
      return this;
    }
  };
  globalThis.ChatMessage = {
    getSpeaker: () => ({ alias: 'test' }),
    create: async (data) => data
  };
  globalThis.canvas = {
    tokens: {
      get: () => null,
      controlled: []
    }
  };
  globalThis.fromUuid = async () => null;
  globalThis.HTMLElement = class HTMLElement {};
  globalThis.window = globalThis;

  return { game, ui, Hooks, settingsStore, ApplicationV2, createElement };
}

export function restoreGlobals() {
  if (!originalGlobals) return;
  for (const [key, value] of Object.entries(originalGlobals)) {
    if (value === undefined) delete globalThis[key];
    else globalThis[key] = value;
  }
}

export function getHookHandlers() {
  return hookHandlers;
}

export function makeActor({
  id = 'a1',
  name = 'Fighter',
  type = 'character',
  flags = {},
  level = 1,
  isOwner = true
} = {}) {
  const flagStore = { 'ld-hero-pointz': { ...flags } };
  return {
    id,
    name,
    type,
    isOwner,
    uuid: `Actor.${id}`,
    documentName: 'Actor',
    calls: { setFlag: [], update: [] },
    system: {
      details: { level },
      attributes: { death: { success: 0, failure: 1 } }
    },
    getFlag(moduleId, key) {
      return flagStore[moduleId]?.[key];
    },
    async setFlag(moduleId, key, value) {
      this.calls.setFlag.push({ moduleId, key, value });
      flagStore[moduleId] = { ...flagStore[moduleId], [key]: value };
    },
    async update(data) {
      this.calls.update.push(data);
      if (data['system.attributes.death.failure'] != null) {
        this.system.attributes.death.failure = data['system.attributes.death.failure'];
      }
      if (data['system.attributes.death.success'] != null) {
        this.system.attributes.death.success = data['system.attributes.death.success'];
      }
    }
  };
}
