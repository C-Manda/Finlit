import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { getProfile, type Profile } from '@/services/profile';

export function useProfile() {
  const { user } = useAuth();
  const userId = user?.id;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(userId));
  const [error, setError] = useState<Error | null>(null);
  useEffect(() => {
    let active = true;
    setProfile(null);
    setError(null);
    if (!userId) { setIsLoading(false); return; }
    setIsLoading(true);
    // Profiles are provisioned by the auth trigger; learner INSERT is intentionally denied.
    getProfile(userId).then(profile => {
      if (!profile) throw new Error('Your profile has not been provisioned. Please contact support.');
      if (active) setProfile(profile);
    }).catch(error => {
      if (active) setError(error instanceof Error ? error : new Error('Unable to load profile.'));
    }).finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, [userId]);
  return { profile: profile?.id === userId ? profile : null, isLoading, error, setProfile };
}
