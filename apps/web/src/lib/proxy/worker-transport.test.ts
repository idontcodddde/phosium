import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WorkerTransport } from "./worker-transport.ts";
import type {
  ConnectWorkerMessage,
  RequestPortCommand,
  TransportWorkerMessage,
  WorkerControlResponse,
} from "./transport-protocol";
import { isRequestPortCommand } from "./transport-protocol";

class FakeWorker extends EventTarget {
  readonly messages: TransportWorkerMessage[] = [];
  readonly socketMessages: RequestPortCommand[] = [];
  onSocketMessage?: (message: RequestPortCommand) => void;

  postMessage(message: TransportWorkerMessage) {
    this.messages.push(message);
    if (message.type === "INIT" || message.type === "SET_TRANSPORT") {
      queueMicrotask(() => {
        const response: WorkerControlResponse = {
          type: "READY",
          requestId: message.requestId,
        };
        this.dispatchEvent(new MessageEvent<WorkerControlResponse>("message", {
          data: response,
        }));
      });
    } else if (message.type === "REQUEST") {
      message.port?.postMessage({
        type: "RESULT",
        requestId: message.requestId,
        ok: true,
        res: {
          status: 200,
          statusText: "OK",
          headers: [["content-type", "text/plain"]],
          body: new Uint8Array([111, 107]).buffer,
        },
      });
    } else if (message.type === "CONNECT" && message.port) {
      const port = message.port;
      port.onmessage = (event) => {
        if (!isRequestPortCommand(event.data)) return;
        const socketMessage = event.data;
        this.socketMessages.push(socketMessage);
        this.onSocketMessage?.(socketMessage);
        if (socketMessage.type === "CLOSE") {
          port.postMessage({
            type: "SOCKET_CLOSE",
            connectionId: socketMessage.connectionId,
            code: socketMessage.code,
            reason: socketMessage.reason,
          });
        }
      };
      port.start();
      port.postMessage({
        type: "SOCKET_OPEN",
        connectionId: "direct",
        protocol: "test",
        extensions: "",
      });
    }
  }
}

const workers: FakeWorker[] = [];

describe("WorkerTransport", () => {
  beforeEach(() => {
    workers.length = 0;
    vi.stubGlobal("Worker", class extends FakeWorker {
      constructor() {
        super();
        workers.push(this);
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("initializes once and hot-swaps transport settings", async () => {
    const transport = new WorkerTransport("epoxy", "wss://local.example/wisp/");

    await transport.init();
    await transport.init();
    await transport.setTransport("libcurl", "wss://edge.example/wisp/");

    expect(transport.ready).toBe(true);
    expect(workers).toHaveLength(1);
    expect(workers[0].messages.map(({ type }) => type))
      .toEqual(["INIT", "SET_TRANSPORT"]);
    expect(workers[0].messages[1]).toMatchObject({
      transportType: "libcurl",
      wispUrl: "wss://edge.example/wisp/",
    });
  });

  it("forwards HTTP requests over a fresh message port", async () => {
    const transport = new WorkerTransport("epoxy", "wss://local.example/wisp/");

    const response = await transport.request(
      new URL("https://target.example/path"),
      "GET",
      null,
      [["accept", "text/html"]],
      undefined,
    );

    expect(workers[0].messages.find(({ type }) => type === "REQUEST")).toMatchObject({
      remote: "https://target.example/path",
      method: "GET",
      headers: [["accept", "text/html"]],
    });
    expect(response.status).toBe(200);
    expect(response.headers).toEqual([["content-type", "text/plain"]]);
    expect(response.body).toBeInstanceOf(ArrayBuffer);
  });

  it("does not submit requests whose abort signal is already cancelled", async () => {
    const transport = new WorkerTransport("epoxy", "wss://local.example/wisp/");
    const abortController = new AbortController();
    abortController.abort(new DOMException("Cancelled", "AbortError"));

    await expect(transport.request(
      new URL("https://target.example/"),
      "GET",
      null,
      [],
      abortController.signal,
    )).rejects.toMatchObject({ name: "AbortError" });
    expect(workers[0].messages.some(({ type }) => type === "REQUEST")).toBe(false);
  });

  it("forwards WebSocket open, send, and close events", async () => {
    const transport = new WorkerTransport("epoxy", "wss://local.example/wisp/");
    let resolveOpen!: (protocol: string) => void;
    let resolveClose!: (closed: [number, string]) => void;
    const opened = new Promise<string>((resolve) => { resolveOpen = resolve; });
    const closed = new Promise<[number, string]>((resolve) => { resolveClose = resolve; });
    const [send, close] = transport.connect(
      new URL("wss://target.example/socket"),
      ["test"],
      [],
      (protocol) => resolveOpen(protocol),
      () => {},
      (code, reason) => resolveClose([code, reason]),
      (error) => { throw new Error(error); },
    );
    await expect(opened).resolves.toBe("test");
    const worker = workers[0];
    if (!worker) throw new Error("The proxy worker was not created.");
    const socket = worker.messages.find(
      (message): message is ConnectWorkerMessage => message.type === "CONNECT",
    );
    const sent = new Promise<unknown>((resolve) => {
      worker.onSocketMessage = resolve;
    });
    send("hello");
    await expect(sent).resolves.toEqual({ type: "SEND", connectionId: "direct", data: "hello" });
    close(1000, "done");
    await expect(closed).resolves.toEqual([1000, "done"]);
    expect(socket?.url).toBe("wss://target.example/socket");
  });
});
