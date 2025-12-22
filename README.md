# WinCC OA VS Code Extension Template

Minimal starter template for creating VS Code extensions for WinCC OA with Git Flow workflow.

## 🚀 Quick Start

### Initial Setup

1. **Create repository from this template**

   ```bash
   # Via GitHub CLI
   gh repo create winccoa-tools-pack/<your-extension-name> \
     --template winccoa-tools-pack/template-vscode-extension \
     --public
   ```

2. **Clone and initialize Git Flow**

   ```bash
   git clone https://github.com/winccoa-tools-pack/<your-extension-name>
   cd <your-extension-name>

   # Run the setup script (PowerShell)
   .\setup-gitflow.ps1

   # Or manually
   git flow init -d
   git push -u origin develop
   ```

3. **Install dependencies and build**

   ```bash
   npm install
   npm run compile
   npm test
   ```

## 🌳 Git Flow Workflow

This template uses [Git Flow](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow) for branch management:

### Branch Structure

- **`main`** - Production-ready code (stable releases)
- **`develop`** - Integration branch (pre-release features)
- **`feature/*`** - New features
- **`release/*`** - Release preparation
- **`hotfix/*`** - Emergency fixes for production

### Common Commands

```bash
# Start a new feature
git flow feature start my-feature

# Finish feature (merges to develop)
git flow feature finish my-feature

# Start a release
git flow release start 1.0.0

# Finish release (merges to main and develop, creates tag)
git flow release finish 1.0.0

# Hotfix for production
git flow hotfix start 1.0.1
git flow hotfix finish 1.0.1
```

### Branch Protection

The `setup-gitflow.ps1` script applies protection rules:

- **main**: Requires PR reviews, status checks, no force pushes
- **develop**: Requires PR reviews, status checks, allows force pushes (for rebasing)

## 🔐 VS Code Marketplace Publishing Setup

To enable automatic publishing to the VS Code Marketplace when creating releases, you need to configure a Personal Access Token:

### Why VSCE_PAT is Required

The `release.yml` workflow automatically publishes your extension to the VS Code Marketplace when you merge a release PR to `main`. This requires authentication with Azure DevOps.

### How to Get a Personal Access Token

1. **Go to Azure DevOps**

   - Navigate to: <https://dev.azure.com>

2. **Create Personal Access Token**

   - Click on your profile → **Personal access tokens**
   - Click **+ New Token**
   - Name: `VS Code Marketplace Publishing`
   - Organization: **All accessible organizations**
   - Expiration: Choose appropriate duration
   - Scopes: **Marketplace** → **Manage** (check the box)
   - Click **Create**
   - **Copy the token** (you won't see it again!)

3. **Add Token to Repository**
   - Go to your GitHub repository settings
   - Navigate to **Settings** → **Secrets and variables** → **Actions**
   - Click **"New repository secret"**
   - Name: `VSCE_PAT`
   - Value: Paste your Personal Access Token
   - Click **"Add secret"**

### Publisher Setup

You also need a publisher account on the VS Code Marketplace:

1. **Create Publisher**

   - Go to <https://marketplace.visualstudio.com/manage>
   - Click **Create publisher**
   - Fill in publisher details (ID, name, etc.)
   - Your publisher ID should match the `publisher` field in `package.json`

2. **Update package.json**

   ```json
   {
     "publisher": "your-publisher-id",
     "name": "your-extension-name"
   }
   ```

### Testing Without VSCE_PAT

If `VSCE_PAT` is not configured, the workflow will:

- ✅ Still run tests and build the extension
- ✅ Create GitHub releases with VSIX files
- ⚠️ Skip Marketplace publishing with a warning message

You can always publish manually later:

```bash
vsce publish
```

## 📦 Development

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode (auto-compile on changes)
npm run watch

# Run tests
npm test

# Package extension (.vsix file)
npm run package

# Run lint
npm run lint
```

## 🎯 Testing Your Extension

Press `F5` in VS Code to open a new Extension Development Host window with your extension loaded.

## Triggering the Image Build (Safe Example)

If you want to build and test the WinCC OA Docker image from this repository, prefer supplying your own Docker Hub namespace and repo to avoid accidental pushes to upstream.

```powershell
# Example: dispatch the build workflow and set your namespace/repo
gh workflow run build-winccoa-image.yml \
   -f docker_namespace=your-docker-namespace \
   -f repo_name=your-repo-name \
   -f node_version=20
```

If you do not provide `docker_namespace` or `repo_name`, the workflow will default `docker_namespace` to the repository owner and `repo_name` to the repository name; push steps will be skipped if `DOCKER_USER`/`DOCKER_PASSWORD` secrets are missing.

## 🏆 Recognition

Special thanks to all our [contributors](https://github.com/orgs/winccoa-tools-pack/people) who make this project possible!

### Key Contributors

- **Martin Pokorny** ([@mPokornyETM](https://github.com/mPokornyETM)) - Creator & Lead Developer
- And many more amazing contributors!

---

## 📜 License

This project is basically licensed under the **MIT License** - see the [LICENSE](https://github.com/winccoa-tools-pack/.github/blob/main/LICENSE) file for details.

It might happens, that the partial repositories contains third party SW which are using other license models.

---

## ⚠️ Disclaimer

**WinCC OA** and **Siemens** are trademarks of Siemens AG. This project is not affiliated with, endorsed by, or sponsored by Siemens AG. This is a community-driven open source project created to enhance the development experience for WinCC OA developers.

---

## 🎉 Thank You

Thank you for using WinCC OA tools package!
We're excited to be part of your development journey. **Happy Coding! 🚀**

---

## Quick Links

- [📦 VS Code Marketplace](https://marketplace.visualstudio.com/search?term=tag%3Awincc-oa&target=VSCode&category=All%20categories&sortBy=Relevance)
- [SIMATIC WinCC Open Architecture](https://www.siemens.com/global/en/products/automation/industry-software/automation-software/scada/simatic-wincc-oa.html)
- [SIMATIC WinCC Open Architecture official documentation](https://www.winccoa.com/documentation/WinCCOA/latest/en_US/index.html)
- [ETM Company](https://www.winccoa.com/company.html)

<center>Made with ❤️ for and by the WinCC OA community</center>
