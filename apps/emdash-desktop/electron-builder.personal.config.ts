import type { Configuration } from 'electron-builder';
import base from './electron-builder.config.ts';
import {
  APP_ID,
  APP_NAME_LOWER,
  LINUX_DESKTOP_ID,
  PRODUCT_NAME,
} from './src/core/primitives/app-identity/api/app-identity.personal.ts';

// Local-only build of the fork (Emjosh): unpublished, unpacked .app, signed after packaging.
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
    // Signed afterwards with the local identity (scripts/package-personal.sh).
    identity: null,
    hardenedRuntime: false,
    target: [{ target: 'dir', arch: ['arm64'] }],
    icon: 'src/assets/images/emdash/emdash-canary.icns',
  },
};

export default config;
