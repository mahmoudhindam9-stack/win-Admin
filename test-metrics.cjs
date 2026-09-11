const { app } = require('electron');
app.on('ready', async () => {
  try {
    const si = require('systeminformation');
    const os = require('os');
    const cpu = await si.cpu();
    const mem = await si.mem();
    console.log("Success! Mem total:", mem.total);
  } catch (err) {
    console.error("Error:", err);
  }
  app.quit();
});
