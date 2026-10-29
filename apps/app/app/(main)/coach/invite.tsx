import { emailSchema, type Invitation } from '@betterfit/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Share, StyleSheet, View } from 'react-native';
import { cancelInvitation, createInvitation, listInvitations } from '@/lib/coaching';
import { errorMessage } from '@/lib/errors';
import {
  Banner,
  Body,
  Button,
  Caption,
  Card,
  Chip,
  Heading,
  Metric,
  Overline,
  Screen,
  Tabs,
  TextField,
  Title,
  colors,
  spacing,
} from '@/ui';

type Mode = 'code' | 'email' | 'in_app';

/** Les trois façons d'inviter un client, sur un seul écran. */
export default function InviteScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<Mode>('code');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Invitation | null>(null);

  const invitations = useQuery({ queryKey: ['coach', 'invitations'], queryFn: listInvitations });

  const invite = useMutation({
    mutationFn: async () => {
      if (mode === 'code') return createInvitation({ kind: 'code' });

      const parsed = emailSchema.safeParse(email);
      if (!parsed.success) throw new Error('email');

      return createInvitation({ kind: mode, email: parsed.data });
    },
    onSuccess: async (invitation) => {
      setCreated(invitation);
      setEmail('');
      await queryClient.invalidateQueries({ queryKey: ['coach', 'invitations'] });
    },
    onError: (caught) =>
      setError(caught instanceof Error && caught.message === 'email'
        ? t('coach.invalidEmail')
        : errorMessage(caught)),
  });

  const cancel = useMutation({
    mutationFn: cancelInvitation,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['coach', 'invitations'] }),
  });

  return (
    <Screen>
      <Title>{t('coach.inviteTitle')}</Title>

      <Tabs
        value={mode}
        onChange={(value) => {
          setMode(value);
          setCreated(null);
          setError(null);
        }}
        items={[
          { value: 'code', label: t('coach.modeCode') },
          { value: 'email', label: t('coach.modeEmail') },
          { value: 'in_app', label: t('coach.modeInApp') },
        ]}
      />

      <Card>
        {error ? <Banner message={error} /> : null}

        <Body>{t(`coach.explain.${mode}`)}</Body>

        {mode !== 'code' ? (
          <TextField
            label={t('auth.emailLabel')}
            placeholder={t('auth.emailPlaceholder')}
            value={email}
            onChangeText={setEmail}
            inputMode="email"
            autoCapitalize="none"
          />
        ) : null}

        <Button
          block
          label={t(`coach.action.${mode}`)}
          loading={invite.isPending}
          onPress={() => {
            setError(null);
            invite.mutate();
          }}
        />
      </Card>

      {created ? <CreatedCard invitation={created} /> : null}

      <Heading>{t('coach.pendingTitle')}</Heading>

      {invitations.isPending ? (
        <ActivityIndicator color={colors.accent} />
      ) : invitations.data && invitations.data.items.length > 0 ? (
        invitations.data.items.map((invitation) => (
          <Card key={invitation.id}>
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Body style={styles.strong}>
                  {invitation.code ?? invitation.targetName ?? invitation.email}
                </Body>
                <Caption>
                  {t(`coach.kind.${invitation.kind}`)} ·{' '}
                  {t(`coach.status.${invitation.status}`)}
                </Caption>
              </View>
              <Chip
                tone={invitation.status === 'pending' ? 'dark' : 'outline'}
                label={t(`coach.status.${invitation.status}`)}
              />
            </View>

            {invitation.status === 'pending' ? (
              <Button
                variant="ghost"
                label={t('coach.cancelInvitation')}
                loading={cancel.isPending}
                onPress={() => cancel.mutate(invitation.id)}
              />
            ) : null}
          </Card>
        ))
      ) : (
        <Card tone="soft">
          <Body>{t('coach.noInvitation')}</Body>
        </Card>
      )}

      <Button block variant="ghost" label={t('common.back')} onPress={() => router.back()} />
    </Screen>
  );
}

/** Ce qu'il faut transmettre au client, juste après la création. */
function CreatedCard({ invitation }: { invitation: Invitation }) {
  const { t } = useTranslation();

  if (invitation.kind === 'code' && invitation.code) {
    return (
      <Card tone="soft" style={styles.codeCard}>
        <Overline>{t('coach.codeReady')}</Overline>
        <Metric style={styles.code}>{invitation.code}</Metric>
        <Caption style={styles.center}>{t('coach.codeHint')}</Caption>
        <Button
          block
          variant="secondary"
          label={t('coach.shareCode')}
          onPress={() =>
            void Share.share({ message: t('coach.shareMessage', { code: invitation.code }) })
          }
        />
      </Card>
    );
  }

  return (
    <Card tone="soft">
      <Body>
        {t(invitation.kind === 'email' ? 'coach.emailSent' : 'coach.proposalSent', {
          email: invitation.email ?? '',
          name: invitation.targetName ?? invitation.email ?? '',
        })}
      </Body>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowText: { flex: 1, gap: 2 },
  strong: { fontWeight: '700', color: colors.ink },
  codeCard: { alignItems: 'center' },
  code: { letterSpacing: 6, fontSize: 40 },
  center: { textAlign: 'center' },
});
