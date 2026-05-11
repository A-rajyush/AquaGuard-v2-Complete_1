import { useEffect, useRef, useState, useCallback } from 'react';
import { openWebSocket } from '../services/api';

export default function useWebSocket(onMessage) {
  const wsRef   = useRef(null);
  const retryRef = useRef(null);
  const [connected, setConnected] = useState(false);

  const connect = useCallback(() => {
    try {
      const ws = openWebSocket(msg => {
        if (msg.type === 'CONNECTED') setConnected(true);
        onMessage(msg);
      });
      ws.onopen  = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        retryRef.current = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();
      wsRef.current = ws;
    } catch {
      retryRef.current = setTimeout(connect, 5000);
    }
  }, [onMessage]);

  useEffect(() => {
    connect();
    return () => { wsRef.current?.close(); clearTimeout(retryRef.current); };
  }, [connect]);

  return connected;
}
