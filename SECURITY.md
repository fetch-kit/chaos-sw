# Security Policy

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Report vulnerabilities privately via [GitHub's private vulnerability reporting](https://github.com/fetch-kit/chaos-sw/security/advisories/new).

Include as much detail as possible: steps to reproduce, potential impact, and any suggested fixes. We aim to acknowledge reports within 48 hours and provide a fix or mitigation plan within 14 days.

## Supported Versions

Only the latest published version on npm receives security fixes.

## Scope

`chaos-sw` is a development and testing tool. It registers a Service Worker that intercepts and deliberately degrades requests within its scope. It is not intended for production traffic, and deploying it to a production origin is a misconfiguration rather than a vulnerability in the package.

Reports that describe the package doing what it is configured to do — failing requests, delaying responses, or returning mock responses — are out of scope.
