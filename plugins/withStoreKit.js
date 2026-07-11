const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('@expo/config-plugins');

const STOREKIT_SOURCE = path.join(__dirname, '..', 'native', 'ios-storekit', 'RooAlarmPremium.storekit');
const STOREKIT_TARGET = 'RooAlarm/RooAlarmPremium.storekit';

function copyStoreKitFile(iosRoot) {
  const targetPath = path.join(iosRoot, STOREKIT_TARGET);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(STOREKIT_SOURCE, targetPath);
}

function patchLaunchScheme(iosRoot) {
  const schemePath = path.join(
    iosRoot,
    'RooAlarm.xcodeproj',
    'xcshareddata',
    'xcschemes',
    'RooAlarm.xcscheme'
  );
  if (!fs.existsSync(schemePath)) return;

  let content = fs.readFileSync(schemePath, 'utf8');
  if (content.includes('StoreKitConfigurationFileReference')) return;

  content = content.replace(
    '   </LaunchAction>',
    `      <StoreKitConfigurationFileReference
         identifier = "${STOREKIT_TARGET}">
      </StoreKitConfigurationFileReference>
   </LaunchAction>`
  );
  fs.writeFileSync(schemePath, content);
}

function withStoreKit(config) {
  return withDangerousMod(config, [
    'ios',
    (modConfig) => {
      const iosRoot = modConfig.modRequest.platformProjectRoot;
      copyStoreKitFile(iosRoot);
      patchLaunchScheme(iosRoot);
      return modConfig;
    },
  ]);
}

module.exports = withStoreKit;
