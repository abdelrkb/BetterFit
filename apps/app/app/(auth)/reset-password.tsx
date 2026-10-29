import { PASSWORD_MIN_LENGTH, passwordSchema, sessionSchema } from '@betterfit/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { apiRequest } from '@/lib/api';
import { errorMessage } from '@/lib/errors';
import { useSession } from '@/stores/session';
import { Banner, Body, Button, Card, Screen, TextField, Title } from '@/ui';

const formSchema = z.object({ password: passwordSchema });
type FormValues = z.infer<typeof formSchema>;

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const router = useRouter();
  const refreshMe = useSession((state) => state.refreshMe);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    if (!token) {
      setServerError(t('auth.reset.missingToken'));
      return;
    }

    setServerError(null);

    try {
      // L'API renvoie une session : on enchaîne directement sur l'application,
      // sans redemander de se connecter.
      await apiRequest(
        '/auth/reset-password',
        { method: 'POST', body: { token, password: values.password } },
        (data) => sessionSchema.parse(data),
      );

      await useSession.getState().bootstrap();
      await refreshMe();

      // L'aiguillage laisse toujours passer cet écran (on peut y arriver
      // connecté) : c'est donc à lui de repartir vers l'application.
      router.replace('/');
    } catch (error) {
      setServerError(errorMessage(error));
    }
  });

  return (
    <Screen>
      <Title>{t('auth.reset.title')}</Title>
      <Body>{t('auth.reset.subtitle')}</Body>

      <Card>
        {serverError ? <Banner message={serverError} /> : null}
        {!token ? <Banner message={t('auth.reset.missingToken')} /> : null}

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
            />
          )}
        />

        <Button
          block
          label={t('auth.reset.submit')}
          disabled={!token}
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
