import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabIcon } from '@/ui/TabIcon';
import { colors, fonts, radii, spacing, TAB_BAR_HEIGHT } from '@/ui';

/**
 * Les quatre onglets de l'app, identiques sur téléphone et sur le web :
 * Accueil, Programme, Nutrition, Profil.
 *
 * La barre **flotte** : elle est détachée des bords, arrondie, et l'onglet
 * actif porte une pastille. Posée à ras du bas, elle tombait sous le pouce et
 * trop près de la barre d'accueil de l'iPhone. On garde la marge de sécurité
 * du téléphone en dessous, jamais moins que `spacing.md`.
 *
 * Les autres écrans (bibliothèque d'exercices, séance en cours, espace coach,
 * démo) restent accessibles par navigation mais ne prennent pas de place dans
 * la barre : `href: null` les enlève de la barre sans les enlever de l'app.
 * Chacun de ces dossiers a sa propre pile, sinon chaque fichier qu'il contient
 * deviendrait un onglet.
 */

export default function MainLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const bottomMargin = Math.max(insets.bottom, spacing.md);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        // La pastille de l'onglet actif.
        tabBarActiveBackgroundColor: colors.accentSoft,
        tabBarStyle: {
          // Hors du flux : avec une simple marge basse, React Navigation
          // réserve la hauteur de la barre mais pas la marge, et le bas de
          // la barre se retrouve coupé sous l'écran. Le contenu des écrans
          // garde sa place grâce au `paddingBottom` de `Screen`.
          position: 'absolute',
          left: spacing.lg,
          right: spacing.lg,
          bottom: bottomMargin,
          backgroundColor: colors.card,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          borderRadius: radii.pill,
          height: TAB_BAR_HEIGHT,
          // Sans ça, React Navigation rajoute la marge de sécurité du
          // téléphone *dans* la barre, qui se retrouve deux fois trop haute.
          paddingBottom: 0,
          paddingTop: 0,
          // La barre flotte : une ombre discrète la décolle du contenu.
          shadowColor: colors.night,
          shadowOpacity: 0.12,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        },
        // La pastille occupe presque toute la hauteur de la barre : en
        // laissant seulement 8 px de marge, le libellé garde la place dont il
        // a besoin sous le pictogramme.
        tabBarItemStyle: {
          borderRadius: radii.pill,
          marginVertical: spacing.xs,
          marginHorizontal: spacing.xs,
          paddingVertical: 0,
        },
        // Hauteur explicite : la boîte du libellé est sinon calculée à 7 px
        // pour une police de 11, avec `overflow: hidden`, et les jambages des
        // lettres sont coupés net.
        tabBarLabelStyle: {
          fontFamily: fonts.semibold,
          fontSize: 11,
          lineHeight: 14,
          height: 16,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color }) => <TabIcon name="home" color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="training"
        options={{
          title: t('tabs.training'),
          tabBarIcon: ({ color }) => <TabIcon name="training" color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          title: t('tabs.nutrition'),
          tabBarIcon: ({ color }) => <TabIcon name="nutrition" color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color }) => <TabIcon name="profile" color={color} size={24} />,
        }}
      />

      <Tabs.Screen name="exercises" options={{ href: null }} />
      <Tabs.Screen name="workout" options={{ href: null }} />
      <Tabs.Screen name="coach" options={{ href: null }} />
      <Tabs.Screen name="demo" options={{ href: null }} />
    </Tabs>
  );
}
