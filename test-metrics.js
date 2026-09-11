const { app, ipcMain } = require('electron');
const si = require('systeminformation');
const os = require('os');

(async () => {
  // Just simulate the get-system-metrics block
  try {
        const mem = await si.mem();
        const cpu = await si.cpu();
        const totalMemBytes = os.totalmem();
        const availMemBytes = os.freemem(); 
        const inUseBytes = Math.max(0, totalMemBytes - availMemBytes);
        console.log("Success! inUseBytes:", inUseBytes);
  } catch (err) {
    console.error("Metrics error:", err);
  }
})();
