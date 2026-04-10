// filename: frontend/components/admin/CreditPricingTab.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import { adminApi } from '../../services/api';
import { useI18n } from '../../i18n';

const CONFIG_KEY = 'credit_pricing_packages';

/** 与 backend/routers/payments.py CREDIT_PRODUCTS 一致，作为未配置 DB 时的编辑起点 */
const DEFAULT_PACKAGES_JSON = `{
  "credits_50": { "credits": 50, "price_usd": 0.99, "stripe_price_id": "" },
  "credits_200": { "credits": 200, "price_usd": 2.99, "stripe_price_id": "" },
  "credits_500": { "credits": 500, "price_usd": 4.99, "stripe_price_id": "" },
  "credits_1500": { "credits": 1500, "price_usd": 9.99, "stripe_price_id": "" }
}`;

type PackageRow = {
  product_id: string;
  credits: string;
  price_usd: string;
  stripe_price_id: string;
};

function parseToRows(raw: string | undefined): PackageRow[] {
  if (!raw || raw.startsWith('(未设置')) {
    return objectToRows(JSON.parse(DEFAULT_PACKAGES_JSON));
  }
  try {
    const obj = JSON.parse(raw);
    if (typeof obj !== 'object' || obj === null) throw new Error('not object');
    return objectToRows(obj as Record<string, Record<string, unknown>>);
  } catch {
    return objectToRows(JSON.parse(DEFAULT_PACKAGES_JSON));
  }
}

function objectToRows(obj: Record<string, Record<string, unknown>>): PackageRow[] {
  return Object.entries(obj).map(([product_id, v]) => ({
    product_id,
    credits: String(v.credits ?? ''),
    price_usd: String(v.price_usd ?? ''),
    stripe_price_id: typeof v.stripe_price_id === 'string' ? v.stripe_price_id : '',
  }));
}

function rowsToJson(rows: PackageRow[]): string {
  const out: Record<string, { credits: number; price_usd: number; stripe_price_id: string }> = {};
  for (const r of rows) {
    const pid = r.product_id.trim();
    if (!pid) continue;
    const credits = parseInt(r.credits, 10);
    const price = parseFloat(r.price_usd);
    if (!Number.isFinite(credits) || credits < 1) continue;
    if (!Number.isFinite(price) || price < 0) continue;
    out[pid] = {
      credits,
      price_usd: price,
      stripe_price_id: r.stripe_price_id.trim(),
    };
  }
  return JSON.stringify(out);
}

export const CreditPricingTab: React.FC<{ userToken: string | null; on401: () => void }> = ({
  userToken,
  on401,
}) => {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<PackageRow[]>([]);

  const load = useCallback(async () => {
    if (!userToken) return;
    try {
      setLoading(true);
      const configs = await adminApi.getConfigs(userToken, on401);
      const item = configs.find((c: { key: string }) => c.key === CONFIG_KEY);
      setRows(parseToRows(item?.value));
    } catch (e) {
      console.error(e);
      setRows(parseToRows(undefined));
    } finally {
      setLoading(false);
    }
  }, [userToken, on401]);

  useEffect(() => {
    load();
  }, [load]);

  const updateRow = (index: number, field: keyof PackageRow, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      { product_id: `credits_${Date.now()}`, credits: '100', price_usd: '0.99', stripe_price_id: '' },
    ]);
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const validate = (): string | null => {
    const ids = new Set<string>();
    for (const r of rows) {
      const pid = r.product_id.trim();
      if (!pid) return t('admin', 'pricingErrProductId');
      if (ids.has(pid)) return t('admin', 'pricingErrDuplicateId').replace('{id}', pid);
      ids.add(pid);
      const c = parseInt(r.credits, 10);
      const p = parseFloat(r.price_usd);
      if (!Number.isFinite(c) || c < 1) return t('admin', 'pricingErrCredits');
      if (!Number.isFinite(p) || p < 0) return t('admin', 'pricingErrPrice');
    }
    if (ids.size === 0) return t('admin', 'pricingErrEmpty');
    return null;
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(err);
      else Alert.alert(t('common', 'error') || 'Error', err);
      return;
    }
    if (!userToken) return;
    try {
      setSaving(true);
      const json = rowsToJson(rows);
      await adminApi.setConfig(
        userToken,
        CONFIG_KEY,
        json,
        t('admin', 'pricingConfigDesc'),
        on401
      );
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(t('admin', 'pricingSaved'));
      } else {
        Alert.alert(t('admin', 'pricingSaved'));
      }
      await load();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.alert(msg);
      else Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <ActivityIndicator color="#00FF00" style={{ marginVertical: 24 }} />;
  }

  return (
    <ScrollView style={s.wrap} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>{t('admin', 'pricingTitle')}</Text>
      <Text style={s.desc}>{t('admin', 'pricingDesc')}</Text>

      {rows.map((row, index) => (
        <View key={`${row.product_id}-${index}`} style={s.card}>
          <Text style={s.cardLabel}>{t('admin', 'pricingPackage')} #{index + 1}</Text>
          <Text style={s.fieldLabel}>{t('admin', 'pricingProductId')}</Text>
          <TextInput
            style={s.input}
            value={row.product_id}
            onChangeText={(v) => updateRow(index, 'product_id', v)}
            placeholder="credits_200"
            placeholderTextColor="#666"
            autoCapitalize="none"
          />
          <Text style={s.fieldLabel}>{t('admin', 'pricingCredits')}</Text>
          <TextInput
            style={s.input}
            value={row.credits}
            onChangeText={(v) => updateRow(index, 'credits', v)}
            keyboardType="number-pad"
            placeholder="200"
            placeholderTextColor="#666"
          />
          <Text style={s.fieldLabel}>{t('admin', 'pricingPriceUsd')}</Text>
          <TextInput
            style={s.input}
            value={row.price_usd}
            onChangeText={(v) => updateRow(index, 'price_usd', v)}
            keyboardType="decimal-pad"
            placeholder="2.99"
            placeholderTextColor="#666"
          />
          <Text style={s.fieldLabel}>{t('admin', 'pricingStripePriceId')}</Text>
          <TextInput
            style={s.input}
            value={row.stripe_price_id}
            onChangeText={(v) => updateRow(index, 'stripe_price_id', v)}
            placeholder="price_xxx (Web/Stripe)"
            placeholderTextColor="#666"
            autoCapitalize="none"
          />
          <TouchableOpacity style={s.removeBtn} onPress={() => removeRow(index)}>
            <Text style={s.removeText}>{t('admin', 'pricingRemove')}</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity style={s.addBtn} onPress={addRow}>
        <Text style={s.addText}>{t('admin', 'pricingAdd')}</Text>
      </TouchableOpacity>

      <View style={s.actions}>
        <TouchableOpacity style={s.secondaryBtn} onPress={load} disabled={saving}>
          <Text style={s.secondaryText}>{t('admin', 'pricingReload')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
          <Text style={s.saveText}>{saving ? t('common', 'saving') : t('admin', 'pricingSave')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const s = StyleSheet.create({
  wrap: { paddingBottom: 32 },
  title: { color: '#00FF00', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  desc: { color: '#888', fontSize: 12, marginBottom: 16, lineHeight: 18 },
  card: {
    backgroundColor: '#222',
    padding: 14,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  cardLabel: { color: '#CCC', fontSize: 13, marginBottom: 10 },
  fieldLabel: { color: '#888', fontSize: 11, marginBottom: 4 },
  input: {
    backgroundColor: '#111',
    color: '#FFF',
    padding: 10,
    borderRadius: 4,
    marginBottom: 10,
    ...Platform.select({ web: { outlineStyle: 'none' as any } }),
  },
  removeBtn: { alignSelf: 'flex-start', marginTop: 4 },
  removeText: { color: '#f66', fontSize: 13 },
  addBtn: {
    padding: 14,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#00FF00',
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  addText: { color: '#00FF00', fontWeight: 'bold' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
  secondaryBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 4, backgroundColor: '#333' },
  secondaryText: { color: '#CCC' },
  saveBtn: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 4, backgroundColor: '#00FF00' },
  saveText: { color: '#000', fontWeight: 'bold' },
});
