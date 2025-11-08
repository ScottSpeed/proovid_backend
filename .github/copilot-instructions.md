# Proovid Frontend - React TypeScript Project

This is a modern React TypeScript frontend application for the Proovid video analysis platform.

## Project Structure
- **Components**: Reusable UI components
- **Pages**: Screen/page level components (intro_and_login_screen, fileupload_screen, chatbot_screen)
- **Hooks**: Custom React hooks for authentication, API calls, etc.
- **Services**: API service layer, S3 upload service, Amplify auth service
- **Utils**: Utility functions and helpers
- **Assets**: Static assets, logos, animations

## Technology Stack
- React 19 with TypeScript
- Vite for development and build tooling
- Tailwind CSS for styling and animations
- React Router for navigation
- AWS Amplify authentication (Cognito: eu-central-1_ZpQH8Tpm4)
- Framer Motion for smooth animations

## Infrastructure
- **Backend API**: https://ui-proov-alb-1535367426.eu-central-1.elb.amazonaws.com (HTTPS on port 443)
- **S3 Upload Bucket**: christian-aws-development
- **Frontend S3 Bucket**: frontend-deploy-1756677679
- **CloudFront Distribution**: EQ43E3L88MMF9 (proovid.ai)
- **Region**: eu-central-1

## Deployment
- **Deploy Script**: `frontend/scripts/deploy-frontend.bat`
- **Process**: Build → S3 Sync → CloudFront Invalidation
- **Live URL**: https://proovid.ai

## Authentication Flow
- AWS Cognito authentication
- JWT token-based authorization
- Token storage in localStorage/sessionStorage
- Protected routes requiring authentication

## API Integration
- **Production Mode Only** - No demo/mock implementations
- Real backend API calls for all operations
- Endpoints: /analyze, /job-status, /chat
- S3 direct upload for video files
- Real-time job status polling

## Development Guidelines
- Use TypeScript for type safety
- Follow React best practices and hooks
- Implement smooth animations and transitions
- Ensure responsive design
- Clean, maintainable code structure
- NO demo or mock implementations - production only