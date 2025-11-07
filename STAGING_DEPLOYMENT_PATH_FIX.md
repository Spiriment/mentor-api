# Staging Deployment Path Fix

## 🔍 Problem

Files are being deployed to `/home/paxiapwb/api-staging.paxify.org/mentor-staging/` but the Node.js app expects them in `/home/paxiapwb/api-staging.paxify.org/`.

**Root Cause**: The FTP user `mentor-staging@api-staging.paxify.org` is chrooted to the `mentor-staging` subdirectory.

---

## ✅ Solution 1: Deploy to Parent Directory (Current Fix)

I've updated the workflow to use `server-dir: ../` for staging, which should deploy files one level up.

**What Changed**:

```yaml
server-dir: ${{ github.ref == 'refs/heads/main' && './' || '../' }}
```

- **Production (main)**: Deploys to `./` (FTP root)
- **Staging**: Deploys to `../` (parent directory)

**Test**: Push to staging and check if files appear in `/home/paxiapwb/api-staging.paxify.org/` instead of the subdirectory.

---

## 🔄 Solution 2: Configure Node.js App to Run from Subdirectory

If Solution 1 doesn't work (FTP user can't access `../`), configure the Node.js app to run from the `mentor-staging` subdirectory.

### Steps:

1. **In cPanel → Setup Node.js App**:

   - Find your staging app
   - Change **Application Root** from:
     ```
     /home/paxiapwb/api-staging.paxify.org
     ```
     to:
     ```
     /home/paxiapwb/api-staging.paxify.org/mentor-staging
     ```

2. **Update Startup File** (if needed):

   - Should still be: `dist/index.js`
   - The app will now look for files relative to `mentor-staging/` directory

3. **Restart the App**:
   - Stop and start the Node.js app in cPanel

---

## 🧪 Testing

After deploying, verify:

1. **Files are in the correct location**:

   ```bash
   # Should see package.json, dist/, etc.
   ls -la /home/paxiapwb/api-staging.paxify.org/
   ```

2. **Node.js app can find files**:

   ```bash
   cd /home/paxiapwb/api-staging.paxify.org/
   npm install --production
   ```

3. **App starts successfully**:
   - Check cPanel Node.js app status
   - Check logs for errors

---

## 🔧 Alternative: Use Different FTP User

If neither solution works, you might need to:

1. **Create a new FTP user** in cPanel that has access to `/home/paxiapwb/api-staging.paxify.org/` (not chrooted to subdirectory)

2. **Update GitHub Secrets**:

   - `FTP_STAGING_USERNAME` = new FTP username
   - `FTP_STAGING_PASSWORD` = new FTP password

3. **Update workflow** to use `server-dir: ./` for staging

---

## 📝 Current Workflow Configuration

```yaml
server-dir: ${{ github.ref == 'refs/heads/main' && './' || '../' }}
```

- **Main branch**: `./` (FTP root)
- **Staging branch**: `../` (parent directory)

---

## 🎯 Next Steps

1. **Commit and push** the workflow change
2. **Monitor deployment** to see if files go to the correct location
3. **If `../` doesn't work**, use Solution 2 (configure Node.js app to run from subdirectory)
4. **Test** that `npm install` works and the app starts

---

## ⚠️ Important Notes

- **Don't change production workflow** - it's working fine
- **Test staging deployment** after the change
- **If FTP user is chrooted**, they might not be able to access `../` - in that case, use Solution 2
- **Keep both environments consistent** - if one approach works, use it for both
