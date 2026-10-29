import { Mascot, type PoseName } from '@betterfit/mascot';
import {
  activityLevelSchema,
  birthDateSchema,
  goalSchema,
  heightCmSchema,
  onboardingSchema,
  sexSchema,
  weightKgSchema,
  type OnboardingInput,
} from '@betterfit/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { Controller, useForm, type Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { z } from 'zod';
import { errorMessage } from '@/lib/errors';
import { useSession } from '@/stores/session';
import {
  Banner,
  Body,
  Button,
  Caption,
  Card,
  HeroCard,
  OptionGroup,
  Overline,
  Screen,
  TextField,
  Title,
  colors,
  radii,
  spacing,
} from '@/ui';

/**
 * Le questionnaire d'accueil, en quatre pages.
 *
 * On valide page par page plutôt que tout à la fin : l'utilisateur corrige une
 * erreur au moment où il la fait, pas trois écrans plus loin.
 */
const STEPS = ['name', 'body', 'activity', 'goal'] as const;
type Step = (typeof STEPS)[number];

/** Quels champs chaque page doit avoir remplis pour laisser continuer. */
const FIELDS_BY_STEP: Record<Step, (keyof FormValues)[]> = {
  name: ['name'],
  body: ['sex', 'birthDate', 'heightCm', 'weightKg'],
  activity: ['activityLevel', 'weeklySessions'],
  goal: ['goal'],
};

const POSE_BY_STEP: Record<Step, PoseName> = {
  name: 'stand',
  body: 'raise',
  activity: 'cardio',
  goal: 'flex',
};

/**
 * Le formulaire manipule du texte (c'est ce que tape l'utilisateur) ; les
 * nombres et la date sont convertis au moment de la validation.
 */
const formSchema = z.object({
  name: onboardingSchema.shape.name,
  sex: sexSchema,
  /** Saisi en JJ/MM/AAAA, converti en AAAA-MM-JJ. */
  birthDate: z
    .string()
    .trim()
    .transform((value) => toIsoDate(value))
    .pipe(birthDateSchema),
  heightCm: numberField(heightCmSchema),
  weightKg: numberField(weightKgSchema),
  activityLevel: activityLevelSchema,
  weeklySessions: numberField(z.number().int().min(0).max(14)),
  goal: goalSchema,
});

type FormValues = z.input<typeof formSchema>;
/** Ce que le schéma rend une fois les textes convertis. */
type FormOutput = z.output<typeof formSchema>;
/** Le contrôleur passé aux pages du questionnaire. */
type StepControl = Control<FormValues, unknown, FormOutput>;

/** Accepte « 78,4 » comme « 78.4 » : la virgule est la norme en français. */
function numberField(inner: z.ZodType<number, number>) {
  return z
    .string()
    .trim()
    .min(1, 'Champ requis.')
    .transform((value) => Number(value.replace(',', '.')))
    .refine((value) => Number.isFinite(value), { message: 'Entre un nombre.' })
    .pipe(inner);
}

/** « 15/04/1992 » → « 1992-04-15 ». Laisse passer ce qui est déjà au bon format. */
function toIsoDate(value: string): string {
  const match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(value);
  if (!match) return value;

  const [, day, month, year] = match;
  return `${year}-${month!.padStart(2, '0')}-${day!.padStart(2, '0')}`;
}

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const completeOnboarding = useSession((state) => state.completeOnboarding);
  const userName = useSession((state) => state.user?.name ?? '');
  const [stepIndex, setStepIndex] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);

  const step = STEPS[stepIndex]!;
  const isLast = stepIndex === STEPS.length - 1;

  const form = useForm<FormValues, unknown, FormOutput>({
    resolver: zodResolver(formSchema),
    mode: 'onTouched',
    defaultValues: {
      name: userName,
      sex: undefined,
      birthDate: '',
      heightCm: '',
      weightKg: '',
      activityLevel: undefined,
      weeklySessions: '3',
      goal: undefined,
    },
  });

  async function goNext() {
    const valid = await form.trigger(FIELDS_BY_STEP[step]);
    if (!valid) return;

    if (!isLast) {
      setStepIndex((index) => index + 1);
      return;
    }

    setServerError(null);

    try {
      const values = formSchema.parse(form.getValues()) satisfies OnboardingInput;
      await completeOnboarding(values);
    } catch (error) {
      setServerError(errorMessage(error));
    }
  }

  return (
    <Screen>
      <HeroCard>
        <View style={styles.heroRow}>
          <View style={styles.heroText}>
            <Overline onDark>
              {t('onboarding.stepOf', { current: stepIndex + 1, total: STEPS.length })}
            </Overline>
            <Title onDark>{t(`onboarding.${step}.title`)}</Title>
            <Body onDark>{t(`onboarding.${step}.subtitle`)}</Body>
          </View>
          <Mascot pose={POSE_BY_STEP[step]} size={92} tone="onDark" />
        </View>
      </HeroCard>

      <View style={styles.progress} accessibilityRole="progressbar">
        {STEPS.map((name, index) => (
          <View
            key={name}
            style={[styles.progressBar, index <= stepIndex && styles.progressBarDone]}
          />
        ))}
      </View>

      <Card>
        {serverError ? <Banner message={serverError} /> : null}

        {step === 'name' ? <NameStep control={form.control} /> : null}
        {step === 'body' ? <BodyStep control={form.control} /> : null}
        {step === 'activity' ? <ActivityStep control={form.control} /> : null}
        {step === 'goal' ? <GoalStep control={form.control} /> : null}
      </Card>

      <View style={styles.actions}>
        {stepIndex > 0 ? (
          <Button
            variant="ghost"
            label={t('common.back')}
            onPress={() => setStepIndex((index) => index - 1)}
          />
        ) : null}
        <Button
          block={stepIndex === 0}
          style={stepIndex > 0 ? styles.nextButton : undefined}
          label={isLast ? t('onboarding.done.submit') : t('common.next')}
          loading={form.formState.isSubmitting}
          onPress={() => void goNext()}
        />
      </View>
    </Screen>
  );
}

function NameStep({ control }: { control: StepControl }) {
  const { t } = useTranslation();

  return (
    <Controller
      control={control}
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
        />
      )}
    />
  );
}

function BodyStep({ control }: { control: StepControl }) {
  const { t } = useTranslation();

  return (
    <>
      <Controller
        control={control}
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
      <Caption>{t('onboarding.body.sexHint')}</Caption>

      <Controller
        control={control}
        name="birthDate"
        render={({ field, fieldState }) => (
          <TextField
            label={t('onboarding.body.birthDateLabel')}
            placeholder={t('onboarding.body.birthDatePlaceholder')}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            inputMode="numeric"
          />
        )}
      />

      <Controller
        control={control}
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
        control={control}
        name="weightKg"
        render={({ field, fieldState }) => (
          <TextField
            label={t('onboarding.body.weightLabel')}
            suffix="kg"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={fieldState.error?.message}
            inputMode="decimal"
          />
        )}
      />
    </>
  );
}

function ActivityStep({ control }: { control: StepControl }) {
  const { t } = useTranslation();

  return (
    <>
      <Controller
        control={control}
        name="activityLevel"
        render={({ field, fieldState }) => (
          <OptionGroup
            label={t('onboarding.activity.label')}
            value={field.value}
            onChange={field.onChange}
            error={fieldState.error?.message}
            options={[
              {
                value: 'sedentary',
                label: t('onboarding.activity.sedentary'),
                hint: t('onboarding.activity.sedentaryHint'),
              },
              {
                value: 'light',
                label: t('onboarding.activity.light'),
                hint: t('onboarding.activity.lightHint'),
              },
              {
                value: 'moderate',
                label: t('onboarding.activity.moderate'),
                hint: t('onboarding.activity.moderateHint'),
              },
              {
                value: 'active',
                label: t('onboarding.activity.active'),
                hint: t('onboarding.activity.activeHint'),
              },
              {
                value: 'very_active',
                label: t('onboarding.activity.very_active'),
                hint: t('onboarding.activity.veryActiveHint'),
              },
            ]}
          />
        )}
      />

      <Controller
        control={control}
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
    </>
  );
}

function GoalStep({ control }: { control: StepControl }) {
  const { t } = useTranslation();

  return (
    <Controller
      control={control}
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
  );
}

const styles = StyleSheet.create({
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  heroText: { flex: 1, gap: spacing.sm, minWidth: 180 },
  progress: { flexDirection: 'row', gap: spacing.xs },
  progressBar: {
    flex: 1,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: colors.cardBorder,
  },
  progressBarDone: { backgroundColor: colors.accent },
  actions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  nextButton: { flex: 1 },
});
