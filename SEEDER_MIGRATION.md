# Seeder Migration - typeorm-extension Pattern

## Overview
The seeders have been migrated to use the `typeorm-extension` pattern, matching the implementation in `teggy-api`. This provides a more standardized and maintainable approach to database seeding.

## Changes Made

### 1. UserSeeder (`src/database/seeders/user.seeder.ts`)
- ✅ Converted from `export class UserSeeder` to `export default class UserSeeder implements Seeder`
- ✅ Uses `Seeder` interface from `typeorm-extension`
- ✅ Receives `DataSource` and `SeederFactoryManager` as parameters in `run()` method

### 2. MentorSeeder (`src/database/seeders/mentor.seeder.ts`)
- ✅ Converted from standalone function `seedMentors()` to `export default class MentorSeeder implements Seeder`
- ✅ Removed direct `AppDataSource` usage, now uses `DataSource` from `run()` method parameter
- ✅ Removed standalone execution code (now handled by seed-runner)
- ✅ Uses `Seeder` interface from `typeorm-extension`

### 3. Seed Runner (`src/database/seeders/seed-runner.ts`)
- ✅ Created new `seed-runner.ts` file (similar to teggy-api)
- ✅ Imports and runs all seeders in order using `runSeeder()` from `typeorm-extension`
- ✅ Handles database initialization and cleanup
- ✅ Safety checks: Only drops/syncs database in development mode
- ✅ Proper error handling and connection cleanup

### 4. Package.json Scripts
- ✅ Updated production/staging paths from `database/seeders/` to `dist/database/seeders/`
- ✅ Development script: `npm run db-seed` (uses TypeScript directly)
- ✅ Production script: `npm run db-seed:prod` (uses compiled JS from dist/)
- ✅ Staging script: `npm run db-seed:staging` (uses compiled JS from dist/)

## Usage

### Development
```bash
npm run db-seed
```

This will:
1. Initialize database connection
2. Drop database (development only)
3. Synchronize schema (development only)
4. Run UserSeeder
5. Run MentorSeeder
6. Clean up and exit

### Production/Staging
```bash
# First build the project
npm run build

# Then run seeders
npm run db-seed:prod   # For production
npm run db-seed:staging # For staging
```

## Benefits

1. **Standardization**: Uses the same pattern as teggy-api for consistency
2. **Type Safety**: TypeScript interfaces ensure correct implementation
3. **Maintainability**: Clear separation of concerns
4. **Safety**: Production/staging modes don't drop database
5. **Flexibility**: Easy to add more seeders in the future

## Seeder Order

Seeders run in this order:
1. **UserSeeder** - Creates base users
2. **MentorSeeder** - Creates mentor profiles (depends on users)

## Adding New Seeders

To add a new seeder:

1. Create a new file: `src/database/seeders/your-seeder.ts`
2. Implement the `Seeder` interface:
   ```typescript
   import { DataSource } from 'typeorm';
   import { Seeder, SeederFactoryManager } from 'typeorm-extension';
   
   export default class YourSeeder implements Seeder {
     public async run(
       dataSource: DataSource,
       factoryManager: SeederFactoryManager
     ): Promise<void> {
       // Your seeding logic here
     }
   }
   ```
3. Add to `seed-runner.ts`:
   ```typescript
   import YourSeeder from "./your-seeder";
   
   // In runSeeders function:
   await runSeeder(AppDataSource, YourSeeder);
   ```

## Notes

- Seeders check for existing data and skip if already seeded
- Development mode will drop and recreate the database
- Production/staging modes require migrations to be up to date
- All seeders use proper error handling

