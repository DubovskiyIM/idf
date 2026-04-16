const { EventEmitter } = require("events");
const chokidar = require("chokidar");

function createFileWatcher(dir) {
  const emitter = new EventEmitter();
  const watcher = chokidar.watch(dir, {
    ignored: /node_modules|\.git|dist/,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
  });
  watcher.on("change", (p) => emitter.emit("change", { path: p, at: Date.now() }));
  watcher.on("add", (p) => emitter.emit("change", { path: p, at: Date.now(), added: true }));
  watcher.on("unlink", (p) => emitter.emit("change", { path: p, at: Date.now(), removed: true }));
  emitter.close = () => watcher.close();
  return emitter;
}

module.exports = { createFileWatcher };
