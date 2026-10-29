import { Mascot } from '@betterfit/mascot';
import { loginSchema, type LoginInput } from '@betterfit/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { errorMessage, fieldErrors } from '@/lib/errors';
import { useSession } from '@/stores/session';
import {
  Banner,
  Body,
  Button,
  Card,
  Caption,
  HeroCard,
  Logo,
  Screen,
  TextField,
  Title,
  colors,
  spacing,
} from '@/ui';

export default function SignInScreen() {
  const { t } = useTranslation();
  const signIn = useSession((state) => state.signIn);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setServerError(null);

    try {
      await signIn(values);
    } catch (error) {
      setServerError(errorMessage(error));

      for (const [field, message] of Object.entries(fieldErrors(error))) {
        form.setError(field as keyof LoginInput, { message });
      }
    }
  });

  return (
    <Screen>
      <HeroCard>
        <View style={styles.heroRow}>
          <View style={styles.heroText}>
            <Logo onDark />
            <Title onDark style={styles.heroTitle}>
              {t('auth.welcomeTitle')}
            </Title>
            <Body onDark>{t('auth.welcomeSubtitle')}</Body>
          </View>
          <Mascot pose="flex" size={88} tone="onDark" />
        </View>
      </HeroCard>

      <Card title={t('auth.signIn.title')}>
        {serverError ? <Banner message={serverError} /> : null}

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
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              onSubmitEditing={() => void onSubmit()}
              returnKeyType="go"
            />
          )}
        />

        <Button
          block
          label={t('auth.signIn.submit')}
          loading={form.formState.isSubmitting}
          onPress={() => void onSubmit()}
        />

        <Link href="/forgot-password" style={styles.link}>
          <Caption style={styles.linkText}>{t('auth.signIn.forgot')}</Caption>
        </Link>
      </Card>

      <Card tone="soft">
        <Body>{t('auth.signIn.noAccount')}</Body>
        <Link href="/sign-up" asChild>
          <Button
            block
            variant="secondary"
            label={t('auth.signIn.createAccount')}
            onPress={() => {}}
          />
        </Link>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  heroText: { flex: 1, gap: spacing.sm, minWidth: 180 },
  heroTitle: { marginTop: spacing.sm },
  link: { alignSelf: 'center', paddingVertical: spacing.sm },
  linkText: { color: colors.accent },
});
