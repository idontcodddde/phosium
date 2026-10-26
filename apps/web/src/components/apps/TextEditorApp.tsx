import { useState, useEffect } from 'react';
import { vfsManager } from '@repo/vfs';

interface TextEditorAppProps {
    initialPath?: string;
}

export function TextEditorApp({ initialPath = 'untitled.txt' }: TextEditorAppProps) {
    const [fileName, setFileName] = useState(initialPath);
    const [content, setContent] = useState('');
    const [status, setStatus] = useState('');

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            const path = fileName.startsWith('/') ? fileName : `/${fileName}`;
            const savedContent = await vfsManager.readFile(path);
            if (!cancelled && savedContent !== null) {
                setContent(savedContent);
            }
        };
        void load();
        return () => { cancelled = true; };
    }, [fileName]);

    const handleSave = async () => {
        try {
            const path = fileName.startsWith('/') ? fileName : `/${fileName}`;
            await vfsManager.writeFile(path, content);
            setStatus(`Saved to ${path}`);
            setTimeout(() => setStatus(''), 3000);
        } catch (err) {
            setStatus('Failed to save file to VFS');
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
            padding: '16px',
            gap: '12px',
            background: 'var(--surface, #20212d)',
            color: 'var(--text-primary, #f5f5fa)',
            boxSizing: 'border-box',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '0 0 auto' }}>
                <input
                    type="text"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    placeholder="file-name.txt"
                    style={{
                        flex: 1,
                        minWidth: '0',
                        height: '36px',
                        padding: '0 12px',
                        color: 'var(--text-primary, #f5f5fa)',
                        background: 'var(--surface-raised, #282a38)',
                        border: '1px solid var(--border, rgb(255 255 255 / 9%))',
                        borderRadius: '8px',
                        fontSize: '12px',
                        outline: 'none',
                    }}
                />
                <button
                    onClick={handleSave}
                    type="button"
                    style={{
                        flex: '0 0 auto',
                        height: '36px',
                        padding: '0 18px',
                        color: '#ffffff',
                        background: 'var(--accent-strong, #7e6cf0)',
                        border: 0,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 650,
                    }}
                >
                    Save
                </button>
            </div>

            {status && (
                <div style={{ padding: '0 2px', color: '#5dd09a', fontFamily: 'monospace', fontSize: '11px' }}>
                    {status}
                </div>
            )}

            <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Start typing your document here..."
                style={{
                    flex: 1,
                    width: '100%',
                    minHeight: 0,
                    padding: '14px',
                    color: 'var(--text-primary, #f5f5fa)',
                    background: 'var(--surface-raised, #282a38)',
                    border: '1px solid var(--border, rgb(255 255 255 / 9%))',
                    borderRadius: '10px',
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    lineHeight: '1.6',
                    resize: 'none',
                    outline: 'none',
                    boxSizing: 'border-box',
                }}
            />
        </div>
    );
}