import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { AdminStats, AdminUser, AdminMonitor, AdminAirport } from '../types';
import { adminApi } from '../services/api';
import { formatPrice } from '../constants/utils';
import { useI18n } from '../i18n';
import { DashboardTab } from './admin/DashboardTab';
import { AnalyticsTab } from './admin/AnalyticsTab';
import { CostsTab } from './admin/CostsTab';
import { SecurityTab } from './admin/SecurityTab';

interface AdminPanelProps {
  visible: boolean;
  onClose: () => void;
  userToken: string | null;
  on401: () => void;
}

type TabKey = 'dashboard' | 'users' | 'monitors' | 'airports' | 'analytics' | 'costs' | 'security';

const AIRPORT_TYPE_OPTIONS = [
  'large_airport',
  'medium_airport',
  'small_airport',
  'heliport',
  'seaplane_base',
];

export const AdminPanel: React.FC<AdminPanelProps> = ({
  visible,
  onClose,
  userToken,
  on401,
}) => {
  const { t } = useI18n();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [monitors, setMonitors] = useState<AdminMonitor[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');

  // ---- Users filter state ----
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');

  // ---- Monitors filter state ----
  const [monitorSearch, setMonitorSearch] = useState('');
  const [monitorStatusFilter, setMonitorStatusFilter] = useState<string>('all');

  // ---- Airports state ----
  const [airports, setAirports] = useState<AdminAirport[]>([]);
  const [airportTotal, setAirportTotal] = useState(0);
  const [airportPage, setAirportPage] = useState(1);
  const [airportSearch, setAirportSearch] = useState('');
  const [airportShowDisabled, setAirportShowDisabled] = useState(true);
  const [airportLoading, setAirportLoading] = useState(false);
  const PAGE_SIZE = 50;

  // ---- Airport edit/add modal ----
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editAirport, setEditAirport] = useState<AdminAirport | null>(null);
  const [formData, setFormData] = useState({
    iata_code: '', icao_code: '', name: '', municipality: '',
    iso_country: '', iso_region: '', airport_type: 'medium_airport',
    latitude: '', longitude: '', is_disabled: false,
  });
  const [formSaving, setFormSaving] = useState(false);

  // ---- CSV upload ----
  const [csvUploading, setCsvUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // ============ Data Fetching ============

  const fetchData = async () => {
    if (!userToken) return;
    setLoading(true);
    try {
      const [statsData, usersData, monitorsData] = await Promise.all([
        adminApi.getStats(userToken, on401),
        adminApi.getUsers(userToken, on401),
        adminApi.getMonitors(userToken, on401),
      ]);
      setStats(statsData);
      setUsers(usersData);
      setMonitors(monitorsData);
    } catch (err) {
      console.error('Admin fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAirports = useCallback(async (page = 1, search = '') => {
    if (!userToken) return;
    setAirportLoading(true);
    try {
      const data = await adminApi.getAirports(
        userToken,
        { page, page_size: PAGE_SIZE, q: search, show_disabled: airportShowDisabled },
        on401,
      );
      setAirports(data.items);
      setAirportTotal(data.total);
      setAirportPage(data.page);
    } catch (err) {
      console.error('Airport fetch error:', err);
    } finally {
      setAirportLoading(false);
    }
  }, [userToken, on401, airportShowDisabled]);

  useEffect(() => {
    if (visible && userToken) {
      fetchData();
    }
  }, [visible, userToken]);

  useEffect(() => {
    if (visible && activeTab === 'airports' && userToken) {
      fetchAirports(1, airportSearch);
    }
  }, [visible, activeTab, userToken, airportShowDisabled]);

  // ============ Existing User/Monitor actions ============

  const adjustCredits = async (userId: number, amount: number) => {
    if (!userToken) return;
    try {
      const data = await adminApi.adjustCredits(userToken, userId, amount, on401);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, credits: data.credits_after } : u))
      );
      showAlert('Success', `Credits adjusted. New balance: ${data.credits_after}`);
    } catch (err: unknown) {
      showAlert('Error', err instanceof Error ? err.message : 'Failed');
    }
  };

  const deleteUser = async (userId: number) => {
    if (!userToken) return;
    const confirmed = Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.confirm(`Delete user #${userId}?`)
      : await new Promise<boolean>((resolve) => {
          Alert.alert(t('common', 'delete') + ' User?', 'This action cannot be undone.', [
            { text: t('common', 'cancel'), style: 'cancel', onPress: () => resolve(false) },
            { text: t('common', 'delete'), style: 'destructive', onPress: () => resolve(true) },
          ]);
        });
    if (!confirmed) return;
    try {
      await adminApi.deleteUser(userToken, userId, on401);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      showAlert('Success', 'User deleted');
    } catch (err: unknown) {
      showAlert('Error', err instanceof Error ? err.message : 'Failed');
    }
  };

  // ============ Airport CRUD ============

  const openAddAirport = () => {
    setEditAirport(null);
    setFormData({
      iata_code: '', icao_code: '', name: '', municipality: '',
      iso_country: '', iso_region: '', airport_type: 'medium_airport',
      latitude: '', longitude: '', is_disabled: false,
    });
    setEditModalVisible(true);
  };

  const openEditAirport = (ap: AdminAirport) => {
    setEditAirport(ap);
    setFormData({
      iata_code: ap.iata_code,
      icao_code: ap.icao_code || '',
      name: ap.name,
      municipality: ap.municipality || '',
      iso_country: ap.iso_country,
      iso_region: ap.iso_region || '',
      airport_type: ap.airport_type,
      latitude: ap.latitude != null ? String(ap.latitude) : '',
      longitude: ap.longitude != null ? String(ap.longitude) : '',
      is_disabled: ap.is_disabled,
    });
    setEditModalVisible(true);
  };

  const handleSaveAirport = async () => {
    if (!userToken) return;
    if (!formData.iata_code.trim() || !formData.name.trim() || !formData.iso_country.trim()) {
      showAlert('Error', 'IATA Code, Name, and Country are required');
      return;
    }
    setFormSaving(true);
    try {
      const payload: Record<string, unknown> = {
        iata_code: formData.iata_code.trim().toUpperCase(),
        icao_code: formData.icao_code.trim().toUpperCase() || null,
        name: formData.name.trim(),
        municipality: formData.municipality.trim() || null,
        iso_country: formData.iso_country.trim().toUpperCase(),
        iso_region: formData.iso_region.trim() || null,
        airport_type: formData.airport_type,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        is_disabled: formData.is_disabled,
      };

      if (editAirport) {
        await adminApi.updateAirport(userToken, editAirport.id, payload as Partial<AdminAirport>, on401);
        showAlert('Success', `Airport ${formData.iata_code} updated`);
      } else {
        await adminApi.createAirport(userToken, payload as Partial<AdminAirport>, on401);
        showAlert('Success', `Airport ${formData.iata_code} added`);
      }
      setEditModalVisible(false);
      fetchAirports(airportPage, airportSearch);
    } catch (err: unknown) {
      showAlert('Error', err instanceof Error ? err.message : 'Failed');
    } finally {
      setFormSaving(false);
    }
  };

  const toggleDisabled = async (ap: AdminAirport) => {
    if (!userToken) return;
    try {
      await adminApi.updateAirport(userToken, ap.id, { is_disabled: !ap.is_disabled } as Partial<AdminAirport>, on401);
      setAirports((prev) =>
        prev.map((a) => (a.id === ap.id ? { ...a, is_disabled: !ap.is_disabled } : a))
      );
    } catch (err: unknown) {
      showAlert('Error', err instanceof Error ? err.message : 'Failed');
    }
  };

  // ============ CSV Upload ============

  const handleCsvUpload = async () => {
    if (Platform.OS === 'web' && fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      showAlert('Info', 'CSV upload is only supported on Web');
    }
  };

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userToken) return;
    setCsvUploading(true);
    try {
      const result = await adminApi.uploadAirportsCsv(userToken, file, on401);
      showAlert(
        'Upload Complete',
        `Parsed: ${result.total_parsed}\nInserted: ${result.inserted}\nSkipped (existing): ${result.skipped_existing}\nSkipped (no IATA): ${result.skipped_no_iata}`,
      );
      fetchAirports(1, airportSearch);
    } catch (err: unknown) {
      showAlert('Upload Failed', err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setCsvUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ============ Helpers ============

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  // ---- Filtered users ----
  const filteredUsers = users.filter((user) => {
    const searchLower = userSearch.toLowerCase().trim();
    const matchesSearch =
      !searchLower ||
      user.email.toLowerCase().includes(searchLower) ||
      String(user.id).includes(searchLower) ||
      String(user.credits).includes(searchLower);
    const matchesRole = userRoleFilter === 'all' || user.role === userRoleFilter;
    return matchesSearch && matchesRole;
  });

  const userRoles = Array.from(new Set(users.map((u) => u.role)));

  // ---- Filtered monitors ----
  const filteredMonitors = monitors.filter((monitor) => {
    const searchLower = monitorSearch.toLowerCase().trim();
    const matchesSearch =
      !searchLower ||
      (monitor.user_email || '').toLowerCase().includes(searchLower) ||
      monitor.origin.toLowerCase().includes(searchLower) ||
      monitor.destination.toLowerCase().includes(searchLower) ||
      String(monitor.id).includes(searchLower);
    const matchesStatus =
      monitorStatusFilter === 'all' || monitor.status === monitorStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const monitorStatuses = Array.from(new Set(monitors.map((m) => m.status)));

  const totalPages = Math.max(1, Math.ceil(airportTotal / PAGE_SIZE));

  const handleAirportSearch = () => {
    fetchAirports(1, airportSearch);
  };

  // ============ Render ============

  const renderAirportsTab = () => (
    <View>
      {/* Search bar + Actions */}
      <View style={s.apSearchRow}>
        <TextInput
          style={s.apSearchInput}
          value={airportSearch}
          onChangeText={setAirportSearch}
          placeholder={t('admin', 'searchAirportPlaceholder')}
          placeholderTextColor="#666"
          onSubmitEditing={handleAirportSearch}
        />
        <TouchableOpacity style={s.apSearchBtn} onPress={handleAirportSearch}>
          <Text style={s.apSearchBtnText}>{t('admin', 'search')}</Text>
        </TouchableOpacity>
      </View>

      <View style={s.apActionsRow}>
        <TouchableOpacity style={s.apAddBtn} onPress={openAddAirport}>
          <Text style={s.apAddBtnText}>+ {t('admin', 'addAirport')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.apUploadBtn} onPress={handleCsvUpload}>
          <Text style={s.apUploadBtnText}>
            {csvUploading ? 'Uploading...' : '📁 Upload CSV'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.apFilterBtn, airportShowDisabled && s.apFilterBtnActive]}
          onPress={() => setAirportShowDisabled(!airportShowDisabled)}
        >
          <Text style={s.apFilterBtnText}>
            {airportShowDisabled ? 'Show All' : 'Hide Disabled'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Hidden file input for web */}
      {Platform.OS === 'web' && (
        <input
          ref={fileInputRef as React.RefObject<HTMLInputElement>}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={onFileSelected as unknown as React.ChangeEventHandler<HTMLInputElement>}
        />
      )}

      {/* Summary */}
      <Text style={s.apSummary}>
        Total: {airportTotal} airports · Page {airportPage}/{totalPages}
      </Text>

      {airportLoading ? (
        <ActivityIndicator size="small" color="#00FF00" style={{ marginVertical: 20 }} />
      ) : (
        <>
          {airports.map((ap) => (
            <TouchableOpacity key={ap.id} style={[s.apCard, ap.is_disabled && s.apCardDisabled]} onPress={() => openEditAirport(ap)}>
              <View style={s.apCardTop}>
                <Text style={s.apIata}>{ap.iata_code}</Text>
                <Text style={s.apType}>
                  {ap.airport_type === 'large_airport' ? '✈ Large' :
                   ap.airport_type === 'medium_airport' ? '🛩 Medium' :
                   ap.airport_type === 'small_airport' ? '• Small' : ap.airport_type}
                </Text>
                {ap.is_disabled && <Text style={s.apDisabledBadge}>DISABLED</Text>}
              </View>
              <Text style={s.apName} numberOfLines={1}>{ap.name}</Text>
              <Text style={s.apCity}>
                {[ap.municipality, ap.iso_country].filter(Boolean).join(', ')}
                {ap.icao_code ? ` · ICAO: ${ap.icao_code}` : ''}
              </Text>
              <View style={s.apCardActions}>
                <TouchableOpacity
                  style={[s.apToggleBtn, ap.is_disabled ? s.apEnableBtn : s.apDisableBtn]}
                  onPress={(e) => { e.stopPropagation?.(); toggleDisabled(ap); }}
                >
                  <Text style={s.apToggleBtnText}>{ap.is_disabled ? 'Enable' : 'Disable'}</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}

          {/* Pagination */}
          <View style={s.apPagination}>
            <TouchableOpacity
              style={[s.apPageBtn, airportPage <= 1 && s.apPageBtnDisabled]}
              disabled={airportPage <= 1}
              onPress={() => fetchAirports(airportPage - 1, airportSearch)}
            >
              <Text style={s.apPageBtnText}>← Prev</Text>
            </TouchableOpacity>
            <Text style={s.apPageInfo}>
              {airportPage} / {totalPages}
            </Text>
            <TouchableOpacity
              style={[s.apPageBtn, airportPage >= totalPages && s.apPageBtnDisabled]}
              disabled={airportPage >= totalPages}
              onPress={() => fetchAirports(airportPage + 1, airportSearch)}
            >
              <Text style={s.apPageBtnText}>Next →</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );

  const renderEditModal = () => (
    <Modal visible={editModalVisible} transparent animationType="fade" onRequestClose={() => setEditModalVisible(false)}>
      <View style={s.editOverlay}>
        <ScrollView contentContainerStyle={s.editScrollContent} keyboardShouldPersistTaps="handled">
          <View style={s.editModal}>
            <View style={s.editHeader}>
              <Text style={s.editTitle}>{editAirport ? t('admin', 'editAirport') : t('admin', 'addAirport')}</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.fieldLabel}>IATA Code *</Text>
            <TextInput style={s.fieldInput} value={formData.iata_code} onChangeText={(v) => setFormData((p) => ({ ...p, iata_code: v }))} placeholder="JFK" placeholderTextColor="#666" maxLength={4} autoCapitalize="characters" />

            <Text style={s.fieldLabel}>ICAO Code</Text>
            <TextInput style={s.fieldInput} value={formData.icao_code} onChangeText={(v) => setFormData((p) => ({ ...p, icao_code: v }))} placeholder="KJFK" placeholderTextColor="#666" maxLength={4} autoCapitalize="characters" />

            <Text style={s.fieldLabel}>Airport Name *</Text>
            <TextInput style={s.fieldInput} value={formData.name} onChangeText={(v) => setFormData((p) => ({ ...p, name: v }))} placeholder="John F. Kennedy International Airport" placeholderTextColor="#666" />

            <Text style={s.fieldLabel}>City</Text>
            <TextInput style={s.fieldInput} value={formData.municipality} onChangeText={(v) => setFormData((p) => ({ ...p, municipality: v }))} placeholder="New York" placeholderTextColor="#666" />

            <Text style={s.fieldLabel}>Country (ISO) *</Text>
            <TextInput style={s.fieldInput} value={formData.iso_country} onChangeText={(v) => setFormData((p) => ({ ...p, iso_country: v }))} placeholder="US" placeholderTextColor="#666" maxLength={2} autoCapitalize="characters" />

            <Text style={s.fieldLabel}>Region (ISO)</Text>
            <TextInput style={s.fieldInput} value={formData.iso_region} onChangeText={(v) => setFormData((p) => ({ ...p, iso_region: v }))} placeholder="US-NY" placeholderTextColor="#666" maxLength={10} />

            <Text style={s.fieldLabel}>Type</Text>
            <View style={s.typeRow}>
              {AIRPORT_TYPE_OPTIONS.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[s.typeChip, formData.airport_type === t && s.typeChipActive]}
                  onPress={() => setFormData((p) => ({ ...p, airport_type: t }))}
                >
                  <Text style={[s.typeChipText, formData.airport_type === t && s.typeChipTextActive]}>
                    {t.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.coordRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Latitude</Text>
                <TextInput style={s.fieldInput} value={formData.latitude} onChangeText={(v) => setFormData((p) => ({ ...p, latitude: v }))} placeholder="40.6413" placeholderTextColor="#666" keyboardType="numeric" />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={s.fieldLabel}>Longitude</Text>
                <TextInput style={s.fieldInput} value={formData.longitude} onChangeText={(v) => setFormData((p) => ({ ...p, longitude: v }))} placeholder="-73.7781" placeholderTextColor="#666" keyboardType="numeric" />
              </View>
            </View>

            {editAirport && (
              <TouchableOpacity
                style={s.disabledToggle}
                onPress={() => setFormData((p) => ({ ...p, is_disabled: !p.is_disabled }))}
              >
                <View style={[s.checkbox, formData.is_disabled && s.checkboxChecked]}>
                  {formData.is_disabled && <Text style={s.checkmark}>✓</Text>}
                </View>
                <Text style={s.disabledLabel}>Disabled (hidden from search)</Text>
              </TouchableOpacity>
            )}

            <View style={s.editActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setEditModalVisible(false)}>
                <Text style={s.cancelBtnText}>{t('common', 'cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={handleSaveAirport} disabled={formSaving}>
                <Text style={s.saveBtnText}>{formSaving ? t('common', 'saving') : t('common', 'save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>🔧 {t('admin', 'title').toUpperCase()}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll}>
            <View style={styles.tabs}>
              {([
                { key: 'dashboard', label: t('admin', 'dashboard') },
                { key: 'users', label: t('admin', 'users') },
                { key: 'monitors', label: t('admin', 'monitors') },
                { key: 'airports', label: t('admin', 'airports') },
                { key: 'analytics', label: t('admin', 'analytics') },
                { key: 'costs', label: t('admin', 'costs') },
                { key: 'security', label: t('admin', 'security') },
              ] as { key: TabKey; label: string }[]).map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.tab, activeTab === tab.key && styles.tabActive]}
                  onPress={() => setActiveTab(tab.key)}
                >
                  <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {loading && !['dashboard', 'airports', 'analytics', 'costs', 'security'].includes(activeTab) ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color="#00FF00" />
            </View>
          ) : (
            <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
              {activeTab === 'dashboard' && (
                <DashboardTab userToken={userToken} on401={on401} />
              )}

              {activeTab === 'users' && (
                <View>
                  {/* 用户搜索栏 */}
                  <View style={s.filterRow}>
                    <TextInput
                      style={s.filterInput}
                      value={userSearch}
                      onChangeText={setUserSearch}
                      placeholder={t('admin', 'searchUserPlaceholder')}
                      placeholderTextColor="#666"
                    />
                  </View>
                  {/* 角色筛选 */}
                  <View style={s.filterChipsRow}>
                    <TouchableOpacity
                      style={[s.filterChip, userRoleFilter === 'all' && s.filterChipActive]}
                      onPress={() => setUserRoleFilter('all')}
                    >
                      <Text style={[s.filterChipText, userRoleFilter === 'all' && s.filterChipTextActive]}>{t('admin', 'all')}</Text>
                    </TouchableOpacity>
                    {userRoles.map((role) => (
                      <TouchableOpacity
                        key={role}
                        style={[s.filterChip, userRoleFilter === role && s.filterChipActive]}
                        onPress={() => setUserRoleFilter(role)}
                      >
                        <Text style={[s.filterChipText, userRoleFilter === role && s.filterChipTextActive]}>
                          {role.charAt(0).toUpperCase() + role.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    <Text style={s.filterSummary}>
                      {t('admin', 'usersCount').replace('{n}', String(filteredUsers.length)).replace('{total}', String(users.length))}
                    </Text>
                  </View>

                  {filteredUsers.map((user) => (
                    <View key={user.id} style={styles.userCard}>
                      <View style={styles.userInfo}>
                        <Text style={styles.userEmail}>{user.email}</Text>
                        <Text style={styles.userRole}>{t('admin', 'role')}: {user.role}</Text>
                        <Text style={styles.userCredits}>💎 {user.credits}</Text>
                      </View>
                      <View style={styles.userActions}>
                        <TouchableOpacity style={styles.creditButton} onPress={() => adjustCredits(user.id, 10)}>
                          <Text style={styles.creditButtonText}>+10</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.creditButton, styles.creditButtonDeduct]} onPress={() => adjustCredits(user.id, -10)}>
                          <Text style={styles.creditButtonText}>-10</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.deleteButton} onPress={() => deleteUser(user.id)}>
                          <Text style={styles.deleteButtonText}>🗑</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}

                  {filteredUsers.length === 0 && (
                    <View style={s.emptyState}>
                      <Text style={s.emptyStateText}>{t('admin', 'noUsersMatch')}</Text>
                    </View>
                  )}
                </View>
              )}

              {activeTab === 'monitors' && (
                <View>
                  {/* 监控搜索栏 */}
                  <View style={s.filterRow}>
                    <TextInput
                      style={s.filterInput}
                      value={monitorSearch}
                      onChangeText={setMonitorSearch}
                      placeholder={t('admin', 'searchMonitorPlaceholder')}
                      placeholderTextColor="#666"
                    />
                  </View>
                  {/* 状态筛选 */}
                  <View style={s.filterChipsRow}>
                    <TouchableOpacity
                      style={[s.filterChip, monitorStatusFilter === 'all' && s.filterChipActive]}
                      onPress={() => setMonitorStatusFilter('all')}
                    >
                      <Text style={[s.filterChipText, monitorStatusFilter === 'all' && s.filterChipTextActive]}>{t('admin', 'all')}</Text>
                    </TouchableOpacity>
                    {monitorStatuses.map((st) => (
                      <TouchableOpacity
                        key={st}
                        style={[s.filterChip, monitorStatusFilter === st && s.filterChipActive]}
                        onPress={() => setMonitorStatusFilter(st)}
                      >
                        <Text style={[s.filterChipText, monitorStatusFilter === st && s.filterChipTextActive]}>
                          {st.charAt(0).toUpperCase() + st.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                    <Text style={s.filterSummary}>
                      {t('admin', 'monitorsCount').replace('{n}', String(filteredMonitors.length)).replace('{total}', String(monitors.length))}
                    </Text>
                  </View>

                  {filteredMonitors.map((monitor) => (
                    <View key={monitor.id} style={styles.monitorCard}>
                      <Text style={styles.monitorRoute}>
                        #{monitor.id} {monitor.origin} → {monitor.destination}
                      </Text>
                      <Text style={styles.monitorUser}>{t('admin', 'user')}: {monitor.user_email || 'N/A'}</Text>
                      <Text style={styles.monitorMeta}>
                        {monitor.start_date} · {monitor.days}d · {monitor.status}
                      </Text>
                      <View style={s.monitorDetailRow}>
                        {monitor.cabin_class && (
                          <Text style={s.monitorDetailBadge}>{monitor.cabin_class}</Text>
                        )}
                        {monitor.trip_type && (
                          <Text style={s.monitorDetailBadge}>
                            {monitor.trip_type === 'round_trip' ? t('admin', 'roundTrip') : t('admin', 'oneWay')}
                          </Text>
                        )}
                        {monitor.target_price != null && (
                          <Text style={s.monitorTargetBadge}>
                            {t('common', 'target')}: {formatPrice(monitor.target_price)}
                          </Text>
                        )}
                      </View>
                      <View style={s.monitorPriceRow}>
                        {monitor.current_price != null && (
                          <Text style={styles.monitorPrice}>
                            {t('admin', 'current')}: {formatPrice(monitor.current_price)}
                          </Text>
                        )}
                        {monitor.lowest_price != null && (
                          <Text style={s.monitorLowest}>
                            {t('admin', 'lowest')}: {formatPrice(monitor.lowest_price)}
                          </Text>
                        )}
                      </View>
                      {monitor.last_checked_at && (
                        <Text style={s.monitorCheckedAt}>
                          {t('admin', 'lastChecked')}: {new Date(monitor.last_checked_at).toLocaleString()}
                        </Text>
                      )}
                    </View>
                  ))}

                  {filteredMonitors.length === 0 && (
                    <View style={s.emptyState}>
                      <Text style={s.emptyStateText}>{t('admin', 'noMonitorsMatch')}</Text>
                    </View>
                  )}
                </View>
              )}

              {activeTab === 'airports' && renderAirportsTab()}

              {activeTab === 'analytics' && (
                <AnalyticsTab userToken={userToken} on401={on401} />
              )}

              {activeTab === 'costs' && (
                <CostsTab userToken={userToken} on401={on401} />
              )}

              {activeTab === 'security' && (
                <SecurityTab userToken={userToken} on401={on401} />
              )}
            </ScrollView>
          )}

          <TouchableOpacity
            style={styles.refreshButton}
            onPress={() => {
              if (activeTab === 'airports') {
                fetchAirports(airportPage, airportSearch);
              } else {
                fetchData();
              }
            }}
          >
            <Text style={styles.refreshButtonText}>↻ {t('admin', 'refresh')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {renderEditModal()}
    </Modal>
  );
};

// ============ Original styles (preserved) ============
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
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: '#00FF00',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
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
  tabScroll: {
    marginBottom: 16,
    maxHeight: 44,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#222222',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  tabActive: {
    backgroundColor: '#00FF00',
    borderColor: '#00FF00',
  },
  tabText: {
    color: '#666666',
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#000000',
  },
  center: {
    padding: 40,
    alignItems: 'center',
  },
  content: {
    maxHeight: 450,
  },
  statsCard: {
    backgroundColor: '#222222',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
  },
  statsTitle: {
    color: '#00FF00',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statLabel: { color: '#999999', fontSize: 14 },
  statValue: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  userCard: {
    backgroundColor: '#222222',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  userInfo: { flex: 1 },
  userEmail: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  userRole: { color: '#999999', fontSize: 12, marginBottom: 4 },
  userCredits: { color: '#00FF00', fontSize: 14, fontWeight: '600' },
  userActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  creditButton: { backgroundColor: '#00FF00', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  creditButtonDeduct: { backgroundColor: '#FFD700' },
  creditButtonText: { color: '#000000', fontSize: 12, fontWeight: '700' },
  deleteButton: { backgroundColor: '#FF4444', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  deleteButtonText: { fontSize: 16 },
  monitorCard: { backgroundColor: '#222222', padding: 12, borderRadius: 8, marginBottom: 8 },
  monitorRoute: { color: '#00FF00', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  monitorUser: { color: '#999999', fontSize: 12, marginBottom: 4 },
  monitorMeta: { color: '#999999', fontSize: 12, marginBottom: 4 },
  monitorPrice: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  refreshButton: { backgroundColor: '#333333', padding: 16, borderRadius: 8, alignItems: 'center', marginTop: 12 },
  refreshButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});

// ============ Airport-specific styles ============
const s = StyleSheet.create({
  // Filter (shared for users & monitors tabs)
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  filterInput: {
    flex: 1, backgroundColor: '#222', color: '#FFF', padding: 10,
    borderRadius: 8, borderWidth: 1, borderColor: '#333', fontSize: 13,
  },
  filterChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10, alignItems: 'center' },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: '#222', borderWidth: 1, borderColor: '#444',
  },
  filterChipActive: { backgroundColor: '#00FF00', borderColor: '#00FF00' },
  filterChipText: { color: '#AAA', fontSize: 11, fontWeight: '600' },
  filterChipTextActive: { color: '#000' },
  filterSummary: { color: '#666', fontSize: 11, marginLeft: 'auto' as unknown as number },
  emptyState: { padding: 30, alignItems: 'center' },
  emptyStateText: { color: '#666', fontSize: 13 },

  // Monitor detail styles
  monitorDetailRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  monitorDetailBadge: {
    color: '#AAA', fontSize: 10, backgroundColor: '#333',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, overflow: 'hidden',
  },
  monitorTargetBadge: {
    color: '#FFD700', fontSize: 10, backgroundColor: '#332D00',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, overflow: 'hidden',
  },
  monitorPriceRow: { flexDirection: 'row', gap: 16, marginTop: 6 },
  monitorLowest: { color: '#00FF00', fontSize: 13, fontWeight: '600' },
  monitorCheckedAt: { color: '#555', fontSize: 10, marginTop: 4 },

  // Search bar
  apSearchRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  apSearchInput: {
    flex: 1, backgroundColor: '#222', color: '#FFF', padding: 10,
    borderRadius: 8, borderWidth: 1, borderColor: '#333', fontSize: 13,
  },
  apSearchBtn: { backgroundColor: '#00FF00', paddingHorizontal: 16, borderRadius: 8, justifyContent: 'center' },
  apSearchBtnText: { color: '#000', fontSize: 13, fontWeight: '700' },

  // Actions row
  apActionsRow: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  apAddBtn: { backgroundColor: '#00FF00', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  apAddBtnText: { color: '#000', fontSize: 12, fontWeight: '700' },
  apUploadBtn: { backgroundColor: '#1E90FF', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  apUploadBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  apFilterBtn: { backgroundColor: '#333', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#555' },
  apFilterBtnActive: { borderColor: '#00FF00' },
  apFilterBtnText: { color: '#CCC', fontSize: 12 },

  // Summary
  apSummary: { color: '#888', fontSize: 11, marginBottom: 8 },

  // Airport card
  apCard: { backgroundColor: '#222', padding: 12, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#333' },
  apCardDisabled: { opacity: 0.5, borderColor: '#FF4444' },
  apCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  apIata: { color: '#00FF00', fontSize: 16, fontWeight: '700', fontFamily: Platform.OS === 'web' ? 'monospace' : undefined },
  apType: { color: '#888', fontSize: 11 },
  apDisabledBadge: { color: '#FF4444', fontSize: 10, fontWeight: '700', backgroundColor: '#330000', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  apName: { color: '#CCC', fontSize: 13, marginBottom: 2 },
  apCity: { color: '#888', fontSize: 11 },
  apCardActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 },
  apToggleBtn: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6 },
  apEnableBtn: { backgroundColor: '#00AA00' },
  apDisableBtn: { backgroundColor: '#AA4400' },
  apToggleBtnText: { color: '#FFF', fontSize: 11, fontWeight: '600' },

  // Pagination
  apPagination: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 12, marginBottom: 8 },
  apPageBtn: { backgroundColor: '#333', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  apPageBtnDisabled: { opacity: 0.3 },
  apPageBtnText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  apPageInfo: { color: '#888', fontSize: 12 },

  // Edit Modal
  editOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center' },
  editScrollContent: { padding: 20 },
  editModal: { backgroundColor: '#1A1A1A', borderRadius: 12, padding: 20, borderWidth: 1, borderColor: '#00FF00' },
  editHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  editTitle: { color: '#00FF00', fontSize: 18, fontWeight: '700' },
  fieldLabel: { color: '#00FF00', fontSize: 10, fontWeight: '600', marginBottom: 4, marginTop: 10, textTransform: 'uppercase' },
  fieldInput: { backgroundColor: '#222', color: '#FFF', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#333', fontSize: 14 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  typeChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: '#333', borderWidth: 1, borderColor: '#444' },
  typeChipActive: { backgroundColor: '#00FF00', borderColor: '#00FF00' },
  typeChipText: { color: '#AAA', fontSize: 10, fontWeight: '600' },
  typeChipTextActive: { color: '#000' },
  coordRow: { flexDirection: 'row', gap: 12 },
  disabledToggle: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: '#555', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  checkboxChecked: { backgroundColor: '#FF4444', borderColor: '#FF4444' },
  checkmark: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  disabledLabel: { color: '#CCC', fontSize: 13 },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 20 },
  cancelBtn: { backgroundColor: '#333', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  cancelBtnText: { color: '#CCC', fontSize: 14, fontWeight: '600' },
  saveBtn: { backgroundColor: '#00FF00', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  saveBtnText: { color: '#000', fontSize: 14, fontWeight: '700' },
});
