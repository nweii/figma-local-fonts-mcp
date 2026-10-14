# Publish a release

GitHub Actions checks each push and pull request to main. Publishing a GitHub release runs the same checks, publishes the verified archive to npm under `latest`, and attaches the plugin ZIP, npm tarball, and verification report to the release.

## Prepare the version

1. Update the version in `package.json`, `package-lock.json`, and `plugin-package/plugin.json`.
   Set the same plugin version in `.agents/plugins/marketplace.json` and `.claude-plugin/marketplace.json`.
2. Move the release changes from `Unreleased` to a dated version section in `CHANGELOG.md`.
3. Run `npm run build:plugin` to regenerate both committed agent packages.
4. Commit and push the release files. Wait for the **Release** workflow's verification job to pass.
5. Create a GitHub release with a tag matching the package version, such as `v0.1.0-beta.4`. Use the version alone for the title and the relevant changelog categories for its notes. Mark beta releases as prereleases.
6. Publish the GitHub release. Check that the workflow succeeds and npm resolves the released version.

Draft releases, branch pushes, pull requests, and manual runs with no release tag do not publish to npm. The release tag must match `package.json` before package checks proceed. The workflow uses the tagged commit and publishes the archive produced by its verification job.

To retry a failed npm publication, open the **Release** workflow in GitHub Actions, choose **Run workflow** on main, and enter the existing published GitHub release's tag in **release_tag**. The workflow rejects draft or missing releases and version mismatches. Its publication job uses the exact commit verified by the checking job.

## Configure npm trusted publishing

In the npm package's settings, authorize GitHub Actions with these values:

| Setting | Value |
| --- | --- |
| Organization or user | `nweii` |
| Repository | `figma-local-fonts-mcp` |
| Workflow filename | `publish.yml` |
| Environment | Leave empty |
| Direct publishing | Allow `npm publish` |

The workflow uses GitHub-hosted runners and OIDC. No npm publishing token is stored in GitHub secrets. Only the release publication job requests an OIDC identity.

Configure the publisher when a release is ready. npm requires its first successful publication within two days to validate the connection. Verify a successful Actions publication and the resulting npm provenance; saving the npm setting alone does not verify authentication.

See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) for setup requirements and recovery from an expired or mismatched connection.
