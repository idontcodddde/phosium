import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { PhosiumIcon } from "@repo/os-shell";
import { aiWorkerManager } from "../../lib/AI/aiWorkerManager";
import { DEFAULT_AI_MODEL_URL } from "../../lib/AI/aiWorker";
import type { AiWorkerEvent } from "../../lib/AI/types";

interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
}

export function AiAssistantApp() {
    const snapshot = aiWorkerManager.getSnapshot();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [status, setStatus] = useState(snapshot.lastStatus);
    const [progress, setProgress] = useState<number | null>(null);
    const [isGenerating, setIsGenerating] = useState(Boolean(snapshot.activeRequestId));
    const activeRequestIdRef = useRef<string | null>(snapshot.activeRequestId);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const unsubscribe = aiWorkerManager.subscribe((event: AiWorkerEvent) => {
            if (event.type === "status") {
                setStatus(event.status);
            } else if (event.type === "progress") {
                setProgress(event.progress);
                setStatus(`Downloading model... ${event.progress}%`);
            } else if (event.type === "ready") {
                setProgress(null);
                setStatus("Model ready (local WASM)");
            } else if (event.type === "token") {
                if (activeRequestIdRef.current && event.requestId !== activeRequestIdRef.current) return;
                setMessages((prev) => {
                    const last = prev[prev.length - 1];
                    if (!last || last.role !== "assistant") return prev;
                    return [...prev.slice(0, -1), { ...last, content: event.text }];
                });
            } else if (event.type === "done") {
                if (!activeRequestIdRef.current || event.requestId === activeRequestIdRef.current) {
                    activeRequestIdRef.current = null;
                    setIsGenerating(false);
                    setStatus("Ready (local WASM)");
                }
            } else if (event.type === "error") {
                if (!event.requestId || !activeRequestIdRef.current || event.requestId === activeRequestIdRef.current) {
                    activeRequestIdRef.current = null;
                    setIsGenerating(false);
                    setProgress(null);
                    setStatus(`Error: ${event.error}`);
                }
            }
        });

        return () => {
            unsubscribe();
            aiWorkerManager.abort();
        };
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleLoadModel = () => {
        setStatus("Starting model download...");
        aiWorkerManager.initModel(DEFAULT_AI_MODEL_URL);
    };

    const handleStop = () => {
        aiWorkerManager.abort(activeRequestIdRef.current ?? undefined);
        activeRequestIdRef.current = null;
        setIsGenerating(false);
        setStatus("Generation stopped");
    };

    const handleSubmit = (event: FormEvent) => {
        event.preventDefault();
        const prompt = input.trim();
        if (!prompt || isGenerating) return;

        const assistantId = `msg-${Date.now() + 1}`;
        setMessages((prev) => [
            ...prev,
            { id: `msg-${Date.now()}`, role: "user", content: prompt },
            { id: assistantId, role: "assistant", content: "" },
        ]);
        setInput("");
        setIsGenerating(true);
        setStatus("Preparing WASM inference...");

        const requestId = aiWorkerManager.generateChat({
            prompt,
            systemPrompt: "You are a concise, helpful assistant running inside the Phosium Web OS.",
            modelUrl: DEFAULT_AI_MODEL_URL,
        });
        activeRequestIdRef.current = requestId;
    };

    return (
        <div className="phosium-ai-app">
            <div className="phosium-ai-toolbar">
                <span><PhosiumIcon name="sparkles" size={14} /> {status}</span>
                <div>
                    {!isGenerating ? (
                        <button onClick={handleLoadModel} type="button">Load Model</button>
                    ) : (
                        <button onClick={handleStop} type="button">Stop</button>
                    )}
                </div>
            </div>

            {progress !== null && (
                <div className="phosium-ai-progress">
                    <div style={{ width: `${progress}%` }} />
                </div>
            )}

            <div className="phosium-ai-messages">
                {messages.map((m) => (
                    <div className={`phosium-ai-msg is-${m.role}`} key={m.id}>
                        <strong>{m.role === "user" ? "You" : "AI"}</strong>
                        <p>{m.content || "..."}</p>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <form className="phosium-ai-form" onSubmit={handleSubmit}>
                <input
                    disabled={isGenerating}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask something locally..."
                    value={input}
                />
                <button disabled={isGenerating || !input.trim()} type="submit">
                    <PhosiumIcon name="corner-down-left" size={14} />
                </button>
            </form>
        </div>
    );
}