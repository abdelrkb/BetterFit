import { Mascot } from '@betterfit/mascot';
import type { ClientSummary } from '@betterfit/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { activateCoach, fetchMyCoaching, listClients } from '@/lib/coaching';
import { decimal } from '@/lib/format';
import { errorMessage } from '@/lib/errors';
import {
  Banner,
  Body,
  Button,
  Caption,
  Card,
  Chip,
  Heading,
  HeroCard,
  Overline,
  Screen,
  TextField,
  Title,
  colors,
  spacing,
} from '@/ui';

/**
 * L'Espace coach.
 *
 * Tant qu'il n'est pas activé, l'écran propose de l'ouvrir : il n'y a qu'un
 * type de compte, devenir coach est une bascule, pas une inscription à part.
 */
export default function CoachScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();

  /**
   * Heure de référence, figée à l'ouverture : « il y a 3 jours » ne doit pas
   * changer tout seul au moindre nouveau rendu.
   */
  const [now] = useState(() => Date.now());

  const coaching = useQuery({ queryKey: ['coaching'], queryFn: fetchMyCoaching });

  const clients = useQuery({
    queryKey: ['coach', 'clients'],
    queryFn: listClients,
    enabled: coaching.data?.isCoach === true,
  });

  if (coaching.isPending) {
    return (
      <Screen>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  if (coaching.isError) {
    return (
      <Screen>
        <Banner message={errorMessage(coaching.error)} />
        <Button block variant="ghost" label={t('common.back')} onPress={() => router.back()} />
      </Screen>
    );
  }

  if (!coaching.data?.isCoach) {
    return <Activate onDone={() => void queryClient.invalidateQueries({ queryKey: ['coaching'] })} />;
  }

  return (
    <Screen>
      <HeroCard>
        <View style={styles.heroRow}>
          <View style={styles.heroText}>
            <Overline onDark>{t('coach.overline')}</Overline>
            <Title onDark>{t('coach.title')}</Title>
            <Body onDark>{t('coach.subtitle')}</Body>
          </View>
          <Mascot pose="flex" size={88} tone="onDark" />
        </View>
      </HeroCard>

      <Link href="/coach/invite" asChild>
        <Button block label={t('coach.invite')} onPress={() => {}} />
      </Link>

      {clients.isError ? <Banner message={errorMessage(clients.error)} /> : null}

      {clients.isPending ? (
        <ActivityIndicator color={colors.accent} />
      ) : clients.data && clients.data.items.length > 0 ? (
        clients.data.items.map((client) => (
          <ClientCard
            key={client.userId}
            client={client}
            now={now}
            onPress={() => router.push(`/coach/${client.userId}`)}
          />
        ))
      ) : (
        <Card tone="soft" style={styles.empty}>
          <Mascot pose="stand" size={110} />
          <Heading>{t('coach.noClient')}</Heading>
          <Body style={styles.center}>{t('coach.noClientHint')}</Body>
        </Card>
      )}

      <Button block variant="ghost" label={t('common.back')} onPress={() => router.back()} />
    </Screen>
  );
}

/** Carte d'un client : l'activité récente saute aux yeux. */
function ClientCard({
  client,
  now,
  onPress,
}: {
  client: ClientSummary;
  /** Heure de référence, figée à l'ouverture de l'écran. */
  now: number;
  onPress: () => void;
}) {
  const { t } = useTranslation();

  const days =
    client.lastWorkoutAt === null
      ? null
      : Math.floor((now - new Date(client.lastWorkoutAt).getTime()) / 86_400_000);

  // Trois semaines sans séance : c'est le moment de reprendre contact.
  const quiet = days === null || days > 21;

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={client.name} onPress={onPress}>
      <Card title={client.name}>
        <View style={styles.chips}>
          <Chip
            tone={quiet ? 'outline' : 'dark'}
            label={
              days === null
                ? t('coach.neverTrained')
                : days === 0
                  ? t('coach.trainedToday')
                  : t('coach.lastWorkout', { count: days })
            }
          />
          <Chip label={t('coach.workoutsMonth', { count: client.workoutsLast28Days })} />
          {client.assignedPrograms > 0 ? (
            <Chip tone="outline" label={t('coach.programs', { count: client.assignedPrograms })} />
          ) : null}
        </View>
        {client.latestWeightKg !== null ? (
          <Caption>{t('coach.lastWeight', { value: decimal(client.latestWeightKg) })}</Caption>
        ) : null}
      </Card>
    </Pressable>
  );
}

/** Ouverture de l'Espace coach. */
function Activate({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [contact, setContact] = useState('');
  const [error, setError] = useState<string | null>(null);

  const activate = useMutation({
    mutationFn: () =>
      activateCoach({
        displayName: displayName.trim(),
        contact: contact.trim(),
        accentColor: '#6B3FD9',
      }),
    onSuccess: onDone,
    onError: (caught) => setError(errorMessage(caught)),
  });

  return (
    <Screen>
      <Title>{t('coach.activateTitle')}</Title>
      <Body>{t('coach.activateBody')}</Body>

      <Card>
        {error ? <Banner message={error} /> : null}

        <TextField
          label={t('coach.displayName')}
          hint={t('coach.displayNameHint')}
          placeholder={t('coach.displayNamePlaceholder')}
          value={displayName}
          onChangeText={setDisplayName}
        />
        <TextField
          label={t('coach.contact')}
          hint={t('coach.contactHint')}
          value={contact}
          onChangeText={setContact}
        />
      </Card>

      <Button
        block
        label={t('coach.activate')}
        loading={activate.isPending}
        disabled={displayName.trim().length === 0}
        onPress={() => activate.mutate()}
      />
      <Button block variant="ghost" label={t('common.back')} onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  heroText: { flex: 1, gap: spacing.sm, minWidth: 180 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  empty: { alignItems: 'center', gap: spacing.sm },
  center: { textAlign: 'center' },
});
