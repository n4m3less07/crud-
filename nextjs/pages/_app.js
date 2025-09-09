import { useEffect } from 'react';
import { cleanupExpiredTokens } from '../lib/database';

export default function App({ Component, pageProps }) {
    useEffect(() => {
        // Clean up expired tokens on app start and then every 24 hours
        cleanupExpiredTokens();
        
        const interval = setInterval(cleanupExpiredTokens, 24 * 60 * 60 * 1000);
        
        return () => clearInterval(interval);
    }, []);

    return <Component {...pageProps} />;
}