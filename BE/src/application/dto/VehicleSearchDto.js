function toVehicleSearchDto(row) {
  return {
    customerId: row.customer_id,
    fullName: row.full_name,
    phone: row.phone,
    address: row.address,
    taxCode: row.tax_code,
    cccd: row.cccd,
    email: row.email,
    contactName: row.contact_name,
    contactPhone: row.contact_phone,
    vehicleId: row.vehicle_id,
    licensePlate: row.license_plate,
    vehicleModel: row.vehicle_model_text,
    frameNumber: row.frame_number,
    engineNumber: row.engine_number,
    currentKm: row.current_km,
    // Doi xe that trong catalog (vehicles.model_id) - dung de loc goi bao
    // duong dung doi xe khi CVDV lap phieu, xem RepairSettlementPage.
    modelId: row.model_id ?? null,
    purchaseDate: row.purchase_date,
    warrantyEndDate: row.warranty_end_date,
    warrantyKmLimit: row.warranty_km_limit,
  };
}

module.exports = { toVehicleSearchDto };
