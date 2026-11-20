import { LoggerWithoutDebug, Wllama } from "@wllama/wllama";
import WasmFromCDN from "@wllama/wllama/esm/wasm-from-cdn.js";
import type { AiWorkerCommand } from "./types";

export const DEFAULT_AI_MODEL_URL =
    "https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf";

let wllama: Wllama | null = null;
let loadedModelUrl: string | null = null;
let loadingPromise: Promise<Wllama> | null = null;
let abortController: AbortController | null = null;

async function resetWllamaInstance(): Promise<void> {
    if (wllama) {
        try {
            await wllama.exit();
        } catch {
            // Ignore teardown errors on partially initialized instances
        }
        wllama = null;
    }
    loadedModelUrl = null;
}

async function ensureModel(modelUrl: string): Promise<Wllama> {
    const normalizedUrl = modelUrl.trim() || DEFAULT_AI_MODEL_URL;

    if (wllama && loadedModelUrl === normalizedUrl && wllama.isModelLoaded()) {
        return wllama;
    }

    if (loadingPromise && loadedModelUrl === normalizedUrl) {
        return loadingPromise;
    }

    if (loadingPromise) {
        try {
            await loadingPromise;
        } catch {
            // Previous load failed; proceed with clean reset below
        }
    }

    loadedModelUrl = normalizedUrl;
    loadingPromise = (async () => {
        await resetWllamaInstance();
        loadedModelUrl = normalizedUrl;

        const recommendedThreads =
            typeof navigator !== "undefined" && navigator.hardwareConcurrency
                ? Math.max(1, Math.min(4, navigator.hardwareConcurrency))
                : 2;

        self.postMessage({
            type: "status",
            status: "Downloading & initializing WASM model...",
        });
        const instance = new Wllama(WasmFromCDN, {
            logger: LoggerWithoutDebug,
        });

        await instance.loadModelFromUrl(normalizedUrl, {
            n_ctx: 1024,
            n_threads: recommendedThreads,
            progressCallback: ({ loaded, total }) => {
                const progress = total > 0
                    ? Math.min(100, Math.round((loaded / total) * 100))
                    : 0;
                self.postMessage({ type: "progress", progress });
            },
        });

        wllama = instance;
        return instance;
    })();

    try {
        return await loadingPromise;
    } catch (error) {
        await resetWllamaInstance();
        throw error;
    } finally {
        loadingPromise = null;
    }
}

self.addEventListener(
    "message",
    async (event: MessageEvent<AiWorkerCommand>) => {
        const msg = event.data;

        try {
            if (msg.type === "init") {
                await ensureModel(msg.modelUrl);
                self.postMessage({ type: "ready" });
                return;
            }

            if (msg.type === "abort") {
                abortController?.abort();
                abortController = null;
                return;
            }

            if (msg.type === "reset") {
                abortController?.abort();
                abortController = null;
                await resetWllamaInstance();
                self.postMessage({ type: "status", status: "Model unloaded" });
                return;
            }

            if (msg.type === "chat") {
                abortController?.abort();
                abortController = new AbortController();
                const signal = abortController.signal;

                const instance = await ensureModel(
                    msg.modelUrl || DEFAULT_AI_MODEL_URL,
                );
                if (signal.aborted) {
                    self.postMessage({
                        type: "done",
                        requestId: msg.requestId,
                    });
                    return;
                }

                self.postMessage({
                    type: "status",
                    status: "Generating response...",
                });

                const messages = [
                    ...(msg.systemPrompt
                        ? [{
                            role: "system" as const,
                            content: msg.systemPrompt,
                        }]
                        : []),
                    { role: "user" as const, content: msg.prompt },
                ];

                const stream = await instance.createChatCompletion({
                    messages,
                    max_tokens: 128,
                    temperature: 0.3,
                    top_p: 0.9,
                    stream: true,
                    abortSignal: signal,
                });

                let fullText = "";
                let lastEmitTime = 0;

                for await (const chunk of stream) {
                    if (signal.aborted) break;
                    const delta = chunk.choices?.[0]?.delta?.content ?? "";
                    if (delta) {
                        fullText += delta;
                        const now = performance.now();
                        if (now - lastEmitTime >= 45) {
                            lastEmitTime = now;
                            self.postMessage({
                                type: "token",
                                requestId: msg.requestId,
                                text: fullText,
                            });
                        }
                    }
                }

                if (fullText) {
                    self.postMessage({
                        type: "token",
                        requestId: msg.requestId,
                        text: fullText,
                    });
                }
                self.postMessage({ type: "done", requestId: msg.requestId });
            }
        } catch (error) {
            const isAbort = (error as Error)?.name === "AbortError" ||
                abortController?.signal.aborted === true;

            if (isAbort) {
                if (msg.type === "chat") {
                    self.postMessage({
                        type: "done",
                        requestId: msg.requestId,
                    });
                }
                return;
            }

            self.postMessage({
                type: "error",
                requestId: msg.type === "chat" ? msg.requestId : undefined,
                error: error instanceof Error ? error.message : String(error),
            });
        } finally {
            if (msg.type === "chat") {
                abortController = null;
            }
        }
    },
);
