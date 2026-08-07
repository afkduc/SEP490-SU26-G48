/**
 * VehicleBay entity - tuong ung bang `vehicle_bays`. La cau hinh (khoang nao
 * thuoc to truong nao, Quan ly chi nhanh set) - trang thai "dang lam xe gi"
 * suy ra tu repair_orders.bay_id (status='inprogress'), khong luu tren bang
 * nay nua.
 */
class VehicleBay {
  constructor(data = {}) {
    this.id = data.id ?? null;
    this.branchId = data.branchId ?? null;
    this.bayNumber = data.bayNumber ?? null;
    this.teamLeaderId = data.teamLeaderId ?? null;
    this.teamLeaderName = data.teamLeaderName ?? null;
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
      activeRepairOrderId: row.active_repair_order_id ?? null,
      activeVehicle: row.active_license_plate
        ? { licensePlate: row.active_license_plate, vehicleModel: row.active_vehicle_model }
        : null,
    });
  }
}

module.exports = VehicleBay;
