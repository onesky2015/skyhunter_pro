import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, TextInput, Alert, Platform } from 'react-native';
import { adminApi } from '../../services/api';
import { useI18n } from '../../i18n';

interface ConfigItem {
  key: string;
  value: string;
  description: string | null;
}

export const ConfigsTab: React.FC<{ userToken: string | null; on401: () => void }> = ({ userToken, on401 }) => {
  const { t } = useI18n();
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const fetchConfigs = async () => {
    if (!userToken) return;
    try {
      setLoading(true);
      const res = await adminApi.getConfigs(userToken, on401);
      setConfigs(res);
    } catch (err) {
      console.error('Failed to fetch configs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, [userToken]);

  const handleSave = async (key: string) => {
    if (!userToken) return;
    try {
      let finalValue = editValue;
      try {
        // Automatically prettify JSON if the user typed valid JSON
        const parsed = JSON.parse(editValue);
        finalValue = JSON.stringify(parsed);
      } catch (e) {
        // It's just a raw string, use as is
      }
      await adminApi.setConfig(userToken, key, finalValue, editDesc, on401);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.alert('Saved successfully');
      } else {
          Alert.alert('Success', 'Configuration saved');
      }
      setEditingKey(null);
      fetchConfigs();
    } catch (err: any) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.alert(`Error: ${err.message}`);
      } else {
          Alert.alert('Error', err.message);
      }
    }
  };

  const handleEdit = (c: ConfigItem) => {
    setEditingKey(c.key);
    let strValue = c.value;
    try {
      strValue = JSON.stringify(JSON.parse(c.value), null, 2);
    } catch (e) { }
    setEditValue(strValue);
    setEditDesc(c.description || '');
  };

  const KNOWN_CONFIGS = [
    { key: 'search_cost_single_day', label: '每次固定日期搜索扣除积分数', defaultValue: '1' },
    { key: 'search_cost_multi_day', label: '每次大范围热力图搜索扣除积分数', defaultValue: '5' },
    { key: 'monitor_cost_per_check', label: '监控任务单次扫描扣除积分基数', defaultValue: '0.1' },
    { key: 'credit_pricing_packages', label: '前端购买积分套餐与美元价格 (JSON格式)', defaultValue: '{\n  "credits_50": {"credits": 50, "price_usd": 0.99, "stripe_price_id": ""},\n  "credits_200": {"credits": 200, "price_usd": 2.99, "stripe_price_id": ""}\n}' },
  ];

  // Merge known configs and custom configs from DB
  const displayList = [...configs];
  KNOWN_CONFIGS.forEach(kc => {
    if (!displayList.find(c => c.key === kc.key)) {
      displayList.push({ key: kc.key, value: `(未设置 - 默认值: ${kc.defaultValue})`, description: kc.label });
    }
  });
  // bring known configs to the top
  displayList.sort((a, b) => {
    const isAKnown = KNOWN_CONFIGS.some(k => k.key === a.key);
    const isBKnown = KNOWN_CONFIGS.some(k => k.key === b.key);
    if (isAKnown && !isBKnown) return -1;
    if (!isAKnown && isBKnown) return 1;
    return 0;
  });

  if (loading) return <ActivityIndicator color="#00FF00" style={{ marginVertical: 20 }} />;

  return (
    <View style={s.container}>
      <Text style={s.title}>{t('admin', 'configsTitle')}</Text>
      <Text style={s.descText}>
        {t('admin', 'configsDesc')}
      </Text>
      
      {displayList.map((c) => {
        const knownMatch = KNOWN_CONFIGS.find(k => k.key === c.key);
        const displayName = knownMatch ? knownMatch.label : c.key;
        return (
          <View key={c.key} style={s.card}>
            <Text style={s.keyText}>{displayName}</Text>
            {knownMatch && <Text style={s.descText}>系统键名: {c.key}</Text>}
            
            {editingKey === c.key ? (
              <View>
                <TextInput
                  style={s.input}
                  value={editValue}
                  onChangeText={setEditValue}
                  multiline
                />
                <TextInput
                  style={s.inputDesc}
                  value={editDesc}
                  onChangeText={setEditDesc}
                  placeholder={t('admin', 'descriptionOptional')}
                  placeholderTextColor="#666"
                />
                <View style={s.actionRow}>
                  <TouchableOpacity onPress={() => setEditingKey(null)} style={s.cancelBtn}>
                    <Text style={s.cancelText}>{t('common', 'cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleSave(c.key)} style={s.saveBtn}>
                    <Text style={s.saveText}>{t('common', 'save')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View>
                <Text style={s.valueText}>{c.value}</Text>
                {!knownMatch && c.description && <Text style={s.descText}>{c.description}</Text>}
                <TouchableOpacity
                  onPress={() => {
                    const isUnset = c.value.startsWith('(未设置');
                    setEditingKey(c.key);
                    setEditValue(isUnset && knownMatch ? knownMatch.defaultValue : c.value);
                    setEditDesc(knownMatch ? knownMatch.label : (c.description || ''));
                  }}
                  style={s.editBtn}
                >
                  <Text style={s.editText}>{t('admin', 'edit')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}

      {configs.length === 0 && (
         <View style={s.emptyState}>
           <Text style={s.emptyStateText}>{t('admin', 'noConfigs')}</Text>
         </View>
      )}

      {/* Add Custom New Config Form */}
      {editingKey === 'NEW_CONFIG' ? (
        <View style={s.card}>
          <Text style={s.keyText}>{t('admin', 'newConfigKey')}</Text>
          <TextInput
            style={[s.inputDesc, { marginBottom: 12 }]}
            value={editDesc} 
            onChangeText={setEditDesc} // using editDesc temporarily for new key name
            placeholder={t('admin', 'newConfigPlaceholder')}
            placeholderTextColor="#666"
          />
          <Text style={s.keyText}>{t('admin', 'configValue')}</Text>
          <TextInput
            style={s.input}
            value={editValue}
            onChangeText={setEditValue}
            placeholder={t('admin', 'configValue')}
            placeholderTextColor="#666"
            multiline
          />
          <View style={s.actionRow}>
            <TouchableOpacity onPress={() => setEditingKey(null)} style={s.cancelBtn}>
              <Text style={s.cancelText}>{t('common', 'cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleSave(editDesc)} style={s.saveBtn}>
              <Text style={s.saveText}>{t('admin', 'saveConfig')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={s.addBtn} onPress={() => { setEditingKey('NEW_CONFIG'); setEditValue(''); setEditDesc(''); }}>
          <Text style={s.addText}>{t('admin', 'addConfig')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const s = StyleSheet.create({
  container: { paddingBottom: 40 },
  title: { color: '#00FF00', fontSize: 18, fontWeight: 'bold', marginBottom: 16 },
  card: { backgroundColor: '#222', padding: 16, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: '#333' },
  keyText: { color: '#00FF00', fontSize: 16, fontWeight: '600', marginBottom: 8 },
  valueText: { color: '#CCC', fontSize: 14, fontFamily: 'monospace', marginBottom: 6 },
  descText: { color: '#888', fontSize: 12, marginBottom: 12 },
  editBtn: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#333', borderRadius: 4 },
  editText: { color: '#FFF' },
  input: { backgroundColor: '#111', color: '#FFF', padding: 12, borderRadius: 4, minHeight: 80, fontFamily: 'monospace', ...Platform.select({ web: { outlineStyle: 'none' as any } }) },
  inputDesc: { backgroundColor: '#111', color: '#FFF', padding: 12, borderRadius: 4, marginTop: 12, ...Platform.select({ web: { outlineStyle: 'none' as any } }) },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16, gap: 12 },
  cancelBtn: { paddingVertical: 8, paddingHorizontal: 16 },
  cancelText: { color: '#888' },
  saveBtn: { backgroundColor: '#00FF00', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 4 },
  saveText: { color: '#000', fontWeight: 'bold' },
  addBtn: { marginTop: 12, padding: 16, borderStyle: 'dashed', borderWidth: 1, borderColor: '#00FF00', borderRadius: 8, alignItems: 'center' },
  addText: { color: '#00FF00', fontWeight: 'bold' },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyStateText: { color: '#666', fontStyle: 'italic' },
});
