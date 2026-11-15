import {
  createProxyTransport,
  type ProxyTransport,
  type ProxyTransportType,
} from "@repo/proxy";
import type {
  ConfigureWorkerMessage,
  ConnectWorkerMessage,
  ProxyResponse,
  RawHeaders,
  RequestBody,
  RequestPortResponse,
  RequestWorkerMessage,
  SocketData,
  SocketWorkerEvent,
  TransportWorkerMessage,
} from "./transport-protocol";
import {
  isRequestPortCommand,
  isTransportWorkerMessage,
} from "./transport-protocol";

interface RequestContext {
  remote: URL;
  method: string;
  body: RequestBody;
  headers: RawHeaders;
  signal: AbortSignal;
}

type BeforeRequestHook = (
  context: RequestContext,
) => RequestContext | void | Promise<RequestContext | void>;
type AfterResponseHook = (
  response: ProxyResponse,
  context: RequestContext,
) => ProxyResponse | void | Promise<ProxyResponse | void>;
type SocketHandlers = ReturnType<ProxyTransport["connect"]>;

type TransportWorkerScope = typeof globalThis & {
  proxyTransportHooks?: {
    beforeRequest: BeforeRequestHook[];
    afterResponse: AfterResponseHook[];
  };
}

const workerScope: TransportWorkerScope = globalThis;
const beforeRequest: BeforeRequestHook[] = [];
const afterResponse: AfterResponseHook[] = [];
const activeRequests = new WeakMap<MessagePort, Map<string, AbortController>>();
const activeSockets = new WeakMap<MessagePort, Map<string, SocketHandlers>>();
let transport: ProxyTransport | null = null;
let activeTransportType: ProxyTransportType | null = null;
let controlQueue: Promise<void> = Promise.resolve();

workerScope.proxyTransportHooks = { beforeRequest, afterResponse };

function postSocketMessage(port: MessagePort, message: SocketWorkerEvent): void {
  if (message.type === "SOCKET_MESSAGE" && message.data instanceof ArrayBuffer) {
    const copy = message.data.slice(0);
    port.postMessage({ ...message, data: copy }, [copy]);
    return;
  }
  port.postMessage(message);
}

async function postResponse(
  port: MessagePort,
  message: Pick<RequestWorkerMessage, "requestId">,
  response: ProxyResponse,
): Promise<void> {
  const payload: RequestPortResponse = {
    type: "RESULT",
    requestId: message.requestId,
    ok: true,
    res: response,
  };
  const body = response.body;
  if (!(body instanceof ReadableStream) && !(body instanceof ArrayBuffer)) {
    port.postMessage(payload);
    return;
  }

  try {
    port.postMessage(payload, [body]);
  } catch (error) {
    let fallbackBody: ReadableStream<Uint8Array> | ArrayBuffer = body;
    if (body instanceof ReadableStream) {
      try {
        fallbackBody = await new Response(body).arrayBuffer();
      } catch (fallbackError) {
        const failure: RequestPortResponse = {
          type: "RESULT",
          requestId: message.requestId,
          ok: false,
          error: `Unable to transfer the proxy response body: ${String(fallbackError)}`,
        };
        port.postMessage(failure);
        return;
      }
    } else {
      fallbackBody = body.slice(0);
    }

    try {
      port.postMessage({
        ...payload,
        res: { ...response, body: fallbackBody },
      }, [fallbackBody]);
    } catch {
      try {
        port.postMessage({
          ...payload,
          res: { ...response, body: fallbackBody },
        });
      } catch (finalError) {
        const failure: RequestPortResponse = {
          type: "RESULT",
          requestId: message.requestId,
          ok: false,
          error: `Unable to send the proxy response: ${String(finalError ?? error)}`,
        };
        port.postMessage(failure);
      }
    }
  }
}

function postError(port: MessagePort, requestId: string, error: unknown): void {
  const message: RequestPortResponse = {
    type: "RESULT",
    requestId,
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  };
  port.postMessage(message);
}

function getTransport(): ProxyTransport {
  if (!transport) throw new Error("Proxy transport has not been initialized.");
  return transport;
}

async function runRequest(port: MessagePort, request: RequestWorkerMessage): Promise<void> {
  const controller = new AbortController();
  const requestMap = activeRequests.get(port) ?? new Map<string, AbortController>();
  activeRequests.set(port, requestMap);
  requestMap.set(request.requestId, controller);

  const listener = (event: MessageEvent<unknown>) => {
    if (!isRequestPortCommand(event.data)) return;
    if (event.data.type === "ABORT" && event.data.requestId === request.requestId) {
      controller.abort();
    }
  };
  port.addEventListener("message", listener);

  try {
    let context: RequestContext = {
      remote: new URL(request.remote),
      method: request.method,
      body: request.body ?? null,
      headers: request.headers,
      signal: controller.signal,
    };
    for (const hook of beforeRequest) {
      context = (await hook(context)) ?? context;
    }

    let response = await getTransport().request(
      context.remote,
      context.method,
      context.body,
      context.headers,
      context.signal,
    );
    for (const hook of afterResponse) {
      response = (await hook(response, context)) ?? response;
    }
    await postResponse(port, request, response);
  } catch (error) {
    if (!controller.signal.aborted) postError(port, request.requestId, error);
  } finally {
    port.removeEventListener("message", listener);
    requestMap.delete(request.requestId);
    port.close();
  }
}

function connectSocket(port: MessagePort, request: ConnectWorkerMessage): void {
  const connectionId = "direct";
  const socketMap = activeSockets.get(port) ?? new Map<string, SocketHandlers>();
  activeSockets.set(port, socketMap);

  try {
    const [send, close] = getTransport().connect(
      new URL(request.url),
      request.protocols,
      request.requestHeaders,
      (protocol, extensions) => postSocketMessage(port, {
        type: "SOCKET_OPEN",
        connectionId,
        protocol,
        extensions,
      }),
      (data: SocketData) => postSocketMessage(port, {
        type: "SOCKET_MESSAGE",
        connectionId,
        data,
      }),
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
    socketMap.set(connectionId, [send, close]);

    const listener = (event: MessageEvent<unknown>) => {
      if (!isRequestPortCommand(event.data)
        || event.data.type === "ABORT"
        || event.data.connectionId !== connectionId) return;
      const socket = socketMap.get(connectionId);
      if (!socket) return;
      if (event.data.type === "SEND") socket[0](event.data.data);
      if (event.data.type === "CLOSE") {
        socket[1](event.data.code, event.data.reason);
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

async function configure(message: ConfigureWorkerMessage): Promise<void> {
  const nextTransport = createProxyTransport({
    transport: message.transportType,
    wispUrl: message.wispUrl,
  });
  await nextTransport.init();
  transport = nextTransport;
  if (message.type === "SET_TRANSPORT") {
    if (activeTransportType && activeTransportType !== message.transportType) {
      console.info(
        `[Proxy worker] Transport switched from ${activeTransportType} to ${message.transportType}.`,
      );
    } else {
      console.info(`[Proxy worker] Transport reconfigured: ${message.transportType}.`);
    }
  } else {
    console.log(message)
  }
  activeTransportType = message.transportType;
  workerScope.postMessage({ type: "READY", requestId: message.requestId });
}

workerScope.addEventListener("message", (event: MessageEvent<unknown>) => {
  if (!isTransportWorkerMessage(event.data)) return;
  const message: TransportWorkerMessage = event.data;

  switch (message.type) {
    case "INIT":
    case "SET_TRANSPORT":
      controlQueue = controlQueue
        .then(() => configure(message))
        .catch((error: unknown) => {
          workerScope.postMessage({
            type: "ERROR",
            requestId: message.requestId,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      return;
    case "REQUEST":
      void runRequest(message.port, message);
      return;
    case "CONNECT":
      connectSocket(message.port, message);
      return;
  }
});
