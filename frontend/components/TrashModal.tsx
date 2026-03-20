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
              <ActivityIndicator size="large" color="#00FF00" />
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#111111',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: '#00FF00',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    color: '#00FF00',
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  center: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#666666',
    fontSize: 16,
  },
  list: {
    maxHeight: 400,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#222222',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  itemContent: {
    flex: 1,
  },
  itemRoute: {
    color: '#00FF00',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemMeta: {
    color: '#999999',
    fontSize: 12,
    marginBottom: 4,
  },
  itemPrice: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  restoreButton: {
    backgroundColor: '#00FF00',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginLeft: 12,
  },
  restoreText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '700',
  },
  closeButtonBottom: {
    backgroundColor: '#333333',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

