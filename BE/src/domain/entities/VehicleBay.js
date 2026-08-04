/**
 * VehicleBay entity - tuong ung bang `vehicle_bays`. Vua la cau hinh (khoang
 * nao thuoc to truong nao, Quan ly chi nhanh set) vua la trang thai song
 * (tablet nao dang "ngoi" khoang nay, dang lam xe gi neu co).
 */
class VehicleBay {
  constructor(data = {}) {
    this.id = data.id ?? null;
    this.branchId = data.branchId ?? null;
    this.bayNumber = data.bayNumber ?? null;
    this.teamLeaderId = data.teamLeaderId ?? null;
    this.teamLeaderName = data.teamLeaderName ?? null;
    this.occupiedByDeviceId = data.occupiedByDeviceId ?? null;
    this.occupiedByUserId = data.occupiedByUserId ?? null;
    this.occupiedAt = data.occupiedAt ?? null;
    this.activeRepairOrderId = data.activeRepairOrderId ?? null;
    this.activeVehicle = data.activeVehicle ?? null; // { licensePlate, vehicleModel } neu dang co job
  }

  static fromPersistence(row) {
    if (!row) return null;
    return new VehicleBay({
      id: row.id,
      branchId: row.branch_id,
      bayNumber: row.bay_number,
      teamLeaderId: row.team_leader_id,
      teamLeaderName: row.team_leader_name,
      occupiedByDeviceId: row.occupied_by_device_id,
      occupiedByUserId: row.occupied_by_user_id,
      occupiedAt: row.occupied_at,
      activeRepairOrderId: row.active_repair_order_id ?? null,
      activeVehicle: row.active_license_plate
        ? { licensePlate: row.active_license_plate, vehicleModel: row.active_vehicle_model }
        : null,
    });
  }
}

module.exports = VehicleBay;
