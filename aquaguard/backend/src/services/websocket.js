const logger = require('../utils/logger');
let _wss = null;
const clients = new Set();

function initWebSocket(wss) {
  _wss = wss;
  wss.on('connection', (ws, req) => {
    clients.add(ws);
    logger.info(`WS connect  (total: ${clients.size})`);
    ws.send(JSON.stringify({ type: 'CONNECTED', payload: { clients: clients.size } }));

    ws.on('message', raw => {
      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'PING') ws.send(JSON.stringify({ type: 'PONG', ts: Date.now() }));
      } catch {}
    });
    ws.on('close',  () => { clients.delete(ws); logger.info(`WS close (total: ${clients.size})`); });
    ws.on('error',  () => clients.delete(ws));
  });
}

function broadcast(obj) {
  if (!_wss) return;
  const payload = JSON.stringify(obj);
  clients.forEach(ws => {
    if (ws.readyState === 1) { try { ws.send(payload); } catch { clients.delete(ws); } }
  });
}

module.exports = { initWebSocket, broadcast, clients };
