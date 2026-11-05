import { useWindowManager } from '@repo/os-shell';

export function TaskManagerApp() {
    const { windows, closeWindow } = useWindowManager();
    const tasks = windows.filter((task) => task.isOpen);

    return (
        <main className="task-manager">
            <header className="task-manager-heading">
                <div>
                    <h2>Task Manager</h2>
                    <p>Review and close apps running in this workspace.</p>
                </div>
                <span>{tasks.length} app{tasks.length === 1 ? '' : 's'} open</span>
            </header>

            <section className="task-manager-section" aria-label="System services">
                <h3>System services</h3>
                <div className="task-manager-row is-disabled">
                    <span className="task-manager-icon">◉</span>
                    <span className="task-manager-name"><strong>Phosium Service Worker</strong><small>Managed by the browser · cannot be stopped here</small></span>
                    <span className="task-manager-status">System</span>
                    <button type="button" disabled aria-label="Service worker cannot be stopped">Stop</button>
                </div>
                <div className="task-manager-row is-disabled">
                    <span className="task-manager-icon">⌘</span>
                    <span className="task-manager-name"><strong>Phosium Node.js Runtime</strong><small>Not available in this browser workspace</small></span>
                    <span className="task-manager-status">Unavailable</span>
                    <button type="button" disabled aria-label="Node.js runtime is unavailable">Stop</button>
                </div>
            </section>

            <section className="task-manager-section" aria-label="Open apps">
                <h3>Apps</h3>
                {tasks.length === 0
                    ? <div className="task-manager-empty">No apps are currently open.</div>
                    : tasks.map((task) => (
                        <div className="task-manager-row" key={task.id}>
                            <span className="task-manager-icon">▣</span>
                            <span className="task-manager-name">
                                <strong>{task.title}</strong>
                                <small>{task.isMinimized ? 'Minimized' : 'Running'}</small>
                            </span>
                            <span className="task-manager-status is-running">Running</span>
                            <button
                                type="button"
                                className="task-manager-kill"
                                onClick={() => closeWindow(task.id)}
                            >
                                End task
                            </button>
                        </div>
                    ))}
            </section>
        </main>
    );
}
