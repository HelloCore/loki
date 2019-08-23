const debug = require('debug')('loki:websocket');
const WebSocket = require('ws');
const fs = require('fs');
const createMessageQueue = require('./create-message-queue');
const { NativeError } = require('../../errors');
const { withTimeout, withRetries } = require('../../failure-handling');

const MESSAGE_PREFIX = 'loki:';
const NATIVE_ERROR_TYPE = `${MESSAGE_PREFIX}error`;

const timeoutMS = ms => new Promise(res => setTimeout(res, ms));

function createWebsocketTarget(
  socketUri,
  platform,
  saveScreenshotToFile,
  locale
) {
  let socket;
  let deviceList = [];
  const messageQueue = createMessageQueue(NATIVE_ERROR_TYPE);

  const send = (type, ...args) => {
    debug(`Sending message ${type} with args ${JSON.stringify(args, null, 2)}`);
    socket.send(JSON.stringify({ type, args }));
  };

  const addLokiListeners = (type, callback) => {
    const prefixedType = `${MESSAGE_PREFIX}${type}`;
    messageQueue.addListener(prefixedType, null, callback);
  };

  const clearLokiListeners = () => {
    messageQueue.clearListeners();
  };

  const waitForLokiMessage = async (type, timeout = 2000) => {
    const prefixedType = `${MESSAGE_PREFIX}${type}`;
    // const matchesPlatform = data => data && data.platform === platform;
    try {
      const message = await withTimeout(timeout)(
        messageQueue.waitFor(prefixedType)
      );
      return message;
    } catch (err) {
      messageQueue.rejectAllOfType(prefixedType);
      throw err;
    }
  };

  const sendLokiCommand = (type, params = {}) =>
    send(`${MESSAGE_PREFIX}${type}`, Object.assign({ platform }, params));

  const connect = uri =>
    new Promise((resolve, reject) => {
      debug(`Connecting to ${uri}`);
      const ws = new WebSocket(uri, {
        perMessageDeflate: false,
      });

      const timeout = setTimeout(() => {
        const err = new Error('Timed out connecting to storybook web socket');
        reject(err);
        messageQueue.rejectAll(err);
      }, 5000);

      const onMessage = data => {
        const { type, args } = JSON.parse(data);
        debug(
          `Received message ${type} with args ${JSON.stringify(args, null, 2)}`
        );
        messageQueue.receiveMessage(type, args);
      };

      const onError = err => {
        debug('Connection failed', err);
        clearTimeout(timeout);
        reject(err);
        messageQueue.rejectAll(err);
      };

      const onOpen = () => {
        debug('Connected');
        clearTimeout(timeout);
        // TODO: remove other listeners
        resolve(ws);
        ws.on('message', onMessage);
      };

      const onClose = () => {
        debug('Connection closed');
        clearTimeout(timeout);
      };

      ws.on('open', onOpen);
      ws.on('close', onClose);
      ws.on('error', onError);
    });

  const prepare = withRetries(5)(async () => {
    sendLokiCommand('prepare');
    sendLokiCommand('changeLocale', { locale });
    addLokiListeners('didPrepare', ({ deviceModel }) => {
      deviceList.push(deviceModel);
    });
    await timeoutMS(5000);
    clearLokiListeners();
  });

  async function start() {
    try {
      socket = await connect(socketUri);
    } catch (err) {
      throw new Error(
        'Failed connecting to storybook server. Start it with `yarn storybook` and review --react-native-port and --host arguments.'
      );
    }
    try {
      await prepare();
    } catch (err) {
      throw new Error(
        'Failed preparing for loki. Make sure the app is configured and running in storybook mode.'
      );
    }
    if (deviceList.length === 0) {
      throw new Error("Couldn't detect any client.");
    }
  }

  async function stop() {
    sendLokiCommand('restore');
    await Promise.all(
      deviceList.map(async deviceModel => {
        await waitForLokiMessage(`didRestore${deviceModel}`, 30000);
      })
    );
    deviceList = [];
    socket.close();
  }

  async function getStorybook() {
    sendLokiCommand('getStories');
    const { stories } = await waitForLokiMessage('setStories');

    return stories;
  }

  let lastStoryCrashed = false;
  async function captureScreenshotForStory(kind, story, outputPath) {
    const fileArr = outputPath.split('.');
    const fileExt = fileArr.pop();
    const fileNameWithLocale = fileArr.join('.');
    const localeLocation = fileNameWithLocale.length - 2;

    const filename = fileNameWithLocale.substring(0, localeLocation);
    const localeFromFile = fileNameWithLocale.substr(localeLocation);

    if (lastStoryCrashed) {
      // Try to recover from previous crash. App should automatically restart after 1000 ms
      // TODO: Restore some devices that crashed
      // await messageQueue.waitFor('setStories');
      // await prepare();
      // lastStoryCrashed = false;
    }
    debug('captureScreenshotForStory', kind, story);
    send('setCurrentStory', { kind, story });
    try {
      await Promise.all(
        deviceList.map(async deviceModel => {
          await waitForLokiMessage(`ready${deviceModel}`, 30000);
        })
      );
      // await waitForLokiMessage('ready', 30000);
    } catch (error) {
      if (error instanceof NativeError) {
        lastStoryCrashed = error.isFatal;
      }
      throw error;
    }
    try {
      await new Promise((resolve, reject) => {
        let isCompleted = false;
        let capturedCount = 0;

        addLokiListeners(
          'captureScreenCompleted',
          ({ deviceModel, screenImage }) => {
            let newOutputPath;
            if (deviceModel != null) {
              newOutputPath = `${filename}${deviceModel
                .split(' ')
                .join('_')}_${localeFromFile}.${fileExt}`;
            } else {
              newOutputPath = `${filename}UNKNOWN_${localeFromFile}.${fileExt}`;
            }

            fs.writeFileSync(newOutputPath, screenImage, {
              encoding: 'base64',
            });

            capturedCount += 1;
            if (capturedCount === deviceList.length && isCompleted === false) {
              isCompleted = true;

              resolve();
            }
          }
        );

        deviceList.forEach(device => {
          sendLokiCommand('captureScreen', { device });
        });

        withTimeout(10000)(() => {
          if (isCompleted === false) {
            isCompleted = true;
            reject();
          }
        });
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
    }

    clearLokiListeners();
    // const { stories } = await waitForLokiMessage('setStories');

    // await withTimeout(10000)(saveScreenshotToFile(outputPath));
  }

  return { start, stop, getStorybook, captureScreenshotForStory };
}

module.exports = createWebsocketTarget;
