// screens/WalletScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  Modal,
  TextInput
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import Icon from 'react-native-vector-icons/MaterialIcons';

export const WalletScreen = () => {
  const { user } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [depositModal, setDepositModal] = useState(false);
  const [withdrawModal, setWithdrawModal] = useState(false);
  const [amount, setAmount] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchWalletData();
  }, []);

  const fetchWalletData = async () => {
    try {
      const [walletRes, transactionsRes] = await Promise.all([
        api.get('/wallet/balance'),
        api.get('/wallet/transactions?limit=10')
      ]);
      setWallet(walletRes.data);
      setTransactions(transactionsRes.data.transactions);
    } catch (error) {
      Alert.alert('Error', 'Failed to load wallet data');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchWalletData();
    setRefreshing(false);
  };

  const handleMpesaDeposit = async () => {
    if (!amount || !phoneNumber) {
      Alert.alert('Error', 'Please enter amount and phone number');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/wallet/deposit/mpesa', {
        amount: parseFloat(amount),
        phoneNumber
      });
      
      Alert.alert(
        'STK Push Sent',
        'Please check your phone to complete the payment',
        [{ text: 'OK', onPress: () => setDepositModal(false) }]
      );
      
      setAmount('');
      setPhoneNumber('');
    } catch (error) {
      Alert.alert('Error', error.response?.data?.error || 'Deposit failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <Text style={styles.balanceAmount}>KES {wallet?.balance?.toLocaleString()}</Text>
          
          <View style={styles.balanceRow}>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceItemLabel}>Pending</Text>
              <Text style={styles.balanceItemValue}>
                KES {wallet?.pendingBalance?.toLocaleString()}
              </Text>
            </View>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceItemLabel}>Locked</Text>
              <Text style={styles.balanceItemValue}>
                KES {wallet?.lockedBalance?.toLocaleString()}
              </Text>
            </View>
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.depositButton]}
              onPress={() => setDepositModal(true)}
            >
              <Icon name="add" size={20} color="#fff" />
              <Text style={styles.buttonText}>Deposit</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, styles.withdrawButton]}
              onPress={() => setWithdrawModal(true)}
            >
              <Icon name="remove" size={20} color="#fff" />
              <Text style={styles.buttonText}>Withdraw</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Transactions */}
        <View style={styles.transactionsCard}>
          <Text style={styles.sectionTitle}>Recent Transactions</Text>
          
          {transactions.map((transaction) => (
            <View key={transaction.id} style={styles.transactionItem}>
              <View style={styles.transactionIcon}>
                <Icon
                  name={
                    transaction.type === 'deposit' ? 'arrow-downward' :
                    transaction.type === 'withdrawal' ? 'arrow-upward' :
                    transaction.type.includes('winning') ? 'emoji-events' :
                    'swap-horiz'
                  }
                  size={24}
                  color={
                    transaction.type === 'deposit' ? '#10b981' :
                    transaction.type === 'withdrawal' ? '#ef4444' :
                    transaction.type.includes('winning') ? '#f59e0b' :
                    '#6b7280'
                  }
                />
              </View>
              
              <View style={styles.transactionDetails}>
                <Text style={styles.transactionType}>
                  {transaction.type.replace('_', ' ').toUpperCase()}
                </Text>
                <Text style={styles.transactionDate}>
                  {new Date(transaction.createdAt).toLocaleDateString()}
                </Text>
              </View>
              
              <View style={styles.transactionAmount}>
                <Text
                  style={[
                    styles.amountText,
                    transaction.type === 'deposit' || transaction.type.includes('winning')
                      ? styles.positiveAmount
                      : styles.negativeAmount
                  ]}
                >
                  {transaction.type === 'deposit' || transaction.type.includes('winning')
                    ? '+'
                    : '-'}
                  KES {transaction.amount.toLocaleString()}
                </Text>
                <Text style={styles.transactionStatus}>
                  {transaction.status}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Deposit Modal */}
      <Modal
        visible={depositModal}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Deposit Funds</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Amount (KES)"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />
            
            <TextInput
              style={styles.input}
              placeholder="M-Pesa Phone Number"
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
            />

            <TouchableOpacity
              style={[styles.modalButton, styles.mpesaButton]}
              onPress={handleMpesaDeposit}
              disabled={loading}
            >
              <Icon name="phone-android" size={20} color="#fff" />
              <Text style={styles.buttonText}>
                {loading ? 'Processing...' : 'Pay with M-Pesa'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setDepositModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  balanceCard: {
    backgroundColor: '#3b82f6',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  balanceLabel: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
  },
  balanceAmount: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
    marginVertical: 8,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 16,
  },
  balanceItem: {
    flex: 1,
  },
  balanceItemLabel: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.9,
  },
  balanceItemValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  depositButton: {
    backgroundColor: '#10b981',
  },
  withdrawButton: {
    backgroundColor: '#ef4444',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  transactionsCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionType: {
    fontSize: 14,
    fontWeight: '600',
  },
  transactionDate: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 14,
    fontWeight: '600',
  },
  positiveAmount: {
    color: '#10b981',
  },
  negativeAmount: {
    color: '#ef4444',
  },
  transactionStatus: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  mpesaButton: {
    backgroundColor: '#10b981',
  },
  cancelButton: {
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default WalletScreen;