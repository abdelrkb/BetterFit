import { mealTotals, type NutritionProgram } from '@betterfit/shared';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { CalorieRing } from '@/components/CalorieRing';
import { MacroBars } from '@/components/MacroBars';
import { decimal } from '@/lib/format';
import { Body, Caption, Card, Chip, Heading, colors, radii, spacing } from '@/ui';

/**
 * La journée type : les repas, leurs lignes, et ce qu'ils totalisent.
 *
 * Chaque repas affiche son total à côté de son nom. En bas, l'anneau compare
 * le total de la journée à la cible — la cible est ce qu'on vise, le total ce
 * que le plan propose réellement : l'écart est l'information utile.
 */
export function DayPlan({ program }: { program: NutritionProgram }) {
  const { t } = useTranslation();

  return (
    <>
      <Card overline={t('nutrition.todayOverline')} title={t('nutrition.planTotalTitle')}>
        <CalorieRing
          mode="planned"
          targetKcal={program.targets.targetKcal}
          consumedKcal={program.dayTotals.kcal}
        />
      </Card>

      <Card title={t('nutrition.macrosTitle')}>
        <MacroBars targets={program.targets} />
        <Caption>
          {t('nutrition.plannedMacros', {
            protein: decimal(program.dayTotals.proteinG, 0),
            carbs: decimal(program.dayTotals.carbsG, 0),
            fat: decimal(program.dayTotals.fatG, 0),
          })}
        </Caption>
      </Card>

      {program.meals.length === 0 ? (
        <Card tone="soft">
          <Body>{t('nutrition.noMeals')}</Body>
        </Card>
      ) : null}

      {program.meals.map((meal) => {
        const totals = mealTotals(meal);

        return (
          <Card
            key={meal.id}
            title={meal.name}
            trailing={
              totals.kcal > 0 ? (
                <Chip tone="dark" label={t('nutrition.mealKcal', { kcal: totals.kcal })} />
              ) : null
            }
          >
            {meal.time.length > 0 ? <Caption>{meal.time}</Caption> : null}

            {meal.items.length === 0 ? (
              <Caption>{t('nutrition.noItems')}</Caption>
            ) : (
              <View style={styles.items}>
                {meal.items.map((item, index) => (
                  <View key={item.id ?? index} style={styles.item}>
                    <View style={styles.itemHead}>
                      <Body style={styles.itemLabel}>
                        {item.label.length > 0 ? item.label : t('nutrition.unnamedItem')}
                      </Body>
                      {item.quantity.length > 0 ? <Caption>{item.quantity}</Caption> : null}
                    </View>

                    {item.alternative.length > 0 ? (
                      <Caption>{t('nutrition.orElse', { food: item.alternative })}</Caption>
                    ) : null}

                    {item.kcal !== null ? (
                      <Caption>{t('nutrition.mealKcal', { kcal: item.kcal })}</Caption>
                    ) : null}
                  </View>
                ))}
              </View>
            )}
          </Card>
        );
      })}

      {program.settings.preferred.length > 0 || program.settings.limited.length > 0 ? (
        <Card title={t('nutrition.foodsTitle')}>
          {program.settings.preferred.length > 0 ? (
            <View style={styles.block}>
              <Heading>{t('nutrition.preferred')}</Heading>
              {program.settings.preferred.map((food) => (
                <Body key={food}>· {food}</Body>
              ))}
            </View>
          ) : null}

          {program.settings.limited.length > 0 ? (
            <View style={styles.block}>
              <Heading>{t('nutrition.limited')}</Heading>
              {program.settings.limited.map((food) => (
                <Body key={food}>· {food}</Body>
              ))}
            </View>
          ) : null}
        </Card>
      ) : null}

      {program.settings.coachNote.length > 0 ? (
        <Card tone="soft" overline={t('nutrition.coachNoteOverline')}>
          <Body>{program.settings.coachNote}</Body>
        </Card>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  items: { gap: spacing.sm },
  item: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.tile,
    backgroundColor: colors.accentSoft,
  },
  itemHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing.md,
  },
  itemLabel: { flex: 1 },
  block: { gap: spacing.xs },
});
