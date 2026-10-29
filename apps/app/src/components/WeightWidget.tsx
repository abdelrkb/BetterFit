import { WEIGHT_KG_MAX, WEIGHT_KG_MIN } from '@betterfit/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { errorMessage } from '@/lib/errors';
import { decimal } from '@/lib/format';
import { fetchWeightHistory, saveWeight } from '@/lib/weight';
import { useSession } from '@/stores/session';
import { Banner, Body, Button, Caption, Card, Metric, TextField, colors, spacing } from '@/ui';

/**
 * Le poids du jour, modifiable depuis l'accueil.
 *
 * On affiche la dernière pesée et, à côté, la variation de **tendance** sur
 * sept jours — jamais l'écart entre deux pesées, qui ne veut rien dire. Tant
 * qu'il n'y a pas une semaine de recul, la variation n'est pas annoncée.
 */
export function WeightWidget() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const setLatestWeightKg = useSession((state) => state.setLatestWeightKg);

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const history = useQuery({ queryKey: ['weight'], queryFn: () => fetchWeightHistory() });

  const save = useMutation({
    mutationFn: () => {
      // La virgule française avant tout : « 78,4 » doit passer.
      const weightKg = Number(value.replace(',', '.'));

      if (!Number.isFinite(weightKg) || weightKg < WEIGHT_KG_MIN || weightKg > WEIGHT_KG_MAX) {
        throw new Error(t('home.weightInvalid', { min: WEIGHT_KG_MIN, max: WEIGHT_KG_MAX }));
      }

      return saveWeight({ weightKg });
    },
    onSuccess: (data) => {
      setLatestWeightKg(data.latestWeightKg);
      setEditing(false);
      setValue('');
      setError(null);
      queryClient.setQueryData(['weight'], data);
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  const latest = history.data?.latestWeightKg ?? null;
  const change = history.data?.weeklyChangeKg ?? null;

  return (
    <Card overline={t('home.weightOverline')} title={t('home.weightTitle')}>
      {error ? <Banner message={error} /> : null}

      {editing ? (
        <View style={styles.form}>
          <TextField
            label={t('home.weightLabel')}
            value={value}
            onChangeText={setValue}
            keyboardType="decimal-pad"
            placeholder={latest === null ? '70' : decimal(latest)}
            autoFocus
          />
          <View style={styles.actions}>
            <Button
              label={t('common.save')}
              loading={save.isPending}
              disabled={value.trim().length === 0}
              onPress={() => {
                setError(null);
                save.mutate();
              }}
            />
            <Button
              variant="ghost"
              label={t('common.cancel')}
              onPress={() => {
                setEditing(false);
                setError(null);
              }}
            />
          </View>
        </View>
      ) : (
        <View style={styles.row}>
          <View style={styles.value}>
            <Metric>{latest === null ? '—' : decimal(latest)}</Metric>
            <Caption>{latest === null ? t('home.noWeight') : t('home.weightUnit')}</Caption>
          </View>

          <View style={styles.trend}>
            {change === null ? (
              <Caption>{t('home.weightNoTrend')}</Caption>
            ) : (
              <>
                <Body style={change > 0 ? styles.up : styles.down}>
                  {t(change > 0 ? 'home.weightUp' : 'home.weightDown', {
                    value: decimal(Math.abs(change)),
                  })}
                </Body>
                <Caption>{t('home.weightTrendLabel')}</Caption>
              </>
            )}
          </View>
        </View>
      )}

      {editing ? null : (
        <Button
          block
          variant="secondary"
          label={latest === null ? t('home.weightFirst') : t('home.weightUpdate')}
          onPress={() => {
            setValue(latest === null ? '' : decimal(latest));
            setEditing(true);
          }}
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, flexWrap: 'wrap' },
  value: { gap: spacing.xs, minWidth: 90 },
  trend: { flex: 1, gap: spacing.xs, minWidth: 120 },
  form: { gap: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  // La flèche du texte dit déjà le sens : la couleur ne fait que l'appuyer.
  up: { color: colors.warning },
  down: { color: colors.success },
});
