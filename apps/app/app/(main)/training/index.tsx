import { Mascot } from '@betterfit/mascot';
import {
  LEVEL_LABELS_FR,
  TRAINING_GOAL_LABELS_FR,
  type ProgramSummary,
} from '@betterfit/shared';
import { useQuery } from '@tanstack/react-query';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { errorMessage } from '@/lib/errors';
import { listPrograms } from '@/lib/programs';
import {
  Banner,
  Body,
  Button,
  Caption,
  Card,
  Chip,
  Heading,
  Screen,
  Tabs,
  Title,
  colors,
  spacing,
} from '@/ui';

type Tab = 'programs' | 'templates';

export default function TrainingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('programs');

  const programs = useQuery({
    queryKey: ['programs', tab],
    queryFn: () => listPrograms({ templates: tab === 'templates' }),
  });

  return (
    <Screen>
      <Title>{t('training.title')}</Title>
      <Body>{t('training.subtitle')}</Body>

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'programs', label: t('training.tabPrograms') },
          { value: 'templates', label: t('training.tabTemplates') },
        ]}
      />

      <Link href="/training/edit" asChild>
        <Button block label={t('training.create')} onPress={() => {}} />
      </Link>

      {programs.isError ? <Banner message={errorMessage(programs.error)} /> : null}

      {programs.isPending ? (
        <ActivityIndicator color={colors.accent} />
      ) : programs.data && programs.data.items.length > 0 ? (
        programs.data.items.map((item) => (
          <ProgramCard
            key={item.id}
            program={item}
            onPress={() => router.push(`/training/${item.id}`)}
          />
        ))
      ) : (
        <Card tone="soft" style={styles.empty}>
          <Mascot pose="stand" size={110} />
          <Heading>{t(tab === 'templates' ? 'training.emptyTemplates' : 'training.empty')}</Heading>
          <Body style={styles.emptyText}>{t('training.emptyHint')}</Body>
        </Card>
      )}
    </Screen>
  );
}

function ProgramCard({ program, onPress }: { program: ProgramSummary; onPress: () => void }) {
  const { t } = useTranslation();

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={program.title} onPress={onPress}>
      <Card title={program.title}>
        <View style={styles.chips}>
          <Chip tone="dark" label={TRAINING_GOAL_LABELS_FR[program.goal]} />
          <Chip label={LEVEL_LABELS_FR[program.level]} />
          {program.isTemplate ? <Chip tone="outline" label={t('training.template')} /> : null}
        </View>
        <Caption>
          {t('training.sessionCount', { count: program.sessionCount })} ·{' '}
          {t('training.daysPerWeek', { count: program.trainingDays })}
        </Caption>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  empty: { alignItems: 'center', gap: spacing.sm },
  emptyText: { textAlign: 'center' },
});
