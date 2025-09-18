const LEASE_ERRORS = {
  INVALID_ID: 'Invalid leaseId',
  USER_OVERLAP: 'Tenant has overlapping leases',
  APARTMENT_OVERLAP: 'Apartment has overlapping leases',
  END_BEFORE_START: 'Lease end date must be after start date',
};

export default LEASE_ERRORS;
