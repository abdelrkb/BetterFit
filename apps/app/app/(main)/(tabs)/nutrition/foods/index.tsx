import { Mascot } from '@betterfit/mascot';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { errorMessage } from '@/lib/errors';
import { searchFoods } from '@/lib/foods';
import { Banner, Body, Button, Caption, Card, Heading, Screen, Title, colors, spacing } from '@/ui';

/** Mes aliments : ceux que j'ai créés moi-même. */
export default function MyFoodsScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const foods = useQuery({
    queryKey: ['foods', 'mine'],
    queryFn: () => searchFoods({ mine: true }),
  });

  return (
    <Screen>
      <Title>{t('foods.myTitle')}</Title>
      <Body>{t('foods.mySubtitle')}</Body>

      <Button
        block
        label={t('foods.create')}
        onPress={() => router.push('/nutrition/foods/edit')}
      />

      {foods.isError ? <Banner message={errorMessage(foods.error)} /> : null}
      {foods.isPending ? <ActivityIndicator color={colors.accent} /> : null}

      {foods.data?.items.length === 0 ? (
        <Card tone="soft" style={styles.empty}>
          <Mascot pose="stand" size={96} />
          <Heading>{t('foods.myEmptyTitle')}</Heading>
          <Body style={styles.center}>{t('foods.myEmptyBody')}</Body>
        </Card>
      ) : null}

      {foods.data?.items.map((food) => (
        <Pressable
          key={food.id}
          accessibilityRole="button"
          accessibilityLabel={food.name}
          onPress={() => router.push(`/nutrition/foods/edit?id=${food.id}`)}
        >
          <Card title={food.name}>
            {food.brand.length > 0 ? <Caption>{food.brand}</Caption> : null}
            <Caption>
              {food.kcal === null
                ? t('foods.unknownKcal')
                : t('foods.per100', { kcal: food.kcal })}
            </Caption>
          </Card>
        </Pressable>
      ))}

      <Button block variant="ghost" label={t('common.back')} onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', gap: spacing.sm },
  center: { textAlign: 'center' },
});
