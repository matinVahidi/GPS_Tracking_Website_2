// src/routes/tracking.js
import express from 'express';
import { authenticateJWT} from '../middleware/authMiddleware.js';
import { getUserById } from '../models/user.js';
import { 
  getDeviceById,
  getLastGpsRecord,
  addGpsRecord,
  updateDeviceStatus,
  listUserVisibleDevices
} from '../models/device.js';
import { fillMissingData } from '../middleware/gpsMiddleware.js';

const router = express.Router();
router.use(express.urlencoded({ extended: true }));

// Map<deviceId, Set<ServerResponse>> to support multiple listeners per device
const sseClients = new Map();

// Helper function to safely serialize objects with BigInt values
function safeStringify(obj) {
  return JSON.stringify(obj, (key, value) => 
    typeof value === 'bigint' ? value.toString() : value
  );
}

/**
 * GET /api/track/stream
 * SSE stream for a single device
 */
router.post('/stream', authenticateJWT, async (req, res) => {
  try {
    const { deviceId } = req.body;
    const userId = req.user.userId;

    if (!deviceId) {
      return res.status(400).json({ message: 'Device ID is required' });
    }

    const [device, user] = await Promise.all([
      getDeviceById(deviceId),
      getUserById(userId)
    ]);

    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    if (device.userId !== userId && user.visibleDivices.filter((d) => d.id === deviceId).length === 0) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    if (!sseClients.has(deviceId)) {
      sseClients.set(deviceId, new Set());
    }
    sseClients.get(deviceId).add(res);

    const lastRecord = await getLastGpsRecord(deviceId);
    if (lastRecord) {
      const devName = device.name;
      const status = device.status;
      const connected = device.connected;
      // Use safeStringify to handle BigInt values
      res.write(`data: ${safeStringify({ deviceId, devName, status, connected,gpsRecord: lastRecord })}\n\n`);
    }

    req.on('close', () => {
      const clients = sseClients.get(deviceId);
      if (clients) {
        clients.delete(res);
        if (clients.size === 0) {
          sseClients.delete(deviceId);
        }
      }
    });

  } catch (error) {
    console.error('SSE stream error:', error);
    // Check if headers have already been sent before trying to send error response
    if (!res.headersSent) {
      res.status(500).json({ message: 'Server error' });
    }
  }
});

/**
 * GET /api/track/devices
 * Returns visible devices for the authenticated user
 */
router.get('/devices', authenticateJWT, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await getUserById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const visibleDevices = await listUserVisibleDevices(userId);
    
    // Use safeStringify for console.log as well to avoid BigInt issues

    // Use safeStringify for the response too
    res.status(200).json(JSON.parse(safeStringify(visibleDevices)));
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Error fetching devices', error: error.message });
  }
});

/**
 * POST /api/track/update
 * Receives GPS updates from devices
 */
router.post('/update', fillMissingData, async (req, res) => {
  try {
    const {
      deviceId,
      latitude,
      longitude,
      timestamp = new Date(),
      accuracy,
      altitude,
      speed,
      heading,
      battery,
      status
    } = req.body;

    if (!deviceId || latitude == null || longitude == null || status == null) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const device = await getDeviceById(deviceId);
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    const gpsRecord = await addGpsRecord({
      deviceId,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      ts: timestamp,
      accuracy: accuracy != null ? parseFloat(accuracy) : null,
      altitude: altitude != null ? parseFloat(altitude) : null,
      speed: speed != null ? parseFloat(speed) : null,
      heading: heading != null ? parseFloat(heading) : null,
      battery: battery != null ? parseFloat(battery) : null
    });

    await updateDeviceStatus(deviceId, {
      status,
      connected: true,
      lastReceived: new Date()
    });

    // Notify SSE clients
    const clients = sseClients.get(deviceId);
    if (clients?.size) {
      const devName = device.name;
      const status = device.status;
      const connected = device.connected;
      // Use safeStringify to handle BigInt values
      // Use safeStringify for SSE payload
      const payload = `data: ${safeStringify({ deviceId, devName, status, connected, gpsRecord: gpsRecord })}\n\n`;
      for (const client of clients) {
        client.write(payload);
      }
    }

    res.status(200).json({ 
      message: 'Location updated' 
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ 
      message: 'Error updating location', 
      error: error.message 
    });
  }
});

export default router;