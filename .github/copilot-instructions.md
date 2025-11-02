# Proovid Frontend - React TypeScript Project

This is a modern React TypeScript frontend application for the Proovid video analysis platform.

## Project Structure
- **Components**: Reusable UI components
- **Pages**: Screen/page level components (intro_and_login_screen, fileupload_screen, etc.)
- **Hooks**: Custom React hooks for authentication, API calls, etc.
- **Utils**: Utility functions and helpers
- **Assets**: Static assets, logos, animations

## Technology Stack
- React 18 with TypeScript
- Vite for development and build tooling
- Tailwind CSS for styling and animations
- React Router for navigation
- JWT authentication with backend integration
- Framer Motion for smooth animations

## Authentication Flow
- JWT token-based authentication
- Login triggered by Enter/Return key
- Token storage in localStorage/sessionStorage
- Protected routes requiring authentication

## Screen Requirements
1. **intro_and_login_screen**: White background, animated logo fade-in, navigation menu, login form with JWT integration
2. **fileupload_screen**: File upload interface (to be implemented next)

## Development Guidelines
- Use TypeScript for type safety
- Follow React best practices and hooks
- Implement smooth animations and transitions
- Ensure responsive design
- Clean, maintainable code structure