const { v4: uuidv4 } = require('uuid');

const SENSOR_LOCATIONS = [
  { id: 'S001', name: 'Narmada River Station',    lat: 22.7196, lng: 75.8577, city: 'Bhopal',     region: 'MP' },
  { id: 'S002', name: 'Yamuna Treatment Plant',   lat: 28.6139, lng: 77.2090, city: 'Delhi',      region: 'DL' },
  { id: 'S003', name: 'Godavari Basin Monitor',   lat: 17.3850, lng: 78.4867, city: 'Hyderabad',  region: 'TS' },
  { id: 'S004', name: 'Brahmaputra Flood Watch',  lat: 26.1445, lng: 91.7362, city: 'Guwahati',   region: 'AS' },
  { id: 'S005', name: 'Cauvery Delta Station',    lat: 10.7905, lng: 79.8383, city: 'Thanjavur',  region: 'TN' },
  { id: 'S006', name: 'Sabarmati Urban Monitor',  lat: 23.0225, lng: 72.5714, city: 'Ahmedabad',  region: 'GJ' },
  { id: 'S007', name: 'Ganga Rishikesh Node',     lat: 30.0869, lng: 78.2676, city: 'Rishikesh',  region: 'UK' },
  { id: 'S008', name: 'Krishna River Checkpoint', lat: 16.5062, lng: 80.6480, city: 'Vijayawada', region: 'AP' },
];

const store = {
  sensors:  new Map(),
  readings: [],       // ring buffer, max 1000
  alerts:   [],       // latest 200
  MAX_READINGS: 1000,
  MAX_ALERTS:   200,
};

SENSOR_LOCATIONS.forEach(loc => {
  store.sensors.set(loc.id, {
    ...loc,
    status:       'online',
    lastSeen:     new Date().toISOString(),
    batteryLevel: 85 + Math.random() * 15,
    firmware:     '2.4.1',
  });
});

const pushReading = (r) => {
  store.readings.push(r);
  if (store.readings.length > store.MAX_READINGS) store.readings.shift();
};

const pushAlert = (a) => {
  store.alerts.unshift({ id: uuidv4(), createdAt: new Date().toISOString(), resolved: false, ...a });
  if (store.alerts.length > store.MAX_ALERTS) store.alerts.pop();
};

const latestBySensor = () => {
  const map = {};
  store.readings.forEach(r => { map[r.sensorId] = r; });
  return map;
};

module.exports = { store, pushReading, pushAlert, latestBySensor, SENSOR_LOCATIONS };
