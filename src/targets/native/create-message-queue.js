const { NativeError } = require('../../errors');

const createMessageQueue = nativeErrorType => {
  const queue = [];
  const listeners = [];

  const addListener = (type, condition, callback) => {
    listeners.push({ type, condition, callback });
  };

  const clearListeners = () => {
    listeners.splice(0, listeners.length);
  };

  const waitFor = (type, condition) =>
    new Promise((resolve, reject) => {
      queue.push({ type, condition, resolve, reject });
    });

  const receiveMessage = (type, args) => {
    // console.log("receiveMessage "+ type+" "+ args);
    const isError = type === nativeErrorType;

    for (let i = 0; i < listeners.length; i++) {
      const listener = listeners[i];
      if (
        (isError || listener.type === type) &&
        (!listener.condition || listener.condition(...args))
      ) {
        listener.callback(args[0]);
      }
    }

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      if (
        (isError || item.type === type) &&
        (!item.condition || item.condition(...args))
      ) {
        if (isError) {
          const { error, isFatal } = args[0];
          item.reject(new NativeError(error.message, error.stack, isFatal));
        } else {
          item.resolve(args[0]);
        }
        queue.splice(i, 1);
        break;
      }
    }
  };

  const rejectAll = err => {
    queue.forEach(item => item.reject(err));
    queue.splice(0, queue.length);
  };

  const rejectAllOfType = (type, err) => {
    for (let i = queue.length - 1; i >= 0; i--) {
      const item = queue[i];
      item.reject(err);
      queue.splice(i, 1);
    }
  };

  return {
    waitFor,
    receiveMessage,
    rejectAll,
    rejectAllOfType,
    addListener,
    clearListeners,
  };
};

module.exports = createMessageQueue;
