/**
 * Lazy singleton proxy.
 *
 * WHY THIS EXISTS (build-blocking — see AGENT_INSTRUCTIONS.md §5)
 * ──────────────────────────────────────────────────────────────
 * `next build` imports EVERY page and route module during the
 * "Collecting page data" phase, and it does so in a bare Node process where
 * runtime environment variables are not guaranteed to exist (a Vercel preview
 * deploy without env vars, CI, or a local build with no `.env.local`).
 *
 * Constructing an infrastructure client at module scope therefore makes the
 * BUILD fail on a runtime concern:
 *
 *   Error: DATABASE_URL is not set. ...
 *   > Build error occurred
 *   [Error: Failed to collect page data for /api/admin/teams]
 *
 * The proxy defers `factory()` to the first *actual property access*, which can
 * only happen while handling a real request — at which point the platform has
 * injected the environment. The exported object is a drop-in stand-in, so no
 * call site (`prisma.user.findUnique(...)`, `auth0.getSession()`, ...) changes.
 *
 * Design notes:
 *  - Only real member access constructs the client, and construction is
 *    memoized once per module instance (i.e. once per serverless container), so
 *    no client/pool is created per request.
 *  - Framework + logging probes (`await`, `` `${client}` ``, `util.inspect`,
 *    `JSON.stringify`, `in`) are answered WITHOUT constructing the client. That
 *    is load-bearing: a stray log line interpolating the export would otherwise
 *    reintroduce the exact build-time throw this module exists to prevent.
 *  - Method identity is stable (bound functions are memoized), so consumers that
 *    compare or cache handlers keep working.
 *  - If `factory()` throws (genuine misconfiguration), the error surfaces to the
 *    caller that actually used the client and the next access retries — a
 *    transient failure never permanently poisons the process.
 */

/** Node's util.inspect hook, without importing `node:util` into the module. */
const INSPECT = Symbol.for("nodejs.util.inspect.custom");

/**
 * Wrap `factory` in an object that behaves exactly like `T` but is only built on
 * first real use.
 *
 * @param label   Client name, used to prefix errors and the placeholder string
 *                (`prisma`, `auth0`).
 * @param factory Expensive/env-dependent constructor.
 */
export function createLazyClient<T extends object>(label: string, factory: () => T): T {
  const target = {} as T;
  let instance: T | null = null;
  let constructing = false;
  const boundMethods = new Map<string | symbol, unknown>();

  const getInstance = (): T => {
    if (instance === null) {
      if (constructing) {
        throw new Error(`${label}: recursive client initialization detected`);
      }
      constructing = true;
      try {
        instance = factory();
      } finally {
        constructing = false;
      }
    }
    return instance;
  };

  /**
   * Answers for speculative probes, used ONLY while `instance === null`.
   * Returning `undefined` alone is not enough for coercion: if both `valueOf`
   * and `toString` are unusable, `` `${client}` `` throws
   * `TypeError: Cannot convert object to primitive value`. `toString` therefore
   * yields a readable placeholder, and `valueOf` yields the (empty) target so
   * ToPrimitive falls back to that `toString`.
   */
  const probeAnswer = (prop: string | symbol): unknown => {
    switch (prop) {
      // thenable probes: `await client` must resolve to the client, not build it.
      case "then":
      case "catch":
      case "finally":
        return undefined;
      // absent, so Object.prototype.toString / JSON.stringify fall back safely.
      case Symbol.toStringTag:
      case Symbol.toPrimitive:
        return undefined;
      case "toJSON":
        return () => ({});
      case "toString":
        return () => `[${label} client: not initialized]`;
      case "valueOf":
        return () => target;
      // debugger/inspector formatting: print a placeholder, don't construct.
      case INSPECT:
        return () => `[${label} client: not initialized]`;
      default:
        return undefined;
    }
  };

  return new Proxy(target, {
    get(_t, prop, receiver) {
      if (instance === null) {
        // Probes are answered directly; anything else is a real use and must
        // construct. Only the known probe keys are intercepted, so a genuine
        // model/delegate access still errors loudly instead of returning junk.
        switch (prop) {
          case "then":
          case "catch":
          case "finally":
          case "toString":
          case "valueOf":
          case "toJSON":
          case Symbol.toStringTag:
          case Symbol.toPrimitive:
          case INSPECT:
            return probeAnswer(prop);
          default:
            break;
        }
      }
      const current = getInstance();
      const value = Reflect.get(current, prop, current);
      if (typeof value === "function") {
        const cached = boundMethods.get(prop);
        if (cached) return cached;
        // Bind to the real client so the method never sees the proxy as `this`.
        const bound = (value as (...args: unknown[]) => unknown).bind(current);
        boundMethods.set(prop, bound);
        return bound;
      }
      return value;
    },
    set(_t, prop, value) {
      // Forward + reflect onto the target so post-construction descriptors stay
      // consistent with the proxy invariant for non-configurable properties.
      const ok = Reflect.set(getInstance(), prop, value);
      if (ok) Reflect.set(_t, prop, value);
      return ok;
    },
    deleteProperty(_t, prop) {
      const ok = Reflect.deleteProperty(getInstance(), prop);
      if (ok) Reflect.deleteProperty(_t, prop);
      return ok;
    },
    has(_t, prop) {
      // An unconstructed client genuinely has no members yet — answering here
      // keeps `in` checks (and debuggers) side-effect free.
      if (instance === null) return Reflect.has(_t, prop);
      return Reflect.has(getInstance(), prop);
    },
    getPrototypeOf() {
      return instance === null ? Object.prototype : Object.getPrototypeOf(instance);
    },
  });
}
