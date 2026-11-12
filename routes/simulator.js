import express from 'express';
import os from 'os';
import { readJsonFile, ADMIN_FILE } from '../lib/db.js';

/**
 * Twitch Viewer Bot Research Simulator Engine
 * 
 * NOTE: For private research, educational network testing, and concurrent
 * traffic simulation ONLY. All simulated traffic operates strictly within
 * the internal mock stream server (loopback).
 */

const router = express.Router();

function getAdminPassword() {
  const adminData = readJsonFile(ADMIN_FILE, null);
  if (adminData && adminData.password) {
    return adminData.password;
  }
  return process.env.ADMIN_PASSWORD || 'admin123';
}

function checkAdminAuth(req) {
  const token = (req.headers['x-admin-key'] || req.headers['authorization'] || '').replace(/^Bearer\s+/i, '').trim();
  return token === getAdminPassword();
}

function requireAdmin(req, res, next) {
  if (!checkAdminAuth(req)) {
    return res.status(401).json({ error: 'Unauthorized: Admin access required.' });
  }
  next();
}

// ==========================================
// SIMULATOR CORE ENGINE
// ==========================================
const REGIONS = [
  { name: 'US-East (N. Virginia)', code: 'us-east', basePing: 28, flag: '🇺🇸' },
  { name: 'EU-Central (Frankfurt)', code: 'eu-central', basePing: 45, flag: '🇩🇪' },
  { name: 'AP-Southeast (Singapore)', code: 'ap-southeast', basePing: 32, flag: '🇸🇬' },
  { name: 'AP-Northeast (Tokyo)', code: 'ap-northeast', basePing: 38, flag: '🇯🇵' },
  { name: 'SA-East (São Paulo)', code: 'sa-east', basePing: 85, flag: '🇧🇷' }
];

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0'
];

class SimulatorEngine {
  constructor() {
    this.status = 'IDLE'; // 'IDLE' | 'RUNNING' | 'PAUSED' | 'STOPPED'
    this.targetCount = 50;
    this.rampUpRate = 10; // clients added per tick
    this.heartbeatIntervalSec = 5;
    this.dropRatePct = 2; // simulated random disconnect %
    this.targetChannel = 'research_mock_channel';

    this.clients = new Map(); // id -> clientObj
    this.logs = []; // max 250 log entries
    this.maxLogs = 250;

    // Metrics counters
    this.metrics = {
      startTime: null,
      activeClients: 0,
      peakClients: 0,
      totalConnectionsAttempted: 0,
      successfulConnections: 0,
      failedConnections: 0,
      reconnectCount: 0,
      heartbeatsSent: 0,
      heartbeatsAcked: 0,
      avgLatencyMs: 0,
      minLatencyMs: 0,
      maxLatencyMs: 0,
      reqPerSec: 0,
      ackPerSec: 0,
      lastSecondReqs: 0,
      lastSecondAcks: 0
    };

    this.loopTimer = null;
    this.metricsTimer = null;
    this.ioRef = null;
  }

  setIo(io) {
    this.ioRef = io;
  }

  logEvent(type, message, level = 'info') {
    const entry = {
      id: Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      timestamp: new Date().toLocaleTimeString('id-ID', { hour12: false }),
      type, // 'NORMAL', 'SPIKE', 'DROP', 'RECONNECT', 'JITTER', 'SYSTEM'
      level, // 'info', 'warn', 'error', 'success'
      message
    };
    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }
  }

  start(config = {}) {
    if (this.status === 'RUNNING') {
      this.stop();
    }

    this.targetCount = Math.max(1, Math.min(1000, Number(config.count) || 50));
    this.rampUpRate = Math.max(1, Math.min(100, Number(config.rampUpRate) || 10));
    this.heartbeatIntervalSec = Math.max(2, Math.min(60, Number(config.heartbeatIntervalSec) || 5));
    this.dropRatePct = Math.max(0, Math.min(50, Number(config.dropRatePct) || 2));
    this.targetChannel = String(config.targetChannel || 'research_mock_channel').replace(/[^a-zA-Z0-9_-]/g, '');

    this.status = 'RUNNING';
    this.clients.clear();
    this.logs = [];

    this.metrics = {
      startTime: Date.now(),
      activeClients: 0,
      peakClients: 0,
      totalConnectionsAttempted: 0,
      successfulConnections: 0,
      failedConnections: 0,
      reconnectCount: 0,
      heartbeatsSent: 0,
      heartbeatsAcked: 0,
      avgLatencyMs: 0,
      minLatencyMs: 9999,
      maxLatencyMs: 0,
      reqPerSec: 0,
      ackPerSec: 0,
      lastSecondReqs: 0,
      lastSecondAcks: 0
    };

    this.logEvent('SYSTEM', `Simulasi dimulai: target ${this.targetCount} virtual viewer (Ramp-up: ${this.rampUpRate}/s, Heartbeat: ${this.heartbeatIntervalSec}s, Drop: ${this.dropRatePct}%)`, 'success');

    // Main simulation tick (runs every 1000ms)
    this.loopTimer = setInterval(() => this.tick(), 1000);

    // Throughput & Telemetry broadcast timer
    this.metricsTimer = setInterval(() => this.calculateThroughputAndBroadcast(), 1000);

    return this.getState();
  }

  pause() {
    if (this.status !== 'RUNNING') return this.getState();
    this.status = 'PAUSED';
    this.logEvent('SYSTEM', 'Simulasi dijeda oleh Administrator', 'warn');
    return this.getState();
  }

  resume() {
    if (this.status !== 'PAUSED') return this.getState();
    this.status = 'RUNNING';
    this.logEvent('SYSTEM', 'Simulasi dilanjutkan oleh Administrator', 'info');
    return this.getState();
  }

  stop() {
    if (this.loopTimer) clearInterval(this.loopTimer);
    if (this.metricsTimer) clearInterval(this.metricsTimer);
    this.loopTimer = null;
    this.metricsTimer = null;

    const previousCount = this.clients.size;
    this.status = 'STOPPED';
    this.clients.clear();
    this.metrics.activeClients = 0;
    this.logEvent('SYSTEM', `Simulasi dihentikan. Seluruh koneksi virtual (${previousCount} viewer) telah diputus bersih.`, 'warn');
    this.broadcastTelemetry();
    return this.getState();
  }

  tick() {
    if (this.status !== 'RUNNING') return;

    // 1. Ramp-Up Virtual Viewers towards targetCount
    const currentCount = this.clients.size;
    if (currentCount < this.targetCount) {
      const needed = Math.min(this.rampUpRate, this.targetCount - currentCount);
      for (let i = 0; i < needed; i++) {
        this.spawnClient();
      }

      // Anomaly detector: check for sudden spike
      if (needed >= 25) {
        this.logEvent('SPIKE', `[ANOMALY: SPIKE] Lonjakan koneksi simultan: +${needed} virtual client di-spawn dalam 1 detik!`, 'warn');
      }
    }

    // 2. Perform Heartbeat / Ping Cycle & Disconnect simulation
    let totalLatency = 0;
    let latencyCount = 0;

    const now = Date.now();
    for (const [id, client] of this.clients.entries()) {
      if (client.state === 'DISCONNECTED') {
        // Attempt reconnection backoff
        if (now - client.disconnectedAt > 3000) {
          client.state = 'CONNECTED';
          client.reconnects++;
          this.metrics.reconnectCount++;
          this.logEvent('RECONNECT', `Client #${client.index} (${client.region.code}) berhasil reconnect setelah drop`, 'info');
        }
        continue;
      }

      // Check random drop chance
      if (this.dropRatePct > 0 && Math.random() * 100 < (this.dropRatePct / this.heartbeatIntervalSec)) {
        client.state = 'DISCONNECTED';
        client.disconnectedAt = now;
        this.metrics.failedConnections++;
        this.logEvent('DROP', `[ANOMALY: DROP] Client #${client.index} mengalami packet drop / network disconnect tiruan`, 'warn');
        continue;
      }

      // Send simulated heartbeat ping
      if (now - client.lastPingTime >= this.heartbeatIntervalSec * 1000) {
        client.lastPingTime = now;
        this.metrics.heartbeatsSent++;
        this.metrics.lastSecondReqs++;

        // Calculate dynamic latency with simulated jitter
        const jitter = (Math.random() - 0.5) * 16;
        const currentPing = Math.max(10, Math.round(client.region.basePing + jitter + (Math.random() < 0.05 ? 120 : 0)));
        client.pingMs = currentPing;
        client.uptimeSec = Math.floor((now - client.connectedAt) / 1000);

        // Acknowledge heartbeat
        this.metrics.heartbeatsAcked++;
        this.metrics.lastSecondAcks++;

        totalLatency += currentPing;
        latencyCount++;

        if (currentPing > 150) {
          this.logEvent('JITTER', `[ANOMALY: JITTER] Client #${client.index} mengalami lonjakan latensi tinggi: ${currentPing} ms`, 'warn');
        }

        if (currentPing < this.metrics.minLatencyMs) this.metrics.minLatencyMs = currentPing;
        if (currentPing > this.metrics.maxLatencyMs) this.metrics.maxLatencyMs = currentPing;
      }
    }

    // Recalculate average latency
    if (latencyCount > 0) {
      const avg = Math.round(totalLatency / latencyCount);
      this.metrics.avgLatencyMs = avg;
    }

    // Update active clients counter
    let active = 0;
    for (const client of this.clients.values()) {
      if (client.state === 'CONNECTED') active++;
    }
    this.metrics.activeClients = active;
    if (active > this.metrics.peakClients) {
      this.metrics.peakClients = active;
    }
  }

  spawnClient() {
    const index = this.clients.size + 1;
    const region = REGIONS[Math.floor(Math.random() * REGIONS.length)];
    const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    const id = `viewer_${String(index).padStart(4, '0')}_${Math.random().toString(36).substring(2, 6)}`;

    const client = {
      id,
      index,
      region,
      userAgent: ua,
      ip: `10.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}`,
      state: 'CONNECTED',
      connectedAt: Date.now(),
      lastPingTime: Date.now() - Math.floor(Math.random() * 3000),
      pingMs: region.basePing,
      reconnects: 0,
      uptimeSec: 0
    };

    this.clients.set(id, client);
    this.metrics.totalConnectionsAttempted++;
    this.metrics.successfulConnections++;
  }

  dropClient(clientId) {
    if (this.clients.has(clientId)) {
      const client = this.clients.get(clientId);
      client.state = 'DISCONNECTED';
      client.disconnectedAt = Date.now();
      this.metrics.failedConnections++;
      this.logEvent('DROP', `Client #${client.index} (${client.id}) diputus paksa secara manual via Admin`, 'warn');
      return true;
    }
    return false;
  }

  calculateThroughputAndBroadcast() {
    this.metrics.reqPerSec = this.metrics.lastSecondReqs;
    this.metrics.ackPerSec = this.metrics.lastSecondAcks;
    this.metrics.lastSecondReqs = 0;
    this.metrics.lastSecondAcks = 0;

    this.broadcastTelemetry();
  }

  broadcastTelemetry() {
    if (this.ioRef) {
      const payload = this.getState();
      this.ioRef.emit('admin:simulator:telemetry', payload);
    }
  }

  getState() {
    const mem = process.memoryUsage();
    const systemInfo = {
      nodeRssMb: Math.round(mem.rss / 1024 / 1024),
      nodeHeapUsedMb: Math.round(mem.heapUsed / 1024 / 1024),
      nodeHeapTotalMb: Math.round(mem.heapTotal / 1024 / 1024),
      osFreeMemMb: Math.round(os.freemem() / 1024 / 1024),
      osTotalMemMb: Math.round(os.totalmem() / 1024 / 1024),
      osLoadAvg: os.loadavg ? os.loadavg()[0].toFixed(2) : '0.00'
    };

    // Return client samples (up to 60 for the UI table)
    const clientSamples = [];
    let count = 0;
    for (const c of this.clients.values()) {
      if (count++ >= 60) break;
      clientSamples.push({
        id: c.id,
        index: c.index,
        flag: c.region.flag,
        regionName: c.region.name,
        ip: c.ip,
        state: c.state,
        pingMs: c.pingMs,
        uptimeSec: c.uptimeSec,
        reconnects: c.reconnects
      });
    }

    return {
      status: this.status,
      config: {
        targetCount: this.targetCount,
        rampUpRate: this.rampUpRate,
        heartbeatIntervalSec: this.heartbeatIntervalSec,
        dropRatePct: this.dropRatePct,
        targetChannel: this.targetChannel
      },
      metrics: {
        ...this.metrics,
        minLatencyMs: this.metrics.minLatencyMs === 9999 ? 0 : this.metrics.minLatencyMs
      },
      system: systemInfo,
      activeClientCount: this.clients.size,
      clientSamples,
      recentLogs: this.logs.slice(0, 40)
    };
  }
}

const simulatorEngine = new SimulatorEngine();

export function setSimulatorIo(io) {
  simulatorEngine.setIo(io);
}

// ==========================================
// REST ENDPOINTS FOR ADMIN SIMULATOR
// ==========================================

// Mock streaming private test endpoint (loopback)
router.get('/simulator/mock-stream', (req, res) => {
  res.json({
    status: 'online',
    type: 'private_research_test_environment',
    channel: req.query.channel || 'research_mock_channel',
    serverTimestamp: Date.now(),
    currentSimulatedViewers: simulatorEngine.clients.size
  });
});

// Admin Control Endpoints
router.get('/admin/simulator/status', requireAdmin, (req, res) => {
  res.json(simulatorEngine.getState());
});

router.post('/admin/simulator/start', requireAdmin, (req, res) => {
  const result = simulatorEngine.start(req.body);
  res.json({ success: true, state: result });
});

router.post('/admin/simulator/pause', requireAdmin, (req, res) => {
  const result = simulatorEngine.pause();
  res.json({ success: true, state: result });
});

router.post('/admin/simulator/resume', requireAdmin, (req, res) => {
  const result = simulatorEngine.resume();
  res.json({ success: true, state: result });
});

router.post('/admin/simulator/stop', requireAdmin, (req, res) => {
  const result = simulatorEngine.stop();
  res.json({ success: true, state: result });
});

router.post('/admin/simulator/drop-client', requireAdmin, (req, res) => {
  const { clientId } = req.body || {};
  const dropped = simulatorEngine.dropClient(clientId);
  res.json({ success: dropped });
});

router.get('/admin/simulator/logs', requireAdmin, (req, res) => {
  res.json({ logs: simulatorEngine.logs });
});

router.post('/admin/simulator/clear-logs', requireAdmin, (req, res) => {
  simulatorEngine.logs = [];
  res.json({ success: true });
});

export default router;
