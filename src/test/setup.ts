import '@testing-library/jest-dom'
import type { TestingLibraryMatchers } from '@testing-library/jest-dom/matchers'

// Typy matcherů jest-dom (`toBeInTheDocument` a spol.) pro Vitest 5. Za běhu je registruje
// import výš, typy ale balík (6.9.1 i 7.0.1) dodává jen přes globální `jest.Matchers`, které
// Vitest 5 už nečte, a přes `Assertion<T>` ve tvaru z Vitestu ≤ 4, který se s dnešním
// `Assertion<R, T>` nesloučí. Upstream: testing-library/jest-dom#738, PR #742. Až balík podporu
// Vitestu 5 vydá, přepnout import na '@testing-library/jest-dom/vitest' a tenhle blok smazat.
//
// Schválně v .ts, ne v .d.ts: `skipLibCheck` přeskakuje i naše vlastní .d.ts, takže by chybu
// v rozšíření (jiný seznam typových parametrů = TS2428) tiše spolkl. Přesně tak se typy ztratily
// v samotném balíku.
declare module 'vitest' {
  // Seznam typových parametrů musí přesně odpovídat deklaraci ve Vitestu (jinak TS2428), proto
  // `T` zůstává, i když se nepoužije. Prázdné tělo je podstata rozšíření.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars -- viz výše
  interface Matchers<R, T> extends TestingLibraryMatchers<unknown, R> {}
}
