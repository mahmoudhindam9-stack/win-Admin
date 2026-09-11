const os = require('os');
const si = require('systeminformation');
(async () => {
  const mem = await si.mem();
  console.log("os.freemem:", os.freemem() / 1e9);
  console.log("os.totalmem:", os.totalmem() / 1e9);
  console.log("si.mem.available:", mem.available / 1e9);
  console.log("si.mem.free:", mem.free / 1e9);
  console.log("si.mem.used:", mem.used / 1e9);
})();
