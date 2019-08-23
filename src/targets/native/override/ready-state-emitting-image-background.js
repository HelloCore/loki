/* eslint-disable react/destructuring-assignment */
const React = require('react');
const ImageBackground = require('react-native/Libraries/Image/ImageBackground');
const hoistNonReactStatics = require('hoist-non-react-statics');
const { registerPendingPromise } = require('../../ready-state-manager');

const IMAGE_LOAD_TIMEOUT = 20000;

class ReadyStateEmittingImageBackground extends React.Component {
  componentWillMount() {
    if (this.props.source) {
      this.isCompleted = false;

      registerPendingPromise(
        new Promise((resolve, reject) => {
          this.resolve = value => {
            if (this.isCompleted === false) {
              this.isCompleted = true;
            }
            resolve(value);
            clearTimeout(this.timer);
          };
          this.timer = setTimeout(() => {
            const url = this.props.source.uri;
            const message = `ImageBackground "${url}" failed to load within ${IMAGE_LOAD_TIMEOUT}ms`;
            reject(new Error(message));
          }, IMAGE_LOAD_TIMEOUT);
        })
      );
    }
  }

  componentWillUnmount() {
    if (this.props.source) {
      if (this.resolve) {
        this.resolve();
        this.resolve = null;
      }
      clearTimeout(this.timer);
    }
  }

  setNativeProps = (...args) => {
    this.ref.setNativeProps(...args);
  };

  handleRef = ref => {
    this.ref = ref;
  };

  handleLoadEnd = e => {
    if (this.resolve) {
      this.resolve();
      this.resolve = null;
    }
    const { onLoadEnd } = this.props;
    if (onLoadEnd) {
      onLoadEnd(e);
    }
  };

  render() {
    return (
      <ImageBackground
        {...this.props}
        ref={this.handleRef}
        fadeDuration={0}
        onLoadEnd={this.handleLoadEnd}
      />
    );
  }
}

hoistNonReactStatics(ReadyStateEmittingImageBackground, ImageBackground);

module.exports = ReadyStateEmittingImageBackground;
