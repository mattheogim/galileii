import type { z } from "zod";

export type ZodShape = Record<string, z.ZodTypeAny>;

export interface ToolContext {
  now: () => Date;
}

export interface Tool<S extends ZodShape = ZodShape> {
  name: string;
  description: string;
  inputSchema: S;
  isReadOnly?: boolean;
  isConcurrencySafe?: boolean;
  isDestructive?: boolean;
  call: (args: z.infer<z.ZodObject<S>>, ctx: ToolContext) => Promise<unknown>;
}

export type Ok<T> = { ok: true; data: T };
export type Err = {
  ok: false;
  error: { code: string; message: string; hint?: string };
};
export type Result<T> = Ok<T> | Err;

export const ok = <T>(data: T): Ok<T> => ({ ok: true, data });
export const err = (code: string, message: string, hint?: string): Err =>
  hint
    ? { ok: false, error: { code, message, hint } }
    : { ok: false, error: { code, message } };
