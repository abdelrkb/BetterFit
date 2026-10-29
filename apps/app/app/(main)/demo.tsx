import { Mascot, POSE_NAMES, poseLabel } from '@betterfit/mascot';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { apiBaseUrl, fetchHealth } from '@/lib/api';
import {
  Body,
  Button,
  Caption,
  Card,
  Chip,
  HeroCard,
  Logo,
  Metric,
  Overline,
  Screen,
  Tabs,
  TextField,
  Title,
  colors,
  radii,
  spacing,
  useWideScreen,
} from '@/ui';

type Section = 'mascot' | 'components' | 'system';

export default function DemoScreen() {
  const { t } = useTranslation();
  const [section, setSection] = useState<Section>('mascot');

  return (
    <Screen>
      <HeroCard>
        <View style={styles.heroRow}>
          <View style={styles.heroText}>
            <Logo onDark />
            <Title onDark style={styles.heroTitle}>
              {t('demo.title')}
            </Title>
            <Body onDark>{t('demo.subtitle')}</Body>
          </View>
          <Mascot pose="flex" size={96} tone="onDark" />
        </View>
      </HeroCard>

      <Tabs
        value={section}
        onChange={setSection}
        items={[
          { value: 'mascot', label: t('demo.tabs.mascot') },
          { value: 'components', label: t('demo.tabs.components') },
          { value: 'system', label: t('demo.tabs.system') },
        ]}
      />

      {section === 'mascot' ? <MascotSection /> : null}
      {section === 'components' ? <ComponentsSection /> : null}
      {section === 'system' ? <SystemSection /> : null}
    </Screen>
  );
}

function MascotSection() {
  const { t } = useTranslation();

  return (
    <>
      <Card overline={t('demo.mascot.overline')} title={t('demo.mascot.title')}>
        <Body>{t('demo.mascot.intro')}</Body>
        <View style={styles.poseGrid}>
          {POSE_NAMES.map((pose) => (
            <View key={pose} style={styles.poseCell}>
              <Mascot pose={pose} size={92} accessibilityLabel={poseLabel(pose)} />
              <Caption style={styles.poseLabel} numberOfLines={2}>
                {poseLabel(pose)}
              </Caption>
            </View>
          ))}
        </View>
      </Card>

      <Card title={t('demo.mascot.sizesTitle')}>
        <Caption>{t('demo.mascot.sizesHint')}</Caption>
        <View style={styles.sizeRow}>
          {[40, 64, 96, 140].map((size) => (
            <Mascot key={size} pose="flex" size={size} />
          ))}
        </View>
      </Card>

      <Card title={t('demo.mascot.toneTitle')}>
        <Caption>{t('demo.mascot.toneHint')}</Caption>
        <View style={styles.toneRow}>
          <Mascot pose="squat" size={96} />
          <View style={styles.toneDark}>
            <Mascot pose="squat" size={96} tone="onDark" />
          </View>
        </View>
      </Card>

      <Card tone="soft">
        <Body>{t('demo.mascot.exercisesNote')}</Body>
      </Card>
    </>
  );
}

function ComponentsSection() {
  const { t } = useTranslation();
  const wide = useWideScreen();
  const [presses, setPresses] = useState(0);
  const [weight, setWeight] = useState('78,4');
  const [email, setEmail] = useState('julie');

  return (
    <>
      <Card
        overline={t('demo.components.buttonsOverline')}
        title={t('demo.components.buttonsTitle')}
      >
        <View style={[styles.wrap, wide && styles.wrapWide]}>
          <Button label={t('demo.components.primary')} onPress={() => setPresses((n) => n + 1)} />
          <Button label={t('demo.components.secondary')} variant="secondary" onPress={() => {}} />
          <Button label={t('demo.components.ghost')} variant="ghost" onPress={() => {}} />
          <Button label={t('demo.components.danger')} variant="danger" onPress={() => {}} />
          <Button label={t('demo.components.loading')} loading onPress={() => {}} />
          <Button label={t('demo.components.disabled')} disabled onPress={() => {}} />
        </View>
        <Button
          block
          label={t('demo.components.withMascot')}
          leading={<Mascot pose="flex" size={28} tone="onDark" />}
          onPress={() => setPresses((n) => n + 1)}
        />
        <Caption>{t('demo.components.pressedCount', { count: presses })}</Caption>
      </Card>

      <Card overline={t('demo.components.fieldsOverline')} title={t('demo.components.fieldsTitle')}>
        <TextField
          label={t('demo.components.weightLabel')}
          hint={t('demo.components.weightHint')}
          suffix="kg"
          value={weight}
          onChangeText={setWeight}
          inputMode="decimal"
        />
        <TextField
          label={t('demo.components.emailLabel')}
          placeholder={t('demo.components.emailPlaceholder')}
          error={email.includes('@') ? undefined : t('demo.components.emailError')}
          value={email}
          onChangeText={setEmail}
          inputMode="email"
          autoCapitalize="none"
        />
      </Card>

      <Card overline={t('demo.components.chipsOverline')} title={t('demo.components.chipsTitle')}>
        <View style={styles.wrap}>
          <Chip label="Pectoraux" tone="dark" />
          <Chip label="Dos" />
          <Chip label="Jambes" />
          <Chip label="Haltères" tone="outline" />
          <Chip label="Débutant" tone="outline" />
        </View>
      </Card>

      <Card overline={t('demo.components.cardsOverline')} title={t('demo.components.cardsTitle')}>
        <Card tone="soft" title={t('demo.components.softCardTitle')}>
          <Body>{t('demo.components.softCardBody')}</Body>
        </Card>
      </Card>

      <HeroCard>
        <Overline onDark>{t('demo.components.cardsOverline')}</Overline>
        <Title onDark style={styles.heroTitle}>
          {t('demo.components.heroTitle')}
        </Title>
        <Body onDark>{t('demo.components.heroBody')}</Body>
      </HeroCard>

      <Card
        overline={t('demo.components.metricsOverline')}
        title={t('demo.components.metricsTitle')}
      >
        <View style={[styles.wrap, styles.metrics]}>
          <View style={styles.metricCell}>
            <Metric>2 140</Metric>
            <Caption>{t('demo.components.metricCalories')}</Caption>
          </View>
          <View style={styles.metricCell}>
            <Metric>3</Metric>
            <Caption>{t('demo.components.metricSessions')}</Caption>
          </View>
          <View style={styles.metricCell}>
            <Metric>78,4</Metric>
            <Caption>{t('demo.components.metricWeight')}</Caption>
          </View>
        </View>
      </Card>
    </>
  );
}

function SystemSection() {
  const { t } = useTranslation();
  const health = useQuery({ queryKey: ['health'], queryFn: fetchHealth });

  return (
    <Card overline={t('demo.system.overline')} title={t('demo.system.title')}>
      <View style={styles.statusRow}>
        <Overline>{t('demo.system.apiHeading')}</Overline>
        {health.isPending ? (
          <Body>{t('demo.system.checking')}</Body>
        ) : health.isError ? (
          <Body style={styles.bad}>
            {t('demo.system.apiError', { message: health.error.message })}
          </Body>
        ) : (
          <Body style={styles.good}>
            {t('demo.system.apiOk', { version: health.data.version })}
          </Body>
        )}
        <Caption>{apiBaseUrl}</Caption>
      </View>

      <View style={styles.statusRow}>
        <Overline>{t('demo.system.databaseHeading')}</Overline>
        <Body style={health.data ? (health.data.database ? styles.good : styles.bad) : undefined}>
          {health.isPending
            ? t('demo.system.checking')
            : health.data?.database
              ? t('demo.system.databaseOk')
              : t('demo.system.databaseDown')}
        </Body>
        {health.data ? (
          <Caption>
            {t('demo.system.checkedAt', {
              time: new Date(health.data.time).toLocaleTimeString('fr-FR'),
            })}
          </Caption>
        ) : null}
      </View>

      <Button
        block
        variant="secondary"
        label={t('common.retry')}
        loading={health.isFetching}
        onPress={() => void health.refetch()}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  heroTitle: { marginTop: spacing.sm },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  heroText: { flex: 1, gap: spacing.sm, minWidth: 200 },
  toneRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  toneDark: { backgroundColor: colors.night, borderRadius: radii.tile, padding: spacing.sm },
  poseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  poseCell: {
    flexBasis: 94,
    flexGrow: 1,
    maxWidth: 150,
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.tile,
  },
  poseLabel: { textAlign: 'center', paddingHorizontal: spacing.xs },
  sizeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md, flexWrap: 'wrap' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  wrapWide: { gap: spacing.md },
  metrics: { justifyContent: 'space-between' },
  metricCell: { gap: spacing.xs, minWidth: 140 },
  statusRow: { gap: spacing.xs },
  good: { color: colors.success },
  bad: { color: colors.danger },
});
