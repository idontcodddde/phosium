import { describe, expect, it } from "vitest";
import { evaluateExpression, solveEquation } from "./mathEngine";

describe("math engine", () => {
  it("evaluates expressions with operator precedence and angle modes", () => {
    expect(evaluateExpression("2 + 3 * 4", "rad")).toBe("14");
    expect(evaluateExpression("sin(90)", "deg")).toBe("1");
  });

  it("solves linear and quadratic equations", () => {
    expect(solveEquation("2x + 4 = 10")).toBe("x = 3");
    expect(solveEquation("x^2 = 9")).toBe("x = 3, -3");
  });

  it("reports invalid expressions and unsupported variables", () => {
    expect(() => evaluateExpression("sqrt(-1)", "rad"))
      .toThrow("Expression is outside its real domain");
    expect(() => solveEquation("y = 2", -100, 100, "rad", "y"))
      .toThrow("The numerical solver currently solves for x");
  });
});
