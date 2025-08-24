// src/intervals/deviceConnectionCheck.js
import { getAllDevices, updateDeviceConnectionStatus } from '../models/device.js';

// Configuration
const CONNECTION_TIMEOUT_MINUTES = 10; // 10 minutes timeout
const CHECK_INTERVAL_MINUTES = 5; // Check every 5 minutes

/**
 * Checks and updates connection status for all devices
 */
async function checkAllDevicesConnection() {
  try {
    const devices = await getAllDevices();
    const now = new Date();
    const timeoutThreshold = new Date(now.getTime() - CONNECTION_TIMEOUT_MINUTES * 60 * 1000);

    const updatePromises = devices.map(async (device) => {
      const lastReceived = device.lastReceived ? new Date(device.lastReceived) : null;
      const isConnected = lastReceived && lastReceived >= timeoutThreshold;
      
      if (device.connected !== isConnected) {
        await updateDeviceConnectionStatus(device.id, isConnected);
      }
    });

    await Promise.all(updatePromises);
  } catch (error) {
  }
}

// Start periodic checking
setInterval(checkAllDevicesConnection, CHECK_INTERVAL_MINUTES * 60 * 1000);

// Initial check when server starts
checkAllDevicesConnection().catch(error => {
  
});