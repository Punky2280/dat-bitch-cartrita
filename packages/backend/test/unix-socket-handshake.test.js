import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import { createUnixSocketTransport } from '../src/mcp/core/transport/unix-socket.ts';
import { MessageTypes } from '../src/mcp/core/schema/mcp-types.js';

const SOCKET_PATH = '/tmp/mcp-handshake-test.sock';

// Basic handshake/heartbeat test: start server, connect client, exchange one heartbeat frame implicitly

describe('Unix Socket Transport Handshake & Heartbeat', () => {
  let serverTransport;
  let clientTransport;

  beforeAll(async () => {
    if (fs.existsSync(SOCKET_PATH)) fs.unlinkSync(SOCKET_PATH);
    serverTransport = createUnixSocketTransport({ socketPath: SOCKET_PATH, heartbeatInterval: 500, connectionTimeout: 2000 });
    await serverTransport.startServer();
    clientTransport = createUnixSocketTransport({ socketPath: SOCKET_PATH, heartbeatInterval: 500, connectionTimeout: 2000 });
    await clientTransport.connect();
  }, 10000);

  afterAll(async () => {
    await clientTransport.shutdown();
    await serverTransport.shutdown();
    if (fs.existsSync(SOCKET_PATH)) fs.unlinkSync(SOCKET_PATH);
  });

  it('establishes client-server connection', async () => {
    const stats = serverTransport.getConnectionStats();
    expect(stats.totalConnections).toBeGreaterThan(0);
  });

  it('receives at least one heartbeat within interval', async () => {
    let heartbeatCount = 0;
    serverTransport.on('message', (msg) => {
      if (msg.messageType === MessageTypes.HEARTBEAT) heartbeatCount++;
    });
    await new Promise(r => setTimeout(r, 1200));
    const stats = serverTransport.getConnectionStats();
    const now = Date.now();
    const recent = stats.connections.some(c => now - c.lastPing < 2000);
    expect(recent).toBe(true);
    expect(heartbeatCount).toBeGreaterThan(0);
  });
});
