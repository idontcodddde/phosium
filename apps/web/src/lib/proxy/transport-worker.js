import { createProxyTransport } from "@repo/proxy";

const beforeRequest = [];
const afterResponse = [];
const activeRequests = new WeakMap();
const activeSockets = new WeakMap();
let transport = null;
let currentTransportType = "epoxy";
let currentWispUrl = "";
let controlQueue = Promise.resolve();

self.proxyTransportHooks = { beforeRequest, afterResponse };

function postSocketMessage(port, message) {
  const data = message.data;
  if (data instanceof ArrayBuffer) {
    const copy = data.slice(0);
    port.postMessage({ ...message, data: copy }, [copy]);
    return;
  }
  port.postMessage(message);
}

async function postResponse(port, message, response) {
  const payload = { ...message, ok: true, res: response };
  const body = response.body;
  if (!(body instanceof ReadableStream) && !(body instanceof ArrayBuffer)) {
    port.postMessage(payload);
    return;
  }

  try {
    port.postMessage(payload, [body]);
  } catch (error) {
    let fallbackBody = body;
    if (body instanceof ReadableStream) {
      try {
        fallbackBody = await new Response(body).arrayBuffer();
      } catch (fallbackError) {
        port.postMessage({
          ...message,
          ok: false,
          error: `Unable to transfer the proxy response body: ${String(fallbackError)}`,
        });
        return;
      }
    } else {
      fallbackBody = body.slice(0);
    }

    try {
      port.postMessage({ ...message, ok: true, res: { ...response, body: fallbackBody } }, [fallbackBody]);
    } catch {
      try {
        port.postMessage({ ...message, ok: true, res: { ...response, body: fallbackBody } });
      } catch (finalError) {
        port.postMessage({
          ...message,
          ok: false,
          error: `Unable to send the proxy response: ${String(finalError ?? error)}`,
        });
      }
    }
  }
}

function postError(port, message, error) {
  port.postMessage({
    ...message,
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  });
}

async function runRequest(port, request) {
  const requestId = request.requestId;
  const message = { type: "RESULT", requestId };
  const controller = new AbortController();
  const requestMap = activeRequests.get(port) ?? new Map();
  activeRequests.set(port, requestMap);
  requestMap.set(requestId, controller);

  const listener = (event) => {
    if (event.data?.type === "ABORT" && event.data.requestId === requestId) {
      controller.abort();
    }
  };
  port.addEventListener("message", listener);

  try {
    let context = {
      remote: new URL(request.remote),
      method: request.method,
      body: request.body ?? null,
      headers: request.headers ?? [],
      signal: controller.signal,
    };
    for (const hook of beforeRequest) {
      context = (await hook(context)) ?? context;
    }

    let response = await transport.request(
      context.remote,
      context.method,
      context.body,
      context.headers,
      context.signal,
    );
    for (const hook of afterResponse) {
      response = (await hook(response, context)) ?? response;
    }
    await postResponse(port, message, response);
  } catch (error) {
    if (!controller.signal.aborted) postError(port, message, error);
  } finally {
    port.removeEventListener("message", listener);
    requestMap.delete(requestId);
    port.close();
  }
}

function connectSocket(port, request) {
  const connectionId = request.connectionId ?? "direct";
  const socketMap = activeSockets.get(port) ?? new Map();
  activeSockets.set(port, socketMap);

  try {
    const [send, close] = transport.connect(
      new URL(request.url),
      request.protocols ?? [],
      request.requestHeaders ?? [],
      (protocol, extensions) => postSocketMessage(port, {
        type: "SOCKET_OPEN",
        connectionId,
        protocol,
        extensions,
      }),
      (data) => postSocketMessage(port, { type: "SOCKET_MESSAGE", connectionId, data }),
      (code, reason) => {
        postSocketMessage(port, { type: "SOCKET_CLOSE", connectionId, code, reason });
        socketMap.delete(connectionId);
        port.close();
      },
      (error) => postSocketMessage(port, {
        type: "SOCKET_ERROR",
        connectionId,
        error,
      }),
    );
    socketMap.set(connectionId, { send, close });

    const listener = (event) => {
      if (event.data?.connectionId !== connectionId) return;
      const socket = socketMap.get(connectionId);
      if (!socket) return;
      if (event.data.type === "SEND") socket.send(event.data.data);
      if (event.data.type === "CLOSE") {
        socket.close(event.data.code, event.data.reason);
        socketMap.delete(connectionId);
        port.removeEventListener("message", listener);
      }
    };
    port.addEventListener("message", listener);
    port.start();
  } catch (error) {
    postSocketMessage(port, {
      type: "SOCKET_ERROR",
      connectionId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function configure(message) {
  const nextTransportType = message.transportType ?? currentTransportType;
  const nextWispUrl = message.wispUrl ?? currentWispUrl;
  const nextTransport = createProxyTransport({
    transport: nextTransportType,
    wispUrl: nextWispUrl,
  });
  await nextTransport.init();
  transport = nextTransport;
  currentTransportType = nextTransportType;
  currentWispUrl = nextWispUrl;
  self.postMessage({ type: "READY", requestId: message.requestId });
}

self.addEventListener("message", (event) => {
  const message = event.data;
  if (!message || typeof message !== "object") return;

  if (message.type === "INIT" || message.type === "SET_TRANSPORT") {
    controlQueue = controlQueue
      .then(() => configure(message))
      .catch((error) => {
        self.postMessage({
          type: "ERROR",
          requestId: message.requestId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    return;
  }
  if (message.type === "REQUEST" && message.port instanceof MessagePort) {
    void runRequest(message.port, message);
    return;
  }
  if (message.type === "CONNECT" && message.port instanceof MessagePort) {
    connectSocket(message.port, message);
  }
});
