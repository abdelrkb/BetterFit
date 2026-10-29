import {
  activityLevelSchema,
  changePasswordSchema,
  goalSchema,
  heightCmSchema,
  sexSchema,
  updateUserSchema,
  type ChangePasswordInput,
  type ProfileUpdate,
} from '@betterfit/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Platform, Share, StyleSheet, View } from 'react-native';
import { z } from 'zod';
import { errorMessage } from '@/lib/errors';
import { useSession } from '@/stores/session';
import {
  Banner,
  Body,
  Button,
  Caption,
  Card,
  Overline,
  OptionGroup,
  Screen,
  TextField,
  Title,
  spacing,
} from '@/ui';

const profileFormSchema = z.object({
  name: updateUserSchema.shape.name.unwrap(),
  sex: sexSchema,
  heightCm: z
    .string()
    .trim()
    .transform((value) => Number(value.replace(',', '.')))
    .pipe(heightCmSchema),
  activityLevel: activityLevelSchema,
  weeklySessions: z
    .string()
    .trim()
    .transform((value) => Number(value))
    .pipe(z.number().int().min(0).max(14)),
  goal: goalSchema,
});

type ProfileFormValues = z.input<typeof profileFormSchema>;
type ProfileFormOutput = z.output<typeof profileFormSchema>;

export default function ProfileScreen() {
  const { t } = useTranslation();
  const user = useSession((state) => state.user);
  const profile = useSession((state) => state.profile);
  const updateProfile = useSession((state) => state.updateProfile);
  const updateUser = useSession((state) => state.updateUser);
  const signOut = useSession((state) => state.signOut);

  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<ProfileFormValues, unknown, ProfileFormOutput>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: user?.name ?? '',
      sex: profile?.sex,
      heightCm: String(profile?.heightCm ?? ''),
      activityLevel: profile?.activityLevel,
      weeklySessions: String(profile?.weeklySessions ?? 0),
      goal: profile?.goal,
    },
  });

  const onSubmit = form.handleSubmit(async ({ name, ...rest }) => {
    setServerError(null);
    setSaved(false);

    try {
      if (name !== user?.name) await updateUser({ name });
      await updateProfile(rest satisfies ProfileUpdate);

      setSaved(true);
    } catch (error) {
      setServerError(errorMessage(error));
    }
  });

  return (
    <Screen>
      <Title>{t('profile.title')}</Title>

      {serverError ? <Banner message={serverError} /> : null}
      {saved ? <Banner tone="success" message={t('common.saved')} /> : null}

      <Card overline={t('profile.accountSection')}>
        <Controller
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <TextField
              label={t('profile.nameLabel')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
            />
          )}
        />

        <View>
          <Overline>{t('profile.emailLabel')}</Overline>
          <Body>{user?.email}</Body>
          <Caption>{t('profile.emailReadOnly')}</Caption>
        </View>

        {user?.healthDataConsentAt ? (
          <Caption>
            {t('profile.consentGiven', {
              date: new Date(user.healthDataConsentAt).toLocaleDateString('fr-FR'),
            })}
          </Caption>
        ) : null}
      </Card>

      <Card overline={t('profile.bodySection')}>
        <Controller
          control={form.control}
          name="sex"
          render={({ field, fieldState }) => (
            <OptionGroup
              layout="row"
              label={t('onboarding.body.sexLabel')}
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
              options={[
                { value: 'female', label: t('onboarding.body.female') },
                { value: 'male', label: t('onboarding.body.male') },
              ]}
            />
          )}
        />

        <Controller
          control={form.control}
          name="heightCm"
          render={({ field, fieldState }) => (
            <TextField
              label={t('onboarding.body.heightLabel')}
              suffix="cm"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              inputMode="numeric"
            />
          )}
        />

        <Controller
          control={form.control}
          name="activityLevel"
          render={({ field, fieldState }) => (
            <OptionGroup
              label={t('onboarding.activity.label')}
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
              options={[
                { value: 'sedentary', label: t('onboarding.activity.sedentary') },
                { value: 'light', label: t('onboarding.activity.light') },
                { value: 'moderate', label: t('onboarding.activity.moderate') },
                { value: 'active', label: t('onboarding.activity.active') },
                { value: 'very_active', label: t('onboarding.activity.very_active') },
              ]}
            />
          )}
        />

        <Controller
          control={form.control}
          name="weeklySessions"
          render={({ field, fieldState }) => (
            <TextField
              label={t('onboarding.activity.sessionsLabel')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              inputMode="numeric"
            />
          )}
        />
      </Card>

      <Card overline={t('profile.goalSection')}>
        <Controller
          control={form.control}
          name="goal"
          render={({ field, fieldState }) => (
            <OptionGroup
              label={t('onboarding.goal.label')}
              value={field.value}
              onChange={field.onChange}
              error={fieldState.error?.message}
              options={[
                { value: 'lose_fat', label: t('onboarding.goal.lose_fat') },
                { value: 'maintain', label: t('onboarding.goal.maintain') },
                { value: 'gain_muscle', label: t('onboarding.goal.gain_muscle') },
              ]}
            />
          )}
        />
      </Card>

      <Button
        block
        label={t('profile.saveChanges')}
        loading={form.formState.isSubmitting}
        onPress={() => void onSubmit()}
      />

      <PasswordCard />
      <DataCard />

      <Button block variant="ghost" label={t('profile.signOut')} onPress={() => void signOut()} />

      <Link href="/" asChild>
        <Button block variant="ghost" label={t('common.back')} onPress={() => {}} />
      </Link>
    </Screen>
  );
}

function PasswordCard() {
  const { t } = useTranslation();
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);

    try {
      // Changer de mot de passe ferme toutes les sessions, celle-ci comprise :
      // l'app repasse donc par l'écran de connexion.
      await useSession.getState().authedRequest('/me/password', { method: 'POST', body: values });
      setDone(true);
      await useSession.getState().signOut();
    } catch (error) {
      setServerError(errorMessage(error));
    }
  });

  return (
    <Card overline={t('profile.securitySection')} title={t('profile.changePassword')}>
      {serverError ? <Banner message={serverError} /> : null}
      {done ? <Banner tone="success" message={t('profile.passwordChanged')} /> : null}

      <Controller
        control={form.control}
        name="currentPassword"
        render={({ field, fieldState }) => (
          <TextField
            label={t('profile.currentPassword')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            secureTextEntry
            autoCapitalize="none"
          />
        )}
      />

      <Controller
        control={form.control}
        name="newPassword"
        render={({ field, fieldState }) => (
          <TextField
            label={t('profile.newPassword')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            secureTextEntry
            autoCapitalize="none"
          />
        )}
      />

      <Button
        block
        variant="secondary"
        label={t('profile.changePassword')}
        loading={form.formState.isSubmitting}
        onPress={() => void onSubmit()}
      />
    </Card>
  );
}

/** Export et suppression : les deux droits RGPD que l'app doit offrir. */
function DataCard() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');

  async function exportData() {
    setBusy(true);
    setServerError(null);

    try {
      const data = await useSession.getState().authedRequest<unknown>('/me/export');
      const json = JSON.stringify(data, null, 2);

      if (Platform.OS === 'web') {
        // Déclenche un vrai téléchargement de fichier dans le navigateur.
        const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'betterfit-mes-donnees.json';
        link.click();
        URL.revokeObjectURL(url);
      } else {
        await Share.share({ message: json, title: 'BetterFit — mes données' });
      }

      setMessage(t('profile.exportDone'));
    } catch (error) {
      setServerError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    setBusy(true);
    setServerError(null);

    try {
      await useSession.getState().authedRequest('/me', { method: 'DELETE', body: { password } });
      await useSession.getState().signOut();
    } catch (error) {
      setServerError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card overline={t('profile.dataSection')}>
      {serverError ? <Banner message={serverError} /> : null}
      {message ? <Banner tone="success" message={message} /> : null}

      <View style={styles.block}>
        <Body>{t('profile.exportTitle')}</Body>
        <Caption>{t('profile.exportHint')}</Caption>
        <Button
          block
          variant="secondary"
          label={t('profile.exportAction')}
          loading={busy}
          onPress={() => void exportData()}
        />
      </View>

      <View style={styles.block}>
        <Body>{t('profile.deleteTitle')}</Body>
        <Caption>{t('profile.deleteHint')}</Caption>

        {confirming ? (
          <>
            <TextField
              label={t('profile.deleteConfirm')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
            <Button
              block
              variant="danger"
              label={t('profile.deleteAction')}
              loading={busy}
              disabled={password.length === 0}
              onPress={() => void deleteAccount()}
            />
            <Button
              block
              variant="ghost"
              label={t('common.cancel')}
              onPress={() => {
                setConfirming(false);
                setPassword('');
              }}
            />
          </>
        ) : (
          <Button
            block
            variant="ghost"
            label={t('profile.deleteAction')}
            onPress={() => setConfirming(true)}
          />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
});
