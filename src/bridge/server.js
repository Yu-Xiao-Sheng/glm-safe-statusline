const fs = require('node:fs');
const net = require('node:net');

function startBridgeServer(options) {
  const { socketConfig, state } = options;

  return new Promise((resolve, reject) => {
    const server = net.createServer((socket) => {
      let buffer = '';

      socket.setEncoding('utf8');
      socket.on('data', (chunk) => {
        buffer += chunk;

        while (buffer.includes('\n')) {
          const newlineIndex = buffer.indexOf('\n');
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);

          if (!line) {
            continue;
          }

          let message;
          try {
            message = JSON.parse(line);
          } catch {
            socket.write(JSON.stringify({ error: 'invalid_json' }) + '\n');
            continue;
          }

          if (message.type === 'get_snapshot') {
            socket.write(JSON.stringify(state.getSnapshot()) + '\n');
            continue;
          }

          socket.write(JSON.stringify({ error: 'unsupported_request' }) + '\n');
        }
      });
    });

    server.on('error', reject);

    function finish(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve({
        close() {
          return new Promise((closeResolve, closeReject) => {
            server.close((closeError) => {
              if (socketConfig.mode === 'unix' && socketConfig.socketPath) {
                fs.rmSync(socketConfig.socketPath, { force: true });
              }

              if (closeError) {
                closeReject(closeError);
                return;
              }

              closeResolve();
            });
          });
        },
      });
    }

    if (socketConfig.mode === 'unix') {
      fs.rmSync(socketConfig.socketPath, { force: true });
      server.listen(socketConfig.socketPath, (error) => {
        if (!error) {
          fs.chmodSync(socketConfig.socketPath, 0o600);
        }
        finish(error);
      });
      return;
    }

    server.listen(socketConfig.port, socketConfig.host, finish);
  });
}

module.exports = {
  startBridgeServer,
};
