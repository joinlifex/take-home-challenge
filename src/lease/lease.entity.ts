import {endOfDay, isBefore, startOfDay} from 'date-fns';
import {ObjectType, Field, Int, Float} from 'type-graphql';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  BaseEntity,
  CreateDateColumn,
  UpdateDateColumn,
  Relation,
  ManyToOne,
  FindOptionsWhere,
  Between,
  LessThanOrEqual,
  MoreThanOrEqual,
  Not,
  BeforeInsert,
  BeforeUpdate,
  IsNull,
} from 'typeorm';
import Apartment from '../apartment/apartment.entity';
import Tenant from '../tenant/tenant.entity';
import LEASE_ERRORS from './lease.errors';

@ObjectType()
@Entity()
class Lease extends BaseEntity {
  @Field(() => Int)
  @PrimaryGeneratedColumn()
  id!: number;

  @Field()
  @Column()
  start!: Date;

  @Field({nullable: true})
  @Column({nullable: true})
  end?: Date | null;

  @Field(() => Float)
  @Column({type: 'float'})
  rent!: number;

  @Field(() => Float)
  @Column({type: 'float'})
  deposit!: number;

  /* Belongs to tenant */
  @ManyToOne(() => Tenant, {nullable: true})
  private tenant?: Relation<Tenant> | null;

  @Column()
  tenantId!: number;

  /* Belongs to apartment */
  @ManyToOne(() => Apartment, {nullable: true})
  private apartment?: Relation<Apartment> | null;

  @Column()
  apartmentId!: number;

  @Field()
  @CreateDateColumn()
  createdAt!: Date;

  @Field()
  @UpdateDateColumn()
  updatedAt!: Date;

  async getTenant(): Promise<Tenant> {
    const tenant = this.tenant || (await Tenant.findOneOrFail({where: {id: this.tenantId}}));
    this.tenant = tenant;

    return tenant;
  }

  async getApartment(): Promise<Apartment> {
    const apartment = this.apartment || (await Apartment.findOneOrFail({where: {id: this.apartmentId}}));
    this.apartment = apartment;

    return apartment;
  }

  private enforceStartToStartOfDay(): void {
    if (this.start) {
      this.start = startOfDay(this.start);
    }
  }

  private enforceEndToEndOfDay(): void {
    if (this.end) {
      this.end = endOfDay(this.end);
    }
  }

  // Validation function to make sure tenant don't have overlapping leases
  private async validateTenantNoOverlappingLeases(): Promise<void> {
    let conditions: FindOptionsWhere<Lease>[] = [
      {
        tenantId: this.tenantId,
        start: LessThanOrEqual(this.start),
        end: MoreThanOrEqual(this.start),
      },
      {
        tenantId: this.tenantId,
        end: IsNull(),
      },
    ];

    if (this.end) {
      conditions.push({
        tenantId: this.tenantId,
        start: LessThanOrEqual(this.end),
        end: MoreThanOrEqual(this.end),
      });

      conditions.push({
        tenantId: this.tenantId,
        start: Between(this.start, this.end),
      });
    }

    // When updating an existing lease, don't compare with itself
    if (this.id) {
      conditions = conditions.map(c => ({...c, id: Not(this.id)}));
    }
    const overlapLease = await Lease.findOne({where: conditions});
    if (overlapLease) {
      throw new Error(LEASE_ERRORS.USER_OVERLAP);
    }
  }

  // Validation function to make sure apartments don't have overlapping leases
  private async validateApartmentNoOverlappingLeases(): Promise<void> {
    let conditions: FindOptionsWhere<Lease>[] = [
      {
        apartmentId: this.apartmentId,
        start: LessThanOrEqual(this.start),
        end: MoreThanOrEqual(this.start),
      },
      {
        apartmentId: this.apartmentId,
        end: IsNull(),
      },
    ];

    if (this.end) {
      conditions.push({
        apartmentId: this.apartmentId,
        start: LessThanOrEqual(this.end),
        end: MoreThanOrEqual(this.end),
      });

      conditions.push({
        apartmentId: this.apartmentId,
        start: Between(this.start, this.end),
      });
    }

    // When updating an existing lease, don't compare with itself
    if (this.id) {
      conditions = conditions.map(c => ({...c, id: Not(this.id)}));
    }
    const overlapLease = await Lease.findOne({where: conditions});
    if (overlapLease) {
      throw new Error(LEASE_ERRORS.APARTMENT_OVERLAP);
    }
  }

  private validateNoEndBeforeStart(): void {
    if (this.end && isBefore(this.end, this.start)) {
      throw new Error(LEASE_ERRORS.END_BEFORE_START);
    }
  }

  @BeforeInsert()
  @BeforeUpdate()
  async validateLease(): Promise<void> {
    this.enforceStartToStartOfDay();
    this.enforceEndToEndOfDay();
    this.validateNoEndBeforeStart();
    await this.validateTenantNoOverlappingLeases();
    await this.validateApartmentNoOverlappingLeases();
  }
}

export default Lease;
