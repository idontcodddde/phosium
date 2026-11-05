import { useState } from 'react';
import {
    PHOSIUM_VERSION,
    PHOSPHOROUS_VERSION,
    RH_VERSION,
    SCRAMJET_VERSION,
    UV_VERSION,
    WISP_VERSION,
    BARE_MUX_VERSION
} from '../../constants/version';

export function AboutApp() {
    const [activeTab, setActiveTab] = useState('versions');

    const tabStyle = (id: string) => ({
        padding: '10px 14px',
        fontSize: '13px',
        fontWeight: activeTab === id ? 650 : 500,
        color: activeTab === id ? 'var(--accent, #a99bff)' : 'var(--text-secondary, #aaaabb)',
        background: activeTab === id ? 'var(--surface-raised, #282a38)' : 'transparent',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        textAlign: 'left' as const,
        width: '100%',
        transition: 'all 0.2s ease',
    });

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
            background: 'var(--surface, #20212d)',
            color: 'var(--text-primary, #f5f5fa)',
            userSelect: 'none',
            boxSizing: 'border-box',
        }}>
            {/* Header */}
            <div style={{
                padding: '24px 32px 16px',
                borderBottom: '1px solid var(--border, rgb(255 255 255 / 5%))'
            }}>
                <h1 style={{
                    margin: 0,
                    fontSize: '28px',
                    fontWeight: 850,
                    letterSpacing: '0.12em',
                    background: 'linear-gradient(135deg, var(--accent, #a99bff), var(--accent-strong, #7e6cf0))',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                }}>
                    PHOSIUM
                </h1>
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: 'var(--text-muted, #77798c)', letterSpacing: '0.05em' }}>
                    EXPERIMENTAL BROWSER ENVIRONMENT
                </p>
            </div>

            {/* Main Layout Block */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Sidebar Navigation */}
                <div style={{
                    width: '180px',
                    padding: '16px 12px',
                    borderRight: '1px solid var(--border, rgb(255 255 255 / 5%))',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                }}>
                    <button style={tabStyle('versions')} onClick={() => setActiveTab('versions')}>
                        Versions
                    </button>
                    <button style={tabStyle('credits')} onClick={() => setActiveTab('credits')}>
                        Credits
                    </button>
                    <button style={tabStyle('usage')} onClick={() => setActiveTab('usage')}>
                        How to Use
                    </button>
                </div>

                {/* Content Frame */}
                <div style={{ flex: 1, padding: '24px 32px', overflowY: 'auto', textAlign: 'left' }}>
                    {activeTab === 'versions' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '320px' }}>
                            <h3 style={{ margin: '0 0 8px', fontSize: '14px', color: 'var(--text-secondary, #aaaabb)' }}>
                                System Core Components
                            </h3>
                            {[
                                { name: 'Phosium OS', version: PHOSIUM_VERSION },
                                { name: 'Phosphorous', version: PHOSPHOROUS_VERSION },
                                { name: 'Scramjet', version: SCRAMJET_VERSION },
                                { name: 'Ultraviolet', version: UV_VERSION },
                                { name: 'Rammerhead', version: RH_VERSION },
                                { name: 'wisp-js', version: WISP_VERSION },
                                { name: 'Bare Mux', version: BARE_MUX_VERSION },
                            ].map((item) => (
                                <div key={item.name} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    fontSize: '13px',
                                    padding: '8px 12px',
                                    background: 'var(--surface-raised, #282a38)',
                                    border: '1px solid var(--border, rgb(255 255 255 / 6%))',
                                    borderRadius: '8px'
                                }}>
                                    <span style={{ color: 'var(--text-primary, #f5f5fa)' }}>{item.name}</span>
                                    <span style={{ fontFamily: 'monospace', fontWeight: 650, color: 'var(--accent, #a99bff)' }}>
                                        {item.version}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'credits' && (
                        <div style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--text-secondary, #aaaabb)' }}>
                            <p style={{ margin: '0 0 16px' }}>
                                Developed and conceptualized under active engineering pipelines.
                            </p>
                            <div style={{
                                padding: '16px',
                                background: 'var(--surface-raised, #282a38)',
                                borderRadius: '8px',
                                border: '1px solid var(--border, rgb(255 255 255 / 6%))',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '8px'
                            }}>
                                <div>
                                    Lead Developer:{' '}
                                    <a href="https://github.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent, #a99bff)', textDecoration: 'none' }}>
                                        idontcodddde
                                    </a>
                                </div>
                                <div>
                                    Repository Source:{' '}
                                    <a href="https://github.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent, #a99bff)', textDecoration: 'none' }}>
                                        GitHub Repo
                                    </a>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'usage' && (
                        <div style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--text-secondary, #aaaabb)' }}>
                            <h3 style={{ margin: '0 0 12px', fontSize: '14px', color: 'var(--text-primary, #f5f5fa)' }}>
                                Quick Start Instructions
                            </h3>
                            <ul style={{ paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <li>Launch multi-window applications from the primary taskbar desktop ecosystem.</li>
                                <li>Use the integrated web proxy engine browser tabs to toggle backend network profiles safely.</li>
                                <li>Configure transport modes using standard Wisp routing arrays directly inside system configurations.</li>
                                <li>Toggle ad filtering extensions securely via the automated Phosphorous module controller.</li>
                                <li>Press alt+j to fullscreen any app.</li>
                            </ul>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer Bottom Block */}
            <div style={{
                padding: '12px 32px',
                borderTop: '1px solid var(--border, rgb(255 255 255 / 5%))',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '10px',
                color: 'var(--text-muted, #77798c)'
            }}>
                <span>© {new Date().getFullYear()} Phosium Project. All rights reserved.</span>
                <span>Alpha Build Phase</span>
            </div>
        </div>
    );
}