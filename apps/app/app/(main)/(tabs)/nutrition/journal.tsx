import {
  MEAL_SLOTS,
  MEAL_SLOT_LABELS_FR,
  shiftDate,
  today,
  type Food,
  type MealSlot,
} from '@betterfit/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { BarcodeScanner } from '@/components/BarcodeScanner';
import { CalorieRing } from '@/components/CalorieRing';
import { FoodPicker } from '@/components/FoodPicker';
import { QuickAddForm } from '@/components/QuickAddForm';
import { errorMessage } from '@/lib/errors';
import { decimal } from '@/lib/format';
import {
  addJournalEntry,
  copyJournalDay,
  deleteJournalEntry,
  fetchJournalDay,
  fetchRecents,
  lookupBarcode,
} from '@/lib/journal';
import {
  Banner,
  Body,
  Button,
  Caption,
  Card,
  Chip,
  Screen,
  Title,
  colors,
  radii,
  spacing,
} from '@/ui';

type Adding = { slot: MealSlot; how: 'search' | 'scan' | 'quick' } | null;

/**
 * Le journal du jour.
 *
 * Il fonctionne **sans programme** : on note ce qu'on mange, et les cibles
 * viennent du plan s'il y en a un, du profil sinon. Trois façons d'ajouter,
 * comme dans le cahier des charges : chercher, scanner, ou saisir vite fait.
 */
export default function JournalScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [date, setDate] = useState(() => today());
  const [adding, setAdding] = useState<Adding>(null);
  const [error, setError] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);

  const day = useQuery({ queryKey: ['journal', date], queryFn: () => fetchJournalDay(date) });

  const recents = useQuery({ queryKey: ['journal', 'recents'], queryFn: fetchRecents });

  function onSaved(saved: Awaited<ReturnType<typeof fetchJournalDay>>) {
    queryClient.setQueryData(['journal', saved.date], saved);
    void queryClient.invalidateQueries({ queryKey: ['journal', 'recents'] });
    setAdding(null);
    setError(null);
  }

  const add = useMutation({
    mutationFn: addJournalEntry,
    onSuccess: onSaved,
    onError: (caught) => setError(errorMessage(caught)),
  });

  const remove = useMutation({
    mutationFn: deleteJournalEntry,
    onSuccess: onSaved,
    onError: (caught) => setError(errorMessage(caught)),
  });

  const copyYesterday = useMutation({
    mutationFn: () => copyJournalDay({ from: shiftDate(date, -1), to: date }),
    onSuccess: onSaved,
    onError: (caught) => setError(errorMessage(caught)),
  });

  /** Ajoute un aliment de la base, avec sa quantité. */
  function logFood(slot: MealSlot, food: Food, grams: number) {
    add.mutate({
      date,
      slot,
      foodId: food.id,
      label: food.name,
      quantityG: grams,
      quantityText: `${decimal(grams, 0)} g`,
      kcal: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
    });
  }

  if (adding?.how === 'search') {
    return (
      <FoodPicker
        onCancel={() => setAdding(null)}
        onCreate={() => {
          setAdding(null);
          router.push('/nutrition/foods/edit');
        }}
        onPick={(food, grams) => logFood(adding.slot, food, grams)}
      />
    );
  }

  if (adding?.how === 'scan') {
    return (
      <BarcodeScanner
        onCancel={() => setAdding(null)}
        onScanned={async (barcode) => {
          setLooking(true);
          setError(null);

          try {
            const food = await lookupBarcode(barcode);

            if (!food) {
              setError(t('journal.scanNotFound'));
              setAdding({ slot: adding.slot, how: 'quick' });
              return;
            }

            // Une portion par défaut, modifiable ensuite dans la liste.
            logFood(adding.slot, food, food.servingG ?? 100);
          } catch (caught) {
            setError(errorMessage(caught));
            setAdding(null);
          } finally {
            setLooking(false);
          }
        }}
      />
    );
  }

  if (adding?.how === 'quick') {
    return (
      <QuickAddForm
        onCancel={() => setAdding(null)}
        onSubmit={(entry) =>
          add.mutate({
            date,
            slot: adding.slot,
            foodId: null,
            quantityG: null,
            quantityText: '',
            ...entry,
          })
        }
      />
    );
  }

  if (day.isPending) {
    return (
      <Screen>
        <Title>{t('journal.title')}</Title>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  if (day.isError || !day.data) {
    return (
      <Screen>
        <Title>{t('journal.title')}</Title>
        <Banner message={errorMessage(day.error)} />
      </Screen>
    );
  }

  const { entries, slotTotals, totals, targets, targetsFrom } = day.data;
  const isToday = date === today();

  return (
    <Screen>
      <Title>{t('journal.title')}</Title>

      {error ? <Banner message={error} /> : null}
      {looking ? <Caption>{t('journal.looking')}</Caption> : null}

      {/*
        Navigation entre les jours : la date au-dessus, les deux boutons en
        dessous. Les trois sur une ligne ne tiennent pas à 390 px et la barre
        se cassait en trois lignes bancales.
      */}
      <View style={styles.dayHeader}>
        <Body style={styles.dayLabel}>
          {isToday
            ? t('journal.today')
            : new Date(`${date}T12:00:00Z`).toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
        </Body>

        <View style={styles.dayButtons}>
          <Button
            style={styles.dayButton}
            variant="secondary"
            label={t('journal.previousDay')}
            onPress={() => setDate(shiftDate(date, -1))}
          />
          <Button
            style={styles.dayButton}
            variant="secondary"
            label={t('journal.nextDay')}
            disabled={isToday}
            onPress={() => setDate(shiftDate(date, 1))}
          />
        </View>
      </View>

      <Card overline={t('journal.dayOverline')} title={t('journal.dayTitle')}>
        {targets === null ? (
          <>
            <Body>{t('journal.noTarget')}</Body>
            <Caption>{t('journal.eatenOnly', { kcal: totals.kcal })}</Caption>
          </>
        ) : (
          <>
            <CalorieRing targetKcal={targets.targetKcal} consumedKcal={totals.kcal} />
            <Caption style={styles.center}>
              {t(targetsFrom === 'program' ? 'journal.fromProgram' : 'journal.fromProfile')}
            </Caption>
          </>
        )}

        <Caption>
          {t('journal.macroTotals', {
            protein: decimal(totals.proteinG, 0),
            carbs: decimal(totals.carbsG, 0),
            fat: decimal(totals.fatG, 0),
          })}
        </Caption>
      </Card>

      {entries.length === 0 ? (
        <Button
          block
          variant="secondary"
          label={t('journal.copyYesterday')}
          loading={copyYesterday.isPending}
          onPress={() => copyYesterday.mutate()}
        />
      ) : null}

      {MEAL_SLOTS.map((slot) => {
        const lines = entries.filter((entry) => entry.slot === slot);

        return (
          <Card
            key={slot}
            title={MEAL_SLOT_LABELS_FR[slot]}
            trailing={
              slotTotals[slot] && slotTotals[slot].kcal > 0 ? (
                <Chip tone="dark" label={t('journal.kcal', { kcal: slotTotals[slot].kcal })} />
              ) : null
            }
          >
            {lines.length === 0 ? <Caption>{t('journal.nothingYet')}</Caption> : null}

            {lines.map((entry) => (
              <View key={entry.id} style={styles.entry}>
                <View style={styles.entryText}>
                  <Body>{entry.label}</Body>
                  <Caption>
                    {[
                      entry.quantityText,
                      entry.kcal === null ? null : t('journal.kcal', { kcal: Math.round(entry.kcal) }),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Caption>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('journal.removeEntry', { name: entry.label })}
                  onPress={() => remove.mutate(entry.id)}
                  style={styles.remove}
                >
                  <Caption>{t('common.remove')}</Caption>
                </Pressable>
              </View>
            ))}

            <View style={styles.actions}>
              <Button
                label={t('journal.search')}
                onPress={() => setAdding({ slot, how: 'search' })}
              />
              <Button
                variant="secondary"
                label={t('journal.scan')}
                onPress={() => setAdding({ slot, how: 'scan' })}
              />
              <Button
                variant="ghost"
                label={t('journal.quick')}
                onPress={() => setAdding({ slot, how: 'quick' })}
              />
            </View>
          </Card>
        );
      })}

      {recents.data && recents.data.items.length > 0 ? (
        <Card title={t('journal.recentsTitle')}>
          <Caption>{t('journal.recentsHint')}</Caption>
          <View style={styles.chips}>
            {recents.data.items.slice(0, 8).map((entry) => (
              <Chip
                key={entry.id}
                label={entry.label}
                onPress={() =>
                  add.mutate({
                    date,
                    slot: 'snack',
                    foodId: entry.foodId,
                    label: entry.label,
                    quantityG: entry.quantityG,
                    quantityText: entry.quantityText,
                    kcal: entry.kcal,
                    proteinG: entry.proteinG,
                    carbsG: entry.carbsG,
                    fatG: entry.fatG,
                  })
                }
              />
            ))}
          </View>
        </Card>
      ) : null}

      <Button block variant="ghost" label={t('common.back')} onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  dayHeader: { gap: spacing.sm },
  dayLabel: { textAlign: 'center' },
  dayButtons: { flexDirection: 'row', gap: spacing.sm },
  dayButton: { flex: 1 },
  center: { textAlign: 'center' },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.tile,
    backgroundColor: colors.accentSoft,
  },
  entryText: { flex: 1, gap: 2 },
  remove: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
