# Contributing to chaos-sw

Contributions are welcome. Use [GitHub Issues](https://github.com/fetch-kit/chaos-sw/issues) to report bugs or propose enhancements. Security vulnerabilities should be reported privately as described in [SECURITY.md](./SECURITY.md).

## Development

Development uses Node.js 24, matching the CI environment. Fork the repository, create a branch from `main`, and install the dependencies and the browser used by the test suite:

```sh
npm ci
npx playwright install --with-deps chromium
```

Before submitting a pull request, run the same checks used by CI:

```sh
npm run lint
npm run typecheck
npm run test:ci
```

`npm run test:ci` runs the Vitest unit suite, then builds the package and runs the Playwright suite against a real Service Worker. While developing you can run them separately with `npm run test:unit` and `npm run test:e2e`, or narrow the browser run with `npm run test:browser` and `npm run test:node`.

Unit tests live in `test/unit/` as `*.test.ts`; Playwright specs live in `test/` as `*.spec.ts`. Because the worker runtime is typechecked against the WebWorker library rather than the DOM, `test/unit/worker.test.ts` belongs to `tsconfig.worker.json` and is excluded from the root `tsconfig.json`.

## Changesets

This repository uses [Changesets](https://github.com/changesets/changesets) for versioning. If your change affects the published package, add a changeset describing it:

```sh
npm run changeset
```

Commit the generated file in `.changeset/` alongside your changes. Changes that only touch tests, documentation, or repository configuration do not need one. Maintainers handle the release itself.

## Pull requests

- Keep changes focused and explain their purpose in the pull request.
- Add automated tests for new functionality and bug fixes.
- Update the documentation in `docs/` when behavior or the public API changes.
- Make sure linting, typechecking, and tests pass before submitting the pull request.

Submit pull requests against the `main` branch.
