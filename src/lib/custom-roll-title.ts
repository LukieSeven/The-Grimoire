/** Manual die/formula labels only; never changes the expression sent to the roller. */
export function customRollTitle(expression: string): string {
  return `Custom Roll (${expression.trim().replace(/\b(\d*)d(?=\d)/gi, "$1D")})`;
}
