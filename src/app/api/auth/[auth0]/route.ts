import { handleAuth, handleLogin, handleLogout } from '@auth0/nextjs-auth0';

export const GET = handleAuth({
    login: handleLogin({
        returnTo: '/app/dashboard',
        authorizationParams: {
            // Database connection — email + password in Auth0 Universal Login
            screen_hint: 'login'
        }
    }),
    logout: handleLogout({
        returnTo: '/'
    })
});
