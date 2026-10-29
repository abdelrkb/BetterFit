import { forgotPasswordSchema, type ForgotPasswordInput } from '@betterfit/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { apiRequest } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { Banner, Body, Button, Card, Screen, TextField, Title } from '@/ui';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);

    try {
      await apiRequest('/auth/forgot-password', { method: 'POST', body: values });
      setSent(true);
    } catch (error) {
      setServerError(errorMessage(error));
    }
  });

  return (
    <Screen>
      <Title>{t('auth.forgot.title')}</Title>
      <Body>{t('auth.forgot.subtitle')}</Body>

      <Card>
        {serverError ? <Banner message={serverError} /> : null}
        {sent ? <Banner tone="success" message={t('auth.forgot.sent')} /> : null}

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
            />
          )}
        />

        <Button
          block
          label={t('auth.forgot.submit')}
          loading={form.formState.isSubmitting}
          onPress={() => void onSubmit()}
        />
      </Card>

      <Link href="/sign-in" asChild>
        <Button block variant="ghost" label={t('auth.forgot.backToSignIn')} onPress={() => {}} />
      </Link>
    </Screen>
  );
}
