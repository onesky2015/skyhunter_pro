// filename: app/purchase.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { API_URL } from '../constants/api';
import { apiRequest } from '../services/api';
import { useI18n } from '../i18n';

interface CreditProduct {
  product_id: string;
  credits: number;
  price_usd: number;
}

export default function PurchaseScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { userToken, userInfo, refreshUserInfo, handle401Error } = useAuth();
  const [products, setProducts] = useState<CreditProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const resp = await fetch(`${API_URL}/api/v1/payments/products`);
      if (resp.ok) {
        setProducts(await resp.json());
      }
    } catch {
      Alert.alert(t('common', 'error'), t('purchase', 'failedToLoadProducts'));
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (product: CreditProduct) => {
    if (Platform.OS === 'web') {
      await handleStripePurchase(product);
    } else if (Platform.OS === 'ios') {
      await handleAppleIAP(product);
    } else {
      await handleGooglePlay(product);
    }
  };

  const handleStripePurchase = async (product: CreditProduct) => {
    setPurchasing(product.product_id);
    try {
      const resp = await apiRequest(
        '/api/v1/payments/stripe/checkout',
        {
          method: 'POST',
          body: JSON.stringify({ product_id: product.product_id }),
        },
        userToken,
        handle401Error
      );
      if (!resp.ok) {
        const err = await resp.json().catch(() => null);
        throw new Error(err?.detail || `HTTP ${resp.status}`);
      }
      const data = await resp.json();
      if (data.checkout_url) {
        await Linking.openURL(data.checkout_url);
      }
    } catch (err: any) {
      Alert.alert(t('purchase', 'paymentError'), err?.message || t('purchase', 'checkoutFailed'));
    } finally {
      setPurchasing(null);
    }
  };

  const handleAppleIAP = async (product: CreditProduct) => {
    setPurchasing(product.product_id);
    try {
      Alert.alert(
        'Apple IAP',
        'In-App Purchase will be available after App Store review. Please use mock topup for now.',
      );
    } catch (err: any) {
      Alert.alert('Purchase Error', err?.message || 'Failed');
    } finally {
      setPurchasing(null);
    }
  };

  const handleGooglePlay = async (product: CreditProduct) => {
    setPurchasing(product.product_id);
    try {
      Alert.alert(
        'Google Play',
        'Google Play Billing will be available after Play Store review. Please use mock topup for now.',
      );
    } catch (err: any) {
      Alert.alert('Purchase Error', err?.message || 'Failed');
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>{t('common', 'back')}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('purchase', 'title')}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>{t('purchase', 'currentBalance')}</Text>
          <Text style={styles.balanceValue}>{userInfo?.credits ?? 0} credits</Text>
        </View>

        {loading ? (
          <ActivityIndicator color="#00FF00" size="large" style={{ marginTop: 40 }} />
        ) : (
          products.map((product) => (
            <TouchableOpacity
              key={product.product_id}
              style={[
                styles.productCard,
                purchasing === product.product_id && styles.productCardActive,
              ]}
              onPress={() => handlePurchase(product)}
              disabled={purchasing !== null}
            >
              <View style={styles.productInfo}>
                <Text style={styles.productCredits}>{product.credits} Credits</Text>
                <Text style={styles.productPrice}>${product.price_usd.toFixed(2)}</Text>
              </View>
              {purchasing === product.product_id ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <Text style={styles.buyText}>{t('purchase', 'buy')}</Text>
              )}
            </TouchableOpacity>
          ))
        )}

        <Text style={styles.note}>
          {Platform.OS === 'ios'
            ? 'Payment processed via Apple In-App Purchase'
            : Platform.OS === 'android'
            ? 'Payment processed via Google Play'
            : 'Payment processed via Stripe (secure checkout)'}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: '#111111',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  backBtn: { width: 60 },
  backText: { color: '#00FF00', fontSize: 14 },
  headerTitle: { color: '#00FF00', fontSize: 18, fontWeight: '700' },
  content: { padding: 16 },
  balanceCard: {
    backgroundColor: '#111111',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#00FF00',
    alignItems: 'center',
    marginBottom: 24,
  },
  balanceLabel: { color: '#999', fontSize: 13, marginBottom: 4 },
  balanceValue: { color: '#00FF00', fontSize: 28, fontWeight: '700' },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111111',
    borderRadius: 12,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  productCardActive: { borderColor: '#00FF00' },
  productInfo: { flex: 1 },
  productCredits: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  productPrice: { color: '#00FF00', fontSize: 15, marginTop: 4 },
  buyText: {
    color: '#000000',
    backgroundColor: '#00FF00',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    fontWeight: '700',
    fontSize: 14,
    overflow: 'hidden',
  },
  note: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
});
