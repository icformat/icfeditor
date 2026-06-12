// electron-builder configuration.
//
// macOS code-signing and notarization turn on AUTOMATICALLY when the signing
// secrets are present in the environment, and stay off otherwise — so unsigned
// builds still succeed (no Apple Developer account required to produce a .dmg).
//   - signing:      requires CSC_LINK (+ CSC_KEY_PASSWORD)
//   - notarization: additionally requires APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD,
//                   and APPLE_TEAM_ID
const macSign = !!process.env.CSC_LINK
const macNotarize = macSign && !!process.env.APPLE_TEAM_ID

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'org.icformat.icfeditor',
  productName: 'ICF Editor',
  copyright: 'Copyright © 2026 Edison Williams',
  directories: {
    output: 'release',
    buildResources: 'build'
  },
  files: ['out/**/*', 'package.json'],
  // File associations. `rank: 'Owner'` makes macOS LaunchServices treat ICF
  // Editor as the owning app for these types (it claims the default). On Windows
  // the NSIS hooks in build/installer.nsh additionally clear any pre-existing
  // per-extension UserChoice so the install overrides a prior default app.
  fileAssociations: [
    { ext: 'icf', name: 'ICF Document', role: 'Editor', rank: 'Owner', mimeType: 'application/icf' },
    { ext: 'icx', name: 'ICX Index', role: 'Editor', rank: 'Owner', mimeType: 'application/icx' }
  ],
  win: {
    target: ['nsis'],
    artifactName: '${productName}-${version}-setup.${ext}'
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true
  },
  mac: {
    target: ['dmg'],
    category: 'public.app-category.developer-tools',
    hardenedRuntime: macSign, // required for notarization
    gatekeeperAssess: false,
    notarize: macNotarize
  },
  linux: {
    target: ['AppImage', 'deb'],
    category: 'Development',
    maintainer: 'Edison Williams'
  }
}
