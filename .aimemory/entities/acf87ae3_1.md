# Source: frontend/app/auth/verify-email.tsx
# Lines: 114-135
# Type: Function: VerifyEmailScreen

```typescript
style={styles.resendButton}
          onPress={handleResend}
          disabled={resendCooldown > 0}
        >
          <Text style={[styles.resendText, resendCooldown > 0 && styles.resendDisabled]}>
            {resendCooldown > 0
              ? `Resend Code (${resendCooldown}s)`
              : 'Resend Code'}
          </Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <TouchableOpacity onPress={() => router.push('/auth/login')}>
            <Text style={styles.linkText}>Back to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
```
