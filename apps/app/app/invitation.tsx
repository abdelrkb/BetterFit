import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { writeKey } from '@/lib/kv';
import { PENDING_INVITATION_KEY } from '@/lib/invitation';
import { Body, Button, Card, Screen, Title } from '@/ui';

/**
 * Écran d'arrivée d'un lien d'invitation reçu par e-mail.
 *
 * Le jeton est mis de côté sur l'appareil, puis consommé une fois la personne
 * connectée : elle n'a souvent pas encore de compte au moment du clic, et il
 * ne faut pas perdre l'invitation pendant l'inscription.
 */
export default function InvitationScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!token) return;

    void writeKey(PENDING_INVITATION_KEY, token).then(() => setSaved(true));
  }, [token]);

  return (
    <Screen>
      <Title>{t('coaching.invitationTitle')}</Title>

      <Card>
        <Body>{t(token ? 'coaching.invitationBody' : 'coaching.invitationMissing')}</Body>
      </Card>

      <Button
        block
        label={t('coaching.invitationContinue')}
        disabled={Boolean(token) && !saved}
        onPress={() => router.replace('/')}
      />
    </Screen>
  );
}
