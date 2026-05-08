const devices = [];

function initDevices(){
  // seed five devices
  const names = ['phone-alice','phone-stranger1','phone-stranger2','phone-stranger3','phone-bridge'];
  for(let i=0;i<names.length;i++){
    devices.push({ id:names[i], cache:[], internet: names[i]==='phone-bridge' });
  }
}

function injectPacketToDevice(deviceId, packet){
  const dev = devices.find(d=>d.id===deviceId);
  if(!dev) throw new Error('NO_DEVICE');
  // dedupe by packetId
  if(dev.cache.find(p=>p.packetId===packet.packetId)) return;
  dev.cache.push(Object.assign({},packet));
}

function gossipRound(){
  // snapshot-style copy: each device copies its current cache to neighbors
  const snapshot = devices.map(d=>({id:d.id, cache:d.cache.map(c=>({...c}))}));
  let transfers = 0;
  for(const d of devices){
    for(const s of snapshot){
      if(s.id === d.id) continue;
      // copy items, decrement TTL
      for(const p of s.cache){
        const copy = {...p, ttl: p.ttl - 1, hopCount: (p.hopCount||0)+1 };
        if(copy.ttl <= 0) continue;
        // dedupe by packetId
        if(!d.cache.find(x=>x.packetId===copy.packetId)) {
          d.cache.push(copy);
          transfers += 1;
        }
      }
    }
  }

  const deviceCounts = {};
  for (const d of devices) {
    deviceCounts[d.id] = d.cache.length;
  }

  return { transfers, deviceCounts };
}

function flushDevice(deviceId){
  const dev = devices.find(d=>d.id===deviceId);
  if(!dev) throw new Error('NO_DEVICE');
  // return a copy of packets without removing them from cache (for idempotency demo)
  return dev.cache.map(p => ({...p}));
}

function resetMesh(){
  devices.length = 0;
  initDevices();
}

function getState(){
  return devices.map(d=>({
    deviceId:d.id,
    hasInternet:d.internet,
    packetCount:d.cache.length,
    packetIds:d.cache.map(p=>p.packetId.slice(0,8))
  }));
}

initDevices();

module.exports = { initDevices, injectPacketToDevice, gossipRound, flushDevice, resetMesh, getState };
