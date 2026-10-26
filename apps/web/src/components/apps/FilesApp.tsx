import React, { useState, useEffect } from 'react';
import { vfsManager } from '@repo/vfs';
import { TextEditorApp } from './TextEditorApp';
import type { WindowState } from '@repo/os-shell';

let editorInstanceId = 0;

export function FilesApp() {
    const [files, setFiles] = useState<string[]>([]);
    const [status, setStatus] = useState<string>('');

    const loadFiles = async () => {
        try {
            const list = await vfsManager.listFiles();
            setFiles(list);
        } catch (err) {
            setStatus('Failed to load VFS files');
        }
    };

    useEffect(() => {
        void loadFiles();
    }, []);

    const handleOpenFile = (path: string) => {
        const instance = ++editorInstanceId;
        const cleanName = path.replace(/^\/+/, '');

        // Dispatch custom window open event to spawn a text editor instance for this file
        window.dispatchEvent(new CustomEvent("phosium:open-window", {
            detail: {
                id: `text-editor-${instance}`,
                title: `Edit: ${cleanName}`,
                icon: "📄",
                description: `Editing ${path}`,
                isOpen: true,
                isMinimized: false,
                isMaximized: false,
                zIndex: 25 + instance,
                position: { x: 120 + (instance * 24), y: 80 + (instance * 24) },
                component: <TextEditorApp initialPath={path} />,
            } satisfies WindowState,
        }));
    };

    const handleDelete = async (path: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await vfsManager.deleteFile(path);
            await loadFiles();
        } catch {
            setStatus('Failed to delete file');
        }
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            width: '100%',
            height: '100%',
            minHeight: 0,
            background: 'var(--surface, #20212d)',
            color: 'var(--text-primary, #f5f5fa)',
            boxSizing: 'border-box',
        }}>
            {/* Top action header */}
            <div style={{
                padding: '12px 16px',
                fontSize: '12px',
                fontWeight: 650,
                borderBottom: '1px solid var(--border, rgb(255 255 255 / 9%))',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--surface-raised, #282a38)',
            }}>
                <span>Virtual File Explorer (Click a file to edit)</span>
                <button
                    onClick={() => void loadFiles()}
                    type="button"
                    style={{
                        background: 'transparent',
                        border: 0,
                        color: 'var(--accent, #a99bff)',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 600,
                    }}
                >
                    Refresh
                </button>
            </div>

            {/* Main file list grid */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                {files.length === 0 ? (
                    <div style={{ padding: '36px', color: 'var(--text-muted, #77798c)', fontSize: '12px', textAlign: 'center' }}>
                        No files saved in VFS yet. Use the Text Editor app to create & save some!
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
                        {files.map((file) => (
                            <div
                                key={file}
                                onClick={() => handleOpenFile(file)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '12px 14px',
                                    borderRadius: '10px',
                                    cursor: 'pointer',
                                    background: 'var(--surface-raised, #282a38)',
                                    border: '1px solid var(--border, rgb(255 255 255 / 9%))',
                                    transition: 'all 0.15s ease',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                    <span style={{ fontSize: '16px' }}>📄</span>
                                    <span style={{ fontSize: '11px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {file}
                                    </span>
                                </div>
                                <button
                                    type="button"
                                    onClick={(e) => void handleDelete(file, e)}
                                    style={{
                                        background: 'transparent',
                                        border: 0,
                                        color: 'var(--text-muted)',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        padding: '4px 6px',
                                        borderRadius: '4px',
                                    }}
                                    title="Delete file"
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {status && <div style={{ padding: '12px', color: '#ff879a', fontSize: '11px' }}>{status}</div>}
        </div>
    );
}