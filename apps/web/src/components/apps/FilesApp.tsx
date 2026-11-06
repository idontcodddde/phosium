import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, MouseEvent } from 'react';
import { vfsManager } from '@repo/vfs';
import type { WindowState } from '@repo/os-shell';
import { PhosiumIcon } from '@repo/os-shell';
import type { PhosiumIconName } from '@repo/os-shell';
import { TextEditorApp } from './TextEditorApp';

type VFSNode = Awaited<ReturnType<typeof vfsManager.listNodes>>[number];
type ViewMode = 'grid' | 'list';

const quickAccessFolders = ['Desktop', 'Documents', 'Images', 'Videos', 'Music'];
let editorInstanceId = 0;

function nodeName(path: string): string {
    return path.split('/').filter(Boolean).at(-1) ?? 'Home';
}

function nodeIcon(node: VFSNode): PhosiumIconName {
    if (node.type === 'directory') return 'folder';
    const extension = nodeName(node.path).split('.').at(-1)?.toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension ?? '')) return 'file-image';
    if (['mp3', 'wav', 'ogg', 'm4a'].includes(extension ?? '')) return 'file-audio';
    if (['mp4', 'mov', 'webm'].includes(extension ?? '')) return 'video';
    if (['json', 'js', 'ts', 'tsx', 'css', 'html'].includes(extension ?? '')) return 'file-code-2';
    return 'file';
}

export function FilesApp() {
    const [currentPath, setCurrentPath] = useState('/');
    const [nodes, setNodes] = useState<VFSNode[]>([]);
    const [status, setStatus] = useState('');
    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);
    const [isCreatingFile, setIsCreatingFile] = useState(false);
    const [isNewMenuOpen, setIsNewMenuOpen] = useState(false);
    const [openFileMenuPath, setOpenFileMenuPath] = useState<string | null>(null);
    const [newFolderName, setNewFolderName] = useState('');
    const [newFileName, setNewFileName] = useState('');

    const loadNodes = async () => {
        try {
            const list = await vfsManager.listNodes();
            setNodes(list);
            setStatus('');
        } catch (error) {
            console.error('Unable to load VFS nodes:', error);
            setStatus('Could not load files. Try refreshing.');
        }
    };

    useEffect(() => {
        let cancelled = false;
        void vfsManager.listNodes().then((list) => {
            if (!cancelled) setNodes(list);
        }).catch((error: unknown) => {
            console.error('Unable to load VFS nodes:', error);
            if (!cancelled) setStatus('Could not load files. Try refreshing.');
        });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const closeMenus = (event: PointerEvent) => {
            if (!(event.target instanceof Element)) return;
            if (!event.target.closest('.phosium-files-new-actions')) setIsNewMenuOpen(false);
            if (!event.target.closest('.phosium-file-actions')) setOpenFileMenuPath(null);
        };
        const closeMenusOnEscape = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            setIsNewMenuOpen(false);
            setOpenFileMenuPath(null);
        };
        document.addEventListener('pointerdown', closeMenus);
        document.addEventListener('keydown', closeMenusOnEscape);
        return () => {
            document.removeEventListener('pointerdown', closeMenus);
            document.removeEventListener('keydown', closeMenusOnEscape);
        };
    }, []);

    const currentNodes = useMemo(() => {
        const normalizedParent = currentPath === '/' ? '/' : `${currentPath.replace(/\/+$/, '')}/`;
        const query = search.trim().toLocaleLowerCase();
        return nodes
            .filter((node) => {
                if (node.path === currentPath || !node.path.startsWith(normalizedParent)) return false;
                const relative = node.path.slice(normalizedParent.length);
                return !relative.includes('/') && (!query || nodeName(node.path).toLocaleLowerCase().includes(query));
            })
            .sort((left, right) => {
                if (left.type !== right.type) return left.type === 'directory' ? -1 : 1;
                return nodeName(left.path).localeCompare(nodeName(right.path));
            });
    }, [currentPath, nodes, search]);

    const availableQuickFolders = useMemo(() => quickAccessFolders.flatMap((name) => {
        const match = nodes.find((node) => node.type === 'directory' && node.path.toLowerCase() === `/${name.toLowerCase()}`);
        return match ? [{ name, path: match.path }] : [];
    }), [nodes]);

    const handleOpenNode = (node: VFSNode) => {
        if (node.type === 'directory') {
            setCurrentPath(node.path);
            setSearch('');
            return;
        }
        const instance = ++editorInstanceId;
        const name = nodeName(node.path);
        window.dispatchEvent(new CustomEvent('phosium:open-window', {
            detail: {
                id: `text-editor-${instance}`,
                title: `Edit: ${name}`,
                icon: <PhosiumIcon name="file-text" />,
                description: `Editing ${node.path}`,
                isOpen: true,
                isMinimized: false,
                isMaximized: false,
                zIndex: 25 + instance,
                position: { x: 120 + instance * 24, y: 80 + instance * 24 },
                component: <TextEditorApp initialPath={node.path} />,
            } satisfies WindowState,
        }));
    };

    const handleCreateFolder = async (event: FormEvent) => {
        event.preventDefault();
        const name = newFolderName.trim();
        if (!name || name.includes('/') || name === '.' || name === '..') {
            setStatus('Enter a folder name without slashes.');
            return;
        }
        try {
            const path = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
            await vfsManager.createDirectory(path);
            setNewFolderName('');
            setIsCreatingFolder(false);
            setStatus('');
            await loadNodes();
        } catch (error) {
            console.error('Unable to create folder:', error);
            setStatus('Could not create that folder.');
        }
    };

    const handleCreateFile = async (event: FormEvent) => {
        event.preventDefault();
        const name = newFileName.trim();
        if (!name || name.includes('/') || name === '.' || name === '..') {
            setStatus('Enter a file name without slashes.');
            return;
        }
        const path = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
        if (nodes.some((node) => node.path.toLowerCase() === path.toLowerCase())) {
            setStatus('An item with that name already exists.');
            return;
        }
        try {
            await vfsManager.writeFile(path, '');
            setNewFileName('');
            setIsCreatingFile(false);
            setStatus('');
            await loadNodes();
            handleOpenNode({ path, type: 'file', updatedAt: Date.now() });
        } catch (error) {
            console.error('Unable to create file:', error);
            setStatus('Could not create that file.');
        }
    };

    const handleDelete = async (path: string, event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        try {
            await vfsManager.deleteFile(path);
            setOpenFileMenuPath(null);
            await loadNodes();
        } catch (error) {
            console.error(`Unable to delete ${path}:`, error);
            setStatus('Could not delete that item.');
        }
    };

    const navigateTo = (path: string) => {
        setCurrentPath(path || '/');
        setSearch('');
    };

    const breadcrumbPaths = currentPath.split('/').filter(Boolean).map((part, index, parts) => ({
        name: part,
        path: `/${parts.slice(0, index + 1).join('/')}`,
    }));

    return (
        <main className="phosium-files">
            <header className="phosium-files-toolbar">
                <div className="phosium-files-nav">
                    <button type="button" onClick={() => navigateTo('/')} aria-label="Go home" title="Home"><PhosiumIcon name="home" /></button>
                    <button
                        type="button"
                        onClick={() => {
                            const parts = currentPath.split('/').filter(Boolean);
                            parts.pop();
                            navigateTo(parts.length ? `/${parts.join('/')}` : '/');
                        }}
                        disabled={currentPath === '/'}
                        aria-label="Go up"
                        title="Go up"
                    ><PhosiumIcon name="arrow-up" /></button>
                    <button type="button" onClick={() => void loadNodes()} aria-label="Refresh" title="Refresh"><PhosiumIcon name="rotate-cw" /></button>
                </div>
                <nav className="phosium-files-breadcrumbs" aria-label="Current folder">
                    <button type="button" onClick={() => navigateTo('/')}>Home</button>
                    {breadcrumbPaths.map((crumb) => (
                        <span className="phosium-files-crumb" key={crumb.path}>
                            <PhosiumIcon name="chevron-right" />
                            <button type="button" onClick={() => navigateTo(crumb.path)}>{crumb.name}</button>
                        </span>
                    ))}
                </nav>
                <label className="phosium-files-search">
                    <PhosiumIcon name="search" />
                    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${nodeName(currentPath)}`} />
                </label>
                <div className="phosium-files-view-toggle" aria-label="File view">
                    <button type="button" className={viewMode === 'grid' ? 'is-selected' : ''} onClick={() => setViewMode('grid')} aria-label="Grid view" title="Grid view"><PhosiumIcon name="grid-2x2" /></button>
                    <button type="button" className={viewMode === 'list' ? 'is-selected' : ''} onClick={() => setViewMode('list')} aria-label="List view" title="List view"><PhosiumIcon name="list" /></button>
                </div>
                <div className="phosium-files-new-actions">
                    <button
                        aria-expanded={isNewMenuOpen}
                        aria-haspopup="menu"
                        className="phosium-files-new-folder"
                        onClick={() => setIsNewMenuOpen((open) => !open)}
                        type="button"
                    ><PhosiumIcon name="plus" /> New</button>
                    {isNewMenuOpen && (
                        <div className="phosium-files-action-menu phosium-files-new-menu" role="menu">
                            <button role="menuitem" type="button" onClick={() => {
                                setIsCreatingFile(true);
                                setIsCreatingFolder(false);
                                setIsNewMenuOpen(false);
                            }}><PhosiumIcon name="file" /> New file</button>
                            <button role="menuitem" type="button" onClick={() => {
                                setIsCreatingFolder(true);
                                setIsCreatingFile(false);
                                setIsNewMenuOpen(false);
                            }}><PhosiumIcon name="folder-plus" /> New folder</button>
                        </div>
                    )}
                </div>
            </header>

            {(isCreatingFolder || isCreatingFile) && (
                <form
                    className="phosium-files-create"
                    onSubmit={(event) => void (isCreatingFile ? handleCreateFile(event) : handleCreateFolder(event))}
                >
                    <input
                        autoFocus
                        value={isCreatingFile ? newFileName : newFolderName}
                        onChange={(event) => isCreatingFile
                            ? setNewFileName(event.target.value)
                            : setNewFolderName(event.target.value)}
                        placeholder={isCreatingFile ? 'New file name' : 'New folder name'}
                        aria-label={isCreatingFile ? 'New file name' : 'New folder name'}
                    />
                    <button type="submit">Create</button>
                    <button type="button" className="secondary" onClick={() => {
                        setIsCreatingFolder(false);
                        setIsCreatingFile(false);
                        setNewFolderName('');
                        setNewFileName('');
                    }}>Cancel</button>
                </form>
            )}

            <div className="phosium-files-content">
                <aside className="phosium-files-sidebar">
                    <h3>Quick access</h3>
                    <button type="button" className={currentPath === '/' ? 'is-selected' : ''} onClick={() => navigateTo('/')}>
                        <PhosiumIcon name="home" /> Home
                    </button>
                    {availableQuickFolders.map((folder) => (
                        <button
                            type="button"
                            className={currentPath === folder.path ? 'is-selected' : ''}
                            key={folder.path}
                            onClick={() => navigateTo(folder.path)}
                        >
                            <PhosiumIcon name={folder.name === 'Images' ? 'image' : folder.name === 'Music' ? 'music' : 'folder'} />
                            {folder.name}
                        </button>
                    ))}
                    <h3 className="phosium-files-sidebar-heading">File system</h3>
                    <button type="button" className={currentPath === '/' ? 'is-selected' : ''} onClick={() => navigateTo('/')}>
                        <PhosiumIcon name="hard-drive" /> All files
                    </button>
                </aside>

                <section className="phosium-files-main" aria-label={`${nodeName(currentPath)} contents`}>
                    <div className="phosium-files-section-title">
                        <div>
                            <h2>{nodeName(currentPath)}</h2>
                            <span>{currentNodes.length} {currentNodes.length === 1 ? 'item' : 'items'}</span>
                        </div>
                    </div>
                    {status && <div className="phosium-files-status" role="status">{status}</div>}
                    {currentNodes.length === 0 ? (
                        <div className="phosium-files-empty">
                            <PhosiumIcon name="folder-open" />
                            <strong>{search ? 'No matching items' : 'This folder is empty'}</strong>
                            <small>{search ? 'Try another search.' : 'Create a folder or add files from another app.'}</small>
                        </div>
                    ) : (
                        <div className={`phosium-files-items${viewMode === 'list' ? ' is-list' : ''}`}>
                            {currentNodes.map((node) => (
                                <article
                                    className={`phosium-file-item${viewMode === 'list' ? ' is-list' : ''}`}
                                    key={node.path}
                                >
                                    <button className="phosium-file-open" type="button" onClick={() => handleOpenNode(node)}>
                                        <span className={`phosium-file-icon${node.type === 'directory' ? ' is-folder' : ''}`} aria-hidden="true"><PhosiumIcon name={nodeIcon(node)} /></span>
                                        <span className="phosium-file-name">{nodeName(node.path)}</span>
                                        {viewMode === 'list' && <span className="phosium-file-type">{node.type === 'directory' ? 'Folder' : 'File'}</span>}
                                    </button>
                                    <div className="phosium-file-actions">
                                        <button
                                            aria-expanded={openFileMenuPath === node.path}
                                            aria-haspopup="menu"
                                            aria-label={`Options for ${nodeName(node.path)}`}
                                            className="phosium-file-delete"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                setOpenFileMenuPath((path) => path === node.path ? null : node.path);
                                            }}
                                            title="Options"
                                            type="button"
                                        ><PhosiumIcon name="ellipsis" /></button>
                                        {openFileMenuPath === node.path && (
                                            <div className="phosium-files-action-menu phosium-file-action-menu" role="menu">
                                                <button
                                                    aria-label={`Delete ${nodeName(node.path)}`}
                                                    className="is-danger"
                                                    onClick={(event) => void handleDelete(node.path, event)}
                                                    role="menuitem"
                                                    type="button"
                                                ><PhosiumIcon name="trash-2" /> Delete</button>
                                            </div>
                                        )}
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </section>
            </div>
            <footer className="phosium-files-statusbar"><span>{currentNodes.length} items</span><span>{currentPath}</span></footer>
        </main>
    );
}
