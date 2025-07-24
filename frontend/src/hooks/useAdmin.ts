import { useState, useEffect } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';

export const useAdmin = () => {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdminStatus = async () => {
      console.log('Checking admin status...', { isSignedIn, userEmail: user?.emailAddresses?.[0]?.emailAddress });
      
      if (isSignedIn && user?.emailAddresses?.[0]?.emailAddress) {
        // For now, check if the user's email matches the admin email
        const userEmail = user.emailAddresses[0].emailAddress;
        const adminEmail = 'alexcarria1@gmail.com'; // This should come from environment or config
        
        if (userEmail === adminEmail) {
          console.log('✅ User email matches admin email');
          setIsAdmin(true);
        } else {
          console.log('❌ User email does not match admin email');
          setIsAdmin(false);
        }
      } else {
        console.log('❌ User not signed in or no email address');
        setIsAdmin(false);
      }
    };

    checkAdminStatus();
  }, [isSignedIn, user]);

  return { isAdmin, user };
}; 