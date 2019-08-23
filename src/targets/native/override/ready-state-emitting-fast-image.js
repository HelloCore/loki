/* eslint-disable react/destructuring-assignment */
const React = require('react');
const FastImageDefault = require('react-native-fast-image').default;

const { registerPendingPromise } = require('../ready-state-manager');

const IMAGE_LOAD_TIMEOUT = 20000;

class ReadyStateEmittingFastImage extends React.Component {
  componentWillMount() {
    if (this.props.source && this.props.source.uri) {
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
            const message = `FastImage "${url}" failed to load within ${IMAGE_LOAD_TIMEOUT}ms`;
            reject(new Error(message));
          }, IMAGE_LOAD_TIMEOUT);
        })
      );
    }
  }

  componentWillUnmount() {
    if (this.props.source && this.props.source.uri) {
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
      <FastImageDefault
        {...this.props}
        ref={this.handleRef}
        onLoadEnd={this.handleLoadEnd}
      />
    );
  }
}

ReadyStateEmittingFastImage.cacheControl = FastImageDefault.cacheControl;
ReadyStateEmittingFastImage.defaultProps = FastImageDefault.defaultProps;
ReadyStateEmittingFastImage.preload = FastImageDefault.preload;
ReadyStateEmittingFastImage.priority = FastImageDefault.priority;
ReadyStateEmittingFastImage.propTypes = FastImageDefault.propTypes;
ReadyStateEmittingFastImage.resizeMode = FastImageDefault.resizeMode;

module.exports = ReadyStateEmittingFastImage;
