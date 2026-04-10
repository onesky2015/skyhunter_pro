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
import { authApi } from '../../services/api';
import { AdminPanel } from '../../components/AdminPanel';
import { useI18n } from '../../i18n';
import { useTheme, getShadowStyle } from '../../theme';

export default function ProfileScreen() {
  const { t, lang, setLang } = useI18n();
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const router = useRouter();
  const { userInfo, userToken, logout, refreshUserInfo, handle401Error } = useAuth();
  const [adminPanelVisible, setAdminPanelVisible] = useState(false);
  const [changePwdVisible, setChangePwdVisible] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changePwdLoading, setChangePwdLoading] = useState(false);
  const [deleteAccVisible, setDeleteAccVisible] = useState(false);
  const [deleteAccPassword, setDeleteAccPassword] = useState('');
  const [deleteAccLoading, setDeleteAccLoading] = useState(false);

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
        <ActivityIndicator size="large" color={theme.colors.accent} />
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
          style={styles.topupButton}
          onPress={() => router.push('/purchase')}
        >
          <Text style={styles.topupButtonText}>{t('purchase', 'buy') || t('profile', 'topUpOpen')}</Text>
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
          style={[styles.actionButton, styles.changePwdButton]}
          onPress={() => setLang(lang === 'zh' ? 'en' : 'zh')}
        >
          <Text style={styles.actionButtonText}>🌐 {t('profile', 'language')}: {lang === 'zh' ? t('profile', 'chinese') : t('profile', 'english')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.settingsButton]}
          onPress={() => router.push('/settings')}
        >
          <Text style={styles.actionButtonText}>🎨 {t('settings', 'title').toUpperCase()}</Text>
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
                  <ActivityIndicator color={theme.colors.accentText} size="small" />
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
            <Text style={[styles.modalTitle, styles.deleteTitle]}>{t('profile', 'deleteAccount')}</Text>
            <Text style={styles.deleteHint}>
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

const createStyles = (theme: ReturnType<typeof useTheme>['theme']) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      padding: 16,
    },
    title: {
      color: theme.colors.accent,
      fontSize: 20,
      fontWeight: '700',
      marginBottom: 16,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.colors.border,
      ...getShadowStyle(theme, theme.name === 'light' ? 0.8 : 1),
    },
    cardTitle: {
      color: theme.colors.accent,
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
      color: theme.colors.textSoft,
      fontSize: 14,
    },
    value: {
      color: theme.colors.text,
      fontSize: 14,
      fontWeight: '600',
    },
    creditsValue: {
      color: theme.colors.accent,
      fontSize: 32,
      fontWeight: '700',
      textAlign: 'center',
      marginVertical: 16,
    },
    creditsSubtext: {
      color: theme.colors.textSoft,
      fontSize: 12,
      textAlign: 'center',
      marginBottom: 16,
    },
    topupButton: {
      backgroundColor: theme.colors.accent,
      padding: 16,
      borderRadius: theme.radius.sm,
      alignItems: 'center',
    },
    topupButtonDisabled: {
      opacity: 0.5,
    },
    topupButtonText: {
      color: theme.colors.accentText,
      fontSize: 16,
      fontWeight: '700',
    },
    actionButton: {
      backgroundColor: theme.colors.danger,
      padding: 16,
      borderRadius: theme.radius.sm,
      alignItems: 'center',
    },
    actionButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    adminButton: {
      backgroundColor: theme.colors.warning,
      marginBottom: 12,
    },
    changePwdButton: {
      backgroundColor: theme.colors.surfaceMuted,
      marginBottom: 12,
    },
    settingsButton: {
      backgroundColor: theme.colors.accent,
      marginBottom: 12,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      justifyContent: 'center',
      padding: 24,
    },
    modalContent: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.md,
      padding: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
      ...getShadowStyle(theme, 1),
    },
    modalTitle: {
      color: theme.colors.accent,
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 20,
      textAlign: 'center',
    },
    modalInput: {
      backgroundColor: theme.colors.inputBg,
      borderRadius: theme.radius.sm,
      padding: 14,
      color: theme.colors.text,
      fontSize: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.colors.inputBorder,
    },
    modalButtons: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 8,
    },
    modalButton: {
      flex: 1,
      padding: 14,
      borderRadius: theme.radius.sm,
      alignItems: 'center',
    },
    modalButtonCancel: {
      backgroundColor: theme.colors.surfaceMuted,
    },
    modalButtonSubmit: {
      backgroundColor: theme.colors.accent,
    },
    modalButtonText: {
      color: theme.colors.text,
      fontSize: 16,
      fontWeight: '600',
    },
    modalButtonTextSubmit: {
      color: theme.colors.accentText,
    },
    deleteAccButton: {
      backgroundColor: '#8B0000',
      marginTop: 12,
    },
    deleteConfirmButton: {
      backgroundColor: theme.colors.danger,
    },
    deleteTitle: {
      color: theme.colors.danger,
    },
    deleteHint: {
      color: theme.colors.textMuted,
      fontSize: 13,
      marginBottom: 16,
      textAlign: 'center',
    },
  });
