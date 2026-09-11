/**
 * ServiceRequest - yeu cau tu van gui tu form "Lien he" cua landing page.
 * Tuong ung bang `service_requests`, kem join branches/users de tra ve du du lieu.
 */
class ServiceRequest {
  constructor(data = {}) {
    this.id = data.id ?? null;
    this.fullName = data.fullName ?? null;
    this.gender = data.gender ?? null;
    this.phone = data.phone ?? null;
    this.email = data.email ?? null;
    this.address = data.address ?? null;
    this.issueDescription = data.issueDescription ?? null;
    this.purchaseBranchId = data.purchaseBranchId ?? null;
    this.purchaseBranchName = data.purchaseBranchName ?? null;
    this.purchaseBranchOther = data.purchaseBranchOther ?? null;
    this.vehicleBrandOther = data.vehicleBrandOther ?? null;
    this.nearestBranchId = data.nearestBranchId ?? null;
    this.nearestBranchName = data.nearestBranchName ?? null;
    this.status = data.status ?? 'pending';
    this.acceptedBy = data.acceptedBy ?? null;
    this.acceptedByName = data.acceptedByName ?? null;
    this.acceptedAt = data.acceptedAt ?? null;
    this.createdAt = data.createdAt ?? null;
    this.appointment = data.appointment ?? null; // ServiceAppointment | null
  }

  static fromPersistence(row, appointment = null) {
    if (!row) return null;
    return new ServiceRequest({
      id: row.id,
      fullName: row.full_name,
      gender: row.gender,
      phone: row.phone,
      email: row.email,
      address: row.address,
      issueDescription: row.issue_description,
      purchaseBranchId: row.purchase_branch_id,
      purchaseBranchName: row.purchase_branch_name,
      purchaseBranchOther: row.purchase_branch_other,
      vehicleBrandOther: row.vehicle_brand_other,
      nearestBranchId: row.nearest_branch_id,
      nearestBranchName: row.nearest_branch_name,
      status: row.status,
      acceptedBy: row.accepted_by,
      acceptedByName: row.accepted_by_name,
      acceptedAt: row.accepted_at,
      createdAt: row.created_at,
      appointment,
    });
  }
}

module.exports = ServiceRequest;
