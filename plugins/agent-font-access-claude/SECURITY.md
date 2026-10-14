# Security reporting

Report suspected vulnerabilities through [GitHub private vulnerability reporting](https://github.com/nweii/figma-local-fonts-mcp/security/advisories/new) when that form is available. Include the affected version, how to reproduce the problem, and its impact. Use fictional Figma content and omit installation credentials and paired UI files.

If private reporting is unavailable, open a [GitHub issue](https://github.com/nweii/figma-local-fonts-mcp/issues) requesting a private reporting channel. Share sensitive details only through that channel. Use ordinary issues for setup failures and other bugs.

## Local access

The desktop broker binds to the loopback interface and authenticates clients with a per-user installation credential. Any process that can read that credential can connect to the broker and request operations in Figma files whose companion is open. Review the [storage and data handling](PRIVACY.md) before sharing logs or generated files.
