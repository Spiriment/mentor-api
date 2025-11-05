# cPanel Seeding Guide

## Issue: `dist/` folder not found

The error occurs because the project hasn't been built on the server. The `dist/` folder doesn't exist.

## Solution: Build on cPanel First

### Option 1: Build and Seed (Recommended)

```bash
# Build the project first, then seed
npm run build:main && npm run db-seed:prod
```

Or use the convenience script:
```bash
npm run build-and-seed:prod
```

### Option 2: Manual Steps

1. **Build the project:**
   ```bash
   npm run build:main
   ```
   This will:
   - Compile TypeScript to JavaScript (`tsc`)
   - Resolve path aliases (`tsc-alias`)
   - Copy mail templates (`copy-assets`)

2. **Verify the build:**
   ```bash
   ls -la dist/database/seeders/
   ```
   You should see `seed-runner.js`, `user.seeder.js`, and `mentor.seeder.js`

3. **Run the seeder:**
   ```bash
   npm run db-seed:prod
   ```

## Why tsconfig-paths was removed

Since your build process uses `tsc-alias`, all `@/` path aliases are already resolved during compilation. The compiled JavaScript files in `dist/` use relative paths, so `tsconfig-paths` is not needed at runtime.

## Troubleshooting

### Error: "Cannot find module 'dist/database/seeders/seed-runner.js'"
- **Solution:** Run `npm run build:main` first

### Error: "Cannot find module '@/config/data-source'"
- **Solution:** Make sure `tsc-alias` ran successfully. Check if `package.json` has `tsc-alias` in dependencies.

### Error: "Database connection failed"
- **Solution:** Check your `.env.production` file has correct database credentials:
  ```
  DB_HOST=localhost
  DB_PORT=3306
  DB_USERNAME=your_username
  DB_PASSWORD=your_password
  DB_NAME=your_database
  ```

## Production Deployment Checklist

1. ✅ Upload all source files to cPanel
2. ✅ Run `npm install --production` (or `npm install` if you need to build)
3. ✅ Run `npm run build:main` to compile TypeScript
4. ✅ Run `npm run db-seed:prod` to seed data
5. ✅ Start the server with `npm start`

## Note

- The `build:main` script uses `cross-env` which might not be available. If you get an error, manually set NODE_ENV:
  ```bash
  NODE_ENV=production npm run build
  ```
  Or just run `npm run build` (it will use the default .env file)

