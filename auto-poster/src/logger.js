function timestamp() {
  return new Date().toISOString();
}

module.exports = {
  info: (...args) => console.log(`[${timestamp()}] [info]`, ...args),
  warn: (...args) => console.warn(`[${timestamp()}] [warn]`, ...args),
  error: (...args) => console.error(`[${timestamp()}] [error]`, ...args),
};
