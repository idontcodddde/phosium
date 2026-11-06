export type AngleMode = 'deg' | 'rad';

type Expression =
    | { type: 'number'; value: number }
    | { type: 'variable'; name: string }
    | { type: 'unary'; operator: '+' | '-'; operand: Expression }
    | { type: 'binary'; operator: '+' | '-' | '*' | '/' | '^'; left: Expression; right: Expression }
    | { type: 'call'; name: string; args: Expression[] }
    | { type: 'factorial'; operand: Expression };

type Token = { type: 'number' | 'identifier' | 'operator' | 'leftParen' | 'rightParen' | 'comma'; value: string };
type Variables = Record<string, number>;

const functions = new Set([
    'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh',
    'asinh', 'acosh', 'atanh', 'sqrt', 'abs', 'ln', 'log', 'exp', 'floor',
    'ceil', 'round', 'min', 'max', 'atan2',
]);

function tokenize(source: string): Token[] {
    const tokens: Token[] = [];
    let position = 0;

    while (position < source.length) {
        const rest = source.slice(position);
        const whitespace = /^\s+/.exec(rest);
        if (whitespace) {
            position += whitespace[0].length;
            continue;
        }

        const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/i.exec(rest);
        if (number) {
            tokens.push({ type: 'number', value: number[0] });
            position += number[0].length;
            continue;
        }

        const identifier = /^[a-zA-Z_][a-zA-Z_0-9]*/.exec(rest);
        if (identifier) {
            tokens.push({ type: 'identifier', value: identifier[0].toLowerCase() });
            position += identifier[0].length;
            continue;
        }

        const character = source[position];
        if (character === '(') tokens.push({ type: 'leftParen', value: character });
        else if (character === ')') tokens.push({ type: 'rightParen', value: character });
        else if (character === ',') tokens.push({ type: 'comma', value: character });
        else if ('+-*/^!'.includes(character)) tokens.push({ type: 'operator', value: character });
        else throw new Error(`Unexpected character "${character}"`);
        position += 1;
    }

    return tokens;
}

class Parser {
    private position = 0;
    private readonly tokens: Token[];

    constructor(tokens: Token[]) {
        this.tokens = tokens;
    }

    parse(): Expression {
        if (this.tokens.length === 0) throw new Error('Enter an expression');
        const expression = this.parseSum();
        if (this.position !== this.tokens.length) {
            throw new Error(`Unexpected token "${this.tokens[this.position].value}"`);
        }
        return expression;
    }

    private peek(): Token | undefined {
        return this.tokens[this.position];
    }

    private take(): Token {
        const token = this.peek();
        if (!token) throw new Error('Incomplete expression');
        this.position += 1;
        return token;
    }

    private parseSum(): Expression {
        let expression = this.parseProduct();
        while (this.peek()?.type === 'operator' && ['+', '-'].includes(this.peek()!.value)) {
            const operator = this.take().value as '+' | '-';
            expression = { type: 'binary', operator, left: expression, right: this.parseProduct() };
        }
        return expression;
    }

    private parseProduct(): Expression {
        let expression = this.parseUnary();
        while (true) {
            const next = this.peek();
            if (next?.type === 'operator' && ['*', '/'].includes(next.value)) {
                const operator = this.take().value as '*' | '/';
                expression = { type: 'binary', operator, left: expression, right: this.parseUnary() };
            } else if (next && (next.type === 'number' || next.type === 'identifier' || next.type === 'leftParen')) {
                expression = { type: 'binary', operator: '*', left: expression, right: this.parseUnary() };
            } else {
                break;
            }
        }
        return expression;
    }

    private parseUnary(): Expression {
        const next = this.peek();
        if (next?.type === 'operator' && (next.value === '+' || next.value === '-')) {
            this.take();
            return { type: 'unary', operator: next.value, operand: this.parseUnary() };
        }
        return this.parsePower();
    }

    private parsePower(): Expression {
        let expression = this.parsePostfix();
        if (this.peek()?.type === 'operator' && this.peek()?.value === '^') {
            this.take();
            expression = { type: 'binary', operator: '^', left: expression, right: this.parseUnary() };
        }
        return expression;
    }

    private parsePostfix(): Expression {
        let expression = this.parseAtom();
        while (this.peek()?.type === 'operator' && this.peek()?.value === '!') {
            this.take();
            expression = { type: 'factorial', operand: expression };
        }
        return expression;
    }

    private parseAtom(): Expression {
        const token = this.take();
        if (token.type === 'number') return { type: 'number', value: Number(token.value) };
        if (token.type === 'leftParen') {
            const expression = this.parseSum();
            if (this.take().type !== 'rightParen') throw new Error('Expected ")"');
            return expression;
        }
        if (token.type !== 'identifier') throw new Error(`Unexpected token "${token.value}"`);

        if (token.value === 'pi') return { type: 'number', value: Math.PI };
        if (token.value === 'e') return { type: 'number', value: Math.E };
        if (functions.has(token.value)) {
            if (this.peek()?.type !== 'leftParen') throw new Error(`Use ${token.value}(...)`);
            this.take();
            const args: Expression[] = [];
            if (this.peek()?.type !== 'rightParen') {
                args.push(this.parseSum());
                while (this.peek()?.type === 'comma') {
                    this.take();
                    args.push(this.parseSum());
                }
            }
            if (this.take().type !== 'rightParen') throw new Error('Expected ")"');
            const expected = ['min', 'max', 'atan2'].includes(token.value) ? 2 : 1;
            if (args.length === 0 || (!['min', 'max'].includes(token.value) && args.length !== expected)) {
                throw new Error(`${token.value} expects ${expected} argument${expected === 1 ? '' : 's'}`);
            }
            return { type: 'call', name: token.value, args };
        }
        return { type: 'variable', name: token.value };
    }
}

function toRadians(value: number, mode: AngleMode): number {
    return mode === 'deg' ? value * Math.PI / 180 : value;
}

function fromRadians(value: number, mode: AngleMode): number {
    return mode === 'deg' ? value * 180 / Math.PI : value;
}

function factorial(value: number): number {
    if (!Number.isInteger(value) || value < 0 || value > 170) {
        throw new Error('Factorial requires a whole number from 0 to 170');
    }
    let result = 1;
    for (let factor = 2; factor <= value; factor += 1) result *= factor;
    return result;
}

function evaluateNode(node: Expression, variables: Variables, mode: AngleMode): number {
    switch (node.type) {
        case 'number':
            return node.value;
        case 'variable': {
            const value = variables[node.name];
            if (value === undefined) throw new Error(`Unknown variable "${node.name}"`);
            return value;
        }
        case 'unary': {
            const value = evaluateNode(node.operand, variables, mode);
            return node.operator === '-' ? -value : value;
        }
        case 'factorial':
            return factorial(evaluateNode(node.operand, variables, mode));
        case 'binary': {
            const left = evaluateNode(node.left, variables, mode);
            const right = evaluateNode(node.right, variables, mode);
            switch (node.operator) {
                case '+': return left + right;
                case '-': return left - right;
                case '*': return left * right;
                case '/':
                    if (right === 0) throw new Error('Cannot divide by zero');
                    return left / right;
                case '^': return left ** right;
            }
        }
        case 'call': {
            const args = node.args.map((arg) => evaluateNode(arg, variables, mode));
            const angle = toRadians(args[0], mode);
            switch (node.name) {
                case 'sin': return Math.sin(angle);
                case 'cos': return Math.cos(angle);
                case 'tan': return Math.tan(angle);
                case 'asin': return fromRadians(Math.asin(args[0]), mode);
                case 'acos': return fromRadians(Math.acos(args[0]), mode);
                case 'atan': return fromRadians(Math.atan(args[0]), mode);
                case 'atan2': return fromRadians(Math.atan2(args[0], args[1]), mode);
                case 'sinh': return Math.sinh(args[0]);
                case 'cosh': return Math.cosh(args[0]);
                case 'tanh': return Math.tanh(args[0]);
                case 'asinh': return Math.asinh(args[0]);
                case 'acosh': return Math.acosh(args[0]);
                case 'atanh': return Math.atanh(args[0]);
                case 'sqrt': return Math.sqrt(args[0]);
                case 'abs': return Math.abs(args[0]);
                case 'ln': return Math.log(args[0]);
                case 'log': return Math.log10(args[0]);
                case 'exp': return Math.exp(args[0]);
                case 'floor': return Math.floor(args[0]);
                case 'ceil': return Math.ceil(args[0]);
                case 'round': return Math.round(args[0]);
                case 'min': return Math.min(...args);
                case 'max': return Math.max(...args);
                default: throw new Error(`Unknown function "${node.name}"`);
            }
        }
    }
}

function formatNumber(value: number): string {
    if (Object.is(value, -0) || Math.abs(value) < 1e-14) return '0';
    if (!Number.isFinite(value)) return String(value);
    return Number(value.toPrecision(12)).toString();
}

function precedence(node: Expression): number {
    if (node.type === 'binary') return node.operator === '+' || node.operator === '-' ? 1 : node.operator === '*' || node.operator === '/' ? 2 : 4;
    if (node.type === 'unary') return 3;
    return 5;
}

function print(node: Expression, parentPrecedence = 0): string {
    let text: string;
    if (node.type === 'number') text = formatNumber(node.value);
    else if (node.type === 'variable') text = node.name;
    else if (node.type === 'unary') text = `${node.operator}${print(node.operand, precedence(node))}`;
    else if (node.type === 'factorial') text = `${print(node.operand, precedence(node))}!`;
    else if (node.type === 'call') text = `${node.name}(${node.args.map((arg) => print(arg)).join(', ')})`;
    else {
        const currentPrecedence = precedence(node);
        const leftPrecedence = currentPrecedence + (node.operator === '^' ? 1 : 0);
        const rightNeedsGrouping = node.operator === '-' || node.operator === '/'
            || (node.operator === '+' && node.right.type === 'binary' && node.right.operator === '-')
            || (node.operator === '*' && node.right.type === 'binary' && node.right.operator === '/');
        const rightPrecedence = currentPrecedence + (rightNeedsGrouping ? 1 : 0);
        text = `${print(node.left, leftPrecedence)} ${node.operator} ${print(node.right, rightPrecedence)}`;
    }
    return precedence(node) < parentPrecedence ? `(${text})` : text;
}

function simplify(node: Expression): Expression {
    if (node.type === 'number' || node.type === 'variable') return node;
    if (node.type === 'unary') {
        const operand = simplify(node.operand);
        if (operand.type === 'number') return { type: 'number', value: node.operator === '-' ? -operand.value : operand.value };
        if (node.operator === '+' ) return operand;
        if (operand.type === 'unary' && operand.operator === '-') return operand.operand;
        return { ...node, operand };
    }
    if (node.type === 'factorial') {
        const operand = simplify(node.operand);
        if (operand.type === 'number') return { type: 'number', value: factorial(operand.value) };
        return { ...node, operand };
    }
    if (node.type === 'call') {
        const args = node.args.map(simplify);
        if (args.every((arg) => arg.type === 'number')) {
            return { type: 'number', value: evaluateNode({ ...node, args }, {}, 'rad') };
        }
        return { ...node, args };
    }

    const left = simplify(node.left);
    const right = simplify(node.right);
    const same = print(left) === print(right);
    if (left.type === 'number' && right.type === 'number') {
        return { type: 'number', value: evaluateNode({ ...node, left, right }, {}, 'rad') };
    }
    if (node.operator === '+') {
        if (left.type === 'number' && left.value === 0) return right;
        if (right.type === 'number' && right.value === 0) return left;
        if (same) return simplify({ type: 'binary', operator: '*', left: { type: 'number', value: 2 }, right: left });
    } else if (node.operator === '-') {
        if (right.type === 'number' && right.value === 0) return left;
        if (same) return { type: 'number', value: 0 };
    } else if (node.operator === '*') {
        if ((left.type === 'number' && left.value === 0) || (right.type === 'number' && right.value === 0)) return { type: 'number', value: 0 };
        if (left.type === 'number' && left.value === 1) return right;
        if (right.type === 'number' && right.value === 1) return left;
        if (left.type === 'number' && left.value === -1) return simplify({ type: 'unary', operator: '-', operand: right });
        if (right.type === 'number' && right.value === -1) return simplify({ type: 'unary', operator: '-', operand: left });
    } else if (node.operator === '/') {
        if (right.type === 'number' && right.value === 0) throw new Error('Cannot divide by zero');
        if (left.type === 'number' && left.value === 0) return { type: 'number', value: 0 };
        if (right.type === 'number' && right.value === 1) return left;
        if (same) return { type: 'number', value: 1 };
    } else {
        if (right.type === 'number' && right.value === 0) return { type: 'number', value: 1 };
        if (right.type === 'number' && right.value === 1) return left;
        if (left.type === 'number' && left.value === 1) return left;
    }
    return { ...node, left, right };
}

function derivative(node: Expression, variable: string): Expression {
    const number = (value: number): Expression => ({ type: 'number', value });
    const binary = (operator: '+' | '-' | '*' | '/' | '^', left: Expression, right: Expression): Expression =>
        ({ type: 'binary', operator, left, right });
    const derivativeOf = (operand: Expression) => derivative(operand, variable);

    if (node.type === 'number') return number(0);
    if (node.type === 'variable') return number(node.name === variable ? 1 : 0);
    if (node.type === 'unary') return { ...node, operand: derivativeOf(node.operand) };
    if (node.type === 'factorial') throw new Error('Factorials are not differentiable symbolically');
    if (node.type === 'call') {
        const [argument] = node.args;
        const inner = derivativeOf(argument);
        const call = (name: string, args: Expression[]): Expression => ({ type: 'call', name, args });
        switch (node.name) {
            case 'sin': return binary('*', call('cos', [argument]), inner);
            case 'cos': return binary('*', { type: 'unary', operator: '-', operand: call('sin', [argument]) }, inner);
            case 'tan': return binary('*', binary('/', number(1), binary('^', call('cos', [argument]), number(2))), inner);
            case 'ln': return binary('*', binary('/', number(1), argument), inner);
            case 'log': return binary('*', binary('/', number(1), binary('*', argument, number(Math.LN10))), inner);
            case 'exp': return binary('*', call('exp', [argument]), inner);
            case 'sqrt': return binary('*', binary('/', number(1), binary('*', number(2), call('sqrt', [argument]))), inner);
            case 'asin': return binary('*', binary('/', number(1), call('sqrt', [binary('-', number(1), binary('^', argument, number(2)))])), inner);
            case 'acos': return binary('*', { type: 'unary', operator: '-', operand: binary('/', number(1), call('sqrt', [binary('-', number(1), binary('^', argument, number(2)))])) }, inner);
            case 'atan': return binary('*', binary('/', number(1), binary('+', number(1), binary('^', argument, number(2)))), inner);
            default: throw new Error(`No symbolic derivative rule for ${node.name}`);
        }
    }

    const leftDerivative = derivativeOf(node.left);
    const rightDerivative = derivativeOf(node.right);
    switch (node.operator) {
        case '+': return binary('+', leftDerivative, rightDerivative);
        case '-': return binary('-', leftDerivative, rightDerivative);
        case '*': return binary('+', binary('*', leftDerivative, node.right), binary('*', node.left, rightDerivative));
        case '/': return binary('/', binary('-', binary('*', leftDerivative, node.right), binary('*', node.left, rightDerivative)), binary('^', node.right, number(2)));
        case '^':
            if (node.right.type === 'number') {
                return binary('*', binary('*', node.right, binary('^', node.left, number(node.right.value - 1))), leftDerivative);
            }
            return binary('*', node, binary('+', binary('*', rightDerivative, { type: 'call', name: 'ln', args: [node.left] }), binary('*', node.right, binary('/', leftDerivative, node.left))));
    }
}

function integrate(node: Expression, variable: string): Expression {
    const number = (value: number): Expression => ({ type: 'number', value });
    const binary = (operator: '+' | '-' | '*' | '/' | '^', left: Expression, right: Expression): Expression =>
        ({ type: 'binary', operator, left, right });

    if (node.type === 'number' || (node.type === 'variable' && node.name !== variable)) return binary('*', node, { type: 'variable', name: variable });
    if (node.type === 'variable') return binary('/', binary('^', node, number(2)), number(2));
    if (node.type === 'unary') return { ...node, operand: integrate(node.operand, variable) };
    if (node.type === 'factorial') throw new Error('No symbolic integral rule for factorials');
    if (node.type === 'binary') {
        if (node.operator === '+' || node.operator === '-') return { ...node, left: integrate(node.left, variable), right: integrate(node.right, variable) };
        if (node.operator === '*') {
            if (node.left.type === 'number') return binary('*', node.left, integrate(node.right, variable));
            if (node.right.type === 'number') return binary('*', node.right, integrate(node.left, variable));
        }
        if (node.operator === '^' && node.left.type === 'variable' && node.left.name === variable && node.right.type === 'number') {
            if (node.right.value === -1) return { type: 'call', name: 'ln', args: [{ type: 'call', name: 'abs', args: [node.left] }] };
            const exponent = node.right.value + 1;
            return binary('/', binary('^', node.left, number(exponent)), number(exponent));
        }
        throw new Error('No symbolic integral rule for this expression');
    }
    const [argument] = node.args;
    if (argument.type !== 'variable' || argument.name !== variable) throw new Error('Integrals currently require a direct variable argument');
    switch (node.name) {
        case 'sin': return { type: 'unary', operator: '-', operand: { type: 'call', name: 'cos', args: [argument] } };
        case 'cos': return { type: 'call', name: 'sin', args: [argument] };
        case 'exp': return { ...node };
        case 'ln': return binary('-', binary('*', argument, node), argument);
        default: throw new Error(`No symbolic integral rule for ${node.name}`);
    }
}

type Polynomial = [number, number, number];

function polynomial(node: Expression, variable: string): Polynomial {
    const zero: Polynomial = [0, 0, 0];
    if (node.type === 'number') return [node.value, 0, 0];
    if (node.type === 'variable') {
        if (node.name !== variable) throw new Error(`Cannot solve with respect to "${variable}" while "${node.name}" is present`);
        return [0, 1, 0];
    }
    if (node.type === 'unary') {
        const values = polynomial(node.operand, variable);
        return node.operator === '-' ? values.map((value) => -value) as Polynomial : values;
    }
    if (node.type === 'binary') {
        const left = polynomial(node.left, variable);
        const right = polynomial(node.right, variable);
        if (node.operator === '+' || node.operator === '-') {
            const sign = node.operator === '+' ? 1 : -1;
            return left.map((value, index) => value + sign * right[index]) as Polynomial;
        }
        if (node.operator === '*' || node.operator === '/') {
            if (node.operator === '/' && right[1] === 0 && right[2] === 0) {
                if (right[0] === 0) throw new Error('Cannot divide by zero');
                return left.map((value) => value / right[0]) as Polynomial;
            }
            if (node.operator === '*' && left[1] === 0 && left[2] === 0) return right.map((value) => value * left[0]) as Polynomial;
            if (node.operator === '*' && right[1] === 0 && right[2] === 0) return left.map((value) => value * right[0]) as Polynomial;
            if (node.operator === '*') {
                const values = zero.slice() as Polynomial;
                for (let i = 0; i <= 2; i += 1) {
                    for (let j = 0; j <= 2; j += 1) {
                        if (i + j > 2 && left[i] !== 0 && right[j] !== 0) throw new Error('Only linear and quadratic equations can be solved');
                        if (i + j <= 2) values[i + j] += left[i] * right[j];
                    }
                }
                return values;
            }
        }
        if (node.operator === '^' && right[1] === 0 && right[2] === 0 && Number.isInteger(right[0]) && right[0] >= 0 && right[0] <= 2) {
            if (right[0] === 0) return [1, 0, 0];
            if (right[0] === 1) return left;
            return polynomial({ type: 'binary', operator: '*', left: node.left, right: node.left }, variable);
        }
    }
    if (node.type === 'call' && node.args.every((arg) => arg.type === 'number')) return [evaluateNode(node, {}, 'rad'), 0, 0];
    throw new Error('Only linear and quadratic equations can be solved');
}

function solve(source: string, variable: string): string {
    return solveParsed(residualExpression(source), variable);
}

function parseExpression(source: string): Expression {
    return new Parser(tokenize(source)).parse();
}

function parseEquation(source: string): [Expression, Expression] {
    const equals = source.indexOf('=');
    if (equals < 0) return [parseExpression(source), { type: 'number', value: 0 }];
    if (source.indexOf('=', equals + 1) >= 0) throw new Error('Use one equality sign in an equation');
    return [parseExpression(source.slice(0, equals)), parseExpression(source.slice(equals + 1))];
}

function residualExpression(source: string): Expression {
    const [left, right] = parseEquation(source);
    return simplify({ type: 'binary', operator: '-', left, right });
}

function evaluateNodeAt(node: Expression, x: number, mode: AngleMode): number | null {
    try {
        const value = evaluateNode(node, { x }, mode);
        return Number.isFinite(value) ? value : null;
    } catch {
        return null;
    }
}

export type FunctionSample = { x: number; y: number | null };
export type TablePair = { x: number; y: number | null };

function stripFunctionLabel(source: string): string {
    return source.replace(/^\s*(?:y|f\s*\(\s*x\s*\))\s*=\s*/i, '');
}

export function sampleFunction(
    source: string,
    min: number,
    max: number,
    mode: AngleMode = 'rad',
    count = 600,
): FunctionSample[] {
    if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
        throw new Error('Enter a valid x range where the minimum is less than the maximum');
    }
    const expression = parseExpression(stripFunctionLabel(source));
    const steps = Math.max(2, Math.min(3000, Math.floor(count)));
    return Array.from({ length: steps + 1 }, (_, index) => {
        const x = min + (max - min) * index / steps;
        return { x, y: evaluateNodeAt(expression, x, mode) };
    });
}

export function createTable(
    source: string,
    start: number,
    end: number,
    step: number,
    mode: AngleMode = 'rad',
): TablePair[] {
    if (![start, end, step].every(Number.isFinite) || step === 0 || (end - start) * step < 0) {
        throw new Error('Enter a valid start, end, and step in the same direction');
    }
    const rowCount = Math.floor((end - start) / step + 1e-10) + 1;
    if (rowCount < 1 || rowCount > 500) throw new Error('The table can contain up to 500 pairs');
    const expression = parseExpression(stripFunctionLabel(source));
    return Array.from({ length: rowCount }, (_, index) => {
        const x = start + step * index;
        return { x, y: evaluateNodeAt(expression, x, mode) };
    });
}

function bisectRoot(node: Expression, left: number, right: number, mode: AngleMode): number | null {
    let leftValue = evaluateNodeAt(node, left, mode);
    let rightValue = evaluateNodeAt(node, right, mode);
    if (leftValue === null || rightValue === null || Math.sign(leftValue) === Math.sign(rightValue)) return null;

    for (let iteration = 0; iteration < 80; iteration += 1) {
        const middle = left + (right - left) / 2;
        const middleValue = evaluateNodeAt(node, middle, mode);
        if (middleValue === null) return null;
        if (middleValue === 0 || Math.abs(right - left) < 1e-12 * Math.max(1, Math.abs(middle))) return middle;
        if (Math.sign(middleValue) === Math.sign(leftValue)) {
            left = middle;
            leftValue = middleValue;
        } else {
            right = middle;
            rightValue = middleValue;
        }
    }

    const root = left + (right - left) / 2;
    const value = evaluateNodeAt(node, root, mode);
    return value !== null && Math.abs(value) < 1e-7 ? root : null;
}

function minimizeAbsoluteValue(node: Expression, left: number, right: number, mode: AngleMode): number | null {
    const ratio = (Math.sqrt(5) - 1) / 2;
    let first = right - ratio * (right - left);
    let second = left + ratio * (right - left);
    let firstValue = evaluateNodeAt(node, first, mode);
    let secondValue = evaluateNodeAt(node, second, mode);
    if (firstValue === null || secondValue === null) return null;

    for (let iteration = 0; iteration < 64; iteration += 1) {
        if (Math.abs(firstValue) < Math.abs(secondValue)) {
            right = second;
            second = first;
            secondValue = firstValue;
            first = right - ratio * (right - left);
            firstValue = evaluateNodeAt(node, first, mode);
            if (firstValue === null) return null;
        } else {
            left = first;
            first = second;
            firstValue = secondValue;
            second = left + ratio * (right - left);
            secondValue = evaluateNodeAt(node, second, mode);
            if (secondValue === null) return null;
        }
    }

    const root = Math.abs(firstValue) < Math.abs(secondValue) ? first : second;
    const residual = evaluateNodeAt(node, root, mode);
    return residual !== null && Math.abs(residual) < 1e-7 ? root : null;
}

function numericRoots(node: Expression, min: number, max: number, mode: AngleMode, count = 1600): number[] {
    if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
        throw new Error('Enter a valid search range where the minimum is less than the maximum');
    }
    const steps = Math.max(100, Math.min(6000, Math.floor(count)));
    const samples = Array.from({ length: steps + 1 }, (_, index) => {
        const x = min + (max - min) * index / steps;
        return { x, y: evaluateNodeAt(node, x, mode) };
    });
    const roots: number[] = [];
    const addRoot = (root: number | null) => {
        if (root === null || !Number.isFinite(root)) return;
        if (!roots.some((existing) => Math.abs(existing - root) < 1e-6 * Math.max(1, Math.abs(root)))) roots.push(root);
    };

    for (let index = 0; index < samples.length; index += 1) {
        const current = samples[index];
        if (current.y === 0) addRoot(current.x);
        if (index > 0) {
            const previous = samples[index - 1];
            if (previous.y !== null && current.y !== null && previous.y !== 0 && current.y !== 0
                && Math.sign(previous.y) !== Math.sign(current.y)) {
                addRoot(bisectRoot(node, previous.x, current.x, mode));
            }
        }
        if (index > 0 && index < samples.length - 1) {
            const previous = samples[index - 1];
            const next = samples[index + 1];
            if (previous.y !== null && current.y !== null && next.y !== null
                && Math.abs(current.y) <= Math.abs(previous.y) && Math.abs(current.y) <= Math.abs(next.y)) {
                addRoot(minimizeAbsoluteValue(node, previous.x, next.x, mode));
            }
        }
    }
    return roots.sort((left, right) => left - right);
}

export function solveEquation(
    source: string,
    min = -100,
    max = 100,
    mode: AngleMode = 'rad',
    variable = 'x',
): string {
    if (variable !== 'x') throw new Error('The numerical solver currently solves for x');
    const [left, right] = parseEquation(source);
    const residual = simplify({ type: 'binary', operator: '-', left, right });
    try {
        return solveParsed(residual, variable);
    } catch (reason) {
        if (!(reason instanceof Error) || !reason.message.includes('Only linear and quadratic equations can be solved')) throw reason;
    }

    const roots = numericRoots(residual, min, max, mode);
    if (roots.length === 0) return `No roots found in [${formatNumber(min)}, ${formatNumber(max)}]. Try a wider range.`;
    return roots.map((root) => `x ≈ ${formatNumber(root)}`).join(', ');
}

export type EquivalenceResult = { equivalent: boolean; method: string };

export function checkEquivalent(
    firstSource: string,
    secondSource: string,
    mode: AngleMode = 'rad',
    min = -100,
    max = 100,
): EquivalenceResult {
    const firstIsEquation = firstSource.includes('=');
    const secondIsEquation = secondSource.includes('=');
    if (firstIsEquation !== secondIsEquation) return { equivalent: false, method: 'One input is an equation and the other is an expression' };

    if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
        throw new Error('Enter a valid comparison range where the minimum is less than the maximum');
    }

    const points = [-7.31, -3.17, -1.13, -0.41, 0.23, 0.89, 1.71, 3.83, 6.17];
    if (firstIsEquation) {
        const first = residualExpression(firstSource);
        const second = residualExpression(secondSource);
        let ratio: number | null = null;
        let compared = 0;
        let proportional = true;
        for (const x of points) {
            const firstValue = evaluateNodeAt(first, x, mode);
            const secondValue = evaluateNodeAt(second, x, mode);
            if (firstValue === null || secondValue === null) continue;
            compared += 1;
            const firstZero = Math.abs(firstValue) < 1e-8;
            const secondZero = Math.abs(secondValue) < 1e-8;
            if (firstZero !== secondZero) {
                proportional = false;
                continue;
            }
            if (firstZero) continue;
            const currentRatio = firstValue / secondValue;
            if (ratio === null) ratio = currentRatio;
            else if (!Number.isFinite(currentRatio) || Math.abs(currentRatio - ratio) > 1e-7 * Math.max(1, Math.abs(ratio))) {
                proportional = false;
            }
        }
        if (compared < 3) throw new Error('Not enough valid x values to compare these equations');
        if (proportional) {
            return { equivalent: true, method: 'Equation residuals are proportional at sampled x values (numerical check, not a formal proof)' };
        }

        const firstIsZero = first.type === 'number' && first.value === 0;
        const secondIsZero = second.type === 'number' && second.value === 0;
        if (firstIsZero || secondIsZero) {
            return {
                equivalent: firstIsZero && secondIsZero,
                method: 'Compared the equations’ real solution sets',
            };
        }
        const firstRoots = numericRoots(first, min, max, mode);
        const secondRoots = numericRoots(second, min, max, mode);
        const sameRoots = firstRoots.length === secondRoots.length
            && firstRoots.every((root, index) => Math.abs(root - secondRoots[index]) <= 1e-5 * Math.max(1, Math.abs(root)));
        return {
            equivalent: sameRoots,
            method: `Compared numerically found real roots in [${formatNumber(min)}, ${formatNumber(max)}] (not a formal proof)`,
        };
    }

    const first = parseExpression(firstSource);
    const second = parseExpression(secondSource);
    let compared = 0;
    for (const x of points) {
        const firstValue = evaluateNodeAt(first, x, mode);
        const secondValue = evaluateNodeAt(second, x, mode);
        if (firstValue === null || secondValue === null) continue;
        compared += 1;
        if (Math.abs(firstValue - secondValue) > 1e-8 * Math.max(1, Math.abs(firstValue), Math.abs(secondValue))) {
            return { equivalent: false, method: `Compared values at ${compared} or more sampled x values` };
        }
    }
    if (compared < 3) throw new Error('Not enough valid x values to compare these expressions');
    return { equivalent: true, method: 'Values match at multiple sampled x values (numerical check, not a formal proof)' };
}

export function evaluateExpression(source: string, mode: AngleMode, variables: Variables = {}): string {
    const expression = parseExpression(source);
    const result = evaluateNode(expression, variables, mode);
    if (Number.isNaN(result)) throw new Error('Expression is outside its real domain');
    return formatNumber(result);
}

function solveParsed(residual: Expression, variable: string): string {
    const [constant, linear, quadratic] = polynomial(residual, variable);
    if (quadratic === 0 && linear === 0) return constant === 0 ? 'All values satisfy this equation' : 'No solution';
    if (quadratic === 0) return `${variable} = ${formatNumber(-constant / linear)}`;
    const discriminant = linear * linear - 4 * quadratic * constant;
    if (discriminant < 0) {
        const real = -linear / (2 * quadratic);
        const imaginary = Math.sqrt(-discriminant) / Math.abs(2 * quadratic);
        return `${variable} = ${formatNumber(real)} ± ${formatNumber(imaginary)}i`;
    }
    const root = Math.sqrt(discriminant);
    const first = (-linear + root) / (2 * quadratic);
    const second = (-linear - root) / (2 * quadratic);
    return first === second ? `${variable} = ${formatNumber(first)}` : `${variable} = ${formatNumber(first)}, ${formatNumber(second)}`;
}

export function runCas(source: string, operation: 'simplify' | 'differentiate' | 'integrate' | 'solve', variable = 'x'): string {
    if (operation === 'solve') return solve(source, variable);
    const expression = parseExpression(source);
    if (operation === 'simplify') return print(simplify(expression));
    if (operation === 'differentiate') return print(simplify(derivative(expression, variable)));
    return print(simplify(integrate(expression, variable)));
}
