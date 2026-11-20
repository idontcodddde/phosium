import type { AiEventListener, AiWorkerCommand, AiWorkerEvent } from "./types";

export interface GenerateChatParams {
    prompt: string;
    systemPrompt?: string;
    modelUrl?: string;
}

export class AiWorkerManager {
    private worker: Worker | null = null;
    private listeners = new Set<AiEventListener>();
    private activeRequestId: string | null = null;
    private isModelReady = false;
    private lastStatus = "Idle (local WASM)";

    public subscribe(listener: AiEventListener): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    public getSnapshot() {
        return {
            isModelReady: this.isModelReady,
            activeRequestId: this.activeRequestId,
            lastStatus: this.lastStatus,
        };
    }

    private emit(event: AiWorkerEvent) {
        if (event.type === "status") {
            this.lastStatus = event.status;
        } else if (event.type === "ready") {
            this.isModelReady = true;
            this.lastStatus = "Model ready (local WASM)";
        } else if (event.type === "error") {
            this.isModelReady = false;
            this.lastStatus = `Error: ${event.error}`;
        }

        for (const listener of this.listeners) {
            listener(event);
        }
    }

    private postCommand(command: AiWorkerCommand): Worker {
        const worker = this.ensureWorker();
        worker.postMessage(command);
        return worker;
    }

    private ensureWorker(): Worker {
        if (this.worker) return this.worker;

        const worker = new Worker(new URL("./aiWorker.ts", import.meta.url), {
            type: "module",
        });

        worker.onmessage = (event: MessageEvent<AiWorkerEvent>) => {
            const data = event.data;
            if (!data || typeof data !== "object") return;

            if (
                (data.type === "token" || data.type === "done") &&
                this.activeRequestId &&
                data.requestId !== this.activeRequestId
            ) {
                return;
            }

            if (data.type === "done" || data.type === "error") {
                this.activeRequestId = null;
            }

            this.emit(data);
        };

        worker.onerror = (event) => {
            this.activeRequestId = null;
            this.isModelReady = false;
            this.emit({
                type: "error",
                error: event.message ||
                    "AI Web Worker encountered an unexpected error.",
            });
        };

        this.worker = worker;
        return worker;
    }

    public initModel(modelUrl: string): void {
        this.postCommand({ type: "init", modelUrl });
    }

    public generateChat(params: GenerateChatParams): string {
        if (this.activeRequestId) {
            this.abort(this.activeRequestId);
        }

        const requestId = `ai-req-${Date.now()}-${
            Math.random().toString(36).slice(2, 8)
        }`;
        this.activeRequestId = requestId;

        this.postCommand({
            type: "chat",
            requestId,
            prompt: params.prompt,
            systemPrompt: params.systemPrompt,
            modelUrl: params.modelUrl,
        });

        return requestId;
    }

    public abort(requestId?: string): void {
        if (!this.worker) return;
        const targetId = requestId ?? this.activeRequestId ?? undefined;
        this.worker.postMessage({ type: "abort", requestId: targetId });
        if (!requestId || requestId === this.activeRequestId) {
            this.activeRequestId = null;
        }
    }

    public resetModel(): void {
        this.isModelReady = false;
        this.activeRequestId = null;
        if (!this.worker) return;
        this.worker.postMessage({ type: "reset" });
    }

    public dispose(): void {
        this.abort();
        this.isModelReady = false;
        this.activeRequestId = null;
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }
}

export const aiWorkerManager = new AiWorkerManager();
