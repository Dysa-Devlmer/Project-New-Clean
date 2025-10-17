# Project New Clean

A modern full-stack application built with TypeScript, featuring a NestJS backend and Next.js admin panel in a monorepo structure.

## 🏗️ Architecture

This project uses a monorepo structure with the following components:

- **Backend** (`apps/backend`): NestJS API with TypeORM
- **Admin Panel** (`apps/admin-panel`): Next.js dashboard with TypeScript
- **Common Packages** (`packages/`):
  - `common-logging`: Shared logging utilities
  - `common-types`: Shared TypeScript types

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Yarn
- Docker & Docker Compose (for database)

### Installation

```bash
# Install dependencies
yarn install

# Start database
docker-compose -f docker-compose.db.yml up -d

# Start development servers
yarn start:dev
```

### Individual Commands

```bash
# Backend only
yarn workspace backend start:dev

# Admin panel only
yarn workspace admin-panel dev

# Build all workspaces
yarn build

# Run tests
yarn workspace backend test
```

## 🔧 Development

### Project Structure

```
.
├── apps/
│   ├── backend/          # NestJS API
│   └── admin-panel/      # Next.js Dashboard
├── packages/
│   ├── common-logging/   # Shared logging
│   └── common-types/     # Shared types
├── .github/workflows/    # CI/CD
└── docker-compose.*.yml  # Docker configs
```

### Environment Variables

#### Backend (`apps/backend/.env.development`)
```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=projectnewtest_db
```

#### Admin Panel (`apps/admin-panel/.env.development`)
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## 🧪 Testing

```bash
# Backend tests
yarn workspace backend test

# E2E tests
yarn workspace backend test:e2e

# Lint all workspaces
yarn workspace backend lint
yarn workspace admin-panel lint
```

## 🚢 Deployment

### Docker Production

```bash
# Build backend image
docker build -f apps/backend/Dockerfile.prod -t backend:latest .

# Build admin-panel image
docker build -f apps/admin-panel/Dockerfile.prod -t admin-panel:latest .
```

### CI/CD

The project includes GitHub Actions workflows for:

- ✅ **Build**: All workspaces (backend, admin-panel, common packages)
- ✅ **Test**: Backend unit and integration tests
- ✅ **Security**: CodeQL analysis and dependency review
- ✅ **Docker**: Automated image builds on `main` branch

## 📝 Scripts

| Command | Description |
|---------|-------------|
| `yarn build` | Build all workspaces |
| `yarn start:dev` | Start all development servers |
| `yarn workspace <name> <script>` | Run script in specific workspace |

## 🛠️ Tech Stack

- **Backend**: NestJS, TypeORM, PostgreSQL
- **Frontend**: Next.js, TypeScript, Tailwind CSS
- **Monorepo**: Yarn Workspaces
- **CI/CD**: GitHub Actions
- **Containerization**: Docker
- **Database**: PostgreSQL

## 📄 License

This project is private and proprietary.