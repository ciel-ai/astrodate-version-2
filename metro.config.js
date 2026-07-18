const { getSentryExpoConfig } = require('@sentry/react-native/metro');

// getSentryExpoConfig wraps Expo's default getDefaultConfig with Sentry's
// source-map/debug-id annotation -- required for stack traces in crash
// reports to resolve to real file/line rather than minified bundle offsets.
module.exports = getSentryExpoConfig(__dirname);
