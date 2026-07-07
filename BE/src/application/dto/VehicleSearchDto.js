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
    purchaseDate: row.purchase_date,
  };
}

module.exports = { toVehicleSearchDto };
