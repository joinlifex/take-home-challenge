import {addDays, endOfDay, startOfDay, subDays} from 'date-fns';
import Apartment from '../../apartment/apartment.entity';
import {createApartment, createLease, createTenant} from '../../factories';
import Tenant from '../../tenant/tenant.entity';
import LEASE_ERRORS from '../lease.errors';

describe('Lease', () => {
  it('tenant should be required', async () => {
    expect.assertions(2);
    try {
      await createLease({tenantId: null});
    } catch (error) {
      expect(error.message).toMatch('NOT NULL');
      expect(error.message).toMatch('lease.tenantId');
    }
  });

  it('apartment should be required', async () => {
    expect.assertions(2);
    try {
      await createLease({apartmentId: null});
    } catch (error) {
      expect(error.message).toMatch('NOT NULL');
      expect(error.message).toMatch('lease.apartmentId');
    }
  });

  it('rent should be required', async () => {
    expect.assertions(2);
    try {
      await createLease({rent: null});
    } catch (error) {
      expect(error.message).toMatch('NOT NULL');
      expect(error.message).toMatch('lease.rent');
    }
  });

  it('deposit should be required', async () => {
    expect.assertions(2);
    try {
      await createLease({deposit: null});
    } catch (error) {
      expect(error.message).toMatch('NOT NULL');
      expect(error.message).toMatch('lease.deposit');
    }
  });

  it('start should be required', async () => {
    expect.assertions(2);
    try {
      await createLease({start: null});
    } catch (error) {
      expect(error.message).toMatch('NOT NULL');
      expect(error.message).toMatch('lease.start');
    }
  });

  it('start to be enforced to start of day', async () => {
    const now = new Date();
    const lease = await createLease({start: endOfDay(now)});
    expect(lease.start).toStrictEqual(startOfDay(now));
  });

  it('end to be enforced to end of day', async () => {
    const now = new Date();
    const lease = await createLease({start: subDays(now, 10), end: startOfDay(now)});
    expect(lease.end).toStrictEqual(endOfDay(now));
  });

  it('end must be after start', async () => {
    await expect(createLease({start: new Date(), end: subDays(new Date(), 1)})).rejects.toThrow(LEASE_ERRORS.END_BEFORE_START);
  });

  it('should return id and timestamps on create', async () => {
    const tenant = await createLease();
    expect(tenant).toHaveProperty('id');
    expect(tenant).toHaveProperty('createdAt');
    expect(tenant).toHaveProperty('updatedAt');
  });

  describe('validateTenantNoOverlappingLeases', () => {
    it('should reject when new lease starts inside an existing lease', async () => {
      const tenant = await createTenant();
      const start = new Date('2020-01-01');
      const end = addDays(start, 9); // 2020-01-10
      await createLease({tenantId: tenant.id, start, end});

      await expect(createLease({tenantId: tenant.id, start: addDays(start, 4), end: addDays(start, 14)})) // 2020-01-05 -> 2020-01-15
        .rejects.toThrow(LEASE_ERRORS.USER_OVERLAP);
    });

    it('should reject when new lease ends inside an existing lease', async () => {
      const tenant = await createTenant();
      const start = new Date('2020-01-05');
      const end = addDays(start, 10); // 2020-01-15
      await createLease({tenantId: tenant.id, start, end});

      await expect(createLease({tenantId: tenant.id, start: subDays(start, 4), end: addDays(start, 5)})) // 2020-01-01 -> 2020-01-10
        .rejects.toThrow(LEASE_ERRORS.USER_OVERLAP);
    });

    it('should reject when new lease fully covers an existing lease', async () => {
      const tenant = await createTenant();
      const start = new Date('2020-01-05');
      const end = addDays(start, 5); // 2020-01-10
      await createLease({tenantId: tenant.id, start, end});

      await expect(createLease({tenantId: tenant.id, start: subDays(start, 4), end: addDays(end, 5)})) // 2020-01-01 -> 2020-01-15
        .rejects.toThrow(LEASE_ERRORS.USER_OVERLAP);
    });

    it('should reject when new lease is fully covered by an existing lease', async () => {
      const tenant = await createTenant();
      const start = new Date('2020-01-01');
      const end = addDays(start, 14); // 2020-01-15
      await createLease({tenantId: tenant.id, start, end});

      await expect(createLease({tenantId: tenant.id, start: addDays(start, 4), end: subDays(end, 5)})) // 2020-01-05 -> 2020-01-10
        .rejects.toThrow(LEASE_ERRORS.USER_OVERLAP);
    });

    it('should reject when both leases are open-ended', async () => {
      const tenant = await createTenant();
      const start = new Date('2020-01-01');
      await createLease({tenantId: tenant.id, start, end: null});

      await expect(createLease({tenantId: tenant.id, start: addDays(start, 365), end: null})) // 2021-01-01 -> ∞
        .rejects.toThrow(LEASE_ERRORS.USER_OVERLAP);
    });

    it('should reject when new open-ended lease starts before an existing closed lease ends', async () => {
      const tenant = await createTenant();
      const start = new Date('2020-01-01');
      const end = addDays(start, 364); // 2020-12-31
      await createLease({tenantId: tenant.id, start, end});

      await expect(createLease({tenantId: tenant.id, start: addDays(start, 150), end: null})) // 2020-05-30 -> ∞
        .rejects.toThrow(LEASE_ERRORS.USER_OVERLAP);
    });

    it('should reject when existing open-ended lease overlaps with a new closed lease', async () => {
      const tenant = await createTenant();
      const start = new Date('2020-01-01');
      await createLease({tenantId: tenant.id, start, end: null});

      await expect(createLease({tenantId: tenant.id, start: addDays(start, 365), end: addDays(start, 730)})) // 2021-01-01 -> 2021-12-31
        .rejects.toThrow(LEASE_ERRORS.USER_OVERLAP);
    });

    it('should allow when new lease starts exactly at end of existing lease (no overlap)', async () => {
      const tenant = await createTenant();
      const start = new Date('2020-01-01');
      const end = addDays(start, 364); // 2020-12-31
      await createLease({tenantId: tenant.id, start, end});

      await expect(createLease({tenantId: tenant.id, start: addDays(end, 1), end: addDays(end, 365)})) // 2020-12-31 -> 2021-12-31
        .resolves.not.toThrow();
    });
  });

  describe('validateApartmentNoOverlappingLeases', () => {
    it('should reject when new lease starts inside an existing lease', async () => {
      const apartment = await createApartment();
      const start = new Date('2020-01-01');
      const end = addDays(start, 9); // 2020-01-10
      await createLease({apartmentId: apartment.id, start, end});

      await expect(createLease({apartmentId: apartment.id, start: addDays(start, 4), end: addDays(start, 14)})) // 2020-01-05 -> 2020-01-15
        .rejects.toThrow(LEASE_ERRORS.APARTMENT_OVERLAP);
    });

    it('should reject when new lease ends inside an existing lease', async () => {
      const apartment = await createApartment();
      const start = new Date('2020-01-05');
      const end = addDays(start, 10); // 2020-01-15
      await createLease({apartmentId: apartment.id, start, end});

      await expect(createLease({apartmentId: apartment.id, start: subDays(start, 4), end: addDays(start, 5)})) // 2020-01-01 -> 2020-01-10
        .rejects.toThrow(LEASE_ERRORS.APARTMENT_OVERLAP);
    });

    it('should reject when new lease fully covers an existing lease', async () => {
      const apartment = await createApartment();
      const start = new Date('2020-01-05');
      const end = addDays(start, 5); // 2020-01-10
      await createLease({apartmentId: apartment.id, start, end});

      await expect(createLease({apartmentId: apartment.id, start: subDays(start, 4), end: addDays(end, 5)})) // 2020-01-01 -> 2020-01-15
        .rejects.toThrow(LEASE_ERRORS.APARTMENT_OVERLAP);
    });

    it('should reject when new lease is fully covered by an existing lease', async () => {
      const apartment = await createApartment();
      const start = new Date('2020-01-01');
      const end = addDays(start, 14); // 2020-01-15
      await createLease({apartmentId: apartment.id, start, end});

      await expect(createLease({apartmentId: apartment.id, start: addDays(start, 4), end: subDays(end, 5)})) // 2020-01-05 -> 2020-01-10
        .rejects.toThrow(LEASE_ERRORS.APARTMENT_OVERLAP);
    });

    it('should reject when both leases are open-ended', async () => {
      const apartment = await createApartment();
      const start = new Date('2020-01-01');
      await createLease({apartmentId: apartment.id, start, end: null});

      await expect(createLease({apartmentId: apartment.id, start: addDays(start, 365), end: null})) // 2021-01-01 -> ∞
        .rejects.toThrow(LEASE_ERRORS.APARTMENT_OVERLAP);
    });

    it('should reject when new open-ended lease starts before an existing closed lease ends', async () => {
      const apartment = await createApartment();
      const start = new Date('2020-01-01');
      const end = addDays(start, 364); // 2020-12-31
      await createLease({apartmentId: apartment.id, start, end});

      await expect(createLease({apartmentId: apartment.id, start: addDays(start, 150), end: null})) // 2020-05-30 -> ∞
        .rejects.toThrow(LEASE_ERRORS.APARTMENT_OVERLAP);
    });

    it('should reject when existing open-ended lease overlaps with a new closed lease', async () => {
      const apartment = await createApartment();
      const start = new Date('2020-01-01');
      await createLease({apartmentId: apartment.id, start, end: null});

      await expect(createLease({apartmentId: apartment.id, start: addDays(start, 365), end: addDays(start, 730)})) // 2021-01-01 -> 2021-12-31
        .rejects.toThrow(LEASE_ERRORS.APARTMENT_OVERLAP);
    });

    it('should allow when new lease starts exactly at end of existing lease (no overlap)', async () => {
      const apartment = await createApartment();
      const start = new Date('2020-01-01');
      const end = addDays(start, 364); // 2020-12-31
      await createLease({apartmentId: apartment.id, start, end});

      await expect(createLease({apartmentId: apartment.id, start: addDays(end, 1), end: addDays(end, 365)})) // 2020-12-31 -> 2021-12-31
        .resolves.not.toThrow();
    });
  });

  describe('getTenant', () => {
    it('should return tenant linked to this entity and memoized it', async () => {
      const spy = jest.spyOn(Tenant, 'findOneOrFail');
      const tenant = await createTenant();
      const lease = await createLease({tenantId: tenant.id});
      const res = await lease.getTenant();
      expect(res).toMatchObject(tenant);
      await lease.getTenant();
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('getApartment', () => {
    it('should return apartment linked to this entity and memoized it', async () => {
      const spy = jest.spyOn(Apartment, 'findOneOrFail');
      const apartment = await createApartment();
      const lease = await createLease({apartmentId: apartment.id});
      const res = await lease.getApartment();
      expect(res).toMatchObject(apartment);
      await lease.getApartment();
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
