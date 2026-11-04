import type { Configuration } from 'electron-builder';
import base from './electron-builder.config.ts';
import {
  APP_ID,
  APP_NAME_LOWER,
  LINUX_DESKTOP_ID,
  PRODUCT_NAME,
} from './src/core/primitives/app-identity/api/app-identity.personal.ts';

// Local-only build of the fork: unpublished, ad-hoc signed, unpacked .app.
const config: Configuration = {
  ...base,
  appId: APP_ID,
  productName: PRODUCT_NAME,
  executableName: PRODUCT_NAME,
  extraMetadata: { desktopName: `${LINUX_DESKTOP_ID}.desktop` },
  artifactName: `${APP_NAME_LOWER}-\${arch}.\${ext}`,
  publish: null,
  mac: {
    ...base.mac,
    identity: '-',
    // Ad-hoc signatures can't satisfy hardened runtime library validation.
    hardenedRuntime: false,
    target: [{ target: 'dir', arch: ['arm64'] }],
    icon: 'src/assets/images/emdash/emdash-canary.icns',
  },
};

export default config;
