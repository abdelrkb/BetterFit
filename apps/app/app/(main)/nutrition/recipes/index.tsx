import { Mascot } from '@betterfit/mascot';
import { totalMinutes, type Recipe } from '@betterfit/shared';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import { apiBaseUrl } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { listRecipes } from '@/lib/recipes';
import {
  Banner,
  Body,
  Button,
  Caption,
  Card,
  Chip,
  Heading,
  Screen,
  Title,
  colors,
  radii,
  spacing,
} from '@/ui';

/** Mes recettes. */
export default function RecipesScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const recipes = useQuery({ queryKey: ['recipes'], queryFn: listRecipes });

  return (
    <Screen>
      <Title>{t('recipes.title')}</Title>

      <Button
        block
        label={t('recipes.create')}
        onPress={() => router.push('/nutrition/recipes/edit')}
      />

      {recipes.isError ? <Banner message={errorMessage(recipes.error)} /> : null}

      {recipes.isPending ? <ActivityIndicator color={colors.accent} /> : null}

      {recipes.data?.items.length === 0 ? (
        <Card tone="soft" style={styles.empty}>
          <Mascot pose="stand" size={96} />
          <Heading>{t('recipes.emptyTitle')}</Heading>
          <Body style={styles.center}>{t('recipes.emptyBody')}</Body>
        </Card>
      ) : null}

      {recipes.data?.items.map((recipe) => (
        <RecipeCard
          key={recipe.id}
          recipe={recipe}
          onPress={() => router.push(`/nutrition/recipes/edit?id=${recipe.id}`)}
        />
      ))}

      <Button block variant="ghost" label={t('common.back')} onPress={() => router.back()} />
    </Screen>
  );
}

function RecipeCard({ recipe, onPress }: { recipe: Recipe; onPress: () => void }) {
  const { t } = useTranslation();
  const minutes = totalMinutes(recipe);

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={recipe.title} onPress={onPress}>
      <Card title={recipe.title}>
        {recipe.photoUrl ? (
          <Image
            // L'adresse est signée par l'API : une balise <img> ne peut pas
            // porter de jeton d'authentification.
            source={{ uri: `${apiBaseUrl}${recipe.photoUrl}` }}
            style={styles.photo}
            accessibilityLabel={t('recipes.photoOf', { title: recipe.title })}
          />
        ) : null}

        <View style={styles.chips}>
          {recipe.category.length > 0 ? <Chip tone="dark" label={recipe.category} /> : null}
          {minutes !== null ? <Chip label={t('recipes.minutes', { count: minutes })} /> : null}
          <Chip label={t('recipes.servings', { count: recipe.servings })} />
        </View>

        {recipe.kcal !== null ? (
          <Caption>{t('recipes.perServing', { kcal: recipe.kcal })}</Caption>
        ) : null}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', gap: spacing.sm },
  center: { textAlign: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  photo: { width: '100%', height: 160, borderRadius: radii.tile, backgroundColor: colors.accentSoft },
});
