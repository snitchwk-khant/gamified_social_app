import { Network } from "@capacitor/network";

const INITIAL_STATE = {
  connected: true,
  connectionType: "unknown",
  initialized: false,
  launchedOffline: false,
  queueSize: 0,
  status: "online",
};

const listeners = new Set();
const queue = [];
let state = INITIAL_STATE;
let pluginListener = null;
let startPromise = null;
let flushing = false;
let browserListenersAttached = false;

function getBrowserConnected() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function handleBrowserOnline() {
  handleNetworkChange({ connected: true, connectionType: "unknown" });
}

function handleBrowserOffline() {
  handleNetworkChange({ connected: false, connectionType: "none" });
}

function attachBrowserListeners() {
  if (browserListenersAttached || typeof window === "undefined") {
    return;
  }

  window.addEventListener("online", handleBrowserOnline);
  window.addEventListener("offline", handleBrowserOffline);
  browserListenersAttached = true;
}

function removeBrowserListeners() {
  if (!browserListenersAttached || typeof window === "undefined") {
    return;
  }

  window.removeEventListener("online", handleBrowserOnline);
  window.removeEventListener("offline", handleBrowserOffline);
  browserListenersAttached = false;
}

function emit() {
  listeners.forEach((listener) => listener(state));
}

function setState(nextState) {
  state = {
    ...state,
    ...nextState,
    queueSize: queue.length,
  };
  emit();
}

function normalizeStatus(status = {}) {
  const connected = Boolean(status.connected);

  return {
    connected,
    connectionType: status.connectionType || "unknown",
    status: connected ? "online" : "offline",
  };
}

async function flushQueue() {
  if (flushing || !state.connected || !queue.length) {
    return;
  }

  flushing = true;
  setState({ status: "reconnecting" });

  while (queue.length && state.connected) {
    const item = queue.shift();
    setState({});

    try {
      const result = await item.task();
      item.resolve(result);
    } catch (error) {
      item.reject(error);
    }
  }

  flushing = false;
  setState({ status: state.connected ? "online" : "offline" });
}

async function handleNetworkChange(status) {
  const wasConnected = state.connected;
  const nextStatus = normalizeStatus(status);

  setState(nextStatus);

  if (!wasConnected && nextStatus.connected) {
    await flushQueue();
  }
}

export async function startNetworkService() {
  if (startPromise) {
    return startPromise;
  }

  startPromise = (async () => {
    attachBrowserListeners();

    try {
      const status = await Network.getStatus();
      const nextStatus = normalizeStatus(status);

      setState({
        ...nextStatus,
        initialized: true,
        launchedOffline: !nextStatus.connected,
      });

      pluginListener = await Network.addListener("networkStatusChange", handleNetworkChange);
    } catch {
      setState({
        connected: getBrowserConnected(),
        connectionType: "unknown",
        initialized: true,
        launchedOffline: !getBrowserConnected(),
        status: getBrowserConnected() ? "online" : "offline",
      });
    }

    return state;
  })();

  return startPromise;
}

export async function stopNetworkService() {
  if (pluginListener?.remove) {
    await pluginListener.remove();
  }

  pluginListener = null;
  startPromise = null;
  removeBrowserListeners();
}

export function subscribeToNetwork(listener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getNetworkSnapshot() {
  return state;
}

export async function refreshNetworkStatus() {
  await startNetworkService();

  try {
    const status = await Network.getStatus();
    await handleNetworkChange(status);
  } catch {
    const connected = getBrowserConnected();
    setState({
      connected,
      connectionType: "unknown",
      status: connected ? "online" : "offline",
    });

    if (connected) {
      await flushQueue();
    }
  }

  return state;
}

export function enqueueNetworkRequest(task) {
  if (typeof task !== "function") {
    return Promise.reject(new Error("Queued network request must be a function."));
  }

  if (state.connected) {
    return task();
  }

  return new Promise((resolve, reject) => {
    queue.push({ task, resolve, reject });
    setState({ status: "offline" });
  });
}

export async function retryQueuedNetworkRequests() {
  const nextState = await refreshNetworkStatus();

  if (nextState.connected) {
    await flushQueue();
  }

  return getNetworkSnapshot();
}

const NetworkService = {
  enqueue: enqueueNetworkRequest,
  getSnapshot: getNetworkSnapshot,
  refresh: refreshNetworkStatus,
  retryQueued: retryQueuedNetworkRequests,
  start: startNetworkService,
  stop: stopNetworkService,
  subscribe: subscribeToNetwork,
};

export default NetworkService;
