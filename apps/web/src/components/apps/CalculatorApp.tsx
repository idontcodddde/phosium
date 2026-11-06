import { useMemo, useState } from 'react';
import {
    checkEquivalent,
    createTable,
    evaluateExpression,
    runCas,
    sampleFunction,
    solveEquation,
    type AngleMode,
    type FunctionSample,
    type TablePair,
} from '../../lib/mathEngine';

type Tool = 'calculate' | 'graph' | 'table' | 'solve' | 'compare';
type HistoryEntry = { expression: string; result: string };
type CasOperation = 'simplify' | 'differentiate' | 'integrate';

const tools: { id: Tool; label: string }[] = [
    { id: 'calculate', label: 'Calculate' },
    { id: 'graph', label: 'Graph' },
    { id: 'table', label: 'Table' },
    { id: 'solve', label: 'Solve' },
    { id: 'compare', label: 'Compare' },
];

const keys = [
    { label: 'sin', insert: 'sin(' }, { label: 'cos', insert: 'cos(' }, { label: 'tan', insert: 'tan(' }, { label: '√', insert: 'sqrt(' }, { label: 'xʸ', insert: '^' }, { label: '⌫', action: 'delete' },
    { label: 'asin', insert: 'asin(' }, { label: 'acos', insert: 'acos(' }, { label: 'atan', insert: 'atan(' }, { label: 'ln', insert: 'ln(' }, { label: 'log', insert: 'log(' }, { label: 'C', action: 'clear' },
    { label: '(', insert: '(' }, { label: ')', insert: ')' }, { label: '!', insert: '!' }, { label: 'π', insert: 'pi' }, { label: 'e', insert: 'e' }, { label: '÷', insert: '/' },
    { label: '7', insert: '7' }, { label: '8', insert: '8' }, { label: '9', insert: '9' }, { label: '×', insert: '*' }, { label: '−', insert: '-' }, { label: 'Ans', insert: 'ans' },
    { label: '4', insert: '4' }, { label: '5', insert: '5' }, { label: '6', insert: '6' }, { label: '+', insert: '+' }, { label: 'x', insert: 'x' }, { label: 'abs', insert: 'abs(' },
    { label: '1', insert: '1' }, { label: '2', insert: '2' }, { label: '3', insert: '3' }, { label: '.', insert: '.' }, { label: '0', insert: '0' }, { label: '=', action: 'evaluate' },
];

function formatValue(value: number | null): string {
    if (value === null || !Number.isFinite(value)) return 'undefined';
    if (Object.is(value, -0) || Math.abs(value) < 1e-14) return '0';
    return Number(value.toPrecision(10)).toString();
}

function getNiceTicks(min: number, max: number, targetCount: number): number[] {
    const rawStep = (max - min) / targetCount;
    const magnitude = 10 ** Math.floor(Math.log10(rawStep));
    const normalizedStep = rawStep / magnitude;
    const niceFraction = normalizedStep <= 1 ? 1
        : normalizedStep <= 2 ? 2
            : normalizedStep <= 5 ? 5
                : 10;
    const range = max - min;
    const step = range >= 1 && range <= 24 ? 1 : niceFraction * magnitude;
    const first = Math.ceil(min / step - 1e-10) * step;
    const ticks: number[] = [];
    for (let index = 0; index < 1000; index += 1) {
        const tick = first + index * step;
        if (tick > max + step * 1e-10) break;
        ticks.push(Number(tick.toPrecision(12)));
    }
    return ticks;
}

function GraphPlot({ samples, xMin, xMax, yMin, yMax }: {
    samples: FunctionSample[];
    xMin: number;
    xMax: number;
    yMin: number;
    yMax: number;
}) {
    const width = 800;
    const height = 340;
    const padding = { top: 16, right: 18, bottom: 30, left: 52 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;
    const xPosition = (value: number) => padding.left + (value - xMin) / (xMax - xMin) * plotWidth;
    const yPosition = (value: number) => padding.top + (yMax - value) / (yMax - yMin) * plotHeight;
    const xTicks = getNiceTicks(xMin, xMax, Math.floor(plotWidth / 70));
    const yTicks = getNiceTicks(yMin, yMax, Math.floor(plotHeight / 50));
    let path = '';
    let previousY: number | null = null;
    for (const sample of samples) {
        if (sample.y === null || !Number.isFinite(sample.y)) {
            previousY = null;
            continue;
        }
        const x = xPosition(sample.x);
        const y = yPosition(sample.y);
        if (!Number.isFinite(y) || Math.abs(y) > plotHeight * 1000) {
            previousY = null;
            continue;
        }
        path += `${previousY === null || Math.abs(y - previousY) > plotHeight * 0.55 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)} `;
        previousY = y;
    }

    return (
        <svg className="phosium-math-plot" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Function graph">
            <defs>
                <clipPath id="phosium-plot-clip">
                    <rect x={padding.left} y={padding.top} width={plotWidth} height={plotHeight} />
                </clipPath>
            </defs>
            {xTicks.map((tick) => (
                <g key={`x-${tick}`}>
                    <line x1={xPosition(tick)} x2={xPosition(tick)} y1={padding.top} y2={height - padding.bottom} className="phosium-plot-grid" />
                    <text x={xPosition(tick)} y={height - 10} textAnchor="middle" className="phosium-plot-label">{formatValue(tick)}</text>
                </g>
            ))}
            {yTicks.map((tick) => (
                <g key={`y-${tick}`}>
                    <line x1={padding.left} x2={width - padding.right} y1={yPosition(tick)} y2={yPosition(tick)} className="phosium-plot-grid" />
                    <text x={padding.left - 8} y={yPosition(tick) + 3} textAnchor="end" className="phosium-plot-label">{formatValue(tick)}</text>
                </g>
            ))}
            {xMin <= 0 && xMax >= 0 && <line x1={xPosition(0)} x2={xPosition(0)} y1={padding.top} y2={height - padding.bottom} className="phosium-plot-axis" />}
            {yMin <= 0 && yMax >= 0 && <line x1={padding.left} x2={width - padding.right} y1={yPosition(0)} y2={yPosition(0)} className="phosium-plot-axis" />}
            <path d={path} className="phosium-plot-function" clipPath="url(#phosium-plot-clip)" />
        </svg>
    );
}

function Field({ label, value, onChange, placeholder, type = 'text' }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    type?: string;
}) {
    return (
        <label className="phosium-math-field">
            <span>{label}</span>
            <input
                type={type}
                value={value}
                placeholder={placeholder}
                onChange={(event) => onChange(event.target.value)}
                autoComplete="off"
                spellCheck={false}
            />
        </label>
    );
}

function findTablePairs(pairs: TablePair[], query: string): TablePair[] {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return pairs;
    const indexedQuery = /^(x|y)\s*=\s*(-?\d+(?:\.\d+)?)$/.exec(normalized);
    if (indexedQuery) {
        const target = Number(indexedQuery[2]);
        return pairs.filter((pair) => {
            const value = indexedQuery[1] === 'x' ? pair.x : pair.y;
            return value !== null && Math.abs(value - target) < 1e-8 * Math.max(1, Math.abs(target));
        });
    }
    return pairs.filter((pair) => `${formatValue(pair.x)} ${formatValue(pair.y)}`.toLowerCase().includes(normalized));
}

export function CalculatorApp() {
    const [tool, setTool] = useState<Tool>('calculate');
    const [angleMode, setAngleMode] = useState<AngleMode>('deg');
    const [expression, setExpression] = useState('');
    const [result, setResult] = useState('');
    const [error, setError] = useState('');
    const [xValue, setXValue] = useState('0');
    const [answer, setAnswer] = useState(0);
    const [history, setHistory] = useState<HistoryEntry[]>([]);

    const [graphFunction, setGraphFunction] = useState('x^2');
    const [graphXMin, setGraphXMin] = useState('-10');
    const [graphXMax, setGraphXMax] = useState('10');
    const [graphYMin, setGraphYMin] = useState('-10');
    const [graphYMax, setGraphYMax] = useState('10');

    const [tableFunction, setTableFunction] = useState('2x + 1');
    const [tableStart, setTableStart] = useState('-5');
    const [tableEnd, setTableEnd] = useState('5');
    const [tableStep, setTableStep] = useState('1');
    const [tableSearch, setTableSearch] = useState('');

    const [solveInput, setSolveInput] = useState('3x + 2 = 12');
    const [solveMin, setSolveMin] = useState('-100');
    const [solveMax, setSolveMax] = useState('100');
    const [solveResult, setSolveResult] = useState('');
    const [solveError, setSolveError] = useState('');

    const [compareFirst, setCompareFirst] = useState('x + x');
    const [compareSecond, setCompareSecond] = useState('2x');
    const [compareResult, setCompareResult] = useState<{ equivalent: boolean; method: string } | null>(null);
    const [compareError, setCompareError] = useState('');

    const graph = useMemo(() => {
        try {
            const xMin = Number(graphXMin);
            const xMax = Number(graphXMax);
            const yMin = Number(graphYMin);
            const yMax = Number(graphYMax);
            if (![xMin, xMax, yMin, yMax].every(Number.isFinite) || xMin >= xMax || yMin >= yMax) {
                throw new Error('Set valid ranges with each minimum less than its maximum');
            }
            return { samples: sampleFunction(graphFunction, xMin, xMax, angleMode, 1600), xMin, xMax, yMin, yMax, error: '' };
        } catch (reason) {
            return {
                samples: [] as FunctionSample[],
                xMin: 0,
                xMax: 1,
                yMin: 0,
                yMax: 1,
                error: reason instanceof Error ? reason.message : 'Unable to graph this function',
            };
        }
    }, [angleMode, graphFunction, graphXMin, graphXMax, graphYMin, graphYMax]);

    const table = useMemo(() => {
        try {
            return {
                pairs: createTable(tableFunction, Number(tableStart), Number(tableEnd), Number(tableStep), angleMode),
                error: '',
            };
        } catch (reason) {
            return { pairs: [] as TablePair[], error: reason instanceof Error ? reason.message : 'Unable to create this table' };
        }
    }, [angleMode, tableFunction, tableStart, tableEnd, tableStep]);
    const visiblePairs = useMemo(() => findTablePairs(table.pairs, tableSearch), [table.pairs, tableSearch]);

    const record = (input: string, output: string) => {
        setResult(output);
        setError('');
        setHistory((previous) => [{ expression: input, result: output }, ...previous].slice(0, 8));
    };

    const evaluate = (input = expression) => {
        try {
            const numericX = Number(xValue);
            if (!Number.isFinite(numericX)) throw new Error('x must be a finite number');
            const output = evaluateExpression(input, angleMode, { x: numericX, ans: answer });
            setAnswer(Number(output));
            record(input, output);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Unable to evaluate this expression');
            setResult('');
        }
    };

    const applyCas = (operation: CasOperation) => {
        try {
            const output = runCas(expression, operation);
            record(`${operation === 'differentiate' ? 'd/dx' : operation === 'integrate' ? '∫ dx' : 'simplify'}(${expression})`, output);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : 'Unable to process this expression');
            setResult('');
        }
    };

    const solve = () => {
        try {
            const output = solveEquation(solveInput, Number(solveMin), Number(solveMax), angleMode);
            setSolveResult(output);
            setSolveError('');
        } catch (reason) {
            setSolveResult('');
            setSolveError(reason instanceof Error ? reason.message : 'Unable to solve this equation');
        }
    };

    const compare = () => {
        try {
            setCompareResult(checkEquivalent(compareFirst, compareSecond, angleMode));
            setCompareError('');
        } catch (reason) {
            setCompareResult(null);
            setCompareError(reason instanceof Error ? reason.message : 'Unable to compare these inputs');
        }
    };

    const handleKey = (key: (typeof keys)[number]) => {
        if ('action' in key) {
            if (key.action === 'clear') {
                setExpression('');
                setResult('');
                setError('');
            } else if (key.action === 'delete') {
                setExpression((current) => current.slice(0, -1));
            } else {
                evaluate();
            }
            return;
        }
        setExpression((current) => current + key.insert);
        setError('');
    };

    return (
        <div className="phosium-calculator">
            <section className="phosium-calc-container" aria-label="Math Studio">
                <header className="phosium-calc-header">
                    <div>
                        <h2>Math Studio</h2>
                        <span>Calculate, graph, solve, and explore functions</span>
                    </div>
                    <button
                        type="button"
                        className="phosium-calc-mode"
                        onClick={() => setAngleMode((mode) => mode === 'deg' ? 'rad' : 'deg')}
                        aria-label={`Angle mode: ${angleMode.toUpperCase()}. Switch mode`}
                    >
                        {angleMode.toUpperCase()}
                    </button>
                </header>

                <nav className="phosium-math-tabs" aria-label="Math tools">
                    {tools.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            className={tool === item.id ? 'active' : ''}
                            aria-current={tool === item.id ? 'page' : undefined}
                            onClick={() => setTool(item.id)}
                        >
                            {item.label}
                        </button>
                    ))}
                </nav>

                {tool === 'calculate' && (
                    <>
                        <div className="phosium-calc-screen">
                            <label className="phosium-calc-expression-label" htmlFor="phosium-calc-expression">Expression</label>
                            <input
                                id="phosium-calc-expression"
                                className="phosium-calc-expression"
                                value={expression}
                                onChange={(event) => {
                                    setExpression(event.target.value);
                                    setError('');
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        evaluate();
                                    }
                                }}
                                placeholder="Try sin(30) or 2x + 1"
                                autoComplete="off"
                                spellCheck={false}
                            />
                            <div className={`phosium-calc-output${error ? ' has-error' : ''}`} aria-live="polite">
                                {error || result || 'Ready'}
                            </div>
                        </div>

                        <div className="phosium-calc-cas">
                            <div className="phosium-calc-cas-title">
                                <span>Algebra &amp; calculus</span>
                                <span>Symbolic operations</span>
                            </div>
                            <div className="phosium-calc-cas-actions">
                                <button type="button" onClick={() => applyCas('simplify')}>Simplify</button>
                                <button type="button" onClick={() => applyCas('differentiate')}>Differentiate</button>
                                <button type="button" onClick={() => applyCas('integrate')}>Integrate</button>
                                <button type="button" onClick={() => {
                                    setSolveInput(expression);
                                    setTool('solve');
                                }}>Solve for x</button>
                            </div>
                        </div>

                        <div className="phosium-calc-grid">
                            {keys.map((key) => (
                                <button
                                    key={key.label}
                                    type="button"
                                    onClick={() => handleKey(key)}
                                    className={[
                                        'phosium-calc-btn',
                                        ['=', '+', '−', '×', '÷', 'xʸ'].includes(key.label) ? 'phosium-calc-action' : '',
                                        key.label === 'C' ? 'phosium-calc-clear' : '',
                                    ].filter(Boolean).join(' ')}
                                >
                                    {key.label}
                                </button>
                            ))}
                        </div>

                        <div className="phosium-calc-footer">
                            <label>
                                <span>x =</span>
                                <input aria-label="Value of x" inputMode="decimal" value={xValue} onChange={(event) => setXValue(event.target.value)} />
                            </label>
                            <span>Enter to calculate</span>
                        </div>
                        <p className="phosium-math-help">Supports powers, factorials, π, e, and functions such as sin, cos, tan, sqrt, ln, log, exp, abs, min, and max.</p>

                        {history.length > 0 && (
                            <div className="phosium-calc-history">
                                <div className="phosium-calc-cas-title">
                                    <span>History</span>
                                    <button type="button" onClick={() => setHistory([])}>Clear</button>
                                </div>
                                {history.map((entry, index) => (
                                    <button
                                        type="button"
                                        className="phosium-calc-history-entry"
                                        key={`${entry.expression}-${index}`}
                                        onClick={() => {
                                            setExpression(entry.expression.replace(/^(?:simplify|d\/dx|∫ dx)\((.*)\)$/, '$1'));
                                            setResult(entry.result);
                                            setError('');
                                        }}
                                    >
                                        <span>{entry.expression}</span>
                                        <strong>{entry.result}</strong>
                                    </button>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {tool === 'graph' && (
                    <div className="phosium-math-panel">
                        <div className="phosium-math-panel-heading">
                            <div>
                                <h3>Function graph</h3>
                                <p>Plot any supported real-valued function of x.</p>
                            </div>
                        </div>
                        <Field label="Function f(x)" value={graphFunction} onChange={setGraphFunction} placeholder="e.g. sin(x), x^3 - 2x" />
                        <div className="phosium-math-fields four">
                            <Field label="x minimum" value={graphXMin} onChange={setGraphXMin} type="number" />
                            <Field label="x maximum" value={graphXMax} onChange={setGraphXMax} type="number" />
                            <Field label="y minimum" value={graphYMin} onChange={setGraphYMin} type="number" />
                            <Field label="y maximum" value={graphYMax} onChange={setGraphYMax} type="number" />
                        </div>
                        {graph.error
                            ? <div className="phosium-math-message error">{graph.error}</div>
                            : <div className="phosium-math-plot-wrap">
                                <GraphPlot samples={graph.samples} xMin={graph.xMin} xMax={graph.xMax} yMin={graph.yMin} yMax={graph.yMax} />
                                <div className="phosium-math-plot-legend"><span /> f(x) = {graphFunction || '—'}</div>
                            </div>}
                    </div>
                )}

                {tool === 'table' && (
                    <div className="phosium-math-panel">
                        <div className="phosium-math-panel-heading">
                            <div>
                                <h3>Function table</h3>
                                <p>Generate ordered (x, y) pairs, then search by x or y.</p>
                            </div>
                        </div>
                        <Field label="Function y = f(x)" value={tableFunction} onChange={setTableFunction} placeholder="e.g. 3x + 2" />
                        <div className="phosium-math-fields three">
                            <Field label="x start" value={tableStart} onChange={setTableStart} type="number" />
                            <Field label="x end" value={tableEnd} onChange={setTableEnd} type="number" />
                            <Field label="Step" value={tableStep} onChange={setTableStep} type="number" />
                        </div>
                        <Field label="Search pairs (try x=2 or y=7)" value={tableSearch} onChange={setTableSearch} placeholder="Filter x and y values" />
                        {table.error
                            ? <div className="phosium-math-message error">{table.error}</div>
                            : <div className="phosium-math-table-wrap">
                                <table className="phosium-math-table">
                                    <thead><tr><th>x</th><th>y = f(x)</th></tr></thead>
                                    <tbody>
                                        {visiblePairs.map((pair, index) => (
                                            <tr key={`${pair.x}-${index}`}><td>{formatValue(pair.x)}</td><td>{formatValue(pair.y)}</td></tr>
                                        ))}
                                        {visiblePairs.length === 0 && <tr><td colSpan={2}>No matching pairs</td></tr>}
                                    </tbody>
                                </table>
                            </div>}
                        {!table.error && <div className="phosium-math-footnote">Showing {visiblePairs.length} of {table.pairs.length} pairs.</div>}
                    </div>
                )}

                {tool === 'solve' && (
                    <div className="phosium-math-panel">
                        <div className="phosium-math-panel-heading">
                            <div>
                                <h3>Solve for x</h3>
                                <p>Exact answers for linear and quadratic equations; numerical roots for other functions in the range.</p>
                            </div>
                        </div>
                        <Field label="Equation" value={solveInput} onChange={setSolveInput} placeholder="e.g. 3x + 2 = 12 or exp(x) = 5" />
                        <div className="phosium-math-fields two">
                            <Field label="Search x from" value={solveMin} onChange={setSolveMin} type="number" />
                            <Field label="To" value={solveMax} onChange={setSolveMax} type="number" />
                        </div>
                        <button type="button" className="phosium-math-primary" onClick={solve}>Solve equation</button>
                        {(solveResult || solveError) && (
                            <div className={`phosium-math-message ${solveError ? 'error' : 'success'}`} aria-live="polite">
                                {solveError || solveResult}
                            </div>
                        )}
                        <p className="phosium-math-footnote">Numerical search checks for sign changes and repeated roots. A root may be missed if it falls outside the range or between samples; widen the range if needed.</p>
                    </div>
                )}

                {tool === 'compare' && (
                    <div className="phosium-math-panel">
                        <div className="phosium-math-panel-heading">
                            <div>
                                <h3>Equivalent expressions?</h3>
                                <p>Compare expressions or equations such as x + x and 2x.</p>
                            </div>
                        </div>
                        <Field label="First expression or equation" value={compareFirst} onChange={(value) => {
                            setCompareFirst(value);
                            setCompareResult(null);
                        }} placeholder="e.g. x + x" />
                        <Field label="Second expression or equation" value={compareSecond} onChange={(value) => {
                            setCompareSecond(value);
                            setCompareResult(null);
                        }} placeholder="e.g. 2x" />
                        <button type="button" className="phosium-math-primary" onClick={compare}>Check equivalence</button>
                        {compareError && <div className="phosium-math-message error">{compareError}</div>}
                        {compareResult && (
                            <div className={`phosium-math-message ${compareResult.equivalent ? 'success' : 'error'}`} aria-live="polite">
                                <strong>{compareResult.equivalent ? 'Likely equivalent' : 'Not equivalent'}</strong>
                                <span>{compareResult.method}</span>
                            </div>
                        )}
                        <p className="phosium-math-footnote">Equivalence is checked numerically at several x values, not proven symbolically. A result is a useful check, not a formal proof.</p>
                    </div>
                )}
            </section>
        </div>
    );
}
