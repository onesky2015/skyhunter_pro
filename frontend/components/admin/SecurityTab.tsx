import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, Platform, Alert, Image, FlatList,
} from 'react-native';
import { analyticsApi } from '../../services/api';
import { TotpSetupData, AdminAuditLogItem } from '../../types';

interface Props {
  userToken: string | null;
  on401: () => void;
}

export const SecurityTab: React.FC<Props> = ({ userToken, on401 }) => {
  const [totpSetup, setTotpSetup] = useState<TotpSetupData | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogItem[]>([]);

  useEffect(() => {
    const fetchStatus = async () => {
      if (!userToken) return;
      try {
        const [statusData, logs] = await Promise.all([
          analyticsApi.getTotpStatus(userToken, on401),
          analyticsApi.getAuditLog(userToken, on401),
        ]);
        setTotpEnabled(statusData.totp_enabled);
        setAuditLogs(logs);
      } catch {
        // ignore
      } finally {
        setStatusLoading(false);
      }
    };
    fetchStatus();
  }, [userToken]);

  const showAlert = (title: string, msg: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title}\n\n${msg}`);
    } else {
      Alert.alert(title, msg);
    }
  };

  const handleSetup = async () => {
    if (!userToken) return;
    setLoading(true);
    setMessage('');
    try {
      const data = await analyticsApi.setupTotp(userToken, on401);
      setTotpSetup(data);
      setMessage('Scan the QR code with Google Authenticator, then enter the 6-digit code to verify.');
    } catch (err: unknown) {
      showAlert('Error', err instanceof Error ? err.message : 'Failed to setup TOTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!userToken || !totpCode.trim()) return;
    setLoading(true);
    try {
      await analyticsApi.verifyTotp(userToken, totpCode.trim(), on401);
      setTotpEnabled(true);
      setTotpSetup(null);
      setTotpCode('');
      setMessage('');
      showAlert('Success', 'TOTP 2FA has been enabled successfully!');
    } catch (err: unknown) {
      showAlert('Error', err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!userToken) return;
    const confirmed = Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.confirm('Are you sure you want to disable TOTP 2FA?')
      : await new Promise<boolean>((resolve) => {
          Alert.alert('Disable 2FA?', 'This will remove TOTP protection.', [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Disable', style: 'destructive', onPress: () => resolve(true) },
          ]);
        });
    if (!confirmed) return;
    setLoading(true);
    try {
      await analyticsApi.disableTotp(userToken, on401);
      setTotpEnabled(false);
      showAlert('Success', 'TOTP 2FA has been disabled');
    } catch (err: unknown) {
      showAlert('Error', err instanceof Error ? err.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  if (statusLoading) {
    return (
      <View style={{ padding: 40, alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#00FF00" />
      </View>
    );
  }

  return (
    <View>
      <View style={s.section}>
        <Text style={s.sectionTitle}>Two-Factor Authentication (TOTP)</Text>
        <Text style={s.desc}>
          Protect your admin account with Google Authenticator or any TOTP-compatible app.
        </Text>

        <View style={s.statusRow}>
          <Text style={s.statusLabel}>Status:</Text>
          <Text style={[s.statusValue, { color: totpEnabled ? '#00FF00' : '#FF4444' }]}>
            {totpEnabled ? 'ENABLED' : 'DISABLED'}
          </Text>
        </View>

        {!totpEnabled && !totpSetup && (
          <TouchableOpacity style={s.setupBtn} onPress={handleSetup} disabled={loading}>
            <Text style={s.setupBtnText}>{loading ? 'Setting up...' : 'Setup TOTP 2FA'}</Text>
          </TouchableOpacity>
        )}

        {totpSetup && (
          <View style={s.setupCard}>
            {message ? <Text style={s.message}>{message}</Text> : null}

            <Text style={s.qrLabel}>1. Scan this QR code:</Text>
            {totpSetup.qr_code_base64 ? (
              <View style={s.qrContainer}>
                <Image
                  source={{ uri: `data:image/png;base64,${totpSetup.qr_code_base64}` }}
                  style={s.qrImage}
                  resizeMode="contain"
                />
              </View>
            ) : (
              <Text style={s.manualUri}>{totpSetup.provisioning_uri}</Text>
            )}

            <Text style={s.secretLabel}>Or enter this secret manually:</Text>
            <Text style={s.secretValue} selectable>{totpSetup.secret}</Text>

            <Text style={s.qrLabel}>2. Enter the 6-digit code:</Text>
            <TextInput
              style={s.codeInput}
              value={totpCode}
              onChangeText={setTotpCode}
              placeholder="000000"
              placeholderTextColor="#666"
              maxLength={6}
              keyboardType="number-pad"
            />
            <TouchableOpacity style={s.verifyBtn} onPress={handleVerify} disabled={loading || totpCode.length !== 6}>
              <Text style={s.verifyBtnText}>{loading ? 'Verifying...' : 'Verify & Enable'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => { setTotpSetup(null); setMessage(''); }}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {totpEnabled && (
          <TouchableOpacity style={s.disableBtn} onPress={handleDisable} disabled={loading}>
            <Text style={s.disableBtnText}>{loading ? 'Disabling...' : 'Disable TOTP 2FA'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {auditLogs.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Recent Audit Log ({auditLogs.length})</Text>
          {auditLogs.slice(0, 20).map((log) => (
            <View key={log.id} style={s.auditRow}>
              <View style={s.auditHeader}>
                <Text style={s.auditAction}>{log.action}</Text>
                <Text style={s.auditTime}>
                  {log.created_at ? new Date(log.created_at).toLocaleString() : ''}
                </Text>
              </View>
              <Text style={s.auditDetail}>
                {log.target_type ? `${log.target_type}:${log.target_id}` : ''}
                {log.ip_address ? ` · ${log.ip_address}` : ''}
              </Text>
              {log.details ? <Text style={s.auditMeta}>{log.details}</Text> : null}
            </View>
          ))}
        </View>
      )}

      <View style={s.section}>
        <Text style={s.sectionTitle}>Security Notes</Text>
        <Text style={s.note}>• Only admin accounts can access this panel</Text>
        <Text style={s.note}>• All admin actions are logged in the audit trail</Text>
        <Text style={s.note}>• TOTP adds a second layer of protection at login</Text>
        <Text style={s.note}>• Keep your authenticator app backup codes safe</Text>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  section: {
    backgroundColor: '#1A1A1A', borderRadius: 10, padding: 14,
    marginBottom: 12, borderWidth: 1, borderColor: '#333',
  },
  sectionTitle: { color: '#00FF00', fontSize: 14, fontWeight: '700', marginBottom: 8 },
  desc: { color: '#999', fontSize: 12, marginBottom: 12, lineHeight: 18 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 8 },
  statusLabel: { color: '#999', fontSize: 13 },
  statusValue: { fontSize: 13, fontWeight: '700' },
  setupBtn: {
    backgroundColor: '#00FF00', paddingVertical: 12, borderRadius: 8, alignItems: 'center',
  },
  setupBtnText: { color: '#000', fontSize: 14, fontWeight: '700' },
  setupCard: { marginTop: 8 },
  message: { color: '#FFD700', fontSize: 12, marginBottom: 12, lineHeight: 18 },
  qrLabel: { color: '#CCC', fontSize: 12, fontWeight: '600', marginBottom: 8, marginTop: 8 },
  qrContainer: {
    backgroundColor: '#FFF', padding: 12, borderRadius: 8, alignItems: 'center',
    alignSelf: 'center', marginBottom: 12,
  },
  qrImage: { width: 180, height: 180 },
  manualUri: { color: '#888', fontSize: 9, marginBottom: 12, wordBreak: 'break-all' as any },
  secretLabel: { color: '#999', fontSize: 11, marginTop: 8 },
  secretValue: {
    color: '#FFD700', fontSize: 14, fontWeight: '700', letterSpacing: 2,
    backgroundColor: '#222', padding: 10, borderRadius: 6, textAlign: 'center',
    marginVertical: 8, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  codeInput: {
    backgroundColor: '#222', color: '#FFF', padding: 14, borderRadius: 8,
    borderWidth: 1, borderColor: '#444', fontSize: 20, textAlign: 'center',
    letterSpacing: 6, fontWeight: '700', marginBottom: 12,
  },
  verifyBtn: {
    backgroundColor: '#00FF00', paddingVertical: 12, borderRadius: 8, alignItems: 'center',
    marginBottom: 8,
  },
  verifyBtnText: { color: '#000', fontSize: 14, fontWeight: '700' },
  cancelBtn: {
    backgroundColor: '#333', paddingVertical: 10, borderRadius: 8, alignItems: 'center',
  },
  cancelBtnText: { color: '#CCC', fontSize: 13, fontWeight: '600' },
  disableBtn: {
    backgroundColor: '#FF4444', paddingVertical: 12, borderRadius: 8, alignItems: 'center',
  },
  disableBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  note: { color: '#888', fontSize: 11, marginBottom: 6, lineHeight: 16 },
  auditRow: {
    backgroundColor: '#222', borderRadius: 6, padding: 10,
    marginBottom: 6, borderWidth: 1, borderColor: '#333',
  },
  auditHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  auditAction: { color: '#FFD700', fontSize: 12, fontWeight: '700' },
  auditTime: { color: '#666', fontSize: 10 },
  auditDetail: { color: '#AAA', fontSize: 11 },
  auditMeta: { color: '#666', fontSize: 10, marginTop: 2 },
});
