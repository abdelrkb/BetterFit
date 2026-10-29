import { PASSWORD_MIN_LENGTH, registerSchema, type RegisterInput } from '@betterfit/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { useSession } from '@/stores/session';
import {
  Banner,
  Body,
  Button,
  Caption,
  Card,
  Checkbox,
  Screen,
  TextField,
  Title,
  spacing,
} from '@/ui';

export default function SignUpScreen() {
  const { t } = useTranslation();
  const signUp = useSession((state) => state.signUp);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    // `healthDataConsent` doit valoir `true` : on part de `false` pour que la
    // case soit décochée, et le schéma refusera tant qu'elle l'est.
    defaultValues: { email: '', password: '', name: '', healthDataConsent: false as true },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);

    try {
      await signUp(values);
    } catch (error) {
      setServerError(errorMessage(error));

      for (const [field, message] of Object.entries(fieldErrors(error))) {
        form.setError(field as keyof RegisterInput, { message });
      }
    }
  });

  return (
    <Screen>
      <Title>{t('auth.signUp.title')}</Title>
      <Body>{t('auth.signUp.subtitle')}</Body>

      <Card>
        {serverError ? <Banner message={serverError} /> : null}

        <Controller
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <TextField
              label={t('auth.nameLabel')}
              placeholder={t('auth.namePlaceholder')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              autoComplete="given-name"
              textContentType="givenName"
            />
          )}
        />

        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <TextField
              label={t('auth.emailLabel')}
              placeholder={t('auth.emailPlaceholder')}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              inputMode="email"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
            />
          )}
        />

        <Controller
          control={form.control}
          name="password"
          render={({ field, fieldState }) => (
            <TextField
              label={t('auth.passwordLabel')}
              hint={t('auth.passwordHint', { count: PASSWORD_MIN_LENGTH })}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
            />
          )}
        />
      </Card>

      <Card tone="soft">
        <Controller
          control={form.control}
          name="healthDataConsent"
          render={({ field, fieldState }) => (
            <Checkbox
              checked={field.value === true}
              onChange={(checked) => field.onChange(checked)}
              error={fieldState.error ? t('auth.signUp.consentRequired') : undefined}
              label={<Body>{t('auth.signUp.consentLabel')}</Body>}
            />
          )}
        />
        <Caption>{t('auth.signUp.consentHint')}</Caption>
      </Card>

      <Button
        block
        label={t('auth.signUp.submit')}
        loading={form.formState.isSubmitting}
        onPress={() => void onSubmit()}
      />

      <Card tone="soft" style={styles.footer}>
        <Body>{t('auth.signUp.hasAccount')}</Body>
        <Link href="/sign-in" asChild>
          <Button block variant="secondary" label={t('auth.signUp.signIn')} onPress={() => {}} />
        </Link>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { marginTop: spacing.sm },
});
