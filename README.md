# 🏈 Salem Flag Football League Platform

A comprehensive flag football league management platform for the Salem Flag Football League in Salem, Massachusetts. This platform handles player registration, league management, team organization, and provides a modern web interface for both players and administrators.

## 🏗️ Architecture

This is a full-stack monorepo with the following structure:

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: FastAPI (Python) + SQLAlchemy + PostgreSQL
- **Authentication**: Clerk (JWT-based)
- **Database**: PostgreSQL with Alembic migrations
- **Deployment**: Docker Compose for local development

## 🚀 Current Functionality

### ✅ Implemented Features

#### **Authentication & User Management**
- JWT-based authentication via Clerk
- User profile creation and management
- Admin role verification and access control
- Profile completion workflow for new users

#### **League Management (Admin)**
- **League Creation**: Full CRUD operations for leagues
  - Support for multiple tournament formats (Round Robin, Swiss, Playoff Bracket, Compass Draw)
  - Flexible game formats (7v7, 6v6, 5v5)
  - Configurable season settings (weeks, game duration, teams per league)
  - Registration fee management
  - Registration deadline controls
- **League Statistics**: Real-time league stats including:
  - Player and team counts
  - Registration status tracking
  - Days until start/deadline calculations
- **League Member Management**: View and manage all registered players in a league
- **Team Generation**: Automated team creation with group preservation
  - Respects group registrations (keeps groups together when possible)
  - Configurable team sizes and counts
  - Custom team names and colors
- **Schedule Generation**: Automated schedule creation
  - Support for multiple tournament formats
  - Configurable game times and duration
  - Database persistence of generated schedules
- **Admin Management**: Add/remove admin users with role-based permissions
- **Test Data Generation**: Add fake players and data for testing purposes

#### **Player Registration System**
- **Individual Registration**: Players can register for leagues
- **Group Registration**: Support for group/team registrations
- **Profile Management**: Complete player profiles with:
  - Personal information (name, email, phone, DOB, gender)
  - Communication preferences
  - Registration status tracking
  - Payment and waiver status
- **League Browsing**: Public view of available leagues with registration status

#### **Team Management**
- Team creation and assignment
- Player-to-team relationships
- Team color customization
- League-specific team organization

#### **Public Interface**
- **Homepage**: League overview with standings and schedule display
- **League Browser**: Public view of all available leagues
- **Registration Flow**: Streamlined registration process for authenticated users
- **Responsive Design**: Mobile-friendly interface with Salem-themed styling

#### **Database Schema**
- **Leagues**: Comprehensive league configuration and settings
- **Players**: Complete player profiles and registration data
- **Teams**: Team management and organization
- **Groups**: Support for group registrations
- **Admin Config**: Admin user management
- **League Players**: Many-to-many relationships with status tracking

### 🔄 Partially Implemented Features

#### **Schedule & Standings**
- **Game Model**: Database model for storing individual games with scores and results
- **Schedule Generation**: Automated schedule creation with database persistence
- **Schedule Viewing**: Admin interface to view generated schedules
- **Game Management**: Track game status, scores, and outcomes

#### **Team Management**
- Basic team CRUD operations
- Team assignment functionality
- Missing: Team captain roles, team communication features

## 🏗️ Recent Architectural Improvements

### **Backend Modularization**
- **Refactored Admin API**: Split monolithic `admin.py` into modular components:
  - `league_management.py`: League CRUD operations and statistics
  - `team_management.py`: Member management and team generation
  - `schedule_management.py`: Schedule generation and viewing
  - `admin_management.py`: Admin user configuration
- **Centralized Schemas**: Moved all Pydantic models to `app/api/schemas/admin.py`
- **Shared Dependencies**: Created `app/api/admin/dependencies.py` for common admin authentication
- **New Game Model**: Added comprehensive `Game` model for schedule persistence

### **Frontend Modularization**
- **Refactored API Services**: Split monolithic `api.ts` into modular structure:
  - `core/`: Base service class and shared types
  - `admin/`: Admin-specific API services (league, team, admin management)
  - `public/`: Public API services (user, registration)
- **Backward Compatibility**: Maintained existing imports through `CombinedApiService`
- **Clean Architecture**: Organized services by domain with index files for clean imports

### **New Admin Features**
- **League Member Management**: View all registered players in a league
- **Team Generation**: Automated team creation with group preservation
- **Schedule Generation**: Automated schedule creation with database persistence
- **Test Data Generation**: Add fake players for testing purposes

## 🚧 Work to be Done

### **High Priority**

#### **1. Game & Schedule Management**
- [x] Create `Game` model for storing individual games
- [x] Implement automatic schedule generation based on tournament format
- [x] Add schedule viewing capabilities for admins
- [x] Create game result tracking system
- [ ] Add schedule editing capabilities for admins
- [ ] Add game result submission interface

#### **2. Standings & Results System**
- [ ] Create `GameResult` model for storing scores and outcomes
- [ ] Implement standings calculation logic
- [ ] Add result submission interface for admins
- [ ] Create real-time standings updates
- [ ] Support for different scoring systems

#### **3. Payment Integration**
- [ ] Integrate payment processor (Stripe/PayPal)
- [ ] Implement payment status tracking
- [ ] Add payment receipt generation
- [ ] Create payment reminder system

#### **4. Waiver Management**
- [ ] Create digital waiver system
- [ ] Implement waiver status tracking
- [ ] Add waiver reminder notifications
- [ ] Create waiver completion workflow

### **Medium Priority**

#### **5. Communication System**
- [ ] Email notification system for:
  - Registration confirmations
  - Schedule updates
  - Payment reminders
  - Waiver reminders
- [ ] In-app messaging system
- [ ] Team captain communication tools

#### **6. Advanced Tournament Features**
- [ ] Swiss tournament pairing algorithms
- [ ] Playoff bracket generation
- [ ] Compass draw tournament support
- [ ] Tournament progression tracking

#### **7. Player Management Enhancements**
- [x] Team balancing algorithms (with group preservation)
- [ ] Player skill level assessment
- [ ] Player availability tracking
- [ ] Substitute player management

### **Low Priority**

#### **8. Analytics & Reporting**
- [ ] League participation analytics
- [ ] Player performance tracking
- [ ] Financial reporting for admins
- [ ] Export functionality for data

#### **9. Mobile App**
- [ ] React Native mobile application
- [ ] Push notifications
- [ ] Offline capability for schedules

#### **10. Advanced Features**
- [ ] Weather integration for game cancellations
- [ ] Photo/video sharing for games
- [ ] Social features (player profiles, friend connections)
- [ ] League history and archives

## 🛠️ Technical Debt & Improvements

### **Database & API**
- [x] Modular API architecture with separate routers for different domains
- [x] Comprehensive API documentation (OpenAPI/Swagger)
- [x] Implement proper error handling and validation
- [ ] Add database indexes for performance
- [ ] Implement caching for frequently accessed data
- [ ] Add comprehensive test coverage

### **Frontend**
- [x] Modular API services architecture
- [x] Admin dashboard with team and schedule generation
- [x] Loading states and error handling for admin features
- [ ] Implement proper form validation
- [ ] Add accessibility features (ARIA labels, keyboard navigation)
- [ ] Optimize bundle size and performance
- [ ] Add comprehensive test coverage

### **Security & DevOps**
- [ ] Implement rate limiting
- [ ] Add security headers
- [ ] Set up CI/CD pipeline
- [ ] Add monitoring and logging
- [ ] Implement backup strategies

## 🚀 Getting Started

### **Prerequisites**
- Docker and Docker Compose
- Node.js 18+ (for local development)
- Python 3.10+ (for local development)

### **Quick Start with Docker**

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd salem-flag-football
   ```

2. **Build and start all services:**
   ```bash
   docker-compose up --build
   ```

3. **Access the application:**
   - **Frontend**: [http://localhost:3000](http://localhost:3000)
   - **Backend API**: [http://localhost:8000](http://localhost:8000)
   - **API Health Check**: [http://localhost:8000/health](http://localhost:8000/health)
   - **API Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)

### **Local Development Setup**

#### **Frontend Development:**
```bash
cd frontend
npm install
npm start
```

#### **Backend Development:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

#### **Database Setup:**
```bash
cd backend
alembic upgrade head
```

## 📁 Project Structure

```
salem-flag-football/
├── backend/
│   ├── app/
│   │   ├── api/           # API endpoints
│   │   │   ├── admin/     # Modular admin endpoints
│   │   │   │   ├── league_management.py
│   │   │   │   ├── team_management.py
│   │   │   │   ├── schedule_management.py
│   │   │   │   └── admin_management.py
│   │   │   └── schemas/   # Pydantic schemas
│   │   ├── core/          # Configuration
│   │   ├── db/           # Database setup
│   │   ├── models/       # SQLAlchemy models
│   │   ├── services/     # Business logic
│   │   └── utils/        # Utilities
│   ├── alembic/          # Database migrations
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # Page components
│   │   ├── services/     # Modular API services
│   │   │   ├── core/     # Core types and base service
│   │   │   ├── admin/    # Admin-specific API services
│   │   │   └── public/   # Public API services
│   │   ├── hooks/        # Custom React hooks
│   │   ├── types/        # TypeScript types
│   │   └── utils/        # Utilities
│   └── Dockerfile
└── docker-compose.yml
```

## 🔧 API Usage Patterns

### **Frontend Service Imports**

#### **Backward Compatible (Legacy)**
```typescript
import apiService from '../services/api';
// All methods available: apiService.getStandings(), apiService.createLeague(), etc.
```

#### **Modular Imports (Recommended)**
```typescript
// Import specific services
import { leagueApi, adminApi, userApi } from '../services';

// Import specific types
import { League, UserProfile, TeamGenerationResponse } from '../services';

// Direct imports for specific domains
import { LeagueApiService } from '../services/admin';
import { UserApiService } from '../services/public';
```

#### **Custom Hooks**
```typescript
import { useAuthenticatedApi } from '../hooks/useAuthenticatedApi';
import { useLeagues } from '../hooks/useLeagues';
```

### **Backend API Structure**

#### **Admin Endpoints**
- `GET /admin/leagues` - List all leagues
- `POST /admin/leagues` - Create new league
- `GET /admin/leagues/{id}/members` - Get league members
- `POST /admin/leagues/{id}/generate-teams` - Generate teams
- `POST /admin/leagues/{id}/generate-schedule` - Generate schedule
- `GET /admin/leagues/{id}/schedule` - Get league schedule

#### **Public Endpoints**
- `GET /league/public/leagues` - Get public leagues
- `GET /league/standings` - Get standings
- `GET /league/schedule` - Get schedule
- `POST /registration/player` - Register player
- `POST /registration/group` - Register group

## 🔧 Environment Variables

### **Security Setup**

**⚠️ IMPORTANT**: Never commit secrets to version control! The `.env` file is already in `.gitignore`.

1. **Copy the example file**:
   ```bash
   cp env.example .env
   ```

2. **Update the `.env` file** with your actual values:
   ```env
   # Database Configuration
   DATABASE_URL=postgresql://postgres:postgres@db:5432/flagfootball
   
   # Security
   SECRET_KEY=your-secret-key-here
   
   # Clerk Authentication
   CLERK_JWKS_URL=https://your-clerk-instance.clerk.accounts.dev/.well-known/jwks.json
   CLERK_ISSUER=https://your-clerk-instance.clerk.accounts.dev/
   CLERK_SECRET_KEY=sk_test_your-clerk-secret-key-here
   
   # Frontend Configuration
   REACT_APP_API_URL=http://localhost:8000
   REACT_APP_CLERK_PUBLISHABLE_KEY=pk_test_your-clerk-publishable-key-here
   ```

### **Getting Clerk Keys**

1. **Sign up at [Clerk.com](https://clerk.com)**
2. **Create a new application**
3. **Get your keys from the Clerk Dashboard**:
   - **Publishable Key**: Found in the API Keys section
   - **Secret Key**: Found in the API Keys section
   - **JWKS URL**: `https://your-instance.clerk.accounts.dev/.well-known/jwks.json`
   - **Issuer**: `https://your-instance.clerk.accounts.dev/`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🔒 Security

### **Environment Variables**
- All sensitive configuration is stored in `.env` files
- The `.env` file is excluded from version control via `.gitignore`
- Use `env.example` as a template for required environment variables

### **Secrets Management**
- **Never commit secrets** to version control
- Use environment variables for all sensitive data
- For production, use proper secrets management services (AWS Secrets Manager, Azure Key Vault, etc.)

### **Authentication**
- Uses Clerk for secure JWT-based authentication
- JWT tokens are validated using Clerk's JWKS endpoint
- Admin access is controlled via database configuration

## 📞 Support

For support or questions, please contact the development team or create an issue in the repository.

---

**Built with ❤️ for the Salem Flag Football League community**
