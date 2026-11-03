const { resolveExpoConfig } = require('./scripts/android-aab-candidate.mjs');
const { configureAndroidBuild } = require('./scripts/android-release.mjs');

module.exports = ({ config }) => resolveExpoConfig(configureAndroidBuild(config));
