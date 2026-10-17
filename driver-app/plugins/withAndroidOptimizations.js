const { withGradleProperties, withAndroidManifest, createRunOncePlugin } = require('expo/config-plugins');

/**
 * Expo Config Plugin to:
 * 1. Enable R8 code minification & resource shrinking (DEX code optimization & obfuscation > 25%).
 * 2. Ensure Android Manifest allows multi-window resizing and eliminates large screen restrictions.
 */
function withAndroidOptimizations(config) {
  // 1. Enable R8 minification & resource shrinking in release builds
  config = withGradleProperties(config, (cfg) => {
    const props = [
      { key: 'android.enableMinifyInReleaseBuilds', value: 'true' },
      { key: 'android.enableShrinkResourcesInReleaseBuilds', value: 'true' },
    ];

    props.forEach(({ key, value }) => {
      const existing = cfg.modResults.find((item) => item.type === 'property' && item.key === key);
      if (existing) {
        existing.value = value;
      } else {
        cfg.modResults.push({ type: 'property', key, value });
      }
    });

    return cfg;
  });

  // 2. Allow multi-window resizeability on MainActivity for foldables, tablets & large screen compliance
  config = withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    const application = manifest.manifest?.application?.[0];
    if (application) {
      application.$ = application.$ || {};
      application.$['android:resizeableActivity'] = 'true';

      if (Array.isArray(application.activity)) {
        const mainActivity = application.activity.find(
          (act) => act.$?.['android:name'] === '.MainActivity'
        );
        if (mainActivity) {
          mainActivity.$['android:resizeableActivity'] = 'true';
        }
      }
    }
    return cfg;
  });

  return config;
}

module.exports = createRunOncePlugin(
  withAndroidOptimizations,
  'with-android-optimizations',
  '1.0.0'
);
