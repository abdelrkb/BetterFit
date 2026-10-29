import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Body, Button, Caption, Metric, colors, spacing } from '@/ui';

/**
 * Le minuteur de repos.
 *
 * Il se lance tout seul quand une série est validée, et prévient à zéro par
 * une vibration et un bip. Le compte à rebours s'appuie sur l'horloge et non
 * sur un compteur de ticks : si le téléphone met l'app en veille, le temps
 * affiché reste juste au retour.
 */

const SIZE = 132;
const STROKE = 10;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Le bip de fin de repos, joué sur toutes les plateformes. */
const BEEP = require('../../assets/sounds/rest-done.wav') as number;

export type RestTimerProps = {
  /** Durée du repos, en secondes. */
  seconds: number;
  /**
   * Instant où le repos a commencé, en millisecondes. `null` tant qu'aucune
   * série n'a été validée. C'est le parent qui le pose : le minuteur n'a ainsi
   * aucun état à synchroniser.
   */
  startedAt: number | null;
  onDone?: () => void;
};

export function RestTimer({ seconds, startedAt, onDone }: RestTimerProps) {
  const { t } = useTranslation();
  /**
   * Les retouches du repos en cours (« +30 s », « passer »), rattachées à la
   * série qui l'a lancé : une nouvelle série repart donc à zéro sans qu'on ait
   * à remettre un état à jour dans un effet.
   */
  const [tweaks, setTweaks] = useState<{
    forStart: number | null;
    bonus: number;
    skipped: boolean;
  }>({ forStart: null, bonus: 0, skipped: false });
  const [now, setNow] = useState(() => Date.now());
  const announced = useRef<number | null>(null);

  const current = tweaks.forStart === startedAt ? tweaks : { bonus: 0, skipped: false };
  const beep = useAudioPlayer(BEEP);

  /** Fin du repos : un bip et une vibration, même écran éteint. */
  const announceEnd = useCallback(() => {
    try {
      beep.seekTo(0);
      beep.play();
    } catch {
      // Le navigateur peut refuser le son avant toute interaction : la
      // vibration et l'affichage suffisent alors.
    }

    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [beep]);

  const total = seconds + current.bonus;
  const endsAt = startedAt === null ? null : current.skipped ? startedAt : startedAt + total * 1000;

  const remaining = endsAt === null ? seconds : Math.max(0, Math.ceil((endsAt - now) / 1000));

  // Le compte à rebours lit l'horloge : si le téléphone se met en veille, le
  // temps affiché reste juste au retour.
  useEffect(() => {
    if (endsAt === null) return;

    const timer = setInterval(() => setNow(Date.now()), 250);

    return () => clearInterval(timer);
  }, [endsAt]);

  useEffect(() => {
    if (endsAt === null || remaining > 0) return;
    if (announced.current === startedAt) return;

    announced.current = startedAt;
    announceEnd();
    onDone?.();
  }, [endsAt, remaining, startedAt, onDone, announceEnd]);

  const running = endsAt !== null && remaining > 0;
  const progress = total > 0 ? remaining / total : 0;

  return (
    <View style={styles.container}>
      <View style={styles.dial}>
        <Svg width={SIZE} height={SIZE}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={colors.accentSoft}
            strokeWidth={STROKE}
            fill="none"
          />
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke={running ? colors.accent : colors.success}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            // Le cercle part du haut plutôt que de la droite.
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </Svg>
        <View style={styles.dialCenter} pointerEvents="none">
          <Metric>{formatSeconds(remaining)}</Metric>
          <Caption>{running ? t('workout.resting') : t('workout.restDone')}</Caption>
        </View>
      </View>

      {startedAt === null ? (
        <Body>{t('workout.restIdle')}</Body>
      ) : (
        <View style={styles.actions}>
          <Button
            variant="ghost"
            label={t('workout.addThirty')}
            onPress={() =>
              setTweaks({ forStart: startedAt, bonus: current.bonus + 30, skipped: false })
            }
          />
          <Button
            variant="ghost"
            label={t('workout.skipRest')}
            onPress={() => setTweaks({ forStart: startedAt, bonus: current.bonus, skipped: true })}
          />
        </View>
      )}
    </View>
  );
}

export function formatSeconds(total: number): string {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing.sm },
  dial: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  dialCenter: { position: 'absolute', alignItems: 'center' },
  actions: { flexDirection: 'row', gap: spacing.sm },
});
