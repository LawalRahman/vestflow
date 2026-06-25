# VestFlow Database Migrations

This directory contains database migration scripts for the VestFlow indexer.

## PostgreSQL Migration

### Prerequisites

- PostgreSQL 12 or higher
- Node.js 18+ with TypeScript support
- Database connection string in environment variables

### Setup

1. Set your database URL in the environment:
```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/vestflow"
# or
export POSTGRES_URL="postgresql://user:password@localhost:5432/vestflow"
```

2. Run the migration:
```bash
psql $DATABASE_URL -f migrations/001_postgresql_schema.sql
```

Or using Node.js:
```bash
npm run migrate
```

### Schema Overview

The PostgreSQL migration creates the following tables:

#### `vesting_schedules`
Stores the current state of each vesting schedule.

**Key Columns:**
- `schedule_id` - Primary key from the smart contract
- `grantor` - Address of the schedule creator
- `beneficiary` - Address receiving the vested tokens
- `token` - Token contract address
- `total_amount` - Total tokens in the schedule
- `claimed` - Amount already claimed
- `vesting_kind` - Type of vesting curve (Linear, Cliff, LinearWithCliff)

**Indexes:**
- `idx_vesting_schedules_grantor` - Queries by grantor
- `idx_vesting_schedules_beneficiary` - Queries by beneficiary
- `idx_vesting_schedules_grantor_beneficiary` - Combined queries

#### `claim_events`
Historical record of all token claims.

**Key Columns:**
- `id` - Unique event identifier (ledger-txIndex-eventIndex)
- `schedule_id` - Foreign key to vesting_schedules
- `beneficiary` - Address that claimed tokens
- `amount` - Amount claimed in this transaction
- `ledger` - Ledger number
- `ledger_closed_at` - Timestamp of the ledger

**Indexes:**
- `idx_claim_events_schedule_id` - All claims for a schedule
- `idx_claim_events_beneficiary` - All claims by a beneficiary
- `idx_claim_events_beneficiary_schedule` - Combined queries

#### `revoke_events`
Historical record of schedule revocations.

**Key Columns:**
- `id` - Unique event identifier
- `schedule_id` - Foreign key to vesting_schedules
- `grantor` - Address that revoked the schedule
- `revoked_amount` - Amount returned to grantor
- `ledger` - Ledger number

**Indexes:**
- `idx_revoke_events_schedule_id` - All revokes for a schedule
- `idx_revoke_events_grantor` - All revokes by a grantor

### Migration from SQLite

If you're currently using SQLite and want to migrate to PostgreSQL:

1. Export data from SQLite:
```sql
.mode csv
.output schedules.csv
SELECT * FROM schedule_events WHERE event_type = 'schedule_created';
```

2. Transform and import into PostgreSQL using the provided adapter functions

3. Update your indexer configuration to use PostgreSQL

### Rollback

To rollback the migration:
```sql
DROP TABLE IF EXISTS revoke_events CASCADE;
DROP TABLE IF EXISTS claim_events CASCADE;
DROP TABLE IF EXISTS vesting_schedules CASCADE;
DROP TABLE IF EXISTS checkpoint CASCADE;
DROP TABLE IF EXISTS analytics_cache CASCADE;
DROP TABLE IF EXISTS daily_stats CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;
```

## Future Migrations

Additional migration files should follow the naming convention:
- `002_add_feature_name.sql`
- `003_add_another_feature.sql`

Each migration should be idempotent and include:
- Clear comments explaining the changes
- `IF NOT EXISTS` clauses where applicable
- Rollback instructions in comments
