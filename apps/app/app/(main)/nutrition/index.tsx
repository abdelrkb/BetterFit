import { Mascot } from '@betterfit/mascot';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { CalorieRing } from '@/components/CalorieRing';
import { MacroBars } from '@/components/MacroBars';
import { DayPlan } from '@/components/nutrition/DayPlan';
import { DeficitPage } from '@/components/nutrition/DeficitPage';
import { ShoppingList } from '@/components/nutrition/ShoppingList';
import { errorMessage } from '@/lib/errors';
import { fetchNutritionProgram, listNutritionPrograms } from '@/lib/nutrition';
import { useDailyTargets } from '@/lib/use-daily-targets';
import { useSession } from '@/stores/session';
import { Banner, Body, Button, Card, Caption, Screen, Tabs, Title, colors, spacing } from '@/ui';

type View = 'day' | 'shopping' | 'deficit';

/**
 * L'onglet Nutrition.
 *
 * Trois vues : la journée type, la liste de courses et la page du déficit.
 * Sans programme, on affiche quand même les objectifs déduits du profil :
 * quelqu'un qui vient d'arriver doit voir ses chiffres avant d'avoir construit
 * quoi que ce soit.
 */
export default function NutritionScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [view, setView] = useState<View>('day');
  const userId = useSession((state) => state.user?.id);
  const profileTargets = useDailyTargets();

  const list = useQuery({
    queryKey: ['nutrition-programs'],
    queryFn: () => listNutritionPrograms({ templates: false }),
  });

  // Le plus récemment modifié : c'est le plan en cours, qu'il vienne du coach
  // ou de la personne elle-même.
  const activeId = list.data?.items[0]?.id;

  const program = useQuery({
    queryKey: ['nutrition-program', activeId],
    queryFn: () => fetchNutritionProgram(activeId!),
    enabled: Boolean(activeId),
  });

  if (list.isPending) {
    return (
      <Screen>
        <Title>{t('nutrition.title')}</Title>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  if (list.isError) {
    return (
      <Screen>
        <Title>{t('nutrition.title')}</Title>
        <Banner message={errorMessage(list.error)} />
      </Screen>
    );
  }

  if (!activeId || !program.data) {
    return (
      <Screen>
        <Title>{t('nutrition.title')}</Title>

        {profileTargets === null ? (
          <Card title={t('nutrition.noProfileTitle')}>
            <Body>{t('nutrition.noProfileBody')}</Body>
          </Card>
        ) : (
          <>
            <Card overline={t('nutrition.todayOverline')} title={t('nutrition.todayTitle')}>
              <CalorieRing targetKcal={profileTargets.targetKcal} consumedKcal={0} />
              <Caption>{t('nutrition.fromProfile')}</Caption>
            </Card>

            <Card title={t('nutrition.macrosTitle')}>
              <MacroBars targets={profileTargets} />
            </Card>
          </>
        )}

        <Button
          block
          label={t('nutrition.openJournal')}
          onPress={() => router.push('/nutrition/journal')}
        />

        <Card tone="soft" style={styles.empty}>
          <Mascot pose="stand" size={96} />
          <Body style={styles.center}>{t('nutrition.noPlanBody')}</Body>
          <Button
            block
            variant="secondary"
            label={t('nutrition.createPlan')}
            onPress={() => router.push('/nutrition/edit')}
          />
        </Card>
      </Screen>
    );
  }

  const plan = program.data;
  const mine = plan.ownerId === userId;

  return (
    <Screen>
      <Title>{plan.title}</Title>
      {mine ? null : <Caption>{t('nutrition.fromCoach')}</Caption>}

      {plan.settings.goalTitle.length > 0 ? <Body>{plan.settings.goalTitle}</Body> : null}

      <Button
        block
        label={t('nutrition.openJournal')}
        onPress={() => router.push('/nutrition/journal')}
      />

      <Tabs
        value={view}
        onChange={setView}
        items={[
          { value: 'day', label: t('nutrition.tabDay') },
          { value: 'shopping', label: t('nutrition.tabShopping') },
          { value: 'deficit', label: t('nutrition.tabDeficit') },
        ]}
      />

      {view === 'day' ? <DayPlan program={plan} /> : null}
      {view === 'shopping' ? <ShoppingList program={plan} /> : null}
      {view === 'deficit' ? <DeficitPage targets={plan.targets} /> : null}

      {/* Un plan reçu d'un coach se consulte, il ne se modifie pas. */}
      {mine ? (
        <Button
          block
          variant="secondary"
          label={t('nutrition.editPlan')}
          onPress={() => router.push(`/nutrition/edit?id=${plan.id}`)}
        />
      ) : null}

      <Button
        block
        variant="ghost"
        label={t('nutrition.openRecipes')}
        onPress={() => router.push('/nutrition/recipes')}
      />

      <Button
        block
        variant="ghost"
        label={t('nutrition.openFoods')}
        onPress={() => router.push('/nutrition/foods')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', gap: spacing.md },
  center: { textAlign: 'center' },
});
