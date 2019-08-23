/**
 * This replaces the React Native Image component to register when it's finished
 * loading to avoid race conditions in visual tests.
 */
const ReactNative = require('react-native');
const ReadyStateEmittingImage = require('./override/ready-state-emitting-image');
const ReadyStateEmittingImageBackground = require('./override/ready-state-emitting-image-background');
const ReadyStateEmittingFastImage = require('./override/ready-state-emitting-fast-image');

function patchComponents() {
  // Monkey patch `Image`
  Object.defineProperty(ReactNative, 'Image', {
    configurable: true,
    enumerable: true,
    get: () => ReadyStateEmittingImage,
  });

  // Monkey patch `ImageBackground`
  Object.defineProperty(ReactNative, 'ImageBackground', {
    configurable: true,
    enumerable: true,
    get: () => ReadyStateEmittingImageBackground,
  });

  const FastImage = require('react-native-fast-image');
  FastImage.default = ReadyStateEmittingFastImage;
}

module.exports = patchComponents;
