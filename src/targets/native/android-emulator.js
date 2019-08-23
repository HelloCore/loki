const osnap = require('osnap/src/android');
const createWebsocketTarget = require('./create-websocket-target');

const saveScreenshotToFile = filename => osnap.saveToFile({ filename });

const createAndroidEmulatorTarget = (socketUri, locale) =>
  createWebsocketTarget(socketUri, 'android', saveScreenshotToFile, locale);

module.exports = createAndroidEmulatorTarget;
