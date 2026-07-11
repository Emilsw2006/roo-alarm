const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { withDangerousMod } = require('@expo/config-plugins');

const NATIVE_DIR = path.join(__dirname, '..', 'native', 'ios-alarmkit');
const SOUND_FILES = [
  'bell.mp3',
  'bird.mp3',
  'digital_alarm.mp3',
  'emergency.mp3',
  'radar_classic.mp3',
  'rain.mp3',
  'rooster.mp3',
];

const NATIVE_SOURCES = [
  { name: 'AlarmKitModule.swift', type: 'sourcecode.swift', phase: 'Sources' },
  { name: 'AlarmKitModule.m', type: 'sourcecode.c.objc', phase: 'Sources' },
  { name: 'RooAlarmDismissRetrigger.swift', type: 'sourcecode.swift', phase: 'Sources' },
  { name: 'RooAlarmConfigurationFactory.swift', type: 'sourcecode.swift', phase: 'Sources' },
  { name: 'RooAlarmIntents.swift', type: 'sourcecode.swift', phase: 'Sources' },
  { name: 'RooAlarmPendingLaunch.swift', type: 'sourcecode.swift', phase: 'Sources' },
  { name: 'RooAlarmPendingDismissRetrigger.swift', type: 'sourcecode.swift', phase: 'Sources' },
  { name: 'RooAlarmSoundCatalog.swift', type: 'sourcecode.swift', phase: 'Sources' },
];

function uuid() {
  return crypto.randomBytes(12).toString('hex').toUpperCase();
}

function copyNativeSources(iosRoot) {
  const targetDir = path.join(iosRoot, 'RooAlarm');
  fs.mkdirSync(targetDir, { recursive: true });

  NATIVE_SOURCES.forEach(({ name }) => {
    fs.copyFileSync(path.join(NATIVE_DIR, name), path.join(targetDir, name));
  });

  const assetsDir = path.join(__dirname, '..', 'assets', 'sounds');
  SOUND_FILES.forEach((file) => {
    const src = path.join(assetsDir, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(targetDir, file));
    }
  });
}

function findResourcesAnchor(content) {
  const patterns = [
    /\t\t\t\t[A-F0-9]+ \/\* PrivacyInfo\.xcprivacy in Resources \*\/,/,
    /\t\t\t\tBB2F792D24A3F905000567C9 \/\* Expo\.plist in Resources \*\/,/,
    /\t\t\t\t13B07FBF1A68108700A75B9A \/\* Images\.xcassets in Resources \*\/,/,
    /\t\t\t\t[A-F0-9]+ \/\* .+ in Resources \*\/,/,
  ];
  for (const pattern of patterns) {
    if (pattern.test(content)) return pattern;
  }
  return null;
}

function findSourcesAnchor(content) {
  const patterns = [
    /\t\t\t\tF11748422D0307B40044C1D9 \/\* AppDelegate\.swift in Sources \*\/,/,
    /\t\t\t\t[A-F0-9]+ \/\* AppDelegate\.swift in Sources \*\/,/,
    /\t\t\t\t[A-F0-9]+ \/\* .+\.swift in Sources \*\/,/,
  ];
  for (const pattern of patterns) {
    if (pattern.test(content)) return pattern;
  }
  return null;
}

function findGroupAnchor(content) {
  const patterns = [
    /\t\t\t\tF11748412D0307B40044C1D9 \/\* AppDelegate\.swift \*\/,/,
    /\t\t\t\t[A-F0-9]+ \/\* AppDelegate\.swift \*\/,/,
  ];
  for (const pattern of patterns) {
    if (pattern.test(content)) return pattern;
  }
  return null;
}

function patchPbxproj(iosRoot) {
  const pbxPath = path.join(iosRoot, 'RooAlarm.xcodeproj', 'project.pbxproj');
  if (!fs.existsSync(pbxPath)) return;

  let content = fs.readFileSync(pbxPath, 'utf8');
  const entries = [];

  NATIVE_SOURCES.forEach(({ name, type, phase }) => {
    if (content.includes(`/* ${name} in ${phase} */`)) return;
    const fileRef = uuid();
    const buildFile = uuid();
    entries.push({
      buildFile,
      fileRef,
      name,
      path: `RooAlarm/${name}`,
      type,
      phase,
    });
  });

  SOUND_FILES.forEach((file) => {
    if (content.includes(`/* ${file} in Resources */`)) return;
    const fileRef = uuid();
    const buildFile = uuid();
    entries.push({
      buildFile,
      fileRef,
      name: file,
      path: `RooAlarm/${file}`,
      type: 'audio.mp3',
      phase: 'Resources',
    });
  });

  if (entries.length === 0) return;

  const buildFileLines = entries
    .map(
      (e) =>
        `\t\t${e.buildFile} /* ${e.name} in ${e.phase} */ = {isa = PBXBuildFile; fileRef = ${e.fileRef} /* ${e.name} */; };`
    )
    .join('\n');

  const fileRefLines = entries
    .map(
      (e) =>
        `\t\t${e.fileRef} /* ${e.name} */ = {isa = PBXFileReference; lastKnownFileType = ${e.type}; name = ${e.name}; path = ${e.path}; sourceTree = "<group>"; };`
    )
    .join('\n');

  content = content.replace(
    '/* End PBXBuildFile section */',
    `${buildFileLines}\n/* End PBXBuildFile section */`
  );

  content = content.replace(
    '/* End PBXFileReference section */',
    `${fileRefLines}\n/* End PBXFileReference section */`
  );

  const sourceBuildFiles = entries
    .filter((e) => e.phase === 'Sources')
    .map((e) => `\t\t\t\t${e.buildFile} /* ${e.name} in Sources */,`)
    .join('\n');

  if (sourceBuildFiles) {
    const sourcesAnchor = findSourcesAnchor(content);
    if (!sourcesAnchor) {
      throw new Error('withAlarmKit: could not find Sources anchor in project.pbxproj');
    }
    content = content.replace(
      sourcesAnchor,
      (match) => `${match}\n${sourceBuildFiles}`
    );
  }

  const resourceBuildFiles = entries
    .filter((e) => e.phase === 'Resources')
    .map((e) => `\t\t\t\t${e.buildFile} /* ${e.name} in Resources */,`)
    .join('\n');

  if (resourceBuildFiles) {
    const resourcesAnchor = findResourcesAnchor(content);
    if (!resourcesAnchor) {
      throw new Error('withAlarmKit: could not find Resources anchor in project.pbxproj');
    }
    content = content.replace(
      resourcesAnchor,
      (match) => `${match}\n${resourceBuildFiles}`
    );
  }

  const groupFiles = entries
    .map((e) => `\t\t\t\t${e.fileRef} /* ${e.name} */,`)
    .join('\n');

  const groupAnchor = findGroupAnchor(content);
  if (!groupAnchor) {
    throw new Error('withAlarmKit: could not find AppDelegate group anchor in project.pbxproj');
  }
  content = content.replace(
    groupAnchor,
    (match) => `${match}\n${groupFiles}`
  );

  fs.writeFileSync(pbxPath, content);
}

function withAlarmKitEntitlement(config) {
  // AlarmKit on device only needs NSAlarmKitUsageDescription (Apple WWDC25 / Developer Forums).
  // com.apple.developer.alarmkit is not in the Developer Portal yet and breaks device builds.
  return config;
}

function withAlarmKit(config) {
  config = withAlarmKitEntitlement(config);
  return withDangerousMod(config, [
    'ios',
    (modConfig) => {
      const iosRoot = modConfig.modRequest.platformProjectRoot;
      copyNativeSources(iosRoot);
      patchPbxproj(iosRoot);
      return modConfig;
    },
  ]);
}

module.exports = withAlarmKit;
module.exports.copyNativeSources = copyNativeSources;
module.exports.patchPbxproj = patchPbxproj;
