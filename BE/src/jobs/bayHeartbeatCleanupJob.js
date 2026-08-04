/**
 * Job tu dong nha cac khoang xe (vehicle_bays) khong con heartbeat - tablet
 * mat dien/rot mang/dong tab ma khong bam "Dang xuat" (xem TeamLeaderKiosk.jsx
 * goi POST /vehicle-bays/:id/heartbeat dinh ky) se tu bi coi la "mat ket noi"
 * sau THRESHOLD_SECONDS khong bao con song, khong can thao tac gi them.
 *
 * Chay ngay khi server khoi dong va lap lai moi CHECK_INTERVAL_MS.
 */
const VehicleBayRepositoryImpl = require('../infrastructure/repositories/VehicleBayRepositoryImpl');
const { emitRepairOrderEvent } = require('../application/events/RepairOrderEvents');

const THRESHOLD_SECONDS = parseInt(process.env.BAY_HEARTBEAT_STALE_SECONDS || '15', 10);
const CHECK_INTERVAL_MS = 5 * 1000;

const vehicleBayRepository = new VehicleBayRepositoryImpl();

async function releaseStaleBays() {
  try {
    const released = await vehicleBayRepository.releaseStale(THRESHOLD_SECONDS);
    if (released.length === 0) return;

    console.log(`[bayHeartbeatJob] Released ${released.length} stale bay(s) (no heartbeat >= ${THRESHOLD_SECONDS}s)`);
    for (const bay of released) {
      emitRepairOrderEvent(bay.branchId, 'bay-released', { bayId: bay.id });
    }
  } catch (err) {
    console.error('[bayHeartbeatJob] releaseStaleBays failed:', err && err.message ? err.message : err);
  }
}

let timer = null;

function start() {
  setImmediate(releaseStaleBays);
  timer = setInterval(releaseStaleBays, CHECK_INTERVAL_MS);
  console.log(`[bayHeartbeatJob] Started - check every ${CHECK_INTERVAL_MS / 1000}s, stale threshold = ${THRESHOLD_SECONDS}s (no heartbeat)`);
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = { start, stop, releaseStaleBays };
