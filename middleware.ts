import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Define routes that should be protected
const isProtectedRoute = createRouteMatcher([
  '/workflows(.*)',
  '/editor(.*)',
  '/api/trpc(.*)' 
]);

export default clerkMiddleware(async (auth, req) => { // 1. Added 'async'
  if (isProtectedRoute(req)) {
    // 2. Added 'await' to resolve the Promise
    const { userId, redirectToSignIn } = await auth(); 
    
    if (!userId) {
      return redirectToSignIn();
    }
  }
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};