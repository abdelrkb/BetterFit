import { invitationCodeSchema } from '@betterfit/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import {
  acceptProposal,
  declineProposal,
  endCoaching,
  fetchMyCoaching,
  joinWithCode,
} from '@/lib/coaching';
import { errorMessage } from '@/lib/errors';
import { Banner, Body, Button, Caption, Card, Heading, TextField, spacing } from '@/ui';

/**
 * Le coaching vu du côté client.
 *
 * Trois états : une proposition en attente (à accepter ou refuser), un coach
 * actif, ou rien — auquel cas on propose de saisir un code.
 */
export function CoachingCard() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const coaching = useQuery({ queryKey: ['coaching'], queryFn: fetchMyCoaching });

  function refresh() {
    setError(null);
    void queryClient.invalidateQueries({ queryKey: ['coaching'] });
    void queryClient.invalidateQueries({ queryKey: ['programs'] });
  }

  const accept = useMutation({
    mutationFn: acceptProposal,
    onSuccess: refresh,
    onError: (caught) => setError(errorMessage(caught)),
  });

  const decline = useMutation({
    mutationFn: declineProposal,
    onSuccess: refresh,
    onError: (caught) => setError(errorMessage(caught)),
  });

  const end = useMutation({
    mutationFn: endCoaching,
    onSuccess: refresh,
    onError: (caught) => setError(errorMessage(caught)),
  });

  const join = useMutation({
    mutationFn: () => {
      const parsed = invitationCodeSchema.safeParse(code);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'code');

      return joinWithCode(parsed.data);
    },
    onSuccess: () => {
      setCode('');
      refresh();
    },
    onError: (caught) => setError(errorMessage(caught)),
  });

  if (coaching.isPending || !coaching.data) return null;

  const { coach, pending } = coaching.data;

  if (pending.length > 0) {
    return (
      <Card overline={t('coaching.proposalOverline')} title={t('coaching.proposalTitle')}>
        {error ? <Banner message={error} /> : null}

        {pending.map((proposal) => (
          <View key={proposal.relationId} style={styles.block}>
            <Heading>{proposal.coachName}</Heading>
            {proposal.contact.length > 0 ? <Caption>{proposal.contact}</Caption> : null}
            <Body>{t('coaching.proposalBody', { name: proposal.coachName })}</Body>

            <Button
              block
              label={t('coaching.accept')}
              loading={accept.isPending}
              onPress={() => accept.mutate(proposal.relationId)}
            />
            <Button
              block
              variant="ghost"
              label={t('coaching.decline')}
              loading={decline.isPending}
              onPress={() => decline.mutate(proposal.relationId)}
            />
          </View>
        ))}
      </Card>
    );
  }

  if (coach) {
    return (
      <Card overline={t('coaching.myCoachOverline')} title={coach.displayName}>
        {error ? <Banner message={error} /> : null}

        {coach.contact.length > 0 ? <Caption>{coach.contact}</Caption> : null}
        <Caption>
          {t('coaching.since', { date: new Date(coach.since).toLocaleDateString('fr-FR') })}
        </Caption>
        <Body>{t('coaching.sharedData')}</Body>

        <Button
          block
          variant="ghost"
          label={t('coaching.end')}
          loading={end.isPending}
          onPress={() => end.mutate(coach.relationId)}
        />
      </Card>
    );
  }

  return (
    <Card overline={t('coaching.joinOverline')} title={t('coaching.joinTitle')}>
      {error ? <Banner message={error} /> : null}

      <Body>{t('coaching.joinBody')}</Body>

      <TextField
        label={t('coaching.codeLabel')}
        placeholder="A2B3C4"
        value={code}
        onChangeText={(value) => setCode(value.toUpperCase())}
        autoCapitalize="characters"
        maxLength={6}
      />

      <Button
        block
        variant="secondary"
        label={t('coaching.join')}
        loading={join.isPending}
        disabled={code.trim().length === 0}
        onPress={() => {
          setError(null);
          join.mutate();
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
});
