import { PHOSIUM_VERSION, PHOSPHOROUS_VERSION } from '../../constants/version';

export function AboutApp() {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            width: '100%',
            height: '100%',
            padding: '32px',
            background: 'var(--surface, #20212d)',
            color: 'var(--text-primary, #f5f5fa)',
            textAlign: 'center',
            userSelect: 'none',
            boxSizing: 'border-box',
        }}>
            {/* Logo & Subtitle */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '24px' }}>
                <h1 style={{
                    margin: 0,
                    fontSize: '36px',
                    fontWeight: 850,
                    letterSpacing: '0.15em',
                    background: 'linear-gradient(135deg, var(--accent, #a99bff), var(--accent-strong, #7e6cf0))',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                }}>
                    PHOSIUM
                </h1>
            </div>

            {/* Version Card */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                width: '100%',
                maxWidth: '260px',
                padding: '16px',
                background: 'var(--surface-raised, #282a38)',
                border: '1px solid var(--border, rgb(255 255 255 / 9%))',
                borderRadius: '12px',
                boxShadow: 'inset 0 1px 3px rgb(0 0 0 / 15%)',
                marginBottom: '20px',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-secondary, #aaaabb)' }}>Phosium OS:</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 650, color: 'var(--accent, #a99bff)' }}>{PHOSIUM_VERSION}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                    <span style={{ color: 'var(--text-secondary, #aaaabb)' }}>Phosphorous:</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 650, color: 'var(--accent, #a99bff)' }}>{PHOSPHOROUS_VERSION}</span>
                </div>
            </div>

            {/* Footer Details */}
            <div style={{ color: 'var(--text-muted, #77798c)', fontSize: '10px', lineHeight: '1.5' }}>
                <p style={{ margin: '4px 0 0' }}>© {new Date().getFullYear()} Phosium Project. All rights reserved.</p>
            </div>
        </div>
    );
}