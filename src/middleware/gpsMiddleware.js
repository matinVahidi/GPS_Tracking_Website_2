// src/middleware/gpsMiddleware.js
import { getLastNGpsRecords } from '../models/device.js';

/**
 * Convert degrees to radians
 */
const deg2rad = (deg) => {
  return deg * (Math.PI / 180);
};

/**
 * Convert radians to degrees
 */
const rad2deg = (rad) => {
  return rad * (180 / Math.PI);
};

/**
 * Calculate the distance between two GPS points in kilometers using the Haversine formula
 * @param {number} lat1 - Latitude of the first point
 * @param {number} lon1 - Longitude of the first point
 * @param {number} lat2 - Latitude of the second point
 * @param {number} lon2 - Longitude of the second point
 * @returns {number} - The distance in kilometers
 */
const haversine = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

/**
 * Calculate speed (km/h) between the last two GPS records
 * @param {object} lastRecord - The most recent GPS record
 * @param {object} secondLastRecord - The second most recent GPS record
 * @returns {number|null} - The speed in km/h or null if insufficient data
 */
const calculateSpeed = (lastRecord, secondLastRecord) => {
  if (!lastRecord || !secondLastRecord) return null;

  const distance = haversine(
    secondLastRecord.latitude,
    secondLastRecord.longitude,
    lastRecord.latitude,
    lastRecord.longitude
  );

  const timeDiff = (new Date(lastRecord.ts) - new Date(secondLastRecord.ts)) / 1000 / 60 / 60; // in hours

  if (timeDiff <= 0) return 0; // Avoid division by zero

  return distance / timeDiff; // Speed in km/h
};

/**
 * Calculate the heading (bearing) between the last two GPS records
 * @param {object} lastRecord - The most recent GPS record
 * @param {object} secondLastRecord - The second most recent GPS record
 * @returns {number|null} - The heading in degrees or null if insufficient data
 */
const calculateHeading = (lastRecord, secondLastRecord) => {
  if (!lastRecord || !secondLastRecord) return null;

  const lat1 = deg2rad(secondLastRecord.latitude);
  const lon1 = deg2rad(secondLastRecord.longitude);
  const lat2 = deg2rad(lastRecord.latitude);
  const lon2 = deg2rad(lastRecord.longitude);

  const dLon = lon2 - lon1;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const initialBearing = Math.atan2(y, x);

  // Convert to degrees and normalize between 0 and 360
  const initialBearingDeg = (rad2deg(initialBearing) + 360) % 360;
  return initialBearingDeg;
};

/**
 * Middleware to fill missing speed and heading data
 * This middleware will calculate missing data for speed and heading based on the last two GPS records of the device
 */
export const fillMissingData = async (req, res, next) => {
  try {
    const gpsRecord = req.body;

    if (gpsRecord.speed == null || gpsRecord.heading == null) {
      const deviceId = gpsRecord.deviceId;

      if (!deviceId) {
        return res.status(400).json({ message: 'Device ID is required' });
      }

      // Get the last 2 GPS records for this device
      const recentRecords = await getLastNGpsRecords(deviceId, 2);
      
      if (recentRecords.length > 1) {
        const lastRecord = recentRecords[0];
        const secondLastRecord = recentRecords[1];

        if (gpsRecord.speed == null) {
          gpsRecord.speed = calculateSpeed(lastRecord, secondLastRecord);
        }

        if (gpsRecord.heading == null) {
          gpsRecord.heading = calculateHeading(lastRecord, secondLastRecord);
        }
      }
    }

    next();
  } catch (error) {
    console.error('Error in fillMissingData middleware:', error);
    res.status(500).json({ message: 'Error processing GPS data', error: error.message });
  }
};