export const EXIT_OK = 0;
export const EXIT_USAGE = 1;
export const EXIT_VALIDATION = 2;
export const EXIT_ENVIRONMENT = 3;

export class CliError extends Error {
  readonly exitCode: number;
  readonly payload: unknown;

  constructor(message: string, exitCode: number, payload?: unknown) {
    super(message);
    this.name = "CliError";
    this.exitCode = exitCode;
    this.payload = payload;
  }
}
