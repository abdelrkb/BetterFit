import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Slot, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { consumePendingInvitation } from '@/lib/invitation';
import { useSession } from '@/stores/session';
import { useWorkout } from '@/stores/workout';
import { appFonts } from '@/ui/fonts';
import '../src/i18n';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

// On garde l'écran de démarrage tant que les polices ne sont pas prêtes :
// sinon l'écran s'affiche une fraction de seconde dans la police système.
void SplashScreen.preventAutoHideAsync();

/**
 * Aiguillage unique de l'application.
 *
 * Trois états, trois destinations : pas connecté → les écrans de connexion ;
 * connecté sans profil → le questionnaire d'accueil ; connecté avec profil →
 * l'application. Le faire ici, et à un seul endroit, évite qu'un écran oublie
 * de se protéger.
 */
function Guard() {
  const status = useSession((state) => state.status);
  const hasProfile = useSession((state) => state.user?.hasProfile ?? false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;

    const group = segments[0];
    const inAuth = group === '(auth)';
    const inOnboarding = group === 'onboarding';

    // Ces deux écrans s'ouvrent depuis un lien reçu par e-mail. Ils doivent
    // rester accessibles dans tous les cas : déconnecté, mais aussi connecté
    // sur cet appareil — on oublie son mot de passe ailleurs, et on reçoit une
    // invitation alors qu'on a déjà un compte.
    const path = segments.join('/');
    if (path.includes('reset-password') || path.includes('invitation')) return;

    if (status === 'signedOut') {
      if (!inAuth) router.replace('/sign-in');
      return;
    }

    if (!hasProfile && !inOnboarding) {
      router.replace('/onboarding');
      return;
    }

    if (hasProfile && (inAuth || inOnboarding)) {
      router.replace('/');
    }
  }, [status, hasProfile, segments, router]);

  return <Slot />;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(appFonts);
  const bootstrap = useSession((state) => state.bootstrap);
  const status = useSession((state) => state.status);
  const restoreWorkout = useWorkout((state) => state.restore);
  const flushWorkouts = useWorkout((state) => state.flush);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  // Reprend la séance interrompue au démarrage.
  useEffect(() => {
    void restoreWorkout();
  }, [restoreWorkout]);

  // Puis, une fois connecté : les séances faites hors ligne partent, et
  // l'invitation reçue par e-mail avant la connexion est consommée.
  useEffect(() => {
    if (status !== 'signedIn') return;

    void flushWorkouts();
    void consumePendingInvitation();
  }, [status, flushWorkouts]);

  const ready = (fontsLoaded || fontError) && status !== 'loading';

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  // En cas d'erreur de chargement des polices, on affiche quand même l'app :
  // les polices système prennent le relais, ce qui vaut mieux qu'un écran bloqué.
  if (!ready) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Guard />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
