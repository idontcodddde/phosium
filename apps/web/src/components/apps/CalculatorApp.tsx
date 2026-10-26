import { useState } from 'react';

export function CalculatorApp() {
    const [display, setDisplay] = useState('0');
    const [equation, setEquation] = useState('');

    const handlePress = (val: string) => {
        if (val === 'C') {
            setDisplay('0');
            setEquation('');
            return;
        }

        if (val === '=') {
            try {
                // Safe evaluation simulation for basic calculator logic
                // eslint-disable-next-line no-eval
                const result = eval(equation + display);
                setDisplay(String(result));
                setEquation('');
            } catch {
                setDisplay('Error');
                setEquation('');
            }
            return;
        }

        if (['+', '-', '*', '/'].includes(val)) {
            setEquation(equation + display + ' ' + val + ' ');
            setDisplay('0');
            return;
        }

        setDisplay((prev) => (prev === '0' ? val : prev + val));
    };

    const rows = [
        ['C', '(', ')', '/'],
        ['7', '8', '9', '*'],
        ['4', '5', '6', '-'],
        ['1', '2', '3', '+'],
        ['0', '.', '='],
    ];

    return (
        <div className="phosium-calculator">
            <div className="phosium-calc-container">
                {/* Screen */}
                <div className="phosium-calc-screen">
                    <div className="phosium-calc-equation">{equation}</div>
                    <div className="phosium-calc-output">{display}</div>
                </div>

                {/* Keypad Grid */}
                <div className="phosium-calc-grid">
                    {rows.flat().map((btn, idx) => {
                        const isZero = btn === '0';
                        const isAction = ['/', '*', '-', '+', '='].includes(btn);
                        const isClear = btn === 'C';

                        return (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => handlePress(btn)}
                                style={isZero ? { gridColumn: 'span 2' } : undefined}
                                className={`phosium-calc-btn ${isAction ? 'phosium-calc-action' : ''} ${isClear ? 'phosium-calc-clear' : ''}`}
                            >
                                {btn}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}