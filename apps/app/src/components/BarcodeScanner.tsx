import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';
import { Banner, Body, Button, Caption, Card, Screen, TextField, Title, colors, radii } from '@/ui';

/**
 * Scan d'un code-barres.
 *
 * Sur le web, la caméra n'est disponible qu'en HTTPS et selon le navigateur :
 * on propose donc **toujours** la saisie du code à la main, qui reste le
 * chemin de secours partout (code illisible, emballage abîmé).
 */
export function BarcodeScanner({
  onScanned,
  onCancel,
}: {
  onScanned: (barcode: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Une fois le code lu, la caméra continue d'émettre : sans ce verrou, on
  // déclenche dix recherches pour un seul emballage.
  const handled = useRef(false);

  const manualValid = /^\d{8,14}$/.test(manual.trim());
  const cameraUsable = Platform.OS !== 'web' && permission?.granted === true;

  return (
    <Screen>
      <Title>{t('journal.scanTitle')}</Title>

      {error ? <Banner message={error} /> : null}

      {Platform.OS === 'web' ? (
        <Card tone="soft">
          <Body>{t('journal.scanWeb')}</Body>
        </Card>
      ) : permission === null ? null : permission.granted ? null : (
        <Card tone="soft">
          <Body>{t('journal.scanPermission')}</Body>
          <Button
            block
            label={t('journal.scanAllow')}
            onPress={() => {
              void requestPermission();
            }}
          />
        </Card>
      )}

      {cameraUsable ? (
        <View style={styles.camera}>
          <CameraView
            style={StyleSheet.absoluteFill}
            barcodeScannerSettings={{
              // Les codes qu'on trouve sur les emballages alimentaires.
              barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'],
            }}
            onBarcodeScanned={({ data }) => {
              if (handled.current) return;

              if (!/^\d{8,14}$/.test(data)) {
                setError(t('journal.scanUnreadable'));
                return;
              }

              handled.current = true;
              onScanned(data);
            }}
          />
        </View>
      ) : null}

      <Card title={t('journal.scanManualTitle')}>
        <Caption>{t('journal.scanManualHint')}</Caption>
        <TextField
          label={t('journal.barcodeLabel')}
          value={manual}
          onChangeText={setManual}
          keyboardType="number-pad"
          placeholder="3017620422003"
        />
        <Button
          block
          label={t('journal.scanLookup')}
          disabled={!manualValid}
          onPress={() => onScanned(manual.trim())}
        />
      </Card>

      <Button block variant="ghost" label={t('common.cancel')} onPress={onCancel} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  camera: {
    height: 260,
    borderRadius: radii.card,
    overflow: 'hidden',
    backgroundColor: colors.night,
  },
});
