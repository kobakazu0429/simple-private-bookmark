// https://github.com/honojs/middleware/blob/8525489796cf3ed0ebf43f0841f6805fc5aa35a0/packages/valibot-validator/src/index.ts

import type {
  Context,
  Env,
  Input,
  MiddlewareHandler,
  TypedResponse,
  ValidationTargets,
} from "jsr:@hono/hono@4.7.5";
import { validator } from "jsr:@hono/hono@4.7.5/validator";
import type {
  GenericSchema,
  GenericSchemaAsync,
  InferInput,
  InferOutput,
  SafeParseResult,
} from "jsr:@valibot/valibot@1.0.0";
import { safeParseAsync } from "jsr:@valibot/valibot@1.0.0";

export type Hook<
  T extends GenericSchema | GenericSchemaAsync,
  E extends Env,
  P extends string,
  Target extends keyof ValidationTargets = keyof ValidationTargets,
  // deno-lint-ignore ban-types
  O = {}
> = (
  result: SafeParseResult<T> & {
    target: Target;
  },
  c: Context<E, P>
) =>
  | Response
  | void
  | TypedResponse<O>
  | Promise<Response | void | TypedResponse<O>>;

type HasUndefined<T> = undefined extends T ? true : false;

export const vValidator = <
  T extends GenericSchema | GenericSchemaAsync,
  Target extends keyof ValidationTargets,
  E extends Env,
  P extends string,
  In = InferInput<T>,
  Out = InferOutput<T>,
  I extends Input = {
    in: HasUndefined<In> extends true
      ? {
          [K in Target]?: In extends ValidationTargets[K]
            ? In
            : { [K2 in keyof In]?: ValidationTargets[K][K2] };
        }
      : {
          [K in Target]: In extends ValidationTargets[K]
            ? In
            : { [K2 in keyof In]: ValidationTargets[K][K2] };
        };
    out: { [K in Target]: Out };
  },
  V extends I = I
>(
  target: Target,
  schema: T,
  hook?: Hook<T, E, P, Target>
): MiddlewareHandler<E, P, V> =>
  // @ts-expect-error not typed well
  validator(target, async (value, c) => {
    const result = await safeParseAsync(schema, value);

    if (hook) {
      const hookResult = await hook({ ...result, target }, c);
      if (hookResult) {
        if (hookResult instanceof Response) {
          return hookResult;
        }

        if ("response" in hookResult) {
          return hookResult.response;
        }
      }
    }

    if (!result.success) {
      return c.json(result, 400);
    }

    return result.output;
  });
