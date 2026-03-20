// filename: app/(tabs)/profile.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { userApi, authApi } from '../../services/api';
import { AdminPanel } from '../../components/AdminPanel';
import { useI18n } from '../../i18n';

export default function ProfileScreen() {
  const { t, lang, setLang } = useI18n();
  const router = useRouter();
  const { userInfo, userToken, logout, refreshUserInfo, handle401Error } = useAuth();
  const [topupLoading, setTopupLoading] = useState(false);
  const [adminPanelVisible, setAdminPanelVisible] = useState(false);
  const [changePwdVisible, setChangePwdVisible] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changePwdLoading, setChangePwdLoading] = useState(false);
  const [deleteAccVisible, setDeleteAccVisible] = useState(false);
  const [deleteAccPassword, setDeleteAccPassword] = useState('');
  const [deleteAccLoading, setDeleteAccLoading] = useState(false);

  const handleTopup = async (amount: number = 50) => {
    if (!userToken) return;
    setTopupLoading(true);
    try {
      const data = await userApi.topup(userToken, amount, handle401Error);
      Alert.alert(t('profile', 'topUpSuccess'), t('profile', 'topUpCreditsMsg').replace('{n}', String(data.credits_added)).replace('{total}', String(data.credits_total)));
      await refreshUserInfo();
    } catch (err: unknown) {
      Alert.alert(t('profile', 'topUpFailed'), err instanceof Error ? err.message : t('profile', 'unknownError'));
    } finally {
      setTopupLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert(t('common', 'error'), t('profile', 'newPasswordMin6'));
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('common', 'error'), t('profile', 'passwordMismatch'));
      return;
    }
    if (!userToken) return;
    setChangePwdLoading(true);
    try {
      await authApi.changePassword(userToken, oldPassword, newPassword, handle401Error);
      Alert.alert(t('common', 'success'), t('profile', 'changePwdSuccess'));
      setChangePwdVisible(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      await logout();
      router.replace('/auth/login');
    } catch (err: unknown) {
      Alert.alert(t('profile', 'changePwdFailed'), err instanceof Error ? err.message : t('profile', 'unknownError'));
    } finally {
      setChangePwdLoading(false);
    }
  };

  const handleLogout = async () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Web 端使用 window.confirm 替代 Alert.alert（兼容性更好）
      const confirmed = window.confirm(t('profile', 'logoutConfirm'));
      if (confirmed) {
        await logout();
        router.replace('/auth/login');
      }
    } else {
      Alert.alert(t('auth', 'logout'), t('profile', 'logoutConfirm'), [
        { text: t('common', 'cancel'), style: 'cancel' },
        {
          text: t('auth', 'logout'),
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/auth/login');
          },
        },
      ]);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deleteAccPassword) {
      Alert.alert(t('common', 'error'), t('profile', 'enterPasswordConfirm'));
      return;
    }
    if (!userToken) return;
    setDeleteAccLoading(true);
    try {
      await authApi.deleteAccount(userToken, deleteAccPassword, handle401Error);
      setDeleteAccVisible(false);
      setDeleteAccPassword('');
      Alert.alert(
        t('profile', 'accountDeleted'),
        t('profile', 'accountDeletedMsg'),
        [{ text: 'OK', onPress: async () => { await logout(); router.replace('/auth/login'); } }]
      );
    } catch (err: unknown) {
      Alert.alert(t('profile', 'deleteFailed'), err instanceof Error ? err.message : t('profile', 'unknownError'));
    } finally {
      setDeleteAccLoading(false);
    }
  };

  if (!userInfo) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#00FF00" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>👤 {t('profile', 'title').toUpperCase()}</Text>

      {/* User Info Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('profile', 'userInfo')}</Text>
        <View style={styles.infoRow}>
          <Text style={styles.label}>{t('profile', 'emailLabel')}</Text>
          <Text style={styles.value}>{userInfo.email}</Text>
        </View>
        {userInfo.full_name && (
          <View style={styles.infoRow}>
            <Text style={styles.label}>{t('profile', 'nameLabel')}</Text>
            <Text style={styles.value}>{userInfo.full_name}</Text>
          </View>
        )}
        <View style={styles.infoRow}>
          <Text style={styles.label}>{t('profile', 'roleLabel')}</Text>
          <Text style={styles.value}>{userInfo.role}</Text>
        </View>
      </View>

      {/* Credits Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>💎 {t('profile', 'creditsBalance').toUpperCase()}</Text>
        <Text style={styles.creditsValue}>💎 {userInfo.credits}</Text>
        <Text style={styles.creditsSubtext}>{t('profile', 'creditsSubtext')}</Text>

        <TouchableOpacity
          style={[styles.topupButton, topupLoading && styles.topupButtonDisabled]}
          onPress={() => handleTopup(50)}
          disabled={topupLoading}
        >
          {topupLoading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.topupButtonText}>{t('profile', 'topUp50')}</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Actions */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('profile', 'actions')}</Text>
        <TouchableOpacity
          style={[styles.actionButton, styles.changePwdButton]}
          onPress={() => setChangePwdVisible(true)}
        >
          <Text style={styles.actionButtonText}>🔐 {t('profile', 'changePassword').toUpperCase()}</Text>
        </TouchableOpacity>
        {userInfo?.role === 'admin' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.adminButton]}
            onPress={() => setAdminPanelVisible(true)}
          >
            <Text style={styles.actionButtonText}>🔧 {t('profile', 'adminPanel').toUpperCase()}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#333333', marginBottom: 12 }]}
          onPress={() => setLang(lang === 'zh' ? 'en' : 'zh')}
        >
          <Text style={styles.actionButtonText}>🌐 {t('profile', 'language')}: {lang === 'zh' ? t('profile', 'chinese') : t('profile', 'english')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={handleLogout}>
          <Text style={styles.actionButtonText}>🚪 {t('auth', 'logout').toUpperCase()}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteAccButton]}
          onPress={() => {
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
              const confirmed = window.confirm(t('profile', 'deleteAccountConfirm'));
              if (confirmed) setDeleteAccVisible(true);
            } else {
              Alert.alert(
                t('profile', 'deleteAccount'),
                t('profile', 'deleteAccountConfirm'),
                [
                  { text: t('common', 'cancel'), style: 'cancel' },
                  { text: t('common', 'delete'), style: 'destructive', onPress: () => setDeleteAccVisible(true) },
                ]
              );
            }
          }}
        >
          <Text style={styles.actionButtonText}>🗑️ {t('profile', 'deleteAccount').toUpperCase()}</Text>
        </TouchableOpacity>
      </View>

      {/* Change Password Modal */}
      <Modal visible={changePwdVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('profile', 'changePassword')}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={t('auth', 'oldPassword')}
              placeholderTextColor="#666"
              secureTextEntry
              value={oldPassword}
              onChangeText={setOldPassword}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.modalInput}
              placeholder={t('auth', 'newPassword')}
              placeholderTextColor="#666"
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.modalInput}
              placeholder={t('auth', 'confirmPassword')}
              placeholderTextColor="#666"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              autoCapitalize="none"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setChangePwdVisible(false);
                  setOldPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
              >
                <Text style={styles.modalButtonText}>{t('common', 'cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSubmit, changePwdLoading && styles.topupButtonDisabled]}
                onPress={handleChangePassword}
                disabled={changePwdLoading}
              >
                {changePwdLoading ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <Text style={[styles.modalButtonText, styles.modalButtonTextSubmit]}>{t('profile', 'submit')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete Account Modal */}
      <Modal visible={deleteAccVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContent}>
            <Text style={[styles.modalTitle, { color: '#FF4444' }]}>{t('profile', 'deleteAccount')}</Text>
            <Text style={{ color: '#a1a1aa', fontSize: 13, marginBottom: 16, textAlign: 'center' }}>
              {t('profile', 'enterPasswordToDelete')}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder={t('auth', 'oldPassword')}
              placeholderTextColor="#666"
              secureTextEntry
              value={deleteAccPassword}
              onChangeText={setDeleteAccPassword}
              autoCapitalize="none"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => { setDeleteAccVisible(false); setDeleteAccPassword(''); }}
              >
                <Text style={styles.modalButtonText}>{t('common', 'cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.deleteConfirmButton, deleteAccLoading && styles.topupButtonDisabled]}
                onPress={handleDeleteAccount}
                disabled={deleteAccLoading}
              >
                {deleteAccLoading ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.modalButtonText}>{t('common', 'delete').toUpperCase()}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Admin Panel */}
      <AdminPanel
        visible={adminPanelVisible}
        onClose={() => setAdminPanelVisible(false)}
        userToken={userToken}
        on401={handle401Error}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    padding: 16,
  },
  title: {
    color: '#00FF00',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  card: {
    backgroundColor: '#111111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333333',
  },
  cardTitle: {
    color: '#00FF00',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    color: '#666666',
    fontSize: 14,
  },
  value: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  creditsValue: {
    color: '#00FF00',
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    marginVertical: 16,
  },
  creditsSubtext: {
    color: '#666666',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
  },
  topupButton: {
    backgroundColor: '#00FF00',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  topupButtonDisabled: {
    opacity: 0.5,
  },
  topupButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
  actionButton: {
    backgroundColor: '#FF4444',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  adminButton: {
    backgroundColor: '#FFD700',
    marginBottom: 12,
  },
  changePwdButton: {
    backgroundColor: '#333333',
    marginBottom: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#111111',
    borderRadius: 12,
    padding: 24,
    borderWidth: 1,
    borderColor: '#333333',
  },
  modalTitle: {
    color: '#00FF00',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#222222',
    borderRadius: 8,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#444444',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#444444',
  },
  modalButtonSubmit: {
    backgroundColor: '#00FF00',
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  modalButtonTextSubmit: {
    color: '#000000',
  },
  deleteAccButton: {
    backgroundColor: '#8B0000',
    marginTop: 12,
  },
  deleteConfirmButton: {
    backgroundColor: '#FF4444',
  },
});
