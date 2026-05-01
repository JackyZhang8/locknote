declare module 'node:test' {
  export default function test(
    name: string,
    fn: () => void | Promise<void>,
  ): void;
}

declare module 'node:assert/strict' {
  interface AssertModule {
    equal(actual: unknown, expected: unknown, message?: string): void;
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
  }

  const assert: AssertModule;
  export default assert;
}

declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
}
