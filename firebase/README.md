# Firebase Configuration

This directory contains all Firebase configuration files.

## 📁 Files

### Security Rules
- **`firestore.rules`** - Firestore database security rules
- **`storage.rules`** - Firebase Storage security rules

### Indexes
- **`firestore.indexes.json`** - Composite indexes for Firestore queries

### Configuration
- **`firebase.json`** - Firebase project configuration (in root directory)
- **`.firebaserc`** - Firebase project aliases (in root directory)

### Cloud Functions
- **`functions/`** - Serverless Cloud Functions code
  - `functions/src/` - TypeScript source files
  - `functions/package.json` - Function dependencies
  - `functions/tsconfig.json` - TypeScript configuration

## 🚀 Deploy Commands

### Deploy Everything
```bash
firebase deploy
```

### Deploy Specific Services
```bash
# Firestore rules only
firebase deploy --only firestore:rules

# Firestore indexes only
firebase deploy --only firestore:indexes

# Storage rules only
firebase deploy --only storage

# Cloud Functions only
firebase deploy --only functions

# Specific function only
firebase deploy --only functions:summarize
```

## 📝 Best Practices

1. **Always test rules locally first:**
   ```bash
   firebase emulators:start
   ```

2. **Check rules before deploying:**
   ```bash
   firebase firestore:rules:get
   ```

3. **Build functions before deploying:**
   ```bash
   cd functions && npm run build && cd ..
   ```

4. **Keep CONFIG_REFERENCE.md updated** when you change any configuration

## 🔗 More Info

See **`../CONFIG_REFERENCE.md`** for:
- Complete configuration details
- Deployment checklist
- Troubleshooting guide
- Quick reference links

