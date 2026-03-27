// filename: components/TrashModal.tsx
import React from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { MonitorTask } from '../types';
import { formatPrice } from '../constants/utils';
import { useI18n } from '../i18n';
import { useTheme, getShadowStyle } from '../theme';

interface TrashModalProps {
  visible: boolean;
  onClose: () => void;
  monitors: MonitorTask[];
  loading: boolean;
  onRestore: (id: number) => void;
}

export const TrashModal: React.FC<TrashModalProps> = ({
  visible,
  onClose,
  monitors,
  loading,
  onRestore,
}) => {
  const { t } = useI18n();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>🗑️ {t('monitors', 'trashBin')}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={theme.colors.accent} />
            </View>
          ) : monitors.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>{t('monitors', 'trashEmpty')}</Text>
            </View>
          ) : (
            <ScrollView style={styles.list}>
              {monitors.map((task) => (
                <View key={task.id} style={styles.item}>
                  <View style={styles.itemContent}>
                    <Text style={styles.itemRoute}>
                      {task.origin} → {task.destination}
                    </Text>
                    <Text style={styles.itemMeta}>
                      {task.start_date} · {task.days}d
                    </Text>
                    {task.current_price != null && (
                      <Text style={styles.itemPrice}>
                        {formatPrice(task.current_price)}
                      </Text>
                    )}
                  </View>
                  <TouchableOpacity
                    style={styles.restoreButton}
                    onPress={() => onRestore(task.id)}
                  >
                    <Text style={styles.restoreText}>♻️ {t('monitors', 'restore')}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          <TouchableOpacity style={styles.closeButtonBottom} onPress={onClose}>
            <Text style={styles.closeButtonText}>{t('common', 'close')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      justifyContent: 'flex-end',
    },
    modal: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.radius.lg,
      borderTopRightRadius: theme.radius.lg,
      padding: 20,
      maxHeight: '80%',
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      ...getShadowStyle(theme, 1),
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    title: {
      color: theme.colors.accent,
      fontSize: 20,
      fontWeight: '700',
    },
    closeButton: {
      color: theme.colors.text,
      fontSize: 24,
      fontWeight: '700',
    },
    center: {
      padding: 40,
      alignItems: 'center',
    },
    emptyText: {
      color: theme.colors.textSoft,
      fontSize: 16,
    },
    list: {
      maxHeight: 400,
    },
    item: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceMuted,
      padding: 12,
      borderRadius: theme.radius.sm,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    itemContent: {
      flex: 1,
    },
    itemRoute: {
      color: theme.colors.accent,
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    itemMeta: {
      color: theme.colors.textMuted,
      fontSize: 12,
      marginBottom: 4,
    },
    itemPrice: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '600',
    },
    restoreButton: {
      backgroundColor: theme.colors.accent,
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 6,
      marginLeft: 12,
    },
    restoreText: {
      color: theme.colors.accentText,
      fontSize: 12,
      fontWeight: '700',
    },
    closeButtonBottom: {
      backgroundColor: theme.colors.surfaceMuted,
      padding: 16,
      borderRadius: theme.radius.sm,
      alignItems: 'center',
      marginTop: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    closeButtonText: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '700',
    },
  });

