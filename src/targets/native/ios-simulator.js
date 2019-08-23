const fs = require('fs-extra');
const osnap = require('osnap/src/ios');
const execa = require('execa');
const { createError, ErrorCode } = require('osnap/src/errors');
const { withRetries } = require('../../failure-handling');
const createWebsocketTarget = require('./create-websocket-target');

const saveScreenshotToFile = withRetries(3)(async filename => {
  const xcrun = await osnap.getXcrunPath();

  const fileArr = filename.split('.');
  const fileExt = fileArr.pop();
  const fileName = fileArr.join('.');
  const simtctlList = await execa(xcrun, ['simctl', 'list']);
  const { stdout } = simtctlList;

  const results = stdout
    .split('\n')
    .filter(line => line.indexOf('Booted') >= 0)
    .map(line => line.substring(0, line.length - 11).trim())
    .map(line => {
      const result = line.split('(');
      const deviceName = result[0].trim();
      const deviceId = result[1].trim();
      return {
        deviceId,
        deviceName,
      };
    })
    .map(device => {
      const newOutputPath = `${fileName}_${device.deviceName
        .replace(' ', '_')
        .replace(' ', '_')}.${fileExt}`;
      return new Promise(async resolve => {
        try {
          const response = await execa(xcrun, [
            'simctl',
            'io',
            device.deviceId,
            'screenshot',
            newOutputPath,
          ]);
          if (response.code !== 0) {
            throw createError(ErrorCode.ScreenshotFail);
          }
        } catch (err) {
          throw createError(ErrorCode.ScreenshotFail);
        }

        const { size } = await fs.stat(newOutputPath);
        if (size === 0) {
          throw new Error('Screenshot failed ');
        }
        resolve();
      });
    });

  await Promise.all(results);
});

const createIOSSimulatorTarget = (socketUri, locale) =>
  createWebsocketTarget(socketUri, 'ios', saveScreenshotToFile, locale);

module.exports = createIOSSimulatorTarget;
